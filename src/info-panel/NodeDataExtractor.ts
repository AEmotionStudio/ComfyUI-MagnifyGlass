/**
 * ComfyUI MagnifyGlass - Node Data Extractor
 * 
 * Utility functions for extracting specific information from nodes.
 * Extracted from UIManager.ts for better modularity.
 */

import { formatWidgetValue } from './ValueFormatter';
import type { ComfyNode, ComfySlot, NodeInfo } from '../types/comfyui';
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

/**
 * A slot and the nodes at the other end of its links.
 */
export interface SlotLinks {
    name: string;
    type: string;
    /** No id when the other end is the subgraph's own input or output */
    linked: { id?: number; title: string; slot: string }[];
    /** Inputs only: the node requires it and nothing is connected */
    missing?: boolean;
}

// LiteGraph's ids for a subgraph's own input and output nodes
const SUBGRAPH_INPUT_ID = -10;
const SUBGRAPH_OUTPUT_ID = -20;

const slotName = (slot: ComfySlot | undefined) => slot ? slot.label || slot.localized_name || slot.name : '';

/**
 * The node's inputs and outputs with the nodes they link to. Inputs a widget sets are left out until they are linked.
 */
export function getSlotLinks(node: ComfyNode): { inputs: SlotLinks[]; outputs: SlotLinks[] } {
    const graph = node.graph!;
    const required = (node.constructor as any).nodeData?.input?.required ?? {};
    const inputs = (node.inputs ?? []).flatMap((input, slot) => {
        if (input.widget && input.link == null) return [];
        const link = input.link == null ? undefined : graph.links.get(input.link);
        const origin = node.getInputNode(slot);
        let linked: SlotLinks['linked'] = [];
        if (link?.origin_id === SUBGRAPH_INPUT_ID) linked = [{ title: 'Subgraph input', slot: slotName(graph.inputs?.[link.origin_slot]) }];
        else if (link && origin) linked = [{ id: origin.id, title: origin.title || 'Untitled', slot: slotName(origin.outputs?.[link.origin_slot]) }];
        return [{ name: slotName(input), type: input.type, linked, missing: input.link == null && input.name in required }];
    });
    const outputs = (node.outputs ?? []).map(output => ({
        name: slotName(output),
        type: output.type,
        linked: (output.links ?? []).flatMap(id => {
            const link = graph.links.get(id);
            if (link?.target_id === SUBGRAPH_OUTPUT_ID) return [{ title: 'Subgraph output', slot: slotName(graph.outputs?.[link.target_slot]) }];
            const target = link && graph.getNodeById(link.target_id);
            return link && target ? [{ id: target.id, title: target.title || 'Untitled', slot: slotName(target.inputs?.[link.target_slot]) }] : [];
        })
    }));
    return { inputs, outputs };
}
