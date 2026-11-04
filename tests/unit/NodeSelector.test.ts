/**
 * NodeSelector Unit Tests
 * 
 * Tests for the NodeSelector class which provides methods to fetch and sort nodes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock ComfyUI app
const mockNodes = [
    { id: 1, title: 'KSampler', type: 'KSampler', order: 5 },
    { id: 2, title: 'Load Checkpoint', type: 'CheckpointLoader', order: 1 },
    { id: 3, title: 'CLIP Text Encode', type: 'CLIPTextEncode', order: 2 },
    { id: 4, title: 'Empty Latent', type: 'EmptyLatentImage', order: 3 },
    { id: 5, title: 'VAE Decode', type: 'VAEDecode', order: 6 },
    { id: 6, title: 'Save Image', type: 'SaveImage', order: 7 },
    { id: 7, title: 'Untitled', type: 'Unknown' } // No order
];

const graphOf = (nodes: any[]) => ({
    _nodes: nodes,
    getNodeById: (id: number) => nodes.find(n => n.id === id) || null
});

// app.graph is always the root graph; the canvas holds the graph on screen
const mockApp: any = {
    graph: graphOf([]),
    canvas: { graph: graphOf(mockNodes) }
};

(globalThis as any).app = mockApp;

import { NodeSelector } from '../../src/info-panel/NodeSelector';

describe('NodeSelector', () => {
    let selector: NodeSelector;

    beforeEach(() => {
        selector = new NodeSelector();
    });

    describe('getAllNodes', () => {
        it('should return all nodes from the graph', () => {
            const nodes = selector.getAllNodes();
            expect(nodes).toHaveLength(7);
        });

        it('should return empty array when graph is undefined', () => {
            const originalApp = (globalThis as any).app;
            (globalThis as any).app = undefined;

            const newSelector = new NodeSelector();
            expect(newSelector.getAllNodes()).toEqual([]);

            (globalThis as any).app = originalApp;
        });
    });

    describe('getNodesSortedByExecOrder', () => {
        it('should return nodes sorted by execution order', () => {
            const nodes = selector.getNodesSortedByExecOrder();

            // Should exclude node 7 (no order)
            expect(nodes).toHaveLength(6);

            expect(nodes[0].order).toBe(1);
            expect(nodes[0].title).toBe('Load Checkpoint');

            expect(nodes[1].order).toBe(2);
            expect(nodes[1].title).toBe('CLIP Text Encode');

            expect(nodes[5].order).toBe(7);
            expect(nodes[5].title).toBe('Save Image');
        });

        it('should filter out nodes without valid execution order', () => {
            const nodes = selector.getNodesSortedByExecOrder();
            const untitledNode = nodes.find(n => n.title === 'Untitled');

            expect(untitledNode).toBeUndefined();
        });
    });

    describe('getNodeById', () => {
        it('should return the correct node by ID', () => {
            const node = selector.getNodeById(3);

            expect(node).toBeDefined();
            expect(node?.id).toBe(3);
            expect(node?.title).toBe('CLIP Text Encode');
        });

        it('should return null for non-existent ID', () => {
            const node = selector.getNodeById(999);
            expect(node).toBeNull();
        });
    });

    describe('search', () => {
        it('lists every node by execution order, nodes without one last', () => {
            const results = selector.search('');

            expect(results.map(n => n.id)).toEqual([2, 3, 4, 1, 5, 6, 7]);
            expect(results[0]).toEqual({ id: 2, title: 'Load Checkpoint', type: 'CheckpointLoader', order: 1 });
            expect(results[6].order).toBe(-1);
        });

        it('matches title or type in any case', () => {
            expect(selector.search('KSAMPLER').map(n => n.id)).toEqual([1]);
            expect(selector.search('latentimage').map(n => n.id)).toEqual([4]);
            expect(selector.search('  encode ').map(n => n.id)).toEqual([3]);
            expect(selector.search('xyz123')).toEqual([]);
        });

        it('matches an id given as #id or plainly', () => {
            expect(selector.search('#5').map(n => n.id)).toEqual([5]);
            expect(selector.search('6').map(n => n.id)).toEqual([6]);
            expect(selector.search('#').length).toBe(7);
            expect(selector.search('#55')).toEqual([]);
        });
    });

    describe('inside a subgraph', () => {
        it('should list and resolve nodes of the graph on screen, not the root graph', () => {
            const rootCanvasGraph = mockApp.canvas.graph;
            mockApp.graph = graphOf(mockNodes);
            mockApp.canvas.graph = graphOf([{ id: 1, title: 'Inner Sampler', type: 'KSampler', order: 0 }]);

            expect(selector.getAllNodes()).toHaveLength(1);
            expect(selector.getNodeById(1)?.title).toBe('Inner Sampler');
            expect(selector.getNodeById(3)).toBeNull();

            mockApp.graph = graphOf([]);
            mockApp.canvas.graph = rootCanvasGraph;
        });
    });
});
