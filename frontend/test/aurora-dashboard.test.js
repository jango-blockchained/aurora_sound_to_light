import { fixture, html, expect } from '@open-wc/testing';
import '../aurora-dashboard.js';

describe('AuroraDashboard', () => {
    let element;
    let mockHass;
    let mockWebSocket;
    let mockLocalStorage;

    const mockChildComponents = [
        'aurora-media-controls',
        'aurora-visualizer',
        'aurora-effect-selector',
        'aurora-group-manager',
        'aurora-performance-monitor'
    ];

    beforeEach(async () => {
        // Mock WebSocket
        mockWebSocket = {
            send: jest.fn(),
            close: jest.fn(),
            readyState: WebSocket.OPEN,
            OPEN: WebSocket.OPEN
        };
        global.WebSocket = jest.fn(() => mockWebSocket);

        // Mock localStorage
        mockLocalStorage = {
            getItem: jest.fn(),
            setItem: jest.fn(),
            removeItem: jest.fn()
        };
        global.localStorage = mockLocalStorage;

        // Mock Home Assistant connection
        mockHass = {
            callService: jest.fn(),
            callWS: jest.fn(),
            connection: {
                subscribeEvents: jest.fn(),
                addEventListener: jest.fn()
            }
        };

        element = await fixture(html`<aurora-dashboard></aurora-dashboard>`);
        element.hass = mockHass;
        await element.updateComplete;
    });

    describe('Initialization', () => {
        test('should initialize with default state', () => {
            expect(element._state).toEqual({
                connected: false,
                authenticated: false,
                error: null,
                activeEffects: [],
                audioState: {
                    inputSource: null,
                    volume: 1.0,
                    isPlaying: false
                },
                selectedGroups: [],
                performanceMetrics: {
                    latency: 0,
                    cpuUsage: 0,
                    memoryUsage: 0
                },
                layout: {
                    mode: expect.any(String),
                    componentOrder: expect.any(Array)
                }
            });
        });

        test('should load persisted state', async () => {
            const persistedState = {
                layout: { mode: 'desktop' },
                activeEffects: ['effect1']
            };
            mockLocalStorage.getItem.mockReturnValue(JSON.stringify(persistedState));

            element = await fixture(html`<aurora-dashboard></aurora-dashboard>`);
            expect(element._state.layout.mode).toBe('desktop');
            expect(element._state.activeEffects).toContain('effect1');
        });

        test('should register child components', () => {
            mockChildComponents.forEach(component => {
                expect(element._components.has(component)).toBe(true);
            });
        });
    });

    describe('WebSocket Connection', () => {
        test('should establish WebSocket connection', async () => {
            await element._initializeWebSocket();
            expect(global.WebSocket).toHaveBeenCalled();
        });

        test('should handle authentication', async () => {
            const authToken = { access_token: 'test-token', expires_at: Date.now() + 3600000 };
            mockLocalStorage.getItem.mockReturnValue(JSON.stringify(authToken));

            await element._authenticate();
            expect(mockWebSocket.send).toHaveBeenCalledWith(
                expect.stringContaining('"type":"auth"')
            );
        });

        test('should handle connection errors', async () => {
            mockWebSocket.onerror(new Error('Connection failed'));
            expect(element._state.error).toBeTruthy();
            expect(element._state.connected).toBe(false);
        });

        test('should attempt reconnection on disconnect', () => {
            jest.useFakeTimers();
            mockWebSocket.onclose({ wasClean: false });

            expect(element._reconnectAttempts).toBe(1);
            jest.advanceTimersByTime(1000);
            expect(global.WebSocket).toHaveBeenCalledTimes(2);
        });
    });

    describe('Event Bus', () => {
        test('should dispatch events to registered listeners', () => {
            const mockCallback = jest.fn();
            element._subscribeToEventBus('test-event', mockCallback);

            element._dispatchToBus('test-event', { data: 'test' });
            expect(mockCallback).toHaveBeenCalledWith(expect.objectContaining({
                type: 'test-event',
                detail: { data: 'test' }
            }));
        });

        test('should maintain event history', () => {
            element._dispatchToBus('event1', { data: 1 });
            element._dispatchToBus('event2', { data: 2 });

            expect(element._eventBus.history).toHaveLength(2);
            expect(element._eventBus.history[0].type).toBe('event2');
        });

        test('should prevent event echo', () => {
            const mockCallback = jest.fn();
            element._subscribeToEventBus('test-event', mockCallback, 'source1');

            element._dispatchToBus('test-event', { data: 'test' }, 'source1');
            expect(mockCallback).not.toHaveBeenCalled();
        });
    });

    describe('Component Management', () => {
        test('should handle component state changes', async () => {
            const componentName = 'aurora-media-controls';
            const newState = { volume: 0.5 };

            await element._handleComponentStateChange(componentName, newState);
            expect(element._componentStates.get(componentName)).toEqual(newState);
        });

        test('should handle component errors', () => {
            const error = new Error('Component error');
            element._handleComponentError('aurora-visualizer', error);

            expect(element._errorBoundaries.get('aurora-visualizer')).toBeTruthy();
            expect(element._errorBoundaries.get('aurora-visualizer').error).toBe(error);
        });

        test('should retry failed components', async () => {
            const componentName = 'aurora-effect-selector';
            element._handleComponentError(componentName, new Error('Failed'));
            await element._retryComponent(componentName);

            expect(element._errorBoundaries.get(componentName)).toBeUndefined();
        });
    });

    describe('Service Layer', () => {
        test('should initialize services', async () => {
            await element._initializeServices();
            expect(element._services.initialized).toBe(true);
        });

        test('should handle service calls', async () => {
            await element._handleAudioPlay({ entity_id: 'media_player.test' });
            expect(mockHass.callService).toHaveBeenCalledWith(
                'aurora_sound_to_light',
                'play',
                expect.any(Object)
            );
        });

        test('should handle service errors', async () => {
            mockHass.callService.mockRejectedValue(new Error('Service error'));
            await element._handleAudioPlay({});

            expect(element._state.error).toBeTruthy();
            expect(element._state.error.type).toBe('service');
        });
    });

    describe('Layout Management', () => {
        test('should update layout on resize', () => {
            const resizeObserver = new ResizeObserver(entries => {
                element._updateLayout(entries[0].contentRect.width);
            });
            resizeObserver.observe(element.shadowRoot.querySelector('.dashboard'));

            // Simulate resize
            element._updateLayout(500);
            expect(element._state.layout.mode).toBe('mobile');

            element._updateLayout(1000);
            expect(element._state.layout.mode).toBe('desktop');
        });

        test('should persist layout changes', () => {
            element._updateLayout(500);
            expect(mockLocalStorage.setItem).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        test('should handle system errors', () => {
            const error = new Error('System error');
            element._handleError({ type: 'system', error });

            expect(element._state.error).toBeTruthy();
            expect(element._state.error.type).toBe('system');
        });

        test('should handle WebSocket errors', () => {
            element._handleWebSocketError(new Error('WebSocket error'));
            expect(element._state.error).toBeTruthy();
            expect(element._state.connected).toBe(false);
        });
    });

    describe('Accessibility', () => {
        test('should have proper ARIA attributes', () => {
            const dashboard = element.shadowRoot.querySelector('.dashboard');
            expect(dashboard).toHaveAttribute('role', 'main');
        });

        test('should handle keyboard navigation', async () => {
            const firstComponent = element.shadowRoot.querySelector('.component-container');
            await firstComponent.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
            expect(element._state.selectedComponent).toBeTruthy();
        });
    });

    describe('Performance', () => {
        test('should throttle state updates', async () => {
            for (let i = 0; i < 5; i++) {
                element.setState({ someValue: i });
            }
            expect(mockLocalStorage.setItem).toHaveBeenCalledTimes(1);
        });

        test('should cleanup resources on disconnect', () => {
            element.disconnectedCallback();
            expect(mockWebSocket.close).toHaveBeenCalled();
            expect(element._persistenceInterval).toBeNull();
        });
    });

    describe('Theme Management', () => {
        test('should update theme', () => {
            element._updateTheme('dark');
            const style = getComputedStyle(element);
            expect(style.getPropertyValue('--component-bg')).toBe('#2d2d2d');
        });
    });
}); 