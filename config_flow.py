"""Config flow for Aurora Sound to Light."""
from __future__ import annotations

import logging
import voluptuous as vol
from typing import Any

from homeassistant import config_entries
from homeassistant.const import CONF_NAME
from homeassistant.core import HomeAssistant, callback
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers import config_validation as cv

from .const import (
    DOMAIN,
    CONF_AUDIO_INPUT,
    CONF_BUFFER_SIZE,
    CONF_LATENCY_THRESHOLD,
    AUDIO_INPUT_MIC,
    AUDIO_INPUT_MEDIA_PLAYER,
    DEFAULT_BUFFER_SIZE,
    DEFAULT_LATENCY_THRESHOLD,
    CONF_MEDIA_PLAYER,
    CONF_LIGHTS,
    DEFAULT_NAME,
)

_LOGGER = logging.getLogger(__name__)


class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Aurora Sound to Light."""

    VERSION = 1

    def __init__(self) -> None:
        """Initialize the config flow."""
        self._data: dict[str, Any] = {}
        self._errors: dict[str, str] = {}

    async def _async_get_media_players(self) -> list[str]:
        """Get list of available media players."""
        return [
            entity_id
            for entity_id in self.hass.states.async_entity_ids("media_player")
        ]

    async def _async_get_lights(self) -> list[str]:
        """Get list of available lights."""
        return [
            entity_id
            for entity_id in self.hass.states.async_entity_ids("light")
        ]

    async def async_step_user(
        self,
        user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle a flow initialized by the user."""
        errors = {}

        if user_input is not None:
            try:
                self._data.update(user_input)
                media_players = await self._async_get_media_players()
                if not media_players:
                    errors["base"] = "no_media_players"
                else:
                    return await self.async_step_media_player()

            except Exception:
                _LOGGER.exception("Unexpected exception")
                errors["base"] = "unknown"

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema({
                vol.Required(CONF_NAME, default=DEFAULT_NAME): str,
            }),
            errors=errors,
        )

    async def async_step_media_player(
        self,
        user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle media player selection."""
        errors = {}

        if user_input is not None:
            try:
                self._data.update(user_input)
                return await self.async_step_lights()

            except Exception:
                _LOGGER.exception("Unexpected exception")
                errors["base"] = "unknown"

        media_players = await self._async_get_media_players()

        return self.async_show_form(
            step_id="media_player",
            data_schema=vol.Schema({
                vol.Required(CONF_MEDIA_PLAYER): vol.In(media_players),
            }),
            errors=errors,
        )

    async def async_step_lights(
        self,
        user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle light selection."""
        errors = {}

        if user_input is not None:
            try:
                self._data.update(user_input)
                return self.async_create_entry(
                    title=self._data[CONF_NAME],
                    data=self._data,
                )

            except Exception:
                _LOGGER.exception("Unexpected exception")
                errors["base"] = "unknown"

        lights = await self._async_get_lights()

        return self.async_show_form(
            step_id="lights",
            data_schema=vol.Schema({
                vol.Required(CONF_LIGHTS): cv.multi_select(lights),
            }),
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry
    ) -> config_entries.OptionsFlow:
        """Get the options flow for this handler."""
        return OptionsFlow(config_entry)


class OptionsFlow(config_entries.OptionsFlow):
    """Handle options flow for Aurora Sound to Light."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(
        self,
        user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Manage the options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Optional(
                    CONF_BUFFER_SIZE,
                    default=self.config_entry.options.get(
                        CONF_BUFFER_SIZE,
                        DEFAULT_BUFFER_SIZE
                    ),
                ): cv.positive_int,
                vol.Optional(
                    CONF_LATENCY_THRESHOLD,
                    default=self.config_entry.options.get(
                        CONF_LATENCY_THRESHOLD,
                        DEFAULT_LATENCY_THRESHOLD
                    ),
                ): cv.positive_int,
            }),
        )
