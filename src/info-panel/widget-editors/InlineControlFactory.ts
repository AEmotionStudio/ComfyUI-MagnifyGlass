/**
 * ComfyUI MagnifyGlass - Inline Control Factory
 * 
 * Creates compact inline controls that render directly in inspector rows
 * for immediate value editing without entering edit mode.
 */

import { WidgetSyncManager, WidgetConstraints } from './WidgetSyncManager';
import { Logger } from '../../shared/logger';

/**
 * Configuration for creating an inline control
 */
export interface InlineControlConfig {
    nodeId: number;
    widgetName: string;
    widgetType: string;
    currentValue: unknown;
    constraints?: WidgetConstraints;
    onChange?: (value: unknown) => void;
}

/**
 * Interface for inline control instances
 */
export interface InlineControlInstance {
    element: HTMLElement;
    getValue(): unknown;
    setValue(value: unknown): void;
    destroy(): void;
}

/**
 * Inline Control Factory
 * Creates compact inline controls for immediate value editing
 */
export class InlineControlFactory {
    /**
     * Check if a widget type should use inline controls
     */
    static shouldUseInlineControl(widgetType: string): boolean {
        const type = widgetType.toLowerCase();
        return type === 'toggle' || type === 'boolean' || type === 'combo';
    }

    /**
     * Create an inline control for the given configuration
     */
    static createControl(config: InlineControlConfig): InlineControlInstance | null {
        const type = config.widgetType.toLowerCase();

        switch (type) {
            case 'toggle':
            case 'boolean':
                return this.createInlineToggle(config);
            case 'combo':
                return this.createInlineDropdown(config);
            default:
                return null;
        }
    }

    /**
     * Create compact inline toggle for boolean values
     */
    private static createInlineToggle(config: InlineControlConfig): InlineControlInstance {
        const container = document.createElement('div');
        container.className = 'inline-control inline-toggle';

        const label = document.createElement('label');
        label.className = 'inline-toggle-switch';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'inline-toggle-input';
        // Handle boolean coercion properly
        const boolValue = config.currentValue === true || config.currentValue === 'true';
        checkbox.checked = boolValue;

        const slider = document.createElement('span');
        slider.className = 'inline-toggle-slider';

        // Stop propagation to prevent row click handlers
        container.addEventListener('click', (e) => e.stopPropagation());

        // Sync on change
        checkbox.addEventListener('change', () => {
            WidgetSyncManager.syncWidgetValue(config.nodeId, config.widgetName, checkbox.checked);
            config.onChange?.(checkbox.checked);
            Logger.debug(`[InlineControl] Toggle ${config.widgetName}: ${checkbox.checked}`);
        });

        label.appendChild(checkbox);
        label.appendChild(slider);
        container.appendChild(label);

        return {
            element: container,
            getValue: () => checkbox.checked,
            setValue: (v) => { checkbox.checked = Boolean(v); },
            destroy: () => { container.remove(); }
        };
    }

    /**
     * Create compact inline dropdown for combo values
     */
    private static createInlineDropdown(config: InlineControlConfig): InlineControlInstance {
        const container = document.createElement('div');
        container.className = 'inline-control inline-dropdown';

        const select = document.createElement('select');
        select.className = 'inline-dropdown-select';

        // Populate options
        const options = config.constraints?.options ?? [];
        const currentValueStr = String(config.currentValue);

        for (const opt of options) {
            const option = document.createElement('option');
            const optStr = String(opt);
            option.value = optStr;
            option.textContent = optStr;
            if (optStr === currentValueStr) {
                option.selected = true;
            }
            select.appendChild(option);
        }

        // Stop propagation on all events to prevent parent handlers from interfering
        const stopProp = (e: Event) => e.stopPropagation();
        container.addEventListener('click', stopProp);
        container.addEventListener('mousedown', stopProp);
        container.addEventListener('mouseup', stopProp);
        select.addEventListener('click', stopProp);
        select.addEventListener('mousedown', stopProp);
        select.addEventListener('mouseup', stopProp);
        select.addEventListener('focus', stopProp);

        // Sync on change
        select.addEventListener('change', () => {
            WidgetSyncManager.syncWidgetValue(config.nodeId, config.widgetName, select.value);
            config.onChange?.(select.value);
            Logger.debug(`[InlineControl] Dropdown ${config.widgetName}: ${select.value}`);
        });

        container.appendChild(select);

        return {
            element: container,
            getValue: () => select.value,
            setValue: (v) => { select.value = String(v); },
            destroy: () => { container.remove(); }
        };
    }
}
