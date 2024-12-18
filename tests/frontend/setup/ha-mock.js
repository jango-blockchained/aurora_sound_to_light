// Mock Home Assistant connection and services
export const mockHass = {
    connection: {
        subscribeMessage: (callback, options) => {
            callback({ type: 'result', success: true });
            return Promise.resolve(() => { });
        }
    },
    callService: (domain, service, data) => Promise.resolve(),
    callWS: (options) => {
        switch (options.type) {
            case 'aurora_sound_to_light/get_metrics':
                return Promise.resolve({
                    latency: 50,
                    cpuUsage: 25,
                    memoryUsage: 30,
                    audioBufferHealth: 95,
                    systemStatus: 'good',
                    timestamp: Date.now()
                });
            case 'aurora_sound_to_light/get_history':
                return Promise.resolve({
                    timestamps: Array.from({ length: 60 }, (_, i) => Date.now() - i * 1000),
                    latency: Array.from({ length: 60 }, () => Math.random() * 100),
                    cpuUsage: Array.from({ length: 60 }, () => Math.random() * 100),
                    memoryUsage: Array.from({ length: 60 }, () => Math.random() * 100),
                    audioBufferHealth: Array.from({ length: 60 }, () => Math.random() * 100)
                });
            default:
                return Promise.resolve({});
        }
    }
};

// Mock WebSocket
export class MockWebSocket {
    constructor() {
        this.onopen = null;
        this.onmessage = null;
        this.onclose = null;
        this.onerror = null;
        this.readyState = WebSocket.CONNECTING;
        setTimeout(() => {
            this.readyState = WebSocket.OPEN;
            this.onopen?.();
        }, 0);
    }

    send(data) {
        if (this.onmessage) {
            const message = JSON.parse(data);
            const response = {
                type: message.type,
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
            setTimeout(() => {
                this.onmessage(new MessageEvent('message', { data: JSON.stringify(response) }));
            }, 0);
        }
    }

    close() {
        this.readyState = WebSocket.CLOSED;
        this.onclose?.();
    }

    dispatchEvent(event) {
        if (event.type === 'message' && this.onmessage) {
            this.onmessage(event);
        }
    }
}

// Mock Chart.js
export class MockChart {
    constructor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
        this.data = config.data;
        this.options = config.options;
        this.type = config.type;
        this._destroyed = false;
    }

    update() {
        if (!this._destroyed) {
            this.data = { ...this.data };
        }
    }

    destroy() {
        this._destroyed = true;
    }

    resize() {
        if (!this._destroyed) {
            this.update();
        }
    }

    render() {
        if (!this._destroyed) {
            this.update();
        }
    }

    stop() {
        if (!this._destroyed) {
            this._stopped = true;
        }
    }

    reset() {
        if (!this._destroyed) {
            this.data = this.config.data;
        }
    }
}

// Mock window
export function setupWindow() {
    window.WebSocket = MockWebSocket;
    window.Chart = MockChart;
    window.ResizeObserver = class {
        observe() { }
        unobserve() { }
        disconnect() { }
    };
    window.AudioContext = class {
        constructor() {
            this.state = 'running';
            this.destination = {};
        }
        createAnalyser() {
            return {
                connect: () => { },
                disconnect: () => { },
                fftSize: 2048,
                frequencyBinCount: 1024,
                getByteFrequencyData: () => { },
                getByteTimeDomainData: () => { }
            };
        }
        createMediaStreamSource() {
            return {
                connect: () => { },
                disconnect: () => { }
            };
        }
        resume() {
            return Promise.resolve();
        }
    };
} 