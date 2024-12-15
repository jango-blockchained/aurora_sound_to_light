"""Color Wave effect for Aurora Sound to Light."""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import numpy as np

from homeassistant.core import HomeAssistant

from .base_effect import BaseEffect
from ..const import (
    PARAM_COLOR,
    PARAM_SPEED,
    PARAM_BRIGHTNESS,
    PARAM_TRANSITION_TIME,
    DEFAULT_COLOR,
    DEFAULT_SPEED,
    DEFAULT_BRIGHTNESS,
    DEFAULT_TRANSITION_TIME,
)

_LOGGER = logging.getLogger(__name__)

class ColorWaveEffect(BaseEffect):
    """Color wave effect that creates a flowing wave of colors based on audio."""

    def __init__(
        self,
        hass: HomeAssistant,
        light_ids: List[str],
        params: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Initialize the color wave effect."""
        super().__init__(hass, light_ids, params)
        self.name = "Color Wave"
        self.description = "Creates a flowing wave of colors based on audio intensity"
        self.phase = 0.0

    async def process_audio(self, audio_data: np.ndarray) -> None:
        """Process audio data and update lights."""
        # Calculate the average intensity across frequency bands
        intensity = np.mean(np.abs(audio_data))
        
        # Update the phase based on intensity and speed
        self.phase += self.speed * intensity
        if self.phase > 2 * np.pi:
            self.phase -= 2 * np.pi

        # Calculate color components with smooth transitions
        r = int((np.sin(self.phase) + 1) * 127.5)
        g = int((np.sin(self.phase + 2 * np.pi / 3) + 1) * 127.5)
        b = int((np.sin(self.phase + 4 * np.pi / 3) + 1) * 127.5)

        # Scale brightness based on audio intensity
        brightness = min(255, int(self.brightness * (0.5 + 0.5 * intensity)))

        # Update all lights in the group
        for light_id in self.light_ids:
            await self.update_lights(
                light_id=light_id,
                rgb_color=[r, g, b],
                brightness=brightness,
                transition=self.transition_time,
            )

    def get_config(self) -> dict[str, Any]:
        """Get the current configuration of the effect."""
        return {
            "color": self.color,
            "speed": self.speed,
            "brightness": self.brightness,
            "transition_time": self.transition_time,
        }

    def update_config(self, config: dict[str, Any]) -> None:
        """Update the effect configuration."""
        if "color" in config:
            self.color = config["color"]
        if "speed" in config:
            self.speed = config["speed"]
        if "brightness" in config:
            self.brightness = config["brightness"]
        if "transition_time" in config:
            self.transition_time = config["transition_time"] 