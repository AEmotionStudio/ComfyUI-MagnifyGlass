var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { getSettingValue } from "../shared/utils.js";
import { captureRegion, scaleAbout, isSafeMediaSource, graphBoxToCss, previewImageBoxes, toGlass, fitContent } from "./mediaLayout.js";
const TITLE_HEIGHT = 30;
const VIRTUAL_ZOOM_MIN_INTERVAL_MS = 14;
function boundingBox(node) {
  const [x, y, w, h] = node.boundingRect;
  return { x, y, w, h };
}
class OffscreenRenderer {
  constructor(config, state) {
    __publicField(this, "config");
    __publicField(this, "state");
    __publicField(this, "offscreenCanvas", null);
    __publicField(this, "offscreenCtx", null);
    __publicField(this, "lastRenderWidth", 0);
    __publicField(this, "lastRenderHeight", 0);
    __publicField(this, "isCapturing", false);
    __publicField(this, "lastVirtualZoomTime", 0);
    this.config = config;
    this.state = state;
    this.initOffscreenCanvas();
  }
  initOffscreenCanvas() {
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCtx = this.offscreenCanvas.getContext("2d");
  }
  renderHighResRegion(targetCanvas) {
    var _a;
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
    const rect = targetCanvas.getBoundingClientRect();
    const dpr = rect.width > 0 ? targetCanvas.width / rect.width : 1;
    const pivotX = this.state.x / dpr;
    const pivotY = this.state.y / dpr;
    const cap = captureRegion(pivotX, pivotY, renderSize, this.config.zoomFactor);
    const vueNodes = !!((_a = window.LiteGraph) == null ? void 0 : _a.vueNodesMode);
    const currentScale = lgCanvas.ds.scale;
    const virtualZoom = currentScale < 1 && !this.config.forceDirectCapture && !vueNodes;
    if (virtualZoom) {
      const now = performance.now();
      if (now - this.lastVirtualZoomTime < VIRTUAL_ZOOM_MIN_INTERVAL_MS) return this.offscreenCanvas;
      this.lastVirtualZoomTime = now;
    }
    const media = this.collectDomMedia(rect, vueNodes, cap, pivotX, pivotY, virtualZoom ? 1 / currentScale : 1);
    if (virtualZoom) {
      return this.renderVirtualZoom(lgCanvas, targetCanvas, rect, dpr, pivotX, pivotY, cap, media);
    }
    return this.renderDirectCapture(targetCanvas, dpr, cap, media, vueNodes);
  }
  /**
   * Read phase: measure loaded, same-origin DOM images and videos (DOM widgets, or Vue node bodies)
   * under the glass before any canvas draw. Boxes are CSS pixels relative to the canvas, scaled by
   * domScale about the pivot into the capture frame.
   */
  collectDomMedia(rect, vueNodes, cap, pivotX, pivotY, domScale) {
    const selector = vueNodes ? "[data-node-id] img, [data-node-id] video" : ".dom-widget img, .dom-widget video";
    const media = [];
    for (const el of document.querySelectorAll(selector)) {
      const loaded = el instanceof HTMLVideoElement ? el.readyState >= 2 : el.complete && el.naturalWidth > 0;
      if (!loaded) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const box = scaleAbout({ x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height }, pivotX, pivotY, domScale);
      if (box.x + box.w <= cap.left || box.x >= cap.left + cap.size) continue;
      if (box.y + box.h <= cap.top || box.y >= cap.top + cap.size) continue;
      if (!isSafeMediaSource(el)) continue;
      media.push({ el, box, objectFit: getComputedStyle(el).objectFit });
    }
    return media;
  }
  /**
   * Nodes of the graph on screen (including subgraphs and collapsed nodes) whose title or body
   * overlaps the capture region, in canvas render order (back to front).
   */
  getVisibleNodes(cap, scale, offset) {
    const visibleNodes = [];
    for (const node of app.canvas.visible_nodes) {
      const box = graphBoxToCss(boundingBox(node), [0, 0], scale, offset);
      if (box.x + box.w < cap.left || box.x > cap.left + cap.size) continue;
      if (box.y + box.h < cap.top || box.y > cap.top + cap.size) continue;
      visibleNodes.push(node);
    }
    return visibleNodes;
  }
  accessibilityFilter() {
    if (this.config.invertColors) return "invert(1)";
    if (this.config.grayscaleMode) return "grayscale(1)";
    return "none";
  }
  drawCapture(targetCanvas, dpr, cap) {
    const renderSize = this.config.glassSize;
    this.offscreenCtx.save();
    this.offscreenCtx.filter = this.accessibilityFilter();
    this.offscreenCtx.drawImage(
      targetCanvas,
      cap.left * dpr,
      cap.top * dpr,
      cap.size * dpr,
      cap.size * dpr,
      0,
      0,
      renderSize,
      renderSize
    );
    this.offscreenCtx.restore();
  }
  /**
   * Mode 1: Direct Capture (Nuclear Fix)
   * Copies pixels directly from screen. Zero drift.
   */
  renderDirectCapture(targetCanvas, dpr, cap, media, vueNodes) {
    try {
      this.isCapturing = true;
      const renderSize = this.config.glassSize;
      this.offscreenCtx.clearRect(0, 0, renderSize, renderSize);
      this.drawCapture(targetCanvas, dpr, cap);
      const ds = app.canvas.ds;
      const scale = ds.scale;
      const offset = [ds.offset[0], ds.offset[1]];
      const visibleNodes = vueNodes ? [] : this.getVisibleNodes(cap, scale, offset);
      this.drawMedia(targetCanvas, dpr, visibleNodes, media, cap, scale, offset);
      this.drawWidgetTextNatively(visibleNodes, cap, scale, offset);
      if (this.config.accessibilityEnabled && this.config.nodeTitleEmphasis) {
        this.drawNodeTitlesNatively(visibleNodes, cap, scale, offset);
      }
      if (this.config.showCursorPreview) {
        this.drawCursorPreview(renderSize);
      }
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
  renderVirtualZoom(lgCanvas, targetCanvas, rect, dpr, pivotX, pivotY, cap, media) {
    const ds = lgCanvas.ds;
    const origScale = ds.scale;
    const origOffsetX = ds.offset[0];
    const origOffsetY = ds.offset[1];
    const renderSize = this.config.glassSize;
    this.isCapturing = true;
    window.__magnifyGlassCapturing = true;
    try {
      lgCanvas.setZoom(1, [pivotX + rect.left, pivotY + rect.top]);
      const hiddenNodeImages = /* @__PURE__ */ new Map();
      const hiddenNodeWidgets = /* @__PURE__ */ new Map();
      for (const node of lgCanvas.graph._nodes) {
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
              const isPreview = wName.includes("preview") || wName.includes("gallery") || wType.includes("preview");
              return !isPreview;
            });
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
      this.offscreenCtx.clearRect(0, 0, renderSize, renderSize);
      this.drawCapture(targetCanvas, dpr, cap);
      const captureScale = ds.scale;
      const captureOffset = [ds.offset[0], ds.offset[1]];
      const visibleNodes = this.getVisibleNodes(cap, captureScale, captureOffset);
      this.drawMedia(targetCanvas, dpr, visibleNodes, media, cap, captureScale, captureOffset);
      this.drawWidgetTextNatively(visibleNodes, cap, captureScale, captureOffset);
      if (this.config.accessibilityEnabled && this.config.nodeTitleEmphasis) {
        this.drawNodeTitlesNatively(visibleNodes, cap, captureScale, captureOffset);
      }
      if (this.config.showCursorPreview) {
        this.drawCursorPreview(renderSize);
      }
      return this.offscreenCanvas;
    } catch (e) {
      console.warn("VirtualZoom failed", e);
      return null;
    } finally {
      ds.scale = origScale;
      ds.offset[0] = origOffsetX;
      ds.offset[1] = origOffsetY;
      this.isCapturing = false;
      window.__magnifyGlassCapturing = false;
      lgCanvas.draw(true, true);
    }
  }
  /**
   * Draw canvas image previews (from full-resolution node.imgs) and DOM images/videos
   * into the glass. Video is redrawn every tick, so it plays.
   */
  drawMedia(targetCanvas, dpr, visibleNodes, media, cap, scale, offset) {
    var _a, _b, _c;
    const ctx = this.offscreenCtx;
    const renderSize = this.config.glassSize;
    const onGlass = (b) => b.w > 0 && b.h > 0 && b.x < renderSize && b.y < renderSize && b.x + b.w > 0 && b.y + b.h > 0;
    const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
    ctx.save();
    ctx.filter = this.accessibilityFilter();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    const sizeTextMargin = getSettingValue("Comfy.Node.AllowImageSizeDraw", true) ? 15 : 0;
    for (const [i, node] of visibleNodes.entries()) {
      const widget = !((_a = node.flags) == null ? void 0 : _a.collapsed) && ((_b = node.imgs) == null ? void 0 : _b.length) && ((_c = node.widgets) == null ? void 0 : _c.find((w) => w.name === "$$canvas-image-preview"));
      if (!widget) continue;
      for (const { img, box } of previewImageBoxes(node.imgs, widget, node, sizeTextMargin)) {
        const g = toGlass(graphBoxToCss(box, node.pos, scale, offset), cap);
        if (onGlass(g) && isSafeMediaSource(img)) ctx.drawImage(img, g.x, g.y, g.w, g.h);
      }
      const nodeBox = toGlass(graphBoxToCss({ x: 0, y: 0, w: node.size[0], h: node.size[1] }, node.pos, scale, offset), cap);
      for (const front of visibleNodes.slice(i + 1)) {
        const f = toGlass(graphBoxToCss(boundingBox(front), [0, 0], scale, offset), cap);
        if (!overlaps(f, nodeBox)) continue;
        ctx.save();
        ctx.beginPath();
        ctx.rect(f.x, f.y, f.w, f.h);
        ctx.clip();
        this.drawCapture(targetCanvas, dpr, cap);
        ctx.restore();
      }
    }
    for (const { el, box, objectFit } of media) {
      const g = toGlass(box, cap);
      if (!onGlass(g)) continue;
      const content = el instanceof HTMLVideoElement ? fitContent(g, el.videoWidth, el.videoHeight, objectFit) : fitContent(g, el.naturalWidth, el.naturalHeight, objectFit);
      ctx.save();
      ctx.beginPath();
      ctx.rect(g.x, g.y, g.w, g.h);
      ctx.clip();
      ctx.drawImage(el, content.x, content.y, content.w, content.h);
      ctx.restore();
    }
    ctx.restore();
  }
  /**
   * Draw node titles natively with accessibility styling.
   */
  drawNodeTitlesNatively(visibleNodes, cap, scale, offset) {
    var _a;
    if (!this.offscreenCtx) return;
    const ctx = this.offscreenCtx;
    const renderSize = this.config.glassSize;
    for (const node of visibleNodes) {
      if ((_a = node.flags) == null ? void 0 : _a.collapsed) continue;
      const title = node.title || node.type || "Node";
      const nodeCssX = (node.pos[0] + offset[0]) * scale;
      const nodeCssY = (node.pos[1] + offset[1]) * scale;
      const nodeCssWidth = node.size[0] * scale;
      if (nodeCssX + nodeCssWidth < cap.left || nodeCssX > cap.left + cap.size) continue;
      if (nodeCssY + TITLE_HEIGHT * scale < cap.top || nodeCssY > cap.top + cap.size) continue;
      const canvasX = (nodeCssX - cap.left) * cap.k;
      const canvasY = (nodeCssY - cap.top) * cap.k;
      const canvasWidth = nodeCssWidth * cap.k;
      const canvasHeight = TITLE_HEIGHT * scale * cap.k;
      if (canvasX + canvasWidth > 0 && canvasX < renderSize && canvasY + canvasHeight > 0 && canvasY < renderSize) {
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(canvasX, canvasY - 5 * scale, canvasWidth, canvasHeight, 4);
        ctx.fillStyle = this.config.highContrastMode ? "#000000" : "#222222";
        ctx.fill();
        ctx.strokeStyle = this.config.highContrastMode ? "#ffffff" : "#444444";
        ctx.lineWidth = 2;
        ctx.stroke();
        const baseFontSize = 14;
        let scaleFactor = this.config.fontScaleFactor / 100;
        scaleFactor *= 1.1;
        const fontSize = Math.max(12, Math.min(32, baseFontSize * scale * cap.k * scaleFactor));
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        let textColor = "#ffffff";
        if (this.config.highContrastMode) textColor = "#ffff00";
        ctx.fillStyle = textColor;
        if (this.config.textGlowEnabled) {
          ctx.shadowBlur = this.config.textGlowIntensity;
          ctx.shadowColor = this.config.textGlowColor;
        }
        const padding = 10 * scale * cap.k;
        ctx.fillText(title, canvasX + padding, canvasY + canvasHeight / 2 - 5 * scale);
        ctx.restore();
      }
    }
  }
  /**
   * Draw widget text natively on the offscreen canvas.
   * This renders text content that would otherwise be lost since widgets are DOM elements.
   * 
   * @param visibleNodes - List of nodes to check for text widgets
   * @param cap - Capture region (CSS pixels) and glass scale
   * @param scale - Canvas scale used during capture
   * @param offset - Canvas offset [x, y] used during capture
   */
  drawWidgetTextNatively(visibleNodes, cap, scale, offset) {
    var _a;
    if (!this.offscreenCtx) return;
    const ctx = this.offscreenCtx;
    const renderSize = this.config.glassSize;
    const WIDGET_HEIGHT = 20;
    const WIDGET_MARGIN = 4;
    const PADDING = 15;
    for (const node of visibleNodes) {
      if (!node.widgets) continue;
      if ((_a = node.flags) == null ? void 0 : _a.collapsed) continue;
      const nodeCssX = (node.pos[0] + offset[0]) * scale;
      const nodeCssY = (node.pos[1] + offset[1]) * scale;
      const nodeCssWidth = node.size[0] * scale;
      const nodeCssHeight = node.size[1] * scale;
      if (nodeCssX + nodeCssWidth < cap.left || nodeCssX > cap.left + cap.size) continue;
      if (nodeCssY + nodeCssHeight < cap.top || nodeCssY > cap.top + cap.size) continue;
      let widgetY = TITLE_HEIGHT;
      for (const widget of node.widgets) {
        const widgetLocalY = widget.last_y ?? widgetY;
        const widgetType = String(widget.type || "").toLowerCase();
        const computedHeight = widget.computedHeight || 0;
        const isMarkdownWidget = widgetType === "markdown";
        const isMultiLineWidget = isMarkdownWidget || widgetType === "customtext" || (widgetType === "text" || widgetType === "textarea") && computedHeight >= 40;
        const widgetCssX = nodeCssX + PADDING * scale;
        const widgetCssY = nodeCssY + widgetLocalY * scale;
        const widgetCssWidth = nodeCssWidth - PADDING * 2 * scale;
        const canvasX = (widgetCssX - cap.left) * cap.k;
        const canvasY = (widgetCssY - cap.top) * cap.k;
        const widgetWidth = widgetCssWidth * cap.k;
        const baseFontSize = 13;
        let scaleFactor = 1;
        if (this.config.accessibilityEnabled) {
          scaleFactor = this.config.fontScaleFactor / 100;
        }
        const fontSize = Math.max(10, Math.min(28 * scaleFactor, baseFontSize * scale * cap.k * scaleFactor));
        const lineHeight = fontSize * 1.4;
        if (isMultiLineWidget && widget.value !== void 0 && widget.value !== null) {
          const textValue = String(widget.value);
          if (textValue.length > 0) {
            let contentHeight = 0;
            if (isMarkdownWidget) {
              ctx.save();
              const fontWeight = this.config.accessibilityEnabled && this.config.boldTextEnabled ? "700" : "500";
              ctx.font = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
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
            const maxWidgetHeight = maxWidgetHeightCss * cap.k;
            const widgetHeight = isMarkdownWidget ? Math.min(Math.max(widget.computedHeight * scale * cap.k || 0, contentHeight), maxWidgetHeight) : widget.computedHeight ? widget.computedHeight * scale * cap.k : Math.max(80, fontSize * 5);
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
              ctx.fillStyle = this.config.accessibilityEnabled && this.config.highContrastMode ? "#000000" : "#1e1e1e";
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
    let textColor = "#e0e0e0";
    if (this.config.accessibilityEnabled && this.config.highContrastMode) {
      textColor = "#ffffff";
    }
    ctx.fillStyle = textColor;
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
      const fontWeight = this.config.accessibilityEnabled && this.config.boldTextEnabled ? "700" : "500";
      const headerWeight = this.config.accessibilityEnabled && this.config.boldTextEnabled ? "900" : "700";
      let currentFont = `${fontWeight} ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
      let indent = 0;
      let color = textColor;
      if (line.startsWith("#")) {
        const level = ((_a = line.match(/^#+/)) == null ? void 0 : _a[0].length) || 0;
        renderText = line.substring(level).trim();
        const headerScale = Math.max(1.1, 1.8 - level * 0.15);
        const headerSize = fontSize * headerScale;
        currentFont = `${headerWeight} ${headerSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif`;
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
        this.drawAccessibleText(ctx, wrap, x + indent, currentY);
        const currentLineHeight = line.startsWith("#") ? parseFloat(currentFont.split(" ")[1]) * 1.4 : lineHeight;
        currentY += currentLineHeight;
      }
    }
  }
  /**
   * Draw a mini cursor preview at the center of the glass.
   * The cursor is drawn as a classic arrow pointer with a contrasting outline.
   * @param renderSize - The render size of the glass in pixels
   */
  drawCursorPreview(renderSize) {
    if (!this.offscreenCtx) return;
    const ctx = this.offscreenCtx;
    const cursorSize = Math.max(16, Math.min(32, renderSize * 0.1));
    const centerX = renderSize / 2;
    const centerY = renderSize / 2;
    ctx.save();
    ctx.translate(centerX, centerY);
    const scale = cursorSize / 24;
    ctx.scale(scale, scale);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, 17);
    ctx.lineTo(4, 13);
    ctx.lineTo(7, 20);
    ctx.lineTo(10, 19);
    ctx.lineTo(7, 12);
    ctx.lineTo(12, 12);
    ctx.closePath();
    ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0, 0, 0, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }
  /**
   * Draw text with accessibility enhancements (glow, outline).
   */
  drawAccessibleText(ctx, text, x, y) {
    if (!this.config.accessibilityEnabled) {
      ctx.fillText(text, x, y);
      return;
    }
    ctx.save();
    if (this.config.textGlowEnabled) {
      ctx.shadowBlur = this.config.textGlowIntensity;
      ctx.shadowColor = this.config.textGlowColor;
      ctx.fillText(text, x, y);
    }
    if (this.config.textOutlineEnabled) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = this.config.textOutlineColor;
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;
      ctx.strokeText(text, x, y);
    }
    if (this.config.highContrastMode) {
      ctx.fillStyle = "#ffffff";
    }
    ctx.shadowBlur = 0;
    ctx.fillText(text, x, y);
    ctx.restore();
  }
}
export {
  OffscreenRenderer
};
