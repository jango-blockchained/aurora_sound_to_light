"""Tests for the audio processor component."""
import pytest
from unittest.mock import Mock, patch
import numpy as np

from homeassistant.core import HomeAssistant

from custom_components.aurora_sound_to_light.audio_processor import AudioProcessor


@pytest.fixture
def audio_processor(hass: HomeAssistant):
    """Create an audio processor instance for testing."""
    return AudioProcessor(hass)


@pytest.fixture
def mock_ffmpeg_process():
    """Mock FFmpeg process."""
    mock_process = Mock()
    mock_process.stdout.read.return_value = np.zeros(1024, dtype=np.int16).tobytes()
    mock_process.poll.return_value = None
    return mock_process


async def test_init(audio_processor):
    """Test initialization."""
    assert audio_processor.hass is not None
    assert audio_processor._media_player is None
    assert audio_processor._audio_buffer is None


async def test_setup(audio_processor):
    """Test setup."""
    result = await audio_processor.async_setup()
    assert result is True


async def test_start_stop(audio_processor, mock_ffmpeg_process):
    """Test starting and stopping audio processing."""
    with patch('subprocess.Popen', return_value=mock_ffmpeg_process):
        await audio_processor.async_start("media_player.test")
        assert audio_processor._media_player == "media_player.test"
        assert audio_processor._thread is not None
        assert audio_processor._thread.is_alive()

        await audio_processor.async_stop()
        assert not audio_processor._thread.is_alive()
        assert audio_processor._process is None


async def test_process_audio(audio_processor, mock_ffmpeg_process):
    """Test audio processing."""
    with patch('subprocess.Popen', return_value=mock_ffmpeg_process):
        await audio_processor.async_start("media_player.test")
        await audio_processor.async_stop()

        # Check FFT data
        fft_data = audio_processor.fft_data
        assert fft_data is not None
        assert len(fft_data) > 0


async def test_beat_detection(audio_processor, mock_ffmpeg_process):
    """Test beat detection."""
    with patch('subprocess.Popen', return_value=mock_ffmpeg_process):
        await audio_processor.async_start("media_player.test")
        
        # Simulate high energy audio
        mock_ffmpeg_process.stdout.read.return_value = (
            np.ones(1024, dtype=np.int16) * 32767
        ).tobytes()
        
        # Wait for beat detection
        await audio_processor.async_stop()
        
        assert audio_processor.beat_detected
        assert audio_processor.bpm > 0


async def test_error_handling(audio_processor):
    """Test error handling."""
    with patch('subprocess.Popen', side_effect=Exception("Test error")):
        await audio_processor.async_start("media_player.test")
        assert audio_processor._process is None
        await audio_processor.async_stop()


async def test_invalid_media_player(audio_processor):
    """Test handling invalid media player."""
    await audio_processor.async_start("media_player.invalid")
    assert audio_processor._process is None
    await audio_processor.async_stop()


async def test_spotify_stream(audio_processor, hass):
    """Test handling Spotify streams."""
    hass.states.async_set(
        "media_player.test",
        "playing",
        {"media_content_id": "spotify:track:123"}
    )
    await audio_processor.async_start("media_player.test")
    assert audio_processor._process is None
    await audio_processor.async_stop()


async def test_no_media_content(audio_processor, hass):
    """Test handling no media content."""
    hass.states.async_set("media_player.test", "playing", {})
    await audio_processor.async_start("media_player.test")
    assert audio_processor._process is None
    await audio_processor.async_stop()


async def test_process_empty_chunk(audio_processor):
    """Test processing empty audio chunk."""
    audio_processor._process_chunk(np.array([]))
    assert audio_processor.fft_data is None
