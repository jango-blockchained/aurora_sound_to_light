"""Sensor platform for Aurora Sound to Light."""
import logging
from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorStateClass,
)
from homeassistant.config_entries import ConfigEntry
from homeassistant.const import PERCENTAGE, UnitOfTime
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import (
    DOMAIN,
    METRIC_AUDIO_LATENCY,
    METRIC_LIGHT_LATENCY,
    METRIC_CPU_USAGE,
)

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    config_entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up the Aurora Sound to Light sensors."""
    _LOGGER.info("Setting up Aurora Sound to Light sensors")
    
    data = hass.data[DOMAIN][config_entry.entry_id]
    audio_processor = data["audio_processor"]
    
    entities = [
        AuroraLatencySensor(
            hass,
            audio_processor,
            "audio_latency",
            "Audio Latency",
            METRIC_AUDIO_LATENCY,
            UnitOfTime.MILLISECONDS,
        ),
        AuroraLatencySensor(
            hass,
            audio_processor,
            "light_latency",
            "Light Latency",
            METRIC_LIGHT_LATENCY,
            UnitOfTime.MILLISECONDS,
        ),
        AuroraCPUSensor(
            hass,
            audio_processor,
            "cpu_usage",
            "CPU Usage",
            METRIC_CPU_USAGE,
            PERCENTAGE,
        ),
    ]
    
    async_add_entities(entities)


class AuroraLatencySensor(SensorEntity):
    """Sensor for Aurora Sound to Light latency metrics."""

    _attr_has_entity_name = True
    _attr_device_class = SensorDeviceClass.DURATION
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(
        self,
        hass: HomeAssistant,
        processor: Any,
        unique_id: str,
        name: str,
        metric: str,
        unit: str,
    ) -> None:
        """Initialize the sensor."""
        self.hass = hass
        self._processor = processor
        self._attr_unique_id = f"{DOMAIN}_{unique_id}"
        self._attr_name = name
        self._metric = metric
        self._attr_native_unit_of_measurement = unit
        self._attr_native_value = 0

    async def async_update(self) -> None:
        """Update the sensor."""
        if hasattr(self._processor, "get_metric"):
            self._attr_native_value = await self._processor.get_metric(self._metric)


class AuroraCPUSensor(SensorEntity):
    """Sensor for Aurora Sound to Light CPU usage."""

    _attr_has_entity_name = True
    _attr_device_class = SensorDeviceClass.POWER_FACTOR
    _attr_state_class = SensorStateClass.MEASUREMENT

    def __init__(
        self,
        hass: HomeAssistant,
        processor: Any,
        unique_id: str,
        name: str,
        metric: str,
        unit: str,
    ) -> None:
        """Initialize the sensor."""
        self.hass = hass
        self._processor = processor
        self._attr_unique_id = f"{DOMAIN}_{unique_id}"
        self._attr_name = name
        self._metric = metric
        self._attr_native_unit_of_measurement = unit
        self._attr_native_value = 0

    async def async_update(self) -> None:
        """Update the sensor."""
        if hasattr(self._processor, "get_metric"):
            self._attr_native_value = await self._processor.get_metric(self._metric)