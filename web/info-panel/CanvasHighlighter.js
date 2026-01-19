var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { getSettingValue } from "../shared/utils.js";
class CanvasHighlighter {
  constructor() {
    __publicField(this, "originalOnDrawForeground", null);
    __publicField(this, "highlightedNodeId", null);
    __publicField(this, "highlightEl", null);
    // Cache for DOM updates to minimize thrashing
    __publicField(this, "lastStyleState", "");
    // Bound method to preserve 'this' and allow equality check
    __publicField(this, "boundOnDrawForeground", (ctx, visible_nodes) => {
      if (this.originalOnDrawForeground) {
        this.originalOnDrawForeground.call(window.app.canvas, ctx, visible_nodes);
      }
      this.updateHighlightPosition();
    });
    this.createHighlightElement();
  }
  createHighlightElement() {
    this.highlightEl = document.createElement("div");
    this.highlightEl.id = "magnify-glass-node-highlight";
    this.highlightEl.style.cssText = `
            position: fixed;
            pointer-events: none;
            border: 2px solid #007bff;
            border-radius: 10px;
            z-index: 1000;
            display: none;
            box-sizing: border-box;
            box-shadow: 0 0 10px rgba(0, 123, 255, 0.3);
        `;
    document.body.appendChild(this.highlightEl);
  }
  /**
   * Hook into the main canvas onDrawForeground method.
   */
  hookCanvas() {
    const app = window.app;
    if (!app || !app.canvas) {
      return false;
    }
    const canvas = app.canvas;
    if (canvas.onDrawForeground === this.boundOnDrawForeground) {
      return true;
    }
    this.originalOnDrawForeground = canvas.onDrawForeground;
    canvas.onDrawForeground = this.boundOnDrawForeground;
    return true;
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
    if (!this.highlightEl) return;
    const app = window.app;
    if (!app || !app.canvas || !app.graph) return;
    const highlightEnabled = getSettingValue("🔍MagnifyGlass.NodeHighlightEnabled", true);
    if (!highlightEnabled || this.highlightedNodeId === null) {
      if (this.highlightEl.style.display !== "none") {
        this.highlightEl.style.display = "none";
      }
      return;
    }
    const node = app.graph.getNodeById(this.highlightedNodeId);
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
    const LiteGraph = window.LiteGraph;
    const titleHeight = (LiteGraph == null ? void 0 : LiteGraph.NODE_TITLE_HEIGHT) ?? 30;
    const padding = 6;
    const graphX = node.pos[0];
    const graphY = node.pos[1] - titleHeight;
    const graphW = node.size[0];
    const graphH = titleHeight + node.size[1];
    const canvasX = (graphX + offset[0]) * scale;
    const canvasY = (graphY + offset[1]) * scale;
    const canvasW = graphW * scale;
    const canvasH = graphH * scale;
    const pageX = canvasRect.left + canvasX - padding;
    const pageY = canvasRect.top + canvasY - padding;
    const finalW = canvasW + padding * 2;
    const finalH = canvasH + padding * 2;
    const styleState = `${pageX.toFixed(1)},${pageY.toFixed(1)},${finalW.toFixed(1)},${finalH.toFixed(1)}`;
    if (this.lastStyleState !== styleState || this.highlightEl.style.display === "none") {
      this.highlightEl.style.display = "block";
      this.highlightEl.style.left = `${pageX}px`;
      this.highlightEl.style.top = `${pageY}px`;
      this.highlightEl.style.width = `${finalW}px`;
      this.highlightEl.style.height = `${finalH}px`;
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
    if (app && app.canvas && this.originalOnDrawForeground) {
      if (app.canvas.onDrawForeground === this.boundOnDrawForeground) {
        app.canvas.onDrawForeground = this.originalOnDrawForeground;
      }
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
