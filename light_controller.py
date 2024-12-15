"""Light controller module for Aurora Sound to Light."""
import asyncio
import logging
import math
from typing import Dict, List, Optional, Any
import colorsys

from homeassistant.core import HomeAssistant
from homeassistant.components.light import (
    ATTR_BRIGHTNESS,
    ATTR_RGB_COLOR,
    ATTR_TRANSITION,
    DOMAIN as LIGHT_DOMAIN,
)
from homeassistant.const import SERVICE_TURN_ON, SERVICE_TURN_OFF

from .const import (
    DEFAULT_TRANSITION_SPEED,
    EFFECT_BASS_PULSE,
    EFFECT_FREQ_SWEEP,
    EFFECT_COLOR_WAVE,
    EFFECT_STROBE_SYNC,
    EFFECT_RAINBOW_FLOW,
)

from .effect_creator import EffectManager

_LOGGER = logging.getLogger(__name__)

class LightController:
    """Class to handle light control and effects."""

    def __init__(
        self,
        hass: HomeAssistant,
        light_entities: List[str],
        transition_speed: int = DEFAULT_TRANSITION_SPEED,
    ) -> None:
        """Initialize the light controller."""
        self.hass = hass
        self.light_entities = light_entities
        self.transition_speed = transition_speed
        self.current_effect = None
        self.running = False
        self._task = None
        
        # Audio data
        self._current_band_energies = []
        self._bass_energy = 0.0
        self._mid_energy = 0.0
        self._high_energy = 0.0
        self._is_beat = False
        self._current_tempo = 0
        self._beat_intensity = 0.0
        
        # Effect parameters
        self.effect_params = {
            "brightness": 255,
            "color_palette": [(255, 0, 0), (0, 255, 0), (0, 0, 255)],
            "speed": 1.0,
            "phase": 0.0,
            "beat_multiplier": 1.0,
            "color_temp": 0.0,
        }
        
        # Custom effects
        self._effect_manager = EffectManager(hass)
        self._custom_effect_params = {}

    async def async_setup(self) -> None:
        """Set up the light controller."""
        await self._effect_manager.async_load()

    async def start(self, effect_name: str, effect_params: Optional[Dict[str, Any]] = None) -> None:
        """Start a light effect."""
        if self.running:
            await self.stop()
            
        self.running = True
        self.current_effect = effect_name
        
        if effect_params is not None:
            self._custom_effect_params = effect_params
            
        self._task = asyncio.create_task(self._run_effect())

    async def stop(self) -> None:
        """Stop the current effect."""
        self.running = False
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

    async def _run_effect(self) -> None:
        """Run the selected effect."""
        try:
            while self.running:
                if self.current_effect.startswith("custom_"):
                    # Handle custom effect
                    effect_id = self.current_effect[7:]  # Remove "custom_" prefix
                    light_states = self._effect_manager.execute_effect(
                        effect_id,
                        {
                            'band_energies': self._current_band_energies,
                            'is_beat': self._is_beat,
                            'tempo': self._current_tempo,
                            'bass_energy': self._bass_energy,
                            'mid_energy': self._mid_energy,
                            'high_energy': self._high_energy,
                            'beat_intensity': self._beat_intensity,
                        },
                        self._custom_effect_params,
                        len(self.light_entities)
                    )
                    
                    # Apply light states
                    for i, state in enumerate(light_states):
                        if i < len(self.light_entities):
                            await self._set_light_state(
                                self.light_entities[i],
                                brightness=state.get('brightness'),
                                rgb_color=state.get('rgb_color'),
                                transition=state.get('transition', self.transition_speed / 1000),
                            )
                else:
                    # Handle built-in effects
                    if self.current_effect == EFFECT_BASS_PULSE:
                        await self._bass_pulse_effect()
                    elif self.current_effect == EFFECT_FREQ_SWEEP:
                        await self._frequency_sweep_effect()
                    elif self.current_effect == EFFECT_COLOR_WAVE:
                        await self._color_wave_effect()
                    elif self.current_effect == EFFECT_STROBE_SYNC:
                        await self._strobe_sync_effect()
                    elif self.current_effect == EFFECT_RAINBOW_FLOW:
                        await self._rainbow_flow_effect()
                
                # Adjust sleep time based on tempo for smoother animations
                sleep_time = self.transition_speed / 1000
                if self._current_tempo > 0:
                    # Sync with beat timing
                    beat_interval = 60 / self._current_tempo
                    sleep_time = min(sleep_time, beat_interval / 4)
                
                await asyncio.sleep(sleep_time)
        except Exception as err:
            _LOGGER.error("Error in light effect: %s", err)
            self.running = False

    @property
    def available_effects(self) -> List[Dict[str, Any]]:
        """Get list of all available effects."""
        # Built-in effects
        effects = [
            {
                "id": EFFECT_BASS_PULSE,
                "name": "Bass Pulse",
                "type": "built_in",
            },
            {
                "id": EFFECT_FREQ_SWEEP,
                "name": "Frequency Sweep",
                "type": "built_in",
            },
            {
                "id": EFFECT_COLOR_WAVE,
                "name": "Color Wave",
                "type": "built_in",
            },
            {
                "id": EFFECT_STROBE_SYNC,
                "name": "Strobe Sync",
                "type": "built_in",
            },
            {
                "id": EFFECT_RAINBOW_FLOW,
                "name": "Rainbow Flow",
                "type": "built_in",
            },
        ]
        
        # Add custom effects
        custom_effects = self._effect_manager.list_effects()
        for effect in custom_effects:
            effects.append({
                "id": f"custom_{effect['id']}",
                "name": effect["name"],
                "type": "custom",
                "description": effect["description"],
                "parameters": effect["parameters"],
            })
        
        return effects

    async def add_custom_effect(
        self,
        name: str,
        parameters: Dict[str, Any],
        code: str,
        description: Optional[str] = None,
    ) -> Optional[str]:
        """Add a new custom effect."""
        return await self._effect_manager.async_add_effect(
            name, parameters, code, description
        )

    async def update_custom_effect(
        self,
        effect_id: str,
        parameters: Optional[Dict[str, Any]] = None,
        code: Optional[str] = None,
        description: Optional[str] = None,
    ) -> bool:
        """Update an existing custom effect."""
        return await self._effect_manager.async_update_effect(
            effect_id, parameters, code, description
        )

    async def delete_custom_effect(self, effect_id: str) -> bool:
        """Delete a custom effect."""
        return await self._effect_manager.async_delete_effect(effect_id)

    async def _set_light_state(
        self,
        entity_id: str,
        brightness: Optional[int] = None,
        rgb_color: Optional[tuple] = None,
        transition: Optional[float] = None,
    ) -> None:
        """Set the state of a light entity."""
        service_data = {"entity_id": entity_id}
        
        if brightness is not None:
            service_data[ATTR_BRIGHTNESS] = brightness
        if rgb_color is not None:
            service_data[ATTR_RGB_COLOR] = rgb_color
        if transition is not None:
            service_data[ATTR_TRANSITION] = transition
            
        await self.hass.services.async_call(
            LIGHT_DOMAIN,
            SERVICE_TURN_ON,
            service_data,
            blocking=True,
        )

    def _get_normalized_energy(self, band_start: int, band_end: int) -> float:
        """Get normalized energy for a range of frequency bands."""
        if not self._current_band_energies:
            return 0.0
        
        energy = sum(self._current_band_energies[band_start:band_end])
        return min(1.0, energy / (band_end - band_start))

    async def _bass_pulse_effect(self) -> None:
        """Create a pulsing effect based on bass frequencies and beats."""
        if not self.light_entities:
            return

        # Use beat detection for stronger pulses
        intensity = self._beat_intensity if self._is_beat else self._bass_energy
        brightness = int(intensity * 255)
        
        # Calculate color based on beat intensity and bass energy
        hue = (self._bass_energy * 0.15) % 1.0  # Keep in red-orange range
        saturation = 1.0 if self._is_beat else 0.8
        value = 1.0 if self._is_beat else 0.8
        rgb_color = tuple(int(x * 255) for x in colorsys.hsv_to_rgb(hue, saturation, value))
        
        # Use faster transitions on beats
        transition = self.transition_speed / 4000 if self._is_beat else self.transition_speed / 2000
        
        for entity_id in self.light_entities:
            await self._set_light_state(
                entity_id,
                brightness=brightness,
                rgb_color=rgb_color,
                transition=transition,
            )

    async def _frequency_sweep_effect(self) -> None:
        """Create a sweeping effect across frequency bands with beat enhancement."""
        if not self.light_entities or not self._current_band_energies:
            return

        num_lights = len(self.light_entities)
        bands_per_light = len(self._current_band_energies) // num_lights
        
        # Adjust phase speed based on tempo
        if self._current_tempo > 0:
            self.effect_params["phase"] += (self._current_tempo / 120) * 0.1
        else:
            self.effect_params["phase"] += 0.05
        self.effect_params["phase"] %= (2 * math.pi)
        
        for i, entity_id in enumerate(self.light_entities):
            # Calculate energy for this light's frequency range
            start_band = i * bands_per_light
            end_band = start_band + bands_per_light
            energy = self._get_normalized_energy(start_band, end_band)
            
            # Enhance energy on beats
            if self._is_beat:
                energy = min(1.0, energy * 1.5)
            
            # Create color gradient based on frequency and beat
            hue = (i / num_lights + self.effect_params["phase"]) % 1.0
            saturation = 1.0 if self._is_beat else 0.9
            value = energy
            rgb_color = tuple(int(x * 255) for x in colorsys.hsv_to_rgb(hue, saturation, value))
            
            await self._set_light_state(
                entity_id,
                brightness=int(energy * 255),
                rgb_color=rgb_color,
                transition=self.transition_speed / 2000,
            )

    async def _color_wave_effect(self) -> None:
        """Create a wave of colors across the light group synced to tempo."""
        if not self.light_entities:
            return

        num_lights = len(self.light_entities)
        
        # Adjust wave speed based on tempo
        if self._current_tempo > 0:
            phase_increment = (self._current_tempo / 120) * 0.1
        else:
            phase_increment = 0.05
            
        self.effect_params["phase"] = (self.effect_params["phase"] + phase_increment) % (2 * math.pi)
        
        for i, entity_id in enumerate(self.light_entities):
            # Calculate phase offset for this light
            phase_offset = (i / num_lights) * 2 * math.pi
            wave = (math.sin(self.effect_params["phase"] + phase_offset) + 1) / 2
            
            # Enhance colors on beats
            saturation = 1.0 if self._is_beat else 0.9
            value = 1.0 if self._is_beat else 0.9
            
            # Create smooth color transition
            hue = (wave + i / num_lights) % 1.0
            rgb_color = tuple(int(x * 255) for x in colorsys.hsv_to_rgb(hue, saturation, value))
            
            await self._set_light_state(
                entity_id,
                rgb_color=rgb_color,
                brightness=255 if self._is_beat else 220,
                transition=self.transition_speed / 2000,
            )

    async def _strobe_sync_effect(self) -> None:
        """Create a synchronized strobe effect based on beat detection."""
        if not self.light_entities:
            return

        # Only strobe on beats with high intensity
        if self._is_beat and self._beat_intensity > 0.7:
            # Flash on with beat color
            hue = (self._bass_energy * 0.15) % 1.0
            rgb_color = tuple(int(x * 255) for x in colorsys.hsv_to_rgb(hue, 1.0, 1.0))
            
            for entity_id in self.light_entities:
                await self._set_light_state(
                    entity_id,
                    brightness=255,
                    rgb_color=rgb_color,
                    transition=0.05,
                )
        else:
            # Flash off between beats
            for entity_id in self.light_entities:
                await self._set_light_state(
                    entity_id,
                    brightness=0,
                    transition=0.05,
                )

    async def _rainbow_flow_effect(self) -> None:
        """Create a flowing rainbow effect synced with the music tempo."""
        if not self.light_entities:
            return

        num_lights = len(self.light_entities)
        
        # Adjust flow speed based on tempo
        if self._current_tempo > 0:
            phase_increment = (self._current_tempo / 120) * 0.02
        else:
            phase_increment = 0.02
            
        self.effect_params["phase"] = (self.effect_params["phase"] + phase_increment) % 1.0
        
        for i, entity_id in enumerate(self.light_entities):
            # Calculate hue for this light
            hue = (self.effect_params["phase"] + (i / num_lights)) % 1.0
            
            # Enhance colors on beats
            saturation = 1.0 if self._is_beat else 0.9
            value = 1.0 if self._is_beat else 0.9
            
            rgb_color = tuple(int(x * 255) for x in colorsys.hsv_to_rgb(hue, saturation, value))
            
            await self._set_light_state(
                entity_id,
                rgb_color=rgb_color,
                brightness=255 if self._is_beat else 220,
                transition=self.transition_speed / 2000,
            )

    def process_audio_data(self, data: Dict) -> None:
        """Process audio data for light effects."""
        self._current_band_energies = data['band_energies']
        self._is_beat = data['is_beat']
        self._current_tempo = data['tempo']
        self._bass_energy = data['bass_energy']
        self._mid_energy = data['mid_energy']
        self._high_energy = data['high_energy']
        self._beat_intensity = data.get('beat_intensity', 1.0 if self._is_beat else 0.0)