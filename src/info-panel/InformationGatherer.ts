/**
 * ComfyUI MagnifyGlass - Info Panel Information Gatherer (TypeScript)
 * 
 * Complete Information Gatherer extracted from magnify_info_panel.js
 * Responsible for collecting information about nodes, widgets, and canvas state.
 */

import type { ComfyApp, ComfyGraph, ComfyNode, NodeInfo } from '../types/comfyui';

declare const app: ComfyApp;
declare const LiteGraph: any;

/**
 * Information Gatherer class.
 * Collects information about the current state under the cursor.
 */
export class InformationGatherer {
    constructor() { }

    getNodeUnderCursor(): ComfyNode | null {
        const magnifyGlass = window.comfyUIMagnifyGlass;
        const graph = app.canvas?.graph;
        if (!graph || !magnifyGlass) {
            return null;
        }

        // Vue nodes are DOM over the canvas: it gets no pointer moves over them and stacks them differently.
        // In pan mode (space or the hand tool) they ignore the pointer, so the canvas hit test below applies
        if ((window as any).LiteGraph?.vueNodesMode && !app.canvas.read_only) {
            const { x, y } = magnifyGlass.lastKnownMousePosition;
            // Slots stick out of the node element, so a hit on one is not a hit on the node element itself
            const nodeEl = document.elementsFromPoint(x, y).map(el => el.closest<HTMLElement>('.lg-node[data-node-id]')).find(Boolean);
            return nodeEl ? graph.getNodeById(Number(nodeEl.dataset.nodeId)) ?? null : null;
        }

        if (app.canvas.node_over) {
            return app.canvas.node_over;
        }

        const canvasRect = app.canvas.canvas.getBoundingClientRect();
        const { x, y } = magnifyGlass.lastKnownMousePosition;
        // LiteGraph draws a graph position at (pos + offset) * scale from the canvas corner
        const [graphX, graphY] = app.canvas.ds.convertCanvasToOffset([x - canvasRect.left, y - canvasRect.top]);
        return graph.getNodeOnPos(graphX, graphY) ?? null;
    }

    getDetailedNodeInfo(node: ComfyNode): NodeInfo {
        // Category and module from the node constructor or the registered node types
        let category: string | undefined;
        let executionOrder: number | undefined;
        let pythonModule: string | undefined;

        try {
            // Check for node.constructor.nodeData (ComfyUI stores metadata here)
            const nodeData = (node as any).constructor?.nodeData;
            if (nodeData) {
                pythonModule = nodeData.python_module;
                category = nodeData.category;
            }

            // Try to get from LiteGraph registered node types
            if (!pythonModule && typeof LiteGraph !== 'undefined') {
                const nodeType = (LiteGraph as any).registered_node_types?.[node.type];
                if (nodeType) {
                    category = nodeType.category || category;
                    pythonModule = nodeType.nodeData?.python_module;
                }
            }

            // Execution order - try to get from node.order (set during graph execution)
            executionOrder = (node as any).order;
        } catch (e) {
            // Silently ignore errors accessing node metadata
        }

        const subgraphNodes = this.getSubgraphNodes(node.graph);
        return {
            id: node.id,
            title: node.title || "Untitled Node",
            type: node.type,
            mode: this.getNodeModeText(node.mode),
            position: {
                x: Math.round(node.pos[0]),
                y: Math.round(node.pos[1])
            },
            size: {
                width: Math.round(node.size[0]),
                height: Math.round(node.size[1])
            },
            widgets: node.widgets || [],
            inputs: node.inputs || [],
            outputs: node.outputs || [],
            properties: node.properties || {},
            executionOrder: executionOrder,
            category: category,
            pythonModule: pythonModule,
            graphPath: subgraphNodes.map(subgraphNode => subgraphNode.subgraph!.name || 'Subgraph'),
            executionId: [...subgraphNodes, node].map(pathNode => pathNode.id).join(':'),
            locatorId: subgraphNodes.length ? `${node.graph!.id}:${node.id}` : String(node.id),
            group: node.graph?.getGroupOnPos(node.pos[0] + node.size[0] / 2, node.pos[1] + node.size[1] / 2)?.title,
            isSubgraph: !!node.isSubgraphNode?.()
        };
    }

    /**
     * The subgraph nodes that lead from the root graph to this one.
     */
    getSubgraphNodes(graph: ComfyGraph | undefined): ComfyNode[] {
        if (!graph || graph.rootGraph === graph) return [];

        const find = (nodes: ComfyNode[], path: ComfyNode[]): ComfyNode[] | null => {
            for (const node of nodes) {
                if (!node.subgraph || !node.isSubgraphNode?.()) continue;
                const subPath = [...path, node];
                const found = node.subgraph === graph ? subPath : find(node.subgraph._nodes, subPath);
                if (found) return found;
            }
            return null;
        };
        return find(graph.rootGraph._nodes, []) ?? [];
    }

    getNodeModeText(mode: number): string {
        const modes: { [key: number]: string } = {
            0: 'Always',
            1: 'On Event',
            2: 'Mute',
            3: 'On Trigger',
            4: 'Bypass'
        };
        return modes[mode] || `Mode ${mode}`;
    }
}
