"""Performance optimization module for Aurora Sound to Light."""
import asyncio
import logging
import psutil
from typing import Dict, Optional, List, Tuple
import numpy as np
from dataclasses import dataclass
from enum import Enum

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

class PerformanceMode(Enum):
    """Performance modes for the optimizer."""
    HIGH_PERFORMANCE = "high_performance"
    BALANCED = "balanced"
    POWER_SAVE = "power_save"
    ADAPTIVE = "adaptive"

@dataclass
class ThrottleConfig:
    """Configuration for CPU throttling."""
    enabled: bool = True
    cpu_target: float = 70.0  # Target CPU usage percentage
    sample_window: int = 10  # Number of samples to average
    throttle_step: float = 5.0  # Percentage to adjust by
    min_performance: float = 30.0  # Minimum performance level
    max_performance: float = 100.0  # Maximum performance level
    recovery_rate: float = 1.0  # Rate at which to recover performance

class PerformanceOptimizer:
    """Handles performance optimization for the Aurora Sound to Light integration."""

    def __init__(self, hass: HomeAssistant):
        """Initialize the performance optimizer."""
        self.hass = hass
        self._audio_buffer_size = 1024  # Default buffer size
        self._target_latency = 50  # Target latency in ms
        self._cpu_threshold = 70  # CPU usage threshold percentage
        self._memory_threshold = 80  # Memory usage threshold percentage
        self._light_batch_size = 10  # Number of lights to update in parallel
        self._optimization_interval = 60  # Seconds between optimization runs
        
        # CPU throttling configuration
        self._throttle_config = ThrottleConfig()
        self._performance_mode = PerformanceMode.ADAPTIVE
        self._current_performance_level = 100.0
        self._cpu_history: List[float] = []
        self._last_throttle_time = 0
        self._effect_quality_level = 1.0
        self._processing_quality_level = 1.0

    async def optimize_audio_processing(self, current_latency: float) -> Dict[str, int]:
        """Optimize audio processing parameters based on system performance."""
        cpu_usage = psutil.cpu_percent()
        memory_usage = psutil.virtual_memory().percent

        # Apply performance level to calculations
        effective_cpu = cpu_usage * (self._current_performance_level / 100.0)

        # Adjust buffer size based on latency and CPU usage
        if current_latency > self._target_latency * 1.2:  # 20% above target
            if effective_cpu < self._cpu_threshold:
                self._audio_buffer_size = max(512, self._audio_buffer_size // 2)
            else:
                # If CPU is high, try to find a balance
                self._audio_buffer_size = int(self._audio_buffer_size * 1.2)
        elif current_latency < self._target_latency * 0.8:  # 20% below target
            # Room for optimization
            self._audio_buffer_size = min(4096, int(self._audio_buffer_size * 1.2))

        # Apply quality adjustments based on performance level
        processing_quality = self._processing_quality_level * (self._current_performance_level / 100.0)

        return {
            "buffer_size": self._audio_buffer_size,
            "target_latency": self._target_latency,
            "processing_quality": processing_quality
        }

    async def optimize_light_control(
        self, 
        light_count: int,
        current_latency: float
    ) -> Dict[str, int]:
        """Optimize light control parameters for better performance."""
        cpu_usage = psutil.cpu_percent()

        # Apply performance level to batch size calculation
        effective_cpu = cpu_usage * (self._current_performance_level / 100.0)
        
        # Adjust batch size based on light count and CPU usage
        optimal_batch_size = max(1, min(
            light_count,
            int(self._light_batch_size * (100 - effective_cpu) / 50)
        ))

        # Adjust update interval based on latency and performance level
        update_interval = max(
            16,  # Minimum 60fps
            min(100, int(current_latency * 0.8 * (100 / self._current_performance_level)))
        )

        # Apply effect quality adjustments
        effect_quality = self._effect_quality_level * (self._current_performance_level / 100.0)

        return {
            "batch_size": optimal_batch_size,
            "update_interval": update_interval,
            "effect_quality": effect_quality
        }

    async def optimize_memory_usage(self) -> None:
        """Optimize memory usage by cleaning up unused resources."""
        if psutil.virtual_memory().percent > self._memory_threshold:
            # Force garbage collection
            import gc
            gc.collect()

            # Clear any internal caches
            self._clear_effect_caches()
            self._clear_audio_buffers()

            # Adjust performance level if memory is still high
            if psutil.virtual_memory().percent > self._memory_threshold:
                await self._throttle_performance(reason="high_memory")

    def _update_cpu_history(self, cpu_usage: float) -> None:
        """Update CPU usage history for throttling decisions."""
        self._cpu_history.append(cpu_usage)
        if len(self._cpu_history) > self._throttle_config.sample_window:
            self._cpu_history.pop(0)

    def _get_average_cpu_usage(self) -> float:
        """Calculate average CPU usage over the sample window."""
        if not self._cpu_history:
            return 0.0
        return sum(self._cpu_history) / len(self._cpu_history)

    async def _throttle_performance(self, reason: str = "cpu_usage") -> None:
        """Adjust performance level based on system metrics."""
        if not self._throttle_config.enabled:
            return

        avg_cpu = self._get_average_cpu_usage()
        current_time = asyncio.get_event_loop().time()
        time_since_last_throttle = current_time - self._last_throttle_time

        # Determine throttle direction and amount
        if avg_cpu > self._throttle_config.cpu_target:
            # Reduce performance
            new_level = max(
                self._throttle_config.min_performance,
                self._current_performance_level - self._throttle_config.throttle_step
            )
            _LOGGER.info(
                "Throttling performance due to %s: %s%% -> %s%%",
                reason, self._current_performance_level, new_level
            )
        elif (avg_cpu < self._throttle_config.cpu_target * 0.8 and 
              time_since_last_throttle > 60):  # Wait at least 60 seconds before increasing
            # Gradually increase performance
            new_level = min(
                self._throttle_config.max_performance,
                self._current_performance_level + self._throttle_config.recovery_rate
            )
            _LOGGER.info(
                "Recovering performance: %s%% -> %s%%",
                self._current_performance_level, new_level
            )
        else:
            return

        self._current_performance_level = new_level
        self._last_throttle_time = current_time

        # Adjust quality levels based on performance
        self._adjust_quality_levels()

    def _adjust_quality_levels(self) -> None:
        """Adjust various quality levels based on current performance level."""
        performance_factor = self._current_performance_level / 100.0
        
        # Adjust effect quality (animations, transitions)
        self._effect_quality_level = max(0.3, performance_factor)
        
        # Adjust processing quality (FFT resolution, update rate)
        self._processing_quality_level = max(0.5, performance_factor)

    def set_performance_mode(self, mode: PerformanceMode) -> None:
        """Set the performance mode of the optimizer."""
        self._performance_mode = mode
        
        if mode == PerformanceMode.HIGH_PERFORMANCE:
            self._throttle_config.enabled = False
            self._current_performance_level = 100.0
        elif mode == PerformanceMode.POWER_SAVE:
            self._throttle_config.enabled = True
            self._throttle_config.cpu_target = 50.0
            self._throttle_config.max_performance = 70.0
        elif mode == PerformanceMode.BALANCED:
            self._throttle_config.enabled = True
            self._throttle_config.cpu_target = 70.0
            self._throttle_config.max_performance = 90.0
        elif mode == PerformanceMode.ADAPTIVE:
            self._throttle_config.enabled = True
            self._throttle_config.cpu_target = 70.0
            self._throttle_config.max_performance = 100.0

        self._adjust_quality_levels()
        _LOGGER.info("Performance mode set to: %s", mode.value)

    async def start_optimization_loop(self) -> None:
        """Start the continuous optimization loop."""
        while True:
            try:
                # Get current metrics
                cpu_usage = psutil.cpu_percent()
                memory_usage = psutil.virtual_memory().percent

                # Update CPU history for throttling decisions
                self._update_cpu_history(cpu_usage)

                if self._performance_mode == PerformanceMode.ADAPTIVE:
                    await self._throttle_performance()

                if cpu_usage > self._cpu_threshold:
                    _LOGGER.warning(
                        "High CPU usage detected (%s%%). Adjusting parameters...",
                        cpu_usage
                    )
                    # Implement CPU optimization strategies
                    await self.optimize_audio_processing(self._target_latency)
                    await self._throttle_performance(reason="high_cpu")
                
                if memory_usage > self._memory_threshold:
                    _LOGGER.warning(
                        "High memory usage detected (%s%%). Cleaning up...",
                        memory_usage
                    )
                    await self.optimize_memory_usage()

            except Exception as err:
                _LOGGER.error("Error in optimization loop: %s", err)

            await asyncio.sleep(self._optimization_interval)

    def get_optimization_stats(self) -> Dict[str, float]:
        """Get current optimization statistics."""
        return {
            "cpu_usage": psutil.cpu_percent(),
            "memory_usage": psutil.virtual_memory().percent,
            "buffer_size": self._audio_buffer_size,
            "target_latency": self._target_latency,
            "light_batch_size": self._light_batch_size,
            "performance_level": self._current_performance_level,
            "performance_mode": self._performance_mode.value,
            "effect_quality": self._effect_quality_level,
            "processing_quality": self._processing_quality_level
        } 