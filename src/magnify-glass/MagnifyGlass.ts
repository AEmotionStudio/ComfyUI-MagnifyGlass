/**
 * ComfyUI MagnifyGlass - Main Class (TypeScript)
 * 
 * Orchestrates all components of the magnifying glass.
 */

import type { ComfyApp, ComfyNode } from '../types/comfyui';
import { findLiteGraphCanvas, rectsOverlap, Rectangle } from '../shared/utils';
import { DEFAULT_PADDING, DEFAULT_GLASS_Y_OFFSET } from '../shared/constants';
import { registerGlassSettings } from '../shared/settings';
import { ConfigManager } from './ConfigManager';
import { MagnifierState } from './MagnifierState';
import { UiManager } from './UiManager';
import { WebGLRenderer } from './WebGLRenderer';
import { DebugManager } from './DebugManager';
import { EventHandler } from './EventHandler';
import { PopOutManager } from './PopOutManager';

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

    /** The LiteGraph canvas */
    litegraphCanvas: HTMLCanvasElement | null;

    /** Last known mouse position for better initial positioning */
    lastKnownMousePosition: { x: number; y: number };

    /** Whether we're currently over media (for info panel) */
    isOverMedia: boolean;

    /** Current media element under cursor */
    currentMediaElement: HTMLImageElement | HTMLVideoElement | null;

    constructor() {
        this.config = new ConfigManager();
        this.state = new MagnifierState();
        this.popOutManager = new PopOutManager();
        this.ui = new UiManager(
            this.config,
            this.state,
            () => this.toggle()
        );
        this.renderer = null;
        this.debugger = new DebugManager(this.config, this.state, this.ui);
        this.eventHandler = new EventHandler(this);

        // The LiteGraph canvas
        this.litegraphCanvas = null;

        // Last known mouse position for better initial positioning
        this.lastKnownMousePosition = { x: 0, y: 0 };

        // Media tracking
        this.isOverMedia = false;
        this.currentMediaElement = null;
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
        this.debugger.printCanvasInfo();

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

        // Attach event handlers
        this.eventHandler.attachListeners();

        // Register settings with ComfyUI
        registerGlassSettings(this);

        this.debugger.log(`Initialized (WebGL) with Smart Input Detection. Press ${this.config.altRequired ? 'Alt+' : ''}${this.config.activationKey.toUpperCase()} to activate.`);
    }

    /**
     * Toggle the magnifying glass active state.
     */
    toggle(): void {
        const state = this.state;
        const config = this.config;

        if (state.active) {
            state.active = false;
            this.ui.hide();
        } else {
            state.active = true;
            this.ui.show();
            // Update initial position if needed
            if (this.eventHandler) {
                this.eventHandler.updateInitialPosition();
            }
        }
    }

    /**
     * Update the magnified view.
     */
    updateMagnifiedView(): void {
        if (!this.state.active || !this.renderer || !this.litegraphCanvas) {
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
                // Render the magnified view
                this.renderer.render(this.litegraphCanvas);

                // Update debug visualization
                this.debugger.updateDebugView();

                // Render HTML overlays
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

        // Convert cursor canvas pixels to LiteGraph graph coordinates
        const cursorGraphX = (cursorPixelX - canvasOffsetX) / canvasScale;
        const cursorGraphY = (cursorPixelY - canvasOffsetY) / canvasScale;

        // Apply manual offset
        const targetGraphCenterX = cursorGraphX + this.config.offsetX;
        const targetGraphCenterY = cursorGraphY + this.config.offsetY;

        // Calculate source dimensions in graph units
        const sourceGraphWidth = (this.config.glassSize / this.config.zoomFactor) / canvasScale;
        const sourceGraphHeight = (this.config.glassSize / this.config.zoomFactor) / canvasScale;

        // Calculate source top-left corner in graph coordinates
        const sourceGraphX = targetGraphCenterX - (sourceGraphWidth / 2);
        const sourceGraphY = targetGraphCenterY - (sourceGraphHeight / 2);

        // Convert back to canvas pixel coordinates
        this.state.sourceX = (sourceGraphX * canvasScale) + canvasOffsetX;
        this.state.sourceY = (sourceGraphY * canvasScale) + canvasOffsetY;
        this.state.sourceWidth = sourceGraphWidth * canvasScale;
        this.state.sourceHeight = sourceGraphHeight * canvasScale;
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

        this.ui.htmlOverlayContainer.innerHTML = '';

        const magnifyRect: Rectangle = {
            x: this.state.sourceX,
            y: this.state.sourceY,
            width: this.state.sourceWidth,
            height: this.state.sourceHeight
        };

        const nodes: ComfyNode[] = graph._nodes;
        if (!nodes) return;

        for (const node of nodes) {
            const widgets = (node as any).widgets;
            if (!widgets) continue;

            for (const widget of widgets) {
                let isTextElement = false;
                let isVideoElement = false;
                let isImageElement = false;
                let elementToProcess: HTMLElement | null = null;

                if (widget.element) {
                    const element = widget.element as HTMLElement;
                    if (widget.type === "text" || widget.type === "string" || element.tagName === 'TEXTAREA') {
                        isTextElement = true;
                        elementToProcess = element;
                    } else if (element.tagName === 'VIDEO') {
                        isVideoElement = true;
                        elementToProcess = element;
                    } else if (element.tagName === 'IMG') {
                        isImageElement = true;
                        elementToProcess = element;
                    } else {
                        const potentialVideo = element.querySelector('video');
                        if (potentialVideo) {
                            isVideoElement = true;
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
                    const widgetRect = elementToProcess.getBoundingClientRect();
                    const canvasRect = this.litegraphCanvas!.getBoundingClientRect();

                    const canvasToViewportScaleX = canvasRect.width > 0 ? (this.litegraphCanvas!.width / canvasRect.width) : 1;
                    const canvasToViewportScaleY = canvasRect.height > 0 ? (this.litegraphCanvas!.height / canvasRect.height) : 1;

                    const widgetCanvasX = (widgetRect.left - canvasRect.left) * canvasToViewportScaleX;
                    const widgetCanvasY = (widgetRect.top - canvasRect.top) * canvasToViewportScaleY;
                    const widgetCanvasWidth = widgetRect.width * canvasToViewportScaleX;
                    const widgetCanvasHeight = widgetRect.height * canvasToViewportScaleY;

                    const widgetSourceRect: Rectangle = {
                        x: widgetCanvasX,
                        y: widgetCanvasY,
                        width: widgetCanvasWidth,
                        height: widgetCanvasHeight
                    };

                    if (rectsOverlap(magnifyRect, widgetSourceRect)) {
                        const clonedElement = elementToProcess.cloneNode(true) as HTMLElement;
                        clonedElement.style.position = 'absolute';
                        clonedElement.style.pointerEvents = 'none';

                        if (isTextElement) {
                            clonedElement.style.backgroundColor = elementToProcess.style.backgroundColor || '#222';
                            clonedElement.style.color = elementToProcess.style.color || '#DDD';
                            clonedElement.style.border = elementToProcess.style.border || '1px solid #555';
                            (clonedElement as HTMLInputElement).disabled = true;
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
                                video.play().catch(e => console.warn("Magnify Glass: Cloned video play failed", e));
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

                        if (isTextElement && clonedElement.style.fontSize) {
                            const originalFontSize = parseFloat(window.getComputedStyle(elementToProcess).fontSize);
                            clonedElement.style.fontSize = `${originalFontSize}px`;
                        }

                        this.ui.htmlOverlayContainer!.appendChild(clonedElement);
                    }
                }
            }
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
        this.eventHandler.detachListeners();
        this.popOutManager.cleanup();
        this.ui.cleanup();
    }
}
