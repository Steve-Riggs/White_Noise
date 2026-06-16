"""Sensor platform for White Noise."""
from __future__ import annotations

from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, NAME
from . import WhiteNoiseManager


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the White Noise sounds sensor."""
    manager: WhiteNoiseManager = hass.data[DOMAIN]["managers"][entry.entry_id]
    entity = WhiteNoiseSoundsSensor(manager, entry)
    manager.entity = entity
    async_add_entities([entity])


class WhiteNoiseSoundsSensor(SensorEntity):
    """Sensor exposing available white noise sounds."""

    _attr_has_entity_name = True
    _attr_translation_key = "sounds"
    _attr_icon = "mdi:speaker-wireless"

    def __init__(self, manager: WhiteNoiseManager, entry: ConfigEntry) -> None:
        """Initialize the sensor."""
        self.manager = manager
        self.entry = entry
        self._attr_unique_id = f"{entry.entry_id}_sounds"
        self._attr_name = f"{NAME} Sounds"

    @property
    def native_value(self) -> int:
        """Return the number of available sounds."""
        return len(self.manager.sounds)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return available sounds and settings as attributes."""
        return self.manager.extra_state_attributes
