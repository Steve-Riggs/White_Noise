"""White Noise integration."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from pathlib import Path
import shutil
from typing import Any

from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

import voluptuous as vol

from .const import (
    CONF_COPY_BUNDLED_AUDIO,
    CONF_MEDIA_FOLDER,
    DEFAULT_COPY_BUNDLED_AUDIO,
    DEFAULT_MEDIA_FOLDER,
    DOMAIN,
    SUPPORTED_EXTENSIONS,
)

PLATFORMS = ["sensor"]


@dataclass(slots=True)
class WhiteNoiseSound:
    """Discovered white noise sound."""

    sound_id: str
    name: str
    path: str
    file_name: str


class WhiteNoiseData:
    """Runtime data for White Noise."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self.entry = entry
        self.sounds: dict[str, WhiteNoiseSound] = {}
        self.stop_tasks: dict[str, asyncio.Task[None]] = {}

    @property
    def options(self) -> dict[str, Any]:
        """Return merged config entry data and options."""
        return {**self.entry.data, **self.entry.options}

    @property
    def media_folder(self) -> Path:
        """Return the configured media folder."""
        return Path(self.options.get(CONF_MEDIA_FOLDER, DEFAULT_MEDIA_FOLDER))

    async def prepare_media_folder(self) -> None:
        """Create media folder and optionally copy bundled audio."""
        await self.hass.async_add_executor_job(self._prepare_media_folder_sync)

    def _prepare_media_folder_sync(self) -> None:
        """Create media folder and copy bundled audio in executor."""
        self.media_folder.mkdir(parents=True, exist_ok=True)

        copy_bundled = self.options.get(
            CONF_COPY_BUNDLED_AUDIO, DEFAULT_COPY_BUNDLED_AUDIO
        )
        if not copy_bundled:
            return

        bundled_folder = Path(__file__).parent / "audio"
        if not bundled_folder.exists():
            return

        for source in bundled_folder.iterdir():
            if not source.is_file() or source.suffix.lower() not in SUPPORTED_EXTENSIONS:
                continue

            destination = self.media_folder / source.name
            if not destination.exists():
                shutil.copy2(source, destination)

    async def refresh_sounds(self) -> None:
        """Refresh discovered audio files."""
        self.sounds = await self.hass.async_add_executor_job(self._scan_sounds_sync)

        for entity in self.hass.data[DOMAIN][self.entry.entry_id].get("entities", []):
            entity.async_write_ha_state()

    def _scan_sounds_sync(self) -> dict[str, WhiteNoiseSound]:
        """Scan media folder for supported audio files."""
        self.media_folder.mkdir(parents=True, exist_ok=True)
        sounds: dict[str, WhiteNoiseSound] = {}

        for file_path in sorted(self.media_folder.iterdir()):
            if not file_path.is_file() or file_path.suffix.lower() not in SUPPORTED_EXTENSIONS:
                continue

            sound_id = _clean_sound_id(file_path.stem)
            sounds[sound_id] = WhiteNoiseSound(
                sound_id=sound_id,
                name=_clean_sound_name(file_path.stem),
                path=str(file_path),
                file_name=file_path.name,
            )

        return sounds

    async def async_play(
        self,
        speaker: str,
        sound_id: str,
        duration: int | None,
        volume: int | None,
    ) -> None:
        """Play selected sound and stop after duration."""
        target_speaker = speaker

        if not self.sounds:
            await self.refresh_sounds()

        sound = self.sounds.get(sound_id)
        if sound is None:
            raise HomeAssistantError(f"Unknown white noise sound: {sound_id}")

        await self.async_stop(target_speaker)

        if volume is not None:
            await self.hass.services.async_call(
                "media_player",
                "volume_set",
                {"entity_id": target_speaker, "volume_level": volume / 100},
                blocking=True,
            )

        await self.hass.services.async_call(
            "media_player",
            "play_media",
            {
                "entity_id": target_speaker,
                "media_content_id": _media_source_id(self.media_folder, sound),
                "media_content_type": "music",
            },
            blocking=True,
        )

        if duration is not None and duration > 0:
            self.stop_tasks[target_speaker] = self.hass.async_create_task(
                self._stop_later(target_speaker, duration)
            )

    async def async_stop(self, speaker: str) -> None:
        """Stop playback on a speaker."""
        target_speaker = speaker

        task = self.stop_tasks.pop(target_speaker, None)
        if task and not task.done():
            task.cancel()

        await self.hass.services.async_call(
            "media_player",
            "media_stop",
            {"entity_id": target_speaker},
            blocking=True,
        )

    async def _stop_later(self, speaker: str, duration: int) -> None:
        """Stop a speaker after a delay."""
        try:
            await asyncio.sleep(duration * 60)
            await self.async_stop(speaker)
        except asyncio.CancelledError:
            return


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Set up integration services."""
    hass.data.setdefault(DOMAIN, {})

    async def handle_play(call: ServiceCall) -> None:
        entry_data = _get_primary_data(hass)
        await entry_data.async_play(
            call.data["speaker"],
            call.data["sound"],
            call.data.get("duration"),
            call.data.get("volume"),
        )

    async def handle_stop(call: ServiceCall) -> None:
        entry_data = _get_primary_data(hass)
        await entry_data.async_stop(call.data["speaker"])

    async def handle_refresh_sounds(call: ServiceCall) -> None:
        entry_data = _get_primary_data(hass)
        await entry_data.refresh_sounds()

    hass.services.async_register(
        DOMAIN,
        "play",
        handle_play,
        schema=vol.Schema(
            {
                vol.Required("speaker"): cv.entity_id,
                vol.Required("sound"): cv.string,
                vol.Optional("duration"): vol.All(vol.Coerce(int), vol.Range(min=0)),
                vol.Optional("volume"): vol.All(vol.Coerce(int), vol.Range(min=0, max=100)),
            }
        ),
    )
    hass.services.async_register(
        DOMAIN,
        "stop",
        handle_stop,
        schema=vol.Schema({vol.Required("speaker"): cv.entity_id}),
    )
    hass.services.async_register(
        DOMAIN,
        "refresh_sounds",
        handle_refresh_sounds,
        schema=vol.Schema({}),
    )

    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up White Noise from a config entry."""
    data = WhiteNoiseData(hass, entry)
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = {"data": data, "entities": []}

    await data.prepare_media_folder()
    await data.refresh_sounds()
    await _register_static_paths(hass)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(async_update_options))

    return True


async def _register_static_paths(hass: HomeAssistant) -> None:
    """Register frontend assets served by this integration."""
    if hass.data[DOMAIN].get("static_paths_registered"):
        return

    www_path = Path(__file__).parent / "www"
    static_paths = []

    browser_test_card_path = www_path / "browser-test-card.js"
    if browser_test_card_path.exists():
        static_paths.append(
            StaticPathConfig(
                "/white_noise/browser-test-card.js",
                str(browser_test_card_path),
                True,
            )
        )

    card_path = www_path / "white-noise-card.js"
    if card_path.exists():
        static_paths.append(
            StaticPathConfig(
                "/white_noise/white-noise-card.js",
                str(card_path),
                True,
            )
        )

    if not static_paths:
        return

    await hass.http.async_register_static_paths(static_paths)
    hass.data[DOMAIN]["static_paths_registered"] = True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload White Noise."""
    data: WhiteNoiseData = hass.data[DOMAIN][entry.entry_id]["data"]
    for task in data.stop_tasks.values():
        task.cancel()

    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)

    return unload_ok


async def async_update_options(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload config entry after options update."""
    await hass.config_entries.async_reload(entry.entry_id)


def _get_primary_data(hass: HomeAssistant) -> WhiteNoiseData:
    """Return the first configured White Noise entry data."""
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        raise HomeAssistantError("White Noise is not configured")

    return hass.data[DOMAIN][entries[0].entry_id]["data"]


def _clean_sound_id(value: str) -> str:
    """Convert a filename into a stable sound ID."""
    cleaned = value.lower().replace("-", "_").replace(" ", "_")
    return "".join(char for char in cleaned if char.isalnum() or char == "_")


def _clean_sound_name(value: str) -> str:
    """Convert a filename into a friendly display name."""
    return value.replace("-", " ").replace("_", " ").title()


def _media_source_id(media_folder: Path, sound: WhiteNoiseSound) -> str:
    """Build a media-source URI for local media playback."""
    try:
        relative_path = Path(sound.path).relative_to("/media")
    except ValueError:
        relative_path = Path(media_folder.name) / sound.file_name

    return f"media-source://media_source/local/{relative_path.as_posix()}"
