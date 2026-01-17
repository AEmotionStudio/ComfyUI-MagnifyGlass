/**
 * ComfyUI MagnifyGlass - Widget Editor Factory
 * 
 * Factory class that creates the appropriate editor component for each widget type.
 * Acts as the single entry point for creating editable widget UIs in the inspector.
 */

import { WidgetSyncManager, WidgetConstraints } from './WidgetSyncManager';
import { Logger } from '../../shared/logger';
import { CustomDropdown, createDropdownTrigger, updateDropdownTriggerValue } from '../../shared/CustomDropdown';

/**
 * Configuration for creating a widget editor
 */
export interface WidgetEditorConfig {
    nodeId: number;
    widgetName: string;
    widgetType: string;
    currentValue: unknown;
    constraints?: WidgetConstraints;
    onChange?: (value: unknown) => void;
    onFocus?: () => void;
    onBlur?: () => void;
}

/**
 * Base interface for all editor instances
 */
export interface WidgetEditorInstance {
    element: HTMLElement;
    getValue(): unknown;
    setValue(value: unknown): void;
    focus(): void;
    destroy(): void;
}

/**
 * Widget Editor Factory
 * Creates appropriate editor components based on widget type
 */
export class WidgetEditorFactory {
    /**
     * Create an editor element for the given configuration
     */
    static createEditor(config: WidgetEditorConfig): WidgetEditorInstance {
        const type = config.widgetType.toLowerCase();

        switch (type) {
            case 'number':
            case 'int':
            case 'float':
                return this.createNumberEditor(config);

            case 'combo':
                return this.createComboEditor(config);

            case 'toggle':
            case 'boolean':
                return this.createBooleanEditor(config);

            case 'slider':
                return this.createSliderEditor(config);

            case 'text':
            case 'string':
            case 'customtext':
            default:
                return this.createTextEditor(config);
        }
    }

    /**
     * Create a number input editor
     */
    private static createNumberEditor(config: WidgetEditorConfig): WidgetEditorInstance {
        const container = document.createElement('div');
        container.className = 'widget-editor widget-editor-number';

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'widget-editor-input';
        input.value = String(config.currentValue ?? 0);

        // Apply constraints
        if (config.constraints) {
            if (typeof config.constraints.min === 'number') {
                input.min = String(config.constraints.min);
            }
            if (typeof config.constraints.max === 'number') {
                input.max = String(config.constraints.max);
            }
            if (typeof config.constraints.step === 'number') {
                input.step = String(config.constraints.step);
            }
        }

        // Create stepper buttons
        const decrementBtn = document.createElement('button');
        decrementBtn.className = 'widget-editor-stepper decrement';
        decrementBtn.innerHTML = '−';
        decrementBtn.type = 'button';

        const incrementBtn = document.createElement('button');
        incrementBtn.className = 'widget-editor-stepper increment';
        incrementBtn.innerHTML = '+';
        incrementBtn.type = 'button';

        // Event handlers
        const syncValue = () => {
            const numValue = parseFloat(input.value);
            if (!isNaN(numValue)) {
                WidgetSyncManager.syncWidgetValue(config.nodeId, config.widgetName, numValue);
                config.onChange?.(numValue);
            }
        };

        input.addEventListener('input', syncValue);
        input.addEventListener('change', syncValue);
        input.addEventListener('focus', () => config.onFocus?.());
        input.addEventListener('blur', () => config.onBlur?.());

        decrementBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const step = config.constraints?.step ?? 1;
            const currentVal = parseFloat(input.value);
            // Handle NaN (empty input) - fall back to current value or min or 0
            const baseValue = isNaN(currentVal) ? (config.constraints?.min ?? Number(config.currentValue) ?? 0) : currentVal;
            let newValue = baseValue - step;
            // Clamp to constraints
            if (config.constraints?.min !== undefined) {
                newValue = Math.max(config.constraints.min, newValue);
            }
            input.value = String(newValue);
            syncValue();
        });

        incrementBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const step = config.constraints?.step ?? 1;
            const currentVal = parseFloat(input.value);
            // Handle NaN (empty input) - fall back to current value or min or 0
            const baseValue = isNaN(currentVal) ? (config.constraints?.min ?? Number(config.currentValue) ?? 0) : currentVal;
            let newValue = baseValue + step;
            // Clamp to constraints
            if (config.constraints?.max !== undefined) {
                newValue = Math.min(config.constraints.max, newValue);
            }
            input.value = String(newValue);
            syncValue();
        });

        // Handle keyboard - Enter to confirm, Escape to cancel
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.key === 'Enter') {
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
            setValue: (v) => { input.value = String(v); },
            focus: () => { input.focus(); input.select(); },
            destroy: () => { container.remove(); }
        };
    }

    /**
     * Create a text input editor
     */
    private static createTextEditor(config: WidgetEditorConfig): WidgetEditorInstance {
        const value = String(config.currentValue ?? '');
        const isLongText = value.length > 50 || value.includes('\n');

        const container = document.createElement('div');
        container.className = 'widget-editor widget-editor-text';

        let inputElement: HTMLInputElement | HTMLTextAreaElement;

        if (isLongText) {
            // Use textarea for long text (prompts)
            const textarea = document.createElement('textarea');
            textarea.className = 'widget-editor-textarea';
            textarea.value = value;
            textarea.rows = Math.min(8, Math.max(3, value.split('\n').length + 1));
            inputElement = textarea;

            // Add character counter
            const counter = document.createElement('span');
            counter.className = 'widget-editor-counter';
            counter.textContent = `${value.length} chars`;
            container.appendChild(counter);

            textarea.addEventListener('input', () => {
                counter.textContent = `${textarea.value.length} chars`;
                // Auto-resize
                textarea.rows = Math.min(8, Math.max(3, textarea.value.split('\n').length + 1));
            });
        } else {
            // Use input for short text
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'widget-editor-input';
            input.value = value;
            inputElement = input;
        }

        // Event handlers
        const syncValue = () => {
            WidgetSyncManager.syncWidgetValueDebounced(
                config.nodeId,
                config.widgetName,
                inputElement.value,
                100
            );
            config.onChange?.(inputElement.value);
        };

        inputElement.addEventListener('input', syncValue);
        inputElement.addEventListener('focus', () => config.onFocus?.());
        inputElement.addEventListener('blur', () => config.onBlur?.());

        inputElement.addEventListener('keydown', (evt) => {
            const e = evt as KeyboardEvent;
            if (e.key === 'Escape') {
                inputElement.blur();
            }
            // Allow Enter in textarea, but not in input
            if (e.key === 'Enter' && inputElement instanceof HTMLInputElement) {
                inputElement.blur();
            }
        });

        container.insertBefore(inputElement, container.firstChild);

        return {
            element: container,
            getValue: () => inputElement.value,
            setValue: (v) => { inputElement.value = String(v); },
            focus: () => { inputElement.focus(); if (inputElement instanceof HTMLInputElement) inputElement.select(); },
            destroy: () => { container.remove(); }
        };
    }

    /**
     * Create a combo/dropdown editor
     * Uses custom dropdown for viewport-aware positioning
     */
    private static createComboEditor(config: WidgetEditorConfig): WidgetEditorInstance {
        const container = document.createElement('div');
        container.className = 'widget-editor widget-editor-combo';

        const options = config.constraints?.options ?? [];
        let currentValue = String(config.currentValue);

        // Create trigger element that looks like a select
        const trigger = createDropdownTrigger(currentValue, 'widget-editor-dropdown-trigger');
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

        let activeDropdown: CustomDropdown | null = null;

        // Handle trigger click to show dropdown
        const showDropdown = () => {
            if (activeDropdown) {
                activeDropdown.hide();
                activeDropdown = null;
                return;
            }

            config.onFocus?.();

            activeDropdown = new CustomDropdown({
                options: options.map(String),
                currentValue,
                anchor: trigger,
                onChange: (value) => {
                    currentValue = value;
                    updateDropdownTriggerValue(trigger, value);
                    WidgetSyncManager.syncWidgetValue(config.nodeId, config.widgetName, value);
                    config.onChange?.(value);
                },
                onClose: () => {
                    activeDropdown = null;
                    config.onBlur?.();
                }
            });
            activeDropdown.show();
        };

        trigger.addEventListener('click', showDropdown);

        // Hover effect
        trigger.addEventListener('mouseenter', () => {
            trigger.style.background = 'rgba(160, 212, 104, 0.18)';
            trigger.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
        });
        trigger.addEventListener('mouseleave', () => {
            trigger.style.background = 'rgba(160, 212, 104, 0.12)';
            trigger.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
        });

        // Keyboard support
        trigger.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                showDropdown();
            } else if (e.key === 'Escape' && activeDropdown) {
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
                activeDropdown?.hide();
                container.remove();
            }
        };
    }

    /**
     * Create a boolean toggle editor
     */
    private static createBooleanEditor(config: WidgetEditorConfig): WidgetEditorInstance {
        const container = document.createElement('div');
        container.className = 'widget-editor widget-editor-boolean';

        const label = document.createElement('label');
        label.className = 'widget-editor-toggle';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'widget-editor-checkbox';
        // Handle boolean coercion properly - string 'false' should be false, not true
        const boolValue = config.currentValue === true || config.currentValue === 'true';
        checkbox.checked = boolValue;

        const slider = document.createElement('span');
        slider.className = 'widget-editor-toggle-slider';

        // Event handlers
        checkbox.addEventListener('change', () => {
            WidgetSyncManager.syncWidgetValue(config.nodeId, config.widgetName, checkbox.checked);
            config.onChange?.(checkbox.checked);
        });

        checkbox.addEventListener('focus', () => config.onFocus?.());
        checkbox.addEventListener('blur', () => config.onBlur?.());

        label.appendChild(checkbox);
        label.appendChild(slider);
        container.appendChild(label);

        return {
            element: container,
            getValue: () => checkbox.checked,
            setValue: (v) => { checkbox.checked = Boolean(v); },
            focus: () => checkbox.focus(),
            destroy: () => { container.remove(); }
        };
    }

    /**
     * Create a slider editor
     */
    private static createSliderEditor(config: WidgetEditorConfig): WidgetEditorInstance {
        const container = document.createElement('div');
        container.className = 'widget-editor widget-editor-slider';

        const slider = document.createElement('input');
        slider.type = 'range';
        slider.className = 'widget-editor-range';
        slider.value = String(config.currentValue ?? 0);

        // Apply constraints
        if (config.constraints) {
            slider.min = String(config.constraints.min ?? 0);
            slider.max = String(config.constraints.max ?? 100);
            slider.step = String(config.constraints.step ?? 0.01);
        }

        // Value display
        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'widget-editor-slider-value';
        valueDisplay.textContent = String(config.currentValue ?? 0);

        // Event handlers
        const syncValue = () => {
            const numValue = parseFloat(slider.value);
            valueDisplay.textContent = numValue.toFixed(config.constraints?.precision ?? 2);
            WidgetSyncManager.syncWidgetValue(config.nodeId, config.widgetName, numValue);
            config.onChange?.(numValue);
        };

        slider.addEventListener('input', syncValue);
        slider.addEventListener('focus', () => config.onFocus?.());
        slider.addEventListener('blur', () => config.onBlur?.());

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
            destroy: () => { container.remove(); }
        };
    }

    /**
     * Check if a widget type is supported for editing
     */
    static isTypeSupported(widgetType: string): boolean {
        const supported = [
            'number', 'int', 'float',
            'text', 'string', 'customtext',
            'combo',
            'toggle', 'boolean',
            'slider'
        ];
        return supported.includes(widgetType.toLowerCase());
    }
}
