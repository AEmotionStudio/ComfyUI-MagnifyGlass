var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class CanvasHighlighter {
  // px
  constructor() {
    __publicField(this, "originalOnDrawForeground", null);
    __publicField(this, "highlightedNodeId", null);
    // Configuration
    __publicField(this, "HIGHLIGHT_COLOR", "#007bff");
    // Bootstrap blue
    __publicField(this, "HIGHLIGHT_WIDTH", 2);
    // px
    __publicField(this, "HIGHLIGHT_PADDING", 0);
    // Bound method to preserve 'this' and allow equality check
    __publicField(this, "boundOnDrawForeground", (ctx, visible_nodes) => {
      if (this.originalOnDrawForeground) {
        this.originalOnDrawForeground.call(window.app.canvas, ctx, visible_nodes);
      }
      const app = window.app;
      if (app && app.canvas) {
        this.drawHighlight(ctx, app.canvas.ds.scale);
      }
    });
    this.hookCanvas();
  }
  /**
   * Hook into the main canvas onDrawForeground method.
   */
  hookCanvas() {
    const app = window.app;
    if (!app || !app.canvas) {
      console.warn("[MagnifyGlass] Canvas not found, cannot hook highlighter");
      return;
    }
    const canvas = app.canvas;
    this.originalOnDrawForeground = canvas.onDrawForeground;
    canvas.onDrawForeground = this.boundOnDrawForeground;
  }
  /**
   * Set the node ID to highlight.
   */
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
   * Draw the highlight rectangle around the target node.
   */
  drawHighlight(ctx, scale) {
    if (this.highlightedNodeId === null) return;
    const app = window.app;
    if (!app) return;
    const node = app.graph.getNodeById(this.highlightedNodeId);
    if (!node) return;
    ctx.save();
    const padding = 10;
    const x = node.pos[0] - padding;
    const y = node.pos[1] - padding;
    const w = node.size[0] + padding * 2;
    const h = node.size[1] + padding * 2;
    ctx.lineWidth = 10;
    ctx.strokeStyle = "#007bff";
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      const radius = 10;
      ctx.roundRect(x, y, w, h, radius);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.stroke();
    ctx.restore();
  }
  /**
   * Clean up hooks.
   */
  cleanup() {
    const app = window.app;
    if (app && app.canvas && this.originalOnDrawForeground) {
      if (app.canvas.onDrawForeground === this.boundOnDrawForeground) {
        app.canvas.onDrawForeground = this.originalOnDrawForeground;
      }
    }
  }
}
export {
  CanvasHighlighter
};
//# sourceMappingURL=CanvasHighlighter.js.map
