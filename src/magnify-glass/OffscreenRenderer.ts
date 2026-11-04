/**
 * ComfyUI MagnifyGlass - Offscreen Renderer
 *
 * Hybrid Renderer:
 * 1. Direct Capture (Nuclear) for near-100% zoom (Perfect Alignment, Good Quality).
 * 2. Virtual Zoom (High Res) for zoomed-out views (High Detail, sensitive alignment).
 *
 * Image and video previews are drawn on top in both modes from their full-resolution sources.
 */

import type { ConfigManager } from './ConfigManager';
import type { MagnifierState } from './MagnifierState';
import { getSettingValue } from '../shared/utils';
import { captureRegion, fitContent, graphBoxToCss, isSafeMediaSource, previewImageBoxes, scaleAbout, toGlass } from './mediaLayout';
import type { Box, CaptureRegion } from './mediaLayout';

declare const app: any;

const TITLE_HEIGHT = 30;

interface DomMedia {
    el: HTMLImageElement | HTMLVideoElement;
    box: Box;
    objectFit: string;
}

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

        const rect = targetCanvas.getBoundingClientRect();
        // Calculate DPR exactly as EventHandler does (Canvas Pixels / CSS Pixels)
        const dpr = rect.width > 0 ? targetCanvas.width / rect.width : 1;
        // state.x/y are Backing Pixels; the pivot is in CSS pixels relative to the canvas
        const pivotX = this.state.x / dpr;
        const pivotY = this.state.y / dpr;
        const cap = captureRegion(pivotX, pivotY, renderSize, this.config.zoomFactor);

        // Vue nodes are DOM, so re-rendering the canvas at scale 1 gains nothing and makes the nodes jitter.
        // forceDirectCapture (hotkey) trades detail for exact cursor alignment.
        const vueNodes = !!(window as any).LiteGraph?.vueNodesMode;
        const currentScale = lgCanvas.ds.scale;
        const media = this.collectDomMedia(rect, vueNodes);

        if (currentScale < 1.0 && !this.config.forceDirectCapture && !vueNodes) {
            const domScale = 1 / currentScale;
            const scaled = media.map(m => ({ ...m, box: scaleAbout(m.box, pivotX, pivotY, domScale) }));
            return this.renderVirtualZoom(lgCanvas, targetCanvas, rect, dpr, pivotX, pivotY, cap, scaled);
        }
        return this.renderDirectCapture(targetCanvas, dpr, cap, media, vueNodes);
    }

    /**
     * Read phase: measure loaded, same-origin DOM images and videos (DOM widgets, or Vue node bodies)
     * before any canvas draw. Boxes are CSS pixels relative to the canvas at the real zoom.
     */
    private collectDomMedia(rect: DOMRect, vueNodes: boolean): DomMedia[] {
        const selector = vueNodes ? '[data-node-id] img, [data-node-id] video' : '.dom-widget img, .dom-widget video';
        const media: DomMedia[] = [];
        for (const el of document.querySelectorAll<HTMLImageElement | HTMLVideoElement>(selector)) {
            const loaded = el instanceof HTMLVideoElement ? el.readyState >= 2 : el.complete && el.naturalWidth > 0;
            if (!loaded || !isSafeMediaSource(el)) continue;
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            media.push({
                el,
                box: { x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height },
                objectFit: getComputedStyle(el).objectFit
            });
        }
        return media;
    }

    /**
     * Nodes of the graph on screen (including subgraphs) that overlap the capture region,
     * in canvas render order (back to front).
     */
    private getVisibleNodes(cap: CaptureRegion, scale: number, offset: [number, number]): any[] {
        const visibleNodes = [];
        for (const node of app.canvas.visible_nodes) {
            if (!node.pos || !node.size) continue;
            if (node.flags?.collapsed) continue;

            const box = graphBoxToCss({ x: 0, y: 0, w: node.size[0], h: node.size[1] }, node.pos, scale, offset);
            if (box.x + box.w < cap.left || box.x > cap.left + cap.size) continue;
            if (box.y + box.h < cap.top || box.y > cap.top + cap.size) continue;

            visibleNodes.push(node);
        }
        return visibleNodes;
    }

    private accessibilityFilter(): string {
        if (this.config.invertColors) return 'invert(1)';
        if (this.config.grayscaleMode) return 'grayscale(1)';
        return 'none';
    }

    private drawCapture(targetCanvas: HTMLCanvasElement, dpr: number, cap: CaptureRegion): void {
        const renderSize = this.config.glassSize;
        this.offscreenCtx!.save();
        this.offscreenCtx!.filter = this.accessibilityFilter();
        this.offscreenCtx!.drawImage(
            targetCanvas,
            cap.left * dpr, cap.top * dpr, cap.size * dpr, cap.size * dpr,
            0, 0, renderSize, renderSize
        );
        this.offscreenCtx!.restore();
    }

    /**
     * Mode 1: Direct Capture (Nuclear Fix)
     * Copies pixels directly from screen. Zero drift.
     */
    private renderDirectCapture(targetCanvas: HTMLCanvasElement, dpr: number, cap: CaptureRegion, media: DomMedia[], vueNodes: boolean): HTMLCanvasElement | null {
        try {
            this.isCapturing = true;
            const renderSize = this.config.glassSize;

            this.offscreenCtx!.clearRect(0, 0, renderSize, renderSize);
            this.drawCapture(targetCanvas, dpr, cap);

            const ds = app.canvas.ds;
            const scale = ds.scale;
            const offset: [number, number] = [ds.offset[0], ds.offset[1]];
            // Vue nodes draw their own text and titles in the DOM
            const visibleNodes = vueNodes ? [] : this.getVisibleNodes(cap, scale, offset);

            this.drawMedia(targetCanvas, dpr, visibleNodes, media, cap, scale, offset);

            this.drawWidgetTextNatively(visibleNodes, cap, scale, offset);

            if (this.config.accessibilityEnabled && this.config.nodeTitleEmphasis) {
                this.drawNodeTitlesNatively(visibleNodes, cap, scale, offset);
            }

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
    private renderVirtualZoom(
        lgCanvas: any,
        targetCanvas: HTMLCanvasElement,
        rect: DOMRect,
        dpr: number,
        pivotX: number,
        pivotY: number,
        cap: CaptureRegion,
        media: DomMedia[]
    ): HTMLCanvasElement | null {
        const ds = lgCanvas.ds;
        const origScale = ds.scale;
        const origOffsetX = ds.offset[0];
        const origOffsetY = ds.offset[1];
        const renderSize = this.config.glassSize;

        this.isCapturing = true;
        // Set global flag so node renderers can check and skip expensive operations
        (window as any).__magnifyGlassCapturing = true;

        try {
            // setZoom expects the centre in client coordinates (changeScale subtracts the canvas rect)
            lgCanvas.setZoom(1.0, [pivotX + rect.left, pivotY + rect.top]);

            // Hide images and preview widgets for the scale-1 draw. The frontend draws previews in a
            // deferred microtask, so they would miss this capture and ghost onto the screen afterwards.
            // drawMedia() draws them from their sources instead.
            const hiddenNodeImages = new Map<any, any>();
            const hiddenNodeWidgets = new Map<any, any[]>();

            for (const node of lgCanvas.graph._nodes) {
                if (node.imgs) {
                    hiddenNodeImages.set(node, node.imgs);
                    node.imgs = null;
                }

                if (node.widgets && Array.isArray(node.widgets)) {
                    const hasPreviewWidget = node.widgets.some((w: any) => {
                        const wName = String(w.name || '').toLowerCase();
                        const wType = String(w.type || '').toLowerCase();
                        return wName.includes('preview') || wName.includes('image') || wName.includes('gallery') || wName.includes('upload') ||
                            wType.includes('preview') || wType.includes('image');
                    });

                    if (hasPreviewWidget) {
                        hiddenNodeWidgets.set(node, node.widgets);
                        // Only hide explicit preview widgets. Inputs (image, upload) should remain visible.
                        node.widgets = node.widgets.filter((w: any) => {
                            const wName = String(w.name || '').toLowerCase();
                            const wType = String(w.type || '').toLowerCase();
                            const isPreview = wName.includes('preview') || wName.includes('gallery') ||
                                wType.includes('preview');
                            return !isPreview;
                        });
                    }
                }
            }

            try {
                lgCanvas.draw(true, true);
            } finally {
                for (const [node, imgs] of hiddenNodeImages.entries()) {
                    node.imgs = imgs;
                }
                for (const [node, widgets] of hiddenNodeWidgets.entries()) {
                    node.widgets = widgets;
                }
            }

            this.offscreenCtx!.clearRect(0, 0, renderSize, renderSize);
            this.drawCapture(targetCanvas, dpr, cap);

            // setZoom() moved the offset to zoom around the pivot; use the capture-time transform
            const captureScale = ds.scale;
            const captureOffset: [number, number] = [ds.offset[0], ds.offset[1]];
            const visibleNodes = this.getVisibleNodes(cap, captureScale, captureOffset);

            this.drawMedia(targetCanvas, dpr, visibleNodes, media, cap, captureScale, captureOffset);

            this.drawWidgetTextNatively(visibleNodes, cap, captureScale, captureOffset);

            if (this.config.accessibilityEnabled && this.config.nodeTitleEmphasis) {
                this.drawNodeTitlesNatively(visibleNodes, cap, captureScale, captureOffset);
            }

            if (this.config.showCursorPreview) {
                this.drawCursorPreview(renderSize);
            }

            return this.offscreenCanvas;
        } catch (e) {
            console.warn("VirtualZoom failed", e);
            return null;
        } finally {
            // Restore original zoom state and draw one clean frame
            ds.scale = origScale;
            ds.offset[0] = origOffsetX;
            ds.offset[1] = origOffsetY;

            this.isCapturing = false;
            (window as any).__magnifyGlassCapturing = false;
            lgCanvas.draw(true, true);
        }
    }

    /**
     * Draw canvas image previews (from full-resolution node.imgs) and DOM images/videos
     * into the glass. Video is redrawn every tick, so it plays.
     */
    private drawMedia(
        targetCanvas: HTMLCanvasElement,
        dpr: number,
        visibleNodes: any[],
        media: DomMedia[],
        cap: CaptureRegion,
        scale: number,
        offset: [number, number]
    ): void {
        const ctx = this.offscreenCtx!;
        const renderSize = this.config.glassSize;
        const onGlass = (b: Box) => b.w > 0 && b.h > 0 && b.x < renderSize && b.y < renderSize && b.x + b.w > 0 && b.y + b.h > 0;
        const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

        ctx.save();
        ctx.filter = this.accessibilityFilter();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        const sizeTextMargin = getSettingValue('Comfy.Node.AllowImageSizeDraw', true) ? 15 : 0;
        for (const [i, node] of visibleNodes.entries()) {
            const widget = node.imgs?.length && node.widgets?.find((w: any) => w.name === '$$canvas-image-preview');
            if (!widget) continue;
            for (const { img, box } of previewImageBoxes(node.imgs, widget, node, sizeTextMargin)) {
                const g = toGlass(graphBoxToCss(box, node.pos, scale, offset), cap);
                if (onGlass(g) && isSafeMediaSource(img)) ctx.drawImage(img, g.x, g.y, g.w, g.h);
            }

            // Nodes later in render order cover this preview on the canvas: put them back from the capture
            const nodeBox = toGlass(graphBoxToCss({ x: 0, y: 0, w: node.size[0], h: node.size[1] }, node.pos, scale, offset), cap);
            for (const front of visibleNodes.slice(i + 1)) {
                const f = toGlass(graphBoxToCss({ x: 0, y: -TITLE_HEIGHT, w: front.size[0], h: front.size[1] + TITLE_HEIGHT }, front.pos, scale, offset), cap);
                if (!overlaps(f, nodeBox)) continue;
                ctx.save();
                ctx.beginPath();
                ctx.rect(f.x, f.y, f.w, f.h);
                ctx.clip();
                this.drawCapture(targetCanvas, dpr, cap);
                ctx.restore();
            }
        }

        for (const { el, box, objectFit } of media) {
            const g = toGlass(box, cap);
            if (!onGlass(g)) continue;
            const content = el instanceof HTMLVideoElement
                ? fitContent(g, el.videoWidth, el.videoHeight, objectFit)
                : fitContent(g, el.naturalWidth, el.naturalHeight, objectFit);
            ctx.save();
            ctx.beginPath();
            ctx.rect(g.x, g.y, g.w, g.h);
            ctx.clip();
            ctx.drawImage(el, content.x, content.y, content.w, content.h);
            ctx.restore();
        }

        ctx.restore();
    }

    /**
     * Draw node titles natively with accessibility styling.
     */
    private drawNodeTitlesNatively(
        visibleNodes: any[],
        cap: CaptureRegion,
        scale: number,
        offset: [number, number]
    ): void {
        if (!this.offscreenCtx) return;

        const ctx = this.offscreenCtx;
        const renderSize = this.config.glassSize;

        for (const node of visibleNodes) {
            if (!node.pos || !node.size) continue;
            if (node.flags?.collapsed) continue;

            const title = node.title || node.type || "Node";

            // Node position in CSS pixels
            const nodeCssX = (node.pos[0] + offset[0]) * scale;
            const nodeCssY = (node.pos[1] + offset[1]) * scale;
            const nodeCssWidth = node.size[0] * scale;

            // Check visibility
            if (nodeCssX + nodeCssWidth < cap.left || nodeCssX > cap.left + cap.size) continue;
            if (nodeCssY + (TITLE_HEIGHT * scale) < cap.top || nodeCssY > cap.top + cap.size) continue;

            // Draw
            const canvasX = (nodeCssX - cap.left) * cap.k;
            const canvasY = (nodeCssY - cap.top) * cap.k;
            // Limit width for title background
            const canvasWidth = Math.min(nodeCssWidth, nodeCssWidth) * cap.k;
            const canvasHeight = TITLE_HEIGHT * scale * cap.k;

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

                const fontSize = Math.max(12, Math.min(32, baseFontSize * scale * cap.k * scaleFactor));

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

                const padding = 10 * scale * cap.k;
                ctx.fillText(title, canvasX + padding, canvasY + (canvasHeight / 2) - (5 * scale));

                ctx.restore();
            }
        }
    }

    /**
     * Draw widget text natively on the offscreen canvas.
     * This renders text content that would otherwise be lost since widgets are DOM elements.
     * 
     * @param visibleNodes - List of nodes to check for text widgets
     * @param cap - Capture region (CSS pixels) and glass scale
     * @param scale - Canvas scale used during capture
     * @param offset - Canvas offset [x, y] used during capture
     */
    private drawWidgetTextNatively(
        visibleNodes: any[],
        cap: CaptureRegion,
        scale: number,
        offset: [number, number]
    ): void {
        if (!this.offscreenCtx) return;

        const ctx = this.offscreenCtx;
        const renderSize = this.config.glassSize;

        // LiteGraph layout constants
        const WIDGET_HEIGHT = 20;
        const WIDGET_MARGIN = 4;
        const PADDING = 15;

        for (const node of visibleNodes) {
            if (!node.widgets || !node.pos || !node.size) continue;
            if (node.flags?.collapsed) continue;

            // Calculate node position in CSS pixels
            // node.pos is in graph coordinates, transform: screenCss = (graphPos + offset) * scale
            const nodeCssX = (node.pos[0] + offset[0]) * scale;
            const nodeCssY = (node.pos[1] + offset[1]) * scale;
            const nodeCssWidth = node.size[0] * scale;
            const nodeCssHeight = node.size[1] * scale;

            // Check if node is in captured region (CSS coordinates)
            if (nodeCssX + nodeCssWidth < cap.left || nodeCssX > cap.left + cap.size) continue;
            if (nodeCssY + nodeCssHeight < cap.top || nodeCssY > cap.top + cap.size) continue;

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
                const canvasX = (widgetCssX - cap.left) * cap.k;
                const canvasY = (widgetCssY - cap.top) * cap.k;
                const widgetWidth = widgetCssWidth * cap.k;

                // Calculate font size
                // Calculate font size with accessibility scaling
                const baseFontSize = 13;
                let scaleFactor = 1.0;
                if (this.config.accessibilityEnabled) {
                    scaleFactor = this.config.fontScaleFactor / 100;
                }
                const fontSize = Math.max(10, Math.min(28 * scaleFactor, baseFontSize * scale * cap.k * scaleFactor));
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
                        const maxWidgetHeight = maxWidgetHeightCss * cap.k;

                        // Calculate widget height - Render full content for markdown up to node bounds
                        const widgetHeight = (isMarkdownWidget)
                            ? Math.min(Math.max((widget as any).computedHeight * scale * cap.k || 0, contentHeight), maxWidgetHeight)
                            : ((widget as any).computedHeight
                                ? (widget as any).computedHeight * scale * cap.k
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
