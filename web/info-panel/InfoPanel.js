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
    // State for persistence
    __publicField(this, "lastValidNodeInfo", null);
    this.magnifyGlass = magnifyGlass;
    this.stateManager = new StateManager();
    this.uiManager = new UIManager(this.stateManager);
    this.informationGatherer = new InformationGatherer();
    this.canvasHighlighter = new CanvasHighlighter();
    this.positionManager = new PositionManager(this.stateManager, this.uiManager.elements.panel);
    this.eventManager = new EventManager(this.stateManager, this.uiManager.elements.panel, this.positionManager, {
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
    if (this.magnifyGlass.popOutManager) {
      this.magnifyGlass.popOutManager.onStateChange = () => {
        this.uiManager.updateControlStates();
      };
      this.magnifyGlass.popOutManager.onNodeSelect = (nodeId) => {
        this.onNodeSelected(nodeId);
      };
      this.magnifyGlass.popOutManager.onWidgetEdit = () => {
        this.updateInfo(true);
      };
    }
    this.uiManager.onNodeSelected = (nodeId) => {
      this.onNodeSelected(nodeId);
    };
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
      if (this.uiManager.elements.panel) {
        this.uiManager.elements.panel.style.display = "none";
        this.uiManager.elements.panel.style.pointerEvents = "none";
        this.uiManager.elements.panel.style.opacity = "0";
      }
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
    this.eventManager.cleanup();
    this.uiManager.cleanup();
    this.canvasHighlighter.cleanup();
    this.stateManager.cleanup();
  }
  /**
   * Update the info panel with current information.
   * @param forceUpdate - If true, bypass the isInfoHeld check to force an update
   */
  updateInfo(forceUpdate = false) {
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
    if (this.stateManager.state.isInfoHeld && !forceUpdate) {
      this.positionManager.positionPanel();
      this.positionManager.positionFloatingControls(this.uiManager.elements.controls);
      return;
    }
    let info = this.informationGatherer.gatherInformation();
    const selectedNodeId = this.stateManager.state.selectedNodeId;
    if (selectedNodeId !== null && info.hoveredNode && info.hoveredNode.id !== selectedNodeId) {
      this.stateManager.clearSelectedNode();
    }
    const currentSelectedId = this.stateManager.state.selectedNodeId;
    if (currentSelectedId !== null) {
      const selectedNode = this.uiManager.nodeSelector.getNodeById(currentSelectedId);
      if (selectedNode) {
        const detailedInfo = this.informationGatherer.getDetailedNodeInfo(
          selectedNode,
          { x: 0, y: 0 }
          // No local position when manually selected
        );
        info = {
          ...info,
          hoveredNode: detailedInfo,
          hoveredWidget: null
        };
      }
    }
    if (info.hoveredNode) {
      this.lastValidNodeInfo = info;
    } else if (settings["🔍MagnifyGlass.InfoPanelPersist"] && this.lastValidNodeInfo) {
      info = {
        ...info,
        // Current timestamp, cursor, zoom
        hoveredNode: this.lastValidNodeInfo.hoveredNode,
        hoveredWidget: this.lastValidNodeInfo.hoveredWidget
      };
    }
    this.stateManager.setCurrentInfo(info);
    this.uiManager.displayInfo(info);
    this.canvasHighlighter.setHighlightedNode(info.hoveredNode ? info.hoveredNode.id : null);
    if (this.magnifyGlass.popOutManager && this.magnifyGlass.popOutManager.isPopOutOpen()) {
      this.magnifyGlass.popOutManager.sendInfo(info);
    }
    this.positionManager.positionPanel();
    this.positionManager.positionFloatingControls(this.uiManager.elements.controls);
    if (info.hoveredNode) {
      this.stateManager.state.isHoveringNode = true;
      this.stateManager.expandNodeSections();
      if (this.stateManager.state.lastNodeId !== info.hoveredNode.id) {
        this.stateManager.state.lastNodeId = info.hoveredNode.id;
      }
    } else {
      this.stateManager.state.isHoveringNode = false;
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
  onNodeSelected(nodeId) {
    Logger.debug(`Node selected from dropdown: ${nodeId}`);
    this.stateManager.setSelectedNode(nodeId);
    this.updateInfo(true);
  }
  /**
   * Clear the selected node, returning to hover-based detection.
   */
  clearSelectedNode() {
    this.stateManager.clearSelectedNode();
    this.updateInfo();
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
