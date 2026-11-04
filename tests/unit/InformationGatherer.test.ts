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

        it('takes the topmost Vue node element under the pointer in Vue nodes mode', () => {
            // LiteGraph's own hit test and node_over disagree with what Vue stacks on top
            const front = { id: 7 };
            const nodes: Record<number, any> = { 3: { id: 3 }, 7: front };
            const canvasGraph = mockApp.canvas.graph;
            const getNodeOnPos = vi.fn(() => nodes[3]);
            mockApp.canvas.graph = { _nodes: Object.values(nodes), getNodeOnPos, getNodeById: (id: number) => nodes[id] ?? null };
            mockApp.canvas.node_over = nodes[3];
            (window as any).LiteGraph = { vueNodesMode: true };
            // The panel's rows carry data-node-id too, and sit above the nodes
            const panelRow = document.createElement('div');
            panelRow.dataset.nodeId = '3';
            // A slot dot sticks out of its node, so the node element itself is not under the pointer
            const slot = document.createElement('div');
            const frontEl = document.createElement('div');
            frontEl.className = 'lg-node';
            frontEl.dataset.nodeId = '7';
            frontEl.appendChild(slot);
            const backEl = document.createElement('div');
            backEl.className = 'lg-node';
            backEl.dataset.nodeId = '3';
            const elementsFromPoint = vi.fn(() => [panelRow, slot, backEl]);
            (document as any).elementsFromPoint = elementsFromPoint;

            expect(gatherer.getNodeUnderCursor()).toBe(front);
            expect(elementsFromPoint).toHaveBeenCalledWith(200, 200);
            expect(getNodeOnPos).not.toHaveBeenCalled();

            elementsFromPoint.mockReturnValue([]);
            expect(gatherer.getNodeUnderCursor()).toBeNull();

            // In pan mode Vue nodes are pointer-events: none, so the canvas hit test finds the node
            mockApp.canvas.read_only = true;
            mockApp.canvas.node_over = null;
            expect(gatherer.getNodeUnderCursor()).toBe(nodes[3]);
            expect(getNodeOnPos).toHaveBeenCalledWith(200, 200);

            delete mockApp.canvas.read_only;
            delete (window as any).LiteGraph;
            delete (document as any).elementsFromPoint;
            mockApp.canvas.node_over = null;
            mockApp.canvas.graph = canvasGraph;
        });
    });

    describe('getDetailedNodeInfo', () => {
        it('names the subgraphs on the way to the node, runs it by their nodes\' ids and finds its outputs by its subgraph\'s', () => {
            const root: any = { _nodes: [], getGroupOnPos: () => undefined };
            root.rootGraph = root;
            const outer: any = { name: 'Outer', rootGraph: root, _nodes: [], getGroupOnPos: () => undefined };
            const inner: any = { id: 'inner-uuid', name: '', rootGraph: root, _nodes: [], getGroupOnPos: () => undefined };
            const subgraphNode = (id: number, subgraph: any) => ({ id, subgraph, isSubgraphNode: () => true });
            root._nodes.push({ id: 2 }, subgraphNode(7, outer));
            outer._nodes.push(subgraphNode(12, inner));
            const node = (graph: any) => ({ id: 3, title: 'Sampler', type: 'KSampler', mode: 0, pos: [0, 0], size: [1, 1], graph }) as any;

            expect(gatherer.getDetailedNodeInfo(node(root))).toMatchObject({ graphPath: [], executionId: '3', locatorId: '3' });
            // ComfyUI keeps outputs by the node's own subgraph
            expect(gatherer.getDetailedNodeInfo(node(inner))).toMatchObject({ graphPath: ['Outer', 'Subgraph'], executionId: '7:12:3', locatorId: 'inner-uuid:3' });
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
