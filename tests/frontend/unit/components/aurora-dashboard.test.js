import { fixture, html, expect } from '@open-wc/testing';
import { setupTest, cleanupTest, initComponent, waitForComponent, waitForWebSocket, createMockResponse } from '../../setup/test-setup.js';
import '../../../../frontend/aurora-dashboard.js';

describe('AuroraDashboard', () => {
    let element;
    let hass;

    beforeEach(async () => {
        hass = setupTest();
        element = await fixture(html`<aurora-dashboard></aurora-dashboard>`);
        await initComponent(element);
        await waitForComponent(element);
    });

    afterEach(() => {
        cleanupTest();
    });

    it('renders the dashboard container', async () => {
        const container = element.shadowRoot.querySelector('.dashboard-container');
        expect(container).to.exist;
        expect(container.classList.contains('dashboard-container')).to.be.true;
    });

    it('renders the group manager', async () => {
        const groupManager = element.shadowRoot.querySelector('aurora-group-manager');
        expect(groupManager).to.exist;
        expect(groupManager.tagName.toLowerCase()).to.equal('aurora-group-manager');
    });

    it('renders the visualization container', async () => {
        const visualizationContainer = element.shadowRoot.querySelector('.visualization-container');
        expect(visualizationContainer).to.exist;
        expect(visualizationContainer.classList.contains('visualization-container')).to.be.true;
    });

    it('initializes WebSocket connection', async () => {
        await waitForWebSocket(element);
        expect(element.ws).to.exist;
        expect(element.ws.readyState).to.equal(WebSocket.OPEN);
    });

    it('handles WebSocket messages', async () => {
        await waitForWebSocket(element);

        const mockData = {
            type: 'state',
            data: {
                groups: [
                    {
                        id: '1',
                        name: 'Test Group',
                        lights: ['light.test'],
                        enabled: true,
                        audioConfig: {
                            source: 'microphone',
                            sensitivity: 50,
                            minBrightness: 0,
                            maxBrightness: 100
                        }
                    }
                ]
            }
        };

        // Send WebSocket message
        element.ws.send(JSON.stringify(mockData));

        // Wait for updates to propagate
        await element.updateComplete;

        const groupManager = element.shadowRoot.querySelector('aurora-group-manager');
        expect(groupManager.groups).to.deep.equal(mockData.data.groups);
    });

    it('handles service calls', async () => {
        await waitForWebSocket(element);

        const serviceCall = createMockResponse('service', {
            domain: 'aurora_sound_to_light',
            service: 'start_audio',
            data: {}
        });

        element.ws.send(JSON.stringify(serviceCall));
        await element.updateComplete;

        // Verify service call was handled
        expect(hass.callService).to.have.been.calledWith(
            'aurora_sound_to_light',
            'start_audio',
            {}
        );
    });

    it('handles errors gracefully', async () => {
        await waitForWebSocket(element);

        const errorMessage = createMockResponse('error', {
            message: 'Test error'
        });

        element.ws.send(JSON.stringify(errorMessage));
        await element.updateComplete;

        const errorElement = element.shadowRoot.querySelector('.error-message');
        expect(errorElement).to.exist;
        expect(errorElement.textContent).to.include('Test error');
    });

    it('updates layout on resize', async () => {
        const resizeEvent = new Event('resize');
        window.innerWidth = 500;
        window.dispatchEvent(resizeEvent);
        await element.updateComplete;

        expect(element.shadowRoot.querySelector('.mobile')).to.exist;

        window.innerWidth = 1000;
        window.dispatchEvent(resizeEvent);
        await element.updateComplete;

        expect(element.shadowRoot.querySelector('.desktop')).to.exist;
    });
}); 