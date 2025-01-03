// Mock window.customElements
window.customElements = {
    define: jest.fn(),
    get: jest.fn(),
    whenDefined: jest.fn()
};

// Mock Chart.js
jest.mock('chart.js', () => ({
    Chart: class MockChart {
        constructor() {
            this.destroy = jest.fn();
            this.update = jest.fn();
            this.data = {
                labels: [],
                datasets: []
            };
        }
    },
    register: jest.fn(),
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
    clearRect: jest.fn(),
    fillRect: jest.fn(),
    fillText: jest.fn(),
    measureText: () => ({ width: 0 }),
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
        this.send = jest.fn();
        this.close = jest.fn();
    }
};

// Mock Home Assistant object
global.createMockHass = () => ({
    callService: jest.fn().mockResolvedValue(undefined),
    callWS: jest.fn().mockImplementation(async (params) => {
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
        subscribeMessage: jest.fn().mockReturnValue(() => { }),
        socket: { readyState: 1 },
        subscribeEvents: jest.fn(),
        addEventListener: jest.fn()
    },
    states: {},
    language: 'en',
    locale: {
        language: 'en',
        number_format: 'language'
    }
}); 