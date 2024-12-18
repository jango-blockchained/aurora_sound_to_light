# Basic Configuration Guide

This guide covers the essential configuration options for Aurora Sound to Light.

## Initial Setup

### YAML Configuration

```yaml
# Basic configuration in configuration.yaml
aurora_sound_to_light:
  # Required settings
  audio_input: microphone  # or media_player
  light_groups:
    living_room:
      name: "Living Room"
      lights:
        - light.living_room_1
        - light.living_room_2
    bedroom:
      name: "Bedroom"
      lights:
        - light.bedroom_strip
        - light.bedroom_lamp

  # Optional basic settings
  default_effect: bass_pulse
  transition_time: 100  # milliseconds
  brightness_limit: 255
  color_temp_range: [2000, 6500]
```

### UI Configuration

1. **Integration Setup**
   - Navigate to Configuration → Integrations
   - Click "+" to add integration
   - Search for "Aurora Sound to Light"
   - Follow the setup wizard

2. **Basic Options**
   - Choose audio input source
   - Select light entities
   - Create initial groups
   - Set default effect

## Audio Configuration

### Microphone Input

```yaml
aurora_sound_to_light:
  audio_input: microphone
  audio_settings:
    device: default  # or specific device name
    sample_rate: 44100
    channels: 1
    gain: 1.0
```

### Media Player Input

```yaml
aurora_sound_to_light:
  audio_input: media_player
  audio_settings:
    entity_id: media_player.spotify
    buffer_size: 1024
```

## Light Groups

### Basic Group Structure

```yaml
light_groups:
  group_id:
    name: "Display Name"
    lights:
      - light.entity_1
      - light.entity_2
    default_effect: rainbow_flow  # optional
    transition_time: 200  # optional
```

### Multiple Groups

```yaml
light_groups:
  living_room:
    name: "Living Room"
    lights:
      - light.living_room_ceiling
      - light.living_room_lamp
  
  kitchen:
    name: "Kitchen"
    lights:
      - light.kitchen_spots
      - light.kitchen_strip
```

## Effect Settings

### Default Effect

```yaml
aurora_sound_to_light:
  default_effect: bass_pulse
  effect_settings:
    intensity: 0.8
    color_mode: rgb
    transition_time: 100
```

### Basic Effects List

```yaml
effects:
  - name: bass_pulse
    enabled: true
    default_params:
      sensitivity: 0.7
      color: [255, 0, 0]
  
  - name: rainbow_flow
    enabled: true
    default_params:
      speed: 1.0
      saturation: 1.0
```

## Color Settings

### Basic Color Configuration

```yaml
aurora_sound_to_light:
  color_settings:
    primary_color: [255, 0, 0]
    secondary_color: [0, 0, 255]
    color_temp_range: [2000, 6500]
    brightness_range: [0, 255]
```

### Color Presets

```yaml
color_presets:
  party:
    - [255, 0, 0]
    - [0, 255, 0]
    - [0, 0, 255]
  
  calm:
    - [255, 200, 100]
    - [200, 255, 150]
```

## Performance Settings

### Basic Optimization

```yaml
aurora_sound_to_light:
  performance:
    buffer_size: 1024
    update_rate: 30  # fps
    transition_time: 100
    max_lights: 20
```

## Integration with Home Assistant

### Basic Automations

```yaml
automation:
  - alias: "Start Party Mode"
    trigger:
      platform: state
      entity_id: input_boolean.party_mode
      to: "on"
    action:
      service: aurora_sound_to_light.set_effect
      data:
        effect: rainbow_flow
        groups: ["living_room", "kitchen"]
```

### Scene Integration

```yaml
scene:
  - name: "Movie Night"
    entities:
      light.living_room_all:
        state: on
        effect: bass_pulse
        effect_settings:
          intensity: 0.5
          color: [0, 0, 255]
```

## Basic UI Configuration

### Lovelace Card

```yaml
type: custom:aurora-card
entity: light.living_room_group
show_controls: true
show_visualizer: true
```

## Next Steps

After completing the basic configuration:

1. Test your setup:
   - Verify audio input
   - Check light responses
   - Try different effects

2. Explore advanced features:
   - Custom effects
   - Advanced grouping
   - Scene creation

3. Optimize performance:
   - Monitor system resources
   - Adjust buffer sizes
   - Fine-tune transitions

## Common Settings Reference

### Audio Settings

```yaml
audio_settings:
  sample_rate: 44100  # Hz
  channels: 1         # mono
  buffer_size: 1024   # samples
  gain: 1.0          # input gain
```

### Light Settings

```yaml
light_settings:
  transition_time: 100    # ms
  brightness_limit: 255   # max brightness
  color_mode: rgb        # or hs, xy
  smooth_steps: 10       # transition steps
```

### Effect Settings

```yaml
effect_settings:
  intensity: 0.8         # effect strength
  speed: 1.0            # animation speed
  sensitivity: 0.7      # audio sensitivity
  color_blend: true     # enable color blending
```

## Troubleshooting Basic Configuration

1. **Audio Issues**
   - Check device permissions
   - Verify input levels
   - Test with different sources

2. **Light Issues**
   - Verify entity IDs
   - Check light capabilities
   - Test manual control

3. **Effect Issues**
   - Start with default effects
   - Verify audio processing
   - Check transition settings

## Getting Help

- Check the [Troubleshooting Guide](../troubleshooting/common-issues.md)
- Join our [Discord Community](https://discord.gg/yourdiscord)
- Review [Advanced Configuration](advanced.md) for more options 