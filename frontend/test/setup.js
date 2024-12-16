import '@testing-library/jest-dom';
import { Chart } from 'chart.js';

// Mock Chart.js
jest.mock('chart.js', () => {
    const mockChart = {
        register: jest.fn(),
        Chart: jest.fn().mockImplementation(() => ({
            destroy: jest.fn(),
            update: jest.fn(),
            data: {
                labels: [],
                datasets: []
            }
        }))
    };

    // Mock scales
    mockChart.LinearScale = class LinearScale { };
    mockChart.CategoryScale = class CategoryScale { };
    mockChart.TimeScale = class TimeScale { };
    mockChart.register(mockChart.LinearScale);
    mockChart.register(mockChart.CategoryScale);
    mockChart.register(mockChart.TimeScale);

    return mockChart;
});

// Mock date-fns adapter
jest.mock('chartjs-adapter-date-fns', () => ({
    _adapter: {
        formats: () => ({
            datetime: 'MMM d, yyyy, HH:mm:ss',
            millisecond: 'HH:mm:ss.SSS',
            second: 'HH:mm:ss',
            minute: 'HH:mm',
            hour: 'HH:mm',
            day: 'MMM d',
            week: 'MMM d',
            month: 'MMM yyyy',
            quarter: 'MMM yyyy',
            year: 'yyyy'
        }),
        parse: (value) => new Date(value),
        format: (value, format) => value.toISOString(),
        startOf: (value, unit) => value,
        endOf: (value, unit) => value,
        add: (value, amount, unit) => value,
        diff: (max, min, unit) => 0
    }
}));

// Mock Home Assistant connection
global.mockHomeAssistant = {
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

// Mock canvas
const mockCanvasContext = {
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    fillText: jest.fn(),
    measureText: jest.fn(() => ({ width: 0 })),
    lineTo: jest.fn(),
    moveTo: jest.fn(),
    beginPath: jest.fn(),
    stroke: jest.fn(),
    fill: jest.fn(),
    arc: jest.fn(),
    scale: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
    save: jest.fn(),
    restore: jest.fn()
};

HTMLCanvasElement.prototype.getContext = () => mockCanvasContext;

// Mock requestAnimationFrame
global.requestAnimationFrame = callback => setTimeout(callback, 0);
global.cancelAnimationFrame = id => clearTimeout(id);

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
    constructor(callback) {
        this.callback = callback;
    }
    observe() { }
    unobserve() { }
    disconnect() { }
};

// Mock localStorage
const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    clear: jest.fn(),
    removeItem: jest.fn()
};
global.localStorage = localStorageMock;

// Mock timers
jest.useFakeTimers({
    shouldAdvanceTime: true,
    advanceTimeDelta: 40
});
