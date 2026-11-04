/**
 * ComfyUI MagnifyGlass - Info Panel Orchestrator (TypeScript)
 * 
 * Complete Info Panel Manager extracted from magnify_info_panel.js
 * Main class that orchestrates all info panel components.
 */

import type { ComfyNode, MagnifyGlassInstance, NodeInfo } from '../types/comfyui';
import type { PopOutInfo, WidgetRef } from '../magnify-glass/PopOutManager';
import { Logger } from '../shared/logger';
import { StateManager } from './StateManager';
import { UIManager } from './UIManager';
import { PositionManager } from './PositionManager';
import { EventManager } from './EventManager';
import { InformationGatherer } from './InformationGatherer';
import { CanvasHighlighter } from './CanvasHighlighter';
import { getImportantNodeParameters, getSlotLinks, type ParameterItem } from './NodeDataExtractor';
import { WidgetSyncManager } from './widget-editors/WidgetSyncManager';

type PopOutNav = PopOutInfo['nav'];

// A pointer still for this long has arrived; hover follows it again
const AIM_REST_MS = 300;

/**
 * Whether the ray from (x, y) along (dx, dy) passes through the rect, grown by a margin.
 */
function rayHitsRect(x: number, y: number, dx: number, dy: number, rect: DOMRect, margin = 12): boolean {
    let near = 0;
    let far = Infinity;
    for (const [origin, step, low, high] of [[x, dx, rect.left - margin, rect.right + margin], [y, dy, rect.top - margin, rect.bottom + margin]]) {
        if (step === 0) {
            if (origin < low || origin > high) return false;
            continue;
        }
        const a = (low - origin) / step;
        const b = (high - origin) / step;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
    }
    return near <= far;
}

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
    private originalPositionGlass: (x: number, y: number) => void;
    private updateFrameId: number | null = null;
    private boundScheduleSelectionUpdate: () => void;
    // Refreshes the pop-out while it is connected, since it gets no input of its own here
    private popOutTimer: number | null = null;
    // What the pop-out was last sent from, null to send the next update whatever it holds
    private popOutKey: unknown[] | null = null;
    // The node the pop-out shows and the graph it came from; its edits apply only there
    private popOutNodeId: number | null = null;
    private popOutGraph: unknown = null;
    // The results the pop-out's /view URLs were built from; each build gets a new rand param, which loads every image again
    private popOutImages: Record<string, string>[] | null = null;
    private popOutImageUrls: string[] = [];
    // The hovered node, kept while the pointer is over other UI or heads for the panel
    private hoverNodeId: number | null = null;
    private hoverGraph: unknown = null;
    // Where the pointer last was over that node, where it is and when it last moved
    private hoverAnchor: { x: number; y: number } | null = null;
    private pointer = { x: 0, y: 0, movedAt: 0 };
    private aiming = false;
    private aimTimer: number | null = null;

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
        this.originalPositionGlass = magnifyGlass.ui.positionGlass;
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

        // With Follow Cursor the panel moves with the glass; it holds still while the pointer heads for it or is on it
        mg.ui.positionGlass = (x: number, y: number) => {
            if (this.aiming || this.isPointerOnPanel()) return;
            this.originalPositionGlass.call(mg.ui, x, y);
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
        mg.ui.positionGlass = this.originalPositionGlass;

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
        if (this.aimTimer !== null) {
            clearTimeout(this.aimTimer);
            this.aimTimer = null;
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
     * @param fromTick - The pop-out's refresh: the glass has not moved, so the panel is not placed again
     */
    updateInfo(fromTick = false): void {
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
        const hovered = isActive ? this.resolveHover() : null;
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
            // The panel stays put while the pointer heads for it or is on it
            if (!fromTick && !this.aiming && !this.isPointerOnPanel()) {
                this.positionManager.positionPanel();
                this.positionManager.positionFloatingControls(this.uiManager.elements.controls);
            }
        }

        if (popOutOpen) {
            this.sendPopOutInfo(info, source);
        }
    }

    /**
     * The node under the pointer. Over other UI (the sidebar, a menu, this panel) the last one stays, and so it
     * does while the pointer heads from it for the panel, crossing canvas and other nodes, until the pointer rests.
     */
    private resolveHover(): ComfyNode | null {
        const { x, y } = this.magnifyGlass.lastKnownMousePosition;
        const now = performance.now();
        if (x !== this.pointer.x || y !== this.pointer.y) this.pointer = { x, y, movedAt: now };
        const graph = app.canvas?.graph;
        const kept = this.hoverNodeId !== null && this.hoverGraph === graph ? this.uiManager.nodeSelector.getNodeById(this.hoverNodeId) : null;
        this.aiming = false;
        if (!this.informationGatherer.isPointerOverGraph(x, y)) return kept;

        const node = this.informationGatherer.getNodeUnderCursor();
        if (node !== kept && kept && now - this.pointer.movedAt < AIM_REST_MS && this.headsForPanel(x, y)) {
            this.aiming = true;
            // Look again once the pointer may have come to rest
            this.aimTimer ??= window.setTimeout(() => {
                this.aimTimer = null;
                this.scheduleInfoUpdate();
            }, AIM_REST_MS);
            return kept;
        }
        this.hoverAnchor = node ? { x, y } : null;
        this.hoverNodeId = node?.id ?? null;
        this.hoverGraph = graph;
        return node;
    }

    /**
     * Whether the pointer moves from where it left the shown node toward the panel or its controls.
     */
    private headsForPanel(x: number, y: number): boolean {
        const anchor = this.hoverAnchor;
        if (!anchor || !this.stateManager.state.isPanelVisible) return false;
        const dx = x - anchor.x;
        const dy = y - anchor.y;
        if (dx === 0 && dy === 0) return false;
        const { panel, controls } = this.uiManager.elements;
        return [panel, controls].some(element => {
            const rect = element?.getBoundingClientRect();
            // A panel moved over the spot the pointer left from is not one it heads for
            const covers = !!rect && anchor.x >= rect.left && anchor.x <= rect.right && anchor.y >= rect.top && anchor.y <= rect.bottom;
            return !!rect && rect.width > 0 && !covers && rayHitsRect(anchor.x, anchor.y, dx, dy, rect);
        });
    }

    private isPointerOnPanel(): boolean {
        const { x, y } = this.magnifyGlass.lastKnownMousePosition;
        const element = document.elementFromPoint(x, y);
        const { panel, controls } = this.uiManager.elements;
        return !!element && (!!panel?.contains(element) || !!controls?.contains(element));
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
        // A failed validation replaces lastNodeErrors; a run replaces the node's results and previews.
        // Links change in place, and so do the titles of the nodes they link to.
        const node = info.hoveredNode;
        const liveNode = node && this.uiManager.nodeSelector.getNodeById(node.id);
        const links = liveNode ? getSlotLinks(liveNode) : { inputs: [], outputs: [] };
        const key = [
            ...this.uiManager.getRenderKey(info), ...Object.values(nav), app.lastNodeErrors,
            node && app.nodeOutputs[node.locatorId]?.images, node && app.nodePreviewImages[node.locatorId],
            JSON.stringify(links)
        ];
        const sent = this.popOutKey;
        if (sent && key.length === sent.length && key.every((v, i) => Object.is(v, sent[i]))) return;
        this.popOutKey = key;

        this.popOutNodeId = node?.id ?? null;
        this.popOutGraph = app.canvas?.graph;
        this.magnifyGlass.popOutManager!.sendInfo(this.buildPopOutInfo(node, nav, links));
    }

    /**
     * The pop-out payload: the node's identity and place, its widget rows, outputs and links as plain data.
     */
    private buildPopOutInfo(node: NodeInfo | null, nav: PopOutNav, links: PopOutInfo['links']): PopOutInfo {
        if (!node) return { node: null, nav, rows: [], outputs: [], links };

        // The last queued prompt's validation errors, by the input they name
        const errors = new Map<string, string>();
        for (const error of app.lastNodeErrors?.[node.executionId]?.errors ?? []) {
            const input = error.extra_info?.input_name;
            if (input) errors.set(input, error.details ? `${error.message}: ${error.details}` : error.message);
        }

        return {
            node: {
                id: node.id,
                title: node.title,
                type: node.type,
                mode: node.mode,
                execOrder: node.executionOrder,
                executionId: node.executionId,
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
                    constraints,
                    error: row.widgetName ? errors.get(row.widgetName) : undefined
                };
            }),
            outputs: this.popOutOutputs(node.locatorId),
            links
        };
    }

    /**
     * The node's images as ComfyUI previews them on the node: its live previews while it runs, otherwise its last results.
     */
    private popOutOutputs(locatorId: string): string[] {
        const previews = app.nodePreviewImages[locatorId];
        if (previews?.length) return previews;
        const output = app.nodeOutputs[locatorId];
        if (!output?.images) return [];
        if (output.images !== this.popOutImages) {
            this.popOutImages = output.images;
            // ComfyUI shows animated results other than WebP and PNG as video, which an <img> can't show
            const video = output.animated?.some(Boolean) && !output.images.some(image => /webp|png/.test(image.filename));
            this.popOutImageUrls = video ? [] : output.images.map(({ filename, subfolder, type }) =>
                app.api.apiURL(`/view?${new URLSearchParams({ filename, subfolder, type })}${app.getRandParam()}`));
        }
        return this.popOutImageUrls;
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
        this.popOutTimer = window.setInterval(() => this.updateInfo(true), 250);
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
