// Test helper utilities for Aurora Sound to Light E2E tests

export class MockHomeAssistant {
    constructor(config = {}) {
        this.states = {
            'media_player.test': {
                state: 'playing',
                attributes: {
                    friendly_name: 'Test Player',
                    volume_level: 0.5
                }
            },
            'light.test_group1': {
                state: 'on',
                attributes: {
                    friendly_name: 'Test Light Group 1',
                    brightness: 255,
                    rgb_color: [255, 255, 255]
                }
            },
            'light.test_group2': {
                state: 'on',
                attributes: {
                    friendly_name: 'Test Light Group 2',
                    brightness: 255,
                    rgb_color: [255, 255, 255]
                }
            },
            ...config.states
        };

        this.services = {
            light: {
                turn_on: jest.fn(),
                turn_off: jest.fn(),
                toggle: jest.fn()
            },
            media_player: {
                play_media: jest.fn(),
                media_play: jest.fn(),
                media_pause: jest.fn()
            },
            aurora_sound_to_light: {
                set_effect: jest.fn(),
                set_media_player: jest.fn(),
                update_groups: jest.fn()
            }
        };

        this.connection = {
            subscribeEvents: jest.fn(),
            unsubscribeEvents: jest.fn()
        };

        this.callService = jest.fn((domain, service, data) => {
            if (this.services[domain] && this.services[domain][service]) {
                return this.services[domain][service](data);
            }
            throw new Error(`Service ${domain}.${service} not found`);
        });

        this.callWS = jest.fn();
    }

    // Helper to simulate state changes
    setState(entityId, newState) {
        this.states[entityId] = {
            ...this.states[entityId],
            ...newState
        };
        this.connection.subscribeEvents.mock.calls.forEach(([callback]) => {
            callback({
                data: {
                    entity_id: entityId,
                    new_state: this.states[entityId]
                },
                event_type: 'state_changed'
            });
        });
    }

    // Helper to simulate service results
    setServiceResult(domain, service, result) {
        if (this.services[domain] && this.services[domain][service]) {
            this.services[domain][service].mockImplementation(() => result);
        }
    }
}

export class MockAudioContext {
    constructor(config = {}) {
        this.state = 'running';
        this.sampleRate = 44100;
        this.destination = {};

        this.analyser = {
            connect: jest.fn(),
            disconnect: jest.fn(),
            fftSize: 2048,
            frequencyBinCount: 1024,
            minDecibels: -90,
            maxDecibels: -10,
            smoothingTimeConstant: 0.8,
            getByteFrequencyData: jest.fn(array => {
                if (config.frequencyData) {
                    array.set(config.frequencyData);
                }
            }),
            getByteTimeDomainData: jest.fn(array => {
                if (config.timeDomainData) {
                    array.set(config.timeDomainData);
                }
            })
        };

        this.createAnalyser = jest.fn(() => this.analyser);
        this.createMediaStreamSource = jest.fn(stream => ({
            connect: jest.fn(),
            disconnect: jest.fn()
        }));
        this.resume = jest.fn().mockResolvedValue(undefined);
    }

    // Helper to simulate audio data
    setAudioData(frequencyData, timeDomainData) {
        if (frequencyData) {
            this.analyser.getByteFrequencyData = jest.fn(array => array.set(frequencyData));
        }
        if (timeDomainData) {
            this.analyser.getByteTimeDomainData = jest.fn(array => array.set(timeDomainData));
        }
    }
}

export class MockMediaStream {
    constructor() {
        this.tracks = [
            {
                kind: 'audio',
                stop: jest.fn(),
                enabled: true
            }
        ];
    }

    getTracks() {
        return this.tracks;
    }

    getAudioTracks() {
        return this.tracks.filter(track => track.kind === 'audio');
    }
}

export function createMockEvent(type, detail = {}) {
    return new CustomEvent(type, {
        detail,
        bubbles: true,
        composed: true
    });
}

export function createTestContainer() {
    const container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
    return container;
}

export function cleanupTestContainer() {
    const container = document.getElementById('test-container');
    if (container) {
        container.remove();
    }
}

export function createMockAudioData(length = 1024, pattern = 'sine') {
    const data = new Uint8Array(length);
    switch (pattern) {
        case 'sine':
            for (let i = 0; i < length; i++) {
                data[i] = Math.sin(i / length * Math.PI * 2) * 127 + 128;
            }
            break;
        case 'random':
            for (let i = 0; i < length; i++) {
                data[i] = Math.random() * 255;
            }
            break;
        case 'pulse':
            for (let i = 0; i < length; i++) {
                data[i] = i % 64 < 32 ? 255 : 0;
            }
            break;
        default:
            data.fill(128);
    }
    return data;
}

export const mockEffects = {
    basic: {
        id: 'basic_effect',
        name: 'Basic Effect',
        parameters: {
            intensity: 0.8,
            speed: 1.0,
            color: '#ff0000'
        }
    },
    rainbow: {
        id: 'rainbow_effect',
        name: 'Rainbow Effect',
        parameters: {
            speed: 1.0,
            saturation: 1.0,
            brightness: 1.0
        }
    },
    pulse: {
        id: 'pulse_effect',
        name: 'Pulse Effect',
        parameters: {
            frequency: 1.0,
            amplitude: 0.8,
            color: '#00ff00'
        }
    }
}; 