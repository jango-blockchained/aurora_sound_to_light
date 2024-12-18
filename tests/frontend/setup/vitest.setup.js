import '@testing-library/jest-dom';

// Mock window.customElements
window.customElements = {
    define: vi.fn(),
    get: vi.fn(),
    whenDefined: vi.fn()
};

// Mock Chart.js
vi.mock('chart.js', () => ({
    Chart: class MockChart {
        constructor() {
            this.destroy = vi.fn();
            this.update = vi.fn();
            this.data = {
                labels: [],
                datasets: []
            };
        }
    },
    register: vi.fn(),
    LinearScale: class { },
    CategoryScale: class { },
    TimeScale: class { },
    LineController: class { },
    LineElement: class { },
    PointElement: class { },
    Legend: class { },
    Title: class { },
    Tooltip: class { },
    Filler: class { }
}));

// Mock canvas
HTMLCanvasElement.prototype.getContext = () => ({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: () => ({ width: 0 }),
    lineTo: vi.fn(),
    moveTo: vi.fn(),
    beginPath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    arc: vi.fn(),
    scale: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    save: vi.fn(),
    restore: vi.fn()
});

// Mock ResizeObserver
window.ResizeObserver = class ResizeObserver {
    constructor(callback) {
        this.callback = callback;
    }
    observe() { }
    unobserve() { }
    disconnect() { }
};

// Mock WebSocket
window.WebSocket = class MockWebSocket {
    constructor() {
        this.CONNECTING = 0;
        this.OPEN = 1;
        this.CLOSING = 2;
        this.CLOSED = 3;
        this.readyState = this.OPEN;
        this.send = vi.fn();
        this.close = vi.fn();
    }
};

// Mock Home Assistant object
global.createMockHass = () => ({
    callService: vi.fn().mockResolvedValue(undefined),
    callWS: vi.fn().mockImplementation(async (params) => {
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
    }),
    connection: {
        subscribeMessage: vi.fn().mockReturnValue(() => { }),
        socket: { readyState: 1 },
        subscribeEvents: vi.fn(),
        addEventListener: vi.fn()
    },
    states: {},
    language: 'en',
    locale: {
        language: 'en',
        number_format: 'language'
    }
}); 