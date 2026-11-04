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
    if (this.magnifyGlass.popOutManager) {
      this.magnifyGlass.popOutManager.onStateChange = () => {
        this.uiManager.updateControlStates();
      };
      this.magnifyGlass.popOutManager.onNodeSelect = (nodeId) => {
        this.uiManager.jumpToNode(nodeId);
      };
      this.magnifyGlass.popOutManager.onWidgetEdit = () => {
        this.updateInfo();
      };
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
    }
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
   * Update the info panel with current information.
   */
  updateInfo() {
    var _a, _b, _c, _d, _e;
    const settings = this.stateManager.state.settings;
    const isActive = this.magnifyGlass.state.active;
    if (!isActive) {
      this.uiManager.hide();
      if (this.uiManager.elements.controls && this.uiManager.elements.controls.style.display !== "none") {
        this.uiManager.elements.controls.style.display = "none";
      }
      this.canvasHighlighter.setHighlightedNode(null);
      return;
    }
    let info = this.informationGatherer.gatherInformation();
    const state = this.stateManager.state;
    if (state.lockedNodeId !== null && state.lockedGraph !== ((_a = app.canvas) == null ? void 0 : _a.graph)) {
      state.lockedNodeId = null;
    }
    const lockedNode = state.lockedNodeId === null ? null : this.uiManager.nodeSelector.getNodeById(state.lockedNodeId);
    if (!lockedNode) {
      state.lockedNodeId = null;
    }
    const selectedNode = !lockedNode && settings["🔍MagnifyGlass.InfoPanelFollowSelection"] ? Object.values(((_b = app.canvas) == null ? void 0 : _b.selected_nodes) ?? {})[0] : void 0;
    state.showsSelection = !!selectedNode;
    const shownNode = lockedNode ?? selectedNode;
    if (shownNode) {
      info = { ...info, hoveredNode: this.informationGatherer.getDetailedNodeInfo(shownNode) };
    }
    if (info.hoveredNode) {
      this.stickyNodeId = info.hoveredNode.id;
      this.stickyGraph = (_c = app.canvas) == null ? void 0 : _c.graph;
    } else if (settings["🔍MagnifyGlass.InfoPanelPersist"] && this.stickyNodeId !== null) {
      const stickyNode = this.stickyGraph === ((_d = app.canvas) == null ? void 0 : _d.graph) ? this.uiManager.nodeSelector.getNodeById(this.stickyNodeId) : null;
      if (stickyNode) {
        info = { ...info, hoveredNode: this.informationGatherer.getDetailedNodeInfo(stickyNode) };
      } else {
        this.stickyNodeId = null;
      }
    }
    state.currentNodeId = ((_e = info.hoveredNode) == null ? void 0 : _e.id) ?? null;
    this.uiManager.displayInfo(info);
    this.canvasHighlighter.setHighlightedNode(info.hoveredNode ? info.hoveredNode.id : null);
    if (this.magnifyGlass.popOutManager && this.magnifyGlass.popOutManager.isPopOutOpen()) {
      this.magnifyGlass.popOutManager.sendInfo(info);
    }
    this.positionManager.positionPanel();
    this.positionManager.positionFloatingControls(this.uiManager.elements.controls);
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
