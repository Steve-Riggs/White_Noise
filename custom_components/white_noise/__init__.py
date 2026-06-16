"""White Noise integration for Home Assistant."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta
import logging
from pathlib import Path
import re
import shutil
from typing import Any

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_ENTITY_ID
from homeassistant.core import HomeAssistant, ServiceCall, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.util import dt as dt_util
from homeassistant.helpers.event import async_call_later

from .const import (
    ATTR_LAST_SOUND,
    ATTR_LAST_SPEAKER,
    ATTR_LAST_STARTED,
    CONF_COPY_BUNDLED_AUDIO,
    CONF_DEFAULT_DURATION,
    CONF_DEFAULT_SPEAKER,
    CONF_DEFAULT_VOLUME,
    CONF_MEDIA_FOLDER,
    DEFAULT_COPY_BUNDLED_AUDIO,
    DEFAULT_DURATION_MINUTES,
    DEFAULT_MEDIA_SUBFOLDER,
    DEFAULT_VOLUME_PERCENT,
    DOMAIN,
    PLATFORMS,
    SERVICE_PLAY,
    SERVICE_REFRESH,
    SERVICE_STOP,
    SUPPORTED_AUDIO_EXTENSIONS,
)

_LOGGER = logging.getLogger(__name__)

PLAY_SERVICE_SCHEMA = vol.Schema(
    {
        vol.Optional(CONF_ENTITY_ID): cv.entity_id,
        vol.Optional("speaker"): cv.entity_id,
        vol.Optional("sound"): cv.string,
        vol.Optional("duration"): vol.All(vol.Coerce(int), vol.Range(min=1, max=720)),
        vol.Optional("volume"): vol.All(vol.Coerce(int), vol.Range(min=0, max=100)),
    }
)

STOP_SERVICE_SCHEMA = vol.Schema(
    {
        vol.Optional(CONF_ENTITY_ID): cv.entity_id,
        vol.Optional("speaker"): cv.entity_id,
    }
)

REFRESH_SERVICE_SCHEMA = vol.Schema({})


@dataclass(slots=True)
class WhiteNoiseSound:
    """A discovered white noise sound file."""

    id: str
    name: str
    filename: str
    path: str
    media_content_id: str
    extension: str

    def as_dict(self) -> dict[str, str]:
        """Return the sound as a Home Assistant attribute-friendly dict."""
        return {
            "id": self.id,
            "name": self.name,
            "filename": self.filename,
            "path": self.path,
            "media_content_id": self.media_content_id,
            "extension": self.extension,
        }


class WhiteNoiseManager:
    """Manage white noise files and playback service calls."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.sounds: list[WhiteNoiseSound] = []
        self.entity = None
        self._stop_handles: dict[str, Any] = {}
        self.last_sound: str | None = None
        self.last_speaker: str | None = None
        self.last_started: str | None = None

    @property
    def options(self) -> dict[str, Any]:
        """Return merged config entry data and options."""
        return {**self.entry.data, **self.entry.options}

    @property
    def default_speaker(self) -> str | None:
        """Return the configured default speaker."""
        return self.options.get(CONF_DEFAULT_SPEAKER) or None

    @property
    def default_duration(self) -> int:
        """Return the configured default duration in minutes."""
        return int(self.options.get(CONF_DEFAULT_DURATION, DEFAULT_DURATION_MINUTES))

    @property
    def default_volume(self) -> int | None:
        """Return the configured default volume percentage."""
        value = self.options.get(CONF_DEFAULT_VOLUME, DEFAULT_VOLUME_PERCENT)
        if value is None or value == "":
            return None
        return int(value)

    @property
    def copy_bundled_audio(self) -> bool:
        """Return whether bundled audio should be copied to the media folder."""
        return bool(self.options.get(CONF_COPY_BUNDLED_AUDIO, DEFAULT_COPY_BUNDLED_AUDIO))

    @property
    def media_root(self) -> Path:
        """Return Home Assistant's local media root path."""
        media_dirs = getattr(self.hass.config, "media_dirs", None)
        if media_dirs and "local" in media_dirs:
            return Path(media_dirs["local"])
        return Path("/media")

    @property
    def media_folder(self) -> Path:
        """Return the white noise media folder path."""
        configured = self.options.get(CONF_MEDIA_FOLDER)
        if configured:
            return Path(configured)
        return self.media_root / DEFAULT_MEDIA_SUBFOLDER

    async def async_prepare(self) -> None:
        """Prepare folders, copy bundled audio, and scan files."""
        await self.hass.async_add_executor_job(self._prepare_sync)
        await self.async_refresh()

    def _prepare_sync(self) -> None:
        """Create the media folder and copy bundled audio files if enabled."""
        media_folder = self.media_folder
        media_folder.mkdir(parents=True, exist_ok=True)

        if not self.copy_bundled_audio:
            return

        bundled_audio = Path(__file__).parent / "audio"
        if not bundled_audio.exists():
            return

        for source in bundled_audio.iterdir():
            if not source.is_file() or source.suffix.lower() not in SUPPORTED_AUDIO_EXTENSIONS:
                continue
            destination = media_folder / source.name
            if destination.exists():
                continue
            _LOGGER.debug("Copying bundled white noise audio %s to %s", source, destination)
            shutil.copy2(source, destination)

    async def async_refresh(self) -> None:
        """Refresh the list of available sounds."""
        self.sounds = await self.hass.async_add_executor_job(self._scan_sounds_sync)
        self._write_entity_state()

    def _scan_sounds_sync(self) -> list[WhiteNoiseSound]:
        """Scan the configured media folder for supported audio files."""
        media_folder = self.media_folder
        media_root = self.media_root
        if not media_folder.exists():
            return []

        sounds: list[WhiteNoiseSound] = []
        for file_path in sorted(media_folder.rglob("*")):
            if not file_path.is_file() or file_path.suffix.lower() not in SUPPORTED_AUDIO_EXTENSIONS:
                continue

            relative_to_media_folder = file_path.relative_to(media_folder).as_posix()
            sound_id = self._clean_id(relative_to_media_folder)
            name = self._clean_name(file_path.stem)

            try:
                relative_to_media_root = file_path.relative_to(media_root).as_posix()
                media_content_id = f"media-source://media_source/local/{relative_to_media_root}"
            except ValueError:
                # Fallback for unusual paths outside the local media source.
                media_content_id = file_path.as_posix()

            sounds.append(
                WhiteNoiseSound(
                    id=sound_id,
                    name=name,
                    filename=file_path.name,
                    path=file_path.as_posix(),
                    media_content_id=media_content_id,
                    extension=file_path.suffix.lower().lstrip("."),
                )
            )
        return sounds

    @staticmethod
    def _clean_name(stem: str) -> str:
        """Convert a file stem into a friendly display name."""
        cleaned = re.sub(r"[_\-]+", " ", stem)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned.title() if cleaned else stem

    @staticmethod
    def _clean_id(relative_filename: str) -> str:
        """Convert a relative filename into a stable sound id."""
        without_ext = str(Path(relative_filename).with_suffix(""))
        cleaned = without_ext.replace("\\", "/").lower()
        cleaned = re.sub(r"[^a-z0-9/]+", "_", cleaned)
        cleaned = cleaned.replace("/", "__")
        return cleaned.strip("_")

    def find_sound(self, sound_id_or_name: str | None) -> WhiteNoiseSound | None:
        """Find a sound by id, file name, or display name."""
        if not self.sounds:
            return None
        if not sound_id_or_name:
            return self.sounds[0]

        needle = sound_id_or_name.casefold().strip()
        for sound in self.sounds:
            if needle in {
                sound.id.casefold(),
                sound.name.casefold(),
                sound.filename.casefold(),
            }:
                return sound
        return None

    async def async_play(self, call: ServiceCall) -> None:
        """Play a selected sound on a selected speaker."""
        data = call.data
        speaker = data.get("speaker") or data.get(CONF_ENTITY_ID) or self.default_speaker
        if not speaker:
            raise vol.Invalid("No speaker supplied and no default speaker is configured")

        if not self.sounds:
            await self.async_refresh()
        sound = self.find_sound(data.get("sound"))
        if not sound:
            available = ", ".join(item.id for item in self.sounds) or "none"
            raise vol.Invalid(f"Unknown white noise sound. Available sounds: {available}")

        duration = int(data.get("duration") or self.default_duration)
        volume = data.get("volume", self.default_volume)

        if volume is not None:
            await self.hass.services.async_call(
                "media_player",
                "volume_set",
                {"entity_id": speaker, "volume_level": max(0, min(int(volume), 100)) / 100},
                blocking=True,
            )

        await self.hass.services.async_call(
            "media_player",
            "play_media",
            {
                "entity_id": speaker,
                "media_content_id": sound.media_content_id,
                "media_content_type": "music",
            },
            blocking=True,
        )

        self._cancel_stop_timer(speaker)
        self._stop_handles[speaker] = async_call_later(
            self.hass,
            timedelta(minutes=duration),
            self._make_stop_callback(speaker),
        )

        self.last_sound = sound.id
        self.last_speaker = speaker
        self.last_started = dt_util.utcnow().isoformat()
        self._write_entity_state()

    async def async_stop(self, call: ServiceCall) -> None:
        """Stop playback on a selected speaker."""
        data = call.data
        speaker = data.get("speaker") or data.get(CONF_ENTITY_ID) or self.default_speaker
        if not speaker:
            raise vol.Invalid("No speaker supplied and no default speaker is configured")

        self._cancel_stop_timer(speaker)
        await self.hass.services.async_call(
            "media_player",
            "media_stop",
            {"entity_id": speaker},
            blocking=True,
        )
        self._write_entity_state()

    def _make_stop_callback(self, speaker: str):
        """Create a callback that stops the selected media player."""

        @callback
        def _stop_callback(now: Any) -> None:
            self._stop_handles.pop(speaker, None)
            self.hass.async_create_task(
                self.hass.services.async_call(
                    "media_player",
                    "media_stop",
                    {"entity_id": speaker},
                    blocking=False,
                )
            )
            self._write_entity_state()

        return _stop_callback

    def _cancel_stop_timer(self, speaker: str) -> None:
        """Cancel an existing stop timer for a speaker."""
        handle = self._stop_handles.pop(speaker, None)
        if handle:
            handle()

    async def async_unload(self) -> None:
        """Unload the manager."""
        for speaker in list(self._stop_handles):
            self._cancel_stop_timer(speaker)

    def _write_entity_state(self) -> None:
        """Ask the sensor entity to write its state."""
        if self.entity is not None:
            self.entity.async_write_ha_state()

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return attributes for the sensor entity."""
        return {
            "sounds": [sound.as_dict() for sound in self.sounds],
            "sound_count": len(self.sounds),
            "media_folder": self.media_folder.as_posix(),
            "default_speaker": self.default_speaker,
            "default_duration": self.default_duration,
            "default_volume": self.default_volume,
            "active_stop_timers": sorted(self._stop_handles),
            ATTR_LAST_SOUND: self.last_sound,
            ATTR_LAST_SPEAKER: self.last_speaker,
            ATTR_LAST_STARTED: self.last_started,
        }


async def async_setup(hass: HomeAssistant, config: dict[str, Any]) -> bool:
    """Set up White Noise services."""
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN].setdefault("managers", {})

    async def _get_manager() -> WhiteNoiseManager:
        managers = hass.data[DOMAIN].get("managers", {})
        if not managers:
            raise vol.Invalid("White Noise is not configured yet")
        return next(iter(managers.values()))

    async def _play(call: ServiceCall) -> None:
        manager = await _get_manager()
        await manager.async_play(call)

    async def _stop(call: ServiceCall) -> None:
        manager = await _get_manager()
        await manager.async_stop(call)

    async def _refresh(call: ServiceCall) -> None:
        manager = await _get_manager()
        await manager.async_refresh()

    hass.services.async_register(DOMAIN, SERVICE_PLAY, _play, schema=PLAY_SERVICE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_STOP, _stop, schema=STOP_SERVICE_SCHEMA)
    hass.services.async_register(DOMAIN, SERVICE_REFRESH, _refresh, schema=REFRESH_SERVICE_SCHEMA)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up White Noise from a config entry."""
    manager = WhiteNoiseManager(hass, entry)
    hass.data.setdefault(DOMAIN, {}).setdefault("managers", {})[entry.entry_id] = manager

    await manager.async_prepare()
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    manager: WhiteNoiseManager | None = hass.data.get(DOMAIN, {}).get("managers", {}).pop(entry.entry_id, None)
    if manager:
        await manager.async_unload()
    return unload_ok


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload the integration when options change."""
    await hass.config_entries.async_reload(entry.entry_id)
