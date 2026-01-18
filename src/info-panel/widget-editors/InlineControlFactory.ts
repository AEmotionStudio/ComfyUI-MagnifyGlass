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
        return type === 'toggle' || type === 'boolean' || type === 'combo' || type === 'button';
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
            case 'button':
                return this.createInlineButton(config);
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

    /**
     * Create inline button for action widgets
     * Invokes the widget's callback when clicked
     */
    private static createInlineButton(config: InlineControlConfig): InlineControlInstance {
        const container = document.createElement('div');
        container.className = 'inline-control inline-button';

        const button = document.createElement('button');
        button.className = 'inline-action-button';

        // Determine button label - use meaningful text, not raw values like null/true
        let buttonLabel = 'Click';
        const val = config.currentValue;
        // Only use value if it's a meaningful string (not null, undefined, or boolean artifacts)
        if (typeof val === 'string' && val.length > 0 && val !== 'null' && val !== 'true' && val !== 'false') {
            buttonLabel = val;
        }
        button.textContent = buttonLabel;
        button.type = 'button';

        // Style the button to match theme
        button.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 4px 12px;
            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
            font-size: 13px;
            background: var(--info-panel-accent-color, #a0d468);
            color: var(--comfy-menu-bg, #1a1a1a);
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            transition: all 0.2s ease;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
        `;

        // Stop propagation on container to prevent parent handlers from interfering
        container.addEventListener('click', (e) => e.stopPropagation());
        container.addEventListener('mousedown', (e) => e.stopPropagation());
        container.addEventListener('mouseup', (e) => e.stopPropagation());

        // Click handler - invoke widget callback
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();

            // Visual feedback
            button.style.transform = 'scale(0.95)';
            setTimeout(() => { button.style.transform = ''; }, 100);

            // Access the widget callback through the node
            const app = (window as any).app;
            if (!app?.graph) {
                Logger.warn(`[InlineControl] No app.graph available`);
                return;
            }

            const node = app.graph.getNodeById(config.nodeId);
            if (!node?.widgets) {
                Logger.warn(`[InlineControl] Node ${config.nodeId} not found or has no widgets`);
                return;
            }

            const widget = node.widgets.find((w: any) => w.name === config.widgetName);
            if (widget && typeof widget.callback === 'function') {
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

        // Hover effects
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-1px)';
            button.style.boxShadow = '0 3px 8px rgba(0, 0, 0, 0.25)';
        });
        button.addEventListener('mouseleave', () => {
            button.style.transform = '';
            button.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.2)';
        });

        container.appendChild(button);

        return {
            element: container,
            getValue: () => config.currentValue,
            setValue: () => { /* Buttons don't have editable values */ },
            destroy: () => { container.remove(); }
        };
    }
}
