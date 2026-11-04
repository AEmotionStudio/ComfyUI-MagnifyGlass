/**
 * ComfyUI MagnifyGlass - Widget Editor Factory
 * 
 * Factory class that creates the appropriate editor component for each widget type.
 * Acts as the single entry point for creating editable widget UIs in the inspector.
 */

import { WidgetSyncManager, WidgetConstraints } from './WidgetSyncManager';
import { Icons } from '../../shared/icons';

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
            case 'int':
            case 'float':
                return this.createNumberEditor(config);

            case 'slider':
                return this.createSliderEditor(config);

            case 'multiline':
                return this.createTextEditor(config, true);

            default:
                return this.createTextEditor(config, false);
        }
    }

    /**
     * Create a number input editor. Typing commits on Enter or blur, Escape drops it.
     * The arrow keys and steppers step by the widget step (Shift x10, Alt x0.1) and commit at once.
     */
    private static createNumberEditor(config: WidgetEditorConfig): WidgetEditorInstance {
        const container = document.createElement('div');
        container.className = 'widget-editor widget-editor-number';

        const input = document.createElement('input');
        input.type = 'number';
        input.className = 'widget-editor-input';
        input.setAttribute('aria-label', config.widgetName);

        const constraints = config.constraints;
        const format = (v: unknown) => typeof constraints?.precision === 'number' ? Number(v).toFixed(constraints.precision) : String(v);
        input.value = format(config.currentValue ?? 0);
        if (typeof constraints?.min === 'number') input.min = String(constraints.min);
        if (typeof constraints?.max === 'number') input.max = String(constraints.max);
        input.step = String(WidgetSyncManager.getStep(constraints));

        // Create stepper buttons
        const decrementBtn = document.createElement('button');
        decrementBtn.className = 'widget-editor-stepper decrement';
        decrementBtn.innerHTML = Icons.minus;
        decrementBtn.type = 'button';
        decrementBtn.setAttribute('aria-label', 'Decrease');

        const incrementBtn = document.createElement('button');
        incrementBtn.className = 'widget-editor-stepper increment';
        incrementBtn.innerHTML = Icons.plus;
        incrementBtn.type = 'button';
        incrementBtn.setAttribute('aria-label', 'Increase');

        let committedValue = input.value;

        const commit = () => {
            if (input.value === committedValue) return;
            const numValue = parseFloat(input.value);
            if (isNaN(numValue)) return;
            const result = WidgetSyncManager.syncWidgetValue(config.nodeId, config.widgetName, numValue);
            if (!result.success) return;
            input.value = format(result.newValue);
            committedValue = input.value;
            config.onChange?.(result.newValue);
        };

        const nudge = (direction: number, e: MouseEvent | KeyboardEvent) => {
            const typed = parseFloat(input.value);
            const current = Number(config.currentValue);
            const base = !isNaN(typed) ? typed : !isNaN(current) ? current : (constraints?.min ?? 0);
            input.value = String(base + direction * WidgetSyncManager.getStep(constraints, e));
            commit();
        };

        input.addEventListener('focus', () => config.onFocus?.());
        // On the container, so leaving from a stepper focused with Tab closes the editor too
        container.addEventListener('focusout', () => {
            commit();
            config.onBlur?.();
        });

        // Keep focus in the input, so Enter and Escape still reach it after a stepper click
        decrementBtn.addEventListener('mousedown', (e) => e.preventDefault());
        incrementBtn.addEventListener('mousedown', (e) => e.preventDefault());

        decrementBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            nudge(-1, e);
        });

        incrementBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            nudge(1, e);
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                nudge(e.key === 'ArrowUp' ? 1 : -1, e);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            } else if (e.key === 'Escape') {
                // Drops the typing only; the steps are already committed
                e.preventDefault();
                input.value = committedValue;
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
            destroy: () => {
                commit();
                container.remove();
            }
        };
    }

    /**
     * Create a text editor. Commits on blur, Enter (Ctrl/Cmd+Enter in a textarea) and when destroyed; Escape reverts.
     */
    private static createTextEditor(config: WidgetEditorConfig, multiline: boolean): WidgetEditorInstance {
        const value = String(config.currentValue ?? '');

        const container = document.createElement('div');
        container.className = 'widget-editor widget-editor-text';

        let inputElement: HTMLInputElement | HTMLTextAreaElement;

        // A text input would drop newlines, so any value that has them gets a textarea too
        if (multiline || value.includes('\n')) {
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
        inputElement.setAttribute('aria-label', config.widgetName);

        const startValue = inputElement.value;
        let committedValue = startValue;

        const commit = () => {
            if (inputElement.value === committedValue) return;
            committedValue = inputElement.value;
            WidgetSyncManager.syncWidgetValue(config.nodeId, config.widgetName, committedValue);
            config.onChange?.(committedValue);
        };

        inputElement.addEventListener('focus', () => config.onFocus?.());
        inputElement.addEventListener('blur', () => {
            commit();
            config.onBlur?.();
        });

        inputElement.addEventListener('keydown', (evt) => {
            const e = evt as KeyboardEvent;
            if (e.key === 'Escape') {
                e.preventDefault();
                inputElement.value = startValue;
                commit();
                inputElement.blur();
            } else if (e.key === 'Enter' && (inputElement instanceof HTMLInputElement || e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                inputElement.blur();
            }
        });

        container.insertBefore(inputElement, container.firstChild);

        return {
            element: container,
            getValue: () => inputElement.value,
            setValue: (v) => { inputElement.value = String(v); },
            focus: () => { inputElement.focus(); if (inputElement instanceof HTMLInputElement) inputElement.select(); },
            destroy: () => {
                commit();
                container.remove();
            }
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
        slider.setAttribute('aria-label', config.widgetName);
        slider.value = String(config.currentValue ?? 0);

        // Apply constraints
        if (config.constraints) {
            slider.min = String(config.constraints.min ?? 0);
            slider.max = String(config.constraints.max ?? 100);
            slider.step = String(WidgetSyncManager.getStep(config.constraints));
        }

        // Value display
        const valueDisplay = document.createElement('span');
        valueDisplay.className = 'widget-editor-slider-value';
        valueDisplay.textContent = String(config.currentValue ?? 0);

        // Event handlers
        const syncValue = () => {
            const numValue = parseFloat(slider.value);
            valueDisplay.textContent = numValue.toFixed(config.constraints?.precision ?? 2);
            WidgetSyncManager.syncWidgetValue(config.nodeId, config.widgetName, numValue, false);
            config.onChange?.(numValue);
        };

        slider.addEventListener('input', syncValue);
        slider.addEventListener('change', () => WidgetSyncManager.recordUndo());
        slider.addEventListener('focus', () => config.onFocus?.());
        slider.addEventListener('blur', () => config.onBlur?.());

        // Handle Escape to close the editor
        slider.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                slider.blur();
                config.onBlur?.();
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
            destroy: () => { container.remove(); }
        };
    }
}
