/**
 * ComfyUI MagnifyGlass - Main Class
 * 
 * Orchestrates all components of the magnifying glass.
 */

import { app } from "../../../../scripts/app.js";
import { findLiteGraphCanvas, rectsOverlap } from '../shared/utils.js';
import { DEFAULT_PADDING } from '../shared/constants.js';
import { ConfigManager } from './ConfigManager.js';
import { MagnifierState } from './MagnifierState.js';
import { UiManager } from './UiManager.js';
import { WebGLRenderer } from './WebGLRenderer.js';
import { DebugManager } from './DebugManager.js';
import { EventHandler } from './EventHandler.js';

/**
 * Main MagnifyGlass class.
 * Orchestrates all components and provides the main API.
 */
export class MagnifyGlass {
    constructor() {
        this.config = new ConfigManager();
        this.state = new MagnifierState();
        this.ui = new UiManager(this.config, this.state);
        this.renderer = null;
        this.debugger = new DebugManager(this.config, this.state, this.ui);
        this.eventHandler = new EventHandler(this);

        // The LiteGraph canvas
        this.litegraphCanvas = null;

        // Last known mouse position for better initial positioning
        this.lastKnownMousePosition = { x: 0, y: 0 };
    }

    /**
     * Initialize the magnifying glass.
     */
    init() {
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

        this.debugger.log(`Initialized (WebGL) with Smart Input Detection. Press ${this.config.altRequired ? 'Alt+' : ''}${this.config.activationKey.toUpperCase()} to activate.`);
    }

    /**
     * Update the magnified view.
     */
    updateMagnifiedView() {
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

                this.state.isRenderScheduled = false;
            });
        }
    }

    /**
     * Update canvas transformation state.
     */
    updateCanvasTransformation() {
        this.state.canvasScale = 1.0;
        this.state.canvasOffsetX = 0;
        this.state.canvasOffsetY = 0;

        if (app && app.canvas) {
            if (app.canvas.ds) {
                if (typeof app.canvas.ds.scale === 'number') {
                    this.state.canvasScale = app.canvas.ds.scale;
                }

                if (app.canvas.ds.offset) {
                    this.state.canvasOffsetX = app.canvas.ds.offset[0] || 0;
                    this.state.canvasOffsetY = app.canvas.ds.offset[1] || 0;
                }
            }
        }
    }

    /**
     * Calculate the source region for magnification.
     */
    calculateSourceRegion() {
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
    renderHtmlOverlays() {
        if (!this.state.active || !this.ui.htmlOverlayContainer || !app.graph || !this.litegraphCanvas) {
            if (this.ui.htmlOverlayContainer) this.ui.htmlOverlayContainer.innerHTML = '';
            return;
        }

        this.ui.htmlOverlayContainer.innerHTML = '';

        const magnifyRect = {
            x: this.state.sourceX,
            y: this.state.sourceY,
            width: this.state.sourceWidth,
            height: this.state.sourceHeight
        };

        const nodes = app.graph._nodes;
        if (!nodes) return;

        for (const node of nodes) {
            if (!node.widgets) continue;

            for (const widget of node.widgets) {
                let isTextElement = false;
                let isVideoElement = false;
                let isImageElement = false;
                let elementToProcess = null;

                if (widget.element) {
                    if (widget.type === "text" || widget.type === "string" || widget.element.tagName === 'TEXTAREA') {
                        isTextElement = true;
                        elementToProcess = widget.element;
                    } else if (widget.element.tagName === 'VIDEO') {
                        isVideoElement = true;
                        elementToProcess = widget.element;
                    } else if (widget.element.tagName === 'IMG') {
                        isImageElement = true;
                        elementToProcess = widget.element;
                    } else {
                        const potentialVideo = widget.element.querySelector('video');
                        if (potentialVideo) {
                            isVideoElement = true;
                            elementToProcess = potentialVideo;
                        } else {
                            const potentialImage = widget.element.querySelector('img');
                            if (potentialImage) {
                                isImageElement = true;
                                elementToProcess = potentialImage;
                            }
                        }
                    }
                }

                if (elementToProcess && (isTextElement || isVideoElement || isImageElement)) {
                    const widgetRect = elementToProcess.getBoundingClientRect();
                    const canvasRect = this.litegraphCanvas.getBoundingClientRect();

                    const canvasToViewportScaleX = canvasRect.width > 0 ? (this.litegraphCanvas.width / canvasRect.width) : 1;
                    const canvasToViewportScaleY = canvasRect.height > 0 ? (this.litegraphCanvas.height / canvasRect.height) : 1;

                    const widgetCanvasX = (widgetRect.left - canvasRect.left) * canvasToViewportScaleX;
                    const widgetCanvasY = (widgetRect.top - canvasRect.top) * canvasToViewportScaleY;
                    const widgetCanvasWidth = widgetRect.width * canvasToViewportScaleX;
                    const widgetCanvasHeight = widgetRect.height * canvasToViewportScaleY;

                    const widgetSourceRect = {
                        x: widgetCanvasX,
                        y: widgetCanvasY,
                        width: widgetCanvasWidth,
                        height: widgetCanvasHeight
                    };

                    if (rectsOverlap(magnifyRect, widgetSourceRect)) {
                        const clonedElement = elementToProcess.cloneNode(true);
                        clonedElement.style.position = 'absolute';
                        clonedElement.style.pointerEvents = 'none';

                        if (isTextElement) {
                            clonedElement.style.backgroundColor = elementToProcess.style.backgroundColor || '#222';
                            clonedElement.style.color = elementToProcess.style.color || '#DDD';
                            clonedElement.style.border = elementToProcess.style.border || '1px solid #555';
                            clonedElement.disabled = true;
                        } else if (isVideoElement) {
                            clonedElement.src = elementToProcess.src;
                            clonedElement.autoplay = elementToProcess.autoplay;
                            clonedElement.loop = elementToProcess.loop;
                            clonedElement.preload = elementToProcess.preload;
                            clonedElement.crossOrigin = elementToProcess.crossOrigin;
                            clonedElement.muted = true;
                            if (!elementToProcess.paused) {
                                clonedElement.play().catch(e => console.warn("Magnify Glass: Cloned video play failed", e));
                            }
                            clonedElement.currentTime = elementToProcess.currentTime;
                        } else if (isImageElement) {
                            clonedElement.src = elementToProcess.src;
                            clonedElement.alt = elementToProcess.alt;
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

                        this.ui.htmlOverlayContainer.appendChild(clonedElement);
                    }
                }
            }
        }
    }

    /**
     * Update config from current settings values.
     */
    updateConfigFromSettings() {
        this.config.loadSettings();
    }

    /**
     * Apply UI changes based on current config.
     */
    applyUiChanges() {
        this.ui.applyStyles();

        if (this.renderer && this.renderer.gl) {
            this.renderer.updateViewport();
        }
    }

    /**
     * Reset offsets and panel positions to defaults.
     */
    resetOffsets() {
        this.config.resetOffsets();

        if (this.state.active) {
            this.updateMagnifiedView();
        }

        // Reset magnify glass position to top-right corner
        if (this.ui.glassDiv) {
            const glassSize = this.config.glassSize;
            this.ui.glassDiv.style.left = `${window.innerWidth - glassSize - DEFAULT_PADDING}px`;
            this.ui.glassDiv.style.top = `${DEFAULT_PADDING}px`;
            this.state.wasActivatedBefore = false;
        }

        // Reset inspector panel position if exists
        if (window.comfyUIMagnifyGlassExtensions && window.comfyUIMagnifyGlassExtensions.length > 0) {
            window.comfyUIMagnifyGlassExtensions.forEach(extension => {
                if (extension && extension.stateManager) {
                    extension.stateManager.state.isPanelPinned = false;
                    extension.stateManager.state.isPanelLocked = false;
                    extension.stateManager.state.isAutoPinned = false;
                    extension.stateManager.state.pinnedPosition = { x: 0, y: 0 };
                    extension.stateManager.state.lastPinnedPosition = null;

                    if (extension.positionManager) {
                        extension.positionManager.positionPanel();
                    }
                    if (extension.uiManager && extension.uiManager.updateControlStates) {
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
    cleanup() {
        this.eventHandler.detachListeners();
        this.ui.cleanup();
    }
}
