/**
 * ComfyUI MagnifyGlass - UiManager (TypeScript)
 * 
 * Handles creation and management of DOM elements for the magnifying glass.
 */

import { Z_INDEX, DEFAULT_PADDING } from '../shared/constants';
import type { ConfigManager } from './ConfigManager';
import type { MagnifierState } from './MagnifierState';

/**
 * UI Manager class.
 * Manages all DOM elements for the magnifying glass.
 */
export class UiManager {
    config: ConfigManager;
    state: MagnifierState;
    glassDiv: HTMLDivElement | null;
    glassCanvas: HTMLCanvasElement | null;
    debugCanvas: HTMLCanvasElement | null;
    debugCtx: CanvasRenderingContext2D | null;
    htmlOverlayContainer: HTMLDivElement | null;

    constructor(config: ConfigManager, state: MagnifierState) {
        this.config = config;
        this.state = state;
        this.glassDiv = null;
        this.glassCanvas = null;
        this.debugCanvas = null;
        this.debugCtx = null;
        this.htmlOverlayContainer = null;
    }

    /**
     * Create all DOM elements for the magnifying glass.
     */
    createElements(): void {
        // Create magnifying glass container
        this.glassDiv = document.createElement("div");
        this.glassDiv.id = "comfyui-magnify-glass";
        this.glassDiv.style.cssText = `
            position: absolute;
            width: ${this.config.glassSize}px;
            height: ${this.config.glassSize}px;
            border-radius: ${this.config.glassShape === "Circle" ? "50%" : "0px"};
            border: ${this.config.borderEnabled ? `${this.config.borderWidth}px solid ${this.config.borderColor}` : 'none'};
            overflow: hidden;
            pointer-events: none;
            z-index: ${Z_INDEX.GLASS};
            display: none;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            background-color: rgba(255,255,255,0.1);
        `;

        // Create WebGL canvas for the magnifying glass
        this.glassCanvas = document.createElement("canvas");
        this.glassCanvas.width = this.config.glassSize;
        this.glassCanvas.height = this.config.glassSize;
        this.glassCanvas.id = "comfyui-magnify-canvas";
        this.glassDiv.appendChild(this.glassCanvas);

        // Create HTML overlay container
        this.htmlOverlayContainer = document.createElement("div");
        this.htmlOverlayContainer.id = "comfyui-magnify-html-overlay";
        this.htmlOverlayContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            overflow: hidden; 
        `;
        this.glassDiv.appendChild(this.htmlOverlayContainer);

        document.body.appendChild(this.glassDiv);

        // Create debug canvas if debug mode is enabled
        if (this.config.debugMode) {
            this.createDebugCanvas();
        }
    }

    /**
     * Create the debug canvas overlay.
     */
    createDebugCanvas(): void {
        this.debugCanvas = document.createElement("canvas");
        this.debugCanvas.id = "comfyui-magnify-debug";
        this.debugCanvas.width = 400;
        this.debugCanvas.height = 350;
        this.debugCanvas.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.7);
            border: 1px solid #fff;
            z-index: ${Z_INDEX.DEBUG};
            pointer-events: none;
            color: white;
            font-family: monospace;
            display: none;
        `;
        document.body.appendChild(this.debugCanvas);
        this.debugCtx = this.debugCanvas.getContext('2d');
    }

    /**
     * Show the magnifying glass.
     */
    show(): void {
        if (this.glassDiv) {
            this.glassDiv.style.display = "block";
        }
        if (this.config.debugMode && this.debugCanvas) {
            this.debugCanvas.style.display = "block";
        }
    }

    /**
     * Hide the magnifying glass.
     */
    hide(): void {
        if (this.glassDiv) {
            this.glassDiv.style.display = "none";
        }
        if (this.config.debugMode && this.debugCanvas) {
            this.debugCanvas.style.display = "none";
        }
        // Clear HTML overlays when hiding
        if (this.htmlOverlayContainer) {
            this.htmlOverlayContainer.innerHTML = '';
        }
    }

    /**
     * Position the glass relative to cursor.
     * @param clientX - Client X coordinate
     * @param clientY - Client Y coordinate
     */
    positionGlass(clientX: number, clientY: number): void {
        if (!this.config.followCursor || !this.glassDiv) return;

        const glassSize = this.config.glassSize;
        const offsetAmount = DEFAULT_PADDING;
        let newLeft: number;
        let newTop: number;

        switch (this.config.glassPosition) {
            case "Top":
                newLeft = clientX - (glassSize / 2);
                newTop = clientY - glassSize - offsetAmount;
                break;
            case "Bottom":
                newLeft = clientX - (glassSize / 2);
                newTop = clientY + offsetAmount;
                break;
            case "Left":
                newLeft = clientX - glassSize - offsetAmount;
                newTop = clientY - (glassSize / 2);
                break;
            case "Right":
                newLeft = clientX + offsetAmount;
                newTop = clientY - (glassSize / 2);
                break;
            case "Top-Left":
                newLeft = clientX - glassSize - offsetAmount;
                newTop = clientY - glassSize - offsetAmount;
                break;
            case "Top-Right":
                newLeft = clientX + offsetAmount;
                newTop = clientY - glassSize - offsetAmount;
                break;
            case "Bottom-Left":
                newLeft = clientX - glassSize - offsetAmount;
                newTop = clientY + offsetAmount;
                break;
            case "Bottom-Right":
                newLeft = clientX + offsetAmount;
                newTop = clientY + offsetAmount;
                break;
            default:
                newLeft = clientX - (glassSize / 2);
                newTop = clientY + offsetAmount;
                break;
        }

        this.glassDiv.style.left = `${newLeft}px`;
        this.glassDiv.style.top = `${newTop}px`;

        this.adjustForBoundaries(clientX, clientY);
    }

    /**
     * Adjust glass position to stay within viewport boundaries.
     * @param clientX - Client X coordinate
     * @param clientY - Client Y coordinate
     */
    adjustForBoundaries(clientX: number, clientY: number): void {
        if (!this.glassDiv) return;

        const glassRect = this.glassDiv.getBoundingClientRect();

        // Check right boundary
        if (glassRect.right > window.innerWidth) {
            this.glassDiv.style.left = `${clientX - glassRect.width - DEFAULT_PADDING}px`;
        }

        // Check left boundary
        const currentRectLeft = this.glassDiv.getBoundingClientRect();
        if (currentRectLeft.left < 0) {
            this.glassDiv.style.left = "10px";
        }

        // Check bottom boundary
        if (glassRect.bottom > window.innerHeight) {
            this.glassDiv.style.top = `${clientY - glassRect.height - DEFAULT_PADDING}px`;
        }

        // Check top boundary
        const currentRectTop = this.glassDiv.getBoundingClientRect();
        if (currentRectTop.top < 0) {
            this.glassDiv.style.top = "10px";
        }
    }

    /**
     * Apply current config to UI elements.
     */
    applyStyles(): void {
        if (this.glassDiv) {
            this.glassDiv.style.width = `${this.config.glassSize}px`;
            this.glassDiv.style.height = `${this.config.glassSize}px`;
            this.glassDiv.style.border = this.config.borderEnabled
                ? `${this.config.borderWidth}px solid ${this.config.borderColor}`
                : 'none';

            // Reset clip-path and set default border-radius
            this.glassDiv.style.clipPath = 'none';
            this.glassDiv.style.borderRadius = '0px';

            switch (this.config.glassShape) {
                case "Circle":
                    this.glassDiv.style.borderRadius = "50%";
                    break;
                case "Square":
                    // borderRadius is already '0px'
                    break;
                case "Rounded Square":
                    this.glassDiv.style.borderRadius = "20%";
                    break;
                default:
                    this.glassDiv.style.borderRadius = "50%";
                    break;
            }
        }

        if (this.glassCanvas) {
            this.glassCanvas.width = this.config.glassSize;
            this.glassCanvas.height = this.config.glassSize;
        }

        // Handle debug canvas show/hide
        if (this.config.debugMode) {
            if (!this.debugCanvas) this.createDebugCanvas();
            if (this.state.active && this.debugCanvas) this.debugCanvas.style.display = "block";
        } else {
            if (this.debugCanvas) this.debugCanvas.style.display = "none";
        }
    }

    /**
     * Cleanup DOM elements.
     */
    cleanup(): void {
        if (this.glassDiv) this.glassDiv.remove();
        if (this.debugCanvas) this.debugCanvas.remove();
    }
}
