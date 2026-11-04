var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { WidgetSyncManager } from "./WidgetSyncManager.js";
import { Logger } from "../../shared/logger.js";
const PIXELS_PER_STEP = 10;
class DragValueController {
  constructor(element, config) {
    __publicField(this, "element");
    __publicField(this, "config");
    __publicField(this, "isDragging", false);
    __publicField(this, "value", null);
    __publicField(this, "startX", 0);
    __publicField(this, "startValue", 0);
    __publicField(this, "startStep", 0);
    // Bound event handlers for cleanup
    __publicField(this, "boundPointerDown");
    __publicField(this, "boundPointerMove");
    __publicField(this, "boundPointerUp");
    __publicField(this, "boundPointerCancel");
    __publicField(this, "boundLostCapture");
    this.element = element;
    this.config = config;
    this.boundPointerDown = this.onPointerDown.bind(this);
    this.boundPointerMove = this.onPointerMove.bind(this);
    this.boundPointerUp = this.onPointerUp.bind(this);
    this.boundPointerCancel = this.onPointerCancel.bind(this);
    this.boundLostCapture = this.onLostCapture.bind(this);
    this.init();
  }
  /**
   * Initialize drag handling
   */
  init() {
    this.element.classList.add("draggable");
    this.element.addEventListener("pointerdown", this.boundPointerDown);
  }
  /**
   * Handle pointer down - start drag tracking
   */
  onPointerDown(e) {
    if (e.button !== 0) return;
    const target = e.target;
    if (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "BUTTON" || target.closest(".inline-control") || target.closest(".inline-control-container") || target.closest(".info-value") || target.closest(".widget-editor") || target.closest(".widget-editor-container") || target.closest(".widget-editor-stepper") || target.closest(".widget-editor-number") || target.closest(".widget-editor-input")) {
      return;
    }
    this.isDragging = true;
    this.startX = e.clientX;
    this.value = WidgetSyncManager.getWidgetValue(this.config.nodeId, this.config.widgetName);
    this.startValue = Number(this.value) || 0;
    this.startStep = WidgetSyncManager.getStep(this.config.constraints, e);
    this.element.classList.add("dragging");
    this.element.setPointerCapture(e.pointerId);
    document.addEventListener("pointermove", this.boundPointerMove, true);
    document.addEventListener("pointerup", this.boundPointerUp, true);
    document.addEventListener("pointercancel", this.boundPointerCancel, true);
    this.element.addEventListener("lostpointercapture", this.boundLostCapture);
    e.preventDefault();
    e.stopPropagation();
    Logger.debug(`[DragValue] Started drag on ${this.config.widgetName}`);
  }
  /**
   * Handle pointer move - update value based on drag distance
   */
  onPointerMove(e) {
    if (!this.isDragging) return;
    e.preventDefault();
    e.stopPropagation();
    const step = WidgetSyncManager.getStep(this.config.constraints, e);
    if (step !== this.startStep) {
      this.startX = e.clientX;
      this.startValue = Number(this.value) || 0;
      this.startStep = step;
    }
    this.handleNumberDrag(e.clientX - this.startX);
  }
  /**
   * Handle number value drag
   * Uses discrete stepping: every N pixels = exactly 1 step change
   */
  handleNumberDrag(deltaX) {
    var _a, _b;
    const steps = Math.trunc(deltaX / PIXELS_PER_STEP);
    const target = this.startValue + steps * this.startStep;
    if (target === this.value) return;
    const result = WidgetSyncManager.syncWidgetValue(this.config.nodeId, this.config.widgetName, target, false);
    if (!result.success) return;
    this.value = result.newValue;
    (_b = (_a = this.config).onChange) == null ? void 0 : _b.call(_a, result.newValue);
  }
  /**
   * Handle pointer up - end drag
   */
  onPointerUp(e) {
    if (!this.isDragging) return;
    this.endDrag(e.pointerId);
    Logger.debug(`[DragValue] Ended drag on ${this.config.widgetName}`);
  }
  /**
   * Handle pointer cancel - browser cancelled the pointer (e.g., touch scroll)
   */
  onPointerCancel(e) {
    if (!this.isDragging) return;
    this.endDrag(e.pointerId);
    Logger.debug(`[DragValue] Drag cancelled on ${this.config.widgetName}`);
  }
  /**
   * Handle lost pointer capture - capture was taken by another element
   */
  onLostCapture(_e) {
    if (!this.isDragging) return;
    this.endDrag();
    Logger.debug(`[DragValue] Lost capture on ${this.config.widgetName}`);
  }
  /**
   * Common cleanup for ending drag
   */
  endDrag(pointerId) {
    this.isDragging = false;
    this.element.classList.remove("dragging");
    WidgetSyncManager.recordUndo();
    if (pointerId !== void 0) {
      try {
        this.element.releasePointerCapture(pointerId);
      } catch {
      }
    }
    document.removeEventListener("pointermove", this.boundPointerMove, true);
    document.removeEventListener("pointerup", this.boundPointerUp, true);
    document.removeEventListener("pointercancel", this.boundPointerCancel, true);
    this.element.removeEventListener("lostpointercapture", this.boundLostCapture);
  }
  /**
   * Cleanup and remove drag handling
   */
  destroy() {
    this.element.classList.remove("draggable", "dragging");
    this.element.removeEventListener("pointerdown", this.boundPointerDown);
    document.removeEventListener("pointermove", this.boundPointerMove, true);
    document.removeEventListener("pointerup", this.boundPointerUp, true);
    document.removeEventListener("pointercancel", this.boundPointerCancel, true);
    this.element.removeEventListener("lostpointercapture", this.boundLostCapture);
  }
  /**
   * Check if a widget type supports drag editing
   */
  static isTypeSupported(widgetType) {
    const type = widgetType.toLowerCase();
    return ["int", "float", "slider"].includes(type);
  }
}
export {
  DragValueController
};
