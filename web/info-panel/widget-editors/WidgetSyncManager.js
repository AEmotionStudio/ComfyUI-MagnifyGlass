import { Logger } from "../../shared/logger.js";
class WidgetSyncManager {
  /**
   * Update a widget value on a node in the graph on screen
   * @param nodeId - The node ID
   * @param widgetName - The widget name
   * @param value - The new value to set
   * @param recordUndo - Record an undo step now; drags pass false and record once on release
   * @returns SyncResult indicating success or failure
   */
  static syncWidgetValue(nodeId, widgetName, value, recordUndo = true) {
    var _a, _b, _c, _d, _e;
    try {
      const node = (_b = (_a = app == null ? void 0 : app.canvas) == null ? void 0 : _a.graph) == null ? void 0 : _b.getNodeById(nodeId);
      if (!node) {
        return { success: false, error: `Node ${nodeId} not found` };
      }
      const widget = (_c = node.widgets) == null ? void 0 : _c.find((w) => w.name === widgetName);
      if (!widget) {
        return { success: false, error: `Widget "${widgetName}" not found on node ${nodeId}` };
      }
      const previousValue = widget.value;
      const constrainedValue = this.applyConstraints(value, widget);
      if (typeof widget.setValue === "function") {
        widget.setValue(constrainedValue, { node, canvas: app.canvas });
      } else {
        widget.value = constrainedValue;
        (_d = widget.callback) == null ? void 0 : _d.call(widget, constrainedValue, app.canvas, node, app.canvas.graph_mouse);
      }
      (_e = node.graph) == null ? void 0 : _e.setDirtyCanvas(true, true);
      if (recordUndo) this.recordUndo();
      Logger.debug(`[WidgetSync] Updated ${widgetName} on node ${nodeId}: ${previousValue} → ${widget.value}`);
      return {
        success: true,
        previousValue,
        newValue: widget.value
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Logger.error(`[WidgetSync] Error syncing widget:`, error);
      return { success: false, error: message };
    }
  }
  /**
   * Let ComfyUI's change tracker pick up the edit as an undo step
   */
  static recordUndo() {
    var _a, _b, _c, _d;
    (_d = (_c = (_b = (_a = app == null ? void 0 : app.extensionManager) == null ? void 0 : _a.workflow) == null ? void 0 : _b.activeWorkflow) == null ? void 0 : _c.changeTracker) == null ? void 0 : _d.checkState();
  }
  /**
   * Extract constraints from a widget object
   */
  static extractConstraints(widget) {
    const constraints = {};
    if (typeof widget.min === "number") constraints.min = widget.min;
    if (typeof widget.max === "number") constraints.max = widget.max;
    if (typeof widget.step === "number") constraints.step = widget.step;
    const options = widget.options;
    if (options && !Array.isArray(options)) {
      if (typeof options.min === "number") constraints.min = options.min;
      if (typeof options.max === "number") constraints.max = options.max;
      if (typeof options.step2 === "number") constraints.step = options.step2;
      else if (typeof options.step === "number") constraints.step = options.step / 10;
      if (typeof options.round === "number" && options.round > 0) constraints.round = options.round;
      if (typeof options.precision === "number") constraints.precision = options.precision;
      const values = typeof options.values === "function" ? options.values(widget, widget.node) : options.values;
      if (Array.isArray(values)) {
        constraints.options = values;
      }
    }
    if (Array.isArray(options)) {
      constraints.options = options;
    }
    return constraints;
  }
  /**
   * Step for one nudge of a number widget. Shift is x10, Alt is x0.1 but never finer than the widget stores.
   */
  static getStep(constraints, e) {
    const step = (constraints == null ? void 0 : constraints.step) ?? 1;
    if (e == null ? void 0 : e.shiftKey) return step * 10;
    if (e == null ? void 0 : e.altKey) return Math.max(step / 10, (constraints == null ? void 0 : constraints.round) ?? 10 ** -((constraints == null ? void 0 : constraints.precision) ?? 3));
    return step;
  }
  /**
   * Apply constraints to a value
   */
  static applyConstraints(value, widget) {
    const constraints = this.extractConstraints(widget);
    const widgetType = this.getWidgetType(widget);
    if (widgetType === "INT" || widgetType === "FLOAT" || widgetType === "slider") {
      let numValue = typeof value === "number" ? value : parseFloat(String(value));
      if (isNaN(numValue)) {
        return widget.value;
      }
      if (constraints.round) {
        numValue = Math.round(numValue / constraints.round) * constraints.round;
      }
      if (typeof constraints.precision === "number") {
        numValue = parseFloat(numValue.toFixed(constraints.precision));
      }
      if (typeof constraints.min === "number") {
        numValue = Math.max(constraints.min, numValue);
      }
      if (typeof constraints.max === "number") {
        numValue = Math.min(constraints.max, numValue);
      }
      return numValue;
    }
    if (widgetType === "combo" && constraints.options) {
      const valueStr = String(value);
      const hasMatch = constraints.options.some((opt) => String(opt) === valueStr);
      if (!hasMatch) {
        Logger.warn(`[WidgetSync] Invalid combo value "${value}", keeping current`);
        return widget.value;
      }
      const matchedOption = constraints.options.find((opt) => String(opt) === valueStr);
      if (matchedOption !== void 0) {
        return matchedOption;
      }
    }
    if (widgetType === "toggle" || widgetType === "boolean") {
      return Boolean(value);
    }
    return value;
  }
  /**
   * Determine widget type from widget object
   */
  static getWidgetType(widget) {
    var _a, _b;
    if (!widget) return "unknown";
    const type = (widget.type || "").toLowerCase();
    if (type === "button") return "button";
    if (type === "number" || type === "knob") return ((_a = widget.options) == null ? void 0 : _a.precision) === 0 ? "INT" : "FLOAT";
    if (type === "combo" || type === "string" && Array.isArray(widget.options)) return "combo";
    if (type === "toggle" || type === "boolean") return "boolean";
    if (type === "slider") return "slider";
    if (type === "customtext" || ((_b = widget.options) == null ? void 0 : _b.multiline)) return "multiline";
    if (type === "text" || type === "string") return "text";
    if (Array.isArray(widget.options) && widget.options.length > 0) {
      return "combo";
    }
    if (typeof widget.callback === "function" && widget.name) {
      const name = widget.name.toLowerCase();
      const buttonPatterns = ["show", "save", "open", "load", "export", "import", "reset", "clear", "apply", "run", "execute", "preview", "refresh", "update"];
      const hasButtonName = buttonPatterns.some((pattern) => name.includes(pattern));
      const hasNonEditableValue = widget.value === void 0 || widget.value === null || typeof widget.value === "boolean";
      if (hasButtonName && hasNonEditableValue) {
        return "button";
      }
    }
    if (typeof widget.callback === "function" && widget.value === void 0 && !Array.isArray(widget.options)) {
      return "button";
    }
    return "text";
  }
  /**
   * Check if a widget is editable
   */
  static isWidgetEditable(widget) {
    if (!widget) return false;
    if (widget.hidden) return false;
    if (widget.readonly) return false;
    if (widget.value !== null && typeof widget.value === "object") return false;
    const type = this.getWidgetType(widget);
    if (widget.element && type !== "multiline") return false;
    return ["INT", "FLOAT", "text", "multiline", "combo", "boolean", "slider"].includes(type);
  }
  /**
   * Get current value of a widget
   */
  static getWidgetValue(nodeId, widgetName) {
    var _a, _b, _c, _d;
    const widget = (_d = (_c = (_b = (_a = app == null ? void 0 : app.canvas) == null ? void 0 : _a.graph) == null ? void 0 : _b.getNodeById(nodeId)) == null ? void 0 : _c.widgets) == null ? void 0 : _d.find((w) => w.name === widgetName);
    return (widget == null ? void 0 : widget.value) ?? null;
  }
}
export {
  WidgetSyncManager
};
