import { formatWidgetValue } from "./ValueFormatter.js";
import { WidgetSyncManager } from "./widget-editors/WidgetSyncManager.js";
const SKIP_WIDGET_NAMES = ["title", "node", "id", "type", "mode"];
function getImportantNodeParameters(nodeInfo) {
  const parameters = [];
  if (!nodeInfo.widgets || nodeInfo.widgets.length === 0) {
    return parameters;
  }
  const inputs = nodeInfo.inputs || [];
  const widgetSlot = (widget) => inputs.find((input) => {
    var _a;
    return ((_a = input.widget) == null ? void 0 : _a.name) === widget.name;
  });
  const createParameterItem = (widget) => {
    var _a;
    const widgetType = WidgetSyncManager.getWidgetType(widget);
    const constraints = WidgetSyncManager.extractConstraints(widget);
    const isLinked = !!widget.computedDisabled || ((_a = widgetSlot(widget)) == null ? void 0 : _a.link) != null;
    const isEditable = !isLinked && WidgetSyncManager.isWidgetEditable(widget);
    const isActionable = widgetType === "button";
    return {
      label: widget.label || widget.name,
      value: formatWidgetValue(widget.value, constraints.precision),
      // Editing metadata
      widgetName: widget.name,
      widgetType,
      isEditable,
      isActionable,
      isLinked,
      rawValue: widget.value,
      constraints,
      nodeId: nodeInfo.id
    };
  };
  for (const widget of nodeInfo.widgets) {
    if (widget.name && !widget.name.startsWith("$$") && (!SKIP_WIDGET_NAMES.includes(widget.name.toLowerCase()) || widgetSlot(widget))) {
      parameters.push(createParameterItem(widget));
    }
  }
  return parameters;
}
const SUBGRAPH_INPUT_ID = -10;
const SUBGRAPH_OUTPUT_ID = -20;
const slotName = (slot) => slot ? slot.label || slot.localized_name || slot.name : "";
function getSlotLinks(node) {
  var _a, _b;
  const graph = node.graph;
  const required = ((_b = (_a = node.constructor.nodeData) == null ? void 0 : _a.input) == null ? void 0 : _b.required) ?? {};
  const inputs = (node.inputs ?? []).flatMap((input, slot) => {
    var _a2, _b2;
    if (input.widget && input.link == null) return [];
    const link = input.link == null ? void 0 : graph.links.get(input.link);
    const origin = node.getInputNode(slot);
    let linked = [];
    if ((link == null ? void 0 : link.origin_id) === SUBGRAPH_INPUT_ID) linked = [{ title: "Subgraph input", slot: slotName((_a2 = graph.inputs) == null ? void 0 : _a2[link.origin_slot]) }];
    else if (link && origin) linked = [{ id: origin.id, title: origin.title || "Untitled", slot: slotName((_b2 = origin.outputs) == null ? void 0 : _b2[link.origin_slot]) }];
    return [{ name: slotName(input), type: input.type, linked, missing: input.link == null && input.name in required }];
  });
  const outputs = (node.outputs ?? []).map((output) => ({
    name: slotName(output),
    type: output.type,
    linked: (output.links ?? []).flatMap((id) => {
      var _a2, _b2;
      const link = graph.links.get(id);
      if ((link == null ? void 0 : link.target_id) === SUBGRAPH_OUTPUT_ID) return [{ title: "Subgraph output", slot: slotName((_a2 = graph.outputs) == null ? void 0 : _a2[link.target_slot]) }];
      const target = link && graph.getNodeById(link.target_id);
      return link && target ? [{ id: target.id, title: target.title || "Untitled", slot: slotName((_b2 = target.inputs) == null ? void 0 : _b2[link.target_slot]) }] : [];
    })
  }));
  return { inputs, outputs };
}
export {
  getImportantNodeParameters,
  getSlotLinks
};
