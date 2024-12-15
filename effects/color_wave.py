"""Color wave effect for Aurora Sound to Light."""
import math
from typing import Any, Dict, List, Optional, Tuple

from homeassistant.core import HomeAssistant
from homeassistant.components.light import (
    ATTR_BRIGHTNESS,
    ATTR_RGB_COLOR,
)

from .base_effect import BaseEffect


class ColorWaveEffect(BaseEffect):
    """Effect that creates a wave of colors across lights."""

    def __init__(
        self,
        hass: HomeAssistant,
        lights: List[str],
        params: Optional[Dict[str, Any]] = None
    ) -> None:
        """Initialize the color wave effect."""
        super().__init__(hass, lights, params)
        self._phase = 0.0
        self._speed = 0.1  # Radians per update
        self._brightness = 255

    async def update(
        self,
        audio_data: Optional[List[float]] = None,
        beat_detected: bool = False,
        bpm: int = 0
    ) -> None:
        """Update the effect with new audio data."""
        if not self.is_running:
            return

        # Update phase
        self._phase += self._speed
        if self._phase >= 2 * math.pi:
            self._phase -= 2 * math.pi

        # Calculate colors for each light
        for i, light in enumerate(self.lights):
            # Calculate color based on position and phase
            phase_offset = (i / len(self.lights)) * 2 * math.pi
            hue = (self._phase + phase_offset) % (2 * math.pi)

            # Convert HSV to RGB
            rgb = self._hsv_to_rgb(hue / (2 * math.pi), 1.0, 1.0)

            # Update light
            await self.hass.services.async_call(
                "light",
                "turn_on",
                {
                    "entity_id": light,
                    ATTR_BRIGHTNESS: self._brightness,
                    ATTR_RGB_COLOR: rgb,
                },
                blocking=True,
            )

    def _hsv_to_rgb(
        self,
        h: float,
        s: float,
        v: float
    ) -> Tuple[int, int, int]:
        """Convert HSV color values to RGB."""
        if s == 0.0:
            return (int(v * 255),) * 3

        i = int(h * 6.0)
        f = (h * 6.0) - i
        p = v * (1.0 - s)
        q = v * (1.0 - s * f)
        t = v * (1.0 - s * (1.0 - f))
        i = i % 6

        if i == 0:
            rgb = (v, t, p)
        elif i == 1:
            rgb = (q, v, p)
        elif i == 2:
            rgb = (p, v, t)
        elif i == 3:
            rgb = (p, q, v)
        elif i == 4:
            rgb = (t, p, v)
        else:
            rgb = (v, p, q)

        return tuple(int(x * 255) for x in rgb)
