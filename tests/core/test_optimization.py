"""Tests for the performance optimization module."""
import asyncio
from unittest.mock import patch, MagicMock
import pytest

from custom_components.aurora_sound_to_light.core.optimization import (
    PerformanceOptimizer
)


@pytest.fixture
def mock_hass():
    """Create a mock Home Assistant instance."""
    return MagicMock()


@pytest.fixture
def optimizer(mock_hass):
    """Create a PerformanceOptimizer instance."""
    return PerformanceOptimizer(mock_hass)


async def test_optimize_audio_processing_high_latency(optimizer):
    """Test audio optimization with high latency."""
    with patch('psutil.cpu_percent', return_value=50.0):
        result = await optimizer.optimize_audio_processing(100.0)  # High latency
        assert result["buffer_size"] < 1024  # Should reduce buffer size
        assert result["target_latency"] == 50


async def test_optimize_audio_processing_low_latency(optimizer):
    """Test audio optimization with low latency."""
    with patch('psutil.cpu_percent', return_value=30.0):
        result = await optimizer.optimize_audio_processing(20.0)  # Low latency
        assert result["buffer_size"] > 1024  # Should increase buffer size
        assert result["target_latency"] == 50


async def test_optimize_light_control(optimizer):
    """Test light control optimization."""
    with patch('psutil.cpu_percent', return_value=60.0):
        result = await optimizer.optimize_light_control(20, 45.0)
        assert 1 <= result["batch_size"] <= 20
        assert 16 <= result["update_interval"] <= 100


async def test_optimize_memory_usage(optimizer):
    """Test memory usage optimization."""
    with patch('psutil.virtual_memory') as mock_memory:
        mock_memory.return_value.percent = 85.0
        with patch('gc.collect') as mock_gc:
            await optimizer.optimize_memory_usage()
            mock_gc.assert_called_once()


async def test_optimization_loop(optimizer):
    """Test the continuous optimization loop."""
    with patch('psutil.cpu_percent', side_effect=[75.0, 50.0]):
        with patch('psutil.virtual_memory') as mock_memory:
            mock_memory.return_value.percent = 85.0
            with patch.object(optimizer, 'optimize_audio_processing') as mock_optimize:
                with patch.object(asyncio, 'sleep') as mock_sleep:
                    mock_sleep.side_effect = [None, Exception("Stop loop")]
                    try:
                        await optimizer.start_optimization_loop()
                    except Exception:
                        pass
                    mock_optimize.assert_called_once()


async def test_get_optimization_stats(optimizer):
    """Test getting optimization statistics."""
    with patch('psutil.cpu_percent', return_value=45.0):
        with patch('psutil.virtual_memory') as mock_memory:
            mock_memory.return_value.percent = 65.0
            stats = optimizer.get_optimization_stats()
            assert "cpu_usage" in stats
            assert "memory_usage" in stats
            assert "buffer_size" in stats
            assert "target_latency" in stats
            assert "light_batch_size" in stats


async def test_optimize_audio_processing_high_cpu(optimizer):
    """Test audio optimization with high CPU usage."""
    with patch('psutil.cpu_percent', return_value=80.0):
        result = await optimizer.optimize_audio_processing(60.0)
        assert result["buffer_size"] > 1024  # Should increase buffer to reduce CPU load


async def test_optimize_light_control_many_lights(optimizer):
    """Test light control optimization with many lights."""
    with patch('psutil.cpu_percent', return_value=40.0):
        result = await optimizer.optimize_light_control(100, 30.0)
        assert result["batch_size"] > 1  # Should process multiple lights
        assert result["update_interval"] >= 16  # Should maintain minimum framerate 