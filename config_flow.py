"""Config flow for Aurora Sound to Light integration."""
from __future__ import annotations

import logging
import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import HomeAssistant, callback
from homeassistant.data_entry_flow import FlowResult
from homeassistant.helpers import config_validation as cv
from homeassistant.components.media_player import DOMAIN as MEDIA_PLAYER_DOMAIN

from .const import (
    DOMAIN,
    CONF_AUDIO_INPUT,
    CONF_BUFFER_SIZE,
    CONF_LATENCY_THRESHOLD,
    AUDIO_INPUT_MIC,
    AUDIO_INPUT_MEDIA_PLAYER,
    DEFAULT_BUFFER_SIZE,
    DEFAULT_LATENCY_THRESHOLD,
)

_LOGGER = logging.getLogger(__name__)

class AuroraConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Aurora Sound to Light."""

    VERSION = 1

    def __init__(self) -> None:
        """Initialize the config flow."""
        self._errors = {}

    async def async_step_user(
        self, user_input: dict[str, any] | None = None
    ) -> FlowResult:
        """Handle the initial step."""
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is None:
            return self.async_show_form(
                step_id="user",
                data_schema=vol.Schema(
                    {
                        vol.Required(CONF_AUDIO_INPUT): vol.In(
                            [AUDIO_INPUT_MIC, AUDIO_INPUT_MEDIA_PLAYER]
                        ),
                        vol.Optional(
                            CONF_BUFFER_SIZE, default=DEFAULT_BUFFER_SIZE
                        ): cv.positive_int,
                        vol.Optional(
                            CONF_LATENCY_THRESHOLD, default=DEFAULT_LATENCY_THRESHOLD
                        ): cv.positive_int,
                    }
                ),
            )

        try:
            if user_input[CONF_AUDIO_INPUT] == AUDIO_INPUT_MEDIA_PLAYER:
                return await self.async_step_media_player(user_input)
            return self.async_create_entry(
                title="Aurora Sound to Light",
                data=user_input,
            )
        except Exception:  # pylint: disable=broad-except
            _LOGGER.exception("Unexpected exception")
            self._errors["base"] = "unknown"

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_AUDIO_INPUT): vol.In(
                        [AUDIO_INPUT_MIC, AUDIO_INPUT_MEDIA_PLAYER]
                    ),
                    vol.Optional(
                        CONF_BUFFER_SIZE, default=DEFAULT_BUFFER_SIZE
                    ): cv.positive_int,
                    vol.Optional(
                        CONF_LATENCY_THRESHOLD, default=DEFAULT_LATENCY_THRESHOLD
                    ): cv.positive_int,
                }
            ),
            errors=self._errors,
        )

    async def async_step_media_player(
        self, user_input: dict[str, any] | None = None
    ) -> FlowResult:
        """Handle media player selection."""
        if not self.hass.states.async_all(MEDIA_PLAYER_DOMAIN):
            return self.async_abort(reason="no_media_players")

        if user_input is None:
            return self.async_show_form(
                step_id="media_player",
                data_schema=vol.Schema(
                    {
                        vol.Required("media_player"): str,
                    }
                ),
            )

        try:
            media_player = user_input["media_player"]
            if not self.hass.states.get(media_player):
                return self.async_abort(reason="invalid_media_player")

            user_input["media_player"] = media_player
            return self.async_create_entry(
                title="Aurora Sound to Light",
                data=user_input,
            )
        except Exception as ex:  # pylint: disable=broad-except
            _LOGGER.exception("Unexpected exception")
            self._errors["base"] = str(ex)

        return self.async_show_form(
            step_id="media_player",
            data_schema=vol.Schema(
                {
                    vol.Required("media_player"): str,
                }
            ),
            errors=self._errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> AuroraOptionsFlow:
        """Get the options flow for this handler."""
        return AuroraOptionsFlow(config_entry)


class AuroraOptionsFlow(config_entries.OptionsFlow):
    """Handle options."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, any] | None = None
    ) -> FlowResult:
        """Manage the options."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        CONF_BUFFER_SIZE,
                        default=self.config_entry.options.get(
                            CONF_BUFFER_SIZE, DEFAULT_BUFFER_SIZE
                        ),
                    ): cv.positive_int,
                    vol.Optional(
                        CONF_LATENCY_THRESHOLD,
                        default=self.config_entry.options.get(
                            CONF_LATENCY_THRESHOLD, DEFAULT_LATENCY_THRESHOLD
                        ),
                    ): cv.positive_int,
                }
            ),
        ) 