/**
 * ComfyUI MagnifyGlass - Info Panel Position Manager
 * 
 * Complete Position Manager extracted from magnify_info_panel.js
 * Handles all positioning logic including pinning and boundary checking.
 */

/**
 * Position Manager class.
 * Handles all positioning logic for the info panel.
 */
export class PositionManager {
    /**
     * @param {import('./StateManager.js').StateManager} stateManager 
     * @param {import('./UIManager.js').UIManager} uiManager
     */
    constructor(stateManager, uiManager) {
        this.stateManager = stateManager;
        this.uiManager = uiManager;
    }

    positionPanel() {
        if (!this.uiManager.elements.panel) return;

        // If panel is pinned, keep it at its pinned position
        if (this.stateManager.state.isPanelPinned) {
            this.applyPinnedPosition();
            this.positionFloatingControls();
            return;
        }

        // Normal positioning logic
        this.calculateNormalPosition();
        this.positionFloatingControls();
    }

    positionFloatingControls() {
        if (!this.uiManager.elements.controls) return;

        const panelRect = this.uiManager.elements.panel.getBoundingClientRect();
        const controlsPosition = this.stateManager.state.settings["🔍MagnifyGlass.ControlsPosition"] || "top-right";

        let idealX, idealY;
        // Determine dimensions based on layout. Fallback values are estimates.
        const isHorizontal = ['top', 'bottom'].includes(controlsPosition);
        const controlsWidth = this.uiManager.elements.controls.offsetWidth || (isHorizontal ? 160 : 40);
        const controlsHeight = this.uiManager.elements.controls.offsetHeight || (isHorizontal ? 40 : 160);
        const margin = 5;

        // Determine the ideal, unconstrained position for the controls
        switch (controlsPosition) {
            case "top-left":
                idealX = panelRect.left - controlsWidth - margin;
                idealY = panelRect.top;
                break;
            case "top-right":
                idealX = panelRect.right + margin;
                idealY = panelRect.top;
                break;
            case "bottom-left":
                idealX = panelRect.left - controlsWidth - margin;
                idealY = panelRect.bottom - controlsHeight;
                break;
            case "bottom-right":
                idealX = panelRect.right + margin;
                idealY = panelRect.bottom - controlsHeight;
                break;
            case "top":
                idealX = panelRect.left + (panelRect.width - controlsWidth) / 2;
                idealY = panelRect.top - controlsHeight - margin;
                break;
            case "bottom":
                idealX = panelRect.left + (panelRect.width - controlsWidth) / 2;
                idealY = panelRect.bottom + margin;
                break;
            case "left":
                idealX = panelRect.left - controlsWidth - margin;
                idealY = panelRect.top + (panelRect.height - controlsHeight) / 2;
                break;
            case "right":
                idealX = panelRect.right + margin;
                idealY = panelRect.top + (panelRect.height - controlsHeight) / 2;
                break;
            default: // Fallback to top-right
                idealX = panelRect.right + margin;
                idealY = panelRect.top;
                break;
        }

        let finalX = idealX;
        let finalY = idealY;

        // For side-positioned controls, check if they are forced to move horizontally.
        // If so, override their vertical alignment to be "top" instead of "center".
        if (['left', 'right'].includes(controlsPosition)) {
            if (idealX < margin || (idealX + controlsWidth) > (window.innerWidth - margin)) {
                finalY = panelRect.top; // Switch to top alignment

                // Also, place it slightly inside the panel to ensure it's visible.
                if (controlsPosition === 'left') {
                    finalX = margin;
                } else { // 'right'
                    finalX = window.innerWidth - controlsWidth - margin;
                }
            }
        }

        // Apply boundary constraints to the final calculated position
        finalX = Math.max(margin, Math.min(finalX, window.innerWidth - controlsWidth - margin));
        finalY = Math.max(margin, Math.min(finalY, window.innerHeight - controlsHeight - margin));

        this.uiManager.elements.controls.style.left = `${finalX}px`;
        this.uiManager.elements.controls.style.top = `${finalY}px`;

        // Update layout class based on the setting
        this.uiManager.updateControlsLayout(controlsPosition);
    }

    applyPinnedPosition() {
        let { x, y } = this.stateManager.state.pinnedPosition;
        const panel = this.uiManager.elements.panel;
        const panelWidth = panel.offsetWidth;
        const panelHeight = panel.offsetHeight;
        const margin = 10;

        // Ensure the pinned panel stays within the viewport boundaries, e.g., after content expands.
        // This adjustment is now temporary and won't update the stored pinned position.
        const boundedX = Math.max(margin, Math.min(x, window.innerWidth - panelWidth - margin));
        const boundedY = Math.max(margin, Math.min(y, window.innerHeight - panelHeight - margin));

        panel.style.left = `${boundedX}px`;
        panel.style.top = `${boundedY}px`;
    }

    calculateNormalPosition() {
        const magnifyGlass = window.comfyUIMagnifyGlass;
        if (!magnifyGlass) return;

        const settings = this.stateManager.state.settings;
        const panelWidth = settings["🔍MagnifyGlass.InfoPanelWidth"];
        const panelHeight = Math.min(settings["🔍MagnifyGlass.InfoPanelMaxHeight"], this.uiManager.elements.panel.scrollHeight);

        let left, top;
        const margin = 15;

        if (!this.stateManager.state.isGlassPreviewVisible) {
            // Position at mouse cursor when glass is hidden
            left = magnifyGlass.lastKnownMousePosition.x - (panelWidth / 2);
            top = magnifyGlass.lastKnownMousePosition.y - 20;
        } else {
            // Position relative to magnify glass
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
                // Fallback to mouse position
                left = magnifyGlass.lastKnownMousePosition.x - (panelWidth / 2);
                top = magnifyGlass.lastKnownMousePosition.y - 20;
            }
        }

        // Apply boundary constraints
        left = Math.max(10, Math.min(left, window.innerWidth - panelWidth - 10));
        top = Math.max(10, Math.min(top, window.innerHeight - panelHeight - 10));

        this.uiManager.elements.panel.style.left = `${left}px`;
        this.uiManager.elements.panel.style.top = `${top}px`;
    }
}
