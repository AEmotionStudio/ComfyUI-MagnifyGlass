/**
 * CanvasHighlighter.ts
 * 
 * Handles drawing a visual highlight on the main canvas around the currently inspected node.
 * Hooks into LiteGraph's canvas drawing cycle.
 */

import { ComfyApp, ComfyNode } from '../types/comfyui';

declare const app: ComfyApp;

export class CanvasHighlighter {
    private originalOnDrawForeground: ((ctx: CanvasRenderingContext2D, visible_nodes: any) => void) | null = null;
    private highlightedNodeId: number | null = null;

    private highlightEl: HTMLDivElement | null = null;
    // Cache for DOM updates to minimize thrashing
    private lastStyleState: string = '';

    constructor() {
        this.createHighlightElement();
        this.hookCanvas();
    }

    private createHighlightElement(): void {
        this.highlightEl = document.createElement("div");
        this.highlightEl.id = "magnify-glass-node-highlight";
        this.highlightEl.style.cssText = `
            position: fixed;
            pointer-events: none;
            border: 2px solid #007bff;
            border-radius: 10px;
            z-index: 1000;
            display: none;
            box-sizing: border-box;
            box-shadow: 0 0 10px rgba(0, 123, 255, 0.3);
        `;
        document.body.appendChild(this.highlightEl);
    }

    /**
     * Hook into the main canvas onDrawForeground method.
     */
    private hookCanvas(): void {
        const app = (window as any).app;
        if (!app || !app.canvas) {
            console.warn('[MagnifyGlass] Canvas not found, cannot hook highlighter');
            return;
        }
        const canvas = app.canvas;

        // Save original method
        this.originalOnDrawForeground = canvas.onDrawForeground;

        // Override
        canvas.onDrawForeground = this.boundOnDrawForeground;
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
            this.originalOnDrawForeground = app.canvas.onDrawForeground;
            app.canvas.onDrawForeground = this.boundOnDrawForeground;
        }
    }

    // Bound method to preserve 'this' and allow equality check
    private boundOnDrawForeground = (ctx: CanvasRenderingContext2D, visible_nodes: any) => {
        // Call original first
        if (this.originalOnDrawForeground) {
            this.originalOnDrawForeground.call((window as any).app.canvas, ctx, visible_nodes);
        }

        // Update DOM Highlight Position
        this.updateHighlightPosition();
    };

    /**
     * Update the position of the DOM highlight element.
     */
    private updateHighlightPosition(): void {
        if (!this.highlightEl) return;
        const app = (window as any).app;
        if (!app || !app.canvas || !app.graph) return;

        // 1. Check Visibility Settings
        const highlightEnabled = app.ui?.settings?.getSettingValue('🔍MagnifyGlass.NodeHighlightEnabled') ?? true;
        if (!highlightEnabled || this.highlightedNodeId === null) {
            if (this.highlightEl.style.display !== 'none') {
                this.highlightEl.style.display = 'none';
            }
            return;
        }

        // 2. Get Node
        const node = app.graph.getNodeById(this.highlightedNodeId);
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

        const LiteGraph = (window as any).LiteGraph;
        const titleHeight = LiteGraph?.NODE_TITLE_HEIGHT ?? 30;
        const padding = 6;

        // Graph coordinates
        // Assuming node.pos is top of body, we shift up by titleHeight to cover title
        // And use total height = title + body
        const graphX = node.pos[0];
        const graphY = node.pos[1] - titleHeight;
        const graphW = node.size[0];
        const graphH = titleHeight + node.size[1];

        // Canvas-relative screen coordinates (CSS pixels within the canvas element)
        // LiteGraph transform is: (Graph + Offset) * Scale
        const canvasX = (graphX + offset[0]) * scale;
        const canvasY = (graphY + offset[1]) * scale;
        const canvasW = graphW * scale;
        const canvasH = graphH * scale;

        // Page-absolute coordinates (add canvas position on the page)
        const pageX = canvasRect.left + canvasX - padding;
        const pageY = canvasRect.top + canvasY - padding; // Removed hardcoded offset
        const finalW = canvasW + (padding * 2);
        const finalH = canvasH + (padding * 2);

        // 5. Update DOM
        const styleState = `${pageX.toFixed(1)},${pageY.toFixed(1)},${finalW.toFixed(1)},${finalH.toFixed(1)}`;
        if (this.lastStyleState !== styleState || this.highlightEl.style.display === 'none') {
            this.highlightEl.style.display = 'block';
            this.highlightEl.style.left = `${pageX}px`;
            this.highlightEl.style.top = `${pageY}px`;
            this.highlightEl.style.width = `${finalW}px`;
            this.highlightEl.style.height = `${finalH}px`;

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
        if (app && app.canvas && this.originalOnDrawForeground) {
            if (app.canvas.onDrawForeground === this.boundOnDrawForeground) {
                app.canvas.onDrawForeground = this.originalOnDrawForeground;
            }
        }

        if (this.highlightEl) {
            this.highlightEl.remove();
            this.highlightEl = null;
        }
    }
}
