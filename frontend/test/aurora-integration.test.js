import { fixture, html, expect, waitUntil } from '@open-wc/testing';
import '../aurora-dashboard.js';
import '../aurora-media-controls.js';
import '../aurora-visualizer.js';
import '../aurora-effect-selector.js';
import '../aurora-group-manager.js';
import '../aurora-performance-monitor.js';

describe('Aurora Component Integration', () => {
    let dashboard;
    let mediaControls;
    let visualizer;
    let effectSelector;
    let groupManager;
    let performanceMonitor;
    let mockHass;

    beforeEach(async () => {
        // Mock Home Assistant
        mockHass = {
            callService: jest.fn(),
            callWS: jest.fn(),
            connection: {
                subscribeEvents: jest.fn(),
                addEventListener: jest.fn()
            }
        };

        // Create dashboard and child components
        dashboard = await fixture(html`
            <aurora-dashboard>
                <aurora-media-controls></aurora-media-controls>
                <aurora-visualizer></aurora-visualizer>
                <aurora-effect-selector></aurora-effect-selector>
                <aurora-group-manager></aurora-group-manager>
                <aurora-performance-monitor></aurora-performance-monitor>
            </aurora-dashboard>
        `);

        dashboard.hass = mockHass;
        await dashboard.updateComplete;

        // Get references to child components
        mediaControls = dashboard.querySelector('aurora-media-controls');
        visualizer = dashboard.querySelector('aurora-visualizer');
        effectSelector = dashboard.querySelector('aurora-effect-selector');
        groupManager = dashboard.querySelector('aurora-group-manager');
        performanceMonitor = dashboard.querySelector('aurora-performance-monitor');

        // Wait for all components to be ready
        await Promise.all([
            mediaControls.updateComplete,
            visualizer.updateComplete,
            effectSelector.updateComplete,
            groupManager.updateComplete,
            performanceMonitor.updateComplete
        ]);
    });

    describe('Media Controls and Visualizer Integration', () => {
        test('should update visualizer when audio source changes', async () => {
            const audioSource = { type: 'microphone', id: 'default' };
            await mediaControls._handleSourceChange(audioSource);

            await waitUntil(() => visualizer._audioSource === audioSource);
            expect(visualizer._audioSource).toEqual(audioSource);
        });

        test('should update visualizer when volume changes', async () => {
            const volume = 0.75;
            await mediaControls._handleVolumeChange(volume);

            await waitUntil(() => visualizer._volume === volume);
            expect(visualizer._volume).toEqual(volume);
        });
    });

    describe('Effect Selector and Group Manager Integration', () => {
        test('should apply selected effect to selected group', async () => {
            const effect = { id: 'rainbow', params: { speed: 1.0 } };
            const group = { id: 'group1', lights: ['light.1', 'light.2'] };

            await groupManager._selectGroup(group);
            await effectSelector._selectEffect(effect);

            expect(mockHass.callService).toHaveBeenCalledWith(
                'aurora_sound_to_light',
                'apply_effect',
                { effect_id: effect.id, group_id: group.id, params: effect.params }
            );
        });

        test('should update effect parameters for active groups', async () => {
            const groups = [
                { id: 'group1', lights: ['light.1'] },
                { id: 'group2', lights: ['light.2'] }
            ];
            const effect = { id: 'pulse', params: { intensity: 0.8 } };

            await groupManager._selectGroups(groups);
            await effectSelector._updateEffectParams(effect);

            groups.forEach(group => {
                expect(mockHass.callService).toHaveBeenCalledWith(
                    'aurora_sound_to_light',
                    'update_effect',
                    { effect_id: effect.id, group_id: group.id, params: effect.params }
                );
            });
        });
    });

    describe('Performance Monitor Integration', () => {
        test('should track effect application latency', async () => {
            const effect = { id: 'strobe', params: { frequency: 2.0 } };
            const startTime = performance.now();

            await effectSelector._selectEffect(effect);
            const endTime = performance.now();

            await waitUntil(() => performanceMonitor._latencyData.length > 0);
            const latencyEntry = performanceMonitor._latencyData[0];
            expect(latencyEntry.duration).toBeLessThan(endTime - startTime);
        });

        test('should monitor WebSocket connection health', async () => {
            const mockWebSocketError = new Error('Connection lost');
            dashboard._handleWebSocketError(mockWebSocketError);

            await waitUntil(() => performanceMonitor._connectionStatus === 'error');
            expect(performanceMonitor._connectionStatus).toBe('error');
            expect(performanceMonitor._errors).toContain(mockWebSocketError);
        });
    });

    describe('Event Bus Communication', () => {
        test('should propagate state changes across components', async () => {
            const state = {
                audioState: { inputSource: 'microphone', volume: 0.8 },
                activeEffect: { id: 'wave', params: {} },
                selectedGroups: ['group1']
            };

            dashboard._dispatchToBus('state_update', state);

            await waitUntil(() => {
                return mediaControls._state.volume === state.audioState.volume &&
                    effectSelector._activeEffect.id === state.activeEffect.id &&
                    groupManager._selectedGroups.includes(state.selectedGroups[0]);
            });

            expect(mediaControls._state.volume).toBe(state.audioState.volume);
            expect(effectSelector._activeEffect.id).toBe(state.activeEffect.id);
            expect(groupManager._selectedGroups).toContain(state.selectedGroups[0]);
        });

        test('should handle concurrent state updates', async () => {
            const updates = [
                { type: 'volume', value: 0.7 },
                { type: 'effect', value: { id: 'pulse' } },
                { type: 'group', value: 'group2' }
            ];

            const promises = updates.map(update =>
                dashboard._dispatchToBus(`${update.type}_update`, update.value)
            );

            await Promise.all(promises);

            expect(mediaControls._state.volume).toBe(0.7);
            expect(effectSelector._activeEffect.id).toBe('pulse');
            expect(groupManager._selectedGroups).toContain('group2');
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle component initialization failures', async () => {
            const mockError = new Error('Initialization failed');
            visualizer._handleError(mockError);

            expect(dashboard._errorBoundaries.get('aurora-visualizer')).toBeTruthy();
            expect(performanceMonitor._errors).toContain(mockError);
        });

        test('should recover from component errors', async () => {
            const componentName = 'aurora-effect-selector';
            dashboard._handleComponentError(componentName, new Error('Failed'));
            await dashboard._retryComponent(componentName);

            expect(dashboard._errorBoundaries.get(componentName)).toBeUndefined();
            expect(effectSelector._state.error).toBeNull();
        });
    });

    describe('Performance Optimization', () => {
        test('should throttle rapid state updates', async () => {
            const updateCount = 10;
            const updates = Array.from({ length: updateCount }, (_, i) => ({
                volume: i / updateCount
            }));

            updates.forEach(update => {
                mediaControls._handleVolumeChange(update.volume);
            });

            // Wait for throttled updates to complete
            await new Promise(resolve => setTimeout(resolve, 100));

            // Should have fewer actual updates than requested
            expect(mockHass.callService.mock.calls.length).toBeLessThan(updateCount);
        });

        test('should batch light state updates', async () => {
            const groups = Array.from({ length: 5 }, (_, i) => ({
                id: `group${i}`,
                lights: [`light.${i}`]
            }));

            await groupManager._updateGroups(groups);
            const effect = { id: 'rainbow', params: { speed: 1.0 } };
            await effectSelector._selectEffect(effect);

            // Should use a single batch update instead of individual calls
            expect(mockHass.callService).toHaveBeenCalledWith(
                'aurora_sound_to_light',
                'batch_update',
                expect.any(Object)
            );
        });
    });
}); 