var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class MagnifierState {
  constructor() {
    /** Whether the magnifier is currently active */
    __publicField(this, "active");
    /** Track if the glass has been activated before */
    __publicField(this, "wasActivatedBefore");
    /** Cursor X relative to litegraphCanvas */
    __publicField(this, "x");
    /** Cursor Y relative to litegraphCanvas */
    __publicField(this, "y");
    /** Calculated source area X */
    __publicField(this, "sourceX");
    /** Calculated source area Y */
    __publicField(this, "sourceY");
    /** Calculated source area width */
    __publicField(this, "sourceWidth");
    /** Calculated source area height */
    __publicField(this, "sourceHeight");
    /** Current canvas scale/zoom */
    __publicField(this, "canvasScale");
    /** Canvas translation X */
    __publicField(this, "canvasOffsetX");
    /** Canvas translation Y */
    __publicField(this, "canvasOffsetY");
    /** Flag to manage requestAnimationFrame */
    __publicField(this, "isRenderScheduled");
    /** Whether glass drag mode is enabled (move icon on hover controls) */
    __publicField(this, "isDragModeEnabled");
    // --- Debug Metrics for Virtual Zoom ---
    __publicField(this, "virtualMouseCssX");
    __publicField(this, "virtualMouseCssY");
    __publicField(this, "virtualGraphX");
    __publicField(this, "virtualGraphY");
    __publicField(this, "virtualNewOffsetX");
    __publicField(this, "virtualNewOffsetY");
    // --- Manual Calibration ---
    __publicField(this, "virtualDebugOffsetX");
    __publicField(this, "virtualDebugOffsetY");
    this.active = false;
    this.wasActivatedBefore = false;
    this.x = 0;
    this.y = 0;
    this.sourceX = 0;
    this.sourceY = 0;
    this.sourceWidth = 0;
    this.sourceHeight = 0;
    this.canvasScale = 1;
    this.canvasOffsetX = 0;
    this.canvasOffsetY = 0;
    this.isRenderScheduled = false;
    this.isDragModeEnabled = false;
    this.virtualMouseCssX = 0;
    this.virtualMouseCssY = 0;
    this.virtualGraphX = 0;
    this.virtualGraphY = 0;
    this.virtualNewOffsetX = 0;
    this.virtualNewOffsetY = 0;
    this.virtualDebugOffsetX = 0;
    this.virtualDebugOffsetY = 0;
  }
  /**
   * Reset state to initial values.
   */
  reset() {
    this.active = false;
    this.wasActivatedBefore = false;
    this.x = 0;
    this.y = 0;
    this.sourceX = 0;
    this.sourceY = 0;
    this.sourceWidth = 0;
    this.sourceHeight = 0;
    this.canvasScale = 1;
    this.canvasOffsetX = 0;
    this.canvasOffsetY = 0;
    this.isRenderScheduled = false;
  }
}
export {
  MagnifierState
};
//# sourceMappingURL=MagnifierState.js.map
