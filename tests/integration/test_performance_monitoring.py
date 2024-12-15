"""Integration tests for the performance monitoring system."""
from unittest.mock import patch
import pytest

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component

from custom_components.aurora_sound_to_light.const import DOMAIN
from custom_components.aurora_sound_to_light.core.latency_monitor import (
    LatencyMonitor,
)


@pytest.fixture
def mock_metrics():
    """Mock metrics data."""
    return {
        "latency": 45.5,
        "cpuUsage": 65.0,
        "memoryUsage": 75.0,
        "audioBufferHealth": 95.0,
        "systemStatus": "good"
    }


@pytest.fixture
async def mock_hass(hass: HomeAssistant):
    """Set up a mocked Home Assistant instance."""
    config = {
        DOMAIN: {
            "audio_input": "microphone",
            "light_groups": [{
                "name": "Test Group",
                "lights": ["light.test_light"]
            }]
        }
    }

    with patch(
        'custom_components.aurora_sound_to_light.core.latency_monitor.'
        'LatencyMonitor.get_metrics'
    ) as mock_get_metrics:
        mock_get_metrics.return_value = mock_metrics()
        assert await async_setup_component(hass, DOMAIN, config)
        await hass.async_block_till_done()
        yield hass


async def test_websocket_api_get_metrics(
    mock_hass: HomeAssistant,
    mock_metrics
):
    """Test that the WebSocket API correctly returns metrics."""
    client = await mock_hass.async_ws_client()

    await client.send_json({
        "id": 1,
        "type": "aurora_sound_to_light/get_metrics"
    })

    msg = await client.receive_json()
    assert msg["success"]
    assert msg["result"] == mock_metrics


async def test_metrics_update_interval(
    mock_hass: HomeAssistant,
    mock_metrics
):
    """Test that metrics are updated at the correct interval."""
    with patch(
        'custom_components.aurora_sound_to_light.core.latency_monitor.'
        'LatencyMonitor.get_metrics'
    ) as mock_get_metrics:
        mock_get_metrics.return_value = mock_metrics

        # Get initial metrics
        client = await mock_hass.async_ws_client()
        await client.send_json({
            "id": 1,
            "type": "aurora_sound_to_light/get_metrics"
        })
        msg1 = await client.receive_json()

        # Wait for update interval
        await mock_hass.async_block_till_done()

        # Get updated metrics
        await client.send_json({
            "id": 2,
            "type": "aurora_sound_to_light/get_metrics"
        })
        msg2 = await client.receive_json()

        assert mock_get_metrics.call_count >= 2
        assert msg1["result"] == msg2["result"] == mock_metrics


async def test_latency_monitor_integration(mock_hass: HomeAssistant):
    """Test integration between LatencyMonitor and the WebSocket API."""
    latency_monitor = LatencyMonitor()

    # Simulate high latency
    with patch.object(latency_monitor, 'measure_latency', return_value=150.0):
        metrics = await latency_monitor.get_metrics()
        assert metrics["latency"] == 150.0
        assert metrics["systemStatus"] == "warning"

        # Verify WebSocket API reflects the change
        client = await mock_hass.async_ws_client()
        await client.send_json({
            "id": 1,
            "type": "aurora_sound_to_light/get_metrics"
        })
        msg = await client.receive_json()
        assert msg["result"]["latency"] == 150.0
        assert msg["result"]["systemStatus"] == "warning"


async def test_performance_monitoring_under_load(mock_hass: HomeAssistant):
    """Test performance monitoring system under simulated load."""
    # Simulate high CPU usage
    with patch('psutil.cpu_percent', return_value=85.0):
        client = await mock_hass.async_ws_client()
        await client.send_json({
            "id": 1,
            "type": "aurora_sound_to_light/get_metrics"
        })
        msg = await client.receive_json()
        assert msg["result"]["cpuUsage"] == 85.0
        assert msg["result"]["systemStatus"] == "warning"


async def test_audio_buffer_health_integration(mock_hass: HomeAssistant):
    """Test integration with audio buffer health monitoring."""
    with patch(
        'custom_components.aurora_sound_to_light.core.audio_processor.'
        'AudioProcessor.get_buffer_health',
        return_value=60.0
    ):
        client = await mock_hass.async_ws_client()
        await client.send_json({
            "id": 1,
            "type": "aurora_sound_to_light/get_metrics"
        })
        msg = await client.receive_json()
        assert msg["result"]["audioBufferHealth"] == 60.0


async def test_error_handling(mock_hass: HomeAssistant):
    """Test error handling in the performance monitoring system."""
    with patch(
        'custom_components.aurora_sound_to_light.core.latency_monitor.'
        'LatencyMonitor.get_metrics',
        side_effect=Exception("Test error")
    ):
        client = await mock_hass.async_ws_client()
        await client.send_json({
            "id": 1,
            "type": "aurora_sound_to_light/get_metrics"
        })
        msg = await client.receive_json()
        assert not msg["success"]
        assert "error" in msg


async def test_frontend_backend_integration(
    mock_hass: HomeAssistant,
    mock_metrics
):
    """Test complete integration between frontend and backend."""
    # Simulate frontend request
    client = await mock_hass.async_ws_client()

    # Test initial load
    await client.send_json({
        "id": 1,
        "type": "aurora_sound_to_light/get_metrics"
    })
    msg = await client.receive_json()
    assert msg["success"]
    assert msg["result"] == mock_metrics

    # Test metric updates
    new_metrics = {**mock_metrics, "latency": 75.0}
    with patch(
        'custom_components.aurora_sound_to_light.core.latency_monitor.'
        'LatencyMonitor.get_metrics',
        return_value=new_metrics
    ):
        await client.send_json({
            "id": 2,
            "type": "aurora_sound_to_light/get_metrics"
        })
        msg = await client.receive_json()
        assert msg["result"]["latency"] == 75.0
