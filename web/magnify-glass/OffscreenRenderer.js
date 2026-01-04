var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const _OffscreenRenderer = class _OffscreenRenderer {
  constructor(config, state) {
    __publicField(this, "config");
    __publicField(this, "state");
    __publicField(this, "offscreenCanvas", null);
    __publicField(this, "offscreenCtx", null);
    __publicField(this, "lastRenderWidth", 0);
    __publicField(this, "lastRenderHeight", 0);
    __publicField(this, "isCapturing", false);
    __publicField(this, "lastVirtualZoomTime", 0);
    __publicField(this, "cachedVirtualZoomResult", null);
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
      this.cachedVirtualZoomResult = null;
      return this.renderDirectCapture(targetCanvas, renderSize, dpr);
    } else {
      const now = performance.now();
      const elapsed = now - this.lastVirtualZoomTime;
      if (elapsed < _OffscreenRenderer.VIRTUAL_ZOOM_MIN_INTERVAL_MS && this.cachedVirtualZoomResult) {
        return this.cachedVirtualZoomResult;
      }
      const result = this.renderVirtualZoom(lgCanvas, targetCanvas, renderSize, currentScale, dpr);
      this.lastVirtualZoomTime = now;
      this.cachedVirtualZoomResult = result;
      return result;
    }
  }
  /**
   * Mode 1: Direct Capture (Nuclear Fix)
   * Copies pixels directly from screen. Zero drift.
   */
  renderDirectCapture(targetCanvas, renderSize, dpr) {
    var _a, _b;
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
      const lgCanvas = app == null ? void 0 : app.canvas;
      const currentScale = ((_a = lgCanvas == null ? void 0 : lgCanvas.ds) == null ? void 0 : _a.scale) ?? 1;
      const currentOffset = ((_b = lgCanvas == null ? void 0 : lgCanvas.ds) == null ? void 0 : _b.offset) ? [lgCanvas.ds.offset[0], lgCanvas.ds.offset[1]] : [0, 0];
      this.drawWidgetTextNatively(sourceX, sourceY, sourceWidth, sourceHeight, renderSize, currentScale, currentOffset);
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
      const captureOffset = [lgCanvas.ds.offset[0], lgCanvas.ds.offset[1]];
      this.drawWidgetTextNatively(sourceX, sourceY, sourceWidth, sourceHeight, renderSize, targetScale, captureOffset);
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
  /**
   * Draw widget text natively on the offscreen canvas.
   * This renders text content that would otherwise be lost since widgets are DOM elements.
   * 
   * @param sourceX - Source X position in backing pixels
   * @param sourceY - Source Y position in backing pixels
   * @param sourceWidth - Source width in backing pixels
   * @param sourceHeight - Source height in backing pixels
   * @param renderSize - Output render size in pixels
   * @param scale - Canvas scale used during capture
   * @param offset - Canvas offset [x, y] used during capture
   */
  drawWidgetTextNatively(sourceX, sourceY, sourceWidth, sourceHeight, renderSize, scale, offset) {
    var _a;
    const graph = app == null ? void 0 : app.graph;
    if (!graph || !graph._nodes || !this.offscreenCtx) return;
    const ctx = this.offscreenCtx;
    const lgCanvas = app == null ? void 0 : app.canvas;
    if (!lgCanvas || !lgCanvas.ds) return;
    const TITLE_HEIGHT = 30;
    const WIDGET_HEIGHT = 20;
    const WIDGET_MARGIN = 4;
    const PADDING = 15;
    const sourceSizeCss = renderSize / this.config.zoomFactor;
    const actualDpr = sourceWidth / sourceSizeCss;
    const captureScale = renderSize / sourceWidth;
    const sourceCssX = sourceX / actualDpr;
    const sourceCssY = sourceY / actualDpr;
    const sourceCssWidth = sourceWidth / actualDpr;
    const sourceCssHeight = sourceHeight / actualDpr;
    for (const node of graph._nodes) {
      if (!node.widgets || !node.pos || !node.size) continue;
      if ((_a = node.flags) == null ? void 0 : _a.collapsed) continue;
      const nodeCssX = node.pos[0] * scale + offset[0];
      const nodeCssY = node.pos[1] * scale + offset[1];
      const nodeCssWidth = node.size[0] * scale;
      const nodeCssHeight = node.size[1] * scale;
      if (nodeCssX + nodeCssWidth < sourceCssX || nodeCssX > sourceCssX + sourceCssWidth) continue;
      if (nodeCssY + nodeCssHeight < sourceCssY || nodeCssY > sourceCssY + sourceCssHeight) continue;
      let widgetY = TITLE_HEIGHT;
      for (const widget of node.widgets) {
        const widgetLocalY = widget.last_y ?? widgetY;
        const widgetType = String(widget.type || "").toLowerCase();
        const isTextWidget = widgetType === "text" || widgetType === "string" || widgetType === "textarea" || widgetType === "customtext";
        if (isTextWidget && widget.value !== void 0 && widget.value !== null) {
          const textValue = String(widget.value);
          if (textValue.length > 0) {
            const widgetCssX = nodeCssX + PADDING * scale;
            const widgetCssY = nodeCssY + widgetLocalY * scale;
            const widgetCssWidth = nodeCssWidth - PADDING * 2 * scale;
            const canvasX = (widgetCssX - sourceCssX) * actualDpr * captureScale;
            const canvasY = (widgetCssY - sourceCssY) * actualDpr * captureScale;
            const widgetWidth = widgetCssWidth * actualDpr * captureScale;
            const baseFontSize = 13;
            const fontSize = Math.max(10, Math.min(28, baseFontSize * scale * actualDpr * captureScale));
            const widgetHeight = widget.computedHeight ? widget.computedHeight * scale * captureScale : Math.max(80, fontSize * 5);
            const widgetRight = canvasX + widgetWidth;
            const widgetBottom = canvasY + widgetHeight;
            const isVisible = widgetRight > 0 && canvasX < renderSize && widgetBottom > 0 && canvasY < renderSize;
            if (isVisible) {
              ctx.save();
              const containerX = canvasX - 4;
              const containerY = canvasY - 4;
              const containerWidth = widgetWidth + 8;
              const containerHeight = widgetHeight + 8;
              const borderRadius = 8;
              ctx.beginPath();
              ctx.roundRect(containerX, containerY, containerWidth, containerHeight, borderRadius);
              ctx.fillStyle = "#1e1e1e";
              ctx.fill();
              ctx.strokeStyle = "#3a3a3a";
              ctx.lineWidth = 1;
              ctx.stroke();
              ctx.beginPath();
              ctx.roundRect(containerX, containerY, containerWidth, containerHeight, borderRadius);
              ctx.clip();
              ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
              ctx.fillStyle = "#e0e0e0";
              ctx.textBaseline = "top";
              ctx.imageSmoothingEnabled = true;
              const wrapText = (text, maxWidth2) => {
                const words = text.split(/(\s+)/);
                const wrappedLines = [];
                let currentLine = "";
                for (const word of words) {
                  const testLine = currentLine + word;
                  const testWidth = ctx.measureText(testLine).width;
                  if (testWidth > maxWidth2 && currentLine.length > 0) {
                    wrappedLines.push(currentLine.trimEnd());
                    currentLine = word.trimStart();
                  } else {
                    currentLine = testLine;
                  }
                }
                if (currentLine.length > 0) {
                  wrappedLines.push(currentLine.trimEnd());
                }
                return wrappedLines;
              };
              const inputLines = textValue.split("\n");
              const lineHeight = fontSize * 1.4;
              const maxWidth = widgetWidth - 12;
              const textStartX = canvasX + 4;
              const textStartY = canvasY + 4;
              let currentY = textStartY;
              const maxLines = Math.floor((widgetHeight - 8) / lineHeight);
              let lineCount = 0;
              for (const line of inputLines) {
                if (lineCount >= maxLines) break;
                const wrappedLines = line.length > 0 ? wrapText(line, maxWidth) : [""];
                for (const wrappedLine of wrappedLines) {
                  if (lineCount >= maxLines) break;
                  ctx.fillText(wrappedLine, textStartX, currentY);
                  currentY += lineHeight;
                  lineCount++;
                }
              }
              ctx.restore();
            }
          }
        }
        widgetY += WIDGET_HEIGHT + WIDGET_MARGIN;
      }
    }
  }
  isAvailable() {
    return this.offscreenCanvas !== null && this.offscreenCtx !== null;
  }
  getCanvas() {
    return this.offscreenCanvas;
  }
};
// Virtual Zoom Throttling (30 FPS = ~33ms per frame)
__publicField(_OffscreenRenderer, "VIRTUAL_ZOOM_MIN_INTERVAL_MS", 33);
let OffscreenRenderer = _OffscreenRenderer;
export {
  OffscreenRenderer
};
//# sourceMappingURL=OffscreenRenderer.js.map
