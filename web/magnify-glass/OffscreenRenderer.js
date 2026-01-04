var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class OffscreenRenderer {
  constructor(config, state) {
    __publicField(this, "config");
    __publicField(this, "state");
    __publicField(this, "offscreenCanvas", null);
    __publicField(this, "offscreenCtx", null);
    __publicField(this, "lastRenderWidth", 0);
    __publicField(this, "lastRenderHeight", 0);
    __publicField(this, "isCapturing", false);
    this.config = config;
    this.state = state;
    this.initOffscreenCanvas();
  }
  initOffscreenCanvas() {
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCtx = this.offscreenCanvas.getContext("2d");
  }
  renderHighResRegion(targetCanvas) {
    if (!this.offscreenCanvas || !this.offscreenCtx) return null;
    if (this.isCapturing) return null;
    const lgCanvas = app == null ? void 0 : app.canvas;
    if (!lgCanvas || !lgCanvas.ds) return null;
    const renderSize = this.config.glassSize;
    if (this.lastRenderWidth !== renderSize || this.lastRenderHeight !== renderSize) {
      this.offscreenCanvas.width = renderSize;
      this.offscreenCanvas.height = renderSize;
      this.lastRenderWidth = renderSize;
      this.lastRenderHeight = renderSize;
    }
    const currentScale = lgCanvas.ds.scale;
    const rect = targetCanvas.getBoundingClientRect();
    const dpr = rect.width > 0 ? targetCanvas.width / rect.width : 1;
    const useDirectCapture = currentScale >= 0.7;
    if (useDirectCapture) {
      return this.renderDirectCapture(targetCanvas, renderSize, dpr);
    } else {
      return this.renderVirtualZoom(lgCanvas, targetCanvas, renderSize, currentScale, dpr);
    }
  }
  /**
   * Mode 1: Direct Capture (Nuclear Fix)
   * Copies pixels directly from screen. Zero drift.
   */
  renderDirectCapture(targetCanvas, renderSize, dpr) {
    try {
      this.isCapturing = true;
      const pivotCssX = this.state.x / dpr;
      const pivotCssY = this.state.y / dpr;
      const sourceSizeCss = renderSize / this.config.zoomFactor;
      const sourceWidth = sourceSizeCss * dpr;
      const sourceHeight = sourceSizeCss * dpr;
      const sourceX = (pivotCssX - sourceSizeCss / 2) * dpr;
      const sourceY = (pivotCssY - sourceSizeCss / 2) * dpr;
      this.offscreenCtx.clearRect(0, 0, renderSize, renderSize);
      this.offscreenCtx.drawImage(
        targetCanvas,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        renderSize,
        renderSize
      );
      this.isCapturing = false;
      return this.offscreenCanvas;
    } catch (e) {
      console.warn("DirectCapture failed", e);
      this.isCapturing = false;
      return null;
    }
  }
  /**
   * Mode 2: Virtual Zoom (High Res)
   * Temporarily sets scale to 1.0 to render details.
   * Uses LiteGraph's setZoom() API for correct pivot handling.
   */
  renderVirtualZoom(lgCanvas, targetCanvas, renderSize, currentScale, dpr) {
    try {
      this.isCapturing = true;
      const pivotCssX = this.state.x / dpr;
      const pivotCssY = this.state.y / dpr;
      const targetScale = Math.max(1, currentScale);
      const origScale = lgCanvas.ds.scale;
      const origOffsetX = lgCanvas.ds.offset[0];
      const origOffsetY = lgCanvas.ds.offset[1];
      if (typeof lgCanvas.setZoom === "function") {
        lgCanvas.setZoom(targetScale, [pivotCssX, pivotCssY]);
      } else {
        const pivotGraphX = (pivotCssX - origOffsetX) / currentScale;
        const pivotGraphY = (pivotCssY - origOffsetY) / currentScale;
        const newOffsetX = pivotCssX - pivotGraphX * targetScale;
        const newOffsetY = pivotCssY - pivotGraphY * targetScale;
        lgCanvas.ds.scale = targetScale;
        lgCanvas.ds.offset[0] = newOffsetX;
        lgCanvas.ds.offset[1] = newOffsetY;
      }
      lgCanvas.draw(true, true);
      const sourceSizeCss = renderSize / this.config.zoomFactor;
      const sourceWidth = sourceSizeCss * dpr;
      const sourceHeight = sourceSizeCss * dpr;
      const sourceX = (pivotCssX - sourceSizeCss / 2) * dpr;
      const sourceY = (pivotCssY - sourceSizeCss / 2) * dpr;
      this.offscreenCtx.clearRect(0, 0, renderSize, renderSize);
      this.offscreenCtx.drawImage(
        targetCanvas,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        renderSize,
        renderSize
      );
      if (typeof lgCanvas.setZoom === "function") {
        lgCanvas.setZoom(origScale, [pivotCssX, pivotCssY]);
      } else {
        lgCanvas.ds.scale = origScale;
        lgCanvas.ds.offset[0] = origOffsetX;
        lgCanvas.ds.offset[1] = origOffsetY;
      }
      lgCanvas.draw(true, true);
      this.isCapturing = false;
      return this.offscreenCanvas;
    } catch (e) {
      console.warn("VirtualZoom failed", e);
      lgCanvas.ds.scale = currentScale;
      lgCanvas.draw(true, true);
      this.isCapturing = false;
      return null;
    }
  }
  isAvailable() {
    return this.offscreenCanvas !== null && this.offscreenCtx !== null;
  }
  getCanvas() {
    return this.offscreenCanvas;
  }
}
export {
  OffscreenRenderer
};
//# sourceMappingURL=OffscreenRenderer.js.map
