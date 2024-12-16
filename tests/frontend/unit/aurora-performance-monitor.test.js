import { fixture, html, expect, waitUntil } from '@open-wc/testing';
import '../aurora-performance-monitor.js';

describe('AuroraPerformanceMonitor', () => {
    let element;
    let mockHass;

    beforeEach(async () => {
        // Mock Home Assistant connection
        mockHass = {
            callWS: jest.fn().mockImplementation(async (params) => {
                if (params.type === 'get_metrics') {
                    return {
                        latency: 50,
                        cpuUsage: 25,
                        memoryUsage: 30,
                        timestamp: Date.now()
                    };
                }
                throw new Error('Unknown WebSocket command');
            }),
            callService: jest.fn(),
            connection: {
                subscribeEvents: jest.fn(),
                addEventListener: jest.fn()
            }
        };

        // Create element with mocked Home Assistant
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
        jest.clearAllMocks();
        jest.clearAllTimers();
    });

    test('initializes with default values', () => {
        expect(element._metrics).toEqual({
            latency: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            timestamp: expect.any(Number)
        });
        expect(element._expanded).toBe(false);
        expect(element._showChart).toBe(false);
        expect(element._history).toBeDefined();
        expect(element._history.timestamps).toEqual([]);
    });

    test('updates metrics via WebSocket', async () => {
        await element._updateMetrics();
        expect(element._metrics).toEqual({
            latency: 50,
            cpuUsage: 25,
            memoryUsage: 30,
            timestamp: expect.any(Number)
        });
    });

    test('handles WebSocket errors gracefully', async () => {
        const errorSpy = jest.spyOn(console, 'error');
        mockHass.callWS.mockRejectedValueOnce(new Error('WebSocket error'));

        await element._updateMetrics();

        expect(errorSpy).toHaveBeenCalledWith(
            'Failed to update metrics:',
            expect.any(Error)
        );
    });

    test('calculates status classes correctly', () => {
        expect(element._getStatusClass(50, { medium: 100, high: 200 })).toBe('status-normal');
        expect(element._getStatusClass(150, { medium: 100, high: 200 })).toBe('status-medium');
        expect(element._getStatusClass(250, { medium: 100, high: 200 })).toBe('status-high');
    });

    test('renders metric cards with correct values', async () => {
        await element._updateMetrics();
        await element.updateComplete;

        const metrics = element.shadowRoot.querySelectorAll('.metric');
        expect(metrics.length).toBe(3);

        const values = Array.from(metrics).map(metric =>
            metric.querySelector('.value').textContent.trim()
        );

        expect(values).toEqual(['50ms', '25%', '30%']);
    });

    test('updates metrics periodically', async () => {
        const updateSpy = jest.spyOn(element, '_updateMetrics');
        element._startMetricsUpdate();

        expect(updateSpy).toHaveBeenCalledTimes(1);

        // Fast-forward time
        jest.advanceTimersByTime(5000);
        expect(updateSpy).toHaveBeenCalledTimes(2);
    });

    test('cleans up interval on disconnect', () => {
        element._startMetricsUpdate();
        expect(element._updateInterval).toBeTruthy();

        element.disconnectedCallback();
        expect(element._updateInterval).toBeNull();
    });

    test('toggles expanded state and chart visibility', async () => {
        expect(element._expanded).toBe(false);
        expect(element.shadowRoot.querySelector('.chart-container')).toBeFalsy();

        const header = element.shadowRoot.querySelector('.header');
        header.click();
        await element.updateComplete;

        expect(element._expanded).toBe(true);
        const chartContainer = element.shadowRoot.querySelector('.chart-container');
        expect(chartContainer).toBeTruthy();
        expect(chartContainer.querySelector('#performanceChart')).toBeTruthy();
    });

    test('updates history data within limits', () => {
        const maxLength = element._maxHistoryLength;
        const metrics = {
            latency: 50,
            cpuUsage: 25,
            memoryUsage: 30,
            timestamp: Date.now()
        };

        // Add more entries than the limit
        for (let i = 0; i < maxLength + 5; i++) {
            element._updateHistory({
                ...metrics,
                timestamp: Date.now() + i * 1000
            });
        }

        expect(element._history.timestamps.length).toBe(maxLength);
        expect(element._history.latency.length).toBe(maxLength);
        expect(element._history.cpuUsage.length).toBe(maxLength);
        expect(element._history.memoryUsage.length).toBe(maxLength);
    });

    test('initializes and updates chart correctly', async () => {
        element._expanded = true;
        await element.updateComplete;

        const chartContainer = element.shadowRoot.querySelector('.chart-container');
        expect(chartContainer).toBeTruthy();

        const canvas = chartContainer.querySelector('#performanceChart');
        expect(canvas).toBeTruthy();

        await element._initChart();
        expect(element._chart).toBeTruthy();

        // Update metrics and check if chart is updated
        await element._updateMetrics();
        expect(element._chart.update).toHaveBeenCalled();
    });

    test('cleans up chart on collapse', async () => {
        // First expand
        element._expanded = true;
        await element.updateComplete;
        await element._initChart();
        expect(element._chart).toBeTruthy();

        // Then collapse
        element._expanded = false;
        await element.updateComplete;

        expect(element._chart).toBeNull();
        expect(element.shadowRoot.querySelector('.chart-container')).toBeFalsy();
    });

    test('handles missing hass object gracefully', async () => {
        element.hass = null;
        await element.updateComplete;

        const content = element.shadowRoot.textContent;
        expect(content).toContain('Loading');
    });

    test('updates on hass property change', async () => {
        const updateSpy = jest.spyOn(element, '_updateMetrics');
        element.hass = { ...mockHass };
        await element.updateComplete;

        expect(updateSpy).toHaveBeenCalled();
    });

    test('handles chart initialization failure gracefully', async () => {
        element._expanded = true;
        await element.updateComplete;

        // Remove canvas to simulate initialization failure
        const canvas = element.shadowRoot.querySelector('#performanceChart');
        canvas.remove();

        await element._initChart();
        expect(element._chart).toBeFalsy();
    });

    test('handles history initialization', () => {
        // Force history to be undefined
        element._history = undefined;

        const metrics = {
            latency: 50,
            cpuUsage: 25,
            memoryUsage: 30,
            timestamp: Date.now()
        };

        element._updateHistory(metrics);

        expect(element._history).toBeDefined();
        expect(element._history.timestamps.length).toBe(1);
        expect(element._history.latency).toEqual([50]);
        expect(element._history.cpuUsage).toEqual([25]);
        expect(element._history.memoryUsage).toEqual([30]);
    });
}); 