# Creating and Managing Effects

This guide explains how to use, customize, and create effects in Aurora Sound to Light.

## Built-in Effects

### Bass Pulse
- Reacts to low-frequency sounds
- Pulses lights in sync with bass beats
- Customizable:
  - Intensity
  - Color scheme
  - Decay rate
  - Threshold

### Color Wave
- Creates flowing color patterns
- Responds to frequency ranges
- Adjustable:
  - Wave speed
  - Color gradient
  - Direction
  - Spread

### Frequency Sweep
- Maps frequencies to different lights
- Creates dynamic color patterns
- Configure:
  - Frequency bands
  - Color mapping
  - Sweep speed
  - Response curve

### Rainbow Flow
- Smooth color transitions
- Beat-synchronized movement
- Settings:
  - Flow speed
  - Color saturation
  - Direction
  - Beat sync mode

### Strobe Sync
- Beat-synchronized flashing
- Multi-color patterns
- Options:
  - Flash duration
  - Color sequence
  - Beat multiplier
  - Safety limits

## Customizing Effects

### Basic Parameters

1. **Intensity**
   - Controls effect strength
   - Adjusts sensitivity
   - Range: 0-100%

2. **Speed**
   - Effect animation rate
   - Transition timing
   - Beat synchronization

3. **Colors**
   - Primary/Secondary colors
   - Gradient settings
   - Color temperature
   - RGB/HSV controls

4. **Audio Response**
   - Frequency sensitivity
   - Beat detection threshold
   - Response curve
   - Decay rate

### Advanced Settings

1. **Blending**
   - Effect combination modes
   - Transition types
   - Layer ordering
   - Opacity control

2. **Timing**
   - Animation curves
   - Phase offset
   - Delay settings
   - Loop behavior

3. **Zones**
   - Spatial mapping
   - Group behavior
   - Propagation settings
   - Direction control

## Creating Custom Effects

### Effect Creator Interface

1. **Base Template**
   - Choose starting point
   - Select effect type
   - Set basic parameters

2. **Audio Mapping**
   - Define frequency ranges
   - Set trigger conditions
   - Configure response curves

3. **Animation Editor**
   - Create keyframes
   - Set transitions
   - Define behaviors
   - Test and preview

### Programming Custom Effects

```javascript
// Example effect definition
{
  name: "Custom Wave",
  type: "frequency",
  parameters: {
    sensitivity: 0.8,
    colorGradient: ["#FF0000", "#00FF00", "#0000FF"],
    speedFactor: 1.5,
    waveform: "sine"
  },
  triggers: {
    bass: { range: [20, 150], threshold: 0.6 },
    mid: { range: [150, 1000], threshold: 0.4 },
    high: { range: [1000, 8000], threshold: 0.3 }
  }
}
```

### Best Practices

1. **Performance**
   - Use efficient animations
   - Limit complexity
   - Test with various inputs
   - Monitor resource usage

2. **User Experience**
   - Create smooth transitions
   - Avoid jarring changes
   - Maintain visual comfort
   - Consider ambient lighting

3. **Reliability**
   - Handle edge cases
   - Implement fallbacks
   - Validate parameters
   - Test thoroughly

## Effect Combinations

### Blending Modes

1. **Additive**
   - Combines light values
   - Brightens overall effect
   - Good for layering

2. **Multiply**
   - Darkens overlapping areas
   - Creates depth
   - Useful for shadows

3. **Screen**
   - Lightens overlapping areas
   - Good for bright effects
   - Preserves highlights

### Transition Types

1. **Crossfade**
   - Smooth blending
   - Adjustable duration
   - Linear or curved

2. **Morph**
   - Shape-based transition
   - Parameter interpolation
   - Complex animations

3. **Jump Cut**
   - Instant changes
   - Beat-synchronized
   - Pattern breaks

## Saving and Sharing

### Effect Presets

1. **Saving**
   - Name your effect
   - Set categories
   - Add descriptions
   - Include preview

2. **Organization**
   - Create folders
   - Use tags
   - Set favorites
   - Order by usage

3. **Sharing**
   - Export settings
   - Share codes
   - Community library
   - Version control

## Troubleshooting

### Common Issues

1. **Performance**
   - Reduce complexity
   - Lower update rate
   - Optimize parameters
   - Check CPU usage

2. **Visual**
   - Check timing
   - Verify colors
   - Test transitions
   - Validate zones

3. **Audio Response**
   - Calibrate input
   - Adjust sensitivity
   - Check triggers
   - Test with various sources

## Resources

- [Effect API Documentation](../api/effects.md)
- [Performance Guide](performance.md)
- [Community Effects](https://github.com/yourusername/aurora-sound-to-light/wiki/Community-Effects)
- [Video Tutorials](https://youtube.com/your-channel) 