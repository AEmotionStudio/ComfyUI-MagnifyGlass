/**
 * ComfyUI MagnifyGlass - Info Panel Orchestrator (TypeScript)
 * 
 * Complete Info Panel Manager extracted from magnify_info_panel.js
 * Main class that orchestrates all info panel components.
 */

import type { MagnifyGlassInstance } from '../types/comfyui';
import { registerPanelSettings } from '../shared/settings';
import { Logger } from '../shared/logger';
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
    magnifyGlass: MagnifyGlassInstance;
    stateManager: StateManager;
    uiManager: UIManager;
    positionManager: PositionManager;
    eventManager: EventManager;
    informationGatherer: InformationGatherer;

    constructor(magnifyGlass: MagnifyGlassInstance) {
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

        Logger.info('Info Panel initialized successfully');
    }

    hookIntoMagnifyGlass(): void {
        // Hook into magnify glass update cycle
        const originalUpdateMagnifiedView = this.magnifyGlass.updateMagnifiedView.bind(this.magnifyGlass);

        this.magnifyGlass.updateMagnifiedView = (() => {
            originalUpdateMagnifiedView();

            // Only schedule info update if panel is enabled, glass is active, AND preview is visible
            // This prevents extra work when glass preview is hidden via hover controls
            if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"] &&
                this.magnifyGlass.state.active &&
                this.stateManager.state.isGlassPreviewVisible !== false) {
                this.scheduleInfoUpdate();
            }
        }).bind(this);

        // Hook into show/hide
        const originalShow = this.magnifyGlass.ui.show.bind(this.magnifyGlass.ui);
        const originalHide = this.magnifyGlass.ui.hide.bind(this.magnifyGlass.ui);

        this.magnifyGlass.ui.show = (() => {
            originalShow();

            // CRITICAL: Only restore panel if the magnify glass is actually active
            // This prevents the panel from showing when toggle() is switching it OFF
            if (!this.magnifyGlass.state.active) {
                return;
            }

            if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"]) {
                // Restore state: If it was visible before hide, make it visible now.
                // Otherwise only show controls.
                if (this.stateManager.state.wasPanelVisibleBeforeHide) {
                    this.uiManager.show();

                    // Position properly
                    setTimeout(() => {
                        this.positionManager.positionPanel();
                        this.positionManager.positionFloatingControls(this.uiManager.elements.controls);
                    }, 10);
                } else {
                    // Do NOT force panel visible. Only show controls.
                    const showControls = this.stateManager.state.settings["🔍MagnifyGlass.ShowHoveringControls"] !== false;
                    if (showControls && this.uiManager.elements.controls) {
                        this.uiManager.elements.controls.style.display = 'flex';
                    }

                    // Ensure states are updated
                    this.uiManager.updateControlStates();

                    // Position controls after showing (relative to glass since panel is hidden)
                    setTimeout(() => {
                        this.positionManager.positionFloatingControls(this.uiManager.elements.controls);
                    }, 10);
                }
            }
        }).bind(this);

        this.magnifyGlass.ui.hide = (() => {
            // Save state before hiding
            this.stateManager.state.wasPanelVisibleBeforeHide = this.stateManager.state.isPanelVisible;

            originalHide();
            this.uiManager.hide();

            // FORCE HIDE: Directly set panel display to none as a safety measure
            if (this.uiManager.elements.panel) {
                this.uiManager.elements.panel.style.display = 'none';
            }

            // Explicitly hide floating controls when glass is disabled
            if (this.uiManager.elements.controls) {
                this.uiManager.elements.controls.style.display = 'none';
            }
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

    // State for persistence
    private lastValidNodeInfo: any = null;

    updateInfo(): void {
        const settings = this.stateManager.state.settings;
        const isActive = this.magnifyGlass.state.active;

        // Safety: If disabled or inactive, ensure hidden and return
        if (!settings["🔍MagnifyGlass.InfoPanelEnabled"] || !isActive) {
            // Hide the panel completely when the glass is inactive
            this.uiManager.hide();
            if (this.uiManager.elements.controls && this.uiManager.elements.controls.style.display !== 'none') {
                this.uiManager.elements.controls.style.display = 'none';
            }
            return;
        }

        // Logic for "Hold Info" (Freeze)
        if (this.stateManager.state.isInfoHeld) {
            // If held, we skip gathering new info and skip updating the display content.
            // But we MUST still update positioning to keep the UI responsive to movement.
            this.positionManager.positionPanel();
            this.positionManager.positionFloatingControls(this.uiManager.elements.controls);
            return;
        }

        let info = this.informationGatherer.gatherInformation();

        // PERSISTENCE LOGIC START
        if (info.hoveredNode) {
            // We have a valid node, update our cache
            this.lastValidNodeInfo = info;
        } else if (settings["🔍MagnifyGlass.InfoPanelPersist"] && this.lastValidNodeInfo) {
            // No node hovered, but persistence is ON and we have a cache.
            // Merge the CACHED node info into the CURRENT info (so we keep current cursor pos/zoom but show old node)
            info = {
                ...info, // Current timestamp, cursor, zoom
                hoveredNode: this.lastValidNodeInfo.hoveredNode,
                hoveredWidget: this.lastValidNodeInfo.hoveredWidget
            };
        }
        // PERSISTENCE LOGIC END

        this.stateManager.setCurrentInfo(info);

        // Update the UI
        this.uiManager.displayInfo(info);

        // Send info to pop-out viewer if active
        if (this.magnifyGlass.popOutManager && this.magnifyGlass.popOutManager.isPopOutOpen()) {
            this.magnifyGlass.popOutManager.sendInfo(info as any);
        }

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
            // Only collapse if we are NOT persisting
            if (!settings["🔍MagnifyGlass.InfoPanelPersist"]) {
                if (this.stateManager.state.lastNodeId !== null) {
                    this.stateManager.state.lastNodeId = null;
                    if (!this.stateManager.state.isPanelHovered) {
                        this.stateManager.scheduleAutoCollapse();
                    }
                }
            }
        }
    }

    updateSettings(): void {
        const changes = this.stateManager.updateSettings();
        this.uiManager.applyStyles();

        if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"] && this.magnifyGlass.state.active) {
            this.uiManager.show();
            // Ensure position is updated after potential dimension changes
            this.positionManager.positionPanel();
        } else {
            this.uiManager.hide();
        }
    }
}
