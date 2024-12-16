import { fixture, html, expect, waitUntil } from '@open-wc/testing';
import { testUtils } from '../setup/setup.js';
import '../../../frontend/aurora-performance-monitor.js';

describe('AuroraPerformanceMonitor E2E', () => {
    let element;
    let mockHass;

    beforeEach(async () => {
        // Setup mock Home Assistant
        mockHass = testUtils.createMockHass();

        // Setup WebSocket mock with realistic behavior
        const mockWS = new testUtils.MockWebSocket();
        mockHass.connection.socket = mockWS;

        // Create element with full configuration
        element = await fixture(html`
            <aurora-performance-monitor
                .hass=${mockHass}
                .config=${{
                updateInterval: 1000,
                showDetailedMetrics: true,
                chartHistory: 50,
                warningThresholds: {
                    latency: 100,
                    cpuUsage: 80,
                    memoryUsage: 85,
                    audioBufferHealth: 70
                }
            }}
            ></aurora-performance-monitor>
        `);
        await element.updateComplete;
    });

    afterEach(() => {
        if (element && element.parentNode) {
            element.remove();
        }
    });

    it('should complete full monitoring cycle with user interactions', async () => {
        // 1. Initial render
        expect(element).to.exist;
        expect(element.shadowRoot.querySelector('.performance-monitor')).to.exist;

        // 2. Simulate metric updates over time
        const metrics = [
            {
                latency: 45.5,
                cpuUsage: 65.0,
                memoryUsage: 75.0,
                audioBufferHealth: 95.0,
                systemStatus: 'good'
            },
            {
                latency: 95.5,
                cpuUsage: 85.0,
                memoryUsage: 88.0,
                audioBufferHealth: 65.0,
                systemStatus: 'warning'
            }
        ];

        // Update metrics multiple times
        for (const metric of metrics) {
            mockHass.callWS = async () => metric;
            await element.updateMetrics();
            await element.updateComplete;
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // 3. Verify chart updates
        const chart = element.shadowRoot.querySelector('.metrics-chart');
        expect(chart).to.exist;
        expect(element._historyData.latency.length).to.be.greaterThan(0);

        // 4. Test user interactions
        // Toggle detailed view
        const header = element.shadowRoot.querySelector('.card-header');
        header.click();
        await element.updateComplete;
        expect(element._expanded).to.be.true;

        // Check detailed metrics visibility
        const detailedMetrics = element.shadowRoot.querySelector('.detailed-metrics');
        expect(detailedMetrics).to.be.visible;

        // 5. Test warning states
        const warningIndicators = element.shadowRoot.querySelectorAll('.warning-indicator');
        expect(warningIndicators.length).to.be.greaterThan(0);

        // 6. Test chart interactions
        const chartContainer = element.shadowRoot.querySelector('.chart-container');
        // Simulate mouse hover
        chartContainer.dispatchEvent(new MouseEvent('mousemove', {
            clientX: 100,
            clientY: 100,
            bubbles: true
        }));
        await element.updateComplete;

        // Verify tooltip appears
        const tooltip = element.shadowRoot.querySelector('.chart-tooltip');
        expect(tooltip).to.exist;
    });

    it('should handle connection loss and recovery', async () => {
        // 1. Simulate connection loss
        mockHass.callWS = async () => {
            throw new Error('Connection lost');
        };

        await element.updateMetrics();
        await element.updateComplete;

        // Verify error state
        let errorElement = element.shadowRoot.querySelector('.error-message');
        expect(errorElement).to.exist;
        expect(errorElement.textContent).to.include('Connection lost');

        // 2. Simulate connection recovery
        mockHass.callWS = async () => ({
            latency: 45.5,
            cpuUsage: 65.0,
            memoryUsage: 75.0,
            audioBufferHealth: 95.0,
            systemStatus: 'good'
        });

        await element.updateMetrics();
        await element.updateComplete;

        // Verify recovery
        errorElement = element.shadowRoot.querySelector('.error-message');
        expect(errorElement).to.not.exist;

        const statusElement = element.shadowRoot.querySelector('.status-indicator');
        expect(statusElement.textContent).to.include('good');
    });
}); 