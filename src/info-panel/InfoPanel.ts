/**
 * ComfyUI MagnifyGlass - Info Panel Orchestrator (TypeScript)
 * 
 * Complete Info Panel Manager extracted from magnify_info_panel.js
 * Main class that orchestrates all info panel components.
 */

import { registerPanelSettings } from '../shared/settings';
import { StateManager } from './StateManager';
import { UIManager } from './UIManager';
import { PositionManager } from './PositionManager';
import { EventManager } from './EventManager';
import { InformationGatherer } from './InformationGatherer';

/**
 * Professional Info Panel Manager.
 * Orchestrates all the other components for the info panel.
 */
export class InfoPanel {
    magnifyGlass: any;
    stateManager: StateManager;
    uiManager: UIManager;
    positionManager: PositionManager;
    eventManager: EventManager;
    informationGatherer: InformationGatherer;

    constructor(magnifyGlass: any) {
        this.magnifyGlass = magnifyGlass;

        // Initialize Managers
        this.stateManager = new StateManager();
        this.uiManager = new UIManager(this.stateManager);
        this.informationGatherer = new InformationGatherer();

        // Position Manager needs the UI elements
        this.positionManager = new PositionManager(this.stateManager, this.uiManager.elements.panel!);

        // Event Manager needs state and UI manager
        this.eventManager = new EventManager(this.stateManager, this.uiManager.elements.panel!, this.positionManager, {
            toggleVisibility: () => {
                if (this.stateManager.state.isPanelVisible) {
                    this.uiManager.hide();
                } else {
                    this.uiManager.show();
                }
            },
            togglePin: () => {
                this.stateManager.togglePinning();
                this.uiManager.updatePinnedState();
            },
            updatePosition: () => this.positionManager.positionPanel()
        });

        this.hookIntoMagnifyGlass();

        // Register settings with ComfyUI
        registerPanelSettings(this.stateManager, this.uiManager, this.positionManager);

        console.log("ComfyUI Magnify Info Panel Pro V2: Initialized successfully");
    }

    hookIntoMagnifyGlass(): void {
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
                setTimeout(() => {
                    this.positionManager.positionPanel();
                    this.positionManager.positionFloatingControls(this.uiManager.elements.controls);
                }, 10);
            }
        }).bind(this);

        this.magnifyGlass.ui.hide = (() => {
            originalHide();
            this.uiManager.hide();
        }).bind(this);
    }

    scheduleInfoUpdate(): void {
        if (this.stateManager.state.updateScheduled) return;

        this.stateManager.state.updateScheduled = true;
        requestAnimationFrame(() => {
            this.updateInfo();
            this.stateManager.state.updateScheduled = false;
        });
    }

    updateInfo(): void {
        if (!this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"] || !this.magnifyGlass.state.active) return;

        const info = this.informationGatherer.gatherInformation();
        this.stateManager.setCurrentInfo(info);

        // Update the UI
        this.uiManager.displayInfo(info);

        this.positionManager.positionPanel();
        this.positionManager.positionFloatingControls(this.uiManager.elements.controls);

        // Handle node hover state logic if needed for internal state
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

    updateSettings(): void {
        const changes = this.stateManager.updateSettings();
        this.uiManager.applyStyles();

        if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"] && this.magnifyGlass.state.active) {
            this.uiManager.show();
        } else {
            this.uiManager.hide();
        }
    }
}
