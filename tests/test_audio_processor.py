"""Tests for the audio processor component."""
import pytest
from unittest.mock import Mock, patch
import numpy as np

from homeassistant.core import HomeAssistant

from custom_components.aurora_sound_to_light.audio_processor import (
    AudioProcessor,
    SAMPLE_RATE,
    CHUNK_SIZE,
    NUM_BANDS,
    MIN_FREQ,
    MAX_FREQ,
)


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


async def test_frequency_bands(audio_processor):
    """Test frequency band analysis."""
    # Create test signal with known frequencies
    t = np.linspace(0, CHUNK_SIZE/SAMPLE_RATE, CHUNK_SIZE)
    # Generate a signal with peaks at specific frequencies
    test_freqs = [50, 500, 2000]  # Hz
    signal = np.sum([np.sin(2 * np.pi * f * t) for f in test_freqs])
    
    # Process the test signal
    audio_processor._process_audio(signal)
    
    # Check if the frequency bands contain the expected peaks
    assert len(audio_processor._freq_bands) == NUM_BANDS
    assert np.any(audio_processor._freq_bands > 0)  # Should detect some energy


async def test_energy_detection(audio_processor):
    """Test energy level detection."""
    # Test with silence
    silence = np.zeros(CHUNK_SIZE)
    audio_processor._process_audio(silence)
    assert audio_processor._energy < 0.1  # Energy should be very low

    # Test with high energy signal
    loud_signal = np.ones(CHUNK_SIZE) * 0.8
    audio_processor._process_audio(loud_signal)
    assert audio_processor._energy > 0.5  # Energy should be high


async def test_tempo_detection(audio_processor):
    """Test tempo detection capabilities."""
    # Simulate a regular beat pattern
    beat_interval = int(SAMPLE_RATE * 0.5)  # 120 BPM
    signal = np.zeros(CHUNK_SIZE)
    signal[::beat_interval] = 1.0
    
    # Process multiple chunks to establish tempo
    for _ in range(4):
        audio_processor._process_audio(signal)
    
    assert 110 <= audio_processor._tempo <= 130  # Should detect around 120 BPM


async def test_waveform_analysis(audio_processor):
    """Test waveform analysis."""
    # Generate a test waveform
    t = np.linspace(0, CHUNK_SIZE/SAMPLE_RATE, CHUNK_SIZE)
    waveform = np.sin(2 * np.pi * 440 * t)  # 440 Hz sine wave
    
    audio_processor._process_audio(waveform)
    
    assert len(audio_processor._waveform) == NUM_BANDS
    assert np.all(np.abs(audio_processor._waveform) <= 1.0)  # Should be normalized


async def test_stream_url_handling(audio_processor, hass):
    """Test handling of different stream URL types."""
    # Test with direct URL
    hass.states.async_set(
        "media_player.test",
        "playing",
        {
            "media_content_id": "http://example.com/stream.mp3",
            "media_content_type": "music"
        }
    )
    url = await audio_processor._get_stream_url()
    assert url == "http://example.com/stream.mp3"

    # Test with invalid content type
    hass.states.async_set(
        "media_player.test",
        "playing",
        {
            "media_content_id": "http://example.com/video.mp4",
            "media_content_type": "video"
        }
    )
    url = await audio_processor._get_stream_url()
    assert url is None
