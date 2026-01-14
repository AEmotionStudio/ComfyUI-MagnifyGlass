var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import "/scripts/app.js";
import { registerPanelSettings } from "../shared/settings/panelSettings.js";
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
    this.hookIntoMagnifyGlass();
    registerPanelSettings(this.stateManager, this.uiManager, this.positionManager);
    if (this.magnifyGlass.popOutManager) {
      this.magnifyGlass.popOutManager.onStateChange = (isOpen) => {
        this.uiManager.updateControlStates();
      };
      this.magnifyGlass.popOutManager.onNodeSelect = (nodeId) => {
        this.onNodeSelected(nodeId);
      };
    }
    this.uiManager.onNodeSelected = (nodeId) => {
      this.onNodeSelected(nodeId);
    };
    Logger.info("Info Panel initialized successfully");
  }
  hookIntoMagnifyGlass() {
    const originalUpdateMagnifiedView = this.magnifyGlass.updateMagnifiedView.bind(this.magnifyGlass);
    this.magnifyGlass.updateMagnifiedView = (() => {
      originalUpdateMagnifiedView();
      if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"] && this.magnifyGlass.state.active) {
        this.scheduleInfoUpdate();
      }
    }).bind(this);
    const originalShow = this.magnifyGlass.ui.show.bind(this.magnifyGlass.ui);
    const originalHide = this.magnifyGlass.ui.hide.bind(this.magnifyGlass.ui);
    this.magnifyGlass.ui.show = (() => {
      originalShow();
      if (!this.magnifyGlass.state.active) {
        return;
      }
      if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"]) {
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
          }
          this.uiManager.updateControlStates();
          setTimeout(() => {
            this.positionManager.positionFloatingControls(this.uiManager.elements.controls);
          }, 10);
        }
      }
    }).bind(this);
    this.magnifyGlass.ui.hide = (() => {
      this.stateManager.state.wasPanelVisibleBeforeHide = this.stateManager.state.isPanelVisible;
      originalHide();
      this.uiManager.hide();
      if (this.uiManager.elements.panel) {
        this.uiManager.elements.panel.style.display = "none";
      }
      if (this.uiManager.elements.controls) {
        this.uiManager.elements.controls.style.display = "none";
      }
      this.canvasHighlighter.setHighlightedNode(null);
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
  /**
   * Update the info panel with current information.
   * @param forceUpdate - If true, bypass the isInfoHeld check to force an update
   */
  updateInfo(forceUpdate = false) {
    const settings = this.stateManager.state.settings;
    const isActive = this.magnifyGlass.state.active;
    if (!settings["🔍MagnifyGlass.InfoPanelEnabled"] || !isActive) {
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
    if (selectedNodeId !== null) {
      const selectedNode = this.uiManager.nodeSelector.getNodeById(selectedNodeId);
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
  updateSettings() {
    this.stateManager.updateSettings();
    this.uiManager.applyStyles();
    if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"] && this.magnifyGlass.state.active) {
      this.uiManager.show();
      this.positionManager.positionPanel();
    } else {
      this.uiManager.hide();
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
export {
  InfoPanel
};
//# sourceMappingURL=InfoPanel.js.map
