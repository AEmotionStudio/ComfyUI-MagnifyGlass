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
    round?: number;
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
    /**
     * Update a widget value on a node in the graph on screen
     * @param nodeId - The node ID
     * @param widgetName - The widget name
     * @param value - The new value to set
     * @param recordUndo - Record an undo step now; drags pass false and record once on release
     * @returns SyncResult indicating success or failure
     */
    static syncWidgetValue(nodeId: number, widgetName: string, value: unknown, recordUndo: boolean = true): SyncResult {
        try {
            const node = app?.canvas?.graph?.getNodeById(nodeId);
            if (!node) {
                return { success: false, error: `Node ${nodeId} not found` };
            }

            const widget = node.widgets?.find((w: any) => w.name === widgetName);
            if (!widget) {
                return { success: false, error: `Widget "${widgetName}" not found on node ${nodeId}` };
            }

            const previousValue = widget.value;
            const constrainedValue = this.applyConstraints(value, widget);

            // setValue runs the callback, onWidgetChanged and bumps the graph version, like a canvas edit
            if (typeof widget.setValue === 'function') {
                widget.setValue(constrainedValue, { node, canvas: app.canvas });
            } else {
                widget.value = constrainedValue;
                widget.callback?.(constrainedValue, app.canvas, node, app.canvas.graph_mouse);
            }

            node.graph?.setDirtyCanvas(true, true);
            if (recordUndo) this.recordUndo();

            Logger.debug(`[WidgetSync] Updated ${widgetName} on node ${nodeId}: ${previousValue} → ${widget.value}`);

            return {
                success: true,
                previousValue,
                newValue: widget.value
            };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            Logger.error(`[WidgetSync] Error syncing widget:`, error);
            return { success: false, error: message };
        }
    }

    /**
     * Run a button widget's callback on a node in the graph on screen
     */
    static clickButton(nodeId: number, widgetName: string): void {
        const node = app?.canvas?.graph?.getNodeById(nodeId);
        const widget = node?.widgets?.find((w: any) => w.name === widgetName);
        if (typeof widget?.callback !== 'function') {
            Logger.warn(`[WidgetSync] Button ${widgetName} not found on node ${nodeId}`);
            return;
        }
        try {
            widget.callback(widget.value, app.canvas, node, [0, 0], null);
        } catch (error) {
            Logger.warn(`[WidgetSync] Button callback failed:`, error);
        }
    }

    /**
     * Let ComfyUI's change tracker pick up the edit as an undo step
     */
    static recordUndo(): void {
        app?.extensionManager?.workflow?.activeWorkflow?.changeTracker?.checkState();
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
        const options = widget.options;
        if (options && !Array.isArray(options)) {
            if (typeof options.min === 'number') constraints.min = options.min;
            if (typeof options.max === 'number') constraints.max = options.max;
            // ComfyUI stores step as 10x the input step and the real one as step2
            if (typeof options.step2 === 'number') constraints.step = options.step2;
            else if (typeof options.step === 'number') constraints.step = options.step / 10;
            if (typeof options.round === 'number' && options.round > 0) constraints.round = options.round;
            if (typeof options.precision === 'number') constraints.precision = options.precision;
            const values = typeof options.values === 'function' ? options.values(widget, widget.node) : options.values;
            if (Array.isArray(values)) {
                constraints.options = values;
            }
        }

        // Combo widget options (array of values)
        if (Array.isArray(options)) {
            constraints.options = options;
        }

        return constraints;
    }

    /**
     * Step for one nudge of a number widget. Shift is x10, Alt is x0.1 but never finer than the widget stores.
     */
    static getStep(constraints: WidgetConstraints | undefined, e?: { shiftKey: boolean; altKey: boolean }): number {
        const step = constraints?.step ?? 1;
        if (e?.shiftKey) return step * 10;
        if (e?.altKey) return Math.max(step / 10, constraints?.round ?? 10 ** -(constraints?.precision ?? 3));
        return step;
    }

    /**
     * Apply constraints to a value
     */
    static applyConstraints(value: unknown, widget: any): unknown {
        const constraints = this.extractConstraints(widget);
        const widgetType = this.getWidgetType(widget);

        // Handle number types
        if (widgetType === 'INT' || widgetType === 'FLOAT' || widgetType === 'slider') {
            let numValue = typeof value === 'number' ? value : parseFloat(String(value));

            if (isNaN(numValue)) {
                return widget.value; // Return current value if invalid
            }

            if (constraints.round) {
                numValue = Math.round(numValue / constraints.round) * constraints.round;
            }
            if (typeof constraints.precision === 'number') {
                numValue = parseFloat(numValue.toFixed(constraints.precision));
            }

            if (typeof constraints.min === 'number') {
                numValue = Math.max(constraints.min, numValue);
            }
            if (typeof constraints.max === 'number') {
                numValue = Math.min(constraints.max, numValue);
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

        // Button widgets - explicit type check
        if (type === 'button') return 'button';

        // Map ComfyUI widget types to our categories. INT and FLOAT both use 'number'; INT has precision 0.
        if (type === 'number' || type === 'knob') return widget.options?.precision === 0 ? 'INT' : 'FLOAT';
        if (type === 'combo' || type === 'string' && Array.isArray(widget.options)) return 'combo';
        if (type === 'toggle' || type === 'boolean') return 'boolean';
        if (type === 'slider') return 'slider';
        if (type === 'customtext' || widget.options?.multiline) return 'multiline';
        if (type === 'text' || type === 'string') return 'text';

        // Check for array options (combo indicator)
        if (Array.isArray(widget.options) && widget.options.length > 0) {
            return 'combo';
        }

        // Heuristic: detect button widgets by name patterns and callback presence
        if (typeof widget.callback === 'function' && widget.name) {
            const name = widget.name.toLowerCase();
            // Button-like name patterns
            const buttonPatterns = ['show', 'save', 'open', 'load', 'export', 'import', 'reset', 'clear', 'apply', 'run', 'execute', 'preview', 'refresh', 'update'];
            const hasButtonName = buttonPatterns.some(pattern => name.includes(pattern));
            // Non-meaningful values suggest it's an action button, not an editable field
            const hasNonEditableValue = widget.value === undefined || widget.value === null || typeof widget.value === 'boolean';

            if (hasButtonName && hasNonEditableValue) {
                return 'button';
            }
        }

        // Fallback: widgets with callback but no value and no options are likely buttons
        if (typeof widget.callback === 'function' && widget.value === undefined && !Array.isArray(widget.options)) {
            return 'button';
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

        // Writing a string over an object value would corrupt it
        if (widget.value !== null && typeof widget.value === 'object') return false;

        const type = this.getWidgetType(widget);

        // DOM widgets own their element; only the multiline textarea maps to a plain value
        if (widget.element && type !== 'multiline') return false;

        return ['INT', 'FLOAT', 'text', 'multiline', 'combo', 'boolean', 'slider'].includes(type);
    }

    /**
     * Get current value of a widget
     */
    static getWidgetValue(nodeId: number, widgetName: string): unknown | null {
        const widget = app?.canvas?.graph?.getNodeById(nodeId)?.widgets?.find((w: any) => w.name === widgetName);
        return widget?.value ?? null;
    }
}
