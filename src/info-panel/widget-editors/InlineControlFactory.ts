/**
 * ComfyUI MagnifyGlass - Inline Control Factory
 * 
 * Creates compact inline controls that render directly in inspector rows
 * for immediate value editing without entering edit mode.
 */

import { WidgetSyncManager, WidgetConstraints } from './WidgetSyncManager';
import { Logger } from '../../shared/logger';
import { CustomDropdown, createDropdownTrigger, updateDropdownTriggerValue } from '../../shared/CustomDropdown';

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
     * Uses custom dropdown for viewport-aware positioning
     */
    private static createInlineDropdown(config: InlineControlConfig): InlineControlInstance {
        const container = document.createElement('div');
        container.className = 'inline-control inline-dropdown';

        const options = config.constraints?.options ?? [];
        let currentValue = String(config.currentValue);

        // Create trigger element that looks like a select
        const trigger = createDropdownTrigger(currentValue, 'inline-dropdown-trigger');
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

        let activeDropdown: CustomDropdown | null = null;

        // Stop propagation to prevent parent handlers from interfering
        const stopProp = (e: Event) => e.stopPropagation();
        container.addEventListener('click', stopProp);
        container.addEventListener('mousedown', stopProp);
        container.addEventListener('mouseup', stopProp);

        // Handle trigger click to show dropdown
        trigger.addEventListener('click', (e) => {
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
                    currentValue = value;
                    updateDropdownTriggerValue(trigger, value);
                    WidgetSyncManager.syncWidgetValue(config.nodeId, config.widgetName, value);
                    config.onChange?.(value);
                    Logger.debug(`[InlineControl] Dropdown ${config.widgetName}: ${value}`);
                },
                onClose: () => {
                    activeDropdown = null;
                }
            });
            activeDropdown.show();
        });

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
                activeDropdown?.hide();
                container.remove();
            }
        };
    }
}
