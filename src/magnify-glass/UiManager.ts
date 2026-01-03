/**
 * ComfyUI MagnifyGlass - UiManager (TypeScript)
 * 
 * Handles creation and management of DOM elements for the magnifying glass.
 */

import { Z_INDEX, DEFAULT_PADDING, DEFAULT_GLASS_Y_OFFSET } from '../shared/constants';
import { Icons } from '../shared/icons';
import { Logger } from '../shared/logger';
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
    popOutButton: HTMLButtonElement | null;
    onToggle: (() => void) | undefined;
    onPopOut: (() => void) | undefined;

    constructor(config: ConfigManager, state: MagnifierState, onToggle?: () => void, onPopOut?: () => void) {
        this.config = config;
        this.state = state;
        this.glassDiv = null;
        this.glassCanvas = null;
        this.debugCanvas = null;
        this.debugCtx = null;
        this.htmlOverlayContainer = null;
        this.popOutButton = null;
        this.onToggle = onToggle;
        this.onPopOut = onPopOut;
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
            box-sizing: border-box;
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

        // Create pop-out button
        this.popOutButton = document.createElement("button");
        this.popOutButton.id = "comfyui-magnify-popout-btn";
        this.popOutButton.title = "Open in New Tab (Shift+P)";
        this.popOutButton.innerHTML = Icons.externalLink;
        this.popOutButton.style.cssText = `
            position: absolute;
            top: 6px;
            right: 6px;
            width: 24px;
            height: 24px;
            padding: 4px;
            border: none;
            border-radius: 4px;
            background: rgba(0, 0, 0, 0.4);
            color: rgba(255, 255, 255, 0.7);
            cursor: pointer;
            pointer-events: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s ease, background 0.2s ease, color 0.2s ease;
            z-index: 10;
        `;
        this.popOutButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this.onPopOut) {
                this.onPopOut();
            }
        });
        this.popOutButton.addEventListener('mouseenter', () => {
            if (this.popOutButton) {
                this.popOutButton.style.background = 'rgba(99, 102, 241, 0.6)';
                this.popOutButton.style.color = '#fff';
            }
        });
        this.popOutButton.addEventListener('mouseleave', () => {
            if (this.popOutButton) {
                this.popOutButton.style.background = 'rgba(0, 0, 0, 0.4)';
                this.popOutButton.style.color = 'rgba(255, 255, 255, 0.7)';
            }
        });
        this.glassDiv.appendChild(this.popOutButton);

        // Show pop-out button on glass hover
        this.glassDiv.addEventListener('mouseenter', () => {
            if (this.popOutButton) {
                this.popOutButton.style.opacity = '1';
            }
        });
        this.glassDiv.addEventListener('mouseleave', () => {
            if (this.popOutButton) {
                this.popOutButton.style.opacity = '0';
            }
        });

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
    /**
     * Position the glass relative to cursor.
     * Uses dynamic anchoring (Left/Right, Top/Bottom) based on screen quadrant.
     * @param clientX - Client X coordinate
     * @param clientY - Client Y coordinate
     */
    positionGlass(clientX: number, clientY: number): void {
        if (!this.config.followCursor || !this.glassDiv) return;

        const glassSize = this.config.glassSize;
        const offsetAmount = DEFAULT_PADDING;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Determine base coordinates (top-left based)
        let targetX: number;
        let targetY: number;

        // Calculate standard Top-Left based positions first
        switch (this.config.glassPosition) {
            case "Top":
                targetX = clientX - (glassSize / 2);
                targetY = clientY - glassSize - offsetAmount;
                break;
            case "Bottom":
                targetX = clientX - (glassSize / 2);
                targetY = clientY + offsetAmount;
                break;
            case "Left":
                targetX = clientX - glassSize - offsetAmount;
                targetY = clientY - (glassSize / 2);
                break;
            case "Right":
                targetX = clientX + offsetAmount;
                targetY = clientY - (glassSize / 2);
                break;
            case "Top-Left":
                targetX = clientX - glassSize - offsetAmount;
                targetY = clientY - glassSize - offsetAmount;
                break;
            case "Top-Right":
                targetX = clientX + offsetAmount;
                targetY = clientY - glassSize - offsetAmount;
                break;
            case "Bottom-Left":
                targetX = clientX - glassSize - offsetAmount;
                targetY = clientY + offsetAmount;
                break;
            case "Bottom-Right":
                targetX = clientX + offsetAmount;
                targetY = clientY + offsetAmount;
                break;
            default:
                targetX = clientX - (glassSize / 2);
                targetY = clientY + offsetAmount;
                break;
        }

        // Apply Dynamic Anchoring based on resulting position's center relative to screen
        const glassCenterX = targetX + (glassSize / 2);
        const glassCenterY = targetY + (glassSize / 2);

        // Horizontal Anchor
        if (glassCenterX > vw / 2) {
            // Anchor Right
            const rightPos = vw - (targetX + glassSize);
            this.glassDiv.style.right = `${rightPos}px`;
            this.glassDiv.style.left = 'auto';
        } else {
            // Anchor Left
            this.glassDiv.style.left = `${targetX}px`;
            this.glassDiv.style.right = 'auto';
        }

        // Vertical Anchor
        if (glassCenterY > vh / 2) {
            // Anchor Bottom
            const bottomPos = vh - (targetY + glassSize);
            this.glassDiv.style.bottom = `${bottomPos}px`;
            this.glassDiv.style.top = 'auto';
        } else {
            // Anchor Top
            this.glassDiv.style.top = `${targetY}px`;
            this.glassDiv.style.bottom = 'auto';
        }

        // We run a lightweight clamp to ensure it doesn't bleed offscreen during movement
        // (Though the anchor logic implicitly handles resize, dragging near edges might need clamping)
        this.adjustForBoundaries();
    }

    /**
     * Adjust glass position to stay within viewport boundaries.
     * @param clientX - Client X coordinate
     * @param clientY - Client Y coordinate
     */
    /**
     * Adjust glass position to stay within viewport boundaries.
     * Respects the current anchor (Left/Right, Top/Bottom).
     */
    adjustForBoundaries(): void {
        if (!this.glassDiv) return;

        const glassSize = this.config.glassSize;
        const padding = DEFAULT_PADDING;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Check if anchored Right or Left
        const isAnchoredRight = this.glassDiv.style.right !== 'auto' && this.glassDiv.style.right !== '';

        if (isAnchoredRight) {
            let currentRight = parseFloat(this.glassDiv.style.right) || padding;
            // Clamp Right: max(padding, min(current, vw - size - padding))
            // Ensure it doesn't go off left side (vw - size - padding)
            currentRight = Math.max(padding, Math.min(currentRight, vw - glassSize - padding));
            this.glassDiv.style.right = `${currentRight}px`;
        } else {
            // Anchor Left
            let currentLeft = parseFloat(this.glassDiv.style.left) || padding;
            currentLeft = Math.max(padding, Math.min(currentLeft, vw - glassSize - padding));
            this.glassDiv.style.left = `${currentLeft}px`;
        }

        // Check if anchored Bottom or Top
        const isAnchoredBottom = this.glassDiv.style.bottom !== 'auto' && this.glassDiv.style.bottom !== '';

        if (isAnchoredBottom) {
            let currentBottom = parseFloat(this.glassDiv.style.bottom) || padding;
            currentBottom = Math.max(padding, Math.min(currentBottom, vh - glassSize - padding));
            this.glassDiv.style.bottom = `${currentBottom}px`;
        } else {
            // Anchor Top
            let currentTop = parseFloat(this.glassDiv.style.top) || padding;
            currentTop = Math.max(padding, Math.min(currentTop, vh - glassSize - padding));
            this.glassDiv.style.top = `${currentTop}px`;
        }
    }

    /**
     * Update position safely on resize.
     * Since we use dynamic anchoring in positionGlass, CSS handles most resize cases.
     * This method ensures we verify boundaries (clamping) and fix anchors if we cross thresholds drastically.
     */
    updateResponsivePosition(): void {
        if (!this.glassDiv) return;
        // Re-run boundary adjustments to clamp if resize pushed us offscreen
        this.adjustForBoundaries();
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

                Logger.debug('Found menu anchor:', anchorBtn.title || anchorBtn.getAttribute('aria-label') || 'Unknown Button');

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

                Logger.debug('Menu toggle button injected successfully');
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
