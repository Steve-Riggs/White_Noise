"""Config flow for White Noise."""
from __future__ import annotations

from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector

from .const import (
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
    NAME,
)


def _default_media_folder() -> str:
    """Return the default media folder."""
    return f"/media/{DEFAULT_MEDIA_SUBFOLDER}"


def _schema(defaults: dict[str, Any] | None = None) -> vol.Schema:
    """Return the config/options schema."""
    defaults = defaults or {}
    schema: dict[Any, Any] = {}

    if CONF_DEFAULT_SPEAKER in defaults and defaults[CONF_DEFAULT_SPEAKER]:
        speaker_key = vol.Optional(CONF_DEFAULT_SPEAKER, default=defaults[CONF_DEFAULT_SPEAKER])
    else:
        speaker_key = vol.Optional(CONF_DEFAULT_SPEAKER)

    schema[speaker_key] = selector.EntitySelector(
        selector.EntitySelectorConfig(domain="media_player")
    )
    schema[
        vol.Optional(
            CONF_DEFAULT_DURATION,
            default=defaults.get(CONF_DEFAULT_DURATION, DEFAULT_DURATION_MINUTES),
        )
    ] = selector.NumberSelector(
        selector.NumberSelectorConfig(
            min=1,
            max=720,
            step=1,
            unit_of_measurement="minutes",
            mode=selector.NumberSelectorMode.BOX,
        )
    )
    schema[
        vol.Optional(
            CONF_DEFAULT_VOLUME,
            default=defaults.get(CONF_DEFAULT_VOLUME, DEFAULT_VOLUME_PERCENT),
        )
    ] = selector.NumberSelector(
        selector.NumberSelectorConfig(
            min=0,
            max=100,
            step=1,
            unit_of_measurement="%",
            mode=selector.NumberSelectorMode.SLIDER,
        )
    )
    schema[
        vol.Optional(
            CONF_MEDIA_FOLDER,
            default=defaults.get(CONF_MEDIA_FOLDER, _default_media_folder()),
        )
    ] = str
    schema[
        vol.Optional(
            CONF_COPY_BUNDLED_AUDIO,
            default=defaults.get(CONF_COPY_BUNDLED_AUDIO, DEFAULT_COPY_BUNDLED_AUDIO),
        )
    ] = bool
    return vol.Schema(schema)


class WhiteNoiseConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for White Noise."""

    VERSION = 1

    async def async_step_user(self, user_input: dict[str, Any] | None = None):
        """Handle the initial step."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        if user_input is not None:
            # Store blank default speaker as no default speaker.
            if not user_input.get(CONF_DEFAULT_SPEAKER):
                user_input.pop(CONF_DEFAULT_SPEAKER, None)
            return self.async_create_entry(title=NAME, data=user_input)

        return self.async_show_form(
            step_id="user",
            data_schema=_schema(),
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: config_entries.ConfigEntry):
        """Return the options flow handler."""
        return WhiteNoiseOptionsFlow(config_entry)


class WhiteNoiseOptionsFlow(config_entries.OptionsFlow):
    """Handle options for White Noise."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(self, user_input: dict[str, Any] | None = None):
        """Manage the integration options."""
        if user_input is not None:
            if not user_input.get(CONF_DEFAULT_SPEAKER):
                user_input.pop(CONF_DEFAULT_SPEAKER, None)
            return self.async_create_entry(title="", data=user_input)

        defaults = {**self.config_entry.data, **self.config_entry.options}
        return self.async_show_form(
            step_id="init",
            data_schema=_schema(defaults),
        )
