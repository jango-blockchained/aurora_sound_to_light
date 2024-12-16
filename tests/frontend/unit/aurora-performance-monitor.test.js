import { fixture, html, expect } from '@open-wc/testing';
import { testUtils } from '../setup/setup.js';
import sinon from 'sinon';
import '../../../frontend/aurora-performance-monitor.js';

describe('AuroraPerformanceMonitor', () => {
    let element;
    let mockHass;

    beforeEach(async () => {
        mockHass = testUtils.createMockHass();
        mockHass.callWS = async (params) => {
            if (params.type === 'aurora_sound_to_light/get_metrics') {
                return {
                    latency: 50,
                    cpuUsage: 25,
                    memoryUsage: 30,
                    audioBufferHealth: 95,
                    systemStatus: 'good',
                    timestamp: Date.now()
                };
            }
            throw new Error('Unknown WebSocket command');
        };

        element = await fixture(html`<aurora-performance-monitor></aurora-performance-monitor>`);
        element.hass = mockHass;
        await element.updateComplete;

        // Clear any automatic update intervals
        if (element._updateInterval) {
            clearInterval(element._updateInterval);
            element._updateInterval = null;
        }
    });

    afterEach(() => {
        if (element._updateInterval) {
            clearInterval(element._updateInterval);
            element._updateInterval = null;
        }
        if (element._chart) {
            element._chart.destroy();
            element._chart = null;
        }
    });

    it('initializes with default values', () => {
        expect(element._metrics).to.deep.equal({
            latency: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            audioBufferHealth: 100,
            systemStatus: 'good',
            timestamp: element._metrics.timestamp
        });
        expect(element._expanded).to.be.false;
        expect(element._showChart).to.be.false;
        expect(element._historyData).to.exist;
        expect(element._historyData.timestamps).to.be.an('array').that.is.empty;
    });

    it('updates metrics via WebSocket', async () => {
        await element._updateMetrics();
        expect(element._metrics).to.deep.equal({
            latency: 50,
            cpuUsage: 25,
            memoryUsage: 30,
            audioBufferHealth: 95,
            systemStatus: 'good',
            timestamp: element._metrics.timestamp
        });
    });

    it('handles WebSocket errors gracefully', async () => {
        mockHass.callWS = async () => {
            throw new Error('WebSocket error');
        };

        await element._updateMetrics();
        const errorElement = element.shadowRoot.querySelector('.error-message');
        expect(errorElement).to.exist;
        expect(errorElement.textContent).to.include('WebSocket error');
    });

    it('calculates status classes correctly', () => {
        expect(element._getStatusClass(50, { medium: 100, high: 200 })).to.equal('status-normal');
        expect(element._getStatusClass(150, { medium: 100, high: 200 })).to.equal('status-medium');
        expect(element._getStatusClass(250, { medium: 100, high: 200 })).to.equal('status-high');
    });

    it('renders metric cards with correct values', async () => {
        await element._updateMetrics();
        await element.updateComplete;

        const metrics = element.shadowRoot.querySelectorAll('.metric');
        expect(metrics.length).to.equal(4); // Including audio buffer health

        const values = Array.from(metrics).map(metric =>
            metric.querySelector('.value').textContent.trim()
        );

        expect(values).to.deep.equal(['50ms', '25%', '30%', '95%']);
    });

    it('updates metrics periodically', async () => {
        const updateSpy = sinon.spy(element, '_updateMetrics');
        element._startMetricsUpdate();

        expect(updateSpy.callCount).to.equal(1);

        // Fast-forward time
        await new Promise(resolve => setTimeout(resolve, 5000));
        expect(updateSpy.callCount).to.be.greaterThan(1);
    });

    it('cleans up interval on disconnect', () => {
        element._startMetricsUpdate();
        expect(element._updateInterval).to.exist;

        element.disconnectedCallback();
        expect(element._updateInterval).to.be.null;
    });

    it('toggles expanded state and chart visibility', async () => {
        expect(element._expanded).to.be.false;
        expect(element.shadowRoot.querySelector('.chart-container')).to.not.exist;

        const header = element.shadowRoot.querySelector('.card-header');
        header.click();
        await element.updateComplete;

        expect(element._expanded).to.be.true;
        const chartContainer = element.shadowRoot.querySelector('.chart-container');
        expect(chartContainer).to.exist;
        expect(chartContainer.querySelector('#performanceChart')).to.exist;
    });

    it('updates history data within limits', () => {
        const maxLength = element._maxHistoryLength;
        const metrics = {
            latency: 50,
            cpuUsage: 25,
            memoryUsage: 30,
            audioBufferHealth: 95,
            systemStatus: 'good',
            timestamp: Date.now()
        };

        // Add more entries than the limit
        for (let i = 0; i < maxLength + 5; i++) {
            element._updateHistory({
                ...metrics,
                timestamp: Date.now() + i * 1000
            });
        }

        expect(element._historyData.timestamps.length).to.equal(maxLength);
        expect(element._historyData.latency.length).to.equal(maxLength);
        expect(element._historyData.cpuUsage.length).to.equal(maxLength);
        expect(element._historyData.memoryUsage.length).to.equal(maxLength);
    });

    it('initializes and updates chart correctly', async () => {
        element._expanded = true;
        await element.updateComplete;

        const chartContainer = element.shadowRoot.querySelector('.chart-container');
        expect(chartContainer).to.exist;

        const canvas = chartContainer.querySelector('#performanceChart');
        expect(canvas).to.exist;

        await element._initChart();
        expect(element._chart).to.exist;

        // Update metrics and check if chart is updated
        await element._updateMetrics();
        expect(element._chart.data.datasets[0].data).to.deep.equal(element._historyData.latency);
    });

    it('cleans up chart on collapse', async () => {
        // First expand
        element._expanded = true;
        await element.updateComplete;
        await element._initChart();
        expect(element._chart).to.exist;

        // Then collapse
        element._expanded = false;
        await element.updateComplete;

        expect(element._chart).to.be.null;
        expect(element.shadowRoot.querySelector('.chart-container')).to.not.exist;
    });

    it('handles missing hass object gracefully', async () => {
        element.hass = null;
        await element.updateComplete;

        const content = element.shadowRoot.textContent;
        expect(content).to.include('Loading');
    });

    it('updates on hass property change', async () => {
        const updateSpy = sinon.spy(element, '_updateMetrics');
        element.hass = { ...mockHass };
        await element.updateComplete;

        expect(updateSpy.calledOnce).to.be.true;
    });

    it('handles chart initialization failure gracefully', async () => {
        element._expanded = true;
        await element.updateComplete;

        // Remove canvas to simulate initialization failure
        const canvas = element.shadowRoot.querySelector('#performanceChart');
        canvas.remove();

        await element._initChart();
        expect(element._chart).to.not.exist;
    });

    it('handles history initialization', () => {
        // Force history to be undefined
        element._historyData = undefined;

        const metrics = {
            latency: 50,
            cpuUsage: 25,
            memoryUsage: 30,
            audioBufferHealth: 95,
            systemStatus: 'good',
            timestamp: Date.now()
        };

        element._updateHistory(metrics);

        expect(element._historyData).to.exist;
        expect(element._historyData.timestamps.length).to.equal(1);
        expect(element._historyData.latency).to.deep.equal([50]);
        expect(element._historyData.cpuUsage).to.deep.equal([25]);
        expect(element._historyData.memoryUsage).to.deep.equal([30]);
    });
}); 