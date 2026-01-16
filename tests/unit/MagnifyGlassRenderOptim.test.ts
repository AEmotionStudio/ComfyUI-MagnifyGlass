
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Create hoisted mocks
const { appMock } = vi.hoisted(() => {
    return {
        appMock: {
            registerExtension: vi.fn(),
            ui: {
                settings: {
                    getSettingValue: vi.fn(),
                    setSettingValue: vi.fn(),
                }
            },
            canvas: {
                ds: {
                    scale: 1,
                    offset: [0, 0]
                }
            },
            graph: {
                _nodes: [] as any[]
            }
        }
    };
});

// Attach to global for files that rely on global variable 'app'
// @ts-ignore
globalThis.app = appMock;

vi.mock('/scripts/app.js', () => ({
    app: appMock
}));

// Import after mocks are set up
import { MagnifyGlass } from '../../src/magnify-glass/MagnifyGlass';

describe('MagnifyGlass Rendering Optimization', () => {
    let magnifyGlass: MagnifyGlass;
    let canvasMock: HTMLCanvasElement;
    let canvasGetBoundingClientRectSpy: any;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Reset appMock state
        appMock.graph._nodes = [];

        // Setup document body
        document.body.innerHTML = '<canvas id="graph-canvas" width="1000" height="800"></canvas>';
        canvasMock = document.getElementById('graph-canvas') as HTMLCanvasElement;

        // Mock getBoundingClientRect
        canvasGetBoundingClientRectSpy = vi.spyOn(canvasMock, 'getBoundingClientRect').mockReturnValue({
            x: 0, y: 0, width: 1000, height: 800, top: 0, left: 0, right: 1000, bottom: 800, toJSON: () => {}
        });

        // Initialize MagnifyGlass manually
        magnifyGlass = new MagnifyGlass();
        magnifyGlass.litegraphCanvas = canvasMock;

        // Mock UI container
        magnifyGlass.ui.htmlOverlayContainer = document.createElement('div');

        // Setup state
        magnifyGlass.state.active = true;
        magnifyGlass.state.canvasScale = 1;
        magnifyGlass.state.x = 500;
        magnifyGlass.state.y = 400;

        // Setup config
        magnifyGlass.config.glassSize = 300;
        magnifyGlass.config.zoomFactor = 2;

        // Trigger calculateSourceRegion
        magnifyGlass.calculateSourceRegion();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    it('should call getBoundingClientRect multiple times (inefficiently) before optimization', () => {
        // Setup nodes and widgets
        const numNodes = 5;
        const widgetsPerNode = 3;

        const nodes = [];
        for (let i = 0; i < numNodes; i++) {
            const widgets = [];
            for (let j = 0; j < widgetsPerNode; j++) {
                const el = document.createElement('div');
                const videoEl = document.createElement('video');
                el.appendChild(videoEl);

                widgets.push({
                    type: 'custom',
                    element: el
                });
            }

            nodes.push({
                pos: [400, 300],
                size: [200, 200],
                widgets: widgets
            });
        }

        appMock.graph._nodes = nodes;

        // Mock widget getBoundingClientRect
        vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            x: 450, y: 350, width: 100, height: 100, top: 350, left: 450, right: 550, bottom: 450, toJSON: () => {}
        });

        // Run renderHtmlOverlays
        magnifyGlass.renderHtmlOverlays();

        // Calculate expected calls
        // 1 call in setup (calculateSourceRegion)
        // 1 call in renderHtmlOverlays (top level)
        // 0 calls inside loop (optimization)
        const expectedCalls = 2;

        // After optimization, this should pass
        expect(canvasGetBoundingClientRectSpy).toHaveBeenCalledTimes(expectedCalls);
    });
});
