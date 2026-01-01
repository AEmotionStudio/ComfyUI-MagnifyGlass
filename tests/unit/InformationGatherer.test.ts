/**
 * InformationGatherer Unit Tests
 * 
 * Tests for the InformationGatherer class which collects node and canvas information.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock ComfyUI app
vi.mock('/scripts/app.js', () => ({
    app: {
        graph: {
            _nodes: []
        },
        canvas: {
            canvas: {
                getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 })
            },
            node_over: null,
            ds: { scale: 1, offset: [0, 0] }
        }
    }
}));

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
    lastKnownMousePosition: { x: 200, y: 200 },
    isOverMedia: false,
    currentMediaElement: null
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
        // Reset mock state
        mockMagnifyGlass.isOverMedia = false;
        mockMagnifyGlass.currentMediaElement = null;
    });

    describe('constructor', () => {
        it('should create an instance', () => {
            expect(gatherer).toBeDefined();
        });
    });

    describe('gatherInformation', () => {
        it('should return a GatheredInfo object with required fields', () => {
            const info = gatherer.gatherInformation();

            expect(info).toHaveProperty('timestamp');
            expect(info).toHaveProperty('cursor');
            expect(info).toHaveProperty('zoom');
            expect(info).toHaveProperty('nodeCount');
            expect(info).toHaveProperty('hoveredNode');
            expect(info).toHaveProperty('hoveredWidget');
            expect(info).toHaveProperty('mediaElement');
        });

        it('should return cursor position from magnifyGlass state', () => {
            const info = gatherer.gatherInformation();

            expect(info.cursor.screenX).toBe(200);
            expect(info.cursor.screenY).toBe(200);
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

    describe('formatValue', () => {
        it('should format null values', () => {
            expect(gatherer.formatValue(null)).toBe('null');
        });

        it('should format undefined values', () => {
            expect(gatherer.formatValue(undefined)).toBe('undefined');
        });

        it('should format string values as-is', () => {
            expect(gatherer.formatValue('hello world')).toBe('hello world');
        });

        it('should format integer values without decimals', () => {
            expect(gatherer.formatValue(42)).toBe('42');
        });

        it('should format float values with 3 decimals', () => {
            expect(gatherer.formatValue(3.14159)).toBe('3.142');
        });

        it('should format boolean values', () => {
            expect(gatherer.formatValue(true)).toBe('true');
            expect(gatherer.formatValue(false)).toBe('false');
        });

        it('should format arrays with length', () => {
            expect(gatherer.formatValue([1, 2, 3])).toBe('Array(3)');
        });

        it('should format objects as "Object"', () => {
            expect(gatherer.formatValue({ key: 'value' })).toBe('Object');
        });
    });

    describe('getNodeModeText', () => {
        it('should return "Always" for mode 0', () => {
            expect(gatherer.getNodeModeText(0)).toBe('Always');
        });

        it('should return "On Event" for mode 1', () => {
            expect(gatherer.getNodeModeText(1)).toBe('On Event');
        });

        it('should return "Never" for mode 2', () => {
            expect(gatherer.getNodeModeText(2)).toBe('Never');
        });

        it('should return fallback for unknown modes', () => {
            expect(gatherer.getNodeModeText(99)).toBe('Mode 99');
        });
    });
});
