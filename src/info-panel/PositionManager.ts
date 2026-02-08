/**
 * Position Manager class.
 * Handles all positioning logic for the info panel.
 */

import { StateManager } from './StateManager';

export class PositionManager {
    stateManager: StateManager;
    panelElement: HTMLElement;
    // Cache the calculated position to avoid getBoundingClientRect() and layout thrashing
    // This also ensures controls move in perfect sync with the panel, ignoring CSS transitions
    cachedPanelPosition: { x: number, y: number, width: number, height: number } | null = null;

    constructor(stateManager: StateManager, panelElement: HTMLElement) {
        this.stateManager = stateManager;
        this.panelElement = panelElement;
    }

    positionPanel(): void {
        if (!this.panelElement) return;

        // If panel is pinned, keep it at its pinned position
        if (this.stateManager.state.isPanelPinned) {
            this.applyPinnedPosition();
            return;
        }

        // Normal positioning logic
        this.calculateNormalPosition();
    }

    applyPinnedPosition(): void {
        if (!this.panelElement) return;

        let { x, y } = this.stateManager.state.pinnedPosition;

        // If pinnedPosition is uninitialized (0,0), use calculateNormalPosition to get a valid position
        if (x === 0 && y === 0) {
            this.calculateNormalPosition();
            // Save the calculated position as the new pinned position
            if (this.panelElement) {
                const rect = this.panelElement.getBoundingClientRect();
                this.stateManager.state.pinnedPosition = { x: rect.left, y: rect.top };
            }
            return;
        }

        const panelWidth = this.panelElement.offsetWidth || 300;
        const panelHeight = this.panelElement.offsetHeight || 400;
        const margin = 4;

        const boundedX = Math.max(margin, Math.min(x, window.innerWidth - panelWidth - margin));
        const boundedY = Math.max(margin, Math.min(y, window.innerHeight - panelHeight - margin));

        this.panelElement.style.left = `${boundedX}px`;
        this.panelElement.style.top = `${boundedY}px`;

        this.cachedPanelPosition = { x: boundedX, y: boundedY, width: panelWidth, height: panelHeight };
    }

    calculateNormalPosition(): void {
        const magnifyGlass = window.comfyUIMagnifyGlass;
        if (!magnifyGlass || !this.panelElement) return;

        const settings = this.stateManager.state.settings;
        const panelWidth = Number(settings["🔍MagnifyGlass.InfoPanelWidth"]) || 300;
        const panelHeight = this.panelElement.offsetHeight || 400;

        let left: number;
        let top: number;
        const margin = 4;

        // Check for valid glass rect first
        const glassRect = magnifyGlass.ui.glassDiv?.getBoundingClientRect();
        const hasValidGlassRect = glassRect && (glassRect.right > 0 || glassRect.top > 0);

        // Check for valid mouse position
        const mouseX = magnifyGlass.lastKnownMousePosition?.x || 0;
        const mouseY = magnifyGlass.lastKnownMousePosition?.y || 0;
        const hasValidMousePosition = mouseX > 0 || mouseY > 0;

        if (!this.stateManager.state.isGlassPreviewVisible) {
            // Glass is hidden, use mouse position
            if (hasValidMousePosition) {
                left = mouseX - (panelWidth / 2);
                top = mouseY - 20;
            } else {
                // Fallback: right side of screen
                left = window.innerWidth - panelWidth - 50;
                top = 100;
            }
        } else if (hasValidGlassRect) {
            // Position relative to glass
            const position = settings["🔍MagnifyGlass.InfoPanelPosition"];
            switch (position) {
                case "Right":
                    left = glassRect!.right + margin;
                    top = glassRect!.top;
                    break;
                case "Left":
                    left = glassRect!.left - panelWidth - margin;
                    top = glassRect!.top;
                    break;
                case "Top":
                    left = glassRect!.left;
                    top = glassRect!.top - panelHeight - margin;
                    break;
                case "Bottom":
                    left = glassRect!.left;
                    top = glassRect!.bottom + margin;
                    break;
                default:
                    left = glassRect!.right + margin;
                    top = glassRect!.top;
                    break;
            }
        } else if (hasValidMousePosition) {
            // Fall back to mouse position
            left = mouseX - (panelWidth / 2);
            top = mouseY - 20;
        } else {
            // Final fallback: right side of screen
            left = window.innerWidth - panelWidth - 50;
            top = 100;
        }

        left = Math.max(4, Math.min(left, window.innerWidth - panelWidth - 4));
        top = Math.max(4, Math.min(top, window.innerHeight - panelHeight - 4));

        this.panelElement.style.left = `${left}px`;
        this.panelElement.style.top = `${top}px`;

        this.cachedPanelPosition = { x: left, y: top, width: panelWidth, height: panelHeight };
    }

    /**
     * Position the floating controls relative to the panel.
     */
    positionFloatingControls(controlsElement: HTMLElement | null): void {
        if (!controlsElement) return;

        // Check if controls should be visible based on settings
        const settings = this.stateManager.state.settings;
        if (settings["🔍MagnifyGlass.ShowHoveringControls"] === false) {
            controlsElement.style.display = 'none';
            return;
        }

        // NEW: Check if Magnify Glass is active globally
        const magnifyGlass = window.comfyUIMagnifyGlass;
        if (magnifyGlass && !magnifyGlass.state.active) {
            controlsElement.style.display = 'none';
            return;
        }

        const isPanelVisible = this.stateManager.state.isPanelVisible;

        let referenceRect: DOMRect | null = null;

        // 1. Position relative to PANEL (Preferred if visible)
        if (isPanelVisible && this.panelElement) {
            // Priority: Use Cached Position (Logical) -> Avoids 'chasing' CSS transitions
            if (this.cachedPanelPosition) {
                // Convert simple object to Rect-like interface for compatibility
                referenceRect = {
                    left: this.cachedPanelPosition.x,
                    top: this.cachedPanelPosition.y,
                    right: this.cachedPanelPosition.x + this.cachedPanelPosition.width,
                    bottom: this.cachedPanelPosition.y + this.cachedPanelPosition.height,
                    width: this.cachedPanelPosition.width,
                    height: this.cachedPanelPosition.height
                } as DOMRect;
            } else {
                // Fallback: Read DOM (May cause layout thrashing/lag)
                referenceRect = this.panelElement.getBoundingClientRect();
            }
        }
        // 2. Position relative to GLASS (Fallback if panel hidden)
        else if (magnifyGlass && magnifyGlass.ui && magnifyGlass.ui.glassDiv) {
            referenceRect = magnifyGlass.ui.glassDiv.getBoundingClientRect();
            // Don't show controls if glass is hidden/invalid
            if (referenceRect.width === 0 || referenceRect.height === 0) {
                controlsElement.style.display = 'none';
                return;
            }
        }

        if (!referenceRect) return;

        // Enforce no transition on controls to prevent 'rubber-banding'
        controlsElement.style.transition = 'none';

        const controlsPosition = this.stateManager.state.settings["🔍MagnifyGlass.ControlsPosition"] || "right";
        const margin = 4;

        let left: number;
        let top: number;

        switch (controlsPosition) {
            case "left":
                left = referenceRect.left - controlsElement.offsetWidth - margin;
                top = referenceRect.top;
                break;
            case "right":
                left = referenceRect.right + margin;
                top = referenceRect.top;
                break;
            case "top":
                left = referenceRect.left;
                top = referenceRect.top - controlsElement.offsetHeight - margin;
                break;
            case "bottom":
                left = referenceRect.left;
                top = referenceRect.bottom + margin;
                break;
            case "top-right":
                left = referenceRect.right - controlsElement.offsetWidth;
                top = referenceRect.top - controlsElement.offsetHeight - margin;
                break;
            default:
                left = referenceRect.right + margin;
                top = referenceRect.top;
        }

        // Keep controls within viewport
        left = Math.max(10, Math.min(left, window.innerWidth - controlsElement.offsetWidth - 10));
        top = Math.max(10, Math.min(top, window.innerHeight - controlsElement.offsetHeight - 10));

        controlsElement.style.left = `${left}px`;
        controlsElement.style.top = `${top}px`;

        // Show controls now that they're positioned (initially hidden off-screen)
        controlsElement.style.display = 'flex';
        controlsElement.style.visibility = 'visible';
        controlsElement.style.pointerEvents = 'auto';
    }
}
