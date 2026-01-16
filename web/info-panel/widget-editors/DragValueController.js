var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { WidgetSyncManager } from "./WidgetSyncManager.js";
import { Logger } from "../../shared/logger.js";
const DRAG_SENSITIVITY = {
  // Pixels per unit change for integers
  intPixelsPerUnit: 8,
  // Pixels per 0.1 change for floats
  floatPixelsPerTenth: 10,
  // Minimum pixels to trigger option cycle for combos
  comboThreshold: 40
};
class DragValueController {
  constructor(element, config) {
    __publicField(this, "element");
    __publicField(this, "config");
    __publicField(this, "isDragging", false);
    __publicField(this, "startX", 0);
    __publicField(this, "startValue", 0);
    __publicField(this, "startOptionIndex", 0);
    __publicField(this, "accumulatedDelta", 0);
    // Bound event handlers for cleanup
    __publicField(this, "boundPointerMove");
    __publicField(this, "boundPointerUp");
    this.element = element;
    this.config = config;
    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);
    this.init();
  }
  /**
   * Initialize drag handling
   */
  init() {
    this.element.classList.add("draggable");
    this.element.addEventListener("pointerdown", this.onPointerDown.bind(this));
  }
  /**
   * Add visual drag indicator to the row
   */
  addDragIndicator() {
    if (this.element.querySelector(".drag-indicator")) return;
    const indicator = document.createElement("span");
    indicator.className = "drag-indicator";
    indicator.innerHTML = "⟷";
    indicator.setAttribute("aria-hidden", "true");
    this.element.appendChild(indicator);
  }
  /**
   * Handle pointer down - start drag tracking
   */
  onPointerDown(e) {
    var _a;
    if (e.button !== 0) return;
    const target = e.target;
    if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "BUTTON" || target.closest(".inline-control") || target.closest(".inline-control-container") || target.closest(".info-value") || target.closest(".widget-editor") || target.closest(".widget-editor-container") || target.closest(".widget-editor-stepper") || target.closest(".widget-editor-number") || target.closest(".widget-editor-input")) {
      return;
    }
    this.isDragging = true;
    this.startX = e.clientX;
    this.accumulatedDelta = 0;
    const type = this.config.widgetType.toLowerCase();
    if (type === "number" || type === "int" || type === "float" || type === "slider") {
      this.startValue = Number(this.config.currentValue) || 0;
    } else if (type === "combo") {
      const options = ((_a = this.config.constraints) == null ? void 0 : _a.options) ?? [];
      const currentStr = String(this.config.currentValue);
      this.startOptionIndex = options.findIndex((opt) => String(opt) === currentStr);
      if (this.startOptionIndex === -1) this.startOptionIndex = 0;
    }
    this.element.classList.add("dragging");
    this.element.setPointerCapture(e.pointerId);
    document.addEventListener("pointermove", this.boundPointerMove);
    document.addEventListener("pointerup", this.boundPointerUp);
    e.preventDefault();
    Logger.debug(`[DragValue] Started drag on ${this.config.widgetName}`);
  }
  /**
   * Handle pointer move - update value based on drag distance
   */
  onPointerMove(e) {
    if (!this.isDragging) return;
    const deltaX = e.clientX - this.startX;
    const type = this.config.widgetType.toLowerCase();
    if (type === "number" || type === "int" || type === "float" || type === "slider") {
      this.handleNumberDrag(deltaX);
    } else if (type === "combo") {
      this.handleComboDrag(deltaX);
    }
  }
  /**
   * Handle number value drag
   */
  handleNumberDrag(deltaX) {
    var _a, _b;
    const constraints = this.config.constraints;
    const isInt = this.config.widgetType.toLowerCase() === "int";
    let sensitivity;
    if (isInt) {
      sensitivity = DRAG_SENSITIVITY.intPixelsPerUnit;
    } else {
      const step2 = (constraints == null ? void 0 : constraints.step) ?? 0.1;
      sensitivity = DRAG_SENSITIVITY.floatPixelsPerTenth / (step2 / 0.1);
    }
    const units = deltaX / sensitivity;
    const step = (constraints == null ? void 0 : constraints.step) ?? (isInt ? 1 : 0.1);
    let newValue = this.startValue + units * step;
    if ((constraints == null ? void 0 : constraints.min) !== void 0) {
      newValue = Math.max(constraints.min, newValue);
    }
    if ((constraints == null ? void 0 : constraints.max) !== void 0) {
      newValue = Math.min(constraints.max, newValue);
    }
    if (step) {
      newValue = Math.round(newValue / step) * step;
    }
    if (isInt) {
      newValue = Math.round(newValue);
    } else {
      const precision = (constraints == null ? void 0 : constraints.precision) ?? 2;
      newValue = Number(newValue.toFixed(precision));
    }
    WidgetSyncManager.syncWidgetValue(this.config.nodeId, this.config.widgetName, newValue);
    this.config.currentValue = newValue;
    (_b = (_a = this.config).onChange) == null ? void 0 : _b.call(_a, newValue);
  }
  /**
   * Handle combo value drag - cycle through options
   */
  handleComboDrag(deltaX) {
    var _a, _b, _c;
    const options = ((_a = this.config.constraints) == null ? void 0 : _a.options) ?? [];
    if (options.length === 0) return;
    this.accumulatedDelta = deltaX;
    const optionDelta = Math.floor(Math.abs(this.accumulatedDelta) / DRAG_SENSITIVITY.comboThreshold);
    if (optionDelta > 0) {
      const direction = deltaX > 0 ? 1 : -1;
      let newIndex = this.startOptionIndex + optionDelta * direction;
      newIndex = (newIndex % options.length + options.length) % options.length;
      const newValue = options[newIndex];
      WidgetSyncManager.syncWidgetValue(this.config.nodeId, this.config.widgetName, newValue);
      this.config.currentValue = newValue;
      (_c = (_b = this.config).onChange) == null ? void 0 : _c.call(_b, newValue);
    }
  }
  /**
   * Handle pointer up - end drag
   */
  onPointerUp(e) {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.element.classList.remove("dragging");
    try {
      this.element.releasePointerCapture(e.pointerId);
    } catch {
    }
    document.removeEventListener("pointermove", this.boundPointerMove);
    document.removeEventListener("pointerup", this.boundPointerUp);
    Logger.debug(`[DragValue] Ended drag on ${this.config.widgetName}`);
  }
  /**
   * Update the current value (call when value changes externally)
   */
  updateValue(value) {
    this.config.currentValue = value;
  }
  /**
   * Cleanup and remove drag handling
   */
  destroy() {
    this.element.classList.remove("draggable", "dragging");
    const indicator = this.element.querySelector(".drag-indicator");
    if (indicator) {
      indicator.remove();
    }
    document.removeEventListener("pointermove", this.boundPointerMove);
    document.removeEventListener("pointerup", this.boundPointerUp);
  }
  /**
   * Check if a widget type supports drag editing
   */
  static isTypeSupported(widgetType) {
    const type = widgetType.toLowerCase();
    return [
      "number",
      "int",
      "float",
      "slider",
      "combo"
    ].includes(type);
  }
}
export {
  DragValueController
};
//# sourceMappingURL=DragValueController.js.map
