/**
 * Position Manager class.
 * Handles all positioning logic for the info panel.
 */

import { StateManager } from './StateManager';

export class PositionManager {
    stateManager: StateManager;
    panelElement: HTMLElement;

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
        const panelWidth = this.panelElement.offsetWidth;
        const panelHeight = this.panelElement.offsetHeight;
        const margin = 10;

        const boundedX = Math.max(margin, Math.min(x, window.innerWidth - panelWidth - margin));
        const boundedY = Math.max(margin, Math.min(y, window.innerHeight - panelHeight - margin));

        this.panelElement.style.left = `${boundedX}px`;
        this.panelElement.style.top = `${boundedY}px`;
    }

    calculateNormalPosition(): void {
        const magnifyGlass = window.comfyUIMagnifyGlass;
        if (!magnifyGlass || !this.panelElement) return;

        const settings = this.stateManager.state.settings;
        const panelWidth = settings["🔍MagnifyGlass.InfoPanelWidth"];
        const panelHeight = this.panelElement.offsetHeight; // Use actual height

        let left: number;
        let top: number;
        const margin = 15;

        if (!this.stateManager.state.isGlassPreviewVisible) {
            left = magnifyGlass.lastKnownMousePosition.x - (panelWidth / 2);
            top = magnifyGlass.lastKnownMousePosition.y - 20;
        } else {
            const glassRect = magnifyGlass.ui.glassDiv?.getBoundingClientRect();
            if (glassRect) {
                const position = settings["🔍MagnifyGlass.InfoPanelPosition"];
                switch (position) {
                    case "Right":
                        left = glassRect.right + margin;
                        top = glassRect.top;
                        break;
                    case "Left":
                        left = glassRect.left - panelWidth - margin;
                        top = glassRect.top;
                        break;
                    case "Top":
                        left = glassRect.left;
                        top = glassRect.top - panelHeight - margin;
                        break;
                    case "Bottom":
                        left = glassRect.left;
                        top = glassRect.bottom + margin;
                        break;
                    default:
                        left = glassRect.right + margin;
                        top = glassRect.top;
                        break;
                }
            } else {
                left = magnifyGlass.lastKnownMousePosition.x - (panelWidth / 2);
                top = magnifyGlass.lastKnownMousePosition.y - 20;
            }
        }

        left = Math.max(10, Math.min(left, window.innerWidth - panelWidth - 10));
        top = Math.max(10, Math.min(top, window.innerHeight - panelHeight - 10));

        this.panelElement.style.left = `${left}px`;
        this.panelElement.style.top = `${top}px`;
    }

    /**
     * Position the floating controls relative to the panel.
     */
    positionFloatingControls(controlsElement: HTMLElement | null): void {
        if (!controlsElement || !this.panelElement) return;

        const panelRect = this.panelElement.getBoundingClientRect();
        const controlsPosition = this.stateManager.state.settings["🔍MagnifyGlass.ControlsPosition"] || "right";
        const margin = 8;

        let left: number;
        let top: number;

        switch (controlsPosition) {
            case "left":
                left = panelRect.left - controlsElement.offsetWidth - margin;
                top = panelRect.top;
                break;
            case "right":
                left = panelRect.right + margin;
                top = panelRect.top;
                break;
            case "top":
                left = panelRect.left;
                top = panelRect.top - controlsElement.offsetHeight - margin;
                break;
            case "bottom":
                left = panelRect.left;
                top = panelRect.bottom + margin;
                break;
            case "top-right":
                left = panelRect.right - controlsElement.offsetWidth;
                top = panelRect.top - controlsElement.offsetHeight - margin;
                break;
            default:
                left = panelRect.right + margin;
                top = panelRect.top;
        }

        // Keep controls within viewport
        left = Math.max(10, Math.min(left, window.innerWidth - controlsElement.offsetWidth - 10));
        top = Math.max(10, Math.min(top, window.innerHeight - controlsElement.offsetHeight - 10));

        controlsElement.style.left = `${left}px`;
        controlsElement.style.top = `${top}px`;
    }
}
