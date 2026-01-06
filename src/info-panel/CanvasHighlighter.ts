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

    // Configuration
    private readonly HIGHLIGHT_COLOR = '#007bff'; // Bootstrap blue
    private readonly HIGHLIGHT_WIDTH = 2; // px
    private readonly HIGHLIGHT_PADDING = 0; // px

    constructor() {
        this.hookCanvas();
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
        canvas.onDrawForeground = (ctx: CanvasRenderingContext2D, visible_nodes: any) => {
            // Call original first
            if (this.originalOnDrawForeground) {
                this.originalOnDrawForeground.call(canvas, ctx, visible_nodes);
            }

            // Draw our highlight
            this.drawHighlight(ctx, canvas.ds.scale);
        };
    }

    /**
     * Set the node ID to highlight.
     */
    setHighlightedNode(nodeId: number | null): void {
        if (this.highlightedNodeId === nodeId) return;
        this.highlightedNodeId = nodeId;
        // Force redraw to update highlight immediately
        const app = (window as any).app;
        if (app && app.canvas) {
            app.canvas.setDirty(true, true);
        }
    }

    /**
     * Draw the highlight rectangle around the target node.
     */
    private drawHighlight(ctx: CanvasRenderingContext2D, scale: number): void {
        if (this.highlightedNodeId === null) return;
        const app = (window as any).app;
        if (!app) return;
        const node = app.graph.getNodeById(this.highlightedNodeId);
        if (!node) return;

        // Save context
        ctx.save();

        // Reset transform to draw in graph coordinates
        // Note: ctx passed to onDrawForeground is already transformed by LiteGraph to graph coordinates
        // so we can draw using node.pos directly.

        const x = node.pos[0] - this.HIGHLIGHT_PADDING;
        const y = node.pos[1] - this.HIGHLIGHT_PADDING;
        const w = node.size[0] + (this.HIGHLIGHT_PADDING * 2);
        const h = node.size[1] + (this.HIGHLIGHT_PADDING * 2);

        // Draw glow/outline
        ctx.lineWidth = this.HIGHLIGHT_WIDTH;
        ctx.strokeStyle = this.HIGHLIGHT_COLOR;
        ctx.shadowColor = this.HIGHLIGHT_COLOR;
        ctx.shadowBlur = 10 * scale; // Scale shadow with zoom
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;

        // Use roundRect if available (modern browsers), else rect
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            const radius = 10; // LiteGraph nodes usually have round corners
            ctx.roundRect(x, y, w, h, radius);
        } else {
            ctx.rect(x, y, w, h);
        }
        ctx.stroke();

        // Restore context
        ctx.restore();
    }

    /**
     * Clean up hooks.
     */
    cleanup(): void {
        const app = (window as any).app;
        if (app && app.canvas && this.originalOnDrawForeground) {
            app.canvas.onDrawForeground = this.originalOnDrawForeground;
        }
    }
}
