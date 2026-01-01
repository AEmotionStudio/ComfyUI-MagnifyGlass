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
