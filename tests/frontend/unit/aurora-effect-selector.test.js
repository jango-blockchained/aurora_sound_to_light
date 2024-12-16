import { fixture, html, expect } from '@open-wc/testing';
import '../aurora-effect-selector.js';

describe('AuroraEffectSelector', () => {
    let element;
    let mockHass;

    const mockEffects = {
        'bass-pulse': {
            name: 'Bass Pulse',
            parameters: {
                intensity: { min: 0, max: 1, default: 0.5 },
                color: { type: 'color', default: '#ff0000' }
            }
        },
        'color-wave': {
            name: 'Color Wave',
            parameters: {
                speed: { min: 0, max: 2, default: 1 },
                colors: { type: 'array', default: ['#ff0000', '#00ff00'] }
            }
        }
    };

    beforeEach(async () => {
        mockHass = {
            callService: jest.fn(),
            callWS: jest.fn().mockResolvedValue({ effects: mockEffects }),
            states: {}
        };

        element = await fixture(html`<aurora-effect-selector></aurora-effect-selector>`);
        element.hass = mockHass;
        await element.updateComplete;
    });

    describe('Initialization', () => {
        test('should load available effects', async () => {
            expect(element.effects).toEqual(mockEffects);
            expect(element.shadowRoot.querySelectorAll('.effect-card')).toHaveLength(2);
        });

        test('should initialize with default values', () => {
            expect(element.selectedEffect).toBe(null);
            expect(element.activeEffects).toEqual([]);
            expect(element.blendMode).toBe('mix');
        });
    });

    describe('Effect Selection', () => {
        test('should select effect', async () => {
            const effectCard = element.shadowRoot.querySelector('.effect-card');
            await effectCard.click();

            expect(element.selectedEffect).toBe('bass-pulse');
            expect(effectCard).toHaveClass('selected');
        });

        test('should update effect parameters', async () => {
            element.selectedEffect = 'bass-pulse';
            await element.updateComplete;

            const intensitySlider = element.shadowRoot.querySelector('[name="intensity"]');
            intensitySlider.value = 0.8;
            intensitySlider.dispatchEvent(new Event('change'));

            expect(element._effectParameters['bass-pulse'].intensity).toBe(0.8);
        });

        test('should apply effect', async () => {
            element.selectedEffect = 'bass-pulse';
            element._effectParameters['bass-pulse'] = {
                intensity: 0.8,
                color: '#ff0000'
            };

            const applyButton = element.shadowRoot.querySelector('.apply-button');
            await applyButton.click();

            expect(mockHass.callService).toHaveBeenCalledWith(
                'aurora_sound_to_light',
                'apply_effect',
                {
                    effect: 'bass-pulse',
                    parameters: {
                        intensity: 0.8,
                        color: '#ff0000'
                    }
                }
            );
        });
    });

    describe('Effect Blending', () => {
        test('should change blend mode', async () => {
            const blendSelect = element.shadowRoot.querySelector('.blend-mode-select');
            blendSelect.value = 'overlay';
            blendSelect.dispatchEvent(new Event('change'));

            expect(element.blendMode).toBe('overlay');
        });

        test('should apply blended effects', async () => {
            element.activeEffects = ['bass-pulse', 'color-wave'];
            element.blendMode = 'overlay';
            await element.updateComplete;

            const blendButton = element.shadowRoot.querySelector('.blend-button');
            await blendButton.click();

            expect(mockHass.callService).toHaveBeenCalledWith(
                'aurora_sound_to_light',
                'blend_effects',
                {
                    effects: ['bass-pulse', 'color-wave'],
                    mode: 'overlay'
                }
            );
        });
    });

    describe('Custom Effect Creation', () => {
        test('should create custom effect', async () => {
            const createButton = element.shadowRoot.querySelector('.create-effect-button');
            await createButton.click();

            const nameInput = element.shadowRoot.querySelector('.effect-name-input');
            nameInput.value = 'Custom Effect';
            nameInput.dispatchEvent(new Event('change'));

            const parameterInputs = element.shadowRoot.querySelectorAll('.parameter-input');
            parameterInputs.forEach(input => {
                input.value = input.dataset.default;
                input.dispatchEvent(new Event('change'));
            });

            const saveButton = element.shadowRoot.querySelector('.save-effect-button');
            await saveButton.click();

            expect(mockHass.callService).toHaveBeenCalledWith(
                'aurora_sound_to_light',
                'save_effect',
                {
                    name: 'Custom Effect',
                    parameters: expect.any(Object)
                }
            );
        });

        test('should validate custom effect parameters', async () => {
            element._createCustomEffect({
                name: '',
                parameters: {}
            });

            const errorMessage = element.shadowRoot.querySelector('.error-message');
            expect(errorMessage).toBeTruthy();
            expect(errorMessage.textContent).toContain('Effect name is required');
        });
    });

    describe('Preset Management', () => {
        test('should save preset', async () => {
            element.activeEffects = ['bass-pulse'];
            element._effectParameters['bass-pulse'] = {
                intensity: 0.8,
                color: '#ff0000'
            };

            const savePresetButton = element.shadowRoot.querySelector('.save-preset-button');
            await savePresetButton.click();

            const presetNameInput = element.shadowRoot.querySelector('.preset-name-input');
            presetNameInput.value = 'My Preset';
            presetNameInput.dispatchEvent(new Event('change'));

            const confirmSaveButton = element.shadowRoot.querySelector('.confirm-save-button');
            await confirmSaveButton.click();

            expect(mockHass.callService).toHaveBeenCalledWith(
                'aurora_sound_to_light',
                'save_preset',
                {
                    name: 'My Preset',
                    effects: [{
                        effect: 'bass-pulse',
                        parameters: {
                            intensity: 0.8,
                            color: '#ff0000'
                        }
                    }]
                }
            );
        });

        test('should load preset', async () => {
            const mockPreset = {
                name: 'My Preset',
                effects: [{
                    effect: 'bass-pulse',
                    parameters: {
                        intensity: 0.8,
                        color: '#ff0000'
                    }
                }]
            };

            mockHass.callWS.mockResolvedValueOnce({ preset: mockPreset });

            const loadPresetButton = element.shadowRoot.querySelector('.load-preset-button');
            await loadPresetButton.click();

            expect(element.activeEffects).toContain('bass-pulse');
            expect(element._effectParameters['bass-pulse']).toEqual({
                intensity: 0.8,
                color: '#ff0000'
            });
        });
    });

    describe('Genre-based Mode Selection', () => {
        test('should detect music genre', async () => {
            mockHass.callWS.mockResolvedValueOnce({ genre: 'electronic' });

            await element._detectGenre();
            expect(mockHass.callWS).toHaveBeenCalledWith({
                type: 'aurora_sound_to_light/detect_genre'
            });
        });

        test('should apply genre-specific effects', async () => {
            await element._applyGenreEffects('electronic');

            expect(mockHass.callService).toHaveBeenCalledWith(
                'aurora_sound_to_light',
                'apply_genre_effects',
                {
                    genre: 'electronic'
                }
            );
        });
    });

    describe('Error Handling', () => {
        test('should handle effect application errors', async () => {
            mockHass.callService.mockRejectedValue(new Error('Failed to apply effect'));

            element.selectedEffect = 'bass-pulse';
            const applyButton = element.shadowRoot.querySelector('.apply-button');
            await applyButton.click();

            const errorMessage = element.shadowRoot.querySelector('.error-message');
            expect(errorMessage).toBeTruthy();
            expect(errorMessage.textContent).toContain('Failed to apply effect');
        });

        test('should handle preset loading errors', async () => {
            mockHass.callWS.mockRejectedValue(new Error('Failed to load preset'));

            const loadPresetButton = element.shadowRoot.querySelector('.load-preset-button');
            await loadPresetButton.click();

            const errorMessage = element.shadowRoot.querySelector('.error-message');
            expect(errorMessage).toBeTruthy();
            expect(errorMessage.textContent).toContain('Failed to load preset');
        });
    });

    describe('Accessibility', () => {
        test('should have proper ARIA labels', () => {
            const effectCards = element.shadowRoot.querySelectorAll('.effect-card');
            effectCards.forEach(card => {
                expect(card).toHaveAttribute('aria-label');
                expect(card).toHaveAttribute('role', 'button');
            });
        });

        test('should handle keyboard navigation', async () => {
            const effectCard = element.shadowRoot.querySelector('.effect-card');
            await effectCard.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

            expect(element.selectedEffect).toBe('bass-pulse');
        });
    });

    describe('Performance', () => {
        test('should throttle effect parameter updates', async () => {
            element.selectedEffect = 'bass-pulse';
            await element.updateComplete;

            const intensitySlider = element.shadowRoot.querySelector('[name="intensity"]');

            // Rapidly change intensity multiple times
            for (let i = 0; i < 5; i++) {
                intensitySlider.value = i / 5;
                intensitySlider.dispatchEvent(new Event('input'));
            }

            // Should only call service once due to throttling
            expect(mockHass.callService).toHaveBeenCalledTimes(1);
        });
    });
}); 