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
        canvas.onDrawForeground = this.boundOnDrawForeground;
    }

    /**
     * Set the node ID to highlight.
     */
    /**
     * Set the node ID to highlight.
     */
    setHighlightedNode(nodeId: number | null): void {
        this.ensureHook(); // Ensure we are still hooked

        if (this.highlightedNodeId === nodeId) return;
        this.highlightedNodeId = nodeId;
        // Force redraw to update highlight immediately
        const app = (window as any).app;
        if (app && app.canvas) {
            app.canvas.setDirty(true, true);
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
            // console.log('[MagnifyGlass] Re-hooking CanvasHighlighter');
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

        // Draw our highlight
        const app = (window as any).app;
        if (app && app.canvas) {
            this.drawHighlight(ctx, app.canvas.ds.scale);
        }
    };

    /**
     * Draw the highlight rectangle around the target node.
     */
    private drawHighlight(ctx: CanvasRenderingContext2D, scale: number): void {
        if (this.highlightedNodeId === null) return;
        const app = (window as any).app;
        if (!app) return;

        // Check if highlight is enabled via settings
        const highlightEnabled = app.ui?.settings?.getSettingValue('🔍MagnifyGlass.NodeHighlightEnabled') ?? true;
        if (!highlightEnabled) return;

        const node = app.graph.getNodeById(this.highlightedNodeId);
        if (!node) return;

        // Save context
        ctx.save();

        // Reset transform to draw in graph coordinates
        // Note: ctx passed to onDrawForeground is already transformed by LiteGraph to graph coordinates
        // so we can draw using node.pos directly.

        // In LiteGraph, node.size only represents the body dimensions (without title bar)
        // The title bar height must be added to get the full visual node height
        const LiteGraph = (window as any).LiteGraph;
        const titleHeight = LiteGraph?.NODE_TITLE_HEIGHT ?? 30;

        // Debug: Log values to browser console
        console.log('[MagnifyGlass] Highlight debug:', {
            titleHeight,
            nodePos: node.pos,
            nodeSize: node.size,
            NODE_TITLE_HEIGHT: LiteGraph?.NODE_TITLE_HEIGHT
        });

        const padding = 10;
        const x = node.pos[0] - padding;
        // Account for the title bar above the node body
        const y = node.pos[1] - padding - titleHeight;
        const w = node.size[0] + (padding * 2);
        // Total node height = title bar + body size
        const h = titleHeight + node.size[1] + (padding * 2);

        // Draw large blue bar/border
        ctx.lineWidth = 10; // Thicker border
        ctx.strokeStyle = '#007bff'; // Blue
        // ctx.shadowColor = '#007bff'; // Optional glow
        // ctx.shadowBlur = 0; 
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        // Use roundRect if available (modern browsers), else rect
        ctx.beginPath();
        if (typeof ctx.roundRect === 'function') {
            const radius = 10;
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
            if (app.canvas.onDrawForeground === this.boundOnDrawForeground) {
                app.canvas.onDrawForeground = this.originalOnDrawForeground;
            }
        }
    }
}
