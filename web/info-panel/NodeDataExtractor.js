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
    if (widget.name && (!SKIP_WIDGET_NAMES.includes(widget.name.toLowerCase()) || widgetSlot(widget))) {
      parameters.push(createParameterItem(widget));
    }
  }
  return parameters;
}
export {
  getImportantNodeParameters
};
