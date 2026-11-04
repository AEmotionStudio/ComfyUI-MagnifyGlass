/**
 * ComfyUI MagnifyGlass - Main Class (TypeScript)
 * 
 * Orchestrates all components of the magnifying glass.
 */

import type { ComfyApp } from '../types/comfyui';
import { findLiteGraphCanvas } from '../shared/utils';
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
import { captureRegion } from './mediaLayout';

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

    /** Render loop ID; the loop runs while the glass is active and visible */
    private animationLoopId: number | null;

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

        this.animationLoopId = null;
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
     * When hidden, the render loop stops completely to save performance.
     * When shown, the render loop resumes.
     * 
     * @param visible - true to show and enable rendering, false to hide and disable
     */
    setGlassPreviewActive(visible: boolean): void {
        this.state.isPreviewHidden = !visible;
        this.ui.setPreviewVisibility(visible);
        if (visible && this.state.active) {
            this.startAnimationLoop();
        }
    }

    /**
     * Update the magnified view. Rendering happens in the animation loop,
     * so this only makes sure the loop is running.
     */
    updateMagnifiedView(): void {
        if (this.state.active) {
            this.startAnimationLoop();
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
     * Calculate the source region (in canvas backing pixels) for magnification.
     */
    calculateSourceRegion(): void {
        if (!this.litegraphCanvas) return;

        const rect = this.litegraphCanvas.getBoundingClientRect();
        const dpr = rect.width > 0 ? this.litegraphCanvas.width / rect.width : 1;
        const cap = captureRegion(this.state.x / dpr, this.state.y / dpr, this.config.glassSize, this.config.zoomFactor);

        this.state.sourceX = cap.left * dpr;
        this.state.sourceY = cap.top * dpr;
        this.state.sourceWidth = cap.size * dpr;
        this.state.sourceHeight = cap.size * dpr;
    }

    /**
     * Render one frame of the glass and forward it to the pop-out.
     */
    private renderFrame(renderer: WebGLRenderer, canvas: HTMLCanvasElement): void {
        this.updateCanvasTransformation();
        this.calculateSourceRegion();

        renderer.render(this.offscreenRenderer?.renderHighResRegion(canvas) ?? canvas);

        if (this.popOutManager.isPopOutOpen() && this.ui.glassCanvas) {
            this.popOutManager.sendFrame(this.ui.glassCanvas);
        }
    }

    /**
     * Start the render loop. It is the only render path and keeps running without
     * mouse movement, so latent previews and videos update in the glass.
     */
    private startAnimationLoop(): void {
        if (this.animationLoopId !== null) return; // Already running

        const animate = () => {
            if (!this.state.active || this.state.isPreviewHidden || !this.renderer || !this.litegraphCanvas) {
                this.animationLoopId = null;
                return;
            }
            this.renderFrame(this.renderer, this.litegraphCanvas);
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
