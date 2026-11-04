var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class PositionManager {
  constructor(stateManager, panelElement) {
    __publicField(this, "stateManager");
    __publicField(this, "panelElement");
    // Cache the calculated position to avoid getBoundingClientRect() and layout thrashing
    // This also ensures controls move in perfect sync with the panel, ignoring CSS transitions
    __publicField(this, "cachedPanelPosition", null);
    this.stateManager = stateManager;
    this.panelElement = panelElement;
  }
  positionPanel() {
    if (!this.panelElement) return;
    if (this.stateManager.state.isFloating) {
      this.applyFloatPosition();
      return;
    }
    this.calculateNormalPosition();
  }
  /**
   * Keep a floating panel where it was put, 4px inside the window. It starts floating where it last followed the glass.
   */
  applyFloatPosition() {
    const state = this.stateManager.state;
    if (!state.floatPosition) {
      this.calculateNormalPosition();
      if (this.cachedPanelPosition) {
        state.floatPosition = { x: this.cachedPanelPosition.x, y: this.cachedPanelPosition.y };
      }
      return;
    }
    const panelWidth = this.panelElement.offsetWidth || 300;
    const panelHeight = this.panelElement.offsetHeight || 400;
    const margin = 4;
    const boundedX = Math.max(margin, Math.min(state.floatPosition.x, window.innerWidth - panelWidth - margin));
    const boundedY = Math.max(margin, Math.min(state.floatPosition.y, window.innerHeight - panelHeight - margin));
    state.floatPosition = { x: boundedX, y: boundedY };
    this.panelElement.style.left = `${boundedX}px`;
    this.panelElement.style.top = `${boundedY}px`;
    this.cachedPanelPosition = { x: boundedX, y: boundedY, width: panelWidth, height: panelHeight };
  }
  calculateNormalPosition() {
    var _a, _b, _c;
    const magnifyGlass = window.comfyUIMagnifyGlass;
    if (!magnifyGlass || !this.panelElement) return;
    const settings = this.stateManager.state.settings;
    const panelWidth = Number(settings["🔍MagnifyGlass.InfoPanelWidth"]) || 300;
    const panelHeight = this.panelElement.offsetHeight || 400;
    let left;
    let top;
    const margin = 4;
    const glassRect = (_a = magnifyGlass.ui.glassDiv) == null ? void 0 : _a.getBoundingClientRect();
    const hasValidGlassRect = glassRect && (glassRect.right > 0 || glassRect.top > 0);
    const mouseX = ((_b = magnifyGlass.lastKnownMousePosition) == null ? void 0 : _b.x) || 0;
    const mouseY = ((_c = magnifyGlass.lastKnownMousePosition) == null ? void 0 : _c.y) || 0;
    const hasValidMousePosition = mouseX > 0 || mouseY > 0;
    if (!this.stateManager.state.isGlassPreviewVisible) {
      if (hasValidMousePosition) {
        left = mouseX - panelWidth / 2;
        top = mouseY - 20;
      } else {
        left = window.innerWidth - panelWidth - 50;
        top = 100;
      }
    } else if (hasValidGlassRect) {
      const position = settings["🔍MagnifyGlass.InfoPanelPosition"];
      switch (position) {
        case "Right":
          left = glassRect.right + margin;
          top = glassRect.top;
          break;
        case "Left":
          left = glassRect.left - panelWidth - margin;
          top = glassRect.top;
          break;
        case "Top":
          left = glassRect.left;
          top = glassRect.top - panelHeight - margin;
          break;
        case "Bottom":
          left = glassRect.left;
          top = glassRect.bottom + margin;
          break;
        default:
          left = glassRect.right + margin;
          top = glassRect.top;
          break;
      }
    } else if (hasValidMousePosition) {
      left = mouseX - panelWidth / 2;
      top = mouseY - 20;
    } else {
      left = window.innerWidth - panelWidth - 50;
      top = 100;
    }
    left = Math.max(4, Math.min(left, window.innerWidth - panelWidth - 4));
    top = Math.max(4, Math.min(top, window.innerHeight - panelHeight - 4));
    this.panelElement.style.left = `${left}px`;
    this.panelElement.style.top = `${top}px`;
    this.cachedPanelPosition = { x: left, y: top, width: panelWidth, height: panelHeight };
  }
  /**
   * Position the floating controls relative to the panel.
   */
  positionFloatingControls(controlsElement) {
    if (!controlsElement) return;
    const settings = this.stateManager.state.settings;
    if (settings["🔍MagnifyGlass.ShowHoveringControls"] === false) {
      controlsElement.style.display = "none";
      return;
    }
    const magnifyGlass = window.comfyUIMagnifyGlass;
    if (magnifyGlass && !magnifyGlass.state.active) {
      controlsElement.style.display = "none";
      return;
    }
    const isPanelVisible = this.stateManager.state.isPanelVisible;
    let referenceRect = null;
    if (isPanelVisible && this.panelElement) {
      if (this.cachedPanelPosition) {
        referenceRect = {
          left: this.cachedPanelPosition.x,
          top: this.cachedPanelPosition.y,
          right: this.cachedPanelPosition.x + this.cachedPanelPosition.width,
          bottom: this.cachedPanelPosition.y + this.cachedPanelPosition.height,
          width: this.cachedPanelPosition.width,
          height: this.cachedPanelPosition.height
        };
      } else {
        referenceRect = this.panelElement.getBoundingClientRect();
      }
    } else if (magnifyGlass && magnifyGlass.ui && magnifyGlass.ui.glassDiv) {
      referenceRect = magnifyGlass.ui.glassDiv.getBoundingClientRect();
      if (referenceRect.width === 0 || referenceRect.height === 0) {
        controlsElement.style.display = "none";
        return;
      }
    }
    if (!referenceRect) return;
    controlsElement.style.transition = "none";
    const [side, edge] = String(this.stateManager.state.settings["🔍MagnifyGlass.ControlsPosition"] || "left").split("-");
    const width = controlsElement.offsetWidth;
    const height = controlsElement.offsetHeight;
    const margin = 4;
    let left;
    let top;
    if (side === "top" || side === "bottom") {
      const above = referenceRect.top - height - margin;
      const below = referenceRect.bottom + margin;
      top = side === "top" ? above >= margin ? above : below : below + height <= window.innerHeight - margin ? below : above;
      left = edge === "right" ? referenceRect.right - width : referenceRect.left;
    } else {
      const before = referenceRect.left - width - margin;
      const after = referenceRect.right + margin;
      left = side === "left" ? before >= margin ? before : after : after + width <= window.innerWidth - margin ? after : before;
      top = referenceRect.top;
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
    controlsElement.style.left = `${left}px`;
    controlsElement.style.top = `${top}px`;
    controlsElement.style.display = "flex";
    controlsElement.style.visibility = "visible";
    controlsElement.style.pointerEvents = "auto";
  }
}
export {
  PositionManager
};
