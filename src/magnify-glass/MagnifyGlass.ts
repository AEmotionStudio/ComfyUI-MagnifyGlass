/**
 * ComfyUI MagnifyGlass - Main Class (TypeScript)
 * 
 * Orchestrates all components of the magnifying glass.
 */

import type { ComfyApp, ComfyNode } from '../types/comfyui';
import { findLiteGraphCanvas, rectsOverlap, Rectangle } from '../shared/utils';
import { DEFAULT_PADDING, DEFAULT_GLASS_Y_OFFSET, INFO_PANEL_ID } from '../shared/constants';
import { registerGlassSettings, registerAccessibilitySettings } from '../shared/settings';
import { ConfigManager } from './ConfigManager';
import { MagnifierState } from './MagnifierState';
import { UiManager } from './UiManager';
import { WebGLRenderer } from './WebGLRenderer';
import { DebugManager } from './DebugManager';
import { EventHandler } from './EventHandler';
import { PopOutManager } from './PopOutManager';
import { OffscreenRenderer } from './OffscreenRenderer';

// External ComfyUI globals
declare const app: ComfyApp;
declare const LiteGraph: unknown;

/**
 * Main MagnifyGlass class.
 * Orchestrates all components and provides the main API.
 */
export class MagnifyGlass {
    config: ConfigManager;
    state: MagnifierState;
    ui: UiManager;
    renderer: WebGLRenderer | null;
    debugger: DebugManager;
    eventHandler: EventHandler;
    popOutManager: PopOutManager;
    offscreenRenderer: OffscreenRenderer | null;

    /** The LiteGraph canvas */
    litegraphCanvas: HTMLCanvasElement | null;

    /** Last known mouse position for better initial positioning */
    lastKnownMousePosition: { x: number; y: number };

    /** Whether we're currently over media (for info panel) */
    isOverMedia: boolean;

    /** Current media element under cursor */
    currentMediaElement: HTMLImageElement | HTMLVideoElement | null;

    /** Animation loop ID for continuous video rendering */
    private animationLoopId: number | null;

    /** Whether videos are currently visible in magnified view */
    private hasVisibleVideos: boolean;

    constructor() {
        this.config = new ConfigManager();
        this.state = new MagnifierState();
        this.popOutManager = new PopOutManager();
        this.ui = new UiManager(
            this.config,
            this.state,
            () => this.toggle()
        );

        // onStateChange is handled by InfoPanel


        this.renderer = null;
        this.offscreenRenderer = null;
        this.debugger = new DebugManager(this.config, this.state, this.ui);
        this.eventHandler = new EventHandler(this);

        // The LiteGraph canvas
        this.litegraphCanvas = null;

        // Last known mouse position for better initial positioning
        this.lastKnownMousePosition = { x: 0, y: 0 };

        // Media tracking
        this.isOverMedia = false;
        this.currentMediaElement = null;

        // Animation loop for video rendering
        this.animationLoopId = null;
        this.hasVisibleVideos = false;
    }

    /**
     * Initialize the magnifying glass.
     */
    init(): void {
        if (typeof LiteGraph === 'undefined' || typeof app === 'undefined' || !app.canvas) {
            this.debugger.log("LiteGraph or app not ready, retrying in 100ms.");
            setTimeout(() => this.init(), 100);
            return;
        }
        this.debugger.log("LiteGraph and app ready.");



        // Load saved offsets first
        this.config.loadSavedOffsets();

        // Print detailed canvas information


        // Create UI elements
        this.ui.createElements();

        // Ensure glass is validly positioned (within viewport) right away
        // This handles cases where config has saved positions from a different monitor size
        this.ui.updateResponsivePosition();

        // Setup WebGL renderer
        this.renderer = new WebGLRenderer(this.config, this.state, this.ui);
        if (!this.renderer.isValid()) {
            this.ui.cleanup();
            return;
        }

        // Find the LiteGraph canvas
        this.litegraphCanvas = findLiteGraphCanvas();
        this.debugger.log("LiteGraph canvas found:", this.litegraphCanvas);
        if (!this.litegraphCanvas) {
            this.debugger.error("Could not find LiteGraph canvas. Magnifier will not work.");
            this.ui.cleanup();
            return;
        }

        // Initialize offscreen renderer for high-res magnification
        this.offscreenRenderer = new OffscreenRenderer(this.config, this.state);

        // Attach event handlers
        this.eventHandler.attachListeners();

        // Register settings with ComfyUI
        registerGlassSettings(this);
        registerAccessibilitySettings(this);

        this.debugger.log(`Initialized (WebGL) with Smart Input Detection. Press ${this.config.altRequired ? 'Alt+' : ''}${this.config.activationKey.toUpperCase()} to activate.`);
    }

    /**
     * Toggle the magnifying glass active state.
     */
    toggle(): void {
        const state = this.state;

        if (state.active) {
            // TURNING OFF - Force hide everything
            this.forceHideAllComponents();
        } else {
            // TURNING ON
            state.active = true;
            this.ui.show();
            if (this.eventHandler) {
                this.eventHandler.updateInitialPosition();
            }
            // Start continuous animation loop for smooth video playback
            this.startAnimationLoop();
        }
    }

    /**
     * Force hide all components including extensions (Info Panel, etc).
     * This overcomes the "pinned" state of the info panel when the main tool is deactivated.
     */
    private forceHideAllComponents(): void {
        this.state.active = false;
        this.stopAnimationLoop();
        this.hasVisibleVideos = false;
        this.ui.hide();

        // 1. Nuclear option: Direct DOM ID targeting
        // This is necessary because in some cases object references might be stale or logic might prevent hiding
        const panelEl = document.getElementById(INFO_PANEL_ID);
        if (panelEl) {
            panelEl.style.display = 'none';
            // Also force opacity 0 just in case transition handles display
            panelEl.style.opacity = '0';
        }

        // Iterate through all registered extensions and hide them if they have a hide method
        const extensions = window.comfyUIMagnifyGlassExtensions;
        if (extensions && extensions.length > 0) {
            extensions.forEach((extension: any) => {
                // Check basically any likely property for a UI manager or direct hide method
                if (extension && extension.uiManager && typeof extension.uiManager.hide === 'function') {
                    extension.uiManager.hide();
                    // Explicitly force display none if available to be extra sure
                    if (extension.uiManager.elements && extension.uiManager.elements.panel) {
                        extension.uiManager.elements.panel.style.display = 'none';
                    }
                }
            });
        }
    }

    /**
     * Set glass preview visibility WITHOUT affecting info panel.
     * This is used by the toggle-glass hover control button.
     * When hidden, the renderer stops completely to save performance.
     * When shown, the renderer resumes.
     * 
     * @param visible - true to show and enable rendering, false to hide and disable
     */
    setGlassPreviewActive(visible: boolean): void {
        // Track this state internally
        this.state.isPreviewHidden = !visible;

        if (visible) {
            // Show the glass preview
            this.ui.setPreviewVisibility(true);
            // Resume rendering on next mouse move
        } else {
            // Hide the glass preview visually
            this.ui.setPreviewVisibility(false);
            // The rendering will be skipped in updateMagnifiedView due to isPreviewHidden check
        }
    }

    /**
     * Check if the glass preview is visible.
     * Returns false if hidden via hover controls.
     */
    private isGlassPreviewVisible(): boolean {
        // Check info panel extension state for isGlassPreviewVisible
        const extensions = (window as any).comfyUIMagnifyGlassExtensions;
        if (extensions && extensions.length > 0) {
            const infoPanel = extensions[0];
            if (infoPanel?.stateManager?.state) {
                return infoPanel.stateManager.state.isGlassPreviewVisible !== false;
            }
        }
        // Default to visible if we can't find the state
        return true;
    }

    /**
     * Update the magnified view.
     */
    updateMagnifiedView(): void {
        if (!this.state.active || !this.renderer || !this.litegraphCanvas) {
            return;
        }

        // Skip rendering if glass preview is hidden via hover controls
        // This prevents double FPS when only the info panel is active
        if (this.state.isPreviewHidden) {
            return;
        }

        // Get canvas transformation info
        this.updateCanvasTransformation();

        // Calculate the source region
        this.calculateSourceRegion();

        // Schedule the rendering operation
        if (!this.state.isRenderScheduled) {
            this.state.isRenderScheduled = true;
            requestAnimationFrame(() => {
                if (!this.state.active || !this.renderer || !this.litegraphCanvas) {
                    this.state.isRenderScheduled = false;
                    return;
                }

                // Try virtual zoom capture for high-res magnification
                // This temporarily sets LiteGraph to 100% zoom, captures clean pixels,
                // then restores the original zoom level
                let sourceCanvas: HTMLCanvasElement = this.litegraphCanvas;
                if (this.offscreenRenderer && this.offscreenRenderer.isAvailable()) {
                    const highResCanvas = this.offscreenRenderer.renderHighResRegion(this.litegraphCanvas);
                    if (highResCanvas) {
                        sourceCanvas = highResCanvas;
                    }
                }

                // Render the magnified view
                this.renderer.render(sourceCanvas);

                // Update debug visualization


                // Render HTML overlays for text, video, and image widgets
                this.renderHtmlOverlays();

                // Send frame to pop-out tab if open
                if (this.popOutManager.isPopOutOpen() && this.ui.glassCanvas) {
                    this.popOutManager.sendFrame(this.ui.glassCanvas);
                }

                this.state.isRenderScheduled = false;
            });
        }
    }

    /**
     * Update canvas transformation state.
     */
    updateCanvasTransformation(): void {
        this.state.canvasScale = 1.0;
        this.state.canvasOffsetX = 0;
        this.state.canvasOffsetY = 0;

        if (app?.canvas) {
            const ds = (app.canvas as any).ds;
            if (ds) {
                if (typeof ds.scale === 'number') {
                    this.state.canvasScale = ds.scale;
                }

                if (ds.offset) {
                    this.state.canvasOffsetX = ds.offset[0] || 0;
                    this.state.canvasOffsetY = ds.offset[1] || 0;
                }
            }
        }
    }

    /**
     * Calculate the source region for magnification.
     */
    calculateSourceRegion(): void {
        const cursorPixelX = this.state.x;
        const cursorPixelY = this.state.y;
        const canvasScale = this.state.canvasScale;
        const canvasOffsetX = this.state.canvasOffsetX;
        const canvasOffsetY = this.state.canvasOffsetY;

        if (canvasScale === 0) return;
        if (!this.litegraphCanvas) return;

        // Get DPR (Device Pixel Ratio) - relationship between Backing Store pixels and CSS pixels
        const rect = this.litegraphCanvas.getBoundingClientRect();
        const dpr = rect.width > 0 ? this.litegraphCanvas.width / rect.width : 1;

        // Convert cursor Backing pixels to CSS pixels (Screen pixels)
        // state.x/y are in Backing Pixels (set in EventHandler)
        const cursorCssX = cursorPixelX / dpr;
        const cursorCssY = cursorPixelY / dpr;

        // Convert cursor CSS pixels to LiteGraph graph coordinates
        // ds.offset and ds.scale operate in CSS pixel space
        const cursorGraphX = (cursorCssX - canvasOffsetX) / canvasScale;
        const cursorGraphY = (cursorCssY - canvasOffsetY) / canvasScale;

        // Apply manual offset (in Graph Units - arbitrary units)
        const targetGraphCenterX = cursorGraphX + this.config.offsetX;
        const targetGraphCenterY = cursorGraphY + this.config.offsetY;

        // Calculate source dimensions in graph units
        const sourceGraphWidth = (this.config.glassSize / this.config.zoomFactor) / canvasScale;
        const sourceGraphHeight = (this.config.glassSize / this.config.zoomFactor) / canvasScale;

        // Calculate source top-left corner in Graph Coordinates
        const sourceGraphX = targetGraphCenterX - (sourceGraphWidth / 2);
        const sourceGraphY = targetGraphCenterY - (sourceGraphHeight / 2);

        // Convert back to Canvas Backing Pixels for the source rectangle
        // 1. Convert Graph -> CSS: (Graph * Scale) + Offset
        // 2. Convert CSS -> Backing: CSS * DPR
        const sourceCssX = (sourceGraphX * canvasScale) + canvasOffsetX;
        const sourceCssY = (sourceGraphY * canvasScale) + canvasOffsetY;
        const sourceCssWidth = sourceGraphWidth * canvasScale;
        const sourceCssHeight = sourceGraphHeight * canvasScale;

        this.state.sourceX = sourceCssX * dpr;
        this.state.sourceY = sourceCssY * dpr;
        this.state.sourceWidth = sourceCssWidth * dpr;
        this.state.sourceHeight = sourceCssHeight * dpr;
    }

    /**
     * Render HTML overlays for text and media in the magnified view.
     */
    renderHtmlOverlays(): void {
        const graph = (app as any).graph;
        if (!this.state.active || !this.ui.htmlOverlayContainer || !graph || !this.litegraphCanvas) {
            if (this.ui.htmlOverlayContainer) this.ui.htmlOverlayContainer.innerHTML = '';
            return;
        }

        // Removed early clear to batch reads before writes
        // this.ui.htmlOverlayContainer.innerHTML = '';

        // Track if any videos are found for animation loop management
        let foundVideos = false;

        const magnifyRect: Rectangle = {
            x: this.state.sourceX,
            y: this.state.sourceY,
            width: this.state.sourceWidth,
            height: this.state.sourceHeight
        };

        const nodes: ComfyNode[] = graph._nodes;
        if (!nodes) {
             // Ensure any previous overlays are cleared if we exit early
             this.ui.htmlOverlayContainer.innerHTML = '';
             return;
        }

        // Calculate source region in graph coordinates for culling
        // This mirrors calculateSourceRegion() but stops at graph coords
        if (this.state.canvasScale === 0) {
            // Ensure any previous overlays are cleared if we exit early
            this.ui.htmlOverlayContainer.innerHTML = '';
            return;
        }

        const rect = this.litegraphCanvas.getBoundingClientRect();
        const dpr = rect.width > 0 ? this.litegraphCanvas.width / rect.width : 1;

        // Pre-calculate invariant values for the frame
        const currentScale = this.state.canvasScale;
        const isVirtualZoomMode = currentScale < 0.7;
        const canvasRect = rect;
        // Pivot point (mouse position) in CSS coordinates
        const pivotCssX = this.state.x / dpr;
        const pivotCssY = this.state.y / dpr;

        const cursorCssX = pivotCssX;
        const cursorCssY = pivotCssY;
        const cursorGraphX = (cursorCssX - this.state.canvasOffsetX) / this.state.canvasScale;
        const cursorGraphY = (cursorCssY - this.state.canvasOffsetY) / this.state.canvasScale;
        const targetGraphCenterX = cursorGraphX + this.config.offsetX;
        const targetGraphCenterY = cursorGraphY + this.config.offsetY;
        const sourceGraphWidth = (this.config.glassSize / this.config.zoomFactor) / this.state.canvasScale;
        const sourceGraphHeight = (this.config.glassSize / this.config.zoomFactor) / this.state.canvasScale;

        const sourceGraphRect = {
            x: targetGraphCenterX - (sourceGraphWidth / 2),
            y: targetGraphCenterY - (sourceGraphHeight / 2),
            width: sourceGraphWidth,
            height: sourceGraphHeight
        };

        // Batch optimization: Collect all render tasks first (Read Phase)
        interface RenderTask {
            element: HTMLElement;
            type: 'text' | 'video' | 'image';
            // Store the calculated overlay geometry so we don't recalculate in loop 2
            overlayRect: Rectangle;
            fontSize?: number;
        }
        const renderTasks: RenderTask[] = [];

        for (const node of nodes) {
            // Optimization: Cull nodes that are not in the source region
            if (node.pos && node.size) {
                const nodeRect = {
                    x: node.pos[0],
                    y: node.pos[1],
                    width: node.size[0],
                    height: node.size[1]
                };
                if (!rectsOverlap(sourceGraphRect, nodeRect)) {
                    continue;
                }
            }

            const widgets = (node as any).widgets;
            if (!widgets) continue;

            for (const widget of widgets) {
                let isTextElement = false;
                let isVideoElement = false;
                let isImageElement = false;
                let elementToProcess: HTMLElement | null = null;

                // Check for VHS-style widgets with videoEl property (VideoHelperSuite pattern)
                const widgetName = String(widget.name || '').toLowerCase();
                if (widgetName === 'videopreview' || widgetName === 'audiopreview') {
                    const videoEl = widget.videoEl as HTMLVideoElement | undefined;
                    if (videoEl && !videoEl.hidden && videoEl.videoWidth > 0) {
                        isVideoElement = true;
                        foundVideos = true;
                        elementToProcess = videoEl;
                    }
                }

                // Check for standard DOM element widgets (existing logic)
                if (!elementToProcess && widget.element) {
                    const element = widget.element as HTMLElement;
                    // Skip text elements - now rendered natively on canvas via OffscreenRenderer
                    if (widget.type === "text" || widget.type === "string" || element.tagName === 'TEXTAREA') {
                        // isTextElement = true; // DISABLED - using native canvas rendering
                        // elementToProcess = element;
                    } else if (element.tagName === 'VIDEO') {
                        isVideoElement = true;
                        foundVideos = true;
                        elementToProcess = element;
                    } else if (element.tagName === 'IMG') {
                        isImageElement = true;
                        elementToProcess = element;
                    } else {
                        const potentialVideo = element.querySelector('video');
                        if (potentialVideo) {
                            isVideoElement = true;
                            foundVideos = true;
                            elementToProcess = potentialVideo;
                        } else {
                            const potentialImage = element.querySelector('img');
                            if (potentialImage) {
                                isImageElement = true;
                                elementToProcess = potentialImage;
                            }
                        }
                    }
                }

                if (elementToProcess && (isTextElement || isVideoElement || isImageElement)) {
                    // READ: Force layout calculation here, batched together
                    const widgetRect = elementToProcess.getBoundingClientRect();

                    // Widget position in CSS coordinates relative to canvas
                    const widgetCssX = widgetRect.left - canvasRect.left;
                    const widgetCssY = widgetRect.top - canvasRect.top;
                    const widgetCssWidth = widgetRect.width;
                    const widgetCssHeight = widgetRect.height;

                    let finalWidgetCssX: number;
                    let finalWidgetCssY: number;
                    let finalWidgetCssWidth: number;
                    let finalWidgetCssHeight: number;

                    if (isVirtualZoomMode) {
                        // Virtual Zoom: Transform widget position to match virtual 1.0 scale capture
                        finalWidgetCssX = (widgetCssX - pivotCssX) / currentScale + pivotCssX;
                        finalWidgetCssY = (widgetCssY - pivotCssY) / currentScale + pivotCssY;
                        finalWidgetCssWidth = widgetCssWidth / currentScale;
                        finalWidgetCssHeight = widgetCssHeight / currentScale;
                    } else {
                        // Direct Capture: Use actual positions
                        finalWidgetCssX = widgetCssX;
                        finalWidgetCssY = widgetCssY;
                        finalWidgetCssWidth = widgetCssWidth;
                        finalWidgetCssHeight = widgetCssHeight;
                    }

                    // Convert to backing pixels for comparison with magnifyRect
                    const widgetCanvasX = finalWidgetCssX * dpr;
                    const widgetCanvasY = finalWidgetCssY * dpr;
                    const widgetCanvasWidth = finalWidgetCssWidth * dpr;
                    const widgetCanvasHeight = finalWidgetCssHeight * dpr;

                    const widgetSourceRect: Rectangle = {
                        x: widgetCanvasX,
                        y: widgetCanvasY,
                        width: widgetCanvasWidth,
                        height: widgetCanvasHeight
                    };

                    // Only process further if it actually overlaps
                    if (rectsOverlap(magnifyRect, widgetSourceRect)) {
                        const task: RenderTask = {
                            element: elementToProcess,
                            type: isTextElement ? 'text' : (isVideoElement ? 'video' : 'image'),
                            overlayRect: widgetSourceRect, // Store calculated rect
                            fontSize: undefined
                        };

                        // READ: Get computed style for text elements (only if overlapping)
                        if (isTextElement) {
                            task.fontSize = parseFloat(window.getComputedStyle(elementToProcess).fontSize);
                        }

                        if (isVideoElement) {
                            foundVideos = true;
                        }

                        renderTasks.push(task);
                    }
                }
            }
        }

        // WRITE Phase: Clear container and append new elements
        this.ui.htmlOverlayContainer.innerHTML = '';
        const fragment = document.createDocumentFragment();

        // Process collected tasks
        for (const task of renderTasks) {
            const elementToProcess = task.element;
            const widgetSourceRect = task.overlayRect; // Use stored calculated rect
            const isTextElement = task.type === 'text';
            const isVideoElement = task.type === 'video';
            const isImageElement = task.type === 'image';

            const clonedElement = elementToProcess.cloneNode(true) as HTMLElement;
            clonedElement.style.position = 'absolute';
            clonedElement.style.pointerEvents = 'none';

            if (isTextElement) {
                clonedElement.style.backgroundColor = elementToProcess.style.backgroundColor || '#222';
                clonedElement.style.color = elementToProcess.style.color || '#DDD';
                clonedElement.style.border = elementToProcess.style.border || '1px solid #555';
                // Hide scrollbar while keeping content visible
                clonedElement.style.overflow = 'hidden';
                (clonedElement as HTMLInputElement).disabled = true;

                // Dual adaptive font sizing:
                // - When zoomed OUT (below 50%): shrink text to fit all content
                // - When zoomed IN (above 50%): grow text for better readability
                const canvasScale = this.state.canvasScale;
                // READ: Use stored font size
                const originalFontSize = task.fontSize || 12; // Fallback
                const threshold = 0.5; // 50% zoom threshold

                let adaptedFontSize: number;
                if (canvasScale < threshold) {
                    // Zoomed out: shrink text aggressively to fit content
                    // Scale from threshold down to minimum
                    const shrinkFactor = canvasScale / threshold;
                    adaptedFontSize = Math.max(6, originalFontSize * shrinkFactor * 0.8);
                } else {
                    // Zoomed in: grow text for readability
                    // Scale from 100% at threshold up to 150% at 100%+ zoom
                    const growFactor = 1 + ((canvasScale - threshold) / (1 - threshold)) * 0.5;
                    adaptedFontSize = originalFontSize * Math.min(1.5, growFactor);
                }

                clonedElement.style.fontSize = `${adaptedFontSize}px`;
                clonedElement.style.lineHeight = canvasScale < threshold ? '1.2' : '1.4';
            } else if (isVideoElement) {
                const video = clonedElement as HTMLVideoElement;
                const originalVideo = elementToProcess as HTMLVideoElement;
                video.src = originalVideo.src;
                video.autoplay = originalVideo.autoplay;
                video.loop = originalVideo.loop;
                video.preload = originalVideo.preload;
                video.crossOrigin = originalVideo.crossOrigin;
                video.muted = true;
                if (!originalVideo.paused) {
                    video.play().catch(e => {
                        if (e.name !== 'AbortError') {
                            console.warn("Magnify Glass: Cloned video play failed", e);
                        }
                    });
                }
                video.currentTime = originalVideo.currentTime;
            } else if (isImageElement) {
                const img = clonedElement as HTMLImageElement;
                const originalImg = elementToProcess as HTMLImageElement;
                img.src = originalImg.src;
                img.alt = originalImg.alt;
            }

            const relativeX = widgetSourceRect.x - magnifyRect.x;
            const relativeY = widgetSourceRect.y - magnifyRect.y;
            const magnifiedX = relativeX * this.config.zoomFactor;
            const magnifiedY = relativeY * this.config.zoomFactor;

            clonedElement.style.left = `${magnifiedX}px`;
            clonedElement.style.top = `${magnifiedY}px`;
            clonedElement.style.width = `${widgetSourceRect.width}px`;
            clonedElement.style.height = `${widgetSourceRect.height}px`;
            clonedElement.style.transformOrigin = 'top left';
            clonedElement.style.transform = `scale(${this.config.zoomFactor})`;

            fragment.appendChild(clonedElement);
        }

        this.ui.htmlOverlayContainer.appendChild(fragment);

        // Manage animation loop based on video presence
        if (foundVideos && !this.hasVisibleVideos) {
            this.hasVisibleVideos = true;
            this.startAnimationLoop();
        } else if (!foundVideos && this.hasVisibleVideos) {
            this.hasVisibleVideos = false;
            // Loop will stop itself on next iteration
        }
    }

    /**
     * Start the animation loop for continuous video rendering.
     * Only runs when videos are visible in the magnified view.
     * This loop directly renders without going through updateMagnifiedView's
     * scheduling logic to ensure continuous frame updates for video playback.
     */
    private startAnimationLoop(): void {
        if (this.animationLoopId !== null) return; // Already running

        const animate = () => {
            // Stop if glass is deactivated or renderer unavailable
            if (!this.state.active || !this.renderer || !this.litegraphCanvas) {
                this.stopAnimationLoop();
                return;
            }

            // Skip if glass preview is hidden
            if (this.state.isPreviewHidden) {
                this.animationLoopId = requestAnimationFrame(animate);
                return;
            }

            // Update canvas transformation and source region
            this.updateCanvasTransformation();
            this.calculateSourceRegion();

            // Direct render (bypass isRenderScheduled to ensure continuous updates)
            let sourceCanvas: HTMLCanvasElement = this.litegraphCanvas;
            if (this.offscreenRenderer && this.offscreenRenderer.isAvailable()) {
                const highResCanvas = this.offscreenRenderer.renderHighResRegion(this.litegraphCanvas);
                if (highResCanvas) {
                    sourceCanvas = highResCanvas;
                }
            }

            // Render the magnified view
            this.renderer.render(sourceCanvas);

            // Render HTML overlays for video widgets
            this.renderHtmlOverlays();

            // Send frame to pop-out tab if open
            if (this.popOutManager.isPopOutOpen() && this.ui.glassCanvas) {
                this.popOutManager.sendFrame(this.ui.glassCanvas);
            }

            this.animationLoopId = requestAnimationFrame(animate);
        };

        this.animationLoopId = requestAnimationFrame(animate);
    }

    /**
     * Stop the animation loop.
     */
    private stopAnimationLoop(): void {
        if (this.animationLoopId !== null) {
            cancelAnimationFrame(this.animationLoopId);
            this.animationLoopId = null;
        }
    }

    /**
     * Update config from current settings values.
     */
    updateConfigFromSettings(): void {
        this.config.loadSettings();
    }

    /**
     * Apply UI changes based on current config.
     */
    applyUiChanges(): void {
        this.ui.applyStyles();

        if (this.renderer?.gl) {
            this.renderer.updateViewport();
        }
    }



    /**
     * Reset offsets and panel positions to defaults.
     */
    resetOffsets(): void {
        this.config.resetOffsets();

        // Also disable follow cursor
        this.config.followCursor = false;

        if (this.state.active) {
            this.updateMagnifiedView();
        }

        // Reset magnify glass position to top-right corner
        if (this.ui.glassDiv) {
            // If it's the first activation, position at top right of the window (Anchored)
            // Otherwise, reset to the last known position or default if not active.
            if (!this.state.wasActivatedBefore) {
                const padding = DEFAULT_PADDING;
                // Using style.right ensures it stays on the right even if window resizes before first usage
                this.ui.glassDiv.style.right = `${padding}px`;
                this.ui.glassDiv.style.top = `${DEFAULT_GLASS_Y_OFFSET}px`;
                this.ui.glassDiv.style.left = 'auto'; // Ensure left is unset
                this.state.wasActivatedBefore = true;
            } else {
                // If it was already activated, and we are resetting, we might want to keep its current position
                // or explicitly reset it to the initial anchored position.
                // For now, let's re-apply the anchored position on reset if it was already activated.
                const padding = DEFAULT_PADDING;
                this.ui.glassDiv.style.right = `${padding}px`;
                this.ui.glassDiv.style.top = `${DEFAULT_GLASS_Y_OFFSET}px`;
                this.ui.glassDiv.style.left = 'auto';
            }
        }

        // Reset inspector panel position if exists
        const extensions = window.comfyUIMagnifyGlassExtensions;
        if (extensions && extensions.length > 0) {
            extensions.forEach((extension: any) => {
                if (extension?.stateManager) {
                    extension.stateManager.state.isPanelPinned = false;
                    extension.stateManager.state.isPanelLocked = false;
                    extension.stateManager.state.isAutoPinned = false;
                    extension.stateManager.state.pinnedPosition = { x: 0, y: 0 };
                    extension.stateManager.state.lastPinnedPosition = null;

                    if (extension.positionManager) {
                        extension.positionManager.positionPanel();
                    }
                    if (extension.uiManager?.updateControlStates) {
                        extension.uiManager.updateControlStates();
                    }
                }
            });
        }

        this.debugger.log("Reset: Magnify glass and inspector panel positions restored to defaults");
    }

    /**
     * Cleanup all resources.
     */
    cleanup(): void {
        this.stopAnimationLoop();
        this.eventHandler.detachListeners();
        this.popOutManager.cleanup();
        this.ui.cleanup();
    }

}
