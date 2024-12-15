"""Base effect class for Aurora Sound to Light."""
from abc import ABC, abstractmethod
import numpy as np
from typing import Any, Dict, List, Optional

from homeassistant.core import HomeAssistant
from homeassistant.components.light import (
    ATTR_BRIGHTNESS,
    ATTR_RGB_COLOR,
    ATTR_TRANSITION,
)

from ..const import (
    PARAM_SENSITIVITY,
    PARAM_SPEED,
    PARAM_COLOR,
    PARAM_BRIGHTNESS,
    PARAM_TRANSITION_TIME,
    DEFAULT_SENSITIVITY,
    DEFAULT_SPEED,
    DEFAULT_COLOR,
    DEFAULT_BRIGHTNESS,
    DEFAULT_TRANSITION_TIME,
)

class BaseEffect(ABC):
    """Base class for all light effects."""

    def __init__(
        self,
        hass: HomeAssistant,
        light_ids: List[str],
        params: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Initialize the effect."""
        self.hass = hass
        self.light_ids = light_ids
        self.params = params or {}
        
        # Set default parameters
        self.sensitivity = self.params.get(PARAM_SENSITIVITY, DEFAULT_SENSITIVITY)
        self.speed = self.params.get(PARAM_SPEED, DEFAULT_SPEED)
        self.color = self.params.get(PARAM_COLOR, DEFAULT_COLOR)
        self.brightness = self.params.get(PARAM_BRIGHTNESS, DEFAULT_BRIGHTNESS)
        self.transition_time = self.params.get(PARAM_TRANSITION_TIME, DEFAULT_TRANSITION_TIME)

    @abstractmethod
    async def process_audio(self, audio_data: np.ndarray) -> None:
        """Process audio data and update lights accordingly."""
        pass

    async def update_lights(
        self,
        light_id: str,
        rgb_color: Optional[List[int]] = None,
        brightness: Optional[int] = None,
        transition: Optional[float] = None,
    ) -> None:
        """Update light attributes."""
        service_data = {
            "entity_id": light_id,
        }

        if rgb_color is not None:
            service_data[ATTR_RGB_COLOR] = rgb_color

        if brightness is not None:
            service_data[ATTR_BRIGHTNESS] = brightness

        if transition is not None:
            service_data[ATTR_TRANSITION] = transition

        await self.hass.services.async_call(
            "light",
            "turn_on",
            service_data,
            blocking=True,
        )

    def update_parameters(self, params: Dict[str, Any]) -> None:
        """Update effect parameters."""
        if PARAM_SENSITIVITY in params:
            self.sensitivity = params[PARAM_SENSITIVITY]
        if PARAM_SPEED in params:
            self.speed = params[PARAM_SPEED]
        if PARAM_COLOR in params:
            self.color = params[PARAM_COLOR]
        if PARAM_BRIGHTNESS in params:
            self.brightness = params[PARAM_BRIGHTNESS]
        if PARAM_TRANSITION_TIME in params:
            self.transition_time = params[PARAM_TRANSITION_TIME] 