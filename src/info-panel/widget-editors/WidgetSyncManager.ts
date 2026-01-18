/**
 * ComfyUI MagnifyGlass - Widget Sync Manager
 * 
 * Handles synchronization between inspector edits and canvas node widgets.
 * Provides the bridge between the editable inspector UI and the actual node widgets.
 */

import { Logger } from '../../shared/logger';

declare const app: any;

/**
 * Constraints for widget values
 */
export interface WidgetConstraints {
    min?: number;
    max?: number;
    step?: number;
    precision?: number;
    options?: unknown[];  // For combo widgets
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
    success: boolean;
    error?: string;
    previousValue?: unknown;
    newValue?: unknown;
}

/**
 * Widget Sync Manager
 * Handles bidirectional sync between inspector and canvas nodes
 */
export class WidgetSyncManager {
    private static debounceTimers: Map<string, number> = new Map();
    private static readonly DEBOUNCE_MS = 50;

    /**
     * Update a widget value on a node
     * @param nodeId - The node ID
     * @param widgetName - The widget name
     * @param value - The new value to set
     * @returns SyncResult indicating success or failure
     */
    static syncWidgetValue(nodeId: number, widgetName: string, value: unknown): SyncResult {
        try {
            if (!app?.graph) {
                return { success: false, error: 'ComfyUI app not available' };
            }

            const node = app.graph.getNodeById(nodeId);
            if (!node) {
                return { success: false, error: `Node ${nodeId} not found` };
            }

            if (!node.widgets || node.widgets.length === 0) {
                return { success: false, error: `Node ${nodeId} has no widgets` };
            }

            const widget = node.widgets.find((w: any) => w.name === widgetName);
            if (!widget) {
                return { success: false, error: `Widget "${widgetName}" not found on node ${nodeId}` };
            }

            const previousValue = widget.value;

            // Apply constraints before setting value
            const constrainedValue = this.applyConstraints(value, widget);

            // Update widget value
            widget.value = constrainedValue;

            // Trigger widget callback if it exists (some widgets need this for side effects)
            if (typeof widget.callback === 'function') {
                try {
                    widget.callback(constrainedValue, app.canvas, node, [0, 0], null);
                } catch (callbackError) {
                    Logger.warn(`Widget callback failed for ${widgetName}:`, callbackError);
                    // Continue anyway - the value is set
                }
            }

            // Mark node as dirty to trigger redraw
            if (typeof node.setDirtyCanvas === 'function') {
                node.setDirtyCanvas(true, true);
            }

            // Force canvas redraw
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
    static syncWidgetValueDebounced(
        nodeId: number,
        widgetName: string,
        value: unknown,
        debounceMs: number = this.DEBOUNCE_MS
    ): void {
        const key = `${nodeId}:${widgetName}`;

        // Clear existing timer
        const existingTimer = this.debounceTimers.get(key);
        if (existingTimer) {
            window.clearTimeout(existingTimer);
        }

        // Set new timer
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
    static getWidgetConstraints(nodeId: number, widgetName: string): WidgetConstraints | null {
        try {
            if (!app?.graph) return null;

            const node = app.graph.getNodeById(nodeId);
            if (!node?.widgets) return null;

            const widget = node.widgets.find((w: any) => w.name === widgetName);
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
    static extractConstraints(widget: any): WidgetConstraints {
        const constraints: WidgetConstraints = {};

        // Direct properties
        if (typeof widget.min === 'number') constraints.min = widget.min;
        if (typeof widget.max === 'number') constraints.max = widget.max;
        if (typeof widget.step === 'number') constraints.step = widget.step;

        // Options object (ComfyUI sometimes nests these)
        if (widget.options) {
            if (typeof widget.options.min === 'number') constraints.min = widget.options.min;
            if (typeof widget.options.max === 'number') constraints.max = widget.options.max;
            if (typeof widget.options.step === 'number') constraints.step = widget.options.step;
            if (typeof widget.options.precision === 'number') constraints.precision = widget.options.precision;
            if (Array.isArray(widget.options.values)) {
                constraints.options = widget.options.values;
            }
        }

        // Combo widget options (array of values)
        if (Array.isArray(widget.options)) {
            constraints.options = widget.options;
        }

        return constraints;
    }

    /**
     * Apply constraints to a value
     */
    static applyConstraints(value: unknown, widget: any): unknown {
        const constraints = this.extractConstraints(widget);
        const widgetType = this.getWidgetType(widget);

        // Handle number types
        if (widgetType === 'number' || widgetType === 'INT' || widgetType === 'FLOAT' || widgetType === 'slider') {
            let numValue = typeof value === 'number' ? value : parseFloat(String(value));

            if (isNaN(numValue)) {
                return widget.value; // Return current value if invalid
            }

            // Apply min/max
            if (typeof constraints.min === 'number') {
                numValue = Math.max(constraints.min, numValue);
            }
            if (typeof constraints.max === 'number') {
                numValue = Math.min(constraints.max, numValue);
            }

            // Note: Skip step rounding to preserve user's exact input value
            // The widget callback or ComfyUI pipeline will handle step constraints if needed

            // Apply precision
            if (typeof constraints.precision === 'number') {
                numValue = parseFloat(numValue.toFixed(constraints.precision));
            }

            return numValue;
        }

        // Handle combo (validate against options)
        if (widgetType === 'combo' && constraints.options) {
            // Use string comparison since HTML select values are always strings
            const valueStr = String(value);
            const hasMatch = constraints.options.some(opt => String(opt) === valueStr);
            if (!hasMatch) {
                Logger.warn(`[WidgetSync] Invalid combo value "${value}", keeping current`);
                return widget.value;
            }
            // Return the original option type (may be number)
            const matchedOption = constraints.options.find(opt => String(opt) === valueStr);
            if (matchedOption !== undefined) {
                return matchedOption;
            }
        }

        // Handle boolean
        if (widgetType === 'toggle' || widgetType === 'boolean') {
            return Boolean(value);
        }

        // Text and other types - return as-is
        return value;
    }

    /**
     * Determine widget type from widget object
     */
    static getWidgetType(widget: any): string {
        if (!widget) return 'unknown';

        const type = (widget.type || '').toLowerCase();

        // Map ComfyUI widget types to our categories
        if (type === 'number' || type === 'int' || type === 'float') return 'number';
        if (type === 'combo' || type === 'string' && Array.isArray(widget.options)) return 'combo';
        if (type === 'toggle' || type === 'boolean') return 'boolean';
        if (type === 'slider') return 'slider';
        if (type === 'text' || type === 'string' || type === 'customtext') return 'text';

        // Check for array options (combo indicator)
        if (Array.isArray(widget.options) && widget.options.length > 0) {
            return 'combo';
        }

        // Default to text for unknown types
        return 'text';
    }

    /**
     * Check if a widget is editable
     */
    static isWidgetEditable(widget: any): boolean {
        if (!widget) return false;

        // Hidden widgets
        if (widget.hidden) return false;

        // Widgets marked as readonly
        if (widget.readonly) return false;

        // Check type
        const type = this.getWidgetType(widget);
        const editableTypes = ['number', 'text', 'combo', 'boolean', 'slider', 'INT', 'FLOAT'];

        return editableTypes.includes(type) || editableTypes.includes(type.toUpperCase());
    }

    /**
     * Force canvas redraw after widget update
     */
    static triggerCanvasRedraw(): void {
        try {
            if (app?.canvas) {
                if (typeof app.canvas.setDirty === 'function') {
                    app.canvas.setDirty(true, true);
                }
                if (typeof app.canvas.draw === 'function') {
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
    static getWidgetValue(nodeId: number, widgetName: string): unknown | null {
        try {
            if (!app?.graph) return null;

            const node = app.graph.getNodeById(nodeId);
            if (!node?.widgets) return null;

            const widget = node.widgets.find((w: any) => w.name === widgetName);
            return widget?.value ?? null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Validate a value against widget constraints without applying
     */
    static validateValue(nodeId: number, widgetName: string, value: unknown): { valid: boolean; error?: string } {
        const constraints = this.getWidgetConstraints(nodeId, widgetName);
        if (!constraints) {
            return { valid: true }; // No constraints = valid
        }

        // Number validation
        if (typeof value === 'number') {
            if (typeof constraints.min === 'number' && value < constraints.min) {
                return { valid: false, error: `Value must be at least ${constraints.min}` };
            }
            if (typeof constraints.max === 'number' && value > constraints.max) {
                return { valid: false, error: `Value must be at most ${constraints.max}` };
            }
        }

        // Combo validation - use string comparison
        if (constraints.options) {
            const valueStr = String(value);
            const hasMatch = constraints.options.some(opt => String(opt) === valueStr);
            if (!hasMatch) {
                return { valid: false, error: `Invalid option selected` };
            }
        }

        return { valid: true };
    }
}
