/**
 * ComfyUI MagnifyGlass - UiManager (TypeScript)
 * 
 * Handles creation and management of DOM elements for the magnifying glass.
 */

import { Z_INDEX, DEFAULT_PADDING } from '../shared/constants';
import { Icons } from '../shared/icons';
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
    onToggle: (() => void) | undefined;

    constructor(config: ConfigManager, state: MagnifierState, onToggle?: () => void) {
        this.config = config;
        this.state = state;
        this.glassDiv = null;
        this.glassCanvas = null;
        this.debugCanvas = null;
        this.debugCtx = null;
        this.htmlOverlayContainer = null;
        this.onToggle = onToggle;
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

        // Inject menu button
        this.injectMenuButton();
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
            this.glassDiv.style.display = 'block';
            // We do NOT modify opacity here, allowing it to be controlled independently
        }
        if (this.config.debugMode && this.debugCanvas) {
            this.debugCanvas.style.display = "block";
        }
    }

    /**
     * Set the visual visibility of the glass preview (opacity).
     * This allows the tool to remain "Active" (tracking mouse) but invisible,
     * so that the Inspector Panel can be used in "Inspector Only" mode.
     */
    setPreviewVisibility(visible: boolean): void {
        if (this.glassDiv) {
            this.glassDiv.style.opacity = visible ? '1' : '0';
            // Disable pointer events when hidden to be safe, though usually they are none anyway
            // this.glassDiv.style.pointerEvents = visible ? 'none' : 'none'; 
        }
    }

    /**
     * Hide the magnifying glass.
     */
    hide(): void {
        if (this.glassDiv) {
            this.glassDiv.style.display = 'none';
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
        // Remove menu button if needed (though hard to track references here without saving it)
        const btn = document.querySelector('.magnify-toggle-btn');
        if (btn) btn.remove();
    }

    /**
     * Inject a quick toggle button into the ComfyUI menu.
     */
    /**
     * Inject a quick toggle button into the ComfyUI menu.
     */
    injectMenuButton(): void {
        // Stop after 30 seconds
        const stopTime = Date.now() + 30000;

        // Define check function
        const attemptInjection = () => {
            const buttons = Array.from(document.querySelectorAll('button'));

            // Try to find an anchor button (Minimap or Links)
            // Priority 1: Minimap
            let anchorBtn = buttons.find(b => {
                const title = (b.title || '').toLowerCase();
                const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                const text = (b.textContent || '').toLowerCase();
                return (title.includes('map') && !title.includes('open')) ||
                    (aria.includes('map') && !aria.includes('open')) ||
                    (text.includes('map'));
            });

            // Priority 2: Link Visibility
            if (!anchorBtn) {
                anchorBtn = buttons.find(b => {
                    const title = (b.title || '').toLowerCase();
                    const aria = (b.getAttribute('aria-label') || '').toLowerCase();
                    return title.includes('link') || aria.includes('link');
                });
            }

            if (anchorBtn && anchorBtn.parentElement) {
                // Determine success BEFORE creating elements to allow early return if duplicate
                if (anchorBtn.parentElement.querySelector('.magnify-toggle-btn')) return true;

                console.log("[MagnifyGlass] Found menu anchor:", anchorBtn.title || anchorBtn.getAttribute('aria-label') || "Unknown Button");

                const btn = document.createElement('button');
                // Copy all classes to match theme/library (e.g. p-button, comfy-btn, etc)
                btn.className = anchorBtn.className + ' magnify-toggle-btn';

                // Copy key styles that might define shape/size
                const computed = window.getComputedStyle(anchorBtn);
                btn.style.height = computed.height;
                btn.style.minHeight = computed.minHeight;
                // btn.style.width = computed.width; // Don't copy width, let it adapt

                btn.title = "Toggle Magnify Glass";
                btn.innerHTML = Icons.magnifyGlass;

                // Ensure specific display props
                btn.style.display = "inline-flex";
                btn.style.alignItems = "center";
                btn.style.justifyContent = "center";
                btn.style.padding = "0 8px";
                btn.style.cursor = "pointer";
                btn.style.border = anchorBtn.style.border || computed.border;
                btn.style.borderRadius = anchorBtn.style.borderRadius || computed.borderRadius;
                // Use cssText if available for background/color specific overrides
                if (!btn.style.background) btn.style.background = computed.background;
                if (!btn.style.color) btn.style.color = computed.color;

                // Add active state tracking
                btn.addEventListener('click', () => {
                    if (this.onToggle) {
                        this.onToggle();
                        // Try to apply common active classes found in modern UI frameworks
                        btn.classList.toggle('active');
                        btn.classList.toggle('p-highlight'); // PrimeVue
                        btn.classList.toggle('selected');
                    }
                });

                // Insert logic:
                const isMinimap = (anchorBtn.title || '').toLowerCase().includes('map') ||
                    (anchorBtn.getAttribute('aria-label') || '').toLowerCase().includes('map');

                if (isMinimap) {
                    // Insert AFTER Minimap
                    if (anchorBtn.nextSibling) {
                        anchorBtn.parentElement.insertBefore(btn, anchorBtn.nextSibling);
                    } else {
                        anchorBtn.parentElement.appendChild(btn);
                    }
                } else {
                    // It's likely links, Insert BEFORE
                    anchorBtn.parentElement.insertBefore(btn, anchorBtn);
                }

                console.log("[MagnifyGlass] Menu toggle button injected successfully");
                return true;
            }
            return false;
        };

        // Run immediately first
        if (attemptInjection()) return;

        // Then poll rapidly
        const checkForMenu = setInterval(() => {
            if (Date.now() > stopTime) {
                console.warn("[MagnifyGlass] Menu injection timed out. Found buttons:",
                    Array.from(document.querySelectorAll('button')).map(b => b.title || b.getAttribute('aria-label') || b.textContent || b.className).slice(0, 5));
                clearInterval(checkForMenu);
                return;
            }

            if (attemptInjection()) {
                clearInterval(checkForMenu);
            }
        }, 100);
    }
}
