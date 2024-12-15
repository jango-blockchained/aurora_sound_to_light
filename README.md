Here's a detailed README.md for the Aurora Sound to Light integration:
# Aurora Sound to Light

![Aurora Banner](assets/aurora-banner.png)

Transform your smart home into an intelligent nightclub with real-time music-reactive lighting. Aurora seamlessly synchronizes your smart lights with music, creating immersive lighting experiences through advanced audio processing and intelligent light control.

[![hacs_badge](https://img.shields.io/badge/HACS-Default-orange.svg)](https://github.com/hacs/integration)
[![GitHub Release][releases-shield]][releases]
![Project Maintenance][maintenance-shield]
[![License][license-shield]](LICENSE.md)

## Features

### 🎵 Dual Audio Input
- **Microphone Input**: Use any external microphone with automatic gain control
- **Direct Media Integration**: Connect directly to Home Assistant media players
- **Advanced Processing**: Real-time FFT analysis and beat detection
- **Adjustable Buffer**: Fine-tune latency (50-200ms) for optimal performance

### 💡 Universal Light Support
- Works with all Home Assistant-supported light protocols
- Compatible with MQTT, Zigbee, Bluetooth, and WiFi devices
- Automatic protocol optimization for minimal latency
- Support for up to 100 simultaneous light devices

### ⚡ Performance Optimized
- Parallel processing architecture
- Multi-threaded light control
- Built-in latency measurement and compensation
- Real-time performance monitoring
- CPU usage < 15% on recommended hardware

### 🎨 Rich Effect Library
- Bass pulse
- Frequency sweep
- Color wave
- Strobe sync
- Rainbow flow
- Custom effect creator

### 🎯 Advanced Features
- 3D positioning support
- Dynamic zone mapping
- Music genre detection
- Automatic mode selection
- Scene management with effect blending

## Installation

### Prerequisites
- Home Assistant Core 2023.x or newer
- Python 3.9+
- FFmpeg
- Sufficient CPU resources for audio processing

### HACS Installation (Recommended)
1. Open HACS in Home Assistant
2. Click on "Integrations"
3. Click the "+" button
4. Search for "Aurora Sound to Light"
5. Click "Install"
6. Restart Home Assistant

### Manual Installation
1. Download the latest release
2. Copy the `custom_components/aurora_sound_to_light` directory to your Home Assistant's `custom_components` directory
3. Restart Home Assistant

## Configuration

### Basic Configuration
```yaml
aurora_sound_to_light:
  audio_input: microphone  # or media_player
  light_groups:
    - name: Living Room
      lights:
        - light.living_room_1
        - light.living_room_2
    - name: Kitchen
      lights:
        - light.kitchen_strip
```

### Advanced Configuration
```yaml
aurora_sound_to_light:
  audio_input: microphone
  buffer_size: 100
  latency_threshold: 50
  frequency_bands: 32
  color_preferences:
    primary: [255, 0, 0]
    secondary: [0, 0, 255]
  transition_speed: 1.5
```

## Usage

### Control Panel
Access the Aurora control panel through Home Assistant's interface to:
- View real-time frequency visualization
- Manage light groups
- Select and customize effects
- Monitor system performance
- Create and manage scenes

### Creating Custom Effects
1. Navigate to the Effect Creator in the control panel
2. Choose base effect type
3. Adjust parameters and timing
4. Test and save your creation

## Troubleshooting

### Common Issues
- **High Latency**: Adjust buffer size or check network connectivity
- **CPU Usage**: Reduce frequency bands or number of active lights
- **Audio Detection**: Check microphone permissions and placement

### Performance Optimization
- Use wired network connections when possible
- Group lights by physical location
- Adjust transition speeds for smoother effects

## Contributing
Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting pull requests.

## Support
- [Documentation](https://github.com/yourusername/aurora-sound-to-light/wiki)
- [Issue Tracker](https://github.com/yourusername/aurora-sound-to-light/issues)
- [Discord Community](https://discord.gg/yourdiscord)

## License
This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.

## Acknowledgments
- FFmpeg team for audio processing capabilities
- Home Assistant community for testing and feedback
- All contributors who have helped shape this project

[releases-shield]: https://img.shields.io/github/release/yourusername/aurora-sound-to-light.svg
[releases]: https://github.com/yourusername/aurora-sound-to-light/releases
[maintenance-shield]: https://img.shields.io/maintenance/yes/2024.svg
[license-shield]: https://img.shields.io/github/license/yourusername/aurora-sound-to-light.svg
