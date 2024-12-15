"""Bass pulse effect for Aurora Sound to Light."""
import numpy as np
from typing import Any, Dict, Optional

from homeassistant.core import HomeAssistant

from .base_effect import BaseEffect
from ..const import (
    PARAM_FREQUENCY_RANGE,
    DEFAULT_FREQUENCY_RANGE,
)

class BassPulseEffect(BaseEffect):
    """Effect that pulses lights based on bass frequencies."""

    def __init__(
        self,
        hass: HomeAssistant,
        light_ids: list[str],
        params: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Initialize the bass pulse effect."""
        super().__init__(hass, light_ids, params)
        self.freq_range = self.params.get(PARAM_FREQUENCY_RANGE, DEFAULT_FREQUENCY_RANGE)
        self.last_brightness = DEFAULT_BRIGHTNESS

    async def process_audio(self, audio_data: np.ndarray) -> None:
        """Process audio data and create bass pulse effect."""
        # Perform FFT on the audio data
        fft_data = np.abs(np.fft.fft(audio_data))
        freqs = np.fft.fftfreq(len(audio_data), 1/44100)

        # Get the bass frequency range (typically 20-150Hz)
        bass_mask = (freqs >= 20) & (freqs <= 150)
        bass_amplitude = np.mean(fft_data[bass_mask])

        # Normalize and apply sensitivity
        normalized_amplitude = min(1.0, bass_amplitude * self.sensitivity)

        # Calculate new brightness based on bass amplitude
        new_brightness = int(normalized_amplitude * self.brightness)

        # Apply smoothing
        smoothed_brightness = int(
            0.7 * self.last_brightness + 0.3 * new_brightness
        )
        self.last_brightness = smoothed_brightness

        # Update all lights in the group
        for light_id in self.light_ids:
            await self.update_lights(
                light_id=light_id,
                rgb_color=self.color,
                brightness=smoothed_brightness,
                transition=self.transition_time,
            ) 