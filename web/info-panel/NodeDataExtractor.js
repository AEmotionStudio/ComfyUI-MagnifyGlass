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
const COMPLEX_NODE_PARAMS = [
  "seed",
  "steps",
  "cfg",
  "scale",
  "sampler",
  "scheduler",
  "positive",
  "negative",
  "width",
  "height",
  "denoise",
  "strength",
  "noise",
  "count",
  "batch",
  "size",
  "phase",
  "color",
  "intensity",
  "control_after_generate",
  "control",
  "after",
  "generate",
  "start_at_step",
  "end_at_step",
  "start",
  "end",
  "return_with_leftover_noise",
  "leftover",
  "noise_return",
  "model",
  "vae",
  "clip",
  "lora",
  "checkpoint",
  "latent",
  "image",
  "mask",
  "filename",
  "directory",
  "prompt",
  "conditioning",
  "filename_prefix",
  "resolution",
  "num_chunks",
  "seconds",
  "aspect_ratio",
  "style_type",
  "background",
  "n",
  "human",
  "raw",
  "guidance",
  "skip_preprocessing",
  "movement_amplitude",
  "animation",
  "material_type",
  "b1",
  "b2",
  "s1",
  "s2",
  "type",
  "channel",
  "sigma",
  "rho",
  "alpha",
  "base_shift",
  "shift",
  "stretch",
  "terminal",
  "spacing",
  "style",
  "eta",
  "norm_threshold",
  "momentum",
  "hypernetwork_name",
  "reuse_threshold",
  "verbose",
  "layers",
  "set_cond_area",
  "audioui",
  "camera_pose",
  "fx",
  "cx",
  "fy",
  "cy"
];
const SAVE_NODE_PARAMS = [
  "filename_prefix",
  "filename",
  "directory",
  "path",
  "format",
  "quality",
  "extension"
];
const SKIP_WIDGET_NAMES = ["title", "node", "id", "type", "mode"];
function shouldShowAllWidgets(nodeType) {
  const type = nodeType.toLowerCase();
  const isSaveNode = type.includes("save") && !type.includes("checkpoint") && !type.includes("model") && !type.includes("preview");
  return (type.includes("ksampler") || type.includes("sampler") || type.includes("k_samplers") || type.includes("checkpoint") || type.includes("model") || type.includes("lora") || type.includes("controlnet") || type.includes("advanced") || type.includes("detailer") || type.includes("inpaint") || type.includes("upscale") || type.includes("clip") || type.includes("text") || type.includes("encode")) && !isSaveNode;
}
function getImportantNodeParameters(nodeInfo) {
  const parameters = [];
  if (!nodeInfo.widgets || nodeInfo.widgets.length === 0) {
    return parameters;
  }
  const nodeType = nodeInfo.type || "";
  const typeLower = nodeType.toLowerCase();
  const isSaveNode = typeLower.includes("save") && !typeLower.includes("checkpoint") && !typeLower.includes("model") && !typeLower.includes("preview");
  const seenValues = /* @__PURE__ */ new Set();
  const normalizeValue = (value) => {
    if (value === null || value === void 0) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    return JSON.stringify(value);
  };
  const isMeaningfulValue = (value) => {
    if (value === null || value === void 0) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  };
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
  const addIfNotDuplicate = (widget) => {
    const normalizedValue = normalizeValue(widget.value);
    if (typeof widget.value === "string" && isMeaningfulValue(widget.value)) {
      if (seenValues.has(normalizedValue)) {
        return false;
      }
      seenValues.add(normalizedValue);
    }
    parameters.push(createParameterItem(widget));
    return true;
  };
  if (nodeType && shouldShowAllWidgets(nodeType)) {
    for (const widget of nodeInfo.widgets) {
      if (widget.name && widget.name !== "") {
        const widgetName = widget.name.toLowerCase();
        if (!SKIP_WIDGET_NAMES.some((skip) => widgetName.includes(skip))) {
          addIfNotDuplicate(widget);
        }
      }
    }
    return parameters;
  }
  const importantParams = isSaveNode ? SAVE_NODE_PARAMS : COMPLEX_NODE_PARAMS;
  for (const widget of nodeInfo.widgets) {
    const paramName = widget.name.toLowerCase();
    if (importantParams.some((param) => paramName.includes(param))) {
      addIfNotDuplicate(widget);
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
//# sourceMappingURL=NodeDataExtractor.js.map
