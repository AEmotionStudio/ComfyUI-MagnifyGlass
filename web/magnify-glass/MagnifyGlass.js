var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { findLiteGraphCanvas } from "../shared/utils.js";
import { DEFAULT_PADDING, DEFAULT_GLASS_Y_OFFSET } from "../shared/constants.js";
import "../shared/settings/defaults.js";
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
import { captureRegion } from "./mediaLayout.js";
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
    /** Render loop ID; the loop runs while the glass is active and visible */
    __publicField(this, "animationLoopId");
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
    this.animationLoopId = null;
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
      this.startAnimationLoop();
    }
  }
  /**
   * Force hide all components including extensions (Info Panel, etc).
   * This hides the info panel even while it floats, when the main tool is deactivated.
   */
  forceHideAllComponents() {
    this.state.active = false;
    this.stopAnimationLoop();
    this.ui.hide();
    const extensions = window.comfyUIMagnifyGlassExtensions;
    if (extensions && extensions.length > 0) {
      extensions.forEach((extension) => {
        if (extension && extension.uiManager && typeof extension.uiManager.hide === "function") {
          extension.uiManager.hide();
        }
      });
    }
  }
  /**
   * Set glass preview visibility WITHOUT affecting info panel.
   * This is used by the toggle-glass hover control button.
   * When hidden, the render loop stops completely to save performance.
   * When shown, the render loop resumes.
   * 
   * @param visible - true to show and enable rendering, false to hide and disable
   */
  setGlassPreviewActive(visible) {
    this.state.isPreviewHidden = !visible;
    this.ui.setPreviewVisibility(visible);
    if (visible && this.state.active) {
      this.startAnimationLoop();
    }
  }
  /**
   * Update the magnified view. Rendering happens in the animation loop,
   * so this only makes sure the loop is running.
   */
  updateMagnifiedView() {
    if (this.state.active) {
      this.startAnimationLoop();
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
   * Calculate the source region (in canvas backing pixels) for magnification.
   */
  calculateSourceRegion() {
    if (!this.litegraphCanvas) return;
    const rect = this.litegraphCanvas.getBoundingClientRect();
    const dpr = rect.width > 0 ? this.litegraphCanvas.width / rect.width : 1;
    const cap = captureRegion(this.state.x / dpr, this.state.y / dpr, this.config.glassSize, this.config.zoomFactor);
    this.state.sourceX = cap.left * dpr;
    this.state.sourceY = cap.top * dpr;
    this.state.sourceWidth = cap.size * dpr;
    this.state.sourceHeight = cap.size * dpr;
  }
  /**
   * Render one frame of the glass and forward it to the pop-out.
   */
  renderFrame(renderer, canvas) {
    var _a;
    this.updateCanvasTransformation();
    this.calculateSourceRegion();
    renderer.render(((_a = this.offscreenRenderer) == null ? void 0 : _a.renderHighResRegion(canvas)) ?? canvas);
    if (this.popOutManager.isPopOutOpen() && this.ui.glassCanvas) {
      this.popOutManager.sendFrame(this.ui.glassCanvas);
    }
  }
  /**
   * Start the render loop. It is the only render path and keeps running without
   * mouse movement, so latent previews and videos update in the glass.
   */
  startAnimationLoop() {
    if (this.animationLoopId !== null) return;
    const animate = () => {
      if (!this.state.active || this.state.isPreviewHidden || !this.renderer || !this.litegraphCanvas) {
        this.animationLoopId = null;
        return;
      }
      this.renderFrame(this.renderer, this.litegraphCanvas);
      this.animationLoopId = requestAnimationFrame(animate);
    };
    this.animationLoopId = requestAnimationFrame(animate);
  }
  /**
   * Stop the animation loop.
   */
  stopAnimationLoop() {
    if (this.animationLoopId !== null) {
      cancelAnimationFrame(this.animationLoopId);
      this.animationLoopId = null;
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
    var _a;
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
    (_a = window.comfyUIMagnifyGlassExtensions) == null ? void 0 : _a.forEach((extension) => extension.resetPosition());
    this.debugger.log("Reset: Magnify glass and inspector panel positions restored to defaults");
  }
  /**
   * Cleanup all resources.
   */
  cleanup() {
    this.stopAnimationLoop();
    this.eventHandler.detachListeners();
    this.popOutManager.cleanup();
    this.ui.cleanup();
  }
}
export {
  MagnifyGlass
};
