/**
 * ComfyUI MagnifyGlass - Info Panel Orchestrator (TypeScript)
 * 
 * Complete Info Panel Manager extracted from magnify_info_panel.js
 * Main class that orchestrates all info panel components.
 */

import type { MagnifyGlassInstance } from '../types/comfyui';
import { Logger } from '../shared/logger';
import { StateManager } from './StateManager';
import { UIManager } from './UIManager';
import { PositionManager } from './PositionManager';
import { EventManager } from './EventManager';
import { InformationGatherer } from './InformationGatherer';
import { CanvasHighlighter } from './CanvasHighlighter';

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
    canvasHighlighter: CanvasHighlighter;
    private originalUpdateMagnifiedView: () => void;
    private originalShow: () => void;
    private originalHide: () => void;
    private updateFrameId: number | null = null;

    constructor(magnifyGlass: MagnifyGlassInstance) {
        this.magnifyGlass = magnifyGlass;

        // Initialize Managers
        this.stateManager = new StateManager();
        this.uiManager = new UIManager(this.stateManager);
        this.informationGatherer = new InformationGatherer();
        this.canvasHighlighter = new CanvasHighlighter();

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

        this.originalUpdateMagnifiedView = magnifyGlass.updateMagnifiedView;
        this.originalShow = magnifyGlass.ui.show;
        this.originalHide = magnifyGlass.ui.hide;
        this.hookIntoMagnifyGlass();

        // Listen for popout state changes to update UI buttons
        if (this.magnifyGlass.popOutManager) {
            this.magnifyGlass.popOutManager.onStateChange = () => {
                this.uiManager.updateControlStates();
            };
            // Listen for node selection from popout
            this.magnifyGlass.popOutManager.onNodeSelect = (nodeId: number) => {
                this.onNodeSelected(nodeId);
            };
            // Listen for widget edits from popout to force refresh
            this.magnifyGlass.popOutManager.onWidgetEdit = () => {
                // Force update to reflect changes (e.g. unhidden widgets)
                this.updateInfo(true);
            };
        }

        // Set up node selection callback
        this.uiManager.onNodeSelected = (nodeId: number) => {
            this.onNodeSelected(nodeId);
        };

        Logger.debug('Info Panel initialized successfully');
    }

    hookIntoMagnifyGlass(): void {
        const mg = this.magnifyGlass;

        mg.updateMagnifiedView = () => {
            this.originalUpdateMagnifiedView.call(mg);
            if (mg.state.active) {
                this.scheduleInfoUpdate();
            }
        };

        mg.ui.show = () => {
            this.originalShow.call(mg.ui);

            // CRITICAL: Only restore panel if the magnify glass is actually active
            // This prevents the panel from showing when toggle() is switching it OFF
            if (!this.magnifyGlass.state.active) {
                return;
            }

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
                    this.uiManager.elements.controls.style.pointerEvents = 'auto';
                }

                // Ensure states are updated
                this.uiManager.updateControlStates();

                // Position controls after showing (relative to glass since panel is hidden)
                setTimeout(() => {
                    this.positionManager.positionFloatingControls(this.uiManager.elements.controls);
                }, 10);
            }
        };

        mg.ui.hide = () => {
            // Save state before hiding
            this.stateManager.state.wasPanelVisibleBeforeHide = this.stateManager.state.isPanelVisible;

            this.originalHide.call(mg.ui);
            this.uiManager.hide();

            // FORCE HIDE: Directly set panel display to none as a safety measure
            if (this.uiManager.elements.panel) {
                this.uiManager.elements.panel.style.display = 'none';
                this.uiManager.elements.panel.style.pointerEvents = 'none';
                // Also force opacity 0 to prevent any visual ghost
                this.uiManager.elements.panel.style.opacity = '0';
            }

            // Explicitly hide floating controls when glass is disabled
            if (this.uiManager.elements.controls) {
                this.uiManager.elements.controls.style.display = 'none';
                this.uiManager.elements.controls.style.pointerEvents = 'none';
            }

            // Fix: Ensure highlight is cleared when glass is disabled
            this.canvasHighlighter.setHighlightedNode(null);
        };
    }

    scheduleInfoUpdate(): void {
        if (this.updateFrameId !== null) return;

        this.updateFrameId = requestAnimationFrame(() => {
            this.updateFrameId = null;
            this.updateInfo();
        });
    }

    /**
     * Undo everything the constructor set up: glass hooks, pop-out callbacks,
     * listeners, timers and DOM.
     */
    cleanup(): void {
        const mg = this.magnifyGlass;
        mg.updateMagnifiedView = this.originalUpdateMagnifiedView;
        mg.ui.show = this.originalShow;
        mg.ui.hide = this.originalHide;

        if (mg.popOutManager) {
            mg.popOutManager.onStateChange = null;
            mg.popOutManager.onNodeSelect = null;
            mg.popOutManager.onWidgetEdit = null;
        }

        if (this.updateFrameId !== null) {
            cancelAnimationFrame(this.updateFrameId);
            this.updateFrameId = null;
        }

        this.eventManager.cleanup();
        this.uiManager.cleanup();
        this.canvasHighlighter.cleanup();
        this.stateManager.cleanup();
    }

    // State for persistence
    private lastValidNodeInfo: any = null;

    /**
     * Update the info panel with current information.
     * @param forceUpdate - If true, bypass the isInfoHeld check to force an update
     */
    updateInfo(forceUpdate: boolean = false): void {
        const settings = this.stateManager.state.settings;
        const isActive = this.magnifyGlass.state.active;

        // Safety: If inactive, ensure hidden and return
        if (!isActive) {
            // Hide the panel completely when the glass is inactive
            this.uiManager.hide();
            if (this.uiManager.elements.controls && this.uiManager.elements.controls.style.display !== 'none') {
                this.uiManager.elements.controls.style.display = 'none';
            }
            this.canvasHighlighter.setHighlightedNode(null);
            return;
        }

        // Logic for "Hold Info" (Freeze)
        // Skip if held, UNLESS we're forcing an update (e.g., from dropdown selection)
        if (this.stateManager.state.isInfoHeld && !forceUpdate) {
            // If held, we skip gathering new info and skip updating the display content.
            // But we MUST still update positioning to keep the UI responsive to movement.
            this.positionManager.positionPanel();
            this.positionManager.positionFloatingControls(this.uiManager.elements.controls);
            return;
        }

        let info = this.informationGatherer.gatherInformation();

        // AUTO-CLEAR SELECTION: If user hovers a different node, clear the manual selection
        // This allows the dropdown selection to be a "jump to" action, then resume normal hover
        const selectedNodeId = this.stateManager.state.selectedNodeId;
        if (selectedNodeId !== null && info.hoveredNode && info.hoveredNode.id !== selectedNodeId) {
            // User is hovering a different node than the selected one - clear selection
            this.stateManager.clearSelectedNode();
        }

        // NODE SELECTION OVERRIDE - check if user has selected a specific node (after auto-clear check)
        const currentSelectedId = this.stateManager.state.selectedNodeId;
        if (currentSelectedId !== null) {
            const selectedNode = this.uiManager.nodeSelector.getNodeById(currentSelectedId);
            if (selectedNode) {
                // Override with selected node info
                const detailedInfo = this.informationGatherer.getDetailedNodeInfo(
                    selectedNode,
                    { x: 0, y: 0 } // No local position when manually selected
                );
                info = {
                    ...info,
                    hoveredNode: detailedInfo,
                    hoveredWidget: null
                };
            }
        }
        // END NODE SELECTION OVERRIDE

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

        // Update canvas highlight
        this.canvasHighlighter.setHighlightedNode(info.hoveredNode ? info.hoveredNode.id : null);

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

    /**
     * Handle node selection from dropdown.
     * @param nodeId - ID of the selected node
     */
    onNodeSelected(nodeId: number): void {
        Logger.debug(`Node selected from dropdown: ${nodeId}`);

        // Set the selected node in state manager
        this.stateManager.setSelectedNode(nodeId);

        // Force an immediate info update (bypasses isInfoHeld)
        this.updateInfo(true);
    }

    /**
     * Clear the selected node, returning to hover-based detection.
     */
    clearSelectedNode(): void {
        this.stateManager.clearSelectedNode();
        this.updateInfo();
    }
}

/**
 * Build the info panel and attach it to the glass. Does nothing if it is already mounted.
 */
export function mountInfoPanel(magnifyGlass: MagnifyGlassInstance): void {
    if (window.infoPanelManager) return;

    const infoPanel = new InfoPanel(magnifyGlass);
    window.infoPanelManager = infoPanel;
    // Lets MagnifyGlass hide the panel along with the glass
    (window.comfyUIMagnifyGlassExtensions ??= []).push(infoPanel);

    // The new panel's G button starts out "visible"; a glass hidden with G while the panel was off must match it
    magnifyGlass.setGlassPreviewActive(true);
    if (magnifyGlass.state.active) {
        magnifyGlass.ui.show();
    }
}

/**
 * Detach the info panel from the glass and remove it from the page.
 */
export function unmountInfoPanel(magnifyGlass: MagnifyGlassInstance): void {
    const infoPanel = window.infoPanelManager;
    if (!infoPanel) return;

    infoPanel.cleanup();
    window.infoPanelManager = undefined;
    window.comfyUIMagnifyGlassExtensions = window.comfyUIMagnifyGlassExtensions?.filter(ext => ext !== infoPanel);

    // The panel's G button may have hidden the glass preview; nothing could show it again
    magnifyGlass.setGlassPreviewActive(true);
}
