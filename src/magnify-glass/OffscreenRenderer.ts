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

    // Virtual Zoom Throttling (60 FPS = ~16ms per frame)
    private static readonly VIRTUAL_ZOOM_MIN_INTERVAL_MS = 16;
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
        // If we are zoomed in enough (>= 100%), Direct Capture quality is perfect,
        // and it guarantees perfect alignment with zero extra draws.
        // If we are zoomed out (< 100%), we use High Res Virtual Zoom for crisp details.
        // Note: Image preview nodes are handled by drawImagePreviewsNatively() during Virtual Zoom.
        // If forceDirectCapture is enabled (via hotkey), always use Direct Capture for accurate cursor alignment.
        const useDirectCapture = currentScale >= 1.0 || this.config.forceDirectCapture;

        if (useDirectCapture) {
            // Direct Capture: Full speed, no extra draws
            this.cachedVirtualZoomResult = null; // Invalidate cache when switching modes
            return this.renderDirectCapture(targetCanvas, renderSize, dpr);
        } else {
            // Virtual Zoom: Throttled to 60 FPS to prevent FPS counter inflation
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
     * Detect if there are nodes with image previews in the capture region.
     * These nodes (Save Image, Preview Image, etc.) have images that are drawn
     * via onDrawBackground/onDrawForeground and cause artifacts during Virtual Zoom.
     */
    private detectImagePreviewNodes(dpr: number, scale: number, offset: number[]): boolean {
        const graph = app?.graph;
        if (!graph || !graph._nodes) return false;

        const renderSize = this.config.glassSize;
        const sourceSizeCss = renderSize / this.config.zoomFactor;

        // Mouse position in CSS pixels
        const pivotCssX = this.state.x / dpr;
        const pivotCssY = this.state.y / dpr;

        // Capture region in CSS pixels
        const captureLeft = pivotCssX - (sourceSizeCss / 2);
        const captureTop = pivotCssY - (sourceSizeCss / 2);
        const captureRight = captureLeft + sourceSizeCss;
        const captureBottom = captureTop + sourceSizeCss;

        // Node types that have image previews
        const imagePreviewTypes = [
            'SaveImage', 'PreviewImage', 'LoadImage', 'LoadImageMask',
            'VHS_LoadVideo', 'VHS_VideoCombine', // Video nodes
            'ImagePreview', 'ShowImage' // Common variants
        ];

        for (const node of graph._nodes) {
            if (!node.pos || !node.size) continue;
            if (node.flags?.collapsed) continue;

            // Check if this node type has image previews
            const nodeType = node.type || node.comfyClass || '';
            const hasImagePreview = imagePreviewTypes.some(t =>
                nodeType.toLowerCase().includes(t.toLowerCase())
            ) || node.imgs?.length > 0; // Also check for imgs array directly

            if (!hasImagePreview) continue;

            // Calculate node position in CSS pixels
            const nodeCssX = node.pos[0] * scale + offset[0];
            const nodeCssY = node.pos[1] * scale + offset[1];
            const nodeCssWidth = node.size[0] * scale;
            const nodeCssHeight = node.size[1] * scale;

            // Check if node overlaps with capture region
            const nodeRight = nodeCssX + nodeCssWidth;
            const nodeBottom = nodeCssY + nodeCssHeight;

            const overlaps = !(nodeRight < captureLeft || nodeCssX > captureRight ||
                nodeBottom < captureTop || nodeCssY > captureBottom);

            if (overlaps) {
                return true; // Found an image preview node in capture region
            }
        }

        return false;
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

            // Draw node titles if emphasis is enabled
            if (this.config.accessibilityEnabled && this.config.nodeTitleEmphasis) {
                this.drawNodeTitlesNatively(sourceX, sourceY, sourceWidth, sourceHeight, renderSize, currentScale, currentOffset);
            }

            // NOTE: We do NOT call drawImagePreviewsNatively() here.
            // Direct Capture copies pixels from the screen which already has correctly-drawn images.
            // Native image drawing is only needed during Virtual Zoom where ComfyUI's rendering fails.

            // Draw cursor preview overlay if enabled
            if (this.config.showCursorPreview) {
                this.drawCursorPreview(renderSize);
            }

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
            // Set global flag so node renderers can check and skip expensive operations
            (window as any).__magnifyGlassCapturing = true;

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

            // Hide images AND preview widgets from nodes to prevent them from being drawn on the captured canvas
            // This prevents "ghosting" artifacts and crashes (since some custom widgets fail in Virtual Zoom)
            const hiddenNodeImages = new Map<any, any>();
            const hiddenNodeWidgets = new Map<any, any[]>();

            if (app?.graph?._nodes) {
                for (const node of app.graph._nodes) {
                    // 1. Hide node.imgs
                    if (node.imgs) {
                        hiddenNodeImages.set(node, node.imgs);
                        node.imgs = null;
                    }

                    // 2. Hide preview widgets
                    if (node.widgets && Array.isArray(node.widgets)) {
                        const hasPreviewWidget = node.widgets.some((w: any) => {
                            const wName = String(w.name || '').toLowerCase();
                            const wType = String(w.type || '').toLowerCase();
                            return wName.includes('preview') || wName.includes('image') || wName.includes('gallery') || wName.includes('upload') ||
                                wType.includes('preview') || wType.includes('image');
                        });

                        if (hasPreviewWidget) {
                            // Backup original widgets array
                            hiddenNodeWidgets.set(node, node.widgets);
                            // Filter out the preview widgets for this draw call
                            node.widgets = node.widgets.filter((w: any) => {
                                const wName = String(w.name || '').toLowerCase();
                                const wType = String(w.type || '').toLowerCase();
                                // Only hide explicit preview widgets. Inputs (image, upload) should remain visible.
                                const isPreview = wName.includes('preview') || wName.includes('gallery') ||
                                    wType.includes('preview');
                                return !isPreview;
                            });
                        }
                    }
                }
            }

            try {
                lgCanvas.draw(true, true);
            } finally {
                // Restore images
                for (const [node, imgs] of hiddenNodeImages.entries()) {
                    node.imgs = imgs;
                }
                // Restore widgets
                for (const [node, widgets] of hiddenNodeWidgets.entries()) {
                    node.widgets = widgets;
                }
            }

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

            // Draw node titles if emphasis is enabled
            if (this.config.accessibilityEnabled && this.config.nodeTitleEmphasis) {
                this.drawNodeTitlesNatively(sourceX, sourceY, sourceWidth, sourceHeight, renderSize, targetScale, captureOffset);
            }

            // Draw image/video previews natively on top of the captured canvas
            this.drawImagePreviewsNatively(sourceX, sourceY, sourceWidth, sourceHeight, renderSize, targetScale, captureOffset);

            // Draw cursor preview overlay if enabled
            if (this.config.showCursorPreview) {
                this.drawCursorPreview(renderSize);
            }

            // Restore original zoom state by directly setting the saved values.
            // IMPORTANT: Do NOT use setZoom() here! setZoom() recalculates offset from a pivot point,
            // which introduces floating-point drift (1-2px per call) causing vertical/horizontal drift.
            // We must restore the EXACT original offset values to prevent cumulative drift.
            lgCanvas.ds.scale = origScale;
            lgCanvas.ds.offset[0] = origOffsetX;
            lgCanvas.ds.offset[1] = origOffsetY;
            lgCanvas.draw(true, true);

            this.isCapturing = false;
            (window as any).__magnifyGlassCapturing = false;
            return this.offscreenCanvas;

        } catch (e) {
            console.warn("VirtualZoom failed", e);
            // Emergency restore
            lgCanvas.ds.scale = currentScale;
            lgCanvas.draw(true, true);
            this.isCapturing = false;
            (window as any).__magnifyGlassCapturing = false;
            return null;
        }
    }



    /**
     * Draw node titles natively with accessibility styling.
     */
    private drawNodeTitlesNatively(
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
        const TITLE_HEIGHT = 30;

        // Coordinate transforms
        const sourceSizeCss = renderSize / this.config.zoomFactor;
        const actualDpr = sourceWidth / sourceSizeCss;
        const captureScale = renderSize / sourceWidth;

        // Source region in CSS pixels
        const sourceCssX = sourceX / actualDpr;
        const sourceCssY = sourceY / actualDpr;
        const sourceCssWidth = sourceWidth / actualDpr;
        const sourceCssHeight = sourceHeight / actualDpr;

        for (const node of graph._nodes) {
            if (!node.pos || !node.size) continue;
            if (node.flags?.collapsed) continue;

            const title = node.title || node.type || "Node";

            // Node position in CSS pixels
            const nodeCssX = node.pos[0] * scale + offset[0];
            const nodeCssY = node.pos[1] * scale + offset[1];
            const nodeCssWidth = node.size[0] * scale;

            // Check visibility
            if (nodeCssX + nodeCssWidth < sourceCssX || nodeCssX > sourceCssX + sourceCssWidth) continue;
            if (nodeCssY + (TITLE_HEIGHT * scale) < sourceCssY || nodeCssY > sourceCssY + sourceCssHeight) continue;

            // Draw
            const canvasX = (nodeCssX - sourceCssX) * actualDpr * captureScale;
            const canvasY = (nodeCssY - sourceCssY) * actualDpr * captureScale;
            // Limit width for title background
            const canvasWidth = Math.min(nodeCssWidth, nodeCssWidth) * actualDpr * captureScale;
            const canvasHeight = TITLE_HEIGHT * scale * actualDpr * captureScale;

            if (canvasX + canvasWidth > 0 && canvasX < renderSize && canvasY + canvasHeight > 0 && canvasY < renderSize) {
                ctx.save();

                // Enhanced Background
                ctx.beginPath();
                ctx.roundRect(canvasX, canvasY - (5 * scale), canvasWidth, canvasHeight, 4);
                ctx.fillStyle = this.config.highContrastMode ? '#000000' : '#222222';
                ctx.fill();

                // Border/Highlight
                ctx.strokeStyle = this.config.highContrastMode ? '#ffffff' : '#444444';
                ctx.lineWidth = 2;
                ctx.stroke();

                // Enhanced Text
                const baseFontSize = 14;
                let scaleFactor = this.config.fontScaleFactor / 100;
                // Boost title size a bit more
                scaleFactor *= 1.1;

                const fontSize = Math.max(12, Math.min(32, baseFontSize * scale * actualDpr * captureScale * scaleFactor));

                ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';

                // Color based on settings
                let textColor = '#ffffff';
                if (this.config.highContrastMode) textColor = '#ffff00'; // Yellow on black is very high contrast

                ctx.fillStyle = textColor;

                // Accessibility features
                if (this.config.textGlowEnabled) {
                    ctx.shadowBlur = this.config.textGlowIntensity;
                    ctx.shadowColor = this.config.textGlowColor;
                }

                const padding = 10 * scale * actualDpr * captureScale;
                ctx.fillText(title, canvasX + padding, canvasY + (canvasHeight / 2) - (5 * scale));

                ctx.restore();
            }
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

                // Check if widget type contains text AND is a multi-line text area
                // We only want to draw our custom rendering for multi-line text widgets (like CLIP prompts)
                // NOT for simple single-line string inputs (like filename_prefix) which are already canvas-rendered
                const widgetType = String(widget.type || '').toLowerCase();

                // Check if this is a multi-line text widget that needs our native rendering
                // Multi-line text widgets typically have:
                // - type 'customtext' (CLIP text encode uses this)
                // - computedHeight >= 40 (multi-line areas are taller)
                // Single-line string inputs typically have:
                // - type 'string' with no computedHeight or small computedHeight
                // - These are already rendered on the canvas by ComfyUI
                const computedHeight = (widget as any).computedHeight || 0;
                const isMarkdownWidget = widgetType === 'markdown'; // ComfyUI standard type

                const isMultiLineWidget = isMarkdownWidget || widgetType === 'customtext' ||
                    ((widgetType === 'text' || widgetType === 'textarea') && computedHeight >= 40);

                // Common calculations for positioning
                const widgetCssX = nodeCssX + (PADDING * scale);
                const widgetCssY = nodeCssY + (widgetLocalY * scale);
                const widgetCssWidth = nodeCssWidth - (PADDING * 2 * scale);

                // Convert from CSS to offscreen canvas coordinates
                const canvasX = (widgetCssX - sourceCssX) * actualDpr * captureScale;
                const canvasY = (widgetCssY - sourceCssY) * actualDpr * captureScale;
                const widgetWidth = widgetCssWidth * actualDpr * captureScale;

                // Calculate font size
                // Calculate font size with accessibility scaling
                const baseFontSize = 13;
                let scaleFactor = 1.0;
                if (this.config.accessibilityEnabled) {
                    scaleFactor = this.config.fontScaleFactor / 100;
                }
                const fontSize = Math.max(10, Math.min(28 * scaleFactor, baseFontSize * scale * actualDpr * captureScale * scaleFactor));
                const lineHeight = fontSize * 1.4;

                // ----------------------------------------------------------------
                // RENDER TEXT / MARKDOWN
                // ----------------------------------------------------------------
                if (isMultiLineWidget && widget.value !== undefined && widget.value !== null) {
                    const textValue = String(widget.value);
                    if (textValue.length > 0) {
                        // Calculate required height based on content
                        let contentHeight = 0;
                        if (isMarkdownWidget) {
                            // Rough estimation of height needed
                            ctx.save();
                            const fontWeight = (this.config.accessibilityEnabled && this.config.boldTextEnabled) ? '700' : '500';
                            ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
                            const maxWidth = widgetWidth - 12;

                            const lines = textValue.split('\n');
                            for (const line of lines) {
                                const words = line.split(/(\s+)/);
                                let currentLine = '';
                                let lineCount = 1;
                                for (const word of words) {
                                    if (ctx.measureText(currentLine + word).width > maxWidth) {
                                        lineCount++;
                                        currentLine = word;
                                    } else {
                                        currentLine += word;
                                    }
                                }
                                contentHeight += lineCount * lineHeight;
                            }
                            ctx.restore();

                            // Add padding
                            contentHeight += 16;
                        }

                        // Calculate available height in canvas pixels to prevent spilling
                        // Node bottom in CSS pixels
                        const nodeBottomCss = nodeCssY + nodeCssHeight;
                        // Max height for this widget in CSS pixels (stay inside node, minus padding)
                        const maxWidgetHeightCss = Math.max(0, nodeBottomCss - widgetCssY - (PADDING * scale));
                        // Convert to canvas pixels
                        const maxWidgetHeight = maxWidgetHeightCss * actualDpr * captureScale;

                        // Calculate widget height - Render full content for markdown up to node bounds
                        const widgetHeight = (isMarkdownWidget)
                            ? Math.min(Math.max((widget as any).computedHeight * scale * captureScale || 0, contentHeight), maxWidgetHeight)
                            : ((widget as any).computedHeight
                                ? (widget as any).computedHeight * scale * captureScale
                                : Math.max(80, fontSize * 5));

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
                            ctx.fillStyle = (this.config.accessibilityEnabled && this.config.highContrastMode) ? '#000000' : '#1e1e1e';
                            ctx.fill();

                            // Draw border
                            ctx.strokeStyle = '#3a3a3a';
                            ctx.lineWidth = 1;
                            ctx.stroke();

                            // Clip to container bounds to prevent text spill
                            ctx.beginPath();
                            ctx.roundRect(containerX, containerY, containerWidth, containerHeight, borderRadius);
                            ctx.clip();

                            // Use advanced markdown rendering instead of simple text
                            this.drawMarkdown(ctx, textValue, canvasX + 4, canvasY + 4, widgetWidth - 12, widgetHeight - 8, fontSize);

                            ctx.restore();
                        }
                    }
                }

                widgetY += WIDGET_HEIGHT + WIDGET_MARGIN;
            }
        }
    }

    /**
     * Draw image and video previews natively on the offscreen canvas.
     * This renders preview content that would otherwise cause errors during Virtual Zoom,
     * because ComfyUI's ImagePreviewWidget fails when the canvas scale is manipulated.
     * 
     * Handles:
     * - node.imgs[] array (standard ComfyUI SaveImage/PreviewImage nodes)
     * - VHS-style DOM widget previews (video/image elements)
     * 
     * @param sourceX - Source X position in backing pixels
     * @param sourceY - Source Y position in backing pixels
     * @param sourceWidth - Source width in backing pixels
     * @param sourceHeight - Source height in backing pixels
     * @param renderSize - Output render size in pixels
     * @param scale - Canvas scale used during capture
     * @param offset - Canvas offset [x, y] used during capture
     */
    private drawImagePreviewsNatively(
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

        // Calculate coordinate transforms (same as drawWidgetTextNatively)
        const sourceSizeCss = renderSize / this.config.zoomFactor;
        const actualDpr = sourceWidth / sourceSizeCss;
        const captureScale = renderSize / sourceWidth;

        // Source region in CSS pixels
        const sourceCssX = sourceX / actualDpr;
        const sourceCssY = sourceY / actualDpr;
        const sourceCssWidth = sourceWidth / actualDpr;
        const sourceCssHeight = sourceHeight / actualDpr;

        // LiteGraph constants
        const TITLE_HEIGHT = 30;
        const WIDGET_MARGIN = 4;

        for (const node of graph._nodes) {
            if (!node.pos || !node.size) continue;
            if (node.flags?.collapsed) continue;

            // Calculate node position in CSS pixels
            const nodeCssX = node.pos[0] * scale + offset[0];
            const nodeCssY = node.pos[1] * scale + offset[1];
            const nodeCssWidth = node.size[0] * scale;
            const nodeCssHeight = node.size[1] * scale;

            // Check if node is in captured region
            if (nodeCssX + nodeCssWidth < sourceCssX || nodeCssX > sourceCssX + sourceCssWidth) continue;
            if (nodeCssY + nodeCssHeight < sourceCssY || nodeCssY > sourceCssY + sourceCssHeight) continue;

            // Method 1: Handle node.imgs[] array (standard ComfyUI preview)
            if (node.imgs && Array.isArray(node.imgs) && node.imgs.length > 0) {
                this.drawNodeImages(
                    ctx, node, nodeCssX, nodeCssY, nodeCssWidth, nodeCssHeight,
                    sourceCssX, sourceCssY, actualDpr, captureScale, renderSize, scale
                );
            }

            // Method 2: Handle VHS-style DOM widget previews
            if (node.widgets) {
                for (const widget of node.widgets) {
                    const widgetName = String(widget.name || '').toLowerCase();
                    if (widgetName === 'videopreview' || widgetName === 'audiopreview') {
                        this.drawDomWidgetPreview(
                            ctx, widget, node, nodeCssX, nodeCssY, nodeCssWidth,
                            sourceCssX, sourceCssY, actualDpr, captureScale, renderSize, scale
                        );
                    }
                }
            }
        }
    }

    /**
     * Draw images from node.imgs[] array onto the offscreen canvas.
     */
    private drawNodeImages(
        ctx: CanvasRenderingContext2D,
        node: any,
        nodeCssX: number,
        nodeCssY: number,
        nodeCssWidth: number,
        nodeCssHeight: number,
        sourceCssX: number,
        sourceCssY: number,
        actualDpr: number,
        captureScale: number,
        renderSize: number,
        scale: number
    ): void {
        const TITLE_HEIGHT = 30;
        const PADDING = 10;

        // Calculate image area (below title, with padding)
        const imageAreaY = nodeCssY + (TITLE_HEIGHT * scale);
        const imageAreaWidth = nodeCssWidth - (PADDING * 2 * scale);
        const imageAreaHeight = nodeCssHeight - (TITLE_HEIGHT * scale) - (PADDING * scale);

        if (imageAreaWidth <= 0 || imageAreaHeight <= 0) return;

        // For simplicity, draw the first image that fits
        // ComfyUI typically shows images in a grid, but for the magnifier we'll show the first/selected one
        const imgs = node.imgs;
        const imageIndex = node.imageIndex ?? 0;
        const img = imgs[Math.min(imageIndex, imgs.length - 1)];

        if (!img || !(img instanceof HTMLImageElement) || !img.complete || img.naturalWidth === 0) {
            return;
        }

        try {
            // Calculate aspect-ratio-preserving dimensions
            const imgAspect = img.naturalWidth / img.naturalHeight;
            const areaAspect = imageAreaWidth / imageAreaHeight;

            let drawWidth = imageAreaWidth;
            let drawHeight = imageAreaHeight;

            if (imgAspect > areaAspect) {
                // Image is wider - fit to width
                drawHeight = drawWidth / imgAspect;
            } else {
                // Image is taller - fit to height
                drawWidth = drawHeight * imgAspect;
            }

            // Center the image in the area
            const drawX = nodeCssX + (PADDING * scale) + (imageAreaWidth - drawWidth) / 2;
            const drawY = imageAreaY + (imageAreaHeight - drawHeight) / 2;

            // Convert to offscreen canvas coordinates
            const canvasX = (drawX - sourceCssX) * actualDpr * captureScale;
            const canvasY = (drawY - sourceCssY) * actualDpr * captureScale;
            const canvasWidth = drawWidth * actualDpr * captureScale;
            const canvasHeight = drawHeight * actualDpr * captureScale;

            // Check if at least partially visible
            if (canvasX + canvasWidth > 0 && canvasX < renderSize &&
                canvasY + canvasHeight > 0 && canvasY < renderSize) {

                ctx.save();
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(img, canvasX, canvasY, canvasWidth, canvasHeight);
                ctx.restore();
            }
        } catch (e) {
            // Silently fail for individual images
        }
    }

    /**
     * Draw VHS-style DOM widget video/image preview onto the offscreen canvas.
     */
    private drawDomWidgetPreview(
        ctx: CanvasRenderingContext2D,
        widget: any,
        node: any,
        nodeCssX: number,
        nodeCssY: number,
        nodeCssWidth: number,
        sourceCssX: number,
        sourceCssY: number,
        actualDpr: number,
        captureScale: number,
        renderSize: number,
        scale: number
    ): void {
        // VHS widgets have videoEl and imgEl properties
        const videoEl = widget.videoEl as HTMLVideoElement | undefined;
        const imgEl = widget.imgEl as HTMLImageElement | undefined;

        // Determine which element to draw
        let sourceElement: HTMLVideoElement | HTMLImageElement | undefined;
        let sourceWidth = 0;
        let sourceHeight = 0;

        if (videoEl && !videoEl.hidden && videoEl.videoWidth > 0) {
            sourceElement = videoEl;
            sourceWidth = videoEl.videoWidth;
            sourceHeight = videoEl.videoHeight;
        } else if (imgEl && !imgEl.hidden && imgEl.naturalWidth > 0) {
            sourceElement = imgEl;
            sourceWidth = imgEl.naturalWidth;
            sourceHeight = imgEl.naturalHeight;
        }

        if (!sourceElement || sourceWidth === 0 || sourceHeight === 0) return;

        try {
            // Widget positioning - VHS uses computedHeight and last_y
            const widgetY = (widget as any).last_y ?? 30;
            const widgetHeight = widget.computedHeight ?? 100;

            const widgetCssY = nodeCssY + (widgetY * scale);
            const widgetCssWidth = nodeCssWidth - 20 * scale; // VHS padding
            const widgetCssHeight = widgetHeight * scale;

            if (widgetCssWidth <= 0 || widgetCssHeight <= 0) return;

            // Calculate aspect-ratio-preserving dimensions
            const srcAspect = sourceWidth / sourceHeight;
            const areaAspect = widgetCssWidth / widgetCssHeight;

            let drawWidth = widgetCssWidth;
            let drawHeight = widgetCssHeight;

            if (srcAspect > areaAspect) {
                drawHeight = drawWidth / srcAspect;
            } else {
                drawWidth = drawHeight * srcAspect;
            }

            // Center in widget area
            const drawX = nodeCssX + 10 * scale + (widgetCssWidth - drawWidth) / 2;
            const drawY = widgetCssY + (widgetCssHeight - drawHeight) / 2;

            // Convert to offscreen canvas coordinates
            const canvasX = (drawX - sourceCssX) * actualDpr * captureScale;
            const canvasY = (drawY - sourceCssY) * actualDpr * captureScale;
            const canvasWidth = drawWidth * actualDpr * captureScale;
            const canvasHeight = drawHeight * actualDpr * captureScale;

            // Check if at least partially visible
            if (canvasX + canvasWidth > 0 && canvasX < renderSize &&
                canvasY + canvasHeight > 0 && canvasY < renderSize) {

                ctx.save();
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(sourceElement, canvasX, canvasY, canvasWidth, canvasHeight);
                ctx.restore();
            }
        } catch (e) {
            // Silently fail for individual previews
        }
    }

    /**
     * Render markdown text onto the context.
     * Supports basic headers (#) and lists (-).
     */
    private drawMarkdown(
        ctx: CanvasRenderingContext2D,
        text: string,
        x: number,
        y: number,
        maxWidth: number,
        maxHeight: number,
        fontSize: number
    ): void {
        const lines = text.split('\n');
        const lineHeight = fontSize * 1.4;
        let currentY = y;
        const maxY = y + maxHeight;

        ctx.textBaseline = 'top';

        // High Contrast Mode Color Selection
        let textColor = '#e0e0e0';
        if (this.config.accessibilityEnabled && this.config.highContrastMode) {
            textColor = '#ffffff'; // Pure white for high contrast
        }
        ctx.fillStyle = textColor;

        // Word wrap helper
        const wrapText = (text: string, maxWidth: number, font: string): string[] => {
            ctx.font = font;
            const words = text.split(/(\s+)/);
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
            if (currentLine.length > 0) wrappedLines.push(currentLine.trimEnd());
            return wrappedLines;
        };

        for (const line of lines) {
            if (currentY >= maxY) break;

            let renderText = line;
            const fontWeight = (this.config.accessibilityEnabled && this.config.boldTextEnabled) ? '700' : '500';
            const headerWeight = (this.config.accessibilityEnabled && this.config.boldTextEnabled) ? '900' : '700';

            let currentFont = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
            let indent = 0;
            let color = textColor;

            // 1. Headers
            if (line.startsWith('#')) {
                const level = line.match(/^#+/)?.[0].length || 0;
                renderText = line.substring(level).trim();
                const headerScale = Math.max(1.1, 1.8 - (level * 0.15)); // H1=1.8x, H2=1.65x
                const headerSize = fontSize * headerScale;
                currentFont = `${headerWeight} ${headerSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
                // Add a little margin before headers
                currentY += fontSize * 0.5;
            }
            // 2. Lists
            else if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
                renderText = '• ' + line.trim().substring(2);
                indent = fontSize; // Indent list items
            }

            const wrapped = wrapText(renderText, maxWidth - indent, currentFont);

            ctx.font = currentFont;
            ctx.fillStyle = color;

            for (const wrap of wrapped) {
                if (currentY >= maxY) break;

                // improved accessibility text drawing
                this.drawAccessibleText(ctx, wrap, x + indent, currentY);

                // Headers get taller line height
                const currentLineHeight = line.startsWith('#') ? (parseFloat(currentFont.split(' ')[1]) * 1.4) : lineHeight;
                currentY += currentLineHeight;
            }
        }
    }



    /**
     * Render a button widget.
     * Draws a rounded rectangle with the label centered.
     */
    private drawButton(
        ctx: CanvasRenderingContext2D,
        label: string,
        x: number,
        y: number,
        width: number,
        height: number,
        fontSize: number
    ): void {
        const radius = 6;

        ctx.save();

        // Button background
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, radius);
        ctx.fillStyle = '#222'; // Dark button background
        ctx.fill();

        // Button border
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Button label
        ctx.font = `600 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let textColor = '#ccc'; // Light grey text
        if (this.config.accessibilityEnabled && this.config.highContrastMode) {
            textColor = '#ffffff';
        }
        ctx.fillStyle = textColor;

        // Center text in button
        const fileUploadLabel = "choose file to upload";
        // If it's the long upload label, we might need smaller font or wrapping, 
        // but typically buttons are single line.
        // We'll just truncate if too long or let it clip via context clipping if we added any (we didn't yet).

        this.drawAccessibleText(ctx, label, x + width / 2, y + height / 2);

        ctx.restore();
    }

    /**
     * Draw a mini cursor preview at the center of the glass.
     * The cursor is drawn as a classic arrow pointer with a contrasting outline.
     * @param renderSize - The render size of the glass in pixels
     */
    private drawCursorPreview(renderSize: number): void {
        if (!this.offscreenCtx) return;
        const ctx = this.offscreenCtx;

        // Cursor size scales with glass size (roughly 8-12% of glass size)
        const cursorSize = Math.max(16, Math.min(32, renderSize * 0.1));

        // Center position of the glass
        const centerX = renderSize / 2;
        const centerY = renderSize / 2;

        ctx.save();

        // Translate to center (cursor tip will be at center)
        ctx.translate(centerX, centerY);

        // Scale the cursor shape
        const scale = cursorSize / 24; // Base cursor is 24px
        ctx.scale(scale, scale);

        // Classic arrow cursor shape (pointing up-left)
        ctx.beginPath();
        ctx.moveTo(0, 0);           // Tip
        ctx.lineTo(0, 17);          // Down
        ctx.lineTo(4, 13);          // Notch right
        ctx.lineTo(7, 20);          // Handle bottom-right
        ctx.lineTo(10, 19);         // Handle outer
        ctx.lineTo(7, 12);          // Handle top
        ctx.lineTo(12, 12);         // Arrow right point
        ctx.closePath();

        // Draw white fill
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.fill();

        // Draw black outline for contrast
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.9)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.restore();
    }

    isAvailable(): boolean {
        return this.offscreenCanvas !== null && this.offscreenCtx !== null;
    }

    getCanvas(): HTMLCanvasElement | null {
        return this.offscreenCanvas;
    }

    /**
     * Draw text with accessibility enhancements (glow, outline).
     */
    private drawAccessibleText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number): void {
        if (!this.config.accessibilityEnabled) {
            ctx.fillText(text, x, y);
            return;
        }

        ctx.save();

        // 1. Text Glow
        if (this.config.textGlowEnabled) {
            ctx.shadowBlur = this.config.textGlowIntensity;
            ctx.shadowColor = this.config.textGlowColor;
            // Draw regular text with shadow
            ctx.fillText(text, x, y);
            // Draw again to strengthen if needed, or just let shadow do work
        }

        // 2. Text Outline
        if (this.config.textOutlineEnabled) {
            ctx.lineWidth = 3; // Thicker stroke for visibility
            ctx.strokeStyle = this.config.textOutlineColor;
            ctx.lineJoin = 'round';
            ctx.miterLimit = 2;
            ctx.strokeText(text, x, y);
        }

        // 3. Main Text Fill (ensure high contrast if enabled)
        if (this.config.highContrastMode) {
            ctx.fillStyle = '#ffffff';
        }

        // Remove shadow for main fill to prevent muddying
        ctx.shadowBlur = 0;
        ctx.fillText(text, x, y);

        ctx.restore();
    }
}
