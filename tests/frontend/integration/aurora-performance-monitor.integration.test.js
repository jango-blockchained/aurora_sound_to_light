import { fixture, html, expect, waitUntil } from '@open-wc/testing';
import { testUtils } from '../setup/setup.js';
import '../../../frontend/aurora-performance-monitor.js';

describe('AuroraPerformanceMonitor Integration', () => {
    let element;
    let mockHass;

    beforeEach(async () => {
        mockHass = testUtils.createMockHass();
        mockHass.callWS = async (params) => {
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
        };

        element = await fixture(html`
            <aurora-performance-monitor
                .hass=${mockHass}
                .config=${{
                updateInterval: 1000,
                showDetailedMetrics: true
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

    it('should update metrics and reflect changes in the UI', async () => {
        // Initial state check
        expect(element._metrics).to.deep.equal({
            latency: 45.5,
            cpuUsage: 65.0,
            memoryUsage: 75.0,
            audioBufferHealth: 95.0,
            systemStatus: 'good'
        });

        // Simulate metric update
        mockHass.callWS = async () => ({
            latency: 50.0,
            cpuUsage: 70.0,
            memoryUsage: 80.0,
            audioBufferHealth: 90.0,
            systemStatus: 'warning'
        });

        // Trigger update
        await element.updateMetrics();
        await element.updateComplete;

        // Check if UI reflects the changes
        const statusElement = element.shadowRoot.querySelector('.status-indicator');
        expect(statusElement.textContent).to.include('warning');

        const metrics = element.shadowRoot.querySelectorAll('.metric-value');
        expect(metrics[0].textContent).to.include('50.0');
        expect(metrics[1].textContent).to.include('70.0');
    });

    it('should handle error states gracefully', async () => {
        // Simulate error
        mockHass.callWS = async () => {
            throw new Error('Connection failed');
        };

        // Trigger update
        await element.updateMetrics();
        await element.updateComplete;

        // Check error state
        const errorElement = element.shadowRoot.querySelector('.error-message');
        expect(errorElement).to.exist;
        expect(errorElement.textContent).to.include('Connection failed');
    });

    it('should toggle detailed view when header is clicked', async () => {
        const header = element.shadowRoot.querySelector('.card-header');

        // Initial state
        expect(element._expanded).to.be.false;

        // Click header
        header.click();
        await element.updateComplete;

        // Check expanded state
        expect(element._expanded).to.be.true;

        // Verify detailed metrics are visible
        const detailedMetrics = element.shadowRoot.querySelector('.detailed-metrics');
        expect(detailedMetrics).to.be.visible;
    });
}); 