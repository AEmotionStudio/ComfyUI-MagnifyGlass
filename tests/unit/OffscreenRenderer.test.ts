
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Create hoisted mocks
const { appMock } = vi.hoisted(() => {
    return {
        appMock: {
            graph: {
                _nodes: [] as any[]
            },
            canvas: {
                ds: {
                    scale: 1,
                    offset: [0, 0]
                }
            }
        }
    };
});

// Attach to global
// @ts-ignore
globalThis.app = appMock;

vi.mock('/scripts/app.js', () => ({
    app: appMock
}));

import { OffscreenRenderer } from '../../src/magnify-glass/OffscreenRenderer';
import { ConfigManager } from '../../src/magnify-glass/ConfigManager';
import { MagnifierState } from '../../src/magnify-glass/MagnifierState';

describe('OffscreenRenderer Optimization', () => {
    let renderer: OffscreenRenderer;
    let configMock: ConfigManager;
    let stateMock: MagnifierState;
    let canvasMock: HTMLCanvasElement;

    beforeEach(() => {
        vi.clearAllMocks();
        appMock.graph._nodes = [];
        appMock.canvas.ds = { scale: 1, offset: [0, 0] };

        // Mock ConfigManager
        configMock = {
            glassSize: 200,
            zoomFactor: 2,
            accessibilityEnabled: true,
            nodeTitleEmphasis: true,
            invertColors: false,
            grayscaleMode: false,
            forceDirectCapture: false,
            fontScaleFactor: 100,
            boldTextEnabled: false,
            textGlowEnabled: false,
            textOutlineEnabled: false,
            highContrastMode: false,
            showCursorPreview: false
        } as unknown as ConfigManager;

        // Mock MagnifierState
        stateMock = {
            x: 100, // Cursor backing X
            y: 100, // Cursor backing Y
            canvasScale: 1
        } as unknown as MagnifierState;

        // Mock canvas creation to return a mock context
        const originalCreateElement = document.createElement.bind(document);
        vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
            if (tagName === 'canvas') {
                const canvas = originalCreateElement(tagName) as HTMLCanvasElement;
                canvas.getContext = vi.fn().mockReturnValue({
                    clearRect: vi.fn(),
                    save: vi.fn(),
                    restore: vi.fn(),
                    drawImage: vi.fn(),
                    beginPath: vi.fn(),
                    roundRect: vi.fn(),
                    fill: vi.fn(),
                    stroke: vi.fn(),
                    fillText: vi.fn(),
                    measureText: vi.fn().mockReturnValue({ width: 10 }),
                    clip: vi.fn(),
                    scale: vi.fn(),
                    translate: vi.fn(),
                    moveTo: vi.fn(),
                    lineTo: vi.fn(),
                    closePath: vi.fn(),
                    strokeText: vi.fn(),
                });
                return canvas;
            }
            return originalCreateElement(tagName);
        });

        renderer = new OffscreenRenderer(configMock, stateMock);
    });

    it('should identify visible nodes and render them', () => {
        // Setup nodes
        // Node 1: Visible (at 50, 50, size 100x100)
        // Cursor at 100, 100. Glass size 200, zoom 2. Source size 100.
        // Capture region: 50 to 150.
        // Node 1 overlaps.
        const visibleNode = {
            pos: [50, 50], // Graph coords
            size: [100, 100],
            widgets: [
                { type: 'text', name: 'visible_widget', value: 'Visible Text', computedHeight: 50, last_y: 40 }
            ]
        };
        // Node 2: Not Visible (far away)
        const invisibleNode = {
            pos: [1000, 1000],
            size: [100, 100],
            widgets: [
                { type: 'text', name: 'invisible_widget', value: 'Invisible Text', computedHeight: 50, last_y: 40 }
            ]
        };

        appMock.graph._nodes = [visibleNode, invisibleNode];

        // Mock target canvas
        canvasMock = document.createElement('canvas');
        canvasMock.width = 1000;
        canvasMock.height = 800;
        vi.spyOn(canvasMock, 'getBoundingClientRect').mockReturnValue({
            x: 0, y: 0, width: 1000, height: 800, top: 0, left: 0, right: 1000, bottom: 800, toJSON: () => {}
        } as DOMRect);

        // Spy on private method drawWidgetTextNatively via cast
        const drawSpy = vi.spyOn(renderer as any, 'drawWidgetTextNatively');

        // Spy on context fillText to verify rendering
        // Need to access the internal context.
        const ctx = (renderer as any).offscreenCtx;
        const fillTextSpy = vi.spyOn(ctx, 'fillText');

        // Render
        renderer.renderHighResRegion(canvasMock);

        // Verify drawWidgetTextNatively was called
        expect(drawSpy).toHaveBeenCalled();

        // Verify that visibleNodes list was correctly filtered and passed
        const callArgs = drawSpy.mock.calls[0];
        const visibleNodes = callArgs[0] as any[];
        expect(visibleNodes.length).toBe(1);
        expect(visibleNodes[0].widgets[0].value).toBe('Visible Text');

        // Verify text was drawn for visible node
        expect(fillTextSpy).toHaveBeenCalledWith(expect.stringContaining('Visible Text'), expect.any(Number), expect.any(Number));

        // Verify text was NOT drawn for invisible node
        expect(fillTextSpy).not.toHaveBeenCalledWith(expect.stringContaining('Invisible Text'), expect.any(Number), expect.any(Number));
    });
});
