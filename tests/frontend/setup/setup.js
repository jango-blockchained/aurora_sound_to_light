// Common test setup and utilities for frontend tests
import { expect } from '@open-wc/testing';
import { Chart } from 'chart.js';

// Mock Chart.js
const mockChart = {
    register: () => { },
    Chart: class MockChart {
        constructor() {
            this.destroy = () => { };
            this.update = () => { };
            this.data = {
                labels: [],
                datasets: []
            };
        }
    }
};

// Mock scales
mockChart.LinearScale = class LinearScale { };
mockChart.CategoryScale = class CategoryScale { };
mockChart.TimeScale = class TimeScale { };
mockChart.register(mockChart.LinearScale);
mockChart.register(mockChart.CategoryScale);
mockChart.register(mockChart.TimeScale);

// Mock Home Assistant object
export const createMockHass = () => ({
    callService: async () => { },
    callWS: async (params) => {
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
    },
    connection: {
        subscribeMessage: () => () => { },
        socket: { readyState: 1 },
        subscribeEvents: () => { },
        addEventListener: () => { }
    },
    states: {},
    language: 'en',
    locale: {
        language: 'en',
        number_format: 'language'
    }
});

// Mock WebSocket for testing
export class MockWebSocket {
    constructor() {
        this.CONNECTING = 0;
        this.OPEN = 1;
        this.CLOSING = 2;
        this.CLOSED = 3;
        this.readyState = this.OPEN;
        this.send = () => { };
        this.close = () => { };
    }
}

// Mock canvas context
const mockCanvasContext = {
    clearRect: () => { },
    fillRect: () => { },
    fillText: () => { },
    measureText: () => ({ width: 0 }),
    lineTo: () => { },
    moveTo: () => { },
    beginPath: () => { },
    stroke: () => { },
    fill: () => { },
    arc: () => { },
    scale: () => { },
    translate: () => { },
    rotate: () => { },
    save: () => { },
    restore: () => { }
};

// Mock canvas
HTMLCanvasElement.prototype.getContext = () => mockCanvasContext;

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    constructor(callback) {
        this.callback = callback;
    }
    observe() { }
    unobserve() { }
    disconnect() { }
};

// Helper to wait for element updates
export const waitForElement = async (element) => {
    await element.updateComplete;
    return element;
};

// Helper to create a mock event
export const createMockEvent = (type, detail = {}) => {
    return new CustomEvent(type, {
        detail,
        bubbles: true,
        composed: true
    });
};

// Export common test utilities
export const testUtils = {
    createMockHass,
    MockWebSocket,
    waitForElement,
    createMockEvent,
    mockChart,
    mockCanvasContext
}; 