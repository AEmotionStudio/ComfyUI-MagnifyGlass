import { WidgetSyncManager } from "./WidgetSyncManager.js";
import { Logger } from "../../shared/logger.js";
import { createDropdownTrigger, CustomDropdown, updateDropdownTriggerValue } from "../../shared/CustomDropdown.js";
class InlineControlFactory {
  /**
   * Check if a widget type should use inline controls
   */
  static shouldUseInlineControl(widgetType) {
    const type = widgetType.toLowerCase();
    return type === "toggle" || type === "boolean" || type === "combo" || type === "button";
  }
  /**
   * Create an inline control for the given configuration
   */
  static createControl(config) {
    const type = config.widgetType.toLowerCase();
    switch (type) {
      case "toggle":
      case "boolean":
        return this.createInlineToggle(config);
      case "combo":
        return this.createInlineDropdown(config);
      case "button":
        return this.createInlineButton(config);
      default:
        return null;
    }
  }
  /**
   * Create compact inline toggle for boolean values
   */
  static createInlineToggle(config) {
    const container = document.createElement("div");
    container.className = "inline-control inline-toggle";
    const label = document.createElement("label");
    label.className = "inline-toggle-switch";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "inline-toggle-input";
    checkbox.setAttribute("aria-label", config.widgetName);
    const boolValue = config.currentValue === true || config.currentValue === "true";
    checkbox.checked = boolValue;
    const slider = document.createElement("span");
    slider.className = "inline-toggle-slider";
    container.addEventListener("click", (e) => e.stopPropagation());
    checkbox.addEventListener("change", () => {
      var _a;
      WidgetSyncManager.syncWidgetValue(config.nodeId, config.widgetName, checkbox.checked);
      (_a = config.onChange) == null ? void 0 : _a.call(config, checkbox.checked);
      Logger.debug(`[InlineControl] Toggle ${config.widgetName}: ${checkbox.checked}`);
    });
    label.appendChild(checkbox);
    label.appendChild(slider);
    container.appendChild(label);
    return {
      element: container,
      getValue: () => checkbox.checked,
      setValue: (v) => {
        checkbox.checked = Boolean(v);
      },
      isOpen: () => false,
      destroy: () => {
        container.remove();
      }
    };
  }
  /**
   * Create compact inline dropdown for combo values
   * Uses custom dropdown for viewport-aware positioning
   */
  static createInlineDropdown(config) {
    var _a;
    const container = document.createElement("div");
    container.className = "inline-control inline-dropdown";
    const options = ((_a = config.constraints) == null ? void 0 : _a.options) ?? [];
    let currentValue = String(config.currentValue);
    const trigger = createDropdownTrigger(currentValue, "inline-dropdown-trigger");
    trigger.setAttribute("aria-label", config.widgetName);
    let activeDropdown = null;
    const stopProp = (e) => e.stopPropagation();
    container.addEventListener("click", stopProp);
    container.addEventListener("mousedown", stopProp);
    container.addEventListener("mouseup", stopProp);
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (activeDropdown) {
        activeDropdown.hide();
        return;
      }
      activeDropdown = new CustomDropdown({
        options: options.map(String),
        currentValue,
        anchor: trigger,
        onChange: (value) => {
          var _a2;
          currentValue = value;
          updateDropdownTriggerValue(trigger, value);
          WidgetSyncManager.syncWidgetValue(config.nodeId, config.widgetName, value);
          (_a2 = config.onChange) == null ? void 0 : _a2.call(config, value);
          Logger.debug(`[InlineControl] Dropdown ${config.widgetName}: ${value}`);
        },
        onClose: () => {
          activeDropdown = null;
        }
      });
      activeDropdown.show();
    });
    trigger.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        trigger.click();
      }
    });
    container.appendChild(trigger);
    return {
      element: container,
      getValue: () => currentValue,
      setValue: (v) => {
        currentValue = String(v);
        updateDropdownTriggerValue(trigger, currentValue);
      },
      isOpen: () => activeDropdown !== null,
      destroy: () => {
        activeDropdown == null ? void 0 : activeDropdown.hide();
        container.remove();
      }
    };
  }
  /**
   * Create inline button for action widgets
   * Invokes the widget's callback when clicked
   */
  static createInlineButton(config) {
    const container = document.createElement("div");
    container.className = "inline-control inline-button";
    const button = document.createElement("button");
    button.className = "inline-action-button";
    let buttonLabel = "Click";
    const val = config.currentValue;
    if (typeof val === "string" && val.length > 0 && val !== "null" && val !== "true" && val !== "false") {
      buttonLabel = val;
    }
    button.textContent = buttonLabel;
    button.type = "button";
    container.addEventListener("click", (e) => e.stopPropagation());
    container.addEventListener("mousedown", (e) => e.stopPropagation());
    container.addEventListener("mouseup", (e) => e.stopPropagation());
    button.addEventListener("click", (e) => {
      var _a, _b;
      e.stopPropagation();
      e.preventDefault();
      const app = window.app;
      const node = (_b = (_a = app == null ? void 0 : app.canvas) == null ? void 0 : _a.graph) == null ? void 0 : _b.getNodeById(config.nodeId);
      if (!(node == null ? void 0 : node.widgets)) {
        Logger.warn(`[InlineControl] Node ${config.nodeId} not found or has no widgets`);
        return;
      }
      const widget = node.widgets.find((w) => w.name === config.widgetName);
      if (widget && typeof widget.callback === "function") {
        try {
          widget.callback(widget.value, app.canvas, node, [0, 0], null);
          Logger.debug(`[InlineControl] Button ${config.widgetName} clicked successfully`);
        } catch (error) {
          Logger.warn(`[InlineControl] Button callback failed:`, error);
        }
      } else {
        Logger.warn(`[InlineControl] Widget ${config.widgetName} not found or has no callback`);
      }
    });
    container.appendChild(button);
    return {
      element: container,
      getValue: () => config.currentValue,
      setValue: () => {
      },
      isOpen: () => false,
      destroy: () => {
        container.remove();
      }
    };
  }
}
export {
  InlineControlFactory
};
