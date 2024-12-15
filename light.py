"""Light platform for Aurora Sound to Light integration."""
from __future__ import annotations

import logging
from typing import Any, Optional

import voluptuous as vol

from homeassistant.components.light import (
    ATTR_BRIGHTNESS,
    ATTR_EFFECT,
    ATTR_RGB_COLOR,
    PLATFORM_SCHEMA,
    ColorMode,
    LightEntity,
    LightEntityFeature,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.typing import ConfigType, DiscoveryInfoType

from .const import (
    DOMAIN,
    EFFECT_BASS_PULSE,
    EFFECT_FREQ_SWEEP,
    EFFECT_COLOR_WAVE,
    EFFECT_STROBE_SYNC,
    EFFECT_RAINBOW_FLOW,
    EFFECT_CUSTOM,
)
from .light_controller import LightController

_LOGGER = logging.getLogger(__name__)

EFFECT_LIST = [
    EFFECT_BASS_PULSE,
    EFFECT_FREQ_SWEEP,
    EFFECT_COLOR_WAVE,
    EFFECT_STROBE_SYNC,
    EFFECT_RAINBOW_FLOW,
    EFFECT_CUSTOM,
]


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Aurora Sound to Light platform."""
    controller = LightController(hass, [], 100)  # Default values for now
    async_add_entities([AuroraSoundLight(controller)], True)


class AuroraSoundLight(LightEntity):
    """Representation of an Aurora Sound to Light entity."""

    _attr_has_entity_name = True
    _attr_name = "Aurora Sound Light"
    _attr_should_poll = False
    _attr_supported_color_modes = {ColorMode.RGB}
    _attr_supported_features = (
        LightEntityFeature.EFFECT | LightEntityFeature.TRANSITION
    )
    _attr_effect_list = EFFECT_LIST

    def __init__(self, controller: LightController) -> None:
        """Initialize the light."""
        self._attr_unique_id = "aurora_sound_light_main"
        self._controller = controller
        self._attr_is_on = False
        self._attr_brightness = 255
        self._attr_rgb_color = (255, 255, 255)
        self._attr_effect = None
        self._attr_color_mode = ColorMode.RGB

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Turn on the light."""
        self._attr_is_on = True

        if ATTR_BRIGHTNESS in kwargs:
            self._attr_brightness = kwargs[ATTR_BRIGHTNESS]

        if ATTR_RGB_COLOR in kwargs:
            self._attr_rgb_color = kwargs[ATTR_RGB_COLOR]

        if ATTR_EFFECT in kwargs:
            self._attr_effect = kwargs[ATTR_EFFECT]
            await self._controller.start(self._attr_effect)

        self.async_write_ha_state()

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Turn off the light."""
        self._attr_is_on = False
        await self._controller.stop()
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        """Run when entity about to be added to hass."""
        await super().async_added_to_hass()
        # Add any initialization here 