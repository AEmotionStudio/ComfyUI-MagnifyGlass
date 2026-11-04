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

        if (this.stateManager.state.isFloating) {
            this.applyFloatPosition();
            return;
        }

        this.calculateNormalPosition();
    }

    /**
     * Keep a floating panel where it was put, 4px inside the window. It starts floating where it last followed the glass.
     */
    applyFloatPosition(): void {
        const state = this.stateManager.state;
        if (!state.floatPosition) {
            this.calculateNormalPosition();
            // Not the element's rect, which is empty while the panel is hidden
            if (this.cachedPanelPosition) {
                state.floatPosition = { x: this.cachedPanelPosition.x, y: this.cachedPanelPosition.y };
            }
            return;
        }

        const panelWidth = this.panelElement.offsetWidth || 300;
        const panelHeight = this.panelElement.offsetHeight || 400;
        const margin = 4;

        const boundedX = Math.max(margin, Math.min(state.floatPosition.x, window.innerWidth - panelWidth - margin));
        const boundedY = Math.max(margin, Math.min(state.floatPosition.y, window.innerHeight - panelHeight - margin));
        // Stored bounded, so a drag past the edge turns back at once
        state.floatPosition = { x: boundedX, y: boundedY };

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

        // left/right: beside the reference; top-*/bottom-*: above or below it, held by the named edge.
        // A side without room flips to the other, so the toolbar never covers the panel.
        const [side, edge] = String(this.stateManager.state.settings["🔍MagnifyGlass.ControlsPosition"] || "left").split('-');
        const width = controlsElement.offsetWidth;
        const height = controlsElement.offsetHeight;
        const margin = 4;

        let left: number;
        let top: number;

        if (side === 'top' || side === 'bottom') {
            const above = referenceRect.top - height - margin;
            const below = referenceRect.bottom + margin;
            top = side === 'top' ? (above >= margin ? above : below) : (below + height <= window.innerHeight - margin ? below : above);
            left = edge === 'right' ? referenceRect.right - width : referenceRect.left;
        } else {
            const before = referenceRect.left - width - margin;
            const after = referenceRect.right + margin;
            left = side === 'left' ? (before >= margin ? before : after) : (after + width <= window.innerWidth - margin ? after : before);
            top = referenceRect.top;
        }

        // Keep controls within viewport
        left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
        top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));

        controlsElement.style.left = `${left}px`;
        controlsElement.style.top = `${top}px`;

        // Show controls now that they're positioned (initially hidden off-screen)
        controlsElement.style.display = 'flex';
        controlsElement.style.visibility = 'visible';
        controlsElement.style.pointerEvents = 'auto';
    }
}
