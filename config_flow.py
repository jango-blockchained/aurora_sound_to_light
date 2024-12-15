"""Config flow for Aurora Sound to Light integration."""
from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.core import HomeAssistant, callback
from homeassistant.data_entry_flow import FlowResult
from homeassistant.exceptions import HomeAssistantError
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

# AGC Configuration defaults
DEFAULT_AGC_TARGET = 0.2
DEFAULT_AGC_ATTACK = 0.001
DEFAULT_AGC_DECAY = 0.0005
DEFAULT_AGC_NOISE_GATE = 0.001

class ConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for Aurora Sound to Light."""

    VERSION = 1
    
    def __init__(self) -> None:
        """Initialize the config flow."""
        self._audio_input: str | None = None
        self._media_player: str | None = None
        self._buffer_size: int = DEFAULT_BUFFER_SIZE
        self._latency_threshold: int = DEFAULT_LATENCY_THRESHOLD
        self._agc_enabled: bool = True
        self._agc_target: float = DEFAULT_AGC_TARGET
        self._agc_attack: float = DEFAULT_AGC_ATTACK
        self._agc_decay: float = DEFAULT_AGC_DECAY
        self._agc_noise_gate: float = DEFAULT_AGC_NOISE_GATE

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle the initial step."""
        errors = {}

        if user_input is not None:
            self._audio_input = user_input[CONF_AUDIO_INPUT]
            self._buffer_size = user_input.get(CONF_BUFFER_SIZE, DEFAULT_BUFFER_SIZE)
            self._latency_threshold = user_input.get(
                CONF_LATENCY_THRESHOLD, DEFAULT_LATENCY_THRESHOLD
            )

            if self._audio_input == AUDIO_INPUT_MEDIA:
                return await self.async_step_media_player()
            else:
                return await self.async_step_agc()

        return self.async_show_form(
            step_id="user",
            data_schema=vol.Schema(
                {
                    vol.Required(CONF_AUDIO_INPUT): vol.In(
                        [AUDIO_INPUT_MIC, AUDIO_INPUT_MEDIA]
                    ),
                    vol.Optional(
                        CONF_BUFFER_SIZE, default=DEFAULT_BUFFER_SIZE
                    ): vol.All(vol.Coerce(int), vol.Range(min=50, max=200)),
                    vol.Optional(
                        CONF_LATENCY_THRESHOLD, default=DEFAULT_LATENCY_THRESHOLD
                    ): vol.All(vol.Coerce(int), vol.Range(min=10, max=100)),
                }
            ),
            errors=errors,
        )

    async def async_step_media_player(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle media player selection step."""
        errors = {}

        if user_input is not None:
            self._media_player = user_input["media_player"]
            return await self.async_step_agc()

        # Get list of media players
        media_players = []
        for entity_id in self.hass.states.async_entity_ids(MEDIA_PLAYER_DOMAIN):
            state = self.hass.states.get(entity_id)
            if state:
                media_players.append(entity_id)

        if not media_players:
            errors["base"] = "no_media_players"
            return self.async_abort(reason="no_media_players")

        return self.async_show_form(
            step_id="media_player",
            data_schema=vol.Schema(
                {
                    vol.Required("media_player"): vol.In(media_players),
                }
            ),
            errors=errors,
        )

    async def async_step_agc(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle AGC configuration step."""
        errors = {}

        if user_input is not None:
            self._agc_enabled = user_input.get("agc_enabled", True)
            self._agc_target = user_input.get("agc_target", DEFAULT_AGC_TARGET)
            self._agc_attack = user_input.get("agc_attack", DEFAULT_AGC_ATTACK)
            self._agc_decay = user_input.get("agc_decay", DEFAULT_AGC_DECAY)
            self._agc_noise_gate = user_input.get("agc_noise_gate", DEFAULT_AGC_NOISE_GATE)

            # Create the final configuration
            data = {
                CONF_AUDIO_INPUT: self._audio_input,
                CONF_BUFFER_SIZE: self._buffer_size,
                CONF_LATENCY_THRESHOLD: self._latency_threshold,
                "agc_enabled": self._agc_enabled,
                "agc_target": self._agc_target,
                "agc_attack": self._agc_attack,
                "agc_decay": self._agc_decay,
                "agc_noise_gate": self._agc_noise_gate,
            }
            
            if self._media_player:
                data["media_player_entity_id"] = self._media_player

            return self.async_create_entry(
                title="Aurora Sound to Light",
                data=data,
            )

        return self.async_show_form(
            step_id="agc",
            data_schema=vol.Schema(
                {
                    vol.Required("agc_enabled", default=True): bool,
                    vol.Optional(
                        "agc_target", default=DEFAULT_AGC_TARGET
                    ): vol.All(vol.Coerce(float), vol.Range(min=0.01, max=0.5)),
                    vol.Optional(
                        "agc_attack", default=DEFAULT_AGC_ATTACK
                    ): vol.All(vol.Coerce(float), vol.Range(min=0.0001, max=0.01)),
                    vol.Optional(
                        "agc_decay", default=DEFAULT_AGC_DECAY
                    ): vol.All(vol.Coerce(float), vol.Range(min=0.0001, max=0.01)),
                    vol.Optional(
                        "agc_noise_gate", default=DEFAULT_AGC_NOISE_GATE
                    ): vol.All(vol.Coerce(float), vol.Range(min=0.0001, max=0.1)),
                }
            ),
            errors=errors,
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,
    ) -> config_entries.OptionsFlow:
        """Create the options flow."""
        return OptionsFlowHandler(config_entry)


class OptionsFlowHandler(config_entries.OptionsFlow):
    """Handle options flow for the integration."""

    def __init__(self, config_entry: config_entries.ConfigEntry) -> None:
        """Initialize options flow."""
        self.config_entry = config_entry

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> FlowResult:
        """Handle options flow."""
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
                    ): vol.All(vol.Coerce(int), vol.Range(min=50, max=200)),
                    vol.Optional(
                        CONF_LATENCY_THRESHOLD,
                        default=self.config_entry.options.get(
                            CONF_LATENCY_THRESHOLD, DEFAULT_LATENCY_THRESHOLD
                        ),
                    ): vol.All(vol.Coerce(int), vol.Range(min=10, max=100)),
                    vol.Optional(
                        "agc_enabled",
                        default=self.config_entry.options.get("agc_enabled", True),
                    ): bool,
                    vol.Optional(
                        "agc_target",
                        default=self.config_entry.options.get(
                            "agc_target", DEFAULT_AGC_TARGET
                        ),
                    ): vol.All(vol.Coerce(float), vol.Range(min=0.01, max=0.5)),
                    vol.Optional(
                        "agc_attack",
                        default=self.config_entry.options.get(
                            "agc_attack", DEFAULT_AGC_ATTACK
                        ),
                    ): vol.All(vol.Coerce(float), vol.Range(min=0.0001, max=0.01)),
                    vol.Optional(
                        "agc_decay",
                        default=self.config_entry.options.get(
                            "agc_decay", DEFAULT_AGC_DECAY
                        ),
                    ): vol.All(vol.Coerce(float), vol.Range(min=0.0001, max=0.01)),
                    vol.Optional(
                        "agc_noise_gate",
                        default=self.config_entry.options.get(
                            "agc_noise_gate", DEFAULT_AGC_NOISE_GATE
                        ),
                    ): vol.All(vol.Coerce(float), vol.Range(min=0.0001, max=0.1)),
                }
            ),
        ) 