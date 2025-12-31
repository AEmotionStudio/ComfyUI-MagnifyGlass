/**
 * ComfyUI MagnifyGlass - Info Panel Orchestrator
 * 
 * Complete Info Panel Manager extracted from magnify_info_panel.js
 * Main class that orchestrates all info panel components.
 */

import { app } from "../../../../scripts/app.js";
import { StateManager } from './StateManager.js';
import { UIManager } from './UIManager.js';
import { PositionManager } from './PositionManager.js';
import { EventManager } from './EventManager.js';
import { InformationGatherer } from './InformationGatherer.js';

/**
 * Professional Info Panel Manager.
 * Orchestrates all the other components for the info panel.
 */
export class InfoPanel {
    constructor(magnifyGlass) {
        this.magnifyGlass = magnifyGlass;

        // Initialize all managers
        this.stateManager = new StateManager();
        this.uiManager = new UIManager(this.stateManager);
        this.positionManager = new PositionManager(this.stateManager, this.uiManager);
        this.eventManager = new EventManager(this.stateManager, this.uiManager, this.positionManager);
        this.informationGatherer = new InformationGatherer();

        this.hookIntoMagnifyGlass();

        console.log("ComfyUI Magnify Info Panel Pro V2: Initialized successfully");
    }

    hookIntoMagnifyGlass() {
        // Hook into magnify glass update cycle
        const originalUpdateMagnifiedView = this.magnifyGlass.updateMagnifiedView.bind(this.magnifyGlass);

        this.magnifyGlass.updateMagnifiedView = (() => {
            originalUpdateMagnifiedView();

            if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"] && this.magnifyGlass.state.active) {
                this.scheduleInfoUpdate();
            }
        }).bind(this);

        // Hook into show/hide
        const originalShow = this.magnifyGlass.ui.show.bind(this.magnifyGlass.ui);
        const originalHide = this.magnifyGlass.ui.hide.bind(this.magnifyGlass.ui);

        this.magnifyGlass.ui.show = (() => {
            originalShow();
            if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"]) {
                this.uiManager.show();
                // Position controls after showing
                setTimeout(() => this.positionManager.positionPanel(), 10);
            }
        }).bind(this);

        this.magnifyGlass.ui.hide = (() => {
            originalHide();
            this.uiManager.hide();
        }).bind(this);
    }

    scheduleInfoUpdate() {
        if (this.stateManager.state.updateScheduled) return;

        this.stateManager.state.updateScheduled = true;
        requestAnimationFrame(() => {
            this.updateInfo();
            this.stateManager.state.updateScheduled = false;
        });
    }

    updateInfo() {
        if (!this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"] || !this.magnifyGlass.state.active) return;

        const info = this.informationGatherer.gatherInformation();
        this.stateManager.setCurrentInfo(info);
        this.uiManager.displayInfo(info);
        this.positionManager.positionPanel();

        // Handle node hover state
        if (info.hoveredNode) {
            this.stateManager.state.isHoveringNode = true;
            this.stateManager.expandNodeSections();

            if (this.stateManager.state.lastNodeId !== info.hoveredNode.id) {
                this.stateManager.state.lastNodeId = info.hoveredNode.id;
            }
        } else {
            this.stateManager.state.isHoveringNode = false;

            if (this.stateManager.state.lastNodeId !== null) {
                this.stateManager.state.lastNodeId = null;
                if (!this.stateManager.state.isPanelHovered) {
                    this.stateManager.scheduleAutoCollapse();
                }
            }
        }
    }

    updateSettings() {
        const changes = this.stateManager.updateSettings();

        // React to setting changes (theme is now auto-detected)
        // Theme changes are handled automatically by the observer

        if (changes["🔍MagnifyGlass.ControlsPosition"]) {
            // Update controls layout and position when position setting changes
            this.positionManager.positionPanel();
        }

        // Apply new styles
        this.uiManager.applyStyles();

        if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"] && this.magnifyGlass.state.active) {
            this.uiManager.show();
        } else {
            this.uiManager.hide();
        }
    }

    cleanup() {
        this.stateManager.cleanup();
        this.uiManager.cleanup();
        this.eventManager.cleanup();
    }
}
