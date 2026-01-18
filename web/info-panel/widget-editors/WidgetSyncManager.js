var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { Logger } from "../../shared/logger.js";
class WidgetSyncManager {
  /**
   * Update a widget value on a node
   * @param nodeId - The node ID
   * @param widgetName - The widget name
   * @param value - The new value to set
   * @returns SyncResult indicating success or failure
   */
  static syncWidgetValue(nodeId, widgetName, value) {
    try {
      if (!(app == null ? void 0 : app.graph)) {
        return { success: false, error: "ComfyUI app not available" };
      }
      const node = app.graph.getNodeById(nodeId);
      if (!node) {
        return { success: false, error: `Node ${nodeId} not found` };
      }
      if (!node.widgets || node.widgets.length === 0) {
        return { success: false, error: `Node ${nodeId} has no widgets` };
      }
      const widget = node.widgets.find((w) => w.name === widgetName);
      if (!widget) {
        return { success: false, error: `Widget "${widgetName}" not found on node ${nodeId}` };
      }
      const previousValue = widget.value;
      const constrainedValue = this.applyConstraints(value, widget);
      widget.value = constrainedValue;
      if (typeof widget.callback === "function") {
        try {
          widget.callback(constrainedValue, app.canvas, node, [0, 0], null);
        } catch (callbackError) {
          Logger.warn(`Widget callback failed for ${widgetName}:`, callbackError);
        }
      }
      if (typeof node.setDirtyCanvas === "function") {
        node.setDirtyCanvas(true, true);
      }
      this.triggerCanvasRedraw();
      Logger.debug(`[WidgetSync] Updated ${widgetName} on node ${nodeId}: ${previousValue} → ${constrainedValue}`);
      return {
        success: true,
        previousValue,
        newValue: constrainedValue
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      Logger.error(`[WidgetSync] Error syncing widget:`, error);
      return { success: false, error: message };
    }
  }
  /**
   * Debounced version of syncWidgetValue for text input
   * @param nodeId - The node ID
   * @param widgetName - The widget name  
   * @param value - The new value to set
   * @param debounceMs - Debounce delay in milliseconds (default 50ms)
   */
  static syncWidgetValueDebounced(nodeId, widgetName, value, debounceMs = this.DEBOUNCE_MS) {
    const key = `${nodeId}:${widgetName}`;
    const existingTimer = this.debounceTimers.get(key);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }
    const timer = window.setTimeout(() => {
      this.syncWidgetValue(nodeId, widgetName, value);
      this.debounceTimers.delete(key);
    }, debounceMs);
    this.debounceTimers.set(key, timer);
  }
  /**
   * Get widget constraints for validation
   * @param nodeId - The node ID
   * @param widgetName - The widget name
   * @returns WidgetConstraints or null if widget not found
   */
  static getWidgetConstraints(nodeId, widgetName) {
    try {
      if (!(app == null ? void 0 : app.graph)) return null;
      const node = app.graph.getNodeById(nodeId);
      if (!(node == null ? void 0 : node.widgets)) return null;
      const widget = node.widgets.find((w) => w.name === widgetName);
      if (!widget) return null;
      return this.extractConstraints(widget);
    } catch (error) {
      Logger.warn(`[WidgetSync] Error getting constraints:`, error);
      return null;
    }
  }
  /**
   * Extract constraints from a widget object
   */
  static extractConstraints(widget) {
    const constraints = {};
    if (typeof widget.min === "number") constraints.min = widget.min;
    if (typeof widget.max === "number") constraints.max = widget.max;
    if (typeof widget.step === "number") constraints.step = widget.step;
    if (widget.options) {
      if (typeof widget.options.min === "number") constraints.min = widget.options.min;
      if (typeof widget.options.max === "number") constraints.max = widget.options.max;
      if (typeof widget.options.step === "number") constraints.step = widget.options.step;
      if (typeof widget.options.precision === "number") constraints.precision = widget.options.precision;
      if (Array.isArray(widget.options.values)) {
        constraints.options = widget.options.values;
      }
    }
    if (Array.isArray(widget.options)) {
      constraints.options = widget.options;
    }
    return constraints;
  }
  /**
   * Apply constraints to a value
   */
  static applyConstraints(value, widget) {
    const constraints = this.extractConstraints(widget);
    const widgetType = this.getWidgetType(widget);
    if (widgetType === "number" || widgetType === "INT" || widgetType === "FLOAT" || widgetType === "slider") {
      let numValue = typeof value === "number" ? value : parseFloat(String(value));
      if (isNaN(numValue)) {
        return widget.value;
      }
      if (typeof constraints.min === "number") {
        numValue = Math.max(constraints.min, numValue);
      }
      if (typeof constraints.max === "number") {
        numValue = Math.min(constraints.max, numValue);
      }
      if (typeof constraints.precision === "number") {
        numValue = parseFloat(numValue.toFixed(constraints.precision));
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
    if (!widget) return "unknown";
    const type = (widget.type || "").toLowerCase();
    if (type === "number" || type === "int" || type === "float") return "number";
    if (type === "combo" || type === "string" && Array.isArray(widget.options)) return "combo";
    if (type === "toggle" || type === "boolean") return "boolean";
    if (type === "slider") return "slider";
    if (type === "text" || type === "string" || type === "customtext") return "text";
    if (Array.isArray(widget.options) && widget.options.length > 0) {
      return "combo";
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
    const type = this.getWidgetType(widget);
    const editableTypes = ["number", "text", "combo", "boolean", "slider", "INT", "FLOAT"];
    return editableTypes.includes(type) || editableTypes.includes(type.toUpperCase());
  }
  /**
   * Force canvas redraw after widget update
   */
  static triggerCanvasRedraw() {
    try {
      if (app == null ? void 0 : app.canvas) {
        if (typeof app.canvas.setDirty === "function") {
          app.canvas.setDirty(true, true);
        }
        if (typeof app.canvas.draw === "function") {
          app.canvas.draw(true, true);
        }
      }
    } catch (error) {
      Logger.warn(`[WidgetSync] Canvas redraw failed:`, error);
    }
  }
  /**
   * Get current value of a widget
   */
  static getWidgetValue(nodeId, widgetName) {
    try {
      if (!(app == null ? void 0 : app.graph)) return null;
      const node = app.graph.getNodeById(nodeId);
      if (!(node == null ? void 0 : node.widgets)) return null;
      const widget = node.widgets.find((w) => w.name === widgetName);
      return (widget == null ? void 0 : widget.value) ?? null;
    } catch (error) {
      return null;
    }
  }
  /**
   * Validate a value against widget constraints without applying
   */
  static validateValue(nodeId, widgetName, value) {
    const constraints = this.getWidgetConstraints(nodeId, widgetName);
    if (!constraints) {
      return { valid: true };
    }
    if (typeof value === "number") {
      if (typeof constraints.min === "number" && value < constraints.min) {
        return { valid: false, error: `Value must be at least ${constraints.min}` };
      }
      if (typeof constraints.max === "number" && value > constraints.max) {
        return { valid: false, error: `Value must be at most ${constraints.max}` };
      }
    }
    if (constraints.options) {
      const valueStr = String(value);
      const hasMatch = constraints.options.some((opt) => String(opt) === valueStr);
      if (!hasMatch) {
        return { valid: false, error: `Invalid option selected` };
      }
    }
    return { valid: true };
  }
}
__publicField(WidgetSyncManager, "debounceTimers", /* @__PURE__ */ new Map());
__publicField(WidgetSyncManager, "DEBOUNCE_MS", 50);
export {
  WidgetSyncManager
};
//# sourceMappingURL=WidgetSyncManager.js.map
