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

const mockApp = {
    graph: {
        _nodes: mockNodes,
        getNodeById: (id: number) => mockNodes.find(n => n.id === id) || null
    }
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

    describe('getNodesSortedByTitle', () => {
        it('should return nodes sorted alphabetically by title', () => {
            const nodes = selector.getNodesSortedByTitle();

            expect(nodes[0].title).toBe('CLIP Text Encode');
            expect(nodes[1].title).toBe('Empty Latent');
            expect(nodes[2].title).toBe('KSampler');
            expect(nodes[3].title).toBe('Load Checkpoint');
            expect(nodes[4].title).toBe('Save Image');
            expect(nodes[5].title).toBe('Untitled');
            expect(nodes[6].title).toBe('VAE Decode');
        });

        it('should include id, title, and type in each entry', () => {
            const nodes = selector.getNodesSortedByTitle();
            const ksamplerNode = nodes.find(n => n.id === 1);

            expect(ksamplerNode).toBeDefined();
            expect(ksamplerNode?.id).toBe(1);
            expect(ksamplerNode?.title).toBe('KSampler');
            expect(ksamplerNode?.type).toBe('KSampler');
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

    describe('searchByTitle', () => {
        it('should find nodes matching partial title (case-insensitive)', () => {
            const results = selector.searchByTitle('sample');

            expect(results).toHaveLength(1);
            expect(results[0].title).toBe('KSampler');
        });

        it('should find multiple matches', () => {
            const results = selector.searchByTitle('e');

            // CLIP Text Encode, Empty Latent, KSampler, Load Checkpoint, Save Image, VAE Decode
            expect(results.length).toBeGreaterThan(1);
        });

        it('should return empty array for no matches', () => {
            const results = selector.searchByTitle('xyz123');
            expect(results).toEqual([]);
        });

        it('should be case-insensitive', () => {
            const results1 = selector.searchByTitle('KSAMPLER');
            const results2 = selector.searchByTitle('ksampler');

            expect(results1).toHaveLength(1);
            expect(results2).toHaveLength(1);
            expect(results1[0].id).toBe(results2[0].id);
        });
    });

    describe('getNodeCount', () => {
        it('should return the total number of nodes', () => {
            expect(selector.getNodeCount()).toBe(7);
        });
    });
});
