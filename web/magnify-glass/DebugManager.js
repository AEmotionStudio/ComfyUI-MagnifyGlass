var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class DebugManager {
  constructor(config, state, ui) {
    __publicField(this, "config");
    __publicField(this, "state");
    __publicField(this, "ui");
    this.config = config;
    this.state = state;
    this.ui = ui;
  }
  /**
   * Log a message if debug mode is enabled.
   */
  log(...args) {
  }
  /**
   * Log an error message.
   */
  error(...args) {
    console.error("ComfyUI Magnifying Glass ERROR:", ...args);
  }
}
export {
  DebugManager
};
