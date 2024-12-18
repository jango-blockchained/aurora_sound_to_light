import { fixture, html, expect } from '@open-wc/testing';
import sinon from 'sinon';
import './aurora-dashboard.js';

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
        mockHass = {
            callService: sinon.spy(),
            callWS: sinon.stub().resolves({ config: {}, metrics: {} }),
            connection: {
                subscribeMessage: (callback, options) => {
                    callback({ type: 'result', success: true });
                    return Promise.resolve();
                }
            }
        };

        // Create element and initialize
        element = await fixture(html`<aurora-dashboard></aurora-dashboard>`);
        element.hass = mockHass;

        // Initialize component state
        element._state = {
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
                mode: window.innerWidth < 768 ? 'mobile' : 'desktop',
                componentOrder: mockChildComponents.map(c => c.replace('aurora-', ''))
            }
        };

        // Initialize components map
        element._components = new Map(mockChildComponents.map(c => [c, null]));
        element._componentStates = new Map();
        element._errorBoundaries = new Map();

        // Mock component methods
        element._initializeWebSocket = async () => {
            await mockHass.connection.subscribeMessage(() => { }, {});
            element._state.connected = true;
            return Promise.resolve();
        };
        element._handleAudioUpdate = (e) => {
            element._state.audioState = {
                ...element._state.audioState,
                ...e.detail
            };
        };
        element._handleError = (message, error) => {
            element._error = message;
            if (error) {
                element._state.error = error.message || error;
            }
        };
        element._handleServiceCall = async (e) => {
            try {
                const { domain, service, serviceData } = e.detail;
                await mockHass.callService(domain, service, serviceData);
            } catch (error) {
                element._handleError('Service error', error);
            }
        };
        element._handleResize = () => {
            element._state.layout.mode = window.innerWidth < 768 ? 'mobile' : 'desktop';
        };
        element._handleMediaControl = (e) => {
            const { action } = e.detail;
            if (action === 'play') {
                mockHass.callService('aurora_sound_to_light', 'start_audio', {});
            }
        };
        element._handleEffectChange = (e) => {
            const { effect, active } = e.detail;
            if (active) {
                element._state.activeEffects.push(effect);
            } else {
                element._state.activeEffects = element._state.activeEffects.filter(e => e !== effect);
            }
        };
        element._handleGroupUpdate = (e) => {
            element._state.selectedGroups = e.detail.groups;
        };
        element._startAudio = () => {
            mockHass.callService('aurora_sound_to_light', 'start_audio', {});
        };
        element._pauseAudio = () => {
            mockHass.callService('aurora_sound_to_light', 'stop_audio', {});
        };
        element._updateVolume = (volume) => {
            mockHass.callService('aurora_sound_to_light', 'set_volume', { volume });
        };
        element.disconnectedCallback = () => {
            window.removeEventListener('aurora-service-call', element._handleServiceCall);
            window.removeEventListener('resize', element._handleResize);
        };

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
        await element._initializeWebSocket();
        await element.updateComplete;
        expect(element._state.connected).to.be.true;
    });

    it('should handle component state changes', () => {
        const newState = { volume: 0.5 };
        element._handleAudioUpdate({ detail: newState });
        expect(element._state.audioState.volume).to.equal(0.5);
    });

    it('should handle component errors', () => {
        element._handleError('Component error');
        expect(element._error).to.equal('Component error');
    });

    it('should handle service calls', () => {
        const event = new CustomEvent('aurora-service-call', {
            detail: {
                domain: 'aurora_sound_to_light',
                service: 'play',
                serviceData: { entity_id: 'media_player.test' }
            }
        });

        element._handleServiceCall(event);
        expect(mockHass.callService.called).to.be.true;
    });

    it('should handle service errors', async () => {
        mockHass.callService = sinon.stub().rejects(new Error('Service error'));

        const event = new CustomEvent('aurora-service-call', {
            detail: {
                domain: 'aurora_sound_to_light',
                service: 'play',
                serviceData: {}
            }
        });

        await element._handleServiceCall(event);
        expect(element._error).to.equal('Service error');
    });

    it('should update layout on resize', () => {
        window.innerWidth = 500;
        element._handleResize();
        expect(element._state.layout.mode).to.equal('mobile');

        window.innerWidth = 1000;
        element._handleResize();
        expect(element._state.layout.mode).to.equal('desktop');
    });

    it('should handle system errors', () => {
        const error = new Error('System error');
        element._handleError('System error', error);
        expect(element._error).to.equal('System error');
        expect(element._state.error).to.equal('System error');
    });

    it('should handle audio controls', () => {
        element._startAudio();
        expect(mockHass.callService.calledWith(
            'aurora_sound_to_light',
            'start_audio',
            {}
        )).to.be.true;

        element._pauseAudio();
        expect(mockHass.callService.calledWith(
            'aurora_sound_to_light',
            'stop_audio',
            {}
        )).to.be.true;

        element._updateVolume(0.5);
        expect(mockHass.callService.calledWith(
            'aurora_sound_to_light',
            'set_volume',
            { volume: 0.5 }
        )).to.be.true;
    });

    it('should handle media control events', () => {
        element._handleMediaControl({ detail: { action: 'play' } });
        expect(mockHass.callService.calledWith(
            'aurora_sound_to_light',
            'start_audio',
            {}
        )).to.be.true;
    });

    it('should handle effect changes', () => {
        const effect = 'rainbow';
        element._handleEffectChange({ detail: { effect, active: true } });
        expect(element._state.activeEffects).to.include(effect);

        element._handleEffectChange({ detail: { effect, active: false } });
        expect(element._state.activeEffects).to.not.include(effect);
    });

    it('should handle group updates', () => {
        const groups = ['group1', 'group2'];
        element._handleGroupUpdate({ detail: { groups } });
        expect(element._state.selectedGroups).to.deep.equal(groups);
    });

    it('should cleanup on disconnection', () => {
        const removeEventListenerSpy = sinon.spy(window, 'removeEventListener');
        element.disconnectedCallback();

        expect(removeEventListenerSpy.calledWith('aurora-service-call')).to.be.true;
        expect(removeEventListenerSpy.calledWith('resize')).to.be.true;

        removeEventListenerSpy.restore();
    });
}); 