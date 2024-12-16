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
        expect(element._historyData.latency).to.be.an('array').that.is.empty;
        expect(element._expanded).to.be.false;
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

        // Check history data
        expect(element._historyData.latency).to.have.lengthOf(1);
        expect(element._historyData.cpuUsage).to.have.lengthOf(1);
        expect(element._historyData.memoryUsage).to.have.lengthOf(1);
        expect(element._historyData.audioBufferHealth).to.have.lengthOf(1);
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

    it('toggles chart visibility', async () => {
        const latencyCard = element.shadowRoot.querySelector('.metric-card');

        expect(element._expanded).to.be.false;
        expect(element.shadowRoot.querySelector('.chart-container').classList.contains('expanded')).to.be.false;

        latencyCard.click();
        await element.updateComplete;

        expect(element._expanded).to.be.true;
        expect(element.shadowRoot.querySelector('.chart-container').classList.contains('expanded')).to.be.true;
    });

    it('shows optimization tips when thresholds are exceeded', async () => {
        element._metrics = {
            latency: 60,
            cpuUsage: 80,
            memoryUsage: 85,
            audioBufferHealth: 85,
            systemStatus: 'warning'
        };

        element.requestUpdate();
        await element.updateComplete;

        const tips = element.shadowRoot.querySelectorAll('.tip-item');
        expect(tips.length).to.be.greaterThan(0);

        const tipTexts = Array.from(tips).map(tip => tip.textContent);
        expect(tipTexts.some(text => text.includes('High latency'))).to.be.true;
        expect(tipTexts.some(text => text.includes('High CPU usage'))).to.be.true;
        expect(tipTexts.some(text => text.includes('High memory usage'))).to.be.true;
    });

    it('maintains history data within limits', async () => {
        // Simulate 70 updates
        for (let i = 0; i < 70; i++) {
            await element._updateMetrics();
        }

        // Check that history is limited to 60 entries
        expect(element._historyData.timestamps.length).to.equal(60);
        expect(element._historyData.latency.length).to.equal(60);
        expect(element._historyData.cpuUsage.length).to.equal(60);
        expect(element._historyData.memoryUsage.length).to.equal(60);
        expect(element._historyData.audioBufferHealth.length).to.equal(60);
    });

    it('initializes and updates chart when expanded', async () => {
        await element._updateMetrics();
        element._toggleExpanded();
        await element.updateComplete;

        const canvas = element.shadowRoot.querySelector('#performanceChart');
        expect(canvas).to.exist;
        expect(element._chart).to.exist;
    });
}); 