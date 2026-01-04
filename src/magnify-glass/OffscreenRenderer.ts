/**
 * ComfyUI MagnifyGlass - Offscreen Renderer
 * 
 * Hybrid Renderer:
 * 1. Direct Capture (Nuclear) for near-100% zoom (Perfect Alignment, Good Quality).
 * 2. Virtual Zoom (High Res) for zoomed-out views (High Detail, sensitive alignment).
 */

import type { ConfigManager } from './ConfigManager';
import type { MagnifierState } from './MagnifierState';

declare const app: any;

export class OffscreenRenderer {
    private config: ConfigManager;
    private state: MagnifierState;
    private offscreenCanvas: HTMLCanvasElement | null = null;
    private offscreenCtx: CanvasRenderingContext2D | null = null;
    private lastRenderWidth: number = 0;
    private lastRenderHeight: number = 0;
    private isCapturing: boolean = false;

    constructor(config: ConfigManager, state: MagnifierState) {
        this.config = config;
        this.state = state;
        this.initOffscreenCanvas();
    }

    private initOffscreenCanvas(): void {
        this.offscreenCanvas = document.createElement('canvas');
        this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    }

    renderHighResRegion(targetCanvas: HTMLCanvasElement): HTMLCanvasElement | null {
        if (!this.offscreenCanvas || !this.offscreenCtx) return null;
        if (this.isCapturing) return null;

        const lgCanvas = app?.canvas;
        if (!lgCanvas || !lgCanvas.ds) return null;

        const renderSize = this.config.glassSize;

        // Resize offscreen canvas
        if (this.lastRenderWidth !== renderSize || this.lastRenderHeight !== renderSize) {
            this.offscreenCanvas.width = renderSize;
            this.offscreenCanvas.height = renderSize;
            this.lastRenderWidth = renderSize;
            this.lastRenderHeight = renderSize;
        }

        const currentScale = lgCanvas.ds.scale;
        const rect = targetCanvas.getBoundingClientRect();
        // Calculate DPR exactly as EventHandler does (Canvas Pixels / CSS Pixels)
        const dpr = rect.width > 0 ? targetCanvas.width / rect.width : 1;

        // Threshold for Hybrid Mode
        // If we are zoomed in enough (> 70%), Direct Capture quality is usually acceptable,
        // and it guarantees perfect alignment.
        // If we are zoomed out (< 70%), we NEED High Res Virtual Zoom to see details.
        const useDirectCapture = currentScale >= 0.7;

        if (useDirectCapture) {
            return this.renderDirectCapture(targetCanvas, renderSize, dpr);
        } else {
            return this.renderVirtualZoom(lgCanvas, targetCanvas, renderSize, currentScale, dpr);
        }
    }

    /**
     * Mode 1: Direct Capture (Nuclear Fix)
     * Copies pixels directly from screen. Zero drift.
     */
    private renderDirectCapture(targetCanvas: HTMLCanvasElement, renderSize: number, dpr: number): HTMLCanvasElement | null {
        try {
            this.isCapturing = true;

            // state.x/y are Backing Pixels. pivotCss is Backing / DPR.
            const pivotCssX = this.state.x / dpr;
            const pivotCssY = this.state.y / dpr;

            const sourceSizeCss = renderSize / this.config.zoomFactor;

            // sourceRect in Backing Pixels
            const sourceWidth = sourceSizeCss * dpr;
            const sourceHeight = sourceSizeCss * dpr;
            const sourceX = (pivotCssX - (sourceSizeCss / 2)) * dpr;
            const sourceY = (pivotCssY - (sourceSizeCss / 2)) * dpr;

            this.offscreenCtx!.clearRect(0, 0, renderSize, renderSize);
            this.offscreenCtx!.drawImage(
                targetCanvas,
                sourceX, sourceY, sourceWidth, sourceHeight,
                0, 0, renderSize, renderSize
            );

            this.isCapturing = false;
            return this.offscreenCanvas;
        } catch (e) {
            console.warn("DirectCapture failed", e);
            this.isCapturing = false;
            return null;
        }
    }

    /**
     * Mode 2: Virtual Zoom (High Res)
     * Temporarily sets scale to 1.0 to render details.
     * Uses LiteGraph's setZoom() API for correct pivot handling.
     */
    private renderVirtualZoom(lgCanvas: any, targetCanvas: HTMLCanvasElement, renderSize: number, currentScale: number, dpr: number): HTMLCanvasElement | null {
        try {
            this.isCapturing = true;

            // Pivot = Mouse in CSS Pixels (relative to canvas element)
            const pivotCssX = this.state.x / dpr;
            const pivotCssY = this.state.y / dpr;

            // Target Scale (1.0 for high-res capture)
            const targetScale = Math.max(1.0, currentScale);

            // Store original state for restoration
            const origScale = lgCanvas.ds.scale;
            const origOffsetX = lgCanvas.ds.offset[0];
            const origOffsetY = lgCanvas.ds.offset[1];

            // Use LiteGraph's setZoom API - this properly handles the pivot point
            // The center parameter tells LiteGraph to zoom around that screen position
            if (typeof lgCanvas.setZoom === 'function') {
                lgCanvas.setZoom(targetScale, [pivotCssX, pivotCssY]);
            } else {
                // Fallback: manual calculation (legacy, may drift)
                const pivotGraphX = (pivotCssX - origOffsetX) / currentScale;
                const pivotGraphY = (pivotCssY - origOffsetY) / currentScale;
                const newOffsetX = pivotCssX - (pivotGraphX * targetScale);
                const newOffsetY = pivotCssY - (pivotGraphY * targetScale);
                lgCanvas.ds.scale = targetScale;
                lgCanvas.ds.offset[0] = newOffsetX;
                lgCanvas.ds.offset[1] = newOffsetY;
            }

            lgCanvas.draw(true, true);

            // Capture pixels around the pivot point
            const sourceSizeCss = renderSize / this.config.zoomFactor;
            const sourceWidth = sourceSizeCss * dpr;
            const sourceHeight = sourceSizeCss * dpr;
            const sourceX = (pivotCssX - (sourceSizeCss / 2)) * dpr;
            const sourceY = (pivotCssY - (sourceSizeCss / 2)) * dpr;

            this.offscreenCtx!.clearRect(0, 0, renderSize, renderSize);
            this.offscreenCtx!.drawImage(
                targetCanvas,
                sourceX, sourceY, sourceWidth, sourceHeight,
                0, 0, renderSize, renderSize
            );

            // Restore original zoom state using setZoom for consistency
            if (typeof lgCanvas.setZoom === 'function') {
                lgCanvas.setZoom(origScale, [pivotCssX, pivotCssY]);
            } else {
                lgCanvas.ds.scale = origScale;
                lgCanvas.ds.offset[0] = origOffsetX;
                lgCanvas.ds.offset[1] = origOffsetY;
            }
            lgCanvas.draw(true, true);

            this.isCapturing = false;
            return this.offscreenCanvas;

        } catch (e) {
            console.warn("VirtualZoom failed", e);
            // Emergency restore
            lgCanvas.ds.scale = currentScale;
            lgCanvas.draw(true, true);
            this.isCapturing = false;
            return null;
        }
    }

    isAvailable(): boolean {
        return this.offscreenCanvas !== null && this.offscreenCtx !== null;
    }

    getCanvas(): HTMLCanvasElement | null {
        return this.offscreenCanvas;
    }
}
