/**
 * ComfyUI MagnifyGlass - Info Panel Orchestrator (TypeScript)
 * 
 * Complete Info Panel Manager extracted from magnify_info_panel.js
 * Main class that orchestrates all info panel components.
 */

import type { MagnifyGlassInstance, NodeInfo } from '../types/comfyui';
import type { PopOutInfo, WidgetRef } from '../magnify-glass/PopOutManager';
import { Logger } from '../shared/logger';
import { StateManager } from './StateManager';
import { UIManager } from './UIManager';
import { PositionManager } from './PositionManager';
import { EventManager } from './EventManager';
import { InformationGatherer } from './InformationGatherer';
import { CanvasHighlighter } from './CanvasHighlighter';
import { getImportantNodeParameters, type ParameterItem } from './NodeDataExtractor';
import { WidgetSyncManager } from './widget-editors/WidgetSyncManager';

type PopOutNav = PopOutInfo['nav'];

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
    // Refreshes the pop-out while it is connected, since it gets no input of its own here
    private popOutTimer: number | null = null;
    // What the pop-out was last sent from, null to send the next update whatever it holds
    private popOutKey: unknown[] | null = null;
    // The node the pop-out shows and the graph it came from; its edits apply only there
    private popOutNodeId: number | null = null;
    private popOutGraph: unknown = null;

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

        const popOut = this.magnifyGlass.popOutManager;
        if (popOut) {
            popOut.onStateChange = (isOpen: boolean) => {
                this.uiManager.updateControlStates();
                this.setPopOutRefresh(isOpen);
            };
            // A node picked in the pop-out is a jump like any other
            popOut.onNodeSelect = (nodeId: number) => {
                this.uiManager.jumpToNode(nodeId);
            };
            // The viewer changes widgets under the Inspector's rules, and always gets the result back,
            // so a rejected edit does not keep showing its value
            popOut.onWidgetEdit = (data) => {
                if (this.uiManager.canEdit() && this.popOutRow(data)?.isEditable) {
                    WidgetSyncManager.syncWidgetValue(data.nodeId, data.widgetName, data.value);
                }
                this.refreshPopOut();
            };
            popOut.onButtonClick = (data) => {
                if (this.popOutRow(data)?.isActionable) {
                    WidgetSyncManager.clickButton(data.nodeId, data.widgetName);
                }
                this.refreshPopOut();
            };
            popOut.onRequestOptions = (data) => this.popOutRow(data)?.constraints?.options ?? [];
            popOut.onSearchNodes = (query) => this.uiManager.nodeSelector.search(query);
            // Navigation from the node the pop-out shows, the same as the panel's buttons
            popOut.onPanelAction = (name, nodeId) => {
                if (nodeId === this.popOutNodeId && app.canvas?.graph === this.popOutGraph) {
                    this.uiManager.runAction(name, nodeId);
                }
            };
            // Mounted while a viewer is connected, e.g. the Inspector turned back on
            this.setPopOutRefresh(popOut.isPopOutOpen());
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
            mg.popOutManager.onButtonClick = null;
            mg.popOutManager.onRequestOptions = null;
            mg.popOutManager.onSearchNodes = null;
            mg.popOutManager.onPanelAction = null;
        }
        this.setPopOutRefresh(false);

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
     * Update the info panel and the pop-out with the node to show.
     */
    updateInfo(): void {
        const settings = this.stateManager.state.settings;
        const isActive = this.magnifyGlass.state.active;
        const popOutOpen = !!this.magnifyGlass.popOutManager?.isPopOutOpen();

        if (!isActive) {
            // Hide the panel completely when the glass is inactive; the pop-out tick lands here too
            if (this.stateManager.state.isPanelVisible) this.uiManager.hide();
            if (this.uiManager.elements.controls && this.uiManager.elements.controls.style.display !== 'none') {
                this.uiManager.elements.controls.style.display = 'none';
            }
            this.canvasHighlighter.setHighlightedNode(null);
            // The pop-out still shows the locked, selected or sticky node
            if (!popOutOpen) return;
        }

        // Nothing is hovered while the glass is off
        const hovered = isActive ? this.informationGatherer.getNodeUnderCursor() : null;
        let node = hovered ? this.informationGatherer.getDetailedNodeInfo(hovered) : null;
        let source: PopOutNav['source'] = 'hover';
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
            node = this.informationGatherer.getDetailedNodeInfo(shownNode);
            source = lockedNode ? 'locked' : 'selection';
        }

        // Over empty canvas Sticky keeps the last node, until it goes or another graph is on screen
        if (node) {
            this.stickyNodeId = node.id;
            this.stickyGraph = app.canvas?.graph;
        } else if (settings["🔍MagnifyGlass.InfoPanelPersist"] && this.stickyNodeId !== null) {
            const stickyNode = this.stickyGraph === app.canvas?.graph ? this.uiManager.nodeSelector.getNodeById(this.stickyNodeId) : null;
            if (stickyNode) {
                node = this.informationGatherer.getDetailedNodeInfo(stickyNode);
                source = 'sticky';
            } else {
                this.stickyNodeId = null;
            }
        }

        state.currentNodeId = node?.id ?? null;
        const info = { hoveredNode: node };

        if (isActive) {
            this.uiManager.displayInfo(info);
            this.canvasHighlighter.setHighlightedNode(node ? node.id : null);
            this.positionManager.positionPanel();
            this.positionManager.positionFloatingControls(this.uiManager.elements.controls);
        }

        if (popOutOpen) {
            this.sendPopOutInfo(info, source);
        }
    }

    /**
     * Send the pop-out what the Inspector shows, when it changed since the last send.
     */
    private sendPopOutInfo(info: { hoveredNode: NodeInfo | null }, source: PopOutNav['source']): void {
        const nav: PopOutNav = {
            source,
            locked: this.stateManager.state.lockedNodeId !== null,
            ...this.uiManager.getHistoryNav(),
            canEdit: this.uiManager.canEdit()
        };
        const key = [...this.uiManager.getRenderKey(info), ...Object.values(nav)];
        const sent = this.popOutKey;
        if (sent && key.length === sent.length && key.every((v, i) => Object.is(v, sent[i]))) return;
        this.popOutKey = key;

        this.popOutNodeId = info.hoveredNode?.id ?? null;
        this.popOutGraph = app.canvas?.graph;
        this.magnifyGlass.popOutManager!.sendInfo(this.buildPopOutInfo(info.hoveredNode, nav));
    }

    /**
     * The pop-out payload: the node's identity and place, and its widget rows as plain data.
     */
    private buildPopOutInfo(node: NodeInfo | null, nav: PopOutNav): PopOutInfo {
        if (!node) return { node: null, nav, rows: [] };

        return {
            node: {
                id: node.id,
                title: node.title,
                type: node.type,
                mode: node.mode,
                execOrder: node.executionOrder,
                graphPath: node.graphPath,
                group: node.group,
                isSubgraph: node.isSubgraph
            },
            nav,
            rows: getImportantNodeParameters(node).map(row => {
                // Combo lists can be long, so the viewer asks for them when it opens an editor
                const { options, ...constraints } = row.constraints ?? {};
                const raw = row.rawValue;
                return {
                    label: row.label,
                    widgetName: row.widgetName,
                    widgetType: row.widgetType,
                    value: row.value,
                    rawValue: raw === null || typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean' ? raw : undefined,
                    isEditable: !!row.isEditable,
                    isLinked: !!row.isLinked,
                    isActionable: !!row.isActionable,
                    constraints
                };
            })
        };
    }

    /**
     * The row of a widget on the node the pop-out shows, while its graph is still on screen.
     */
    private popOutRow({ nodeId, widgetName }: WidgetRef): ParameterItem | undefined {
        if (nodeId !== this.popOutNodeId || app.canvas?.graph !== this.popOutGraph) return undefined;
        const node = this.uiManager.nodeSelector.getNodeById(nodeId);
        return node ? getImportantNodeParameters(this.informationGatherer.getDetailedNodeInfo(node)).find(row => row.widgetName === widgetName) : undefined;
    }

    /**
     * Send the pop-out its info now, even if nothing changed.
     */
    private refreshPopOut(): void {
        this.popOutKey = null;
        this.updateInfo();
    }

    /**
     * Refresh the pop-out a few times a second while it is connected: values change after a run
     * or from another window without any input in this one.
     */
    private setPopOutRefresh(connected: boolean): void {
        if (this.popOutTimer !== null) {
            clearInterval(this.popOutTimer);
            this.popOutTimer = null;
        }
        if (!connected) return;
        this.popOutTimer = window.setInterval(() => this.updateInfo(), 250);
        this.refreshPopOut();
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
