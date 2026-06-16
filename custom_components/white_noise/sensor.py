"""Sensor platform for White Noise."""

from __future__ import annotations

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up White Noise sensors."""
    entity = WhiteNoiseSoundsSensor(hass, entry)
    hass.data[DOMAIN][entry.entry_id]["entities"].append(entity)
    async_add_entities([entity])


class WhiteNoiseSoundsSensor(SensorEntity):
    """Sensor exposing available white noise sounds."""

    _attr_name = "White Noise Sounds"
    _attr_icon = "mdi:music-note"
    _attr_has_entity_name = True

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_sounds"

    @property
    def native_value(self) -> int:
        """Return number of discovered sounds."""
        return len(self._data.sounds)

    @property
    def extra_state_attributes(self) -> dict:
        """Return sound metadata for cards and templates."""
        return {
            "sounds": [
                {
                    "id": sound.sound_id,
                    "name": sound.name,
                    "file_name": sound.file_name,
                }
                for sound in self._data.sounds.values()
            ],
            "media_folder": str(self._data.media_folder),
            "default_speaker": self._data.default_speaker,
            "default_duration": self._data.default_duration,
        }

    @property
    def _data(self):
        """Return runtime data."""
        return self.hass.data[DOMAIN][self._entry.entry_id]["data"]
