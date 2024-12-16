import { fixture, html, expect } from '@open-wc/testing';
import '../aurora-media-controls.js';

describe('AuroraMediaControls', () => {
    let element;
    let mockHass;

    beforeEach(async () => {
        mockHass = {
            callService: jest.fn(),
            callWS: jest.fn(),
            states: {
                'media_player.test': {
                    state: 'playing',
                    attributes: {
                        volume_level: 0.5,
                        media_title: 'Test Track',
                        media_artist: 'Test Artist'
                    }
                }
            }
        };

        element = await fixture(html`<aurora-media-controls></aurora-media-controls>`);
        element.hass = mockHass;
        await element.updateComplete;
    });

    describe('Initialization', () => {
        test('should initialize with default values', () => {
            expect(element.volume).toBe(1.0);
            expect(element.inputSource).toBe('media_player');
            expect(element.selectedPlayer).toBe(null);
            expect(element.isPlaying).toBe(false);
        });

        test('should render all control elements', () => {
            const controls = element.shadowRoot.querySelector('.media-controls');
            expect(controls).toBeTruthy();
            expect(controls.querySelector('.volume-slider')).toBeTruthy();
            expect(controls.querySelector('.source-selector')).toBeTruthy();
            expect(controls.querySelector('.player-selector')).toBeTruthy();
        });
    });

    describe('Media Player Controls', () => {
        test('should toggle play/pause', async () => {
            const playButton = element.shadowRoot.querySelector('.play-button');
            await playButton.click();

            expect(mockHass.callService).toHaveBeenCalledWith(
                'media_player',
                'media_play',
                { entity_id: element.selectedPlayer }
            );

            element.isPlaying = true;
            await element.updateComplete;
            await playButton.click();

            expect(mockHass.callService).toHaveBeenCalledWith(
                'media_player',
                'media_pause',
                { entity_id: element.selectedPlayer }
            );
        });

        test('should update volume', async () => {
            const volumeSlider = element.shadowRoot.querySelector('.volume-slider');
            volumeSlider.value = 0.7;
            volumeSlider.dispatchEvent(new Event('change'));

            expect(mockHass.callService).toHaveBeenCalledWith(
                'media_player',
                'volume_set',
                {
                    entity_id: element.selectedPlayer,
                    volume_level: 0.7
                }
            );
        });

        test('should switch input source', async () => {
            const sourceSelector = element.shadowRoot.querySelector('.source-selector');
            sourceSelector.value = 'microphone';
            sourceSelector.dispatchEvent(new Event('change'));

            expect(element.inputSource).toBe('microphone');
            expect(element.dispatchEvent).toHaveBeenCalledWith(
                new CustomEvent('input-source-changed', {
                    detail: { source: 'microphone' },
                    bubbles: true,
                    composed: true
                })
            );
        });
    });

    describe('Microphone Input', () => {
        beforeEach(async () => {
            element.inputSource = 'microphone';
            await element.updateComplete;
        });

        test('should show gain control when microphone is selected', () => {
            const gainControl = element.shadowRoot.querySelector('.gain-control');
            expect(gainControl).toBeTruthy();
            expect(gainControl).not.toHaveClass('hidden');
        });

        test('should adjust microphone gain', async () => {
            const gainSlider = element.shadowRoot.querySelector('.gain-slider');
            gainSlider.value = 1.5;
            gainSlider.dispatchEvent(new Event('change'));

            expect(element.microphoneGain).toBe(1.5);
            expect(element.dispatchEvent).toHaveBeenCalledWith(
                new CustomEvent('gain-changed', {
                    detail: { gain: 1.5 },
                    bubbles: true,
                    composed: true
                })
            );
        });
    });

    describe('Buffer Size Control', () => {
        test('should adjust buffer size', async () => {
            const bufferSlider = element.shadowRoot.querySelector('.buffer-slider');
            bufferSlider.value = 150;
            bufferSlider.dispatchEvent(new Event('change'));

            expect(element.bufferSize).toBe(150);
            expect(element.dispatchEvent).toHaveBeenCalledWith(
                new CustomEvent('buffer-size-changed', {
                    detail: { size: 150 },
                    bubbles: true,
                    composed: true
                })
            );
        });
    });

    describe('Track Information Display', () => {
        test('should display current track info', async () => {
            element.selectedPlayer = 'media_player.test';
            await element.updateComplete;

            const trackInfo = element.shadowRoot.querySelector('.track-info');
            expect(trackInfo.textContent).toContain('Test Track');
            expect(trackInfo.textContent).toContain('Test Artist');
        });

        test('should update track info when media changes', async () => {
            mockHass.states['media_player.test'].attributes.media_title = 'New Track';
            mockHass.states['media_player.test'].attributes.media_artist = 'New Artist';

            element.selectedPlayer = 'media_player.test';
            await element.updateComplete;

            const trackInfo = element.shadowRoot.querySelector('.track-info');
            expect(trackInfo.textContent).toContain('New Track');
            expect(trackInfo.textContent).toContain('New Artist');
        });
    });

    describe('Error Handling', () => {
        test('should handle media player errors', async () => {
            mockHass.callService.mockRejectedValue(new Error('Media player error'));

            const playButton = element.shadowRoot.querySelector('.play-button');
            await playButton.click();

            const errorMessage = element.shadowRoot.querySelector('.error-message');
            expect(errorMessage).toBeTruthy();
            expect(errorMessage.textContent).toContain('Media player error');
        });

        test('should handle microphone access errors', async () => {
            global.navigator.mediaDevices.getUserMedia = jest.fn().mockRejectedValue(
                new Error('Microphone access denied')
            );

            const sourceSelector = element.shadowRoot.querySelector('.source-selector');
            sourceSelector.value = 'microphone';
            await sourceSelector.dispatchEvent(new Event('change'));

            const errorMessage = element.shadowRoot.querySelector('.error-message');
            expect(errorMessage).toBeTruthy();
            expect(errorMessage.textContent).toContain('Microphone access denied');
        });
    });

    describe('Accessibility', () => {
        test('should have proper ARIA labels', () => {
            const controls = element.shadowRoot.querySelector('.media-controls');
            expect(controls.querySelector('.play-button')).toHaveAttribute('aria-label');
            expect(controls.querySelector('.volume-slider')).toHaveAttribute('aria-label');
            expect(controls.querySelector('.source-selector')).toHaveAttribute('aria-label');
        });

        test('should handle keyboard navigation', async () => {
            const playButton = element.shadowRoot.querySelector('.play-button');
            await playButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

            expect(mockHass.callService).toHaveBeenCalled();
        });
    });

    describe('Performance', () => {
        test('should throttle volume updates', async () => {
            const volumeSlider = element.shadowRoot.querySelector('.volume-slider');

            // Rapidly change volume multiple times
            for (let i = 0; i < 5; i++) {
                volumeSlider.value = i / 5;
                volumeSlider.dispatchEvent(new Event('input'));
            }

            // Should only call service once due to throttling
            expect(mockHass.callService).toHaveBeenCalledTimes(1);
        });
    });
}); 