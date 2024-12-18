import { mockHass, setupWindow } from './ha-mock.js';

// Setup before each test
export function setupTest() {
    setupWindow();
    return mockHass;
}

// Clean up after each test
export function cleanupTest() {
    document.body.innerHTML = '';
    window.localStorage.clear();
    window.sessionStorage.clear();
}

// Initialize a component with Home Assistant
export async function initComponent(element) {
    element.hass = mockHass;
    await element.updateComplete;
    return element;
}

// Create a mock event
export function createEvent(type, detail = {}) {
    return new CustomEvent(type, { detail });
}

// Wait for a condition to be true
export async function waitFor(condition, timeout = 5000) {
    const start = Date.now();
    while (!condition()) {
        if (Date.now() - start > timeout) {
            throw new Error('Timeout waiting for condition');
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
}

// Wait for component to be ready
export async function waitForComponent(element) {
    await element.updateComplete;
    await waitFor(() => element.shadowRoot);
    return element;
}

// Wait for WebSocket connection
export async function waitForWebSocket(element) {
    await waitFor(() => element.ws && element.ws.readyState === WebSocket.OPEN);
    return element;
}

// Wait for chart initialization
export async function waitForChart(element) {
    await waitFor(() => element.chart);
    return element;
}

// Create a mock response
export function createMockResponse(type, data) {
    return {
        type,
        data
    };
} 