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
    const useDirectCapture = currentScale >= 1;
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
   * Detect if there are nodes with image previews in the capture region.
   * These nodes (Save Image, Preview Image, etc.) have images that are drawn
   * via onDrawBackground/onDrawForeground and cause artifacts during Virtual Zoom.
   */
  detectImagePreviewNodes(dpr, scale, offset) {
    var _a, _b;
    const graph = app == null ? void 0 : app.graph;
    if (!graph || !graph._nodes) return false;
    const renderSize = this.config.glassSize;
    const sourceSizeCss = renderSize / this.config.zoomFactor;
    const pivotCssX = this.state.x / dpr;
    const pivotCssY = this.state.y / dpr;
    const captureLeft = pivotCssX - sourceSizeCss / 2;
    const captureTop = pivotCssY - sourceSizeCss / 2;
    const captureRight = captureLeft + sourceSizeCss;
    const captureBottom = captureTop + sourceSizeCss;
    const imagePreviewTypes = [
      "SaveImage",
      "PreviewImage",
      "LoadImage",
      "LoadImageMask",
      "VHS_LoadVideo",
      "VHS_VideoCombine",
      // Video nodes
      "ImagePreview",
      "ShowImage"
      // Common variants
    ];
    for (const node of graph._nodes) {
      if (!node.pos || !node.size) continue;
      if ((_a = node.flags) == null ? void 0 : _a.collapsed) continue;
      const nodeType = node.type || node.comfyClass || "";
      const hasImagePreview = imagePreviewTypes.some(
        (t) => nodeType.toLowerCase().includes(t.toLowerCase())
      ) || ((_b = node.imgs) == null ? void 0 : _b.length) > 0;
      if (!hasImagePreview) continue;
      const nodeCssX = node.pos[0] * scale + offset[0];
      const nodeCssY = node.pos[1] * scale + offset[1];
      const nodeCssWidth = node.size[0] * scale;
      const nodeCssHeight = node.size[1] * scale;
      const nodeRight = nodeCssX + nodeCssWidth;
      const nodeBottom = nodeCssY + nodeCssHeight;
      const overlaps = !(nodeRight < captureLeft || nodeCssX > captureRight || nodeBottom < captureTop || nodeCssY > captureBottom);
      if (overlaps) {
        return true;
      }
    }
    return false;
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
    var _a;
    try {
      this.isCapturing = true;
      window.__magnifyGlassCapturing = true;
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
      const hiddenNodeImages = /* @__PURE__ */ new Map();
      const hiddenNodeWidgets = /* @__PURE__ */ new Map();
      if ((_a = app == null ? void 0 : app.graph) == null ? void 0 : _a._nodes) {
        for (const node of app.graph._nodes) {
          if (node.imgs) {
            hiddenNodeImages.set(node, node.imgs);
            node.imgs = null;
          }
          if (node.widgets && Array.isArray(node.widgets)) {
            const hasPreviewWidget = node.widgets.some((w) => {
              const wName = String(w.name || "").toLowerCase();
              const wType = String(w.type || "").toLowerCase();
              return wName.includes("preview") || wName.includes("image") || wName.includes("gallery") || wName.includes("upload") || wType.includes("preview") || wType.includes("image");
            });
            if (hasPreviewWidget) {
              hiddenNodeWidgets.set(node, node.widgets);
              node.widgets = node.widgets.filter((w) => {
                const wName = String(w.name || "").toLowerCase();
                const wType = String(w.type || "").toLowerCase();
                const isPreview = wName.includes("preview") || wName.includes("image") || wName.includes("gallery") || wName.includes("upload") || wType.includes("preview") || wType.includes("image");
                return !isPreview;
              });
            }
          }
        }
      }
      try {
        lgCanvas.draw(true, true);
      } finally {
        for (const [node, imgs] of hiddenNodeImages.entries()) {
          node.imgs = imgs;
        }
        for (const [node, widgets] of hiddenNodeWidgets.entries()) {
          node.widgets = widgets;
        }
      }
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
      this.drawImagePreviewsNatively(sourceX, sourceY, sourceWidth, sourceHeight, renderSize, targetScale, captureOffset);
      if (typeof lgCanvas.setZoom === "function") {
        lgCanvas.setZoom(origScale, [pivotCssX, pivotCssY]);
      } else {
        lgCanvas.ds.scale = origScale;
        lgCanvas.ds.offset[0] = origOffsetX;
        lgCanvas.ds.offset[1] = origOffsetY;
      }
      lgCanvas.draw(true, true);
      this.isCapturing = false;
      window.__magnifyGlassCapturing = false;
      return this.offscreenCanvas;
    } catch (e) {
      console.warn("VirtualZoom failed", e);
      lgCanvas.ds.scale = currentScale;
      lgCanvas.draw(true, true);
      this.isCapturing = false;
      window.__magnifyGlassCapturing = false;
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
        const computedHeight = widget.computedHeight || 0;
        const isMarkdownWidget = widgetType === "markdown";
        const isMultiLineWidget = isMarkdownWidget || widgetType === "customtext" || (widgetType === "text" || widgetType === "textarea") && computedHeight >= 40;
        if (isMultiLineWidget && widget.value !== void 0 && widget.value !== null) {
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
            const lineHeight = fontSize * 1.4;
            let contentHeight = 0;
            if (isMarkdownWidget) {
              ctx.save();
              ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
              const maxWidth = widgetWidth - 12;
              const lines = textValue.split("\n");
              for (const line of lines) {
                const words = line.split(/(\s+)/);
                let currentLine = "";
                let lineCount = 1;
                for (const word of words) {
                  if (ctx.measureText(currentLine + word).width > maxWidth) {
                    lineCount++;
                    currentLine = word;
                  } else {
                    currentLine += word;
                  }
                }
                contentHeight += lineCount * lineHeight;
              }
              ctx.restore();
              contentHeight += 16;
            }
            const nodeBottomCss = nodeCssY + nodeCssHeight;
            const maxWidgetHeightCss = Math.max(0, nodeBottomCss - widgetCssY - PADDING * scale);
            const maxWidgetHeight = maxWidgetHeightCss * actualDpr * captureScale;
            const widgetHeight = isMarkdownWidget ? Math.min(Math.max(widget.computedHeight * scale * captureScale || 0, contentHeight), maxWidgetHeight) : widget.computedHeight ? widget.computedHeight * scale * captureScale : Math.max(80, fontSize * 5);
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
              this.drawMarkdown(ctx, textValue, canvasX + 4, canvasY + 4, widgetWidth - 12, widgetHeight - 8, fontSize);
              ctx.restore();
            }
          }
        }
        widgetY += WIDGET_HEIGHT + WIDGET_MARGIN;
      }
    }
  }
  /**
   * Draw image and video previews natively on the offscreen canvas.
   * This renders preview content that would otherwise cause errors during Virtual Zoom,
   * because ComfyUI's ImagePreviewWidget fails when the canvas scale is manipulated.
   * 
   * Handles:
   * - node.imgs[] array (standard ComfyUI SaveImage/PreviewImage nodes)
   * - VHS-style DOM widget previews (video/image elements)
   * 
   * @param sourceX - Source X position in backing pixels
   * @param sourceY - Source Y position in backing pixels
   * @param sourceWidth - Source width in backing pixels
   * @param sourceHeight - Source height in backing pixels
   * @param renderSize - Output render size in pixels
   * @param scale - Canvas scale used during capture
   * @param offset - Canvas offset [x, y] used during capture
   */
  drawImagePreviewsNatively(sourceX, sourceY, sourceWidth, sourceHeight, renderSize, scale, offset) {
    var _a;
    const graph = app == null ? void 0 : app.graph;
    if (!graph || !graph._nodes || !this.offscreenCtx) return;
    const ctx = this.offscreenCtx;
    const sourceSizeCss = renderSize / this.config.zoomFactor;
    const actualDpr = sourceWidth / sourceSizeCss;
    const captureScale = renderSize / sourceWidth;
    const sourceCssX = sourceX / actualDpr;
    const sourceCssY = sourceY / actualDpr;
    const sourceCssWidth = sourceWidth / actualDpr;
    const sourceCssHeight = sourceHeight / actualDpr;
    for (const node of graph._nodes) {
      if (!node.pos || !node.size) continue;
      if ((_a = node.flags) == null ? void 0 : _a.collapsed) continue;
      const nodeCssX = node.pos[0] * scale + offset[0];
      const nodeCssY = node.pos[1] * scale + offset[1];
      const nodeCssWidth = node.size[0] * scale;
      const nodeCssHeight = node.size[1] * scale;
      if (nodeCssX + nodeCssWidth < sourceCssX || nodeCssX > sourceCssX + sourceCssWidth) continue;
      if (nodeCssY + nodeCssHeight < sourceCssY || nodeCssY > sourceCssY + sourceCssHeight) continue;
      if (node.imgs && Array.isArray(node.imgs) && node.imgs.length > 0) {
        this.drawNodeImages(
          ctx,
          node,
          nodeCssX,
          nodeCssY,
          nodeCssWidth,
          nodeCssHeight,
          sourceCssX,
          sourceCssY,
          actualDpr,
          captureScale,
          renderSize,
          scale
        );
      }
      if (node.widgets) {
        for (const widget of node.widgets) {
          const widgetName = String(widget.name || "").toLowerCase();
          if (widgetName === "videopreview" || widgetName === "audiopreview") {
            this.drawDomWidgetPreview(
              ctx,
              widget,
              node,
              nodeCssX,
              nodeCssY,
              nodeCssWidth,
              sourceCssX,
              sourceCssY,
              actualDpr,
              captureScale,
              renderSize,
              scale
            );
          }
        }
      }
    }
  }
  /**
   * Draw images from node.imgs[] array onto the offscreen canvas.
   */
  drawNodeImages(ctx, node, nodeCssX, nodeCssY, nodeCssWidth, nodeCssHeight, sourceCssX, sourceCssY, actualDpr, captureScale, renderSize, scale) {
    const TITLE_HEIGHT = 30;
    const PADDING = 10;
    const imageAreaY = nodeCssY + TITLE_HEIGHT * scale;
    const imageAreaWidth = nodeCssWidth - PADDING * 2 * scale;
    const imageAreaHeight = nodeCssHeight - TITLE_HEIGHT * scale - PADDING * scale;
    if (imageAreaWidth <= 0 || imageAreaHeight <= 0) return;
    const imgs = node.imgs;
    const imageIndex = node.imageIndex ?? 0;
    const img = imgs[Math.min(imageIndex, imgs.length - 1)];
    if (!img || !(img instanceof HTMLImageElement) || !img.complete || img.naturalWidth === 0) {
      return;
    }
    try {
      const imgAspect = img.naturalWidth / img.naturalHeight;
      const areaAspect = imageAreaWidth / imageAreaHeight;
      let drawWidth = imageAreaWidth;
      let drawHeight = imageAreaHeight;
      if (imgAspect > areaAspect) {
        drawHeight = drawWidth / imgAspect;
      } else {
        drawWidth = drawHeight * imgAspect;
      }
      const drawX = nodeCssX + PADDING * scale + (imageAreaWidth - drawWidth) / 2;
      const drawY = imageAreaY + (imageAreaHeight - drawHeight) / 2;
      const canvasX = (drawX - sourceCssX) * actualDpr * captureScale;
      const canvasY = (drawY - sourceCssY) * actualDpr * captureScale;
      const canvasWidth = drawWidth * actualDpr * captureScale;
      const canvasHeight = drawHeight * actualDpr * captureScale;
      if (canvasX + canvasWidth > 0 && canvasX < renderSize && canvasY + canvasHeight > 0 && canvasY < renderSize) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, canvasX, canvasY, canvasWidth, canvasHeight);
        ctx.restore();
      }
    } catch (e) {
    }
  }
  /**
   * Draw VHS-style DOM widget video/image preview onto the offscreen canvas.
   */
  drawDomWidgetPreview(ctx, widget, node, nodeCssX, nodeCssY, nodeCssWidth, sourceCssX, sourceCssY, actualDpr, captureScale, renderSize, scale) {
    const videoEl = widget.videoEl;
    const imgEl = widget.imgEl;
    let sourceElement;
    let sourceWidth = 0;
    let sourceHeight = 0;
    if (videoEl && !videoEl.hidden && videoEl.videoWidth > 0) {
      sourceElement = videoEl;
      sourceWidth = videoEl.videoWidth;
      sourceHeight = videoEl.videoHeight;
    } else if (imgEl && !imgEl.hidden && imgEl.naturalWidth > 0) {
      sourceElement = imgEl;
      sourceWidth = imgEl.naturalWidth;
      sourceHeight = imgEl.naturalHeight;
    }
    if (!sourceElement || sourceWidth === 0 || sourceHeight === 0) return;
    try {
      const widgetY = widget.last_y ?? 30;
      const widgetHeight = widget.computedHeight ?? 100;
      const widgetCssY = nodeCssY + widgetY * scale;
      const widgetCssWidth = nodeCssWidth - 20 * scale;
      const widgetCssHeight = widgetHeight * scale;
      if (widgetCssWidth <= 0 || widgetCssHeight <= 0) return;
      const srcAspect = sourceWidth / sourceHeight;
      const areaAspect = widgetCssWidth / widgetCssHeight;
      let drawWidth = widgetCssWidth;
      let drawHeight = widgetCssHeight;
      if (srcAspect > areaAspect) {
        drawHeight = drawWidth / srcAspect;
      } else {
        drawWidth = drawHeight * srcAspect;
      }
      const drawX = nodeCssX + 10 * scale + (widgetCssWidth - drawWidth) / 2;
      const drawY = widgetCssY + (widgetCssHeight - drawHeight) / 2;
      const canvasX = (drawX - sourceCssX) * actualDpr * captureScale;
      const canvasY = (drawY - sourceCssY) * actualDpr * captureScale;
      const canvasWidth = drawWidth * actualDpr * captureScale;
      const canvasHeight = drawHeight * actualDpr * captureScale;
      if (canvasX + canvasWidth > 0 && canvasX < renderSize && canvasY + canvasHeight > 0 && canvasY < renderSize) {
        ctx.save();
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(sourceElement, canvasX, canvasY, canvasWidth, canvasHeight);
        ctx.restore();
      }
    } catch (e) {
    }
  }
  /**
   * Render markdown text onto the context.
   * Supports basic headers (#) and lists (-).
   */
  drawMarkdown(ctx, text, x, y, maxWidth, maxHeight, fontSize) {
    var _a;
    const lines = text.split("\n");
    const lineHeight = fontSize * 1.4;
    let currentY = y;
    const maxY = y + maxHeight;
    ctx.textBaseline = "top";
    ctx.fillStyle = "#e0e0e0";
    const wrapText = (text2, maxWidth2, font) => {
      ctx.font = font;
      const words = text2.split(/(\s+)/);
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
      if (currentLine.length > 0) wrappedLines.push(currentLine.trimEnd());
      return wrappedLines;
    };
    for (const line of lines) {
      if (currentY >= maxY) break;
      let renderText = line;
      let currentFont = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
      let indent = 0;
      let color = "#e0e0e0";
      if (line.startsWith("#")) {
        const level = ((_a = line.match(/^#+/)) == null ? void 0 : _a[0].length) || 0;
        renderText = line.substring(level).trim();
        const headerScale = Math.max(1.1, 1.8 - level * 0.15);
        const headerSize = fontSize * headerScale;
        currentFont = `700 ${headerSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
        currentY += fontSize * 0.5;
      } else if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        renderText = "• " + line.trim().substring(2);
        indent = fontSize;
      }
      const wrapped = wrapText(renderText, maxWidth - indent, currentFont);
      ctx.font = currentFont;
      ctx.fillStyle = color;
      for (const wrap of wrapped) {
        if (currentY >= maxY) break;
        ctx.fillText(wrap, x + indent, currentY);
        const currentLineHeight = line.startsWith("#") ? parseFloat(currentFont.split(" ")[1]) * 1.4 : lineHeight;
        currentY += currentLineHeight;
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
// Virtual Zoom Throttling (60 FPS = ~16ms per frame)
__publicField(_OffscreenRenderer, "VIRTUAL_ZOOM_MIN_INTERVAL_MS", 16);
let OffscreenRenderer = _OffscreenRenderer;
export {
  OffscreenRenderer
};
//# sourceMappingURL=OffscreenRenderer.js.map
