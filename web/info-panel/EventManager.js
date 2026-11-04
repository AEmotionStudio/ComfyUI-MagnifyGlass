var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { isUserTyping, getSettingValue, clamp, setSettingValue } from "../shared/utils.js";
import { DEFAULT_GLASS_SETTINGS, DEFAULT_PANEL_SETTINGS } from "../shared/settings/defaults.js";
class EventManager {
  constructor(stateManager, panelElement, callbacks) {
    __publicField(this, "stateManager");
    __publicField(this, "panelElement");
    __publicField(this, "callbacks");
    __publicField(this, "dragCleanup");
    __publicField(this, "boundHandleKeyDown");
    this.stateManager = stateManager;
    this.panelElement = panelElement;
    this.callbacks = callbacks || null;
    this.dragCleanup = null;
    this.boundHandleKeyDown = this.handleKeyDown.bind(this);
    this.setupEventListeners();
  }
  setupEventListeners() {
    this.setupHotkeyEvents();
    this.setupDragEvents();
    this.setupHoverEvents();
  }
  setupHotkeyEvents() {
    document.addEventListener("keydown", this.boundHandleKeyDown);
  }
  /**
   * Dragging the header floats the panel; the corner handle resizes it into the Width and Max Height settings.
   * A press that does not move is a click, so it leaves the panel where it is.
   */
  setupDragEvents() {
    const panel = this.panelElement;
    if (!panel) return;
    const startDrag = (e) => {
      const target = e.target;
      const resizing = !!target.closest(".panel-resize");
      if (e.button !== 0 || !resizing && (!target.closest(".panel-header") || target.closest("button"))) return;
      e.preventDefault();
      const state = this.stateManager.state;
      const settings = state.settings;
      const startX = e.clientX;
      const startY = e.clientY;
      const rect = panel.getBoundingClientRect();
      const content = panel.querySelector(".panel-content");
      const startContentHeight = content.offsetHeight;
      const capped = content.scrollHeight > startContentHeight;
      const startWidth = settings["🔍MagnifyGlass.InfoPanelWidth"];
      const startMaxHeight = settings["🔍MagnifyGlass.InfoPanelMaxHeight"];
      let moved = false;
      const onPointerMove = (move) => {
        var _a;
        const dx = move.clientX - startX;
        const dy = move.clientY - startY;
        if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
        moved = true;
        if (resizing) {
          settings["🔍MagnifyGlass.InfoPanelWidth"] = Math.abs(dx) >= 3 ? clamp(Math.round(rect.width + dx), 200, 600) : startWidth;
          settings["🔍MagnifyGlass.InfoPanelMaxHeight"] = capped && Math.abs(dy) >= 3 ? clamp(Math.round(startContentHeight + dy), 200, 1500) : startMaxHeight;
        } else {
          state.isFloating = true;
          state.floatPosition = { x: rect.left + dx, y: rect.top + dy };
        }
        (_a = this.callbacks) == null ? void 0 : _a.updateLayout();
      };
      const onPointerUp = () => {
        document.removeEventListener("pointermove", onPointerMove);
        document.removeEventListener("pointerup", onPointerUp);
        document.removeEventListener("pointercancel", onPointerUp);
        panel.classList.remove("is-dragging");
        if (!moved) return;
        if (resizing) {
          for (const [id, start] of [["🔍MagnifyGlass.InfoPanelWidth", startWidth], ["🔍MagnifyGlass.InfoPanelMaxHeight", startMaxHeight]]) {
            if (settings[id] !== start) setSettingValue(id, settings[id]);
          }
        } else {
          this.stateManager.saveLayout();
        }
      };
      panel.classList.add("is-dragging");
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
      document.addEventListener("pointercancel", onPointerUp);
    };
    panel.addEventListener("pointerdown", startDrag);
    this.dragCleanup = () => panel.removeEventListener("pointerdown", startDrag);
  }
  setupHoverEvents() {
    if (!this.panelElement) return;
    this.panelElement.addEventListener("mouseenter", () => {
      this.stateManager.state.isPanelHovered = true;
    });
    this.panelElement.addEventListener("mouseleave", () => {
      this.stateManager.state.isPanelHovered = false;
    });
  }
  /**
   * Panel hotkeys act only while the glass is active and never with Ctrl, Meta or Shift held. Alt must be
   * held when AltRequired is on and must not be otherwise. Keys are read on each press, so changes apply at once.
   */
  handleKeyDown(e) {
    var _a;
    if (isUserTyping() || !((_a = this.callbacks) == null ? void 0 : _a.isGlassActive())) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) return;
    const altRequired = getSettingValue("🔍MagnifyGlass.AltRequired", DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.AltRequired"]);
    if (e.altKey !== altRequired) return;
    const key = e.key.toLowerCase();
    const hotkey = (id) => String(getSettingValue(id, DEFAULT_PANEL_SETTINGS[id])).toLowerCase();
    if (key === hotkey("🔍MagnifyGlass.ToggleHotkey")) {
      e.preventDefault();
      this.callbacks.toggleVisibility();
    }
    if (key === hotkey("🔍MagnifyGlass.PinPanelHotkey")) {
      e.preventDefault();
      this.callbacks.toggleFloat();
    }
    if (key === hotkey("🔍MagnifyGlass.StickyInfoHotkey")) {
      e.preventDefault();
      this.callbacks.toggleSticky();
    }
  }
  cleanup() {
    document.removeEventListener("keydown", this.boundHandleKeyDown);
    if (this.dragCleanup) this.dragCleanup();
  }
}
export {
  EventManager
};
