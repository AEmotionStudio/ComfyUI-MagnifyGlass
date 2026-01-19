import { formatWidgetValue } from "./ValueFormatter.js";
import { WidgetSyncManager } from "./widget-editors/WidgetSyncManager.js";
function getCheckpointInfo(nodeInfo) {
  if (nodeInfo.type && (nodeInfo.type.includes("CheckpointLoader") || nodeInfo.type.includes("LoadCheckpoint") || nodeInfo.type.includes("ModelLoader") || nodeInfo.type.includes("UNETLoader") || nodeInfo.type.includes("VAELoader") || nodeInfo.type.includes("LoraLoader"))) {
    if (nodeInfo.widgets && nodeInfo.widgets.length > 0) {
      for (const widget of nodeInfo.widgets) {
        if (widget.name && (widget.name.toLowerCase().includes("model") || widget.name.toLowerCase().includes("checkpoint") || widget.name.toLowerCase().includes("ckpt") || widget.name.toLowerCase().includes("lora") || widget.name.toLowerCase().includes("vae") || widget.name.toLowerCase().includes("file"))) {
          const value = String(widget.value);
          const filename = value.split(/[\/\\]/).pop();
          return filename || value;
        }
      }
    }
  }
  return null;
}
function getImageInfo(nodeInfo) {
  if (nodeInfo.type && (nodeInfo.type.includes("SaveImage") || nodeInfo.type.includes("PreviewImage") || nodeInfo.type.includes("VisionOutput") || nodeInfo.type.includes("ImageOutput") || nodeInfo.type.includes("LoadImage") || nodeInfo.type.includes("Display"))) {
    if (nodeInfo.widgets) {
      for (const widget of nodeInfo.widgets) {
        if (widget.name && (widget.name.toLowerCase().includes("image") || widget.name.toLowerCase().includes("filename") || widget.name.toLowerCase().includes("file"))) {
          return String(widget.value);
        }
      }
    }
    if (nodeInfo.properties && nodeInfo.properties.img) {
      const img = nodeInfo.properties.img;
      return {
        width: img.width || "unknown",
        height: img.height || "unknown",
        src: img.src ? String(img.src).split(/[\/\\]/).pop() || "Preview available" : "Preview available"
      };
    }
    if (nodeInfo.outputs) {
      for (const output of nodeInfo.outputs) {
        if (output.links && output.links.length > 0) {
          return "Image connected to " + output.links.length + " node(s)";
        }
      }
    }
    return "Image node";
  }
  return null;
}
function getTextBoxContent(nodeInfo) {
  if (nodeInfo.widgets && nodeInfo.widgets.length > 0) {
    if (nodeInfo.type && nodeInfo.type.includes("CLIPTextEncode")) {
      for (const widget of nodeInfo.widgets) {
        if (widget.name === "text" && typeof widget.value === "string") {
          return widget.value;
        }
      }
    }
    for (const widget of nodeInfo.widgets) {
      if ((widget.name.toLowerCase().includes("prompt") || widget.name.toLowerCase().includes("conditioning")) && typeof widget.value === "string" && widget.value.length > 0) {
        return widget.value;
      }
    }
    for (const widget of nodeInfo.widgets) {
      if ((widget.type === "text" || widget.type === "textarea" || widget.type === "string" || widget.name.toLowerCase().includes("text")) && typeof widget.value === "string" && widget.value.length > 0) {
        return widget.value;
      }
    }
  }
  return null;
}
const SKIP_WIDGET_NAMES = ["title", "node", "id", "type", "mode"];
function getImportantNodeParameters(nodeInfo) {
  const parameters = [];
  if (!nodeInfo.widgets || nodeInfo.widgets.length === 0) {
    return parameters;
  }
  const nodeType = nodeInfo.type || "";
  const typeLower = nodeType.toLowerCase();
  typeLower.includes("save") && !typeLower.includes("checkpoint") && !typeLower.includes("model") && !typeLower.includes("preview");
  const createParameterItem = (widget) => {
    const widgetType = WidgetSyncManager.getWidgetType(widget);
    const constraints = WidgetSyncManager.extractConstraints(widget);
    const isEditable = WidgetSyncManager.isWidgetEditable(widget);
    const isActionable = widgetType === "button";
    return {
      label: widget.name,
      value: formatWidgetValue(widget.value),
      // Editing metadata
      widgetName: widget.name,
      widgetType,
      isEditable,
      isActionable,
      rawValue: widget.value,
      constraints,
      nodeId: nodeInfo.id
    };
  };
  const addWidget = (widget) => {
    parameters.push(createParameterItem(widget));
    return true;
  };
  for (const widget of nodeInfo.widgets) {
    if (widget.name && widget.name !== "") {
      const widgetName = widget.name.toLowerCase();
      if (!SKIP_WIDGET_NAMES.includes(widgetName)) {
        addWidget(widget);
      }
    }
  }
  return parameters;
}
export {
  getCheckpointInfo,
  getImageInfo,
  getImportantNodeParameters,
  getTextBoxContent
};
