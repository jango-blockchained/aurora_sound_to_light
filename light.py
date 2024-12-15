"""Light platform for Aurora Sound to Light."""
import logging
from typing import Any

from homeassistant.components.light import (
    ATTR_BRIGHTNESS,
    ATTR_RGB_COLOR,
    ColorMode,
    LightEntity,
    LightEntityFeature,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Aurora Sound to Light platform."""
    _LOGGER.info("Setting up Aurora Sound to Light light platform")

    # Get the light controller from our domain data
    data = hass.data[DOMAIN][config_entry.entry_id]
    light_controller = data["light_controller"]

    # Create and add entities
    entities = []
    for light_id in light_controller.get_lights():
        entities.append(AuroraLight(hass, light_id, light_controller))

    async_add_entities(entities)


class AuroraLight(LightEntity):
    """Representation of an Aurora Sound to Light light."""

    _attr_has_entity_name = True
    _attr_should_poll = False

    def __init__(self, hass: HomeAssistant, light_id: str, controller: Any) -> None:
        """Initialize the light."""
        self.hass = hass
        self._light_id = light_id
        self._controller = controller
        self._attr_unique_id = f"{DOMAIN}_{light_id}"
        self._attr_name = f"Aurora {light_id}"
        self._attr_supported_color_modes = {ColorMode.RGB}
        self._attr_color_mode = ColorMode.RGB
        self._attr_supported_features = (
            LightEntityFeature.EFFECT | LightEntityFeature.TRANSITION
        )
        self._attr_brightness = 255
        self._attr_rgb_color = (255, 255, 255)
        self._attr_is_on = False

    async def async_turn_on(self, **kwargs: Any) -> None:
        """Turn the light on."""
        self._attr_is_on = True

        if ATTR_BRIGHTNESS in kwargs:
            self._attr_brightness = kwargs[ATTR_BRIGHTNESS]

        if ATTR_RGB_COLOR in kwargs:
            self._attr_rgb_color = kwargs[ATTR_RGB_COLOR]

        # Update the light through the controller
        await self._controller.update_light(
            self._light_id,
            is_on=True,
            brightness=self._attr_brightness,
            rgb_color=self._attr_rgb_color,
        )

    async def async_turn_off(self, **kwargs: Any) -> None:
        """Turn the light off."""
        self._attr_is_on = False
        await self._controller.update_light(self._light_id, is_on=False)
