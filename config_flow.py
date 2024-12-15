"""Config flow for Aurora Sound to Light integration."""
from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult
from homeassistant.components.media_player import DOMAIN as MEDIA_PLAYER_DOMAIN

from .const import (
    DOMAIN,
    CONF_AUDIO_INPUT,
    CONF_BUFFER_SIZE,
    CONF_LATENCY_THRESHOLD,
    DEFAULT_BUFFER_SIZE,
    DEFAULT_LATENCY_THRESHOLD,
    AUDIO_INPUT_MIC,
    AUDIO_INPUT_MEDIA,
)

_LOGGER = logging.getLogger(__name__)

# Map input types to display names
INPUT_TYPE_NAMES = {
    AUDIO_INPUT_MIC: "Microphone",
    AUDIO_INPUT_MEDIA: "Media Player",
}

STEP_USER_DATA_SCHEMA = vol.Schema(
    {
        vol.Required("audio_input_selection"): vol.In(
            {
                AUDIO_INPUT_MIC: INPUT_TYPE_NAMES[AUDIO_INPUT_MIC],
                AUDIO_INPUT_MEDIA: INPUT_TYPE_NAMES[AUDIO_INPUT_MEDIA],
            }
        ),
        vol.Optional(
            "buffer_size",
            default=DEFAULT_BUFFER_SIZE
        ): vol.All(
            vol.Coerce(int),
            vol.Range(min=50, max=200)
        ),
        vol.Optional(
            "latency_threshold",
            default=DEFAULT_LATENCY_THRESHOLD
        ): vol.All(
            vol.Coerce(int),
            vol.Range(min=10, max=100)
        ),
    }
)


class AuroraConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Aurora Sound to Light."""

    VERSION = 1

    def __init__(self) -> None:
        """Initialize the config flow."""
        self._audio_input: str | None = None
        self._media_player: str | None = None
        self._buffer_size: int = DEFAULT_BUFFER_SIZE
        self._latency_threshold: int = DEFAULT_LATENCY_THRESHOLD

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle the initial step."""
        errors = {}

        if user_input is not None:
            try:
                # Check if already configured
                await self.async_set_unique_id(DOMAIN)
                self._abort_if_unique_instance()

                self._audio_input = user_input["audio_input_selection"]
                self._buffer_size = user_input.get(
                    "buffer_size",
                    DEFAULT_BUFFER_SIZE
                )
                self._latency_threshold = user_input.get(
                    "latency_threshold",
                    DEFAULT_LATENCY_THRESHOLD
                )

                if self._audio_input == AUDIO_INPUT_MEDIA:
                    return await self.async_step_media_player()

                return self.async_create_entry(
                    title="Aurora Sound to Light",
                    data={
                        CONF_AUDIO_INPUT: self._audio_input,
                        CONF_BUFFER_SIZE: self._buffer_size,
                        CONF_LATENCY_THRESHOLD: self._latency_threshold,
                    },
                )

            except Exception as err:
                _LOGGER.exception("Unexpected error: %s", err)
                errors["base"] = "unknown"

        return self.async_show_form(
            step_id="user",
            data_schema=STEP_USER_DATA_SCHEMA,
            errors=errors,
        )

    async def async_step_media_player(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle media player selection step."""
        errors = {}

        if user_input is not None:
            try:
                self._media_player = user_input["media_player"]
                return self.async_create_entry(
                    title="Aurora Sound to Light",
                    data={
                        CONF_AUDIO_INPUT: self._audio_input,
                        CONF_BUFFER_SIZE: self._buffer_size,
                        CONF_LATENCY_THRESHOLD: self._latency_threshold,
                        "media_player_entity_id": self._media_player,
                    },
                )
            except Exception as err:
                _LOGGER.exception("Unexpected error: %s", err)
                errors["base"] = "unknown"

        # Get list of media players
        media_players = []
        for entity_id in self.hass.states.async_entity_ids(
            MEDIA_PLAYER_DOMAIN
        ):
            state = self.hass.states.get(entity_id)
            if state:
                media_players.append(entity_id)

        if not media_players:
            return self.async_abort(reason="no_media_players")

        schema = vol.Schema({
            vol.Required("media_player"): vol.In(
                {mp: mp for mp in media_players}
            ),
        })

        return self.async_show_form(
            step_id="media_player",
            data_schema=schema,
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> config_entries.OptionsFlow:
        """Create the options flow."""
        return AuroraOptionsFlow(config_entry)


class AuroraOptionsFlow(config_entries.OptionsFlow):
    """Handle options flow for Aurora Sound to Light."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle options flow."""
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        options_schema = vol.Schema(
            {
                vol.Optional(
                    "buffer_size",
                    default=self.config_entry.options.get(
                        "buffer_size", DEFAULT_BUFFER_SIZE
                    ),
                ): vol.All(
                    vol.Coerce(int),
                    vol.Range(min=50, max=200)
                ),
                vol.Optional(
                    "latency_threshold",
                    default=self.config_entry.options.get(
                        "latency_threshold", DEFAULT_LATENCY_THRESHOLD
                    ),
                ): vol.All(
                    vol.Coerce(int),
                    vol.Range(min=10, max=100)
                ),
            }
        )

        return self.async_show_form(
            step_id="init",
            data_schema=options_schema,
        ) 