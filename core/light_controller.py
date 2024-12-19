"""Light controller for Aurora Sound to Light."""
from typing import Any, Dict, List, Optional, Tuple
import logging

from homeassistant.components.light import (
    ATTR_BRIGHTNESS,
    ATTR_RGB_COLOR,
    ATTR_TRANSITION,
)
from homeassistant.core import HomeAssistant

from ..effects import EffectEngine

_LOGGER = logging.getLogger(__name__)


class LightController:
    """Controller for managing lights in Aurora Sound to Light."""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the light controller."""
        self.hass = hass
        self._lights: Dict[str, Dict[str, Any]] = {}  # Store light states
        self._effect_engine: Optional[EffectEngine] = None
        self._current_effect = None

    def get_lights(self) -> List[str]:
        """Get list of available lights."""
        return ["test_light"]

    async def update_light(
        self,
        light_id: str,
        is_on: bool = True,
        brightness: Optional[int] = None,
        rgb_color: Optional[Tuple[int, int, int]] = None,
        transition: Optional[float] = None,
    ) -> None:
        """Update a light's state."""
        try:
            service_data = {
                "entity_id": f"light.{light_id}",
            }

            if brightness is not None:
                service_data[ATTR_BRIGHTNESS] = brightness

            if rgb_color is not None:
                service_data[ATTR_RGB_COLOR] = rgb_color

            if transition is not None:
                service_data[ATTR_TRANSITION] = transition

            # Store the state
            self._lights[light_id] = {
                "is_on": is_on,
                "brightness": brightness,
                "rgb_color": rgb_color,
            }

            # Call the appropriate service
            service = "turn_on" if is_on else "turn_off"
            await self.hass.services.async_call(
                "light",
                service,
                service_data,
                blocking=True,
            )

        except Exception as err:
            _LOGGER.error("Failed to update light %s: %s", light_id, err)

    async def start_effect(
        self,
        effect_name: str,
        lights: List[str],
        params: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Start a light effect."""
        try:
            if self._effect_engine is None:
                from ..effects import get_effect_engine
                self._effect_engine = await get_effect_engine(self.hass)

            if self._current_effect:
                await self.stop_effect()

            self._current_effect = await self._effect_engine.create_effect(
                effect_name,
                lights,
                params,
            )
            await self._current_effect.start()

        except Exception as err:
            _LOGGER.error(
                "Failed to start effect %s: %s",
                effect_name,
                err
            )

    async def stop_effect(self) -> None:
        """Stop the current effect."""
        if self._current_effect:
            try:
                await self._current_effect.stop()
                self._current_effect = None
            except Exception as err:
                _LOGGER.error("Failed to stop effect: %s", err)

    async def get_light_state(self, light_id: str) -> Optional[Dict[str, Any]]:
        """Get the current state of a light."""
        return self._lights.get(light_id) 