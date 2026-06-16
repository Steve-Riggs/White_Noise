"""Config flow for White Noise."""

from __future__ import annotations

from typing import Any

from homeassistant import config_entries
from homeassistant.helpers import selector

import voluptuous as vol

from .const import (
    CONF_COPY_BUNDLED_AUDIO,
    CONF_DEFAULT_DURATION,
    CONF_DEFAULT_SPEAKER,
    CONF_DEFAULT_VOLUME,
    CONF_MEDIA_FOLDER,
    DEFAULT_COPY_BUNDLED_AUDIO,
    DEFAULT_DURATION,
    DEFAULT_MEDIA_FOLDER,
    DEFAULT_VOLUME,
    DOMAIN,
)


class WhiteNoiseConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for White Noise."""

    VERSION = 1

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Handle the initial step."""
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()

        if user_input is not None:
            return self.async_create_entry(title="White Noise", data=user_input)

        return self.async_show_form(
            step_id="user",
            data_schema=_schema(),
        )

    @staticmethod
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> WhiteNoiseOptionsFlow:
        """Create the options flow."""
        return WhiteNoiseOptionsFlow(config_entry)


class WhiteNoiseOptionsFlow(config_entries.OptionsFlow):
    """Handle White Noise options."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        self.config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> config_entries.ConfigFlowResult:
        """Manage options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        options = {**self.config_entry.data, **self.config_entry.options}
        return self.async_show_form(
            step_id="init",
            data_schema=_schema(options),
        )


def _schema(defaults: dict[str, Any] | None = None) -> vol.Schema:
    """Return config/options schema."""
    defaults = defaults or {}

    return vol.Schema(
        {
            vol.Optional(
                CONF_DEFAULT_SPEAKER,
                default=defaults.get(CONF_DEFAULT_SPEAKER, ""),
            ): selector.EntitySelector(
                selector.EntitySelectorConfig(domain="media_player", multiple=False)
            ),
            vol.Optional(
                CONF_DEFAULT_DURATION,
                default=defaults.get(CONF_DEFAULT_DURATION, DEFAULT_DURATION),
            ): selector.NumberSelector(
                selector.NumberSelectorConfig(
                    min=0,
                    max=720,
                    step=1,
                    unit_of_measurement="minutes",
                    mode=selector.NumberSelectorMode.BOX,
                )
            ),
            vol.Optional(
                CONF_DEFAULT_VOLUME,
                default=defaults.get(CONF_DEFAULT_VOLUME, DEFAULT_VOLUME),
            ): selector.NumberSelector(
                selector.NumberSelectorConfig(
                    min=0,
                    max=100,
                    step=1,
                    unit_of_measurement="%",
                    mode=selector.NumberSelectorMode.SLIDER,
                )
            ),
            vol.Optional(
                CONF_MEDIA_FOLDER,
                default=defaults.get(CONF_MEDIA_FOLDER, DEFAULT_MEDIA_FOLDER),
            ): str,
            vol.Optional(
                CONF_COPY_BUNDLED_AUDIO,
                default=defaults.get(
                    CONF_COPY_BUNDLED_AUDIO, DEFAULT_COPY_BUNDLED_AUDIO
                ),
            ): bool,
        }
    )
