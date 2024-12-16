import { fixture, html, expect } from '@open-wc/testing';
import { testUtils } from '../setup/setup.js';
import '../../../frontend/aurora-dashboard.js';

describe('AuroraDashboard', () => {
    let element;
    let mockHass;

    const mockChildComponents = [
        'aurora-media-controls',
        'aurora-visualizer',
        'aurora-effect-selector',
        'aurora-group-manager',
        'aurora-performance-monitor'
    ];

    beforeEach(async () => {
        // Mock Home Assistant connection
        mockHass = testUtils.createMockHass();

        element = await fixture(html`<aurora-dashboard></aurora-dashboard>`);
        element.hass = mockHass;
        await element.updateComplete;
    });

    it('should initialize with default state', () => {
        expect(element._state).to.deep.equal({
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
                memoryUsage: 0,
                audioBufferHealth: 100,
                systemStatus: 'good'
            },
            layout: {
                mode: element._state.layout.mode,
                componentOrder: element._state.layout.componentOrder
            }
        });
    });

    it('should register child components', () => {
        mockChildComponents.forEach(component => {
            expect(element._components.has(component)).to.be.true;
        });
    });

    it('should handle WebSocket connection', async () => {
        await element.initializeWebSocket();
        expect(element._state.connected).to.be.true;
    });

    it('should handle component state changes', async () => {
        const componentName = 'aurora-media-controls';
        const newState = { volume: 0.5 };

        await element.handleComponentStateChange(componentName, newState);
        expect(element._componentStates.get(componentName)).to.deep.equal(newState);
    });

    it('should handle component errors', () => {
        const error = new Error('Component error');
        element.handleComponentError('aurora-visualizer', error);

        expect(element._errorBoundaries.get('aurora-visualizer')).to.exist;
        expect(element._errorBoundaries.get('aurora-visualizer').error).to.equal(error);
    });

    it('should handle service calls', async () => {
        const serviceSpy = sinon.spy(mockHass, 'callService');
        await element.handleAudioPlay({ entity_id: 'media_player.test' });

        expect(serviceSpy.calledWith(
            'aurora_sound_to_light',
            'play',
            sinon.match.object
        )).to.be.true;
    });

    it('should handle service errors', async () => {
        mockHass.callService = async () => {
            throw new Error('Service error');
        };

        await element.handleAudioPlay({});
        expect(element._state.error).to.exist;
        expect(element._state.error.type).to.equal('service');
    });

    it('should update layout on resize', () => {
        // Test mobile layout
        element.updateLayout(500);
        expect(element._state.layout.mode).to.equal('mobile');

        // Test desktop layout
        element.updateLayout(1000);
        expect(element._state.layout.mode).to.equal('desktop');
    });

    it('should handle system errors', () => {
        const error = new Error('System error');
        element.handleError({ type: 'system', error });

        expect(element._state.error).to.exist;
        expect(element._state.error.type).to.equal('system');
    });

    it('should have proper ARIA attributes', () => {
        const dashboard = element.shadowRoot.querySelector('.dashboard');
        expect(dashboard.getAttribute('role')).to.equal('main');
    });
}); 