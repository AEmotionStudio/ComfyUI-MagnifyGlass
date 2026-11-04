/**
 * ComfyUI MagnifyGlass - Info Panel Information Gatherer (TypeScript)
 * 
 * Complete Information Gatherer extracted from magnify_info_panel.js
 * Responsible for collecting information about nodes, widgets, and canvas state.
 */

import type { ComfyApp, ComfyGraph, ComfyNode, GatheredInfo, NodeInfo } from '../types/comfyui';

declare const app: ComfyApp;
declare const LiteGraph: any;

/**
 * Information Gatherer class.
 * Collects information about the current state under the cursor.
 */
export class InformationGatherer {
    constructor() { }

    gatherInformation(): GatheredInfo {
        const magnifyGlass = window.comfyUIMagnifyGlass;
        if (!magnifyGlass) {
            return {
                cursor: { canvasX: 0, canvasY: 0 },
                zoom: 1,
                hoveredNode: null
            };
        }

        const info: GatheredInfo = {
            cursor: {
                canvasX: magnifyGlass.state.x,
                canvasY: magnifyGlass.state.y
            },
            zoom: magnifyGlass.state.canvasScale,
            hoveredNode: null
        };

        const nodeUnderCursor = this.getNodeUnderCursor();
        if (nodeUnderCursor) {
            info.hoveredNode = this.getDetailedNodeInfo(nodeUnderCursor);
        }

        return info;
    }

    getNodeUnderCursor(): ComfyNode | null {
        const magnifyGlass = window.comfyUIMagnifyGlass;
        const graph = app.canvas?.graph;
        if (!graph || !magnifyGlass) {
            return null;
        }

        if (app.canvas.node_over) {
            return app.canvas.node_over;
        }

        try {
            const canvasRect = app.canvas.canvas.getBoundingClientRect();
            const mouseX = magnifyGlass.lastKnownMousePosition.x - canvasRect.left;
            const mouseY = magnifyGlass.lastKnownMousePosition.y - canvasRect.top;

            let graphPos: [number, number];
            if (app.canvas.convertOffsetToCanvasPos) {
                graphPos = app.canvas.convertOffsetToCanvasPos([mouseX, mouseY]);
            } else {
                const ds = app.canvas.ds || { scale: 1, offset: [0, 0] };
                graphPos = [
                    (mouseX / ds.scale) - (ds.offset[0] / ds.scale),
                    (mouseY / ds.scale) - (ds.offset[1] / ds.scale)
                ];
            }

            return graph.getNodeOnPos(graphPos[0], graphPos[1]) ?? null;
        } catch (err) {
            console.warn("Error in node detection:", err);
        }

        return null;
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
            graphPath: this.getGraphPath(node.graph),
            group: node.graph?.getGroupOnPos(node.pos[0] + node.size[0] / 2, node.pos[1] + node.size[1] / 2)?.title,
            isSubgraph: !!node.isSubgraphNode?.()
        };
    }

    /**
     * Names of the subgraphs that lead from the root graph to this one, found through the subgraph nodes.
     */
    getGraphPath(graph: ComfyGraph | undefined): string[] {
        if (!graph || graph.rootGraph === graph) return [];

        const find = (nodes: ComfyNode[], path: string[]): string[] | null => {
            for (const node of nodes) {
                if (!node.subgraph || !node.isSubgraphNode?.()) continue;
                const subPath = [...path, node.subgraph.name || 'Subgraph'];
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
