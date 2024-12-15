"""Sensor platform for Aurora Sound to Light integration."""
from __future__ import annotations

import logging
from typing import Any, Optional

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.typing import StateType

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Aurora Sound to Light sensors."""
    audio_processor = hass.data[DOMAIN][config_entry.entry_id]["audio_processor"]
    
    entities = [
        AudioEnergySensor(audio_processor, "bass", "Bass Energy"),
        AudioEnergySensor(audio_processor, "mid", "Mid Energy"),
        AudioEnergySensor(audio_processor, "high", "High Energy"),
        AudioLatencySensor(audio_processor),
        AGCGainSensor(audio_processor),
        AGCLevelSensor(audio_processor, "rms", "RMS Level"),
        AGCLevelSensor(audio_processor, "peak", "Peak Level"),
    ]
    
    async_add_entities(entities, True)


class AudioEnergySensor(SensorEntity):
    """Sensor for audio energy levels."""

    _attr_native_unit_of_measurement = "%"
    _attr_device_class = SensorDeviceClass.POWER_FACTOR
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, audio_processor, range_type: str, name: str) -> None:
        """Initialize the sensor."""
        self._audio_processor = audio_processor
        self._range_type = range_type
        self._attr_name = name
        self._attr_unique_id = f"aurora_audio_{range_type}_energy"
        self._attr_native_value = 0

    @property
    def native_value(self) -> StateType:
        """Return the state of the sensor."""
        if self._range_type == "bass":
            value = self._audio_processor._bass_energy
        elif self._range_type == "mid":
            value = self._audio_processor._mid_energy
        else:  # high
            value = self._audio_processor._high_energy
            
        return round(value * 100, 1)


class AudioLatencySensor(SensorEntity):
    """Sensor for audio processing latency."""

    _attr_name = "Audio Processing Latency"
    _attr_native_unit_of_measurement = "ms"
    _attr_device_class = SensorDeviceClass.DURATION
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(self, audio_processor) -> None:
        """Initialize the sensor."""
        self._audio_processor = audio_processor
        self._attr_unique_id = "aurora_audio_latency"
        self._attr_native_value = 0

    @property
    def native_value(self) -> StateType:
        """Return the state of the sensor."""
        return self._audio_processor.buffer_size


class AGCGainSensor(SensorEntity):
    """Sensor for AGC gain level."""

    _attr_name = "AGC Gain"
    _attr_native_unit_of_measurement = "x"
    _attr_device_class = None
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_entity_category = "diagnostic"

    def __init__(self, audio_processor) -> None:
        """Initialize the sensor."""
        self._audio_processor = audio_processor
        self._attr_unique_id = "aurora_agc_gain"
        self._attr_native_value = 1.0

    @property
    def native_value(self) -> StateType:
        """Return the state of the sensor."""
        return round(self._audio_processor.current_gain, 2)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return entity specific state attributes."""
        return {
            "enabled": self._audio_processor.agc_enabled,
            "min_gain": 0.1,
            "max_gain": 10.0,
        }


class AGCLevelSensor(SensorEntity):
    """Sensor for AGC audio levels (RMS and Peak)."""

    _attr_native_unit_of_measurement = "dB"
    _attr_device_class = SensorDeviceClass.POWER_FACTOR
    _attr_state_class = SensorStateClass.MEASUREMENT
    _attr_entity_category = "diagnostic"

    def __init__(self, audio_processor, level_type: str, name: str) -> None:
        """Initialize the sensor."""
        self._audio_processor = audio_processor
        self._level_type = level_type
        self._attr_name = name
        self._attr_unique_id = f"aurora_agc_{level_type}_level"
        self._attr_native_value = -60.0  # Initial value in dB

    @property
    def native_value(self) -> StateType:
        """Return the state of the sensor."""
        # Convert linear scale to dB
        if self._level_type == "rms":
            value = self._audio_processor._rms_history[-1] if self._audio_processor._rms_history else 0.0001
        else:  # peak
            value = self._audio_processor._peak_hold
        
        # Convert to dB with minimum of -60 dB
        db_value = 20 * np.log10(max(value, 0.001))
        return round(max(db_value, -60.0), 1)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return entity specific state attributes."""
        return {
            "linear_value": round(
                self._audio_processor._rms_history[-1] if self._level_type == "rms" else self._audio_processor._peak_hold,
                4
            ),
        }