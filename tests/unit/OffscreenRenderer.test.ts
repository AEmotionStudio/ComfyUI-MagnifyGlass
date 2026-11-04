
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Create hoisted mocks
const { appMock } = vi.hoisted(() => {
    return {
        appMock: {
            ui: {
                settings: {
                    getSettingValue: (_key: string): any => undefined
                }
            },
            canvas: {
                ds: {
                    scale: 1,
                    offset: [0, 0]
                },
                visible_nodes: [] as any[],
                graph: { _nodes: [] as any[] }
            } as any
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

// LiteGraph keeps boundingRect up to date for visible nodes: the body plus the 30px title above it
const lgNode = (pos: number[], size: number[], extra: Record<string, unknown> = {}) =>
    ({ pos, size, boundingRect: [pos[0], pos[1] - 30, size[0], size[1] + 30], ...extra });

describe('OffscreenRenderer Optimization', () => {
    let renderer: OffscreenRenderer;
    let configMock: ConfigManager;
    let stateMock: MagnifierState;
    let canvasMock: HTMLCanvasElement;

    beforeEach(() => {
        vi.clearAllMocks();
        appMock.canvas = { ds: { scale: 1, offset: [0, 0] }, visible_nodes: [], graph: { _nodes: [] } };

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
                    rect: vi.fn(),
                });
                return canvas;
            }
            return originalCreateElement(tagName);
        });

        renderer = new OffscreenRenderer(configMock, stateMock);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should identify visible nodes and render them', () => {
        // Setup nodes
        // Node 1: Visible (at 50, 50, size 100x100)
        // Cursor at 100, 100. Glass size 200, zoom 2. Source size 100.
        // Capture region: 50 to 150.
        // Node 1 overlaps.
        const visibleNode = lgNode([50, 50], [100, 100], {
            widgets: [
                { type: 'text', name: 'visible_widget', value: 'Visible Text', computedHeight: 50, last_y: 40 }
            ]
        });
        // Node 2: Not Visible (far away)
        const invisibleNode = lgNode([1000, 1000], [100, 100], {
            widgets: [
                { type: 'text', name: 'invisible_widget', value: 'Invisible Text', computedHeight: 50, last_y: 40 }
            ]
        });

        appMock.canvas.visible_nodes = [visibleNode, invisibleNode];

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

    describe('media in the glass', () => {
        const PREVIEW_WIDGET = '$$canvas-image-preview';

        const targetCanvas = (left: number, top: number, dpr: number) => {
            const canvas = document.createElement('canvas');
            canvas.width = 1000 * dpr;
            canvas.height = 800 * dpr;
            vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
                x: left, y: top, left, top, width: 1000, height: 800, right: left + 1000, bottom: top + 800, toJSON: () => {}
            } as DOMRect);
            return canvas;
        };

        const image = (src: string, naturalWidth: number, naturalHeight: number) => {
            const img = document.createElement('img');
            img.src = src;
            Object.defineProperty(img, 'naturalWidth', { value: naturalWidth });
            Object.defineProperty(img, 'naturalHeight', { value: naturalHeight });
            Object.defineProperty(img, 'complete', { value: true });
            return img;
        };

        const domVideo = (readyState: number) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'dom-widget';
            const video = document.createElement('video');
            video.src = '/view?filename=clip.mp4&type=output';
            Object.defineProperty(video, 'readyState', { value: readyState });
            Object.defineProperty(video, 'videoWidth', { value: 40 });
            Object.defineProperty(video, 'videoHeight', { value: 30 });
            vi.spyOn(video, 'getBoundingClientRect').mockReturnValue({
                x: 280, y: 180, left: 280, top: 180, width: 40, height: 30, right: 320, bottom: 210, toJSON: () => {}
            } as DOMRect);
            wrapper.appendChild(video);
            document.body.appendChild(wrapper);
            return video;
        };

        const drawsOf = (el: unknown) =>
            ((renderer as any).offscreenCtx.drawImage as ReturnType<typeof vi.fn>).mock.calls.filter(c => c[0] === el);

        const previewNode = (img: HTMLImageElement, extra: Record<string, unknown> = {}) => lgNode([150, 100], [200, 300], {
            imgs: [img],
            widgets: [{ name: PREVIEW_WIDGET, type: 'custom', y: 40, computedHeight: 215 }],
            ...extra
        });

        const domImage = (left: number, top: number) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'dom-widget';
            const img = image('/view?filename=b.png&type=output', 40, 30);
            vi.spyOn(img, 'getBoundingClientRect').mockReturnValue({
                x: left, y: top, left, top, width: 40, height: 30, right: left + 40, bottom: top + 30, toJSON: () => {}
            } as DOMRect);
            wrapper.appendChild(img);
            document.body.appendChild(wrapper);
            return img;
        };

        afterEach(() => {
            document.body.innerHTML = '';
            delete (window as any).LiteGraph;
        });

        it('draws a canvas preview image at its frontend box in Direct Capture (scale 1.5, panned)', () => {
            appMock.canvas.ds = { scale: 1.5, offset: [-40, 20] };
            const img = image('/view?filename=a.png&type=output', 100, 50);
            appMock.canvas.visible_nodes = [previewNode(img)];
            stateMock.x = 300;
            stateMock.y = 380;

            renderer.renderHighResRegion(targetCanvas(0, 0, 1));

            // Node-local box (50, 115, 100x50) -> CSS ((150+50-40)*1.5, (100+115+20)*1.5) = (240, 352.5)
            // Capture region left 250, top 330, k 2 -> glass (-20, 45, 300x150)
            expect(drawsOf(img)).toEqual([[img, -20, 45, 300, 150]]);
        });

        it('puts a node in front of a preview back over it from the capture', () => {
            const img = image('/view?filename=a.png&type=output', 100, 50);
            const front = lgNode([200, 250], [100, 100], { widgets: [] });
            const behind = lgNode([190, 190], [40, 40], { widgets: [] });
            appMock.canvas.visible_nodes = [behind, previewNode(img), front];
            stateMock.x = 250;
            stateMock.y = 250;
            const canvas = targetCanvas(0, 0, 1);

            renderer.renderHighResRegion(canvas);

            const ctx = (renderer as any).offscreenCtx;
            // Capture, preview, then the capture again clipped to the node after the preview node only:
            // with its title (200, 220, 100x130) -> glass (0, 40, 200x260)
            expect(ctx.drawImage.mock.calls.map((c: unknown[]) => c[0])).toEqual([canvas, img, canvas]);
            expect(ctx.rect.mock.calls).toEqual([[0, 40, 200, 260]]);
        });

        it('puts a collapsed node in front back over a preview, and draws no preview for a collapsed node', () => {
            const img = image('/view?filename=a.png&type=output', 100, 50);
            const hidden = image('/view?filename=c.png&type=output', 100, 50);
            // Collapsed: LiteGraph draws only the title pill, so boundingRect is the collapsed width by the title height
            const front = previewNode(hidden, { pos: [220, 260], flags: { collapsed: true }, boundingRect: [220, 230, 60, 30] });
            appMock.canvas.visible_nodes = [previewNode(img), front];
            stateMock.x = 250;
            stateMock.y = 250;
            const canvas = targetCanvas(0, 0, 1);

            renderer.renderHighResRegion(canvas);

            const ctx = (renderer as any).offscreenCtx;
            // Pill (220, 230, 60x30) -> glass (40, 60, 120x60)
            expect(ctx.drawImage.mock.calls.map((c: unknown[]) => c[0])).toEqual([canvas, img, canvas]);
            expect(ctx.rect.mock.calls).toEqual([[40, 60, 120, 60]]);
        });

        it('puts a node back whose title alone reaches into the glass', () => {
            const img = image('/view?filename=a.png&type=output', 100, 50);
            // Capture region is y 200-300; this body starts at 310, its title at 280
            const front = lgNode([200, 310], [100, 100], { widgets: [] });
            appMock.canvas.visible_nodes = [previewNode(img), front];
            stateMock.x = 250;
            stateMock.y = 250;

            renderer.renderHighResRegion(targetCanvas(0, 0, 1));

            expect((renderer as any).offscreenCtx.rect.mock.calls).toEqual([[0, 160, 200, 260]]);
        });

        it('only measures DOM media under the glass', () => {
            const near = domImage(280, 180);
            const far = domImage(900, 700);
            const style = vi.spyOn(globalThis, 'getComputedStyle');
            stateMock.x = 300;
            stateMock.y = 200;

            renderer.renderHighResRegion(targetCanvas(0, 0, 1));

            expect(style.mock.calls.map(c => c[0])).toEqual([near]);
            expect(drawsOf(near)).toHaveLength(1);
            expect(drawsOf(far)).toHaveLength(0);
        });

        it('passes client coordinates to setZoom', () => {
            appMock.canvas.ds = { scale: 0.5, offset: [0, 0] };
            appMock.canvas.setZoom = vi.fn((s: number) => { appMock.canvas.ds.scale = s; });
            appMock.canvas.draw = vi.fn();
            const img = image('/view?filename=a.png&type=output', 100, 50);
            const node = previewNode(img);
            appMock.canvas.graph._nodes = [node];
            stateMock.x = 300;
            stateMock.y = 200;

            renderer.renderHighResRegion(targetCanvas(100, 50, 1));

            expect(appMock.canvas.setZoom).toHaveBeenCalledWith(1, [400, 250]);
            expect(appMock.canvas.ds.scale).toBe(0.5);
            expect((window as any).__magnifyGlassCapturing).toBe(false);
            expect(node.imgs).toEqual([img]);
        });

        it('maps a DOM video the same way at DPR 1 and DPR 2', () => {
            const video = domVideo(4);

            stateMock.x = 300;
            stateMock.y = 200;
            renderer.renderHighResRegion(targetCanvas(0, 0, 1));

            stateMock.x = 600;
            stateMock.y = 400;
            renderer.renderHighResRegion(targetCanvas(0, 0, 2));

            expect(drawsOf(video)).toEqual([[video, 60, 60, 80, 60], [video, 60, 60, 80, 60]]);
        });

        it('skips a DOM video that has no current frame', () => {
            const video = domVideo(1);
            renderer.renderHighResRegion(targetCanvas(0, 0, 1));
            expect(drawsOf(video)).toHaveLength(0);
        });

        it('never draws a cross-origin image', () => {
            const img = image('https://other.example/a.png', 100, 50);
            appMock.canvas.visible_nodes = [previewNode(img)];
            const wrapper = document.createElement('div');
            wrapper.className = 'dom-widget';
            const domImg = image('https://other.example/b.png', 40, 30);
            vi.spyOn(domImg, 'getBoundingClientRect').mockReturnValue({
                x: 280, y: 180, left: 280, top: 180, width: 40, height: 30, right: 320, bottom: 210, toJSON: () => {}
            } as DOMRect);
            wrapper.appendChild(domImg);
            document.body.appendChild(wrapper);
            stateMock.x = 300;
            stateMock.y = 200;

            renderer.renderHighResRegion(targetCanvas(0, 0, 1));

            expect(drawsOf(img)).toHaveLength(0);
            expect(drawsOf(domImg)).toHaveLength(0);
        });

        it('uses Direct Capture with Vue node media when Vue nodes mode is on', () => {
            (window as any).LiteGraph = { vueNodesMode: true };
            appMock.canvas.ds = { scale: 0.5, offset: [0, 0] };
            appMock.canvas.setZoom = vi.fn();
            appMock.canvas.draw = vi.fn();
            const node = document.createElement('div');
            node.setAttribute('data-node-id', '7');
            const img = image('/view?filename=a.png&type=output', 40, 30);
            vi.spyOn(img, 'getBoundingClientRect').mockReturnValue({
                x: 280, y: 180, left: 280, top: 180, width: 40, height: 30, right: 320, bottom: 210, toJSON: () => {}
            } as DOMRect);
            node.appendChild(img);
            document.body.appendChild(node);
            stateMock.x = 300;
            stateMock.y = 200;

            renderer.renderHighResRegion(targetCanvas(0, 0, 1));

            expect(appMock.canvas.setZoom).not.toHaveBeenCalled();
            expect(appMock.canvas.draw).not.toHaveBeenCalled();
            expect(drawsOf(img)).toEqual([[img, 60, 60, 80, 60]]);
        });

        it('caps Virtual Zoom near 60 fps and draws the video on each rendered frame', () => {
            appMock.canvas.ds = { scale: 0.5, offset: [0, 0] };
            appMock.canvas.setZoom = vi.fn((s: number) => {
                appMock.canvas.ds.scale = s;
                appMock.canvas.ds.offset = [0, 0];
            });
            appMock.canvas.draw = vi.fn(() => { appMock.canvas.ds.scale = 0.5; });
            const video = domVideo(4);
            stateMock.x = 300;
            stateMock.y = 200;
            const canvas = targetCanvas(0, 0, 1);
            const now = vi.spyOn(performance, 'now').mockReturnValue(1000);

            const first = renderer.renderHighResRegion(canvas);
            now.mockReturnValue(1007); // next frame on a 144 Hz display
            const skipped = renderer.renderHighResRegion(canvas);
            now.mockReturnValue(1017); // next frame on a 60 Hz display
            renderer.renderHighResRegion(canvas);

            expect(skipped).toBe(first);
            expect(appMock.canvas.draw).toHaveBeenCalledTimes(4);
            // Measured at 0.5, scaled x2 about the pivot (300, 200) -> (260, 160, 80x60) -> glass (20, 20, 160x120)
            expect(drawsOf(video)).toEqual([[video, 20, 20, 160, 120], [video, 20, 20, 160, 120]]);
        });
    });
});
