/**
 * CanvasHighlighter.ts
 * 
 * Handles drawing a visual highlight on the main canvas around the currently inspected node.
 * Hooks into LiteGraph's canvas drawing cycle.
 */

import { ComfyApp, ComfyNode } from '../types/comfyui';

declare const app: ComfyApp;

export class CanvasHighlighter {
    // Each onDrawForeground this hook replaced, oldest first. The frontend wraps the hook again whenever its
    // DOM widgets mount (e.g. on a Nodes 2.0 toggle), so a later one calls back here, and each call goes a level down.
    private originals: (((ctx: CanvasRenderingContext2D, visible_nodes: any) => void) | undefined)[] = [];
    private depth = 0;
    private highlightedNodeId: number | null = null;

    private highlightEl: HTMLDivElement | null = null;
    // Cache for DOM updates to minimize thrashing
    private lastStyleState: string = '';
    // The panel's settings cache, which the setting's onChange keeps current
    private settings: { [key: string]: string | number | boolean };

    constructor(settings: { [key: string]: string | number | boolean }) {
        this.settings = settings;
        this.createHighlightElement();
        // Don't hook immediately, will hook lazily when needed
    }

    private createHighlightElement(): void {
        this.highlightEl = document.createElement("div");
        this.highlightEl.id = "magnify-glass-node-highlight";
        this.highlightEl.style.display = 'none';
        document.body.appendChild(this.highlightEl);
    }

    /**
     * Set the node ID to highlight.
     */
    setHighlightedNode(nodeId: number | null): void {
        this.ensureHook(); // Ensure we are still hooked

        if (this.highlightedNodeId === nodeId) return;
        this.highlightedNodeId = nodeId;

        // Force redraw effectively updates our position logic via the hook
        const app = (window as any).app;
        if (app && app.canvas) {
            app.canvas.setDirty(true, true);
        }

        // Immediate update attempt (in case canvas isn't dirty)
        if (nodeId === null && this.highlightEl) {
            this.highlightEl.style.display = 'none';
        }
    }

    /**
     * Ensure the canvas hook is active.
     */
    private ensureHook(): void {
        const app = (window as any).app;
        if (!app || !app.canvas) return;

        // If our hook was overwritten (e.g. by another extension), re-hook
        if (app.canvas.onDrawForeground !== this.boundOnDrawForeground) {
            this.originals.push(app.canvas.onDrawForeground);
            app.canvas.onDrawForeground = this.boundOnDrawForeground;
        }
    }

    // Bound method to preserve 'this' and allow equality check
    private boundOnDrawForeground = (ctx: CanvasRenderingContext2D, visible_nodes: any) => {
        const original = this.originals[this.originals.length - 1 - this.depth];
        if (original) {
            this.depth++;
            try {
                original.call((window as any).app.canvas, ctx, visible_nodes);
            } finally {
                this.depth--;
            }
        }
        if (this.depth > 0) return;

        // Update DOM Highlight Position
        this.updateHighlightPosition();
    };

    /**
     * Update the position of the DOM highlight element.
     */
    private updateHighlightPosition(): void {
        if (!this.highlightEl) return;
        const app = (window as any).app;
        if (!app?.canvas?.graph) return;

        // 1. Check Visibility Settings
        if (!this.settings["🔍MagnifyGlass.NodeHighlightEnabled"] || this.highlightedNodeId === null) {
            if (this.highlightEl.style.display !== 'none') {
                this.highlightEl.style.display = 'none';
            }
            return;
        }

        // 2. Get Node
        const node = app.canvas.graph.getNodeById(this.highlightedNodeId);
        if (!node) {
            if (this.highlightEl.style.display !== 'none') {
                this.highlightEl.style.display = 'none';
            }
            return;
        }

        // 3. Get Canvas Element's position on the page
        const canvasEl = app.canvas.canvas as HTMLCanvasElement;
        if (!canvasEl) return;
        const canvasRect = canvasEl.getBoundingClientRect();

        // 4. Coordinate Math
        const ds = app.canvas.ds;
        const scale = ds.scale;
        const offset = ds.offset;

        const padding = 6;

        // Graph coordinates of the title and body. LiteGraph measures a collapsed node as its title pill,
        // while a Vue node writes its DOM size, collapsed or not, to node.size below the title
        const LiteGraph = (window as any).LiteGraph;
        const titleHeight = LiteGraph?.NODE_TITLE_HEIGHT ?? 30;
        const [graphX, graphY, graphW, graphH] = LiteGraph?.vueNodesMode
            ? [node.pos[0], node.pos[1] - titleHeight, node.size[0], node.size[1] + titleHeight]
            : node.getBounding();

        // Page coordinates: LiteGraph draws (graph + offset) * scale from the canvas corner
        const pageX = canvasRect.left + (graphX + offset[0]) * scale - padding;
        const pageY = canvasRect.top + (graphY + offset[1]) * scale - padding;
        const finalW = graphW * scale + (padding * 2);
        const finalH = graphH * scale + (padding * 2);

        // 5. Update DOM, clipped to the canvas element (negative insets keep the glow inside it)
        const clip = `inset(${canvasRect.top - pageY}px ${pageX + finalW - canvasRect.right}px ${pageY + finalH - canvasRect.bottom}px ${canvasRect.left - pageX}px)`;
        const styleState = `${pageX.toFixed(1)},${pageY.toFixed(1)},${finalW.toFixed(1)},${finalH.toFixed(1)},${clip}`;
        if (this.lastStyleState !== styleState || this.highlightEl.style.display === 'none') {
            this.highlightEl.style.display = 'block';
            this.highlightEl.style.left = `${pageX}px`;
            this.highlightEl.style.top = `${pageY}px`;
            this.highlightEl.style.width = `${finalW}px`;
            this.highlightEl.style.height = `${finalH}px`;
            this.highlightEl.style.clipPath = clip;

            // Border width scales with zoom (clamped 2-6px)
            const borderWidth = Math.max(2, Math.min(6, 3 * scale));
            this.highlightEl.style.borderWidth = `${borderWidth}px`;

            this.lastStyleState = styleState;
        }
    }

    /**
     * Clean up hooks.
     */
    cleanup(): void {
        const app = (window as any).app;
        // A wrapper of this hook that is still in the chain keeps reaching the ones below it through here
        if (app && app.canvas && app.canvas.onDrawForeground === this.boundOnDrawForeground) {
            app.canvas.onDrawForeground = this.originals.pop();
        }

        if (this.highlightEl) {
            this.highlightEl.remove();
            this.highlightEl = null;
        }
    }
}
