/**
 * ComfyUI MagnifyGlass - Node Selector Utility
 * 
 * Provides methods to fetch and sort nodes from the canvas
 * for use in the node search/selection feature.
 */

import type { ComfyApp, ComfyNode } from '../types/comfyui';

declare const app: ComfyApp;

/**
 * Node entry for dropdown display.
 */
export interface NodeListEntry {
    id: number;
    title: string;
    type: string;
}

/**
 * Node entry with execution order.
 */
export interface NodeExecOrderEntry extends NodeListEntry {
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
        return app?.graph?._nodes ?? [];
    }

    /**
     * Get nodes sorted alphabetically by title.
     */
    getNodesSortedByTitle(): NodeListEntry[] {
        return this.getAllNodes()
            .map(n => ({
                id: n.id,
                title: n.title || 'Untitled',
                type: n.type || 'Unknown'
            }))
            .sort((a, b) => a.title.localeCompare(b.title));
    }

    /**
     * Get nodes sorted by execution order.
     * Only includes nodes that have a valid execution order.
     */
    getNodesSortedByExecOrder(): NodeExecOrderEntry[] {
        return this.getAllNodes()
            .map(n => ({
                id: n.id,
                title: n.title || 'Untitled',
                type: n.type || 'Unknown',
                order: (n as any).order ?? -1
            }))
            .filter(n => n.order >= 0)
            .sort((a, b) => a.order - b.order);
    }

    /**
     * Get nodes sorted by ID number (ascending).
     */
    getNodesSortedById(): NodeListEntry[] {
        return this.getAllNodes()
            .map(n => ({
                id: n.id,
                title: n.title || 'Untitled',
                type: n.type || 'Unknown'
            }))
            .sort((a, b) => a.id - b.id);
    }

    /**
     * Get a node by its ID.
     */
    getNodeById(id: number): ComfyNode | null {
        return app?.graph?.getNodeById(id) ?? null;
    }

    /**
     * Search nodes by title (case-insensitive partial match).
     */
    searchByTitle(query: string): NodeListEntry[] {
        const lowerQuery = query.toLowerCase();
        return this.getNodesSortedByTitle()
            .filter(n => n.title.toLowerCase().includes(lowerQuery));
    }

    /**
     * Get total node count.
     */
    getNodeCount(): number {
        return this.getAllNodes().length;
    }
}
