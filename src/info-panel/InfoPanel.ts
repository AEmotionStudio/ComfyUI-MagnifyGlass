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
    private boundScheduleSelectionUpdate: () => void;

    constructor(magnifyGlass: MagnifyGlassInstance) {
        this.magnifyGlass = magnifyGlass;

        // Initialize Managers
        this.stateManager = new StateManager();
        this.uiManager = new UIManager(this.stateManager);
        this.informationGatherer = new InformationGatherer();
        this.canvasHighlighter = new CanvasHighlighter(this.stateManager.state.settings);

        // Position Manager needs the UI elements
        this.positionManager = new PositionManager(this.stateManager, this.uiManager.elements.panel!);

        // Event Manager needs state and UI manager
        this.eventManager = new EventManager(this.stateManager, this.uiManager.elements.panel!, {
            toggleVisibility: () => {
                if (this.stateManager.state.isPanelVisible) {
                    this.uiManager.hide();
                } else {
                    this.uiManager.show();
                }
            },
            toggleFloat: () => this.uiManager.toggleFloating(),
            toggleSticky: () => this.uiManager.setPersist(!this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"]),
            updateLayout: () => {
                this.uiManager.applyStyles();
                this.uiManager.updateControlStates();
                this.positionManager.positionPanel();
                this.positionManager.positionFloatingControls(this.uiManager.elements.controls);
            },
            isGlassActive: () => this.magnifyGlass.state.active
        });

        // A click or key can change the selection without moving the mouse, which drives the other updates
        this.boundScheduleSelectionUpdate = () => {
            if (this.magnifyGlass.state.active && this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelFollowSelection"]) {
                this.scheduleInfoUpdate();
            }
        };
        document.addEventListener('pointerup', this.boundScheduleSelectionUpdate, true);
        document.addEventListener('keyup', this.boundScheduleSelectionUpdate, true);

        this.originalUpdateMagnifiedView = magnifyGlass.updateMagnifiedView;
        this.originalShow = magnifyGlass.ui.show;
        this.originalHide = magnifyGlass.ui.hide;
        this.hookIntoMagnifyGlass();

        // Listen for popout state changes to update UI buttons
        if (this.magnifyGlass.popOutManager) {
            this.magnifyGlass.popOutManager.onStateChange = () => {
                this.uiManager.updateControlStates();
            };
            // A node picked in the pop-out is a jump like any other
            this.magnifyGlass.popOutManager.onNodeSelect = (nodeId: number) => {
                this.uiManager.jumpToNode(nodeId);
            };
            // Listen for widget edits from popout to force refresh
            this.magnifyGlass.popOutManager.onWidgetEdit = () => {
                // Reflect the edit (e.g. unhidden widgets)
                this.updateInfo();
            };
        }

        // Jumps, the lock and the mode buttons show their result at once
        this.uiManager.onRefresh = () => this.updateInfo();

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
        document.removeEventListener('pointerup', this.boundScheduleSelectionUpdate, true);
        document.removeEventListener('keyup', this.boundScheduleSelectionUpdate, true);

        this.eventManager.cleanup();
        this.uiManager.cleanup();
        this.canvasHighlighter.cleanup();
    }

    /**
     * Follow the glass again from where it starts.
     */
    resetPosition(): void {
        // A hidden glass cannot be followed
        if (!this.stateManager.state.isGlassPreviewVisible) return;
        this.stateManager.state.isFloating = false;
        this.stateManager.state.floatPosition = null;
        this.stateManager.saveLayout();
        this.positionManager.positionPanel();
        this.uiManager.updateControlStates();
    }

    // The node Sticky keeps, looked up again on each update like the locked one
    private stickyNodeId: number | null = null;
    private stickyGraph: unknown = null;

    /**
     * Update the info panel with current information.
     */
    updateInfo(): void {
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

        let info = this.informationGatherer.gatherInformation();
        const state = this.stateManager.state;

        // The locked node is shown whatever is hovered, then the first selected node when following the selection.
        // The lock goes when its node does, or when another graph is on screen, where its id is another node.
        if (state.lockedNodeId !== null && state.lockedGraph !== app.canvas?.graph) {
            state.lockedNodeId = null;
        }
        const lockedNode = state.lockedNodeId === null ? null : this.uiManager.nodeSelector.getNodeById(state.lockedNodeId);
        if (!lockedNode) {
            state.lockedNodeId = null;
        }
        const selectedNode = !lockedNode && settings["🔍MagnifyGlass.InfoPanelFollowSelection"]
            ? Object.values(app.canvas?.selected_nodes ?? {})[0]
            : undefined;
        state.showsSelection = !!selectedNode;
        const shownNode = lockedNode ?? selectedNode;
        if (shownNode) {
            info = { ...info, hoveredNode: this.informationGatherer.getDetailedNodeInfo(shownNode) };
        }

        // Over empty canvas Sticky keeps the last node, until it goes or another graph is on screen
        if (info.hoveredNode) {
            this.stickyNodeId = info.hoveredNode.id;
            this.stickyGraph = app.canvas?.graph;
        } else if (settings["🔍MagnifyGlass.InfoPanelPersist"] && this.stickyNodeId !== null) {
            const stickyNode = this.stickyGraph === app.canvas?.graph ? this.uiManager.nodeSelector.getNodeById(this.stickyNodeId) : null;
            if (stickyNode) {
                info = { ...info, hoveredNode: this.informationGatherer.getDetailedNodeInfo(stickyNode) };
            } else {
                this.stickyNodeId = null;
            }
        }

        state.currentNodeId = info.hoveredNode?.id ?? null;

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
