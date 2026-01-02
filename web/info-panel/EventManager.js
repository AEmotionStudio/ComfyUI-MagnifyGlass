var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { isUserTyping } from "../shared/utils.js";
import { Logger } from "../shared/logger.js";
class EventManager {
  constructor(stateManager, panelElement, positionManager, callbacks) {
    __publicField(this, "stateManager");
    __publicField(this, "panelElement");
    __publicField(this, "positionManager");
    __publicField(this, "callbacks");
    __publicField(this, "dragCleanup");
    __publicField(this, "boundHandleMouseMove");
    __publicField(this, "boundHandleKeyDown");
    __publicField(this, "boundHandleKeyUp");
    this.stateManager = stateManager;
    this.panelElement = panelElement;
    this.positionManager = positionManager;
    this.callbacks = callbacks || null;
    this.dragCleanup = null;
    this.boundHandleMouseMove = this.handleMouseMove.bind(this);
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.boundHandleKeyUp = this.handleKeyUp.bind(this);
    this.setupEventListeners();
  }
  setupEventListeners() {
    this.setupPanelEvents();
    this.setupHotkeyEvents();
    this.setupDragEvents();
    this.setupHoverEvents();
  }
  setupPanelEvents() {
    if (!this.panelElement) return;
  }
  setupHotkeyEvents() {
    document.addEventListener("keydown", this.boundHandleKeyDown);
  }
  setupDragEvents() {
    if (!this.panelElement) return;
    let isDragging = false;
    let rafId = null;
    let targetX = 0;
    let targetY = 0;
    const startDrag = (e) => {
      if (!this.panelElement) return;
      const target = e.target;
      const header = target.closest(".panel-header");
      if (!header) return;
      if (target.closest("button")) return;
      if (this.stateManager.state.isPanelLocked) return;
      if (!this.stateManager.state.isPanelPinned) return;
      e.preventDefault();
      e.stopPropagation();
      isDragging = true;
      const startX = e.clientX;
      const startY = e.clientY;
      const rect = this.panelElement.getBoundingClientRect();
      const startLeft = rect.left;
      const startTop = rect.top;
      this.panelElement.style.cursor = "grabbing";
      this.panelElement.style.opacity = "0.9";
      this.panelElement.style.transition = "none";
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
      const onMouseMove = (moveEvent) => {
        var _a, _b;
        if (!isDragging) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        targetX = startLeft + dx;
        targetY = startTop + dy;
        const panelWidth = ((_a = this.panelElement) == null ? void 0 : _a.offsetWidth) || 0;
        const panelHeight = ((_b = this.panelElement) == null ? void 0 : _b.offsetHeight) || 0;
        targetX = Math.max(0, Math.min(targetX, window.innerWidth - panelWidth));
        targetY = Math.max(0, Math.min(targetY, window.innerHeight - panelHeight));
        if (rafId === null) {
          rafId = requestAnimationFrame(() => {
            if (this.panelElement && isDragging) {
              this.panelElement.style.left = `${targetX}px`;
              this.panelElement.style.top = `${targetY}px`;
            }
            rafId = null;
          });
        }
      };
      const onMouseUp = () => {
        isDragging = false;
        if (rafId !== null) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        if (this.panelElement) {
          this.panelElement.style.cursor = "";
          this.panelElement.style.opacity = "";
          this.panelElement.style.transition = "";
          this.panelElement.style.left = `${targetX}px`;
          this.panelElement.style.top = `${targetY}px`;
          this.stateManager.state.pinnedPosition = { x: targetX, y: targetY };
        }
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    };
    this.panelElement.addEventListener("mousedown", startDrag);
    this.dragCleanup = () => {
      if (this.panelElement) this.panelElement.removeEventListener("mousedown", startDrag);
    };
  }
  setupHoverEvents() {
    if (!this.panelElement) return;
    this.panelElement.addEventListener("mouseenter", () => {
      this.stateManager.state.isPanelHovered = true;
      this.stateManager.clearAutoExpandTimer();
    });
    this.panelElement.addEventListener("mouseleave", () => {
      this.stateManager.state.isPanelHovered = false;
      if (!this.stateManager.state.isHoveringNode) {
        this.stateManager.scheduleAutoCollapse();
      }
    });
  }
  handleKeyDown(e) {
    var _a, _b;
    if (isUserTyping()) return;
    const settings = this.stateManager.state.settings;
    const key = e.key.toLowerCase();
    if (key === settings["🔍MagnifyGlass.ToggleHotkey"].toLowerCase()) {
      Logger.debug("Toggle visibility hotkey matched!");
      e.preventDefault();
      (_a = this.callbacks) == null ? void 0 : _a.toggleVisibility();
    }
    if (key === settings["🔍MagnifyGlass.PinPanelHotkey"].toLowerCase()) {
      e.preventDefault();
      (_b = this.callbacks) == null ? void 0 : _b.togglePin();
    }
  }
  handleMouseMove(e) {
  }
  handleKeyUp(e) {
  }
  cleanup() {
    document.removeEventListener("keydown", this.boundHandleKeyDown);
    if (this.dragCleanup) this.dragCleanup();
  }
}
export {
  EventManager
};
//# sourceMappingURL=EventManager.js.map
