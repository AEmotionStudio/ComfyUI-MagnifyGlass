class InformationGatherer {
  constructor() {
  }
  getNodeUnderCursor() {
    var _a, _b;
    const magnifyGlass = window.comfyUIMagnifyGlass;
    const graph = (_a = app.canvas) == null ? void 0 : _a.graph;
    if (!graph || !magnifyGlass) {
      return null;
    }
    if (((_b = window.LiteGraph) == null ? void 0 : _b.vueNodesMode) && !app.canvas.read_only) {
      const { x, y } = magnifyGlass.lastKnownMousePosition;
      const nodeEl = document.elementsFromPoint(x, y).map((el) => el.closest(".lg-node[data-node-id]")).find(Boolean);
      return nodeEl ? graph.getNodeById(Number(nodeEl.dataset.nodeId)) ?? null : null;
    }
    if (app.canvas.node_over) {
      return app.canvas.node_over;
    }
    try {
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
      return graph.getNodeOnPos(graphPos[0], graphPos[1]) ?? null;
    } catch (err) {
      console.warn("Error in node detection:", err);
    }
    return null;
  }
  getDetailedNodeInfo(node) {
    var _a, _b, _c, _d, _e, _f;
    let category;
    let executionOrder;
    let pythonModule;
    try {
      const nodeData = (_a = node.constructor) == null ? void 0 : _a.nodeData;
      if (nodeData) {
        pythonModule = nodeData.python_module;
        category = nodeData.category;
      }
      if (!pythonModule && typeof LiteGraph !== "undefined") {
        const nodeType = (_b = LiteGraph.registered_node_types) == null ? void 0 : _b[node.type];
        if (nodeType) {
          category = nodeType.category || category;
          pythonModule = (_c = nodeType.nodeData) == null ? void 0 : _c.python_module;
        }
      }
      executionOrder = node.order;
    } catch (e) {
    }
    const subgraphNodes = this.getSubgraphNodes(node.graph);
    return {
      id: node.id,
      title: node.title || "Untitled Node",
      type: node.type,
      mode: this.getNodeModeText(node.mode),
      position: {
        x: Math.round(node.pos[0]),
        y: Math.round(node.pos[1])
      },
      size: {
        width: Math.round(node.size[0]),
        height: Math.round(node.size[1])
      },
      widgets: node.widgets || [],
      inputs: node.inputs || [],
      outputs: node.outputs || [],
      properties: node.properties || {},
      executionOrder,
      category,
      pythonModule,
      graphPath: subgraphNodes.map((subgraphNode) => subgraphNode.subgraph.name || "Subgraph"),
      executionId: [...subgraphNodes, node].map((pathNode) => pathNode.id).join(":"),
      locatorId: subgraphNodes.length ? `${node.graph.id}:${node.id}` : String(node.id),
      group: (_e = (_d = node.graph) == null ? void 0 : _d.getGroupOnPos(node.pos[0] + node.size[0] / 2, node.pos[1] + node.size[1] / 2)) == null ? void 0 : _e.title,
      isSubgraph: !!((_f = node.isSubgraphNode) == null ? void 0 : _f.call(node))
    };
  }
  /**
   * The subgraph nodes that lead from the root graph to this one.
   */
  getSubgraphNodes(graph) {
    if (!graph || graph.rootGraph === graph) return [];
    const find = (nodes, path) => {
      var _a;
      for (const node of nodes) {
        if (!node.subgraph || !((_a = node.isSubgraphNode) == null ? void 0 : _a.call(node))) continue;
        const subPath = [...path, node];
        const found = node.subgraph === graph ? subPath : find(node.subgraph._nodes, subPath);
        if (found) return found;
      }
      return null;
    };
    return find(graph.rootGraph._nodes, []) ?? [];
  }
  getNodeModeText(mode) {
    const modes = {
      0: "Always",
      1: "On Event",
      2: "Mute",
      3: "On Trigger",
      4: "Bypass"
    };
    return modes[mode] || `Mode ${mode}`;
  }
}
export {
  InformationGatherer
};
