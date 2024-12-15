"""Bass pulse effect for Aurora Sound to Light."""
from typing import Any, Dict, List, Optional

from homeassistant.core import HomeAssistant
from homeassistant.components.light import (
    ATTR_BRIGHTNESS,
    ATTR_RGB_COLOR,
)

from .base_effect import BaseEffect
from ..const import DEFAULT_BRIGHTNESS


class BassPulseEffect(BaseEffect):
    """Effect that pulses lights in response to bass frequencies."""

    def __init__(
        self,
        hass: HomeAssistant,
        lights: List[str],
        params: Optional[Dict[str, Any]] = None
    ) -> None:
        """Initialize the bass pulse effect."""
        super().__init__(hass, lights, params)
        self._brightness = DEFAULT_BRIGHTNESS
        self._color = (255, 0, 0)  # Default to red

    async def update(
        self,
        audio_data: Optional[List[float]] = None,
        beat_detected: bool = False,
        bpm: int = 0
    ) -> None:
        """Update the effect with new audio data."""
        if not self.is_running or not audio_data:
            return

        # Get the bass frequencies (first few bins of FFT data)
        bass_energy = sum(audio_data[:4]) / len(audio_data[:4])
        
        # Scale the brightness based on bass energy
        brightness = int(bass_energy * 255)
        # Clamp between 10 and 255
        brightness = max(10, min(255, brightness))

        # Update each light
        for light in self.lights:
            await self.hass.services.async_call(
                "light",
                "turn_on",
                {
                    "entity_id": light,
                    ATTR_BRIGHTNESS: brightness,
                    ATTR_RGB_COLOR: self._color,
                },
                blocking=True,
            )
