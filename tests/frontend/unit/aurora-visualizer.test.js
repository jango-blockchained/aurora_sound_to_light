import { fixture, html, expect } from '@open-wc/testing';
import '../aurora-visualizer.js';

describe('AuroraVisualizer', () => {
    let element;
    let mockAudioContext;
    let mockAnalyser;
    let mockCanvas;
    let mockCanvasContext;

    beforeEach(async () => {
        // Mock Web Audio API
        mockAnalyser = {
            fftSize: 2048,
            frequencyBinCount: 1024,
            getByteFrequencyData: jest.fn(),
            getByteTimeDomainData: jest.fn(),
            connect: jest.fn(),
            disconnect: jest.fn()
        };

        mockAudioContext = {
            createAnalyser: jest.fn(() => mockAnalyser),
            createMediaStreamSource: jest.fn(),
            createMediaElementSource: jest.fn(),
            state: 'running',
            resume: jest.fn()
        };

        global.AudioContext = jest.fn(() => mockAudioContext);

        // Mock Canvas API
        mockCanvasContext = {
            clearRect: jest.fn(),
            fillRect: jest.fn(),
            beginPath: jest.fn(),
            moveTo: jest.fn(),
            lineTo: jest.fn(),
            stroke: jest.fn(),
            fill: jest.fn()
        };

        mockCanvas = {
            getContext: jest.fn(() => mockCanvasContext),
            width: 800,
            height: 400
        };

        element = await fixture(html`<aurora-visualizer></aurora-visualizer>`);
        element.shadowRoot.querySelector('canvas').getContext = mockCanvas.getContext;
        await element.updateComplete;
    });

    describe('Initialization', () => {
        test('should initialize with default values', () => {
            expect(element.mode).toBe('frequency');
            expect(element.colorMapping).toBe('spectrum');
            expect(element.sensitivity).toBe(1.0);
            expect(element.isActive).toBe(false);
        });

        test('should create audio context and analyser', () => {
            expect(mockAudioContext.createAnalyser).toHaveBeenCalled();
            expect(mockAnalyser.fftSize).toBe(2048);
        });

        test('should set up canvas with correct dimensions', () => {
            const canvas = element.shadowRoot.querySelector('canvas');
            expect(canvas.width).toBe(mockCanvas.width);
            expect(canvas.height).toBe(mockCanvas.height);
        });
    });

    describe('Audio Processing', () => {
        test('should process frequency data', async () => {
            const frequencyData = new Uint8Array(1024).fill(128);
            mockAnalyser.getByteFrequencyData.mockImplementation(data => {
                data.set(frequencyData);
            });

            element.mode = 'frequency';
            await element._processAudioData();

            expect(mockAnalyser.getByteFrequencyData).toHaveBeenCalled();
            expect(mockCanvasContext.fillRect).toHaveBeenCalled();
        });

        test('should process waveform data', async () => {
            const timeData = new Uint8Array(2048).fill(128);
            mockAnalyser.getByteTimeDomainData.mockImplementation(data => {
                data.set(timeData);
            });

            element.mode = 'waveform';
            await element._processAudioData();

            expect(mockAnalyser.getByteTimeDomainData).toHaveBeenCalled();
            expect(mockCanvasContext.beginPath).toHaveBeenCalled();
            expect(mockCanvasContext.stroke).toHaveBeenCalled();
        });

        test('should detect beats', async () => {
            const frequencyData = new Uint8Array(1024);
            // Simulate a beat in the bass frequencies
            frequencyData.set(new Uint8Array(10).fill(240), 0);

            mockAnalyser.getByteFrequencyData.mockImplementation(data => {
                data.set(frequencyData);
            });

            const beatDetected = await element._detectBeat();
            expect(beatDetected).toBe(true);
            expect(element.dispatchEvent).toHaveBeenCalledWith(
                new CustomEvent('beat-detected', {
                    detail: { timestamp: expect.any(Number) },
                    bubbles: true,
                    composed: true
                })
            );
        });
    });

    describe('Visualization Modes', () => {
        test('should switch visualization modes', async () => {
            element.mode = 'spectrum';
            await element.updateComplete;
            expect(element._visualizationMode).toBe('spectrum');

            element.mode = 'waveform';
            await element.updateComplete;
            expect(element._visualizationMode).toBe('waveform');
        });

        test('should update color mapping', async () => {
            element.colorMapping = 'frequency';
            await element.updateComplete;

            const color = element._getColorForFrequency(440);
            expect(color).toMatch(/^#[0-9A-F]{6}$/i);
        });
    });

    describe('Performance Optimization', () => {
        test('should use requestAnimationFrame for rendering', async () => {
            global.requestAnimationFrame = jest.fn();

            element.startVisualization();
            expect(global.requestAnimationFrame).toHaveBeenCalled();
        });

        test('should limit frame rate when CPU usage is high', async () => {
            element.cpuUsage = 80;
            await element.updateComplete;

            const startTime = performance.now();
            await element._processAudioData();
            const endTime = performance.now();

            expect(endTime - startTime).toBeGreaterThanOrEqual(16); // 60fps limit
        });
    });

    describe('WebAudio Integration', () => {
        test('should connect to media stream source', async () => {
            const mockStream = { id: 'test-stream' };
            await element.connectToStream(mockStream);

            expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
            expect(mockAnalyser.connect).toHaveBeenCalled();
        });

        test('should connect to media element source', async () => {
            const mockMediaElement = { id: 'test-media' };
            await element.connectToMediaElement(mockMediaElement);

            expect(mockAudioContext.createMediaElementSource).toHaveBeenCalledWith(mockMediaElement);
            expect(mockAnalyser.connect).toHaveBeenCalled();
        });
    });

    describe('Error Handling', () => {
        test('should handle audio context errors', async () => {
            mockAudioContext.resume.mockRejectedValue(new Error('Audio context error'));

            try {
                await element.startVisualization();
            } catch (error) {
                expect(error.message).toBe('Audio context error');
            }
        });

        test('should handle canvas context errors', () => {
            mockCanvas.getContext.mockImplementation(() => {
                throw new Error('Canvas context error');
            });

            const errorHandler = jest.fn();
            element.addEventListener('error', errorHandler);

            element._initializeCanvas();
            expect(errorHandler).toHaveBeenCalled();
        });
    });

    describe('Accessibility', () => {
        test('should provide audio visualization description', () => {
            const canvas = element.shadowRoot.querySelector('canvas');
            expect(canvas.getAttribute('aria-label')).toBeTruthy();
            expect(canvas.getAttribute('role')).toBe('img');
        });

        test('should update aria-label based on visualization mode', async () => {
            element.mode = 'frequency';
            await element.updateComplete;

            const canvas = element.shadowRoot.querySelector('canvas');
            expect(canvas.getAttribute('aria-label')).toContain('frequency');

            element.mode = 'waveform';
            await element.updateComplete;
            expect(canvas.getAttribute('aria-label')).toContain('waveform');
        });
    });

    describe('Memory Management', () => {
        test('should clean up resources on disconnect', async () => {
            element.disconnectedCallback();

            expect(mockAnalyser.disconnect).toHaveBeenCalled();
            expect(element.isActive).toBe(false);
        });

        test('should handle rapid mode switching without memory leaks', async () => {
            const modes = ['frequency', 'waveform', 'spectrum'];
            for (const mode of modes) {
                element.mode = mode;
                await element.updateComplete;
            }

            expect(mockAnalyser.disconnect).toHaveBeenCalledTimes(modes.length - 1);
        });
    });
}); 