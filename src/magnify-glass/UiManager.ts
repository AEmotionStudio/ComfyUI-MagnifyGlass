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

            // Add drag handlers
            const onMouseDown = (e: MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();

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

                const onMouseMove = (moveEvent: MouseEvent) => {
                    moveEvent.preventDefault();
                    moveEvent.stopPropagation();

                    // 1:1 Movement: Glass moves exactly with mouse
                    // New Pos = Mouse Pos + Initial Grab Offset
                    const newLeft = moveEvent.clientX + grabOffsetX;
                    const newTop = moveEvent.clientY + grabOffsetY;

                    if (this.glassDiv) {
                        this.glassDiv.style.left = `${newLeft}px`;
                        this.glassDiv.style.top = `${newTop}px`;
                    }

                    // We do NOT update config.offsetX/Y here to prevent double-movement wrapping.
                    // The offset relative to the cursor remains constant during a drag.
                };

                const onMouseUp = (upEvent: MouseEvent) => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);

                    // On release, we update the config offset so positionGlass() picks up where we left off
                    if (this.config.followCursor) {
                        // positionGlass logic: Target = Mouse (approx) + Offset.
                        // CurrentGlass = Mouse + GrabOffset.
                        // So implicitly, config.offsetX should arguably effectively capture this GrabOffset relative to the 'Standard' position?

                        // Actually, sticking with the current offset works best for 1:1 dragging.
                        // If we want to support "Dragging to change Offset", we would need to calculate:
                        // config.offsetX = CurrentGlassLeft - (StandardTargetLeft based on glassPosition)

                        // But simply maintaining the position is safer for now.
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

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            };

            this.glassDiv.addEventListener('mousedown', onMouseDown);
            (this.glassDiv as any)._dragHandler = onMouseDown;
        } else {
            this.glassDiv.style.cursor = '';
            this.glassDiv.style.pointerEvents = 'none';
            this.glassDiv.classList.remove('drag-mode');

            // Remove drag handler
            if ((this.glassDiv as any)._dragHandler) {
                this.glassDiv.removeEventListener('mousedown', (this.glassDiv as any)._dragHandler);
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
                // Copy border radius if available, but avoid copying colors/backgrounds to allow theme switching
                if (anchorBtn.style.borderRadius) {
                    btn.style.borderRadius = anchorBtn.style.borderRadius;
                } else {
                    // Fallback to computed only for structural properties, not colors
                    btn.style.borderRadius = computed.borderRadius;
                }

                // Do NOT copy background/color/border from computed styles as they freeze the theme
                // Rely on className to handle theme styling

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
