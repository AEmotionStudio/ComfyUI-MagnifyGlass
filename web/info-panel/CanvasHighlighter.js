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
    canvas.onDrawForeground = (ctx, visible_nodes) => {
      if (this.originalOnDrawForeground) {
        this.originalOnDrawForeground.call(canvas, ctx, visible_nodes);
      }
      this.drawHighlight(ctx, canvas.ds.scale);
    };
  }
  /**
   * Set the node ID to highlight.
   */
  setHighlightedNode(nodeId) {
    if (this.highlightedNodeId === nodeId) return;
    this.highlightedNodeId = nodeId;
    const app = window.app;
    if (app && app.canvas) {
      app.canvas.setDirty(true, true);
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
    const x = node.pos[0] - this.HIGHLIGHT_PADDING;
    const y = node.pos[1] - this.HIGHLIGHT_PADDING;
    const w = node.size[0] + this.HIGHLIGHT_PADDING * 2;
    const h = node.size[1] + this.HIGHLIGHT_PADDING * 2;
    ctx.lineWidth = this.HIGHLIGHT_WIDTH;
    ctx.strokeStyle = this.HIGHLIGHT_COLOR;
    ctx.shadowColor = this.HIGHLIGHT_COLOR;
    ctx.shadowBlur = 10 * scale;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
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
      app.canvas.onDrawForeground = this.originalOnDrawForeground;
    }
  }
}
export {
  CanvasHighlighter
};
//# sourceMappingURL=CanvasHighlighter.js.map
