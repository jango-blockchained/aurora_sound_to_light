import { expect } from '@open-wc/testing';
import { fixture, html } from '@open-wc/testing-helpers';
import sinon from 'sinon';

describe('Aurora Sound to Light - E2E Tests', () => {
    let container;
    let mockHass;
    let audioContext;
    let mediaStream;

    beforeEach(async () => {
        // Mock Home Assistant connection
        mockHass = {
            callService: sinon.stub(),
            callWS: sinon.stub(),
            connection: {
                subscribeEvents: sinon.stub(),
            },
            states: {
                'media_player.test': {
                    state: 'playing',
                    attributes: {
                        friendly_name: 'Test Player',
                        volume_level: 0.5
                    }
                },
                'light.test': {
                    state: 'on',
                    attributes: {
                        friendly_name: 'Test Light',
                        brightness: 255
                    }
                }
            }
        };

        // Mock AudioContext
        audioContext = {
            createAnalyser: () => ({
                connect: sinon.stub(),
                disconnect: sinon.stub(),
                fftSize: 2048,
                frequencyBinCount: 1024,
                getByteFrequencyData: sinon.stub(),
                getByteTimeDomainData: sinon.stub()
            }),
            createMediaStreamSource: sinon.stub(),
            resume: sinon.stub().resolves(),
            state: 'running'
        };

        // Mock MediaStream
        mediaStream = {
            getTracks: () => [{
                stop: sinon.stub()
            }]
        };

        window.AudioContext = function () {
            return audioContext;
        };

        // Create test container
        container = await fixture(html`
            <div id="app-container">
                <aurora-dashboard .hass=${mockHass}></aurora-dashboard>
            </div>
        `);
    });

    afterEach(() => {
        sinon.restore();
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    it('should initialize all core components', async () => {
        const dashboard = container.querySelector('aurora-dashboard');
        expect(dashboard).to.exist;

        const visualizer = dashboard.shadowRoot.querySelector('aurora-visualizer');
        expect(visualizer).to.exist;

        const mediaControls = dashboard.shadowRoot.querySelector('aurora-media-controls');
        expect(mediaControls).to.exist;

        const effectSelector = dashboard.shadowRoot.querySelector('aurora-effect-selector');
        expect(effectSelector).to.exist;
    });

    it('should handle media player selection and audio processing', async () => {
        const mediaControls = container.querySelector('aurora-media-controls');
        const selectEvent = new CustomEvent('media-selected', {
            detail: { entityId: 'media_player.test' }
        });

        mediaControls.dispatchEvent(selectEvent);

        expect(mockHass.callService.calledWith(
            'aurora_sound_to_light',
            'set_media_player',
            { entity_id: 'media_player.test' }
        )).to.be.true;
    });

    it('should apply and control light effects', async () => {
        const effectSelector = container.querySelector('aurora-effect-selector');
        const effectEvent = new CustomEvent('effect-selected', {
            detail: {
                effectId: 'test_effect',
                parameters: { intensity: 0.8 }
            }
        });

        effectSelector.dispatchEvent(effectEvent);

        expect(mockHass.callService.calledWith(
            'aurora_sound_to_light',
            'set_effect',
            {
                effect_id: 'test_effect',
                parameters: { intensity: 0.8 }
            }
        )).to.be.true;
    });

    it('should handle system performance monitoring', async () => {
        const performanceMonitor = container.querySelector('aurora-performance-monitor');
        mockHass.callWS.withArgs({
            type: 'aurora_sound_to_light/get_performance_metrics'
        }).resolves({
            metrics: {
                cpuUsage: 30,
                memoryUsage: 45,
                latency: 20
            }
        });

        await performanceMonitor.updateComplete;
        expect(performanceMonitor.alerts).to.be.empty;

        // Simulate high CPU usage
        mockHass.callWS.withArgs({
            type: 'aurora_sound_to_light/get_performance_metrics'
        }).resolves({
            metrics: {
                cpuUsage: 85,
                memoryUsage: 45,
                latency: 20
            }
        });

        await performanceMonitor.updateComplete;
        expect(performanceMonitor.alerts).to.include('High CPU Usage');
    });

    it('should handle error conditions gracefully', async () => {
        const dashboard = container.querySelector('aurora-dashboard');

        // Simulate WebSocket error
        mockHass.callWS.rejects(new Error('Connection failed'));

        const errorEvent = await new Promise(resolve => {
            dashboard.addEventListener('error', resolve, { once: true });
            dashboard.requestUpdate();
        });

        expect(errorEvent.detail.message).to.equal('Connection failed');
        expect(dashboard.shadowRoot.querySelector('.error-message')).to.exist;
    });

    it('should synchronize light states with audio', async () => {
        const visualizer = container.querySelector('aurora-visualizer');
        const lightController = container.querySelector('aurora-light-controller');

        // Simulate audio data
        const audioData = new Uint8Array(1024).fill(128);
        audioContext.createAnalyser().getByteFrequencyData.callsFake(data => {
            data.set(audioData);
        });

        await visualizer.updateComplete;
        await lightController.updateComplete;

        expect(mockHass.callService.calledWith(
            'light',
            'turn_on',
            sinon.match.object
        )).to.be.true;
    });
}); 