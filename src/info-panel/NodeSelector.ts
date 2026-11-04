/**
 * ComfyUI MagnifyGlass - Node Selector Utility
 * 
 * Provides methods to fetch and sort nodes from the canvas
 * for use in the node search/selection feature.
 */

import type { ComfyApp, ComfyNode } from '../types/comfyui';

declare const app: ComfyApp;

/**
 * Node entry for the Go to node picker and Prev/Next.
 */
export interface NodeListEntry {
    id: number;
    title: string;
    type: string;
    /** Execution order, -1 when the node has none */
    order: number;
}

/**
 * NodeSelector class.
 * Provides methods to fetch and sort nodes from the canvas.
 */
export class NodeSelector {
    /**
     * Get all nodes from the graph.
     */
    getAllNodes(): ComfyNode[] {
        return app?.canvas?.graph?._nodes ?? [];
    }

    private getEntries(): NodeListEntry[] {
        return this.getAllNodes().map(n => ({
            id: n.id,
            title: n.title || 'Untitled',
            type: n.type || 'Unknown',
            order: (n as any).order ?? -1
        }));
    }

    /**
     * Get nodes sorted by execution order.
     * Only includes nodes that have a valid execution order.
     */
    getNodesSortedByExecOrder(): NodeListEntry[] {
        return this.getEntries()
            .filter(n => n.order >= 0)
            .sort((a, b) => a.order - b.order);
    }

    /**
     * Get a node by its ID.
     */
    getNodeById(id: number): ComfyNode | null {
        return app?.canvas?.graph?.getNodeById(id) ?? null;
    }

    /**
     * Nodes whose title or type contains the query (any case), or whose id it names as `#id` or plainly.
     * Sorted by execution order; nodes without one come last, by title.
     */
    search(query: string): NodeListEntry[] {
        const q = query.trim().toLowerCase();
        const idQuery = q.startsWith('#') ? q.slice(1) : null;
        const rank = (n: NodeListEntry) => n.order < 0 ? Infinity : n.order;
        return this.getEntries()
            .filter(n => idQuery !== null
                ? !idQuery || String(n.id) === idQuery
                : n.title.toLowerCase().includes(q) || n.type.toLowerCase().includes(q) || String(n.id) === q)
            .sort((a, b) => (rank(a) - rank(b)) || a.title.localeCompare(b.title));
    }
}
