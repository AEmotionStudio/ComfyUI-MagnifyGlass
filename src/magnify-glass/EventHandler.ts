/**
 * ComfyUI MagnifyGlass - EventHandler (TypeScript)
 * 
 * Handles keyboard and mouse events for the magnifying glass.
 */

import { isUserTyping } from '../shared/utils';
import { Logger } from '../shared/logger';
import { DEFAULT_PADDING, DEFAULT_GLASS_Y_OFFSET } from '../shared/constants';
import type { MagnifyGlass } from './MagnifyGlass';

/**
 * Event Handler class.
 * Manages all keyboard and mouse event handling for the magnifier.
 */
export class EventHandler {
    magnifyGlass: MagnifyGlass;

    private rafId: number | null = null;

    constructor(magnifyGlass: MagnifyGlass) {
        this.magnifyGlass = magnifyGlass;

        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleKeyUp = this.handleKeyUp.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleResize = this.handleResize.bind(this);
    }

    /**
     * Attach all event listeners.
     */
    attachListeners(): void {
        document.addEventListener("keydown", this.handleKeyDown);
        document.addEventListener("keyup", this.handleKeyUp);
        document.addEventListener("mousemove", this.handleMouseMove);
        window.addEventListener("resize", this.handleResize);
    }

    /**
     * Detach all event listeners.
     */
    detachListeners(): void {
        document.removeEventListener("keydown", this.handleKeyDown);
        document.removeEventListener("keyup", this.handleKeyUp);
        document.removeEventListener("mousemove", this.handleMouseMove);
        window.removeEventListener("resize", this.handleResize);

        if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
        }
    }

    /**
     * Handle window resize events.
     */
    handleResize(): void {
        if (this.magnifyGlass && this.magnifyGlass.ui) {
            this.magnifyGlass.ui.updateResponsivePosition();
            // Also update panel position if it exists
            const infoPanel = (window as any).infoPanelManager;
            if (infoPanel && infoPanel.positionManager) {
                // Determine if we should move it
                infoPanel.positionManager.positionPanel();
            }
        }
    }

    /**
     * Handle keydown events.
     */
    handleKeyDown(e: KeyboardEvent): void {
        const config = this.magnifyGlass.config;
        const state = this.magnifyGlass.state;

        // Don't handle hotkeys if user is typing in an input field
        if (isUserTyping()) {
            return;
        }

        // Magnifier activation
        Logger.debug(`KeyDown: ${e.key} (config: ${config.activationKey}, active: ${state.active})`);
        if (e.key.toLowerCase() === config.activationKey &&
            (!config.altRequired || e.altKey)) {
            Logger.debug('Activation key matched!');
            if (config.alwaysActiveMode) {
                this.magnifyGlass.toggle();
            } else {
                if (!state.active) {
                    this.magnifyGlass.toggle();
                }
            }
        }

        // Manual offset adjustment keys (only when magnifier is active)
        if (state.active) {
            let offsetChanged = false;
            const stepSize = config.offsetStep;

            if (e.key === "ArrowUp") {
                config.offsetY -= stepSize;
                offsetChanged = true;
                e.preventDefault();
            } else if (e.key === "ArrowDown") {
                config.offsetY += stepSize;
                offsetChanged = true;
                e.preventDefault();
            } else if (e.key === "ArrowLeft") {
                config.offsetX -= stepSize;
                offsetChanged = true;
                e.preventDefault();
            } else if (e.key === "ArrowRight") {
                config.offsetX += stepSize;
                offsetChanged = true;
                e.preventDefault();
            } else if (e.key.toLowerCase() === config.resetKey.toLowerCase() &&
                (!config.altRequired || e.altKey)) {
                this.magnifyGlass.resetOffsets();
                offsetChanged = true;
                e.preventDefault();
            }

            // Toggle Follow Cursor Key
            if (e.key.toLowerCase() === config.toggleFollowCursorKey &&
                (!config.altRequired || e.altKey)) {
                config.followCursor = !config.followCursor;
                this.magnifyGlass.debugger.log(`Follow Cursor Toggled: ${config.followCursor ? 'ON' : 'OFF'}`);
                if (state.active && config.followCursor) {
                    this.magnifyGlass.ui.positionGlass(
                        this.magnifyGlass.lastKnownMousePosition.x,
                        this.magnifyGlass.lastKnownMousePosition.y
                    );
                }
                e.preventDefault();
            }

            // Toggle Glass Preview Key (G) - mimics the hover controls button
            if (e.key.toLowerCase() === config.toggleGlassPreviewKey &&
                (!config.altRequired || e.altKey)) {
                // Find and click the toggle-glass button in the info panel hover controls
                const toggleGlassBtn = document.querySelector('[data-action="toggle-glass"]') as HTMLElement;
                if (toggleGlassBtn) {
                    toggleGlassBtn.click();
                    this.magnifyGlass.debugger.log(`Glass Preview Toggled (via button)`);
                } else {
                    // Fallback: toggle via setGlassPreviewActive directly if button not found
                    const glassDiv = this.magnifyGlass.ui.glassDiv;
                    if (glassDiv) {
                        const isVisible = glassDiv.style.display !== 'none' && glassDiv.style.opacity !== '0';
                        this.magnifyGlass.setGlassPreviewActive(!isVisible);
                        this.magnifyGlass.debugger.log(`Glass Preview Toggled (fallback): ${!isVisible ? 'ON' : 'OFF'}`);
                    }
                }
                e.preventDefault();
            }

            if (offsetChanged) {
                config.saveOffsets();
                this.magnifyGlass.updateMagnifiedView();
            }

            // Force Direct Capture Toggle Key
            if (e.key.toLowerCase() === config.forceDirectCaptureKey &&
                (!config.altRequired || e.altKey)) {
                // Toggle via settings to sync with UI
                const currentVal = !!config.forceDirectCapture;
                // @ts-ignore
                const app = window.app || (window.scripts && window.scripts.app);
                if (app && app.ui && app.ui.settings) {
                    app.ui.settings.setSettingValue('🔍MagnifyGlass.ForceDirectCapture', !currentVal);
                    // The setting onChange handler will update config.forceDirectCapture and view
                } else {
                    // Fallback if app settings not available
                    config.forceDirectCapture = !currentVal;
                    if ((window as any).comfyUIMagnifyGlass) {
                        (window as any).comfyUIMagnifyGlass.updateMagnifiedView();
                    }
                }

                Logger.info(`Force Direct Capture toggled: ${!currentVal}`);
                e.preventDefault();
            }

            // Pop-out tab toggle (Shift+P)
            if (e.shiftKey && e.key.toLowerCase() === 'p') {
                this.magnifyGlass.popOutManager.toggle();
                e.preventDefault();
            }
        }
    }

    /**
     * Handle keyup events.
     */
    handleKeyUp(e: KeyboardEvent): void {
        const config = this.magnifyGlass.config;
        const state = this.magnifyGlass.state;

        if (!config.alwaysActiveMode &&
            (e.key.toLowerCase() === config.activationKey ||
                (config.altRequired && e.key === "Alt"))) {

            let shouldDeactivate = false;
            if (config.altRequired) {
                if (e.key === "Alt" || e.key.toLowerCase() === config.activationKey) {
                    shouldDeactivate = true;
                }
            } else {
                if (e.key.toLowerCase() === config.activationKey) {
                    shouldDeactivate = true;
                }
            }

            if (state.active && shouldDeactivate) {
                state.active = false;
                this.magnifyGlass.ui.hide();
            }
        }
    }

    /**
     * Handle mousemove events.
     */
    handleMouseMove(e: MouseEvent): void {
        // Always track mouse position
        this.magnifyGlass.lastKnownMousePosition.x = e.clientX;
        this.magnifyGlass.lastKnownMousePosition.y = e.clientY;

        if (!this.magnifyGlass.state.active || !this.magnifyGlass.litegraphCanvas) return;

        // Throttle updates using requestAnimationFrame to prevent excessive calculations and layout thrashing
        if (this.rafId === null) {
            this.rafId = requestAnimationFrame(() => {
                this.rafId = null;

                // Re-check active state in case it changed while waiting for frame
                if (!this.magnifyGlass.state.active || !this.magnifyGlass.litegraphCanvas) return;

                const clientX = this.magnifyGlass.lastKnownMousePosition.x;
                const clientY = this.magnifyGlass.lastKnownMousePosition.y;

                const rect = this.magnifyGlass.litegraphCanvas.getBoundingClientRect();
                const cssMouseXOnCanvas = clientX - rect.left;
                const cssMouseYOnCanvas = clientY - rect.top;

                // Check if the cursor is over the canvas element
                if (cssMouseXOnCanvas >= 0 && cssMouseXOnCanvas <= rect.width &&
                    cssMouseYOnCanvas >= 0 && cssMouseYOnCanvas <= rect.height) {

                    const canvasElement = this.magnifyGlass.litegraphCanvas;
                    const scaleX = rect.width > 0 ? canvasElement.width / rect.width : 1;
                    const scaleY = rect.height > 0 ? canvasElement.height / rect.height : 1;

                    const pixelX = cssMouseXOnCanvas * scaleX;
                    const pixelY = cssMouseYOnCanvas * scaleY;

                    this.magnifyGlass.state.x = pixelX;
                    this.magnifyGlass.state.y = pixelY;

                    this.magnifyGlass.ui.positionGlass(clientX, clientY);
                    this.magnifyGlass.updateMagnifiedView();
                }
            });
        }
    }

    /**
     * Update the initial position when magnifier is activated.
     */
    updateInitialPosition(): void {
        if (!this.magnifyGlass.litegraphCanvas) return;

        const rect = this.magnifyGlass.litegraphCanvas.getBoundingClientRect();
        const clientX = this.magnifyGlass.lastKnownMousePosition.x;
        const clientY = this.magnifyGlass.lastKnownMousePosition.y;

        const isOverCanvas = clientX >= rect.left && clientX <= rect.right &&
            clientY >= rect.top && clientY <= rect.bottom;

        if (this.magnifyGlass.config.alwaysActiveMode || isOverCanvas) {
            const cssMouseXOnCanvas = clientX - rect.left;
            const cssMouseYOnCanvas = clientY - rect.top;

            const canvasElement = this.magnifyGlass.litegraphCanvas;
            const scaleX = rect.width > 0 ? canvasElement.width / rect.width : 1;
            const scaleY = rect.height > 0 ? canvasElement.height / rect.height : 1;

            const pixelX = cssMouseXOnCanvas * scaleX;
            const pixelY = cssMouseYOnCanvas * scaleY;

            this.magnifyGlass.state.x = pixelX;
            this.magnifyGlass.state.y = pixelY;

            const glassSize = this.magnifyGlass.config.glassSize;

            if (!this.magnifyGlass.state.wasActivatedBefore && this.magnifyGlass.ui.glassDiv) {
                // First activation - position at top right of the window (Anchored)
                // Using style.right ensures it stays on the right even if window resizes before first usage
                this.magnifyGlass.ui.glassDiv.style.right = `${DEFAULT_PADDING}px`;
                this.magnifyGlass.ui.glassDiv.style.top = `${DEFAULT_GLASS_Y_OFFSET}px`;
                this.magnifyGlass.ui.glassDiv.style.left = 'auto'; // Ensure left is unset
                this.magnifyGlass.state.wasActivatedBefore = true;
            } else {
                this.magnifyGlass.ui.positionGlass(clientX, clientY);
            }

            this.magnifyGlass.updateMagnifiedView();
        }
    }
}
