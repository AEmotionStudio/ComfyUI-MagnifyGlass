import { WidgetSyncManager } from "./WidgetSyncManager.js";
import { createDropdownTrigger, updateDropdownTriggerValue, CustomDropdown } from "../../shared/CustomDropdown.js";
class WidgetEditorFactory {
  /**
   * Create an editor element for the given configuration
   */
  static createEditor(config) {
    const type = config.widgetType.toLowerCase();
    switch (type) {
      case "number":
      case "int":
      case "float":
        return this.createNumberEditor(config);
      case "combo":
        return this.createComboEditor(config);
      case "toggle":
      case "boolean":
        return this.createBooleanEditor(config);
      case "slider":
        return this.createSliderEditor(config);
      case "text":
      case "string":
      case "customtext":
      default:
        return this.createTextEditor(config);
    }
  }
  /**
   * Create a number input editor
   */
  static createNumberEditor(config) {
    const container = document.createElement("div");
    container.className = "widget-editor widget-editor-number";
    const input = document.createElement("input");
    input.type = "number";
    input.className = "widget-editor-input";
    input.value = String(config.currentValue ?? 0);
    if (config.constraints) {
      if (typeof config.constraints.min === "number") {
        input.min = String(config.constraints.min);
      }
      if (typeof config.constraints.max === "number") {
        input.max = String(config.constraints.max);
      }
      if (typeof config.constraints.step === "number") {
        input.step = String(config.constraints.step);
      }
    }
    const decrementBtn = document.createElement("button");
    decrementBtn.className = "widget-editor-stepper decrement";
    decrementBtn.innerHTML = "−";
    decrementBtn.type = "button";
    const incrementBtn = document.createElement("button");
    incrementBtn.className = "widget-editor-stepper increment";
    incrementBtn.innerHTML = "+";
    incrementBtn.type = "button";
    const syncValue = () => {
      var _a;
      const numValue = parseFloat(input.value);
      if (!isNaN(numValue)) {
        WidgetSyncManager.syncWidgetValue(config.nodeId, config.widgetName, numValue);
        (_a = config.onChange) == null ? void 0 : _a.call(config, numValue);
      }
    };
    input.addEventListener("input", syncValue);
    input.addEventListener("change", syncValue);
    input.addEventListener("focus", () => {
      var _a;
      return (_a = config.onFocus) == null ? void 0 : _a.call(config);
    });
    input.addEventListener("blur", () => {
      var _a;
      return (_a = config.onBlur) == null ? void 0 : _a.call(config);
    });
    decrementBtn.addEventListener("click", (e) => {
      var _a, _b;
      e.preventDefault();
      e.stopPropagation();
      const step = 1;
      const currentVal = parseFloat(input.value);
      const baseValue = isNaN(currentVal) ? ((_a = config.constraints) == null ? void 0 : _a.min) ?? Number(config.currentValue) ?? 0 : currentVal;
      let newValue = baseValue - step;
      if (((_b = config.constraints) == null ? void 0 : _b.min) !== void 0) {
        newValue = Math.max(config.constraints.min, newValue);
      }
      input.value = String(newValue);
      syncValue();
    });
    incrementBtn.addEventListener("click", (e) => {
      var _a, _b;
      e.preventDefault();
      e.stopPropagation();
      const step = 1;
      const currentVal = parseFloat(input.value);
      const baseValue = isNaN(currentVal) ? ((_a = config.constraints) == null ? void 0 : _a.min) ?? Number(config.currentValue) ?? 0 : currentVal;
      let newValue = baseValue + step;
      if (((_b = config.constraints) == null ? void 0 : _b.max) !== void 0) {
        newValue = Math.min(config.constraints.max, newValue);
      }
      input.value = String(newValue);
      syncValue();
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        input.blur();
      }
    });
    container.appendChild(decrementBtn);
    container.appendChild(input);
    container.appendChild(incrementBtn);
    return {
      element: container,
      getValue: () => parseFloat(input.value),
      setValue: (v) => {
        input.value = String(v);
      },
      focus: () => {
        input.focus();
        input.select();
      },
      destroy: () => {
        container.remove();
      }
    };
  }
  /**
   * Create a text input editor
   */
  static createTextEditor(config) {
    const value = String(config.currentValue ?? "");
    const isLongText = value.length > 50 || value.includes("\n");
    const container = document.createElement("div");
    container.className = "widget-editor widget-editor-text";
    let inputElement;
    if (isLongText) {
      const textarea = document.createElement("textarea");
      textarea.className = "widget-editor-textarea";
      textarea.value = value;
      textarea.rows = Math.min(8, Math.max(3, value.split("\n").length + 1));
      inputElement = textarea;
      const counter = document.createElement("span");
      counter.className = "widget-editor-counter";
      counter.textContent = `${value.length} chars`;
      container.appendChild(counter);
      textarea.addEventListener("input", () => {
        counter.textContent = `${textarea.value.length} chars`;
        textarea.rows = Math.min(8, Math.max(3, textarea.value.split("\n").length + 1));
      });
    } else {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "widget-editor-input";
      input.value = value;
      inputElement = input;
    }
    const syncValue = () => {
      var _a;
      WidgetSyncManager.syncWidgetValueDebounced(
        config.nodeId,
        config.widgetName,
        inputElement.value,
        100
      );
      (_a = config.onChange) == null ? void 0 : _a.call(config, inputElement.value);
    };
    inputElement.addEventListener("input", syncValue);
    inputElement.addEventListener("focus", () => {
      var _a;
      return (_a = config.onFocus) == null ? void 0 : _a.call(config);
    });
    inputElement.addEventListener("blur", () => {
      var _a;
      return (_a = config.onBlur) == null ? void 0 : _a.call(config);
    });
    inputElement.addEventListener("keydown", (evt) => {
      const e = evt;
      if (e.key === "Escape") {
        inputElement.blur();
      }
      if (e.key === "Enter" && inputElement instanceof HTMLInputElement) {
        inputElement.blur();
      }
    });
    container.insertBefore(inputElement, container.firstChild);
    return {
      element: container,
      getValue: () => inputElement.value,
      setValue: (v) => {
        inputElement.value = String(v);
      },
      focus: () => {
        inputElement.focus();
        if (inputElement instanceof HTMLInputElement) inputElement.select();
      },
      destroy: () => {
        container.remove();
      }
    };
  }
  /**
   * Create a combo/dropdown editor
   * Uses custom dropdown for viewport-aware positioning
   */
  static createComboEditor(config) {
    var _a;
    const container = document.createElement("div");
    container.className = "widget-editor widget-editor-combo";
    const options = ((_a = config.constraints) == null ? void 0 : _a.options) ?? [];
    let currentValue = String(config.currentValue);
    const trigger = createDropdownTrigger(currentValue, "widget-editor-dropdown-trigger");
    trigger.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            width: 100%;
            padding: 4px 28px 4px 10px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 14px;
            color: var(--info-panel-accent-color, #a0d468);
            background: rgba(160, 212, 104, 0.12);
            border: 1px solid transparent;
            border-radius: 6px;
            cursor: pointer;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            transition: all 0.2s ease;
        `;
    let activeDropdown = null;
    const showDropdown = () => {
      var _a2;
      if (activeDropdown) {
        activeDropdown.hide();
        activeDropdown = null;
        return;
      }
      (_a2 = config.onFocus) == null ? void 0 : _a2.call(config);
      activeDropdown = new CustomDropdown({
        options: options.map(String),
        currentValue,
        anchor: trigger,
        onChange: (value) => {
          var _a3;
          currentValue = value;
          updateDropdownTriggerValue(trigger, value);
          WidgetSyncManager.syncWidgetValue(config.nodeId, config.widgetName, value);
          (_a3 = config.onChange) == null ? void 0 : _a3.call(config, value);
        },
        onClose: () => {
          var _a3;
          activeDropdown = null;
          (_a3 = config.onBlur) == null ? void 0 : _a3.call(config);
        }
      });
      activeDropdown.show();
    };
    trigger.addEventListener("click", showDropdown);
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
        showDropdown();
      } else if (e.key === "Escape" && activeDropdown) {
        activeDropdown.hide();
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
      focus: () => trigger.focus(),
      destroy: () => {
        activeDropdown == null ? void 0 : activeDropdown.hide();
        container.remove();
      }
    };
  }
  /**
   * Create a boolean toggle editor
   */
  static createBooleanEditor(config) {
    const container = document.createElement("div");
    container.className = "widget-editor widget-editor-boolean";
    const label = document.createElement("label");
    label.className = "widget-editor-toggle";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "widget-editor-checkbox";
    const boolValue = config.currentValue === true || config.currentValue === "true";
    checkbox.checked = boolValue;
    const slider = document.createElement("span");
    slider.className = "widget-editor-toggle-slider";
    checkbox.addEventListener("change", () => {
      var _a;
      WidgetSyncManager.syncWidgetValue(config.nodeId, config.widgetName, checkbox.checked);
      (_a = config.onChange) == null ? void 0 : _a.call(config, checkbox.checked);
    });
    checkbox.addEventListener("focus", () => {
      var _a;
      return (_a = config.onFocus) == null ? void 0 : _a.call(config);
    });
    checkbox.addEventListener("blur", () => {
      var _a;
      return (_a = config.onBlur) == null ? void 0 : _a.call(config);
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
      focus: () => checkbox.focus(),
      destroy: () => {
        container.remove();
      }
    };
  }
  /**
   * Create a slider editor
   */
  static createSliderEditor(config) {
    const container = document.createElement("div");
    container.className = "widget-editor widget-editor-slider";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.className = "widget-editor-range";
    slider.value = String(config.currentValue ?? 0);
    if (config.constraints) {
      slider.min = String(config.constraints.min ?? 0);
      slider.max = String(config.constraints.max ?? 100);
      slider.step = String(config.constraints.step ?? 0.01);
    }
    const valueDisplay = document.createElement("span");
    valueDisplay.className = "widget-editor-slider-value";
    valueDisplay.textContent = String(config.currentValue ?? 0);
    const syncValue = () => {
      var _a, _b;
      const numValue = parseFloat(slider.value);
      valueDisplay.textContent = numValue.toFixed(((_a = config.constraints) == null ? void 0 : _a.precision) ?? 2);
      WidgetSyncManager.syncWidgetValue(config.nodeId, config.widgetName, numValue);
      (_b = config.onChange) == null ? void 0 : _b.call(config, numValue);
    };
    slider.addEventListener("input", syncValue);
    slider.addEventListener("focus", () => {
      var _a;
      return (_a = config.onFocus) == null ? void 0 : _a.call(config);
    });
    slider.addEventListener("blur", () => {
      var _a;
      return (_a = config.onBlur) == null ? void 0 : _a.call(config);
    });
    slider.addEventListener("keydown", (e) => {
      var _a;
      if (e.key === "Escape") {
        e.preventDefault();
        slider.blur();
        (_a = config.onBlur) == null ? void 0 : _a.call(config);
      }
    });
    container.appendChild(slider);
    container.appendChild(valueDisplay);
    return {
      element: container,
      getValue: () => parseFloat(slider.value),
      setValue: (v) => {
        slider.value = String(v);
        valueDisplay.textContent = String(v);
      },
      focus: () => slider.focus(),
      destroy: () => {
        container.remove();
      }
    };
  }
  /**
   * Check if a widget type is supported for editing
   */
  static isTypeSupported(widgetType) {
    const supported = [
      "number",
      "int",
      "float",
      "text",
      "string",
      "customtext",
      "combo",
      "toggle",
      "boolean",
      "slider"
    ];
    return supported.includes(widgetType.toLowerCase());
  }
}
export {
  WidgetEditorFactory
};
