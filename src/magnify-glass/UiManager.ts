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
    htmlOverlayContainer: HTMLDivElement | null;
    onToggle: (() => void) | undefined;

    constructor(config: ConfigManager, state: MagnifierState, onToggle?: () => void) {
        this.config = config;
        this.state = state;
        this.glassDiv = null;
        this.glassCanvas = null;
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

        document.body.appendChild(this.glassDiv);

        // Inject menu button
        this.injectMenuButton();
    }

    /**
     * Show the magnifying glass.
     */
    show(): void {
        if (this.glassDiv) {
            this.glassDiv.style.display = 'block';
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
        }
    }

    /**
     * Enable or disable glass drag mode.
     * When enabled, the glass can be dragged to a new position.
     */
    setDragMode(enabled: boolean): void {
        if (!this.glassDiv) return;

        if (enabled) {
            // Use 'all-scroll' which shows a 4-way arrow consistently across browsers
            // Firefox shows 'move' as a grab/fist cursor which is confusing
            this.glassDiv.style.cursor = 'all-scroll';
            this.glassDiv.style.pointerEvents = 'auto';
            this.glassDiv.classList.add('drag-mode');

            // Add drag handlers using pointer events + pointer capture for reliable tracking
            const onPointerDown = (e: PointerEvent) => {
                e.preventDefault();
                e.stopPropagation();

                // Capture pointer to this element — ensures all move/up events
                // are delivered here even if the pointer leaves the glass element
                this.glassDiv!.setPointerCapture(e.pointerId);

                // Calculate the fixed offset between mouse and glass top-left
                // This maintains the "grab point" relative to the glass
                const rect = this.glassDiv!.getBoundingClientRect();
                const grabOffsetX = rect.left - e.clientX;
                const grabOffsetY = rect.top - e.clientY;

                // First, set left/top to current position to prevent jump
                this.glassDiv!.style.left = `${rect.left}px`;
                this.glassDiv!.style.top = `${rect.top}px`;

                // Then clear opposite positioning props (now safe since left/top are set)
                this.glassDiv!.style.right = 'auto';
                this.glassDiv!.style.bottom = 'auto';
                this.glassDiv!.style.transform = 'none'; // Clear any centering transforms if they exist

                // Set body cursor so it persists even when dragging outside the glass div
                this.glassDiv!.style.cursor = 'grabbing';
                document.body.style.cursor = 'grabbing';
                document.body.style.userSelect = 'none';

                const onPointerMove = (moveEvent: PointerEvent) => {
                    moveEvent.preventDefault();

                    // 1:1 Movement: Glass moves exactly with mouse
                    // New Pos = Mouse Pos + Initial Grab Offset
                    const newLeft = moveEvent.clientX + grabOffsetX;
                    const newTop = moveEvent.clientY + grabOffsetY;

                    if (this.glassDiv) {
                        this.glassDiv.style.left = `${newLeft}px`;
                        this.glassDiv.style.top = `${newTop}px`;
                    }
                };

                const finishDrag = () => {
                    this.glassDiv!.removeEventListener('pointermove', onPointerMove);
                    this.glassDiv!.removeEventListener('pointerup', onPointerUp);
                    this.glassDiv!.removeEventListener('pointercancel', onPointerUp);
                    this.glassDiv!.removeEventListener('lostpointercapture', onPointerUp);

                    // Reset body cursor and user-select
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';

                    // Also reset the ComfyUI canvas cursor directly
                    const canvas = document.querySelector('canvas.graph-canvas-container, #graph-canvas') as HTMLElement;
                    if (canvas) {
                        canvas.style.cursor = '';
                    }

                    // Disable drag mode after drop
                    this.state.isDragModeEnabled = false;
                    this.setDragMode(false);

                    // Update control states via info panel
                    const infoPanel = (window as any).infoPanelManager;
                    if (infoPanel?.uiManager) {
                        infoPanel.uiManager.updateControlStates();
                    }
                };

                const onPointerUp = (upEvent: PointerEvent) => {
                    finishDrag();
                };

                this.glassDiv!.addEventListener('pointermove', onPointerMove);
                this.glassDiv!.addEventListener('pointerup', onPointerUp);
                this.glassDiv!.addEventListener('pointercancel', onPointerUp);
                this.glassDiv!.addEventListener('lostpointercapture', onPointerUp);
            };

            this.glassDiv.addEventListener('pointerdown', onPointerDown);
            (this.glassDiv as any)._dragHandler = onPointerDown;
        } else {
            this.glassDiv.style.cursor = '';
            this.glassDiv.style.pointerEvents = 'none';
            this.glassDiv.classList.remove('drag-mode');

            // Safety: ensure body cursor/userSelect are reset in case pointerup was missed
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            // Remove drag handler
            if ((this.glassDiv as any)._dragHandler) {
                this.glassDiv.removeEventListener('pointerdown', (this.glassDiv as any)._dragHandler);
                delete (this.glassDiv as any)._dragHandler;
            }
        }
    }

    /**
     * Hide the magnifying glass.
     */
    hide(): void {
        if (this.glassDiv) {
            this.glassDiv.style.display = 'none';
        }
        // Clear HTML overlays when hiding
        if (this.htmlOverlayContainer) {
            this.htmlOverlayContainer.innerHTML = '';
        }
    }

    /**
     * Position the glass relative to cursor.
     * Uses dynamic anchoring (Left/Right, Top/Bottom) based on screen quadrant.
     * @param clientX - Client X coordinate
     * @param clientY - Client Y coordinate
     */
    positionGlass(clientX: number, clientY: number): void {
        // Skip positioning if drag mode is active (handled manually in setDragMode)
        if (!this.config.followCursor || !this.glassDiv || this.state.isDragModeEnabled) return;

        const glassSize = this.config.glassSize;
        const offsetAmount = DEFAULT_PADDING;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Determine base coordinates (top-left based)
        // Add manual offsets (from drag operations)
        let targetX: number = this.config.offsetX || 0;
        let targetY: number = this.config.offsetY || 0;

        // Calculate standard Top-Left based positions first
        switch (this.config.glassPosition) {
            case "Top":
                targetX += clientX - (glassSize / 2);
                targetY += clientY - glassSize - offsetAmount;
                break;
            case "Bottom":
                targetX += clientX - (glassSize / 2);
                targetY += clientY + offsetAmount;
                break;
            case "Left":
                targetX += clientX - glassSize - offsetAmount;
                targetY += clientY - (glassSize / 2);
                break;
            case "Right":
                targetX += clientX + offsetAmount;
                targetY += clientY - (glassSize / 2);
                break;
            case "Top-Left":
                targetX += clientX - glassSize - offsetAmount;
                targetY += clientY - glassSize - offsetAmount;
                break;
            case "Top-Right":
                targetX += clientX + offsetAmount;
                targetY += clientY - glassSize - offsetAmount;
                break;
            case "Bottom-Left":
                targetX += clientX - glassSize - offsetAmount;
                targetY += clientY + offsetAmount;
                break;
            case "Bottom-Right":
                targetX += clientX + offsetAmount;
                targetY += clientY + offsetAmount;
                break;
            default:
                targetX += clientX - (glassSize / 2);
                targetY += clientY + offsetAmount;
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

            // Reduce Motion
            if (this.config.reduceMotion) {
                this.glassDiv.style.transition = 'none !important';
                this.glassDiv.style.animation = 'none !important';
                // Also set property directly just in case !important doesn't stick in inline style without special handling
                this.glassDiv.style.setProperty('transition', 'none', 'important');
                this.glassDiv.style.setProperty('animation', 'none', 'important');
            } else {
                this.glassDiv.style.transition = '';
                this.glassDiv.style.animation = '';
                this.glassDiv.style.removeProperty('transition');
                this.glassDiv.style.removeProperty('animation');
            }
        }

        if (this.glassCanvas) {
            this.glassCanvas.width = this.config.glassSize;
            this.glassCanvas.height = this.config.glassSize;
        }
    }

    /**
     * Cleanup DOM elements.
     */
    cleanup(): void {
        if (this.glassDiv) this.glassDiv.remove();
        // Remove menu button if needed (though hard to track references here without saving it)
        const btn = document.querySelector('.magnify-toggle-btn');
        if (btn) btn.remove();
    }

    /**
     * Inject a quick toggle button into the ComfyUI menu.
     * Uses a MutationObserver to persist the button across Vue re-renders
     * (e.g., when the properties panel is opened/closed).
     */
    injectMenuButton(): void {
        // Track the current active state across re-injections
        let isActiveState = false;

        // Store observer reference for cleanup
        let observer: MutationObserver | null = null;

        // Define injection function
        const attemptInjection = (): boolean => {
            // Use data-testid selectors to find the specific buttons in the bottom toolbar
            // These are the official ComfyUI frontend identifiers
            const minimapBtn = document.querySelector('button[data-testid="toggle-minimap-button"]') as HTMLButtonElement;
            const linkVisibilityBtn = document.querySelector('button[data-testid="toggle-link-visibility-button"]') as HTMLButtonElement;

            // We need at least the minimap button to inject after it
            if (!minimapBtn || !minimapBtn.parentElement) {
                return false;
            }

            // Check if already injected in the current parent
            if (minimapBtn.parentElement.querySelector('.magnify-toggle-btn')) {
                return true;
            }

            Logger.debug('Found minimap button in bottom toolbar, injecting magnify glass toggle');

            const btn = document.createElement('button');
            // Copy all classes from minimap button to match theme/library
            btn.className = minimapBtn.className + ' magnify-toggle-btn';

            // Copy key styles that might define shape/size
            const computed = window.getComputedStyle(minimapBtn);
            btn.style.height = computed.height;
            btn.style.minHeight = computed.minHeight;
            btn.style.width = computed.width; // Match width for consistency

            btn.title = "Toggle Magnify Glass (X)";
            btn.setAttribute('aria-label', "Toggle Magnify Glass");
            btn.setAttribute('aria-pressed', String(isActiveState));
            btn.setAttribute('data-testid', 'toggle-magnify-glass-button');
            btn.innerHTML = Icons.magnifyGlass;

            // Ensure specific display props
            btn.style.display = "inline-flex";
            btn.style.alignItems = "center";
            btn.style.justifyContent = "center";
            btn.style.padding = "0";
            btn.style.cursor = "pointer";

            // Copy border radius if available
            if (minimapBtn.style.borderRadius) {
                btn.style.borderRadius = minimapBtn.style.borderRadius;
            } else {
                btn.style.borderRadius = computed.borderRadius;
            }

            // Apply active state if previously active
            if (isActiveState) {
                btn.classList.add('active');
                btn.classList.add('p-highlight');
                btn.classList.add('selected');
            }

            // Add active state tracking
            btn.addEventListener('click', () => {
                if (this.onToggle) {
                    this.onToggle();
                    // Toggle active states to match ComfyUI's button styling
                    isActiveState = btn.classList.toggle('active');
                    btn.classList.toggle('p-highlight'); // PrimeVue
                    btn.classList.toggle('selected');
                    btn.setAttribute('aria-pressed', String(isActiveState));
                }
            });

            // Insert AFTER the minimap button (between minimap and link visibility)
            if (linkVisibilityBtn && minimapBtn.parentElement === linkVisibilityBtn.parentElement) {
                // Insert before link visibility button (which puts it after minimap)
                minimapBtn.parentElement.insertBefore(btn, linkVisibilityBtn);
            } else if (minimapBtn.nextSibling) {
                // Fallback: insert after minimap button
                minimapBtn.parentElement.insertBefore(btn, minimapBtn.nextSibling);
            } else {
                minimapBtn.parentElement.appendChild(btn);
            }

            Logger.debug('Menu toggle button injected successfully between minimap and link visibility');
            return true;
        };

        // Setup MutationObserver to re-inject button when the bottom bar is re-rendered
        // This handles cases like opening/closing the properties panel which causes Vue re-renders
        const setupObserver = () => {
            if (observer) {
                observer.disconnect();
            }

            observer = new MutationObserver((mutations) => {
                // Check if our button was removed or if the toolbar changed
                const existingBtn = document.querySelector('.magnify-toggle-btn');
                const minimapBtn = document.querySelector('button[data-testid="toggle-minimap-button"]');

                if (minimapBtn && !existingBtn) {
                    // Our button was removed, re-inject it
                    Logger.debug('MutationObserver detected button removal, re-injecting...');
                    attemptInjection();
                }
            });

            // Observe the document body for changes in the subtree
            // This is necessary because Vue may recreate entire sections of the DOM
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        };

        // Initial injection attempt with polling fallback
        const stopTime = Date.now() + 30000;

        const checkForMenu = setInterval(() => {
            if (Date.now() > stopTime) {
                console.warn("[MagnifyGlass] Menu injection timed out. Could not find toggle-minimap-button");
                clearInterval(checkForMenu);
                // Still setup observer in case the toolbar appears later
                setupObserver();
                return;
            }

            if (attemptInjection()) {
                clearInterval(checkForMenu);
                // Setup the observer to handle future re-renders
                setupObserver();
            }
        }, 100);

        // Also try immediately
        if (attemptInjection()) {
            clearInterval(checkForMenu);
            setupObserver();
        }
    }
}
