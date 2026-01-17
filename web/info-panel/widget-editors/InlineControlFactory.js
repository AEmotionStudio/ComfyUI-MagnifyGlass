import { WidgetSyncManager } from "./WidgetSyncManager.js";
import { Logger } from "../../shared/logger.js";
import { createDropdownTrigger, CustomDropdown, updateDropdownTriggerValue } from "../../shared/CustomDropdown.js";
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
   * Uses custom dropdown for viewport-aware positioning
   */
  static createInlineDropdown(config) {
    var _a;
    const container = document.createElement("div");
    container.className = "inline-control inline-dropdown";
    const options = ((_a = config.constraints) == null ? void 0 : _a.options) ?? [];
    let currentValue = String(config.currentValue);
    const trigger = createDropdownTrigger(currentValue, "inline-dropdown-trigger");
    trigger.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 10px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 14px;
            background: rgba(160, 212, 104, 0.12);
            border: 1px solid transparent;
            border-radius: 6px;
            color: var(--info-panel-accent-color, #74b9ff);
            cursor: pointer;
            min-width: 100px;
            max-width: 180px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            transition: all 0.2s ease;
        `;
    let activeDropdown = null;
    const stopProp = (e) => e.stopPropagation();
    container.addEventListener("click", stopProp);
    container.addEventListener("mousedown", stopProp);
    container.addEventListener("mouseup", stopProp);
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (activeDropdown) {
        activeDropdown.hide();
        activeDropdown = null;
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
    trigger.addEventListener("mouseenter", () => {
      trigger.style.background = "rgba(160, 212, 104, 0.18)";
      trigger.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
    });
    trigger.addEventListener("mouseleave", () => {
      trigger.style.background = "rgba(160, 212, 104, 0.12)";
      trigger.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.1)";
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
      destroy: () => {
        activeDropdown == null ? void 0 : activeDropdown.hide();
        container.remove();
      }
    };
  }
}
export {
  InlineControlFactory
};
//# sourceMappingURL=InlineControlFactory.js.map
