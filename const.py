"""Constants for the Aurora Sound to Light integration."""

DOMAIN = "aurora_sound_to_light"

# Configuration
CONF_AUDIO_INPUT = "audio_input"
CONF_MEDIA_PLAYER = "media_player"
CONF_BUFFER_SIZE = "buffer_size"
CONF_LATENCY_THRESHOLD = "latency_threshold"
CONF_LIGHT_GROUPS = "light_groups"
CONF_EFFECT_TYPE = "effect_type"
CONF_EFFECT_PARAMS = "effect_params"
CONF_LIGHTS = "lights"

# Default Values
DEFAULT_NAME = "Aurora Sound to Light"

# Audio input types
AUDIO_INPUT_MIC = "microphone"
AUDIO_INPUT_MEDIA_PLAYER = "media_player"

# Defaults
DEFAULT_BUFFER_SIZE = 100
DEFAULT_LATENCY_THRESHOLD = 50
DEFAULT_FREQUENCY_BANDS = 32
DEFAULT_UPDATE_INTERVAL = 0.05  # 50ms

# Effect Types
EFFECT_BASS_PULSE = "bass_pulse"
EFFECT_FREQUENCY_SWEEP = "frequency_sweep"
EFFECT_COLOR_WAVE = "color_wave"
EFFECT_STROBE_SYNC = "strobe_sync"
EFFECT_RAINBOW_FLOW = "rainbow_flow"

# Effect Parameters
PARAM_SENSITIVITY = "sensitivity"
PARAM_SPEED = "speed"
PARAM_COLOR = "color"
PARAM_BRIGHTNESS = "brightness"
PARAM_FREQUENCY_RANGE = "frequency_range"
PARAM_TRANSITION_TIME = "transition_time"

# Default Effect Parameters
DEFAULT_SENSITIVITY = 0.5
DEFAULT_SPEED = 1.0
DEFAULT_COLOR = [255, 255, 255]
DEFAULT_BRIGHTNESS = 255
DEFAULT_FREQUENCY_RANGE = [20, 20000]  # Hz
DEFAULT_TRANSITION_TIME = 0.1  # seconds

# Services
SERVICE_CREATE_EFFECT = "create_effect"
SERVICE_UPDATE_EFFECT = "update_effect"
SERVICE_DELETE_EFFECT = "delete_effect"
SERVICE_START_AUDIO_CAPTURE = "start_audio_capture"
SERVICE_STOP_AUDIO_CAPTURE = "stop_audio_capture"

# Effect parameters
ATTR_EFFECT_ID = "effect_id"
ATTR_EFFECT_NAME = "name"
ATTR_EFFECT_CODE = "code"
ATTR_EFFECT_PARAMETERS = "parameters"

# Light Groups
ATTR_GROUP_ID = "group_id"
ATTR_GROUP_NAME = "group_name"
ATTR_LIGHT_ENTITIES = "light_entities"
ATTR_GROUP_TYPE = "group_type"

# Group Types
GROUP_TYPE_ZONE = "zone"
GROUP_TYPE_ROOM = "room"
GROUP_TYPE_CUSTOM = "custom"

# Performance Metrics
METRIC_AUDIO_LATENCY = "audio_latency"
METRIC_LIGHT_LATENCY = "light_latency"
METRIC_CPU_USAGE = "cpu_usage"
METRIC_MEMORY_USAGE = "memory_usage"
