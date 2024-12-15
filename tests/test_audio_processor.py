"""Tests for the audio processor component."""
import asyncio
import pytest
import numpy as np
from unittest.mock import Mock, patch, AsyncMock
from homeassistant.core import HomeAssistant
from homeassistant.components.media_player.const import ATTR_MEDIA_CONTENT_ID

from custom_components.aurora_sound_to_light.audio_processor import (
    AudioProcessor,
    CHUNK_SIZE,
    NUM_BANDS
)

@pytest.fixture
def hass(event_loop):
    """Fixture to provide a test instance of Home Assistant."""
    hass = Mock(spec=HomeAssistant)
    hass.data = {}
    hass.states = Mock()
    hass.bus = Mock()
    hass.bus.async_fire = AsyncMock()
    return hass

@pytest.fixture
def config():
    """Fixture to provide test configuration."""
    return {
        "media_player": "media_player.test"
    }

@pytest.fixture
def processor(hass, config):
    """Fixture to provide a test instance of AudioProcessor."""
    return AudioProcessor(hass, config)

@pytest.mark.asyncio
async def test_initialization(processor):
    """Test AudioProcessor initialization."""
    assert processor.media_player == "media_player.test"
    assert not processor._running
    assert processor._task is None
    assert processor._process is None
    assert len(processor._freq_bands) == NUM_BANDS
    assert len(processor._waveform) == NUM_BANDS

@pytest.mark.asyncio
async def test_start_stop(processor):
    """Test starting and stopping the audio processor."""
    # Test start
    await processor.start()
    assert processor._running
    assert processor._task is not None
    
    # Test stop
    await processor.stop()
    assert not processor._running
    assert processor._task is None
    assert processor._process is None

@pytest.mark.asyncio
async def test_get_stream_url_spotify(hass, processor):
    """Test getting stream URL from Spotify player."""
    # Mock Spotify state
    mock_state = Mock()
    mock_state.state = "playing"
    mock_state.attributes = {
        ATTR_MEDIA_CONTENT_ID: "spotify:track:123"
    }
    hass.states.get.return_value = mock_state
    
    # Mock Spotify integration
    mock_spotify = AsyncMock()
    mock_spotify.async_get_track = AsyncMock(
        return_value={"preview_url": "http://test.url"}
    )
    hass.data["spotify"] = mock_spotify
    
    processor.media_player = "spotify.test"
    url = await processor._get_stream_url()
    assert url == "http://test.url"

@pytest.mark.asyncio
async def test_get_stream_url_generic(hass, processor):
    """Test getting stream URL from generic media player."""
    # Mock media player state
    mock_state = Mock()
    mock_state.state = "playing"
    mock_state.attributes = {
        "media_content_id": "http://test.url",
        "media_content_type": "music"
    }
    hass.states.get.return_value = mock_state
    
    url = await processor._get_stream_url()
    assert url == "http://test.url"

@pytest.mark.asyncio
async def test_audio_processing(processor):
    """Test audio processing pipeline."""
    # Create test audio data
    t = np.linspace(0, 1, CHUNK_SIZE)
    test_audio = np.sin(2 * np.pi * 440 * t)  # 440 Hz sine wave
    
    # Process audio
    processor._process_audio(test_audio)
    
    # Check results
    assert len(processor._freq_bands) == NUM_BANDS
    assert len(processor._waveform) == NUM_BANDS
    assert 0 <= processor._energy <= 1
    assert isinstance(processor._is_beat, bool)
    assert processor._tempo >= 0

@pytest.mark.asyncio
async def test_beat_detection(processor):
    """Test beat detection."""
    # Create test audio with strong bass
    t = np.linspace(0, 1, CHUNK_SIZE)
    bass_freq = 100  # Hz
    test_audio = np.sin(2 * np.pi * bass_freq * t)
    test_audio *= 2  # Amplify
    
    # Process multiple frames
    for _ in range(10):
        processor._process_audio(test_audio)
        await asyncio.sleep(0.01)
    
    # Check beat detection results
    assert isinstance(processor._is_beat, bool)
    assert processor._tempo >= 0
    assert len(processor._beat_history) == 8

@pytest.mark.asyncio
async def test_notify_update(hass, processor):
    """Test event notification."""
    # Process some audio
    t = np.linspace(0, 1, CHUNK_SIZE)
    test_audio = np.sin(2 * np.pi * 440 * t)
    processor._process_audio(test_audio)
    
    # Test notification
    await processor._notify_update()
    
    # Verify event was fired
    hass.bus.async_fire.assert_called_once()
    event_data = hass.bus.async_fire.call_args[0][1]
    
    # Check event data
    assert "frequencies" in event_data
    assert "waveform" in event_data
    assert "energy" in event_data
    assert "beat" in event_data
    assert "tempo" in event_data
    
    # Check data types
    assert isinstance(event_data["frequencies"], list)
    assert isinstance(event_data["waveform"], list)
    assert isinstance(event_data["energy"], float)
    assert isinstance(event_data["beat"], bool)
    assert isinstance(event_data["tempo"], float)

@pytest.mark.asyncio
async def test_error_handling(hass, processor):
    """Test error handling in audio processing."""
    # Test invalid media player
    processor.media_player = "invalid_player"
    audio_data = await processor._get_audio_data()
    assert audio_data is None
    
    # Test FFmpeg process failure
    with patch("subprocess.Popen", side_effect=Exception("FFmpeg error")):
        audio_data = await processor._get_audio_data()
        assert audio_data is None
        assert processor._process is None

@pytest.mark.asyncio
async def test_process_loop_recovery(processor):
    """Test process loop recovery from errors."""
    # Mock _get_audio_data to simulate intermittent failures
    original_get_audio_data = processor._get_audio_data
    call_count = 0
    
    async def mock_get_audio_data():
        nonlocal call_count
        call_count += 1
        if call_count % 2 == 0:
            return None
        return np.zeros(CHUNK_SIZE)
    
    processor._get_audio_data = mock_get_audio_data
    
    # Start processor
    await processor.start()
    await asyncio.sleep(0.1)  # Let it run briefly
    
    # Stop processor
    await processor.stop()
    
    # Restore original method
    processor._get_audio_data = original_get_audio_data
    
    # Verify the process continued running despite failures
    assert call_count > 1