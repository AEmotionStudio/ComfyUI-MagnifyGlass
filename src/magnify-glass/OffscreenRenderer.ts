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

    // Virtual Zoom Throttling (30 FPS = ~33ms per frame)
    private static readonly VIRTUAL_ZOOM_MIN_INTERVAL_MS = 33;
    private lastVirtualZoomTime: number = 0;
    private cachedVirtualZoomResult: HTMLCanvasElement | null = null;

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
            // Direct Capture: Full speed, no extra draws
            this.cachedVirtualZoomResult = null; // Invalidate cache when switching modes
            return this.renderDirectCapture(targetCanvas, renderSize, dpr);
        } else {
            // Virtual Zoom: Throttled to 30 FPS to prevent FPS counter inflation
            const now = performance.now();
            const elapsed = now - this.lastVirtualZoomTime;

            if (elapsed < OffscreenRenderer.VIRTUAL_ZOOM_MIN_INTERVAL_MS && this.cachedVirtualZoomResult) {
                // Return cached result if within throttle window
                return this.cachedVirtualZoomResult;
            }

            // Perform the expensive virtual zoom render
            const result = this.renderVirtualZoom(lgCanvas, targetCanvas, renderSize, currentScale, dpr);
            this.lastVirtualZoomTime = now;
            this.cachedVirtualZoomResult = result;
            return result;
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

            // Draw native widget text on top of the captured canvas
            const lgCanvas = app?.canvas;
            const currentScale = lgCanvas?.ds?.scale ?? 1.0;
            const currentOffset: [number, number] = lgCanvas?.ds?.offset ? [lgCanvas.ds.offset[0], lgCanvas.ds.offset[1]] : [0, 0];
            this.drawWidgetTextNatively(sourceX, sourceY, sourceWidth, sourceHeight, renderSize, currentScale, currentOffset);

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

            // Draw native widget text on top of the captured canvas
            // Note: For virtual zoom, we use targetScale and the CURRENT offset (after setZoom)
            // because lgCanvas.setZoom() modified the offset to zoom around the pivot
            const captureOffset: [number, number] = [lgCanvas.ds.offset[0], lgCanvas.ds.offset[1]];
            this.drawWidgetTextNatively(sourceX, sourceY, sourceWidth, sourceHeight, renderSize, targetScale, captureOffset);

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

    /**
     * Draw widget text natively on the offscreen canvas.
     * This renders text content that would otherwise be lost since widgets are DOM elements.
     * 
     * @param sourceX - Source X position in backing pixels
     * @param sourceY - Source Y position in backing pixels
     * @param sourceWidth - Source width in backing pixels
     * @param sourceHeight - Source height in backing pixels
     * @param renderSize - Output render size in pixels
     * @param scale - Canvas scale used during capture
     * @param offset - Canvas offset [x, y] used during capture
     */
    private drawWidgetTextNatively(
        sourceX: number,
        sourceY: number,
        sourceWidth: number,
        sourceHeight: number,
        renderSize: number,
        scale: number,
        offset: [number, number]
    ): void {
        const graph = app?.graph;
        if (!graph || !graph._nodes || !this.offscreenCtx) return;

        const ctx = this.offscreenCtx;
        const lgCanvas = app?.canvas;
        if (!lgCanvas || !lgCanvas.ds) return;

        // LiteGraph layout constants
        const TITLE_HEIGHT = 30;
        const WIDGET_HEIGHT = 20;
        const WIDGET_MARGIN = 4;
        const PADDING = 15;

        // Use the passed offset (capture-time offset), not current lgCanvas offset
        // const ds = lgCanvas.ds;
        // const offset = ds.offset || [0, 0]; // OLD: This was wrong

        // The offset from LiteGraph is in CSS pixels
        // The sourceX/Y/Width/Height are in backing pixels
        // We need to convert properly

        // Calculate DPR from the source parameters
        const sourceSizeCss = renderSize / this.config.zoomFactor;
        const actualDpr = sourceWidth / sourceSizeCss;
        const captureScale = renderSize / sourceWidth;

        // Source region in CSS pixels
        const sourceCssX = sourceX / actualDpr;
        const sourceCssY = sourceY / actualDpr;
        const sourceCssWidth = sourceWidth / actualDpr;
        const sourceCssHeight = sourceHeight / actualDpr;

        for (const node of graph._nodes) {
            if (!node.widgets || !node.pos || !node.size) continue;
            if (node.flags?.collapsed) continue;

            // Calculate node position in CSS pixels
            // node.pos is in graph coordinates, transform: screenCss = graphPos * scale + offset
            const nodeCssX = node.pos[0] * scale + offset[0];
            const nodeCssY = node.pos[1] * scale + offset[1];
            const nodeCssWidth = node.size[0] * scale;
            const nodeCssHeight = node.size[1] * scale;

            // Check if node is in captured region (CSS coordinates)
            if (nodeCssX + nodeCssWidth < sourceCssX || nodeCssX > sourceCssX + sourceCssWidth) continue;
            if (nodeCssY + nodeCssHeight < sourceCssY || nodeCssY > sourceCssY + sourceCssHeight) continue;

            // Calculate widget positions
            let widgetY = TITLE_HEIGHT;

            for (const widget of node.widgets) {
                // Use widget.last_y if available, otherwise use calculated position
                const widgetLocalY = (widget as any).last_y ?? widgetY;

                // Check if widget type contains text
                const widgetType = String(widget.type || '').toLowerCase();
                const isTextWidget = widgetType === 'text' || widgetType === 'string' ||
                    widgetType === 'textarea' || widgetType === 'customtext';

                if (isTextWidget && widget.value !== undefined && widget.value !== null) {
                    const textValue = String(widget.value);
                    if (textValue.length > 0) {
                        // Widget position in CSS pixels (relative to canvas)
                        const widgetCssX = nodeCssX + (PADDING * scale);
                        const widgetCssY = nodeCssY + (widgetLocalY * scale);
                        const widgetCssWidth = nodeCssWidth - (PADDING * 2 * scale);

                        // Convert from CSS to offscreen canvas coordinates
                        // Position relative to source region, scaled to output size
                        const canvasX = (widgetCssX - sourceCssX) * actualDpr * captureScale;
                        const canvasY = (widgetCssY - sourceCssY) * actualDpr * captureScale;
                        const widgetWidth = widgetCssWidth * actualDpr * captureScale;

                        // Calculate font size based on scale
                        const baseFontSize = 13;
                        const fontSize = Math.max(10, Math.min(28, baseFontSize * scale * actualDpr * captureScale));

                        // Calculate widget height
                        const widgetHeight = (widget as any).computedHeight
                            ? (widget as any).computedHeight * scale * captureScale
                            : Math.max(80, fontSize * 5);

                        // Check if widget is at least partially visible (more lenient bounds check)
                        const widgetRight = canvasX + widgetWidth;
                        const widgetBottom = canvasY + widgetHeight;
                        const isVisible = widgetRight > 0 && canvasX < renderSize &&
                            widgetBottom > 0 && canvasY < renderSize;

                        if (isVisible) {
                            ctx.save();

                            // Container bounds
                            const containerX = canvasX - 4;
                            const containerY = canvasY - 4;
                            const containerWidth = widgetWidth + 8;
                            const containerHeight = widgetHeight + 8;
                            const borderRadius = 8;

                            // Draw background container with rounded corners
                            ctx.beginPath();
                            ctx.roundRect(containerX, containerY, containerWidth, containerHeight, borderRadius);
                            ctx.fillStyle = '#1e1e1e'; // Slightly lighter dark background
                            ctx.fill();

                            // Draw border
                            ctx.strokeStyle = '#3a3a3a';
                            ctx.lineWidth = 1;
                            ctx.stroke();

                            // Clip to container bounds to prevent text spill
                            ctx.beginPath();
                            ctx.roundRect(containerX, containerY, containerWidth, containerHeight, borderRadius);
                            ctx.clip();

                            // Set up enhanced text rendering
                            ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
                            ctx.fillStyle = '#e0e0e0'; // Brighter text
                            ctx.textBaseline = 'top';
                            ctx.imageSmoothingEnabled = true;

                            // Word wrap helper function
                            const wrapText = (text: string, maxWidth: number): string[] => {
                                const words = text.split(/(\s+)/); // Split keeping whitespace
                                const wrappedLines: string[] = [];
                                let currentLine = '';

                                for (const word of words) {
                                    const testLine = currentLine + word;
                                    const testWidth = ctx.measureText(testLine).width;

                                    if (testWidth > maxWidth && currentLine.length > 0) {
                                        wrappedLines.push(currentLine.trimEnd());
                                        currentLine = word.trimStart();
                                    } else {
                                        currentLine = testLine;
                                    }
                                }
                                if (currentLine.length > 0) {
                                    wrappedLines.push(currentLine.trimEnd());
                                }
                                return wrappedLines;
                            };

                            // Handle multi-line text with word wrapping
                            const inputLines = textValue.split('\n');
                            const lineHeight = fontSize * 1.4;
                            const maxWidth = widgetWidth - 12; // Padding inside container
                            // Text position follows actual widget location - clipping handles visibility
                            const textStartX = canvasX + 4;
                            const textStartY = canvasY + 4;

                            let currentY = textStartY;
                            const maxLines = Math.floor((widgetHeight - 8) / lineHeight);
                            let lineCount = 0;

                            for (const line of inputLines) {
                                if (lineCount >= maxLines) break;

                                // Wrap each line
                                const wrappedLines = line.length > 0 ? wrapText(line, maxWidth) : [''];

                                for (const wrappedLine of wrappedLines) {
                                    if (lineCount >= maxLines) break;
                                    // Draw at actual position - clipping region handles visibility
                                    ctx.fillText(wrappedLine, textStartX, currentY);
                                    currentY += lineHeight;
                                    lineCount++;
                                }
                            }

                            ctx.restore();
                        }
                    }
                }

                widgetY += WIDGET_HEIGHT + WIDGET_MARGIN;
            }
        }
    }

    isAvailable(): boolean {
        return this.offscreenCanvas !== null && this.offscreenCtx !== null;
    }

    getCanvas(): HTMLCanvasElement | null {
        return this.offscreenCanvas;
    }
}
