/**
 * ComfyUI MagnifyGlass - Node Data Extractor
 * 
 * Utility functions for extracting specific information from nodes.
 * Extracted from UIManager.ts for better modularity.
 */

import { formatWidgetValue } from './ValueFormatter';
import type { NodeInfo } from '../types/comfyui';
import { WidgetSyncManager, type WidgetConstraints } from './widget-editors/WidgetSyncManager';

/**
 * Interface for extracted parameter items.
 * Extended to support inline editing in the inspector panel.
 */
export interface ParameterItem {
    label: string;
    value: string;
    // Editing metadata
    widgetName?: string;       // Original widget name for syncing
    widgetType?: string;       // Widget type (number, combo, text, button, etc.)
    isEditable?: boolean;      // Whether this can be edited (value-based)
    isActionable?: boolean;    // Whether this is an action button (callback-based)
    isLinked?: boolean;        // Driven by a link, so shown read-only
    rawValue?: unknown;        // Original unformatted value
    constraints?: WidgetConstraints;  // Widget constraints for validation
    nodeId?: number;           // Node ID for sync operations
}

/**
 * Generic names to skip unless an input slot shows they are a real widget (CLIPLoader has a `type` widget).
 */
const SKIP_WIDGET_NAMES = ['title', 'node', 'id', 'type', 'mode'];

/**
 * The node's widgets as rows, with their editing metadata.
 */
export function getImportantNodeParameters(nodeInfo: NodeInfo): ParameterItem[] {
    const parameters: ParameterItem[] = [];

    if (!nodeInfo.widgets || nodeInfo.widgets.length === 0) {
        return parameters;
    }

    const inputs = nodeInfo.inputs || [];
    const widgetSlot = (widget: any) => inputs.find((input: any) => input.widget?.name === widget.name);

    // Helper to create parameter item with full metadata
    const createParameterItem = (widget: any): ParameterItem => {
        const widgetType = WidgetSyncManager.getWidgetType(widget);
        const constraints = WidgetSyncManager.extractConstraints(widget);
        const isLinked = !!widget.computedDisabled || widgetSlot(widget)?.link != null;
        const isEditable = !isLinked && WidgetSyncManager.isWidgetEditable(widget);
        // Button widgets are actionable (can be clicked to trigger callbacks)
        const isActionable = widgetType === 'button';

        return {
            label: widget.label || widget.name,
            value: formatWidgetValue(widget.value, constraints.precision),
            // Editing metadata
            widgetName: widget.name,
            widgetType: widgetType,
            isEditable: isEditable,
            isActionable: isActionable,
            isLinked: isLinked,
            rawValue: widget.value,
            constraints: constraints,
            nodeId: nodeInfo.id
        };
    };

    // Every named widget, as the pop-out shows them
    for (const widget of nodeInfo.widgets) {
        if (widget.name && (!SKIP_WIDGET_NAMES.includes(widget.name.toLowerCase()) || widgetSlot(widget))) {
            parameters.push(createParameterItem(widget));
        }
    }

    return parameters;
}
