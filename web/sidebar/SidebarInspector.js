import { app } from "/scripts/app.js";
const Icons = {
  chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`
};
let inspectorBody = null;
let updateInterval = null;
function formatNumber(value, decimals = 0) {
  return value.toFixed(decimals);
}
function getHoveredNode() {
  try {
    const graph = app.graph;
    if (!graph || !graph.canvas) return null;
    const canvas = graph.canvas;
    const mousePos = canvas.graph_mouse;
    if (!mousePos) return null;
    const nodes = graph._nodes;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      if (node.pos && node.size) {
        const [x, y] = node.pos;
        const [w, h] = node.size;
        if (mousePos[0] >= x && mousePos[0] <= x + w && mousePos[1] >= y && mousePos[1] <= y + h) {
          return node;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}
function getCanvasInfo() {
  var _a;
  try {
    const graph = app.graph;
    if (!graph || !graph.canvas) {
      return { scale: 1, cursor: { x: 0, y: 0 } };
    }
    const canvas = graph.canvas;
    const scale = ((_a = canvas.ds) == null ? void 0 : _a.scale) || 1;
    const mousePos = canvas.graph_mouse || [0, 0];
    return {
      scale: scale * 100,
      cursor: { x: mousePos[0] || 0, y: mousePos[1] || 0 }
    };
  } catch {
    return { scale: 1, cursor: { x: 0, y: 0 } };
  }
}
function createRow(label, value) {
  const row = document.createElement("div");
  row.className = "magnify-inspector-row";
  const labelEl = document.createElement("span");
  labelEl.className = "magnify-inspector-label";
  labelEl.textContent = label;
  const valueEl = document.createElement("span");
  valueEl.className = "magnify-inspector-value";
  valueEl.textContent = value;
  valueEl.title = value;
  row.appendChild(labelEl);
  row.appendChild(valueEl);
  return row;
}
function createGroup(title) {
  const group = document.createElement("div");
  group.className = "magnify-inspector-group";
  const titleEl = document.createElement("div");
  titleEl.className = "magnify-inspector-group-title";
  titleEl.textContent = title;
  group.appendChild(titleEl);
  return group;
}
function updateInspector() {
  var _a, _b;
  if (!inspectorBody) return;
  const canvasInfo = getCanvasInfo();
  const hoveredNode = getHoveredNode();
  inspectorBody.innerHTML = "";
  const canvasGroup = createGroup("Canvas");
  canvasGroup.appendChild(createRow("Cursor", `(${formatNumber(canvasInfo.cursor.x)}, ${formatNumber(canvasInfo.cursor.y)})`));
  canvasGroup.appendChild(createRow("Scale", `${formatNumber(canvasInfo.scale, 1)}%`));
  inspectorBody.appendChild(canvasGroup);
  const magnifyGlass = window.comfyUIMagnifyGlass;
  if (magnifyGlass) {
    const glassGroup = createGroup("Magnify Glass");
    glassGroup.appendChild(createRow("Zoom", `${formatNumber((((_a = magnifyGlass.config) == null ? void 0 : _a.zoomFactor) || 1) * 100)}%`));
    glassGroup.appendChild(createRow("Active", ((_b = magnifyGlass.state) == null ? void 0 : _b.active) ? "Yes" : "No"));
    inspectorBody.appendChild(glassGroup);
  }
  if (hoveredNode) {
    const nodeGroup = createGroup("Hovered Node");
    const badge = document.createElement("div");
    badge.className = "magnify-node-badge";
    badge.textContent = hoveredNode.type || "Unknown";
    nodeGroup.appendChild(badge);
    nodeGroup.appendChild(createRow("Title", hoveredNode.title || "Untitled"));
    nodeGroup.appendChild(createRow("ID", String(hoveredNode.id)));
    if (hoveredNode.pos) {
      nodeGroup.appendChild(createRow("Position", `(${formatNumber(hoveredNode.pos[0])}, ${formatNumber(hoveredNode.pos[1])})`));
    }
    if (hoveredNode.size) {
      nodeGroup.appendChild(createRow("Size", `${formatNumber(hoveredNode.size[0])} × ${formatNumber(hoveredNode.size[1])}`));
    }
    if (hoveredNode.widgets && hoveredNode.widgets.length > 0) {
      const widgetGroup = createGroup("Parameters");
      const widgetsToShow = hoveredNode.widgets.slice(0, 6);
      for (const widget of widgetsToShow) {
        if (widget.name && widget.value !== void 0) {
          let value = String(widget.value);
          if (value.length > 30) value = value.substring(0, 27) + "...";
          widgetGroup.appendChild(createRow(widget.name, value));
        }
      }
      if (hoveredNode.widgets.length > 6) {
        const moreEl = document.createElement("div");
        moreEl.style.cssText = "font-size: 11px; color: #666; padding: 4px 0;";
        moreEl.textContent = `+${hoveredNode.widgets.length - 6} more...`;
        widgetGroup.appendChild(moreEl);
      }
      inspectorBody.appendChild(widgetGroup);
    }
    inspectorBody.appendChild(nodeGroup);
  } else {
    const empty = document.createElement("div");
    empty.className = "magnify-inspector-empty";
    empty.textContent = "Hover over a node to inspect";
    inspectorBody.appendChild(empty);
  }
}
function renderInspectorPanel(container) {
  const section = document.createElement("div");
  section.className = "magnify-sidebar-section";
  const header = document.createElement("div");
  header.className = "magnify-sidebar-section-header";
  header.innerHTML = `${Icons.chevronDown}<span>Inspector</span>`;
  const body = document.createElement("div");
  body.className = "magnify-sidebar-section-body magnify-inspector-section";
  inspectorBody = body;
  header.addEventListener("click", () => {
    header.classList.toggle("collapsed");
    body.classList.toggle("collapsed");
  });
  section.appendChild(header);
  section.appendChild(body);
  container.appendChild(section);
  updateInspector();
  if (updateInterval) {
    clearInterval(updateInterval);
  }
  updateInterval = window.setInterval(updateInspector, 100);
}
function cleanupInspector() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
  }
  inspectorBody = null;
}
export {
  cleanupInspector,
  renderInspectorPanel
};
//# sourceMappingURL=SidebarInspector.js.map
