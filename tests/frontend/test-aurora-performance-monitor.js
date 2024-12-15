import { expect, fixture, html, waitUntil } from '@open-wc/testing';
import sinon from 'sinon';
import '../../frontend/aurora-performance-monitor.js';

describe('AuroraPerformanceMonitor', () => {
    let element;
    let mockHass;
    let clock;

    beforeEach(async () => {
        mockHass = {
            callWS: async (params) => {
                if (params.type === 'aurora_sound_to_light/get_metrics') {
                    return {
                        latency: 45.5,
                        cpuUsage: 65.0,
                        memoryUsage: 75.0,
                        audioBufferHealth: 95.0,
                        systemStatus: 'good'
                    };
                }
                throw new Error('Unknown WebSocket command');
            }
        };

        element = await fixture(html`<aurora-performance-monitor></aurora-performance-monitor>`);
        element.hass = mockHass;
        await element.updateComplete;
    });

    afterEach(() => {
        if (element && element.parentNode) {
            element.remove();
        }
        if (clock) {
            clock.restore();
        }
    });

    it('initializes with default values', () => {
        expect(element._metrics).to.deep.equal({
            latency: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            audioBufferHealth: 100,
            systemStatus: 'good'
        });
    });

    it('updates metrics via WebSocket', async () => {
        await element._updateMetrics();
        await element.updateComplete;

        expect(element._metrics).to.deep.equal({
            latency: 45.5,
            cpuUsage: 65.0,
            memoryUsage: 75.0,
            audioBufferHealth: 95.0,
            systemStatus: 'good'
        });
    });

    it('handles WebSocket errors gracefully', async () => {
        element.hass = {
            callWS: async () => {
                throw new Error('WebSocket error');
            }
        };

        const consoleErrorSpy = sinon.spy(console, 'error');
        await element._updateMetrics();
        await element.updateComplete;

        expect(consoleErrorSpy).to.have.been.calledWith('Failed to fetch metrics:', sinon.match.any);
        consoleErrorSpy.restore();
    });

    it('calculates status classes correctly', () => {
        expect(element._getStatusClass(30, { warning: 50, error: 100 })).to.equal('status-good');
        expect(element._getStatusClass(75, { warning: 50, error: 100 })).to.equal('status-warning');
        expect(element._getStatusClass(120, { warning: 50, error: 100 })).to.equal('status-error');
    });

    it('renders metric cards with correct values', async () => {
        await element._updateMetrics();
        await element.updateComplete;
        await waitUntil(() => element.shadowRoot.querySelectorAll('.metric-card').length === 4);

        const metricCards = element.shadowRoot.querySelectorAll('.metric-card');
        expect(metricCards.length).to.equal(4);

        // Check Latency card
        const latencyValue = metricCards[0].querySelector('.metric-value');
        expect(latencyValue.textContent.trim()).to.include('45.5ms');

        // Check CPU Usage card
        const cpuValue = metricCards[1].querySelector('.metric-value');
        expect(cpuValue.textContent.trim()).to.include('65.0%');

        // Check Memory Usage card
        const memoryValue = metricCards[2].querySelector('.metric-value');
        expect(memoryValue.textContent.trim()).to.include('75.0%');

        // Check Buffer Health card
        const bufferValue = metricCards[3].querySelector('.metric-value');
        expect(bufferValue.textContent.trim()).to.include('95.0%');
    });

    it('updates metrics periodically', async () => {
        clock = sinon.useFakeTimers();
        const updateMetricsSpy = sinon.spy(element, '_updateMetrics');

        element._startMetricsUpdate();
        expect(updateMetricsSpy.callCount).to.equal(1);

        clock.tick(1100);
        expect(updateMetricsSpy.callCount).to.equal(2);

        clock.restore();
        updateMetricsSpy.restore();
    });

    it('cleans up interval on disconnect', () => {
        clock = sinon.useFakeTimers();
        const clearIntervalSpy = sinon.spy(window, 'clearInterval');

        element._startMetricsUpdate();
        element.disconnectedCallback();

        expect(clearIntervalSpy.called).to.be.true;

        clock.restore();
        clearIntervalSpy.restore();
    });

    it('applies correct status indicator classes', async () => {
        // Set metrics directly to ensure we have the values we want to test
        element._metrics = {
            latency: 45.5,
            cpuUsage: 65.0,
            memoryUsage: 75.0,
            audioBufferHealth: 95.0,
            systemStatus: 'good'
        };

        // Request an update and wait for it to complete
        element.requestUpdate();
        await element.updateComplete;
        await waitUntil(() => element.shadowRoot.querySelectorAll('.status-indicator').length === 4);

        const metricCards = element.shadowRoot.querySelectorAll('.metric-card');
        expect(metricCards.length).to.equal(4);

        // Check each status indicator
        const statusIndicators = Array.from(element.shadowRoot.querySelectorAll('.status-indicator'));
        expect(statusIndicators.length).to.equal(4);

        // Latency (45.5ms < 50 warning threshold)
        expect(statusIndicators[0].classList.contains('status-warning'), 'Latency should not be in warning state').to.be.false;
        expect(statusIndicators[0].classList.contains('status-good'), 'Latency should be in good state').to.be.true;

        // CPU Usage (65.0% < 70 warning threshold)
        expect(statusIndicators[1].classList.contains('status-good'), 'CPU should be in good state').to.be.true;
        expect(statusIndicators[1].classList.contains('status-warning'), 'CPU should not be in warning state').to.be.false;

        // Memory Usage (75.0% > 70 warning threshold)
        expect(statusIndicators[2].classList.contains('status-warning'), 'Memory should be in warning state').to.be.true;

        // Buffer Health (95.0% -> 5% inverted < 30 warning threshold)
        expect(statusIndicators[3].classList.contains('status-good'), 'Buffer health should be in good state').to.be.true;
    });
}); 