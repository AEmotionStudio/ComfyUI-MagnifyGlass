var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { registerPanelSettings } from "../shared/settings.js";
import { StateManager } from "./StateManager.js";
import { UIManager } from "./UIManager.js";
import { PositionManager } from "./PositionManager.js";
import { EventManager } from "./EventManager.js";
import { InformationGatherer } from "./InformationGatherer.js";
class InfoPanel {
  constructor(magnifyGlass) {
    __publicField(this, "magnifyGlass");
    __publicField(this, "stateManager");
    __publicField(this, "uiManager");
    __publicField(this, "positionManager");
    __publicField(this, "eventManager");
    __publicField(this, "informationGatherer");
    this.magnifyGlass = magnifyGlass;
    this.stateManager = new StateManager();
    this.uiManager = new UIManager(this.stateManager);
    this.informationGatherer = new InformationGatherer();
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
    console.log("ComfyUI Magnify Info Panel Pro V2: Initialized successfully");
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
      if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"]) {
        this.uiManager.show();
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
  scheduleInfoUpdate() {
    if (this.stateManager.state.updateScheduled) return;
    this.stateManager.state.updateScheduled = true;
    requestAnimationFrame(() => {
      this.updateInfo();
      this.stateManager.state.updateScheduled = false;
    });
  }
  updateInfo() {
    if (!this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"] || !this.magnifyGlass.state.active) return;
    const info = this.informationGatherer.gatherInformation();
    this.stateManager.setCurrentInfo(info);
    this.uiManager.displayInfo(info);
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
      if (this.stateManager.state.lastNodeId !== null) {
        this.stateManager.state.lastNodeId = null;
        if (!this.stateManager.state.isPanelHovered) {
          this.stateManager.scheduleAutoCollapse();
        }
      }
    }
  }
  updateSettings() {
    this.stateManager.updateSettings();
    this.uiManager.applyStyles();
    if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"] && this.magnifyGlass.state.active) {
      this.uiManager.show();
    } else {
      this.uiManager.hide();
    }
  }
}
export {
  InfoPanel
};
//# sourceMappingURL=InfoPanel.js.map
