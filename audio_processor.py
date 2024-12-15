"""Audio processor for Aurora Sound to Light."""
import asyncio
import logging
import numpy as np
import subprocess
import shutil
from typing import Dict, Optional

from homeassistant.core import HomeAssistant
from homeassistant.components.ffmpeg import FFmpegManager
from homeassistant.components.media_player import MediaType
from homeassistant.components.media_player.const import (
    ATTR_MEDIA_CONTENT_ID,
    ATTR_MEDIA_CONTENT_TYPE,
)

_LOGGER = logging.getLogger(__name__)

# Audio processing constants
SAMPLE_RATE = 44100
CHUNK_SIZE = 2048
NUM_BANDS = 32
MIN_FREQ = 20
MAX_FREQ = 20000
BEAT_MIN_FREQ = 20
BEAT_MAX_FREQ = 200
BEAT_THRESHOLD = 0.15
ENERGY_SMOOTH = 0.2
TEMPO_SMOOTH = 0.2


class AudioProcessor:
    """Process audio data from media players."""

    def __init__(self, hass: HomeAssistant, config: Dict):
        """Initialize the audio processor."""
        self.hass = hass
        self.config = config
        self.media_player: Optional[str] = config.get("media_player")

        # Initialize FFmpeg
        ffmpeg_bin = shutil.which("ffmpeg")
        if not ffmpeg_bin:
            raise RuntimeError("FFmpeg not found")
        self.ffmpeg = FFmpegManager(self.hass, ffmpeg_bin)

        # Audio processing state
        self._running = False
        self._task: Optional[asyncio.Task] = None
        self._process: Optional[subprocess.Popen] = None
        self._last_chunk = np.zeros(CHUNK_SIZE)
        self._freq_bands = np.zeros(NUM_BANDS)
        self._waveform = np.zeros(NUM_BANDS)
        self._energy_history = np.zeros(8)
        self._beat_history = np.zeros(8)
        self._tempo_history = np.zeros(4)

        # Analysis results
        self._energy = 0.0
        self._is_beat = False
        self._tempo = 0.0
        self._last_beat_time = 0.0

        # Set up frequency bands (logarithmic scale)
        self._freq_range = np.logspace(
            np.log10(MIN_FREQ),
            np.log10(MAX_FREQ),
            NUM_BANDS + 1
        )
        self._band_indices = np.floor(
            self._freq_range * CHUNK_SIZE / SAMPLE_RATE
        ).astype(int)

    async def start(self):
        """Start audio processing."""
        if self._running:
            return

        self._running = True
        self._task = asyncio.create_task(self._process_loop())
        _LOGGER.info("Started audio processor")

    async def stop(self):
        """Stop audio processing."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None

        if self._process:
            self._process.terminate()
            self._process = None

        _LOGGER.info("Stopped audio processor")

    async def _process_loop(self):
        """Main audio processing loop."""
        try:
            while self._running:
                if not self.media_player:
                    await asyncio.sleep(1)
                    continue

                # Get audio data from media player
                audio_data = await self._get_audio_data()
                if audio_data is None:
                    await asyncio.sleep(0.1)
                    continue

                # Process audio
                self._process_audio(audio_data)

                # Notify listeners
                await self._notify_update()

                # Control processing rate
                await asyncio.sleep(1 / 30)  # 30 fps target

        except asyncio.CancelledError:
            _LOGGER.debug("Audio processing loop cancelled")
            raise
        except Exception as err:
            _LOGGER.error(
                "Error in audio processing loop: %s",
                err,
                exc_info=True
            )

    async def _get_stream_url(self) -> Optional[str]:
        """Get the audio stream URL from the media player."""
        if not self.media_player:
            return None

        state = self.hass.states.get(self.media_player)
        if not state or state.state != "playing":
            return None

        # Handle different media player types
        domain = self.media_player.split(".")[0]

        if domain == "spotify":
            return await self._get_spotify_stream(state)

        # Try to get direct stream URL from attributes
        content_id = state.attributes.get(ATTR_MEDIA_CONTENT_ID)
        content_type = state.attributes.get(ATTR_MEDIA_CONTENT_TYPE)

        if content_id and content_type in (
            MediaType.MUSIC,
            MediaType.PLAYLIST
        ):
            return content_id

        return None

    async def _get_spotify_stream(self, state) -> Optional[str]:
        """Get audio stream from Spotify."""
        try:
            spotify = self.hass.data.get("spotify")
            if not spotify:
                return None

            track_id = state.attributes.get(ATTR_MEDIA_CONTENT_ID)
            if not track_id:
                return None

            # Get preview URL from Spotify API
            track = await spotify.async_get_track(track_id)
            if not track:
                return None

            preview_url = track.get("preview_url")
            if preview_url:
                return preview_url

            return None

        except Exception as err:
            _LOGGER.error("Error getting Spotify stream: %s", err)
            return None

    async def _get_audio_data(self) -> Optional[np.ndarray]:
        """Get audio data from the current media player."""
        if not self.media_player:
            return None

        try:
            stream_url = await self._get_stream_url()
            if not stream_url:
                return None

            # Initialize FFmpeg process if needed
            if not self._process:
                command = [
                    "ffmpeg",
                    "-i", stream_url,
                    "-f", "f32le",  # 32-bit float PCM
                    "-acodec", "pcm_f32le",
                    "-ac", "1",  # mono
                    "-ar", str(SAMPLE_RATE),
                    "-"  # output to pipe
                ]

                self._process = subprocess.Popen(
                    command,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    bufsize=CHUNK_SIZE * 4  # 4 bytes per float
                )

            # Read audio chunk
            raw_data = self._process.stdout.read(CHUNK_SIZE * 4)
            if not raw_data:
                self._process = None
                return None

            # Convert to numpy array
            audio_data = np.frombuffer(raw_data, dtype=np.float32)

            # Handle potential size mismatch
            if len(audio_data) < CHUNK_SIZE:
                audio_data = np.pad(
                    audio_data,
                    (0, CHUNK_SIZE - len(audio_data))
                )
            elif len(audio_data) > CHUNK_SIZE:
                audio_data = audio_data[:CHUNK_SIZE]

            return audio_data

        except Exception as err:
            _LOGGER.error("Error getting audio data: %s", err)
            if self._process:
                self._process.terminate()
                self._process = None
            return None

    def _process_audio(self, audio_data: np.ndarray):
        """Process audio data to extract features."""
        # Apply window function
        windowed = audio_data * np.hanning(len(audio_data))

        # Compute FFT
        fft = np.abs(np.fft.rfft(windowed))
        fft = fft / len(fft)

        # Calculate frequency bands
        for i in range(NUM_BANDS):
            start, end = self._band_indices[i], self._band_indices[i + 1]
            self._freq_bands[i] = np.mean(fft[start:end])

        # Normalize frequency bands
        max_freq = np.max(self._freq_bands)
        if max_freq > 0:
            self._freq_bands = self._freq_bands / max_freq
        else:
            self._freq_bands = np.zeros_like(self._freq_bands)

        # Calculate waveform
        self._waveform = np.interp(
            np.linspace(0, len(audio_data), NUM_BANDS),
            np.arange(len(audio_data)),
            audio_data
        )

        # Update energy and beat detection
        self._update_energy()
        self._detect_beat()
        self._update_tempo()

    def _update_energy(self):
        """Update energy levels."""
        # Calculate current energy (focus on bass frequencies)
        current_energy = float(
            np.mean(self._freq_bands[:8])  # Lower frequency bands
        )

        # Smooth energy
        self._energy = (
            ENERGY_SMOOTH * current_energy +
            (1 - ENERGY_SMOOTH) * self._energy
        )

        # Update history
        self._energy_history = np.roll(self._energy_history, 1)
        self._energy_history[0] = current_energy

    def _detect_beat(self):
        """Detect beats in the audio."""
        # Calculate local energy average
        local_average = float(np.mean(self._energy_history))
        local_variance = float(np.var(self._energy_history))

        # Beat detection
        beat_energy = float(np.mean(self._freq_bands[:4]))  # Focus on bass
        threshold = local_average + BEAT_THRESHOLD * local_variance

        self._is_beat = bool(beat_energy > threshold)

        if self._is_beat:
            current_time = asyncio.get_event_loop().time()
            if self._last_beat_time > 0:
                beat_time = current_time - self._last_beat_time
                if 0.2 < beat_time < 2.0:  # 30-300 BPM range
                    instant_tempo = 60.0 / beat_time
                    self._tempo = (
                        TEMPO_SMOOTH * instant_tempo +
                        (1 - TEMPO_SMOOTH) * self._tempo
                    )
            self._last_beat_time = current_time

    def _update_tempo(self):
        """Update tempo estimation."""
        if self._tempo > 0:
            self._tempo_history = np.roll(self._tempo_history, 1)
            self._tempo_history[0] = self._tempo
            # Use median for stability
            self._tempo = float(np.median(self._tempo_history))

    async def _notify_update(self):
        """Notify visualization of new audio data."""
        try:
            # Create update event
            event_data = {
                "frequencies": self._freq_bands.tolist(),
                "waveform": self._waveform.tolist(),
                "energy": float(self._energy),
                "beat": bool(self._is_beat),
                "tempo": float(self._tempo)
            }

            # Fire event
            self.hass.bus.async_fire(
                "aurora_audio_update",
                event_data
            )

        except Exception as err:
            _LOGGER.error("Error notifying update: %s", err)
