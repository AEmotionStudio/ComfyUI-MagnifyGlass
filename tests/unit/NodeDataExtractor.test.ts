import { describe, it, expect } from 'vitest';
import { getSlotLinks } from '../../src/info-panel/NodeDataExtractor';

describe('getSlotLinks', () => {
    // Nodes and links as LiteGraph keeps them; getInputNode follows an input's link to its origin
    const makeGraph = () => {
        const graph: any = { _nodes: [], links: new Map() };
        graph.getNodeById = (id: number) => graph._nodes.find((n: any) => n.id === id) ?? null;
        return graph;
    };
    const addNode = (graph: any, id: number, title: string, inputs: any[] = [], outputs: any[] = [], required: string[] = []) => {
        class Node {
            static nodeData = { input: { required: Object.fromEntries(required.map(name => [name, ['IMAGE']])) } };
            id = id;
            title = title;
            graph = graph;
            inputs = inputs;
            outputs = outputs;
            getInputNode(slot: number) {
                const link = graph.links.get(this.inputs[slot].link);
                return link ? graph.getNodeById(link.origin_id) : null;
            }
        }
        const node = new Node();
        graph._nodes.push(node);
        return node;
    };
    const link = (graph: any, id: number, origin: any, originSlot: number, target: any, targetSlot: number) => {
        graph.links.set(id, { origin_id: origin.id, origin_slot: originSlot, target_id: target.id, target_slot: targetSlot });
        (origin.outputs[originSlot].links ??= []).push(id);
        target.inputs[targetSlot].link = id;
    };

    it('names the nodes at the other end of each link, flags required inputs with nothing connected, and leaves out unlinked widget inputs', () => {
        const graph = makeGraph();
        const loader = addNode(graph, 1, 'Load Checkpoint', [], [
            { name: 'MODEL', type: 'MODEL', links: null },
            { name: 'CLIP', type: 'CLIP', localized_name: 'CLIP', links: null }
        ]);
        const sampler = addNode(graph, 2, 'KSampler', [
            { name: 'model', type: 'MODEL', link: null },
            { name: 'positive', type: 'CONDITIONING', label: 'Positive prompt', link: null },
            { name: 'latent_image', type: 'LATENT', link: null },
            { name: 'seed', type: 'INT', widget: { name: 'seed' }, link: null },
            { name: 'cfg', type: 'FLOAT', widget: { name: 'cfg' }, link: null }
        ], [], ['model', 'positive', 'latent_image']);
        const encode = addNode(graph, 3, '', [{ name: 'clip', type: 'CLIP', link: null }]);
        const prim = addNode(graph, 4, 'CFG', [], [{ name: 'FLOAT', type: 'FLOAT', links: null }]);
        link(graph, 10, loader, 0, sampler, 0);
        link(graph, 11, loader, 1, encode, 0);
        link(graph, 12, prim, 0, sampler, 4);
        // A subgraph's own input and output nodes are not in graph._nodes
        graph.inputs = [{ name: 'positive', label: 'Prompt', type: 'CONDITIONING' }];
        graph.outputs = [{ name: 'LATENT', type: 'LATENT' }];
        sampler.inputs[1].link = 13;
        graph.links.set(13, { origin_id: -10, origin_slot: 0, target_id: 2, target_slot: 1 });

        expect(getSlotLinks(sampler as any)).toEqual({
            inputs: [
                { name: 'model', type: 'MODEL', linked: [{ id: 1, title: 'Load Checkpoint', slot: 'MODEL' }], missing: false },
                { name: 'Positive prompt', type: 'CONDITIONING', linked: [{ title: 'Subgraph input', slot: 'Prompt' }], missing: false },
                { name: 'latent_image', type: 'LATENT', linked: [], missing: true },
                { name: 'cfg', type: 'FLOAT', linked: [{ id: 4, title: 'CFG', slot: 'FLOAT' }], missing: false }
            ],
            outputs: []
        });

        link(graph, 14, loader, 0, addNode(graph, 5, 'Upscale', [{ name: 'model', label: 'Model in', type: 'MODEL', link: null }]), 0);
        loader.outputs[0].links.push(15);
        graph.links.set(15, { origin_id: 1, origin_slot: 0, target_id: -20, target_slot: 0 });
        expect(getSlotLinks(loader as any).outputs).toEqual([
            { name: 'MODEL', type: 'MODEL', linked: [{ id: 2, title: 'KSampler', slot: 'model' }, { id: 5, title: 'Upscale', slot: 'Model in' }, { title: 'Subgraph output', slot: 'LATENT' }] },
            { name: 'CLIP', type: 'CLIP', linked: [{ id: 3, title: 'Untitled', slot: 'clip' }] }
        ]);
        // Without a node definition, such as a subgraph node, nothing is required
        const subgraphNode = { id: 6, title: 'Subgraph', graph, inputs: [{ name: 'image', type: 'IMAGE', link: null }], outputs: [], getInputNode: () => null };
        expect(getSlotLinks(subgraphNode as any).inputs).toEqual([{ name: 'image', type: 'IMAGE', linked: [], missing: false }]);
    });
});
