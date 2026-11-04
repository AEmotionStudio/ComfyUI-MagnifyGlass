var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { Logger } from "../shared/logger.js";
import { StateManager } from "./StateManager.js";
import { UIManager } from "./UIManager.js";
import { PositionManager } from "./PositionManager.js";
import { EventManager } from "./EventManager.js";
import { InformationGatherer } from "./InformationGatherer.js";
import { CanvasHighlighter } from "./CanvasHighlighter.js";
import { getImportantNodeParameters } from "./NodeDataExtractor.js";
import { WidgetSyncManager } from "./widget-editors/WidgetSyncManager.js";
class InfoPanel {
  constructor(magnifyGlass) {
    __publicField(this, "magnifyGlass");
    __publicField(this, "stateManager");
    __publicField(this, "uiManager");
    __publicField(this, "positionManager");
    __publicField(this, "eventManager");
    __publicField(this, "informationGatherer");
    __publicField(this, "canvasHighlighter");
    __publicField(this, "originalUpdateMagnifiedView");
    __publicField(this, "originalShow");
    __publicField(this, "originalHide");
    __publicField(this, "updateFrameId", null);
    __publicField(this, "boundScheduleSelectionUpdate");
    // Refreshes the pop-out while it is connected, since it gets no input of its own here
    __publicField(this, "popOutTimer", null);
    // What the pop-out was last sent from, null to send the next update whatever it holds
    __publicField(this, "popOutKey", null);
    // The node the pop-out shows and the graph it came from; its edits apply only there
    __publicField(this, "popOutNodeId", null);
    __publicField(this, "popOutGraph", null);
    // The node Sticky keeps, looked up again on each update like the locked one
    __publicField(this, "stickyNodeId", null);
    __publicField(this, "stickyGraph", null);
    this.magnifyGlass = magnifyGlass;
    this.stateManager = new StateManager();
    this.uiManager = new UIManager(this.stateManager);
    this.informationGatherer = new InformationGatherer();
    this.canvasHighlighter = new CanvasHighlighter(this.stateManager.state.settings);
    this.positionManager = new PositionManager(this.stateManager, this.uiManager.elements.panel);
    this.eventManager = new EventManager(this.stateManager, this.uiManager.elements.panel, {
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
    this.boundScheduleSelectionUpdate = () => {
      if (this.magnifyGlass.state.active && this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelFollowSelection"]) {
        this.scheduleInfoUpdate();
      }
    };
    document.addEventListener("pointerup", this.boundScheduleSelectionUpdate, true);
    document.addEventListener("keyup", this.boundScheduleSelectionUpdate, true);
    this.originalUpdateMagnifiedView = magnifyGlass.updateMagnifiedView;
    this.originalShow = magnifyGlass.ui.show;
    this.originalHide = magnifyGlass.ui.hide;
    this.hookIntoMagnifyGlass();
    const popOut = this.magnifyGlass.popOutManager;
    if (popOut) {
      popOut.onStateChange = (isOpen) => {
        this.uiManager.updateControlStates();
        this.setPopOutRefresh(isOpen);
      };
      popOut.onNodeSelect = (nodeId) => {
        this.uiManager.jumpToNode(nodeId);
      };
      popOut.onWidgetEdit = (data) => {
        var _a;
        if (this.uiManager.canEdit() && ((_a = this.popOutRow(data)) == null ? void 0 : _a.isEditable)) {
          WidgetSyncManager.syncWidgetValue(data.nodeId, data.widgetName, data.value);
        }
        this.refreshPopOut();
      };
      popOut.onButtonClick = (data) => {
        var _a;
        if ((_a = this.popOutRow(data)) == null ? void 0 : _a.isActionable) {
          WidgetSyncManager.clickButton(data.nodeId, data.widgetName);
        }
        this.refreshPopOut();
      };
      popOut.onRequestOptions = (data) => {
        var _a, _b;
        return ((_b = (_a = this.popOutRow(data)) == null ? void 0 : _a.constraints) == null ? void 0 : _b.options) ?? [];
      };
      popOut.onSearchNodes = (query) => this.uiManager.nodeSelector.search(query);
      popOut.onPanelAction = (name, nodeId) => {
        var _a;
        if (nodeId === this.popOutNodeId && ((_a = app.canvas) == null ? void 0 : _a.graph) === this.popOutGraph) {
          this.uiManager.runAction(name, nodeId);
        }
      };
      this.setPopOutRefresh(popOut.isPopOutOpen());
    }
    this.uiManager.onRefresh = () => this.updateInfo();
    Logger.debug("Info Panel initialized successfully");
  }
  hookIntoMagnifyGlass() {
    const mg = this.magnifyGlass;
    mg.updateMagnifiedView = () => {
      this.originalUpdateMagnifiedView.call(mg);
      if (mg.state.active) {
        this.scheduleInfoUpdate();
      }
    };
    mg.ui.show = () => {
      this.originalShow.call(mg.ui);
      if (!this.magnifyGlass.state.active) {
        return;
      }
      if (this.stateManager.state.wasPanelVisibleBeforeHide) {
        this.uiManager.show();
        setTimeout(() => {
          this.positionManager.positionPanel();
          this.positionManager.positionFloatingControls(this.uiManager.elements.controls);
        }, 10);
      } else {
        const showControls = this.stateManager.state.settings["🔍MagnifyGlass.ShowHoveringControls"] !== false;
        if (showControls && this.uiManager.elements.controls) {
          this.uiManager.elements.controls.style.display = "flex";
          this.uiManager.elements.controls.style.pointerEvents = "auto";
        }
        this.uiManager.updateControlStates();
        setTimeout(() => {
          this.positionManager.positionFloatingControls(this.uiManager.elements.controls);
        }, 10);
      }
    };
    mg.ui.hide = () => {
      this.stateManager.state.wasPanelVisibleBeforeHide = this.stateManager.state.isPanelVisible;
      this.originalHide.call(mg.ui);
      this.uiManager.hide();
      if (this.uiManager.elements.controls) {
        this.uiManager.elements.controls.style.display = "none";
        this.uiManager.elements.controls.style.pointerEvents = "none";
      }
      this.canvasHighlighter.setHighlightedNode(null);
    };
  }
  scheduleInfoUpdate() {
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
  cleanup() {
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
    document.removeEventListener("pointerup", this.boundScheduleSelectionUpdate, true);
    document.removeEventListener("keyup", this.boundScheduleSelectionUpdate, true);
    this.eventManager.cleanup();
    this.uiManager.cleanup();
    this.canvasHighlighter.cleanup();
  }
  /**
   * Follow the glass again from where it starts.
   */
  resetPosition() {
    if (!this.stateManager.state.isGlassPreviewVisible) return;
    this.stateManager.state.isFloating = false;
    this.stateManager.state.floatPosition = null;
    this.stateManager.saveLayout();
    this.positionManager.positionPanel();
    this.uiManager.updateControlStates();
  }
  /**
   * Update the info panel and the pop-out with the node to show.
   */
  updateInfo() {
    var _a, _b, _c, _d, _e;
    const settings = this.stateManager.state.settings;
    const isActive = this.magnifyGlass.state.active;
    const popOutOpen = !!((_a = this.magnifyGlass.popOutManager) == null ? void 0 : _a.isPopOutOpen());
    if (!isActive) {
      if (this.stateManager.state.isPanelVisible) this.uiManager.hide();
      if (this.uiManager.elements.controls && this.uiManager.elements.controls.style.display !== "none") {
        this.uiManager.elements.controls.style.display = "none";
      }
      this.canvasHighlighter.setHighlightedNode(null);
      if (!popOutOpen) return;
    }
    const hovered = isActive ? this.informationGatherer.getNodeUnderCursor() : null;
    let node = hovered ? this.informationGatherer.getDetailedNodeInfo(hovered) : null;
    let source = "hover";
    const state = this.stateManager.state;
    if (state.lockedNodeId !== null && state.lockedGraph !== ((_b = app.canvas) == null ? void 0 : _b.graph)) {
      state.lockedNodeId = null;
    }
    const lockedNode = state.lockedNodeId === null ? null : this.uiManager.nodeSelector.getNodeById(state.lockedNodeId);
    if (!lockedNode) {
      state.lockedNodeId = null;
    }
    const selectedNode = !lockedNode && settings["🔍MagnifyGlass.InfoPanelFollowSelection"] ? Object.values(((_c = app.canvas) == null ? void 0 : _c.selected_nodes) ?? {})[0] : void 0;
    state.showsSelection = !!selectedNode;
    const shownNode = lockedNode ?? selectedNode;
    if (shownNode) {
      node = this.informationGatherer.getDetailedNodeInfo(shownNode);
      source = lockedNode ? "locked" : "selection";
    }
    if (node) {
      this.stickyNodeId = node.id;
      this.stickyGraph = (_d = app.canvas) == null ? void 0 : _d.graph;
    } else if (settings["🔍MagnifyGlass.InfoPanelPersist"] && this.stickyNodeId !== null) {
      const stickyNode = this.stickyGraph === ((_e = app.canvas) == null ? void 0 : _e.graph) ? this.uiManager.nodeSelector.getNodeById(this.stickyNodeId) : null;
      if (stickyNode) {
        node = this.informationGatherer.getDetailedNodeInfo(stickyNode);
        source = "sticky";
      } else {
        this.stickyNodeId = null;
      }
    }
    state.currentNodeId = (node == null ? void 0 : node.id) ?? null;
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
  sendPopOutInfo(info, source) {
    var _a, _b;
    const nav = {
      source,
      locked: this.stateManager.state.lockedNodeId !== null,
      ...this.uiManager.getHistoryNav(),
      canEdit: this.uiManager.canEdit()
    };
    const key = [...this.uiManager.getRenderKey(info), ...Object.values(nav)];
    const sent = this.popOutKey;
    if (sent && key.length === sent.length && key.every((v, i) => Object.is(v, sent[i]))) return;
    this.popOutKey = key;
    this.popOutNodeId = ((_a = info.hoveredNode) == null ? void 0 : _a.id) ?? null;
    this.popOutGraph = (_b = app.canvas) == null ? void 0 : _b.graph;
    this.magnifyGlass.popOutManager.sendInfo(this.buildPopOutInfo(info.hoveredNode, nav));
  }
  /**
   * The pop-out payload: the node's identity and place, and its widget rows as plain data.
   */
  buildPopOutInfo(node, nav) {
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
      rows: getImportantNodeParameters(node).map((row) => {
        const { options, ...constraints } = row.constraints ?? {};
        const raw = row.rawValue;
        return {
          label: row.label,
          widgetName: row.widgetName,
          widgetType: row.widgetType,
          value: row.value,
          rawValue: raw === null || typeof raw === "string" || typeof raw === "number" || typeof raw === "boolean" ? raw : void 0,
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
  popOutRow({ nodeId, widgetName }) {
    var _a;
    if (nodeId !== this.popOutNodeId || ((_a = app.canvas) == null ? void 0 : _a.graph) !== this.popOutGraph) return void 0;
    const node = this.uiManager.nodeSelector.getNodeById(nodeId);
    return node ? getImportantNodeParameters(this.informationGatherer.getDetailedNodeInfo(node)).find((row) => row.widgetName === widgetName) : void 0;
  }
  /**
   * Send the pop-out its info now, even if nothing changed.
   */
  refreshPopOut() {
    this.popOutKey = null;
    this.updateInfo();
  }
  /**
   * Refresh the pop-out a few times a second while it is connected: values change after a run
   * or from another window without any input in this one.
   */
  setPopOutRefresh(connected) {
    if (this.popOutTimer !== null) {
      clearInterval(this.popOutTimer);
      this.popOutTimer = null;
    }
    if (!connected) return;
    this.popOutTimer = window.setInterval(() => this.updateInfo(), 250);
    this.refreshPopOut();
  }
}
function mountInfoPanel(magnifyGlass) {
  if (window.infoPanelManager) return;
  const infoPanel = new InfoPanel(magnifyGlass);
  window.infoPanelManager = infoPanel;
  (window.comfyUIMagnifyGlassExtensions ?? (window.comfyUIMagnifyGlassExtensions = [])).push(infoPanel);
  magnifyGlass.setGlassPreviewActive(true);
  if (magnifyGlass.state.active) {
    magnifyGlass.ui.show();
  }
}
function unmountInfoPanel(magnifyGlass) {
  var _a;
  const infoPanel = window.infoPanelManager;
  if (!infoPanel) return;
  infoPanel.cleanup();
  window.infoPanelManager = void 0;
  window.comfyUIMagnifyGlassExtensions = (_a = window.comfyUIMagnifyGlassExtensions) == null ? void 0 : _a.filter((ext) => ext !== infoPanel);
  magnifyGlass.setGlassPreviewActive(true);
}
export {
  InfoPanel,
  mountInfoPanel,
  unmountInfoPanel
};
