import { WidgetSyncManager } from "./WidgetSyncManager.js";
import { Logger } from "../../shared/logger.js";
class InlineControlFactory {
  /**
   * Check if a widget type should use inline controls
   */
  static shouldUseInlineControl(widgetType) {
    const type = widgetType.toLowerCase();
    return type === "toggle" || type === "boolean" || type === "combo";
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
      destroy: () => {
        container.remove();
      }
    };
  }
  /**
   * Create compact inline dropdown for combo values
   */
  static createInlineDropdown(config) {
    var _a;
    const container = document.createElement("div");
    container.className = "inline-control inline-dropdown";
    const select = document.createElement("select");
    select.className = "inline-dropdown-select";
    const options = ((_a = config.constraints) == null ? void 0 : _a.options) ?? [];
    const currentValueStr = String(config.currentValue);
    for (const opt of options) {
      const option = document.createElement("option");
      const optStr = String(opt);
      option.value = optStr;
      option.textContent = optStr;
      if (optStr === currentValueStr) {
        option.selected = true;
      }
      select.appendChild(option);
    }
    const stopProp = (e) => e.stopPropagation();
    container.addEventListener("click", stopProp);
    container.addEventListener("mousedown", stopProp);
    container.addEventListener("mouseup", stopProp);
    select.addEventListener("click", stopProp);
    select.addEventListener("mousedown", stopProp);
    select.addEventListener("mouseup", stopProp);
    select.addEventListener("focus", stopProp);
    select.addEventListener("change", () => {
      var _a2;
      WidgetSyncManager.syncWidgetValue(config.nodeId, config.widgetName, select.value);
      (_a2 = config.onChange) == null ? void 0 : _a2.call(config, select.value);
      Logger.debug(`[InlineControl] Dropdown ${config.widgetName}: ${select.value}`);
    });
    container.appendChild(select);
    return {
      element: container,
      getValue: () => select.value,
      setValue: (v) => {
        select.value = String(v);
      },
      destroy: () => {
        container.remove();
      }
    };
  }
}
export {
  InlineControlFactory
};
//# sourceMappingURL=InlineControlFactory.js.map
