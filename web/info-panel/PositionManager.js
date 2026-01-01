var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class PositionManager {
  constructor(stateManager, panelElement) {
    __publicField(this, "stateManager");
    __publicField(this, "panelElement");
    this.stateManager = stateManager;
    this.panelElement = panelElement;
  }
  positionPanel() {
    if (!this.panelElement) return;
    if (this.stateManager.state.isPanelPinned) {
      this.applyPinnedPosition();
      return;
    }
    this.calculateNormalPosition();
  }
  applyPinnedPosition() {
    if (!this.panelElement) return;
    let { x, y } = this.stateManager.state.pinnedPosition;
    if (x === 0 && y === 0) {
      this.calculateNormalPosition();
      if (this.panelElement) {
        const rect = this.panelElement.getBoundingClientRect();
        this.stateManager.state.pinnedPosition = { x: rect.left, y: rect.top };
      }
      return;
    }
    const panelWidth = this.panelElement.offsetWidth || 300;
    const panelHeight = this.panelElement.offsetHeight || 400;
    const margin = 10;
    const boundedX = Math.max(margin, Math.min(x, window.innerWidth - panelWidth - margin));
    const boundedY = Math.max(margin, Math.min(y, window.innerHeight - panelHeight - margin));
    this.panelElement.style.left = `${boundedX}px`;
    this.panelElement.style.top = `${boundedY}px`;
  }
  calculateNormalPosition() {
    var _a, _b, _c;
    const magnifyGlass = window.comfyUIMagnifyGlass;
    if (!magnifyGlass || !this.panelElement) return;
    const settings = this.stateManager.state.settings;
    const panelWidth = settings["🔍MagnifyGlass.InfoPanelWidth"] || 300;
    const panelHeight = this.panelElement.offsetHeight || 400;
    let left;
    let top;
    const margin = 15;
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
    left = Math.max(10, Math.min(left, window.innerWidth - panelWidth - 10));
    top = Math.max(10, Math.min(top, window.innerHeight - panelHeight - 10));
    this.panelElement.style.left = `${left}px`;
    this.panelElement.style.top = `${top}px`;
  }
  /**
   * Position the floating controls relative to the panel.
   */
  positionFloatingControls(controlsElement) {
    if (!controlsElement || !this.panelElement) return;
    const panelRect = this.panelElement.getBoundingClientRect();
    const controlsPosition = this.stateManager.state.settings["🔍MagnifyGlass.ControlsPosition"] || "right";
    const margin = 8;
    let left;
    let top;
    switch (controlsPosition) {
      case "left":
        left = panelRect.left - controlsElement.offsetWidth - margin;
        top = panelRect.top;
        break;
      case "right":
        left = panelRect.right + margin;
        top = panelRect.top;
        break;
      case "top":
        left = panelRect.left;
        top = panelRect.top - controlsElement.offsetHeight - margin;
        break;
      case "bottom":
        left = panelRect.left;
        top = panelRect.bottom + margin;
        break;
      case "top-right":
        left = panelRect.right - controlsElement.offsetWidth;
        top = panelRect.top - controlsElement.offsetHeight - margin;
        break;
      default:
        left = panelRect.right + margin;
        top = panelRect.top;
    }
    left = Math.max(10, Math.min(left, window.innerWidth - controlsElement.offsetWidth - 10));
    top = Math.max(10, Math.min(top, window.innerHeight - controlsElement.offsetHeight - 10));
    controlsElement.style.left = `${left}px`;
    controlsElement.style.top = `${top}px`;
    controlsElement.style.display = "flex";
    controlsElement.style.visibility = "visible";
  }
}
export {
  PositionManager
};
//# sourceMappingURL=PositionManager.js.map
