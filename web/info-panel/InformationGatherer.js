class InformationGatherer {
  constructor() {
  }
  gatherInformation() {
    var _a, _b;
    const magnifyGlass = window.comfyUIMagnifyGlass;
    if (!magnifyGlass) {
      return {
        timestamp: Date.now(),
        cursor: { screenX: 0, screenY: 0, canvasX: 0, canvasY: 0 },
        zoom: 1,
        nodeCount: 0,
        hoveredNode: null,
        hoveredWidget: null,
        mediaElement: null
      };
    }
    const info = {
      timestamp: Date.now(),
      cursor: {
        screenX: magnifyGlass.lastKnownMousePosition.x,
        screenY: magnifyGlass.lastKnownMousePosition.y,
        canvasX: magnifyGlass.state.x,
        canvasY: magnifyGlass.state.y
      },
      zoom: magnifyGlass.state.canvasScale,
      nodeCount: ((_b = (_a = app.graph) == null ? void 0 : _a._nodes) == null ? void 0 : _b.length) ?? 0,
      hoveredNode: null,
      hoveredWidget: null,
      mediaElement: null
    };
    if (magnifyGlass.isOverMedia && magnifyGlass.currentMediaElement) {
      info.mediaElement = this.getMediaInfo(magnifyGlass.currentMediaElement);
    }
    const nodeUnderCursor = this.getNodeUnderCursor();
    if (nodeUnderCursor) {
      info.hoveredNode = this.getDetailedNodeInfo(nodeUnderCursor.node, nodeUnderCursor.localPos);
      const widget = this.getWidgetUnderCursor(nodeUnderCursor.node, nodeUnderCursor.localPos);
      if (widget) {
        info.hoveredWidget = this.getWidgetInfo(widget);
      }
    }
    return info;
  }
  getNodeUnderCursor() {
    const magnifyGlass = window.comfyUIMagnifyGlass;
    if (!app.graph || !app.canvas || !magnifyGlass) {
      return null;
    }
    try {
      if (app.canvas.node_over) {
        const node = app.canvas.node_over;
        if (node && node.pos && node.size) {
          const canvasRect2 = app.canvas.canvas.getBoundingClientRect();
          const mouseX2 = magnifyGlass.lastKnownMousePosition.x - canvasRect2.left;
          const mouseY2 = magnifyGlass.lastKnownMousePosition.y - canvasRect2.top;
          let graphPos2;
          if (app.canvas.convertOffsetToCanvasPos) {
            graphPos2 = app.canvas.convertOffsetToCanvasPos([mouseX2, mouseY2]);
          } else {
            const ds = app.canvas.ds || { scale: 1, offset: [0, 0] };
            graphPos2 = [
              mouseX2 / ds.scale - ds.offset[0] / ds.scale,
              mouseY2 / ds.scale - ds.offset[1] / ds.scale
            ];
          }
          return {
            node,
            localPos: {
              x: graphPos2[0] - node.pos[0],
              y: graphPos2[1] - node.pos[1]
            }
          };
        }
      }
      const canvasRect = app.canvas.canvas.getBoundingClientRect();
      const mouseX = magnifyGlass.lastKnownMousePosition.x - canvasRect.left;
      const mouseY = magnifyGlass.lastKnownMousePosition.y - canvasRect.top;
      let graphPos;
      if (app.canvas.convertOffsetToCanvasPos) {
        graphPos = app.canvas.convertOffsetToCanvasPos([mouseX, mouseY]);
      } else {
        const ds = app.canvas.ds || { scale: 1, offset: [0, 0] };
        graphPos = [
          mouseX / ds.scale - ds.offset[0] / ds.scale,
          mouseY / ds.scale - ds.offset[1] / ds.scale
        ];
      }
      for (let i = app.graph._nodes.length - 1; i >= 0; i--) {
        const node = app.graph._nodes[i];
        if (!node.pos || !node.size || node.flags && node.flags.collapsed) continue;
        if (graphPos[0] >= node.pos[0] && graphPos[0] <= node.pos[0] + node.size[0] && graphPos[1] >= node.pos[1] && graphPos[1] <= node.pos[1] + node.size[1]) {
          return {
            node,
            localPos: {
              x: graphPos[0] - node.pos[0],
              y: graphPos[1] - node.pos[1]
            }
          };
        }
      }
    } catch (err) {
      console.warn("Error in node detection:", err);
    }
    return null;
  }
  getDetailedNodeInfo(node, localPos) {
    var _a, _b, _c, _d;
    let author;
    let category;
    let executionOrder;
    try {
      const nodeData = (_a = node.constructor) == null ? void 0 : _a.nodeData;
      if (nodeData) {
        author = nodeData.author || ((_b = nodeData.python_module) == null ? void 0 : _b.split(".")[0]);
        category = nodeData.category;
      }
      if (!author && typeof LiteGraph !== "undefined") {
        const nodeType = (_c = LiteGraph.registered_node_types) == null ? void 0 : _c[node.type];
        if (nodeType) {
          author = ((_d = nodeType.nodeData) == null ? void 0 : _d.author) || nodeType.author;
          category = nodeType.category || category;
        }
      }
      executionOrder = node.order;
    } catch (e) {
    }
    return {
      id: node.id,
      title: node.title || "Untitled Node",
      type: node.type,
      mode: this.getNodeModeText(node.mode),
      position: {
        x: Math.round(node.pos[0]),
        y: Math.round(node.pos[1]),
        formatted: `(${Math.round(node.pos[0])}, ${Math.round(node.pos[1])})`
      },
      size: {
        width: Math.round(node.size[0]),
        height: Math.round(node.size[1]),
        formatted: `${Math.round(node.size[0])}×${Math.round(node.size[1])}`
      },
      localPosition: {
        x: Math.round(localPos.x),
        y: Math.round(localPos.y),
        formatted: `(${Math.round(localPos.x)}, ${Math.round(localPos.y)})`,
        percentage: {
          x: (localPos.x / node.size[0] * 100).toFixed(1),
          y: (localPos.y / node.size[1] * 100).toFixed(1)
        }
      },
      counts: {
        widgets: node.widgets ? node.widgets.length : 0,
        inputs: node.inputs ? node.inputs.length : 0,
        outputs: node.outputs ? node.outputs.length : 0,
        properties: node.properties ? Object.keys(node.properties).length : 0
      },
      widgets: node.widgets || [],
      inputs: node.inputs || [],
      outputs: node.outputs || [],
      properties: node.properties || {},
      hoverRegion: this.detectNodeRegion(localPos, node),
      executionOrder,
      author,
      category
    };
  }
  getNodeInfo(node) {
    return {
      id: node.id,
      title: node.title || "Untitled",
      type: node.type,
      mode: node.mode,
      size: node.size ? `${Math.round(node.size[0])}×${Math.round(node.size[1])}` : "Unknown",
      position: node.pos ? `(${Math.round(node.pos[0])}, ${Math.round(node.pos[1])})` : "Unknown",
      widgets: node.widgets || [],
      inputs: node.inputs || [],
      outputs: node.outputs || [],
      properties: node.properties || {}
    };
  }
  getWidgetUnderCursor(node, localPos) {
    if (!node.widgets || !node.widgets.length) return null;
    const titleHeight = 30;
    let currentY = titleHeight;
    for (const widget of node.widgets) {
      const widgetHeight = 25;
      if (localPos.y >= currentY && localPos.y <= currentY + widgetHeight) {
        return widget;
      }
      currentY += widgetHeight + 5;
    }
    return null;
  }
  getWidgetInfo(widget) {
    return {
      name: widget.name,
      type: widget.type,
      value: this.formatValue(widget.value),
      options: widget.options || null,
      min: widget.min,
      max: widget.max,
      step: widget.step
    };
  }
  getMediaInfo(mediaElement) {
    const info = {
      type: mediaElement instanceof HTMLImageElement ? "image" : "video",
      tagName: mediaElement.tagName,
      src: mediaElement.src ? mediaElement.src.substring(mediaElement.src.lastIndexOf("/") + 1) : "No source",
      naturalWidth: 0,
      naturalHeight: 0,
      displayWidth: 0,
      displayHeight: 0,
      aspectRatio: ""
    };
    if (mediaElement instanceof HTMLImageElement) {
      info.naturalWidth = mediaElement.naturalWidth;
      info.naturalHeight = mediaElement.naturalHeight;
      info.displayWidth = Math.round(mediaElement.width);
      info.displayHeight = Math.round(mediaElement.height);
      if (mediaElement.naturalWidth && mediaElement.naturalHeight) {
        info.aspectRatio = (mediaElement.naturalWidth / mediaElement.naturalHeight).toFixed(2);
      }
    } else if (mediaElement instanceof HTMLVideoElement) {
      info.naturalWidth = mediaElement.videoWidth;
      info.naturalHeight = mediaElement.videoHeight;
      info.displayWidth = Math.round(mediaElement.width);
      info.displayHeight = Math.round(mediaElement.height);
      info.duration = mediaElement.duration;
      info.currentTime = mediaElement.currentTime;
      if (mediaElement.videoWidth && mediaElement.videoHeight) {
        info.aspectRatio = (mediaElement.videoWidth / mediaElement.videoHeight).toFixed(2);
      }
    }
    return info;
  }
  getNodeModeText(mode) {
    const modes = {
      0: "Always",
      1: "On Event",
      2: "Never",
      3: "On Trigger",
      4: "On Request"
    };
    return modes[mode] || `Mode ${mode}`;
  }
  detectNodeRegion(localPos, node) {
    const titleHeight = 30;
    const regions = [];
    if (localPos.y <= titleHeight) {
      regions.push("Title Bar");
    }
    if (localPos.x <= 10) {
      regions.push("Left Edge");
    } else if (localPos.x >= node.size[0] - 10) {
      regions.push("Right Edge");
    }
    if (localPos.y <= 10) {
      regions.push("Top Edge");
    } else if (localPos.y >= node.size[1] - 10) {
      regions.push("Bottom Edge");
    }
    if (regions.length === 0) {
      if (localPos.y > titleHeight) {
        regions.push("Content Area");
      }
    }
    if (localPos.x <= 20 && localPos.y > titleHeight) {
      regions.push("Input Area");
    } else if (localPos.x >= node.size[0] - 20 && localPos.y > titleHeight) {
      regions.push("Output Area");
    }
    return regions.length > 0 ? regions.join(", ") : "Unknown";
  }
  formatValue(value) {
    if (value === null) return "null";
    if (value === void 0) return "undefined";
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number") {
      return Number.isInteger(value) ? value.toString() : value.toFixed(3);
    }
    if (typeof value === "boolean") return value.toString();
    if (Array.isArray(value)) {
      return `Array(${value.length})`;
    }
    if (typeof value === "object") {
      return "Object";
    }
    return String(value);
  }
}
export {
  InformationGatherer
};
//# sourceMappingURL=InformationGatherer.js.map
