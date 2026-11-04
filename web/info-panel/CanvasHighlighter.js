var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class CanvasHighlighter {
  constructor(settings) {
    __publicField(this, "originalOnDrawForeground", null);
    __publicField(this, "highlightedNodeId", null);
    __publicField(this, "highlightEl", null);
    // Cache for DOM updates to minimize thrashing
    __publicField(this, "lastStyleState", "");
    // The panel's settings cache, which the setting's onChange keeps current
    __publicField(this, "settings");
    // Bound method to preserve 'this' and allow equality check
    __publicField(this, "boundOnDrawForeground", (ctx, visible_nodes) => {
      if (this.originalOnDrawForeground) {
        this.originalOnDrawForeground.call(window.app.canvas, ctx, visible_nodes);
      }
      this.updateHighlightPosition();
    });
    this.settings = settings;
    this.createHighlightElement();
  }
  createHighlightElement() {
    this.highlightEl = document.createElement("div");
    this.highlightEl.id = "magnify-glass-node-highlight";
    this.highlightEl.style.display = "none";
    document.body.appendChild(this.highlightEl);
  }
  /**
   * Set the node ID to highlight.
   */
  setHighlightedNode(nodeId) {
    this.ensureHook();
    if (this.highlightedNodeId === nodeId) return;
    this.highlightedNodeId = nodeId;
    const app = window.app;
    if (app && app.canvas) {
      app.canvas.setDirty(true, true);
    }
    if (nodeId === null && this.highlightEl) {
      this.highlightEl.style.display = "none";
    }
  }
  /**
   * Ensure the canvas hook is active.
   */
  ensureHook() {
    const app = window.app;
    if (!app || !app.canvas) return;
    if (app.canvas.onDrawForeground !== this.boundOnDrawForeground) {
      this.originalOnDrawForeground = app.canvas.onDrawForeground;
      app.canvas.onDrawForeground = this.boundOnDrawForeground;
    }
  }
  /**
   * Update the position of the DOM highlight element.
   */
  updateHighlightPosition() {
    var _a;
    if (!this.highlightEl) return;
    const app = window.app;
    if (!((_a = app == null ? void 0 : app.canvas) == null ? void 0 : _a.graph)) return;
    if (!this.settings["🔍MagnifyGlass.NodeHighlightEnabled"] || this.highlightedNodeId === null) {
      if (this.highlightEl.style.display !== "none") {
        this.highlightEl.style.display = "none";
      }
      return;
    }
    const node = app.canvas.graph.getNodeById(this.highlightedNodeId);
    if (!node) {
      if (this.highlightEl.style.display !== "none") {
        this.highlightEl.style.display = "none";
      }
      return;
    }
    const canvasEl = app.canvas.canvas;
    if (!canvasEl) return;
    const canvasRect = canvasEl.getBoundingClientRect();
    const ds = app.canvas.ds;
    const scale = ds.scale;
    const offset = ds.offset;
    const padding = 6;
    const LiteGraph = window.LiteGraph;
    const titleHeight = (LiteGraph == null ? void 0 : LiteGraph.NODE_TITLE_HEIGHT) ?? 30;
    const [graphX, graphY, graphW, graphH] = (LiteGraph == null ? void 0 : LiteGraph.vueNodesMode) ? [node.pos[0], node.pos[1] - titleHeight, node.size[0], node.size[1] + titleHeight] : node.getBounding();
    const pageX = canvasRect.left + (graphX + offset[0]) * scale - padding;
    const pageY = canvasRect.top + (graphY + offset[1]) * scale - padding;
    const finalW = graphW * scale + padding * 2;
    const finalH = graphH * scale + padding * 2;
    const clip = `inset(${canvasRect.top - pageY}px ${pageX + finalW - canvasRect.right}px ${pageY + finalH - canvasRect.bottom}px ${canvasRect.left - pageX}px)`;
    const styleState = `${pageX.toFixed(1)},${pageY.toFixed(1)},${finalW.toFixed(1)},${finalH.toFixed(1)},${clip}`;
    if (this.lastStyleState !== styleState || this.highlightEl.style.display === "none") {
      this.highlightEl.style.display = "block";
      this.highlightEl.style.left = `${pageX}px`;
      this.highlightEl.style.top = `${pageY}px`;
      this.highlightEl.style.width = `${finalW}px`;
      this.highlightEl.style.height = `${finalH}px`;
      this.highlightEl.style.clipPath = clip;
      const borderWidth = Math.max(2, Math.min(6, 3 * scale));
      this.highlightEl.style.borderWidth = `${borderWidth}px`;
      this.lastStyleState = styleState;
    }
  }
  /**
   * Clean up hooks.
   */
  cleanup() {
    const app = window.app;
    if (app && app.canvas && app.canvas.onDrawForeground === this.boundOnDrawForeground) {
      app.canvas.onDrawForeground = this.originalOnDrawForeground;
    }
    if (this.highlightEl) {
      this.highlightEl.remove();
      this.highlightEl = null;
    }
  }
}
export {
  CanvasHighlighter
};
