// Mock window.customElements
window.customElements = {
    define: jest.fn(),
    get: jest.fn(),
    whenDefined: jest.fn()
};

// Mock WebSocket
global.WebSocket = class {
    constructor() {
        setTimeout(() => {
            this.onopen && this.onopen();
        });
    }
    send() { }
    close() { }
};

// Mock ResizeObserver
global.ResizeObserver = class {
    observe() { }
    unobserve() { }
    disconnect() { }
};

// Mock window.matchMedia
window.matchMedia = jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
}));

// Mock requestAnimationFrame
global.requestAnimationFrame = callback => setTimeout(callback, 0);
global.cancelAnimationFrame = jest.fn();

// Mock AudioContext
global.AudioContext = class {
    constructor() {
        this.state = 'running';
        this.destination = {};
    }
    createAnalyser() {
        return {
            connect: jest.fn(),
            disconnect: jest.fn(),
            fftSize: 2048,
            frequencyBinCount: 1024,
            getByteFrequencyData: jest.fn(),
            getByteTimeDomainData: jest.fn()
        };
    }
    createMediaStreamSource() {
        return {
            connect: jest.fn(),
            disconnect: jest.fn()
        };
    }
    resume() {
        return Promise.resolve();
    }
}; 