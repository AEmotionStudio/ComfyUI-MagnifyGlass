/**
 * InformationGatherer Unit Tests
 * 
 * Tests for the InformationGatherer class which collects node and canvas information.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock ComfyUI app as a global (ComfyUI exposes it on window/globalThis)
const mockApp: any = {
    canvas: {
        graph: {
            _nodes: [],
            getNodeOnPos: () => null
        },
        canvas: {
            getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 })
        },
        node_over: null,
        ds: { scale: 1, offset: [0, 0] }
    }
};

(globalThis as any).app = mockApp;

// Mock window.comfyUIMagnifyGlass
const mockMagnifyGlass = {
    state: {
        x: 100,
        y: 100,
        canvasScale: 1,
        canvasOffsetX: 0,
        canvasOffsetY: 0,
        sourceX: 50,
        sourceY: 50,
        sourceWidth: 100,
        sourceHeight: 100
    },
    config: {
        zoomFactor: 3,
        offsetX: 0,
        offsetY: 0
    },
    lastKnownMousePosition: { x: 200, y: 200 }
};

Object.defineProperty(globalThis, 'window', {
    value: {
        comfyUIMagnifyGlass: mockMagnifyGlass
    },
    writable: true
});

import { InformationGatherer } from '../../src/info-panel/InformationGatherer';

describe('InformationGatherer', () => {
    let gatherer: InformationGatherer;

    beforeEach(() => {
        gatherer = new InformationGatherer();
    });

    describe('constructor', () => {
        it('should create an instance', () => {
            expect(gatherer).toBeDefined();
        });
    });

    describe('gatherInformation', () => {
        it('should return a GatheredInfo object with required fields', () => {
            const info = gatherer.gatherInformation();

            expect(Object.keys(info).sort()).toEqual(['cursor', 'hoveredNode', 'zoom']);
        });

        it('should return cursor position from magnifyGlass state', () => {
            const info = gatherer.gatherInformation();

            expect(info.cursor.canvasX).toBe(100);
            expect(info.cursor.canvasY).toBe(100);
        });

        it('should return zoom from canvas scale', () => {
            const info = gatherer.gatherInformation();
            expect(info.zoom).toBe(1);
        });

        it('should return null for hoveredNode when no node is hovered', () => {
            const info = gatherer.gatherInformation();
            expect(info.hoveredNode).toBeNull();
        });
    });

    describe('getNodeUnderCursor', () => {
        it('should hit-test the graph on screen, title bar and collapsed nodes included', () => {
            // A collapsed node in a subgraph: only its title pill sits above pos
            const node = { id: 3, pos: [190, 230], size: [140, 80], flags: { collapsed: true } };
            const getNodeOnPos = vi.fn(() => node);
            const canvasGraph = mockApp.canvas.graph;
            mockApp.canvas.graph = { _nodes: [node], getNodeOnPos };

            const hit = gatherer.getNodeUnderCursor();

            expect(getNodeOnPos).toHaveBeenCalledWith(200, 200);
            expect(hit).toBe(node);
            mockApp.canvas.graph = canvasGraph;
        });
    });

    describe('getNodeModeText', () => {
        it('should return "Always" for mode 0', () => {
            expect(gatherer.getNodeModeText(0)).toBe('Always');
        });

        it('should return "On Event" for mode 1', () => {
            expect(gatherer.getNodeModeText(1)).toBe('On Event');
        });

        it('names modes 2 and 4 as ComfyUI does', () => {
            expect(gatherer.getNodeModeText(2)).toBe('Mute');
            expect(gatherer.getNodeModeText(4)).toBe('Bypass');
        });

        it('should return fallback for unknown modes', () => {
            expect(gatherer.getNodeModeText(99)).toBe('Mode 99');
        });
    });
});
