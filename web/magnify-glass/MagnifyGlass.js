var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { findLiteGraphCanvas, rectsOverlap } from "../shared/utils.js";
import { INFO_PANEL_ID, DEFAULT_PADDING, DEFAULT_GLASS_Y_OFFSET } from "../shared/constants.js";
import { registerGlassSettings } from "../shared/settings/glassSettings.js";
import "/scripts/app.js";
import { registerAccessibilitySettings } from "../shared/settings/accessibilitySettings.js";
import { ConfigManager } from "./ConfigManager.js";
import { MagnifierState } from "./MagnifierState.js";
import { UiManager } from "./UiManager.js";
import { WebGLRenderer } from "./WebGLRenderer.js";
import { DebugManager } from "./DebugManager.js";
import { EventHandler } from "./EventHandler.js";
import { PopOutManager } from "./PopOutManager.js";
import { OffscreenRenderer } from "./OffscreenRenderer.js";
class MagnifyGlass {
  constructor() {
    __publicField(this, "config");
    __publicField(this, "state");
    __publicField(this, "ui");
    __publicField(this, "renderer");
    __publicField(this, "debugger");
    __publicField(this, "eventHandler");
    __publicField(this, "popOutManager");
    __publicField(this, "offscreenRenderer");
    /** The LiteGraph canvas */
    __publicField(this, "litegraphCanvas");
    /** Last known mouse position for better initial positioning */
    __publicField(this, "lastKnownMousePosition");
    /** Whether we're currently over media (for info panel) */
    __publicField(this, "isOverMedia");
    /** Current media element under cursor */
    __publicField(this, "currentMediaElement");
    this.config = new ConfigManager();
    this.state = new MagnifierState();
    this.popOutManager = new PopOutManager();
    this.ui = new UiManager(
      this.config,
      this.state,
      () => this.toggle()
    );
    this.renderer = null;
    this.offscreenRenderer = null;
    this.debugger = new DebugManager(this.config, this.state, this.ui);
    this.eventHandler = new EventHandler(this);
    this.litegraphCanvas = null;
    this.lastKnownMousePosition = { x: 0, y: 0 };
    this.isOverMedia = false;
    this.currentMediaElement = null;
  }
  /**
   * Initialize the magnifying glass.
   */
  init() {
    if (typeof LiteGraph === "undefined" || typeof app === "undefined" || !app.canvas) {
      this.debugger.log("LiteGraph or app not ready, retrying in 100ms.");
      setTimeout(() => this.init(), 100);
      return;
    }
    this.debugger.log("LiteGraph and app ready.");
    this.config.loadSavedOffsets();
    this.ui.createElements();
    this.ui.updateResponsivePosition();
    this.renderer = new WebGLRenderer(this.config, this.state, this.ui);
    if (!this.renderer.isValid()) {
      this.ui.cleanup();
      return;
    }
    this.litegraphCanvas = findLiteGraphCanvas();
    this.debugger.log("LiteGraph canvas found:", this.litegraphCanvas);
    if (!this.litegraphCanvas) {
      this.debugger.error("Could not find LiteGraph canvas. Magnifier will not work.");
      this.ui.cleanup();
      return;
    }
    this.offscreenRenderer = new OffscreenRenderer(this.config, this.state);
    this.eventHandler.attachListeners();
    registerGlassSettings(this);
    registerAccessibilitySettings(this);
    this.debugger.log(`Initialized (WebGL) with Smart Input Detection. Press ${this.config.altRequired ? "Alt+" : ""}${this.config.activationKey.toUpperCase()} to activate.`);
  }
  /**
   * Toggle the magnifying glass active state.
   */
  toggle() {
    const state = this.state;
    if (state.active) {
      this.forceHideAllComponents();
    } else {
      state.active = true;
      this.ui.show();
      if (this.eventHandler) {
        this.eventHandler.updateInitialPosition();
      }
    }
  }
  /**
   * Force hide all components including extensions (Info Panel, etc).
   * This overcomes the "pinned" state of the info panel when the main tool is deactivated.
   */
  forceHideAllComponents() {
    this.state.active = false;
    this.ui.hide();
    const panelEl = document.getElementById(INFO_PANEL_ID);
    if (panelEl) {
      panelEl.style.display = "none";
      panelEl.style.opacity = "0";
    }
    const extensions = window.comfyUIMagnifyGlassExtensions;
    if (extensions && extensions.length > 0) {
      extensions.forEach((extension) => {
        if (extension && extension.uiManager && typeof extension.uiManager.hide === "function") {
          extension.uiManager.hide();
          if (extension.uiManager.elements && extension.uiManager.elements.panel) {
            extension.uiManager.elements.panel.style.display = "none";
          }
        }
      });
    }
  }
  /**
   * Set glass preview visibility WITHOUT affecting info panel.
   * This is used by the toggle-glass hover control button.
   * When hidden, the renderer stops completely to save performance.
   * When shown, the renderer resumes.
   * 
   * @param visible - true to show and enable rendering, false to hide and disable
   */
  setGlassPreviewActive(visible) {
    this.state.isPreviewHidden = !visible;
    if (visible) {
      this.ui.setPreviewVisibility(true);
    } else {
      this.ui.setPreviewVisibility(false);
    }
  }
  /**
   * Check if the glass preview is visible.
   * Returns false if hidden via hover controls.
   */
  isGlassPreviewVisible() {
    var _a;
    const extensions = window.comfyUIMagnifyGlassExtensions;
    if (extensions && extensions.length > 0) {
      const infoPanel = extensions[0];
      if ((_a = infoPanel == null ? void 0 : infoPanel.stateManager) == null ? void 0 : _a.state) {
        return infoPanel.stateManager.state.isGlassPreviewVisible !== false;
      }
    }
    return true;
  }
  /**
   * Update the magnified view.
   */
  updateMagnifiedView() {
    if (!this.state.active || !this.renderer || !this.litegraphCanvas) {
      return;
    }
    if (this.state.isPreviewHidden) {
      return;
    }
    this.updateCanvasTransformation();
    this.calculateSourceRegion();
    if (!this.state.isRenderScheduled) {
      this.state.isRenderScheduled = true;
      requestAnimationFrame(() => {
        if (!this.state.active || !this.renderer || !this.litegraphCanvas) {
          this.state.isRenderScheduled = false;
          return;
        }
        let sourceCanvas = this.litegraphCanvas;
        if (this.offscreenRenderer && this.offscreenRenderer.isAvailable()) {
          const highResCanvas = this.offscreenRenderer.renderHighResRegion(this.litegraphCanvas);
          if (highResCanvas) {
            sourceCanvas = highResCanvas;
          }
        }
        this.renderer.render(sourceCanvas);
        this.renderHtmlOverlays();
        if (this.popOutManager.isPopOutOpen() && this.ui.glassCanvas) {
          this.popOutManager.sendFrame(this.ui.glassCanvas);
        }
        this.state.isRenderScheduled = false;
      });
    }
  }
  /**
   * Update canvas transformation state.
   */
  updateCanvasTransformation() {
    this.state.canvasScale = 1;
    this.state.canvasOffsetX = 0;
    this.state.canvasOffsetY = 0;
    if (app == null ? void 0 : app.canvas) {
      const ds = app.canvas.ds;
      if (ds) {
        if (typeof ds.scale === "number") {
          this.state.canvasScale = ds.scale;
        }
        if (ds.offset) {
          this.state.canvasOffsetX = ds.offset[0] || 0;
          this.state.canvasOffsetY = ds.offset[1] || 0;
        }
      }
    }
  }
  /**
   * Calculate the source region for magnification.
   */
  calculateSourceRegion() {
    const cursorPixelX = this.state.x;
    const cursorPixelY = this.state.y;
    const canvasScale = this.state.canvasScale;
    const canvasOffsetX = this.state.canvasOffsetX;
    const canvasOffsetY = this.state.canvasOffsetY;
    if (canvasScale === 0) return;
    if (!this.litegraphCanvas) return;
    const rect = this.litegraphCanvas.getBoundingClientRect();
    const dpr = rect.width > 0 ? this.litegraphCanvas.width / rect.width : 1;
    const cursorCssX = cursorPixelX / dpr;
    const cursorCssY = cursorPixelY / dpr;
    const cursorGraphX = (cursorCssX - canvasOffsetX) / canvasScale;
    const cursorGraphY = (cursorCssY - canvasOffsetY) / canvasScale;
    const targetGraphCenterX = cursorGraphX + this.config.offsetX;
    const targetGraphCenterY = cursorGraphY + this.config.offsetY;
    const sourceGraphWidth = this.config.glassSize / this.config.zoomFactor / canvasScale;
    const sourceGraphHeight = this.config.glassSize / this.config.zoomFactor / canvasScale;
    const sourceGraphX = targetGraphCenterX - sourceGraphWidth / 2;
    const sourceGraphY = targetGraphCenterY - sourceGraphHeight / 2;
    const sourceCssX = sourceGraphX * canvasScale + canvasOffsetX;
    const sourceCssY = sourceGraphY * canvasScale + canvasOffsetY;
    const sourceCssWidth = sourceGraphWidth * canvasScale;
    const sourceCssHeight = sourceGraphHeight * canvasScale;
    this.state.sourceX = sourceCssX * dpr;
    this.state.sourceY = sourceCssY * dpr;
    this.state.sourceWidth = sourceCssWidth * dpr;
    this.state.sourceHeight = sourceCssHeight * dpr;
  }
  /**
   * Render HTML overlays for text and media in the magnified view.
   */
  renderHtmlOverlays() {
    const graph = app.graph;
    if (!this.state.active || !this.ui.htmlOverlayContainer || !graph || !this.litegraphCanvas) {
      if (this.ui.htmlOverlayContainer) this.ui.htmlOverlayContainer.innerHTML = "";
      return;
    }
    this.ui.htmlOverlayContainer.innerHTML = "";
    const magnifyRect = {
      x: this.state.sourceX,
      y: this.state.sourceY,
      width: this.state.sourceWidth,
      height: this.state.sourceHeight
    };
    const nodes = graph._nodes;
    if (!nodes) return;
    for (const node of nodes) {
      const widgets = node.widgets;
      if (!widgets) continue;
      for (const widget of widgets) {
        let isVideoElement = false;
        let isImageElement = false;
        let elementToProcess = null;
        if (widget.element) {
          const element = widget.element;
          if (widget.type === "text" || widget.type === "string" || element.tagName === "TEXTAREA") ;
          else if (element.tagName === "VIDEO") {
            isVideoElement = true;
            elementToProcess = element;
          } else if (element.tagName === "IMG") {
            isImageElement = true;
            elementToProcess = element;
          } else {
            const potentialVideo = element.querySelector("video");
            if (potentialVideo) {
              isVideoElement = true;
              elementToProcess = potentialVideo;
            } else {
              const potentialImage = element.querySelector("img");
              if (potentialImage) {
                isImageElement = true;
                elementToProcess = potentialImage;
              }
            }
          }
        }
        if (elementToProcess && (isVideoElement || isImageElement)) {
          const widgetRect = elementToProcess.getBoundingClientRect();
          const canvasRect = this.litegraphCanvas.getBoundingClientRect();
          const dpr = canvasRect.width > 0 ? this.litegraphCanvas.width / canvasRect.width : 1;
          const currentScale = this.state.canvasScale;
          const isVirtualZoomMode = currentScale < 0.7;
          const widgetCssX = widgetRect.left - canvasRect.left;
          const widgetCssY = widgetRect.top - canvasRect.top;
          const widgetCssWidth = widgetRect.width;
          const widgetCssHeight = widgetRect.height;
          const pivotCssX = this.state.x / dpr;
          const pivotCssY = this.state.y / dpr;
          let finalWidgetCssX;
          let finalWidgetCssY;
          let finalWidgetCssWidth;
          let finalWidgetCssHeight;
          if (isVirtualZoomMode) {
            finalWidgetCssX = (widgetCssX - pivotCssX) / currentScale + pivotCssX;
            finalWidgetCssY = (widgetCssY - pivotCssY) / currentScale + pivotCssY;
            finalWidgetCssWidth = widgetCssWidth / currentScale;
            finalWidgetCssHeight = widgetCssHeight / currentScale;
          } else {
            finalWidgetCssX = widgetCssX;
            finalWidgetCssY = widgetCssY;
            finalWidgetCssWidth = widgetCssWidth;
            finalWidgetCssHeight = widgetCssHeight;
          }
          const widgetCanvasX = finalWidgetCssX * dpr;
          const widgetCanvasY = finalWidgetCssY * dpr;
          const widgetCanvasWidth = finalWidgetCssWidth * dpr;
          const widgetCanvasHeight = finalWidgetCssHeight * dpr;
          const widgetSourceRect = {
            x: widgetCanvasX,
            y: widgetCanvasY,
            width: widgetCanvasWidth,
            height: widgetCanvasHeight
          };
          if (rectsOverlap(magnifyRect, widgetSourceRect)) {
            const clonedElement = elementToProcess.cloneNode(true);
            clonedElement.style.position = "absolute";
            clonedElement.style.pointerEvents = "none";
            if (isVideoElement) {
              const video = clonedElement;
              const originalVideo = elementToProcess;
              video.src = originalVideo.src;
              video.autoplay = originalVideo.autoplay;
              video.loop = originalVideo.loop;
              video.preload = originalVideo.preload;
              video.crossOrigin = originalVideo.crossOrigin;
              video.muted = true;
              if (!originalVideo.paused) {
                video.play().catch((e) => {
                  if (e.name !== "AbortError") {
                    console.warn("Magnify Glass: Cloned video play failed", e);
                  }
                });
              }
              video.currentTime = originalVideo.currentTime;
            } else if (isImageElement) {
              const img = clonedElement;
              const originalImg = elementToProcess;
              img.src = originalImg.src;
              img.alt = originalImg.alt;
            }
            const relativeX = widgetSourceRect.x - magnifyRect.x;
            const relativeY = widgetSourceRect.y - magnifyRect.y;
            const magnifiedX = relativeX * this.config.zoomFactor;
            const magnifiedY = relativeY * this.config.zoomFactor;
            clonedElement.style.left = `${magnifiedX}px`;
            clonedElement.style.top = `${magnifiedY}px`;
            clonedElement.style.width = `${widgetSourceRect.width}px`;
            clonedElement.style.height = `${widgetSourceRect.height}px`;
            clonedElement.style.transformOrigin = "top left";
            clonedElement.style.transform = `scale(${this.config.zoomFactor})`;
            this.ui.htmlOverlayContainer.appendChild(clonedElement);
          }
        }
      }
    }
  }
  /**
   * Update config from current settings values.
   */
  updateConfigFromSettings() {
    this.config.loadSettings();
  }
  /**
   * Apply UI changes based on current config.
   */
  applyUiChanges() {
    var _a;
    this.ui.applyStyles();
    if ((_a = this.renderer) == null ? void 0 : _a.gl) {
      this.renderer.updateViewport();
    }
  }
  /**
   * Reset offsets and panel positions to defaults.
   */
  resetOffsets() {
    this.config.resetOffsets();
    this.config.followCursor = false;
    if (this.state.active) {
      this.updateMagnifiedView();
    }
    if (this.ui.glassDiv) {
      if (!this.state.wasActivatedBefore) {
        const padding = DEFAULT_PADDING;
        this.ui.glassDiv.style.right = `${padding}px`;
        this.ui.glassDiv.style.top = `${DEFAULT_GLASS_Y_OFFSET}px`;
        this.ui.glassDiv.style.left = "auto";
        this.state.wasActivatedBefore = true;
      } else {
        const padding = DEFAULT_PADDING;
        this.ui.glassDiv.style.right = `${padding}px`;
        this.ui.glassDiv.style.top = `${DEFAULT_GLASS_Y_OFFSET}px`;
        this.ui.glassDiv.style.left = "auto";
      }
    }
    const extensions = window.comfyUIMagnifyGlassExtensions;
    if (extensions && extensions.length > 0) {
      extensions.forEach((extension) => {
        var _a;
        if (extension == null ? void 0 : extension.stateManager) {
          extension.stateManager.state.isPanelPinned = false;
          extension.stateManager.state.isPanelLocked = false;
          extension.stateManager.state.isAutoPinned = false;
          extension.stateManager.state.pinnedPosition = { x: 0, y: 0 };
          extension.stateManager.state.lastPinnedPosition = null;
          if (extension.positionManager) {
            extension.positionManager.positionPanel();
          }
          if ((_a = extension.uiManager) == null ? void 0 : _a.updateControlStates) {
            extension.uiManager.updateControlStates();
          }
        }
      });
    }
    this.debugger.log("Reset: Magnify glass and inspector panel positions restored to defaults");
  }
  /**
   * Cleanup all resources.
   */
  cleanup() {
    this.eventHandler.detachListeners();
    this.popOutManager.cleanup();
    this.ui.cleanup();
  }
}
export {
  MagnifyGlass
};
//# sourceMappingURL=MagnifyGlass.js.map
