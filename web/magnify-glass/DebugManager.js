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
    if (this.config.debugMode) {
      console.log("ComfyUI Magnifying Glass:", ...args);
    }
  }
  /**
   * Log an error message.
   */
  error(...args) {
    console.error("ComfyUI Magnifying Glass ERROR:", ...args);
  }
  /**
   * Print detailed canvas information for debugging.
   */
  printCanvasInfo() {
    if (!this.config.debugMode) return;
    try {
      const canvasManager = app.canvas;
      const canvas = canvasManager == null ? void 0 : canvasManager.graph_canvas;
      if (!canvas) {
        this.log("Could not find graph canvas for detailed info");
        return;
      }
      this.log("---- Canvas Information ----");
      this.log(`Canvas dimensions: ${canvas.width}x${canvas.height}`);
      this.log(`Canvas display size: ${canvas.clientWidth}x${canvas.clientHeight}`);
      this.log(`Canvas CSS transform: ${canvas.style.transform || "none"}`);
      const ds = canvasManager.ds;
      if (ds) {
        this.log(`Canvas DS scale: ${ds.scale}`);
        if (ds.offset) {
          this.log(`Canvas DS offset: [${ds.offset[0]}, ${ds.offset[1]}]`);
        } else {
          this.log("Canvas DS offset not found");
        }
      } else {
        this.log("Canvas DS object not found");
      }
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      const canvasWidth = canvas.width;
      const canvasHeight = canvas.height;
      this.log(`Window dimensions: ${screenWidth}x${screenHeight}`);
      this.log(`Resolution scale factor: X=${canvasWidth / screenWidth}, Y=${canvasHeight / screenHeight}`);
      this.log("---- End Canvas Information ----");
    } catch (e) {
      this.log("Error in printCanvasInfo:", e);
    }
  }
  /**
   * Update the debug visualization canvas.
   */
  updateDebugView() {
    if (!this.config.debugMode || !this.ui || !this.ui.debugCanvas || !this.ui.debugCtx) return;
    const debugCtx = this.ui.debugCtx;
    const debugCanvas = this.ui.debugCanvas;
    debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
    debugCtx.fillStyle = "rgba(0,0,0,0.8)";
    debugCtx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);
    debugCtx.fillStyle = "#FFFFFF";
    debugCtx.font = "14px monospace";
    debugCtx.fillText("Magnify Glass Debug", 10, 20);
    debugCtx.font = "12px monospace";
    debugCtx.fillText(`Cursor: (${this.state.x.toFixed(1)}, ${this.state.y.toFixed(1)})`, 10, 50);
    debugCtx.fillText(`Source Rect: (${this.state.sourceX.toFixed(1)}, ${this.state.sourceY.toFixed(1)}, w:${this.state.sourceWidth.toFixed(1)}, h:${this.state.sourceHeight.toFixed(1)})`, 10, 70);
    debugCtx.fillText(`Canvas Scale: ${this.state.canvasScale.toFixed(2)}`, 10, 90);
    debugCtx.fillText(`Canvas Offset: (${this.state.canvasOffsetX.toFixed(1)}, ${this.state.canvasOffsetY.toFixed(1)})`, 10, 110);
    debugCtx.fillStyle = "#FFFF00";
    debugCtx.fillText(`MANUAL OFFSETS: X=${this.config.offsetX}, Y=${this.config.offsetY} (Use arrow keys to adjust)`, 10, 130);
    debugCtx.fillStyle = "#FFFFFF";
    this.drawCanvasVisualization(debugCtx, debugCanvas);
  }
  /**
   * Draw a scaled visualization of the canvas and source region.
   */
  drawCanvasVisualization(debugCtx, debugCanvas) {
    const canvasScale = 0.1;
    const canvasVisX = 10;
    const canvasVisY = 170;
    const canvasVisWidth = 380;
    const canvasVisHeight = 150;
    debugCtx.strokeStyle = "#AAAAAA";
    debugCtx.strokeRect(canvasVisX, canvasVisY, canvasVisWidth, canvasVisHeight);
    debugCtx.fillStyle = "#444444";
    debugCtx.fillRect(canvasVisX, canvasVisY, canvasVisWidth, canvasVisHeight);
    const cursorVisX = canvasVisX + this.state.x * canvasScale;
    const cursorVisY = canvasVisY + this.state.y * canvasScale;
    const sourceRectVisX = canvasVisX + this.state.sourceX * canvasScale;
    const sourceRectVisY = canvasVisY + this.state.sourceY * canvasScale;
    const sourceRectVisWidth = this.state.sourceWidth * canvasScale;
    const sourceRectVisHeight = this.state.sourceHeight * canvasScale;
    debugCtx.strokeStyle = "#FF0000";
    debugCtx.strokeRect(sourceRectVisX, sourceRectVisY, sourceRectVisWidth, sourceRectVisHeight);
    debugCtx.fillStyle = "#FFFF00";
    debugCtx.beginPath();
    debugCtx.arc(cursorVisX, cursorVisY, 3, 0, Math.PI * 2);
    debugCtx.fill();
    debugCtx.strokeStyle = "#00FF00";
    debugCtx.beginPath();
    debugCtx.moveTo(cursorVisX, cursorVisY);
    debugCtx.lineTo(sourceRectVisX + sourceRectVisWidth / 2, sourceRectVisY + sourceRectVisHeight / 2);
    debugCtx.stroke();
    debugCtx.fillStyle = "#FFFFFF";
    debugCtx.fillText("Canvas Visualization (scaled)", canvasVisX, canvasVisY - 5);
    const offsetX = this.state.sourceX - this.state.x + this.state.sourceWidth / 2;
    const offsetY = this.state.sourceY - this.state.y + this.state.sourceHeight / 2;
    debugCtx.fillText(`Alignment Offset: (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`, 10, canvasVisY + canvasVisHeight + 20);
  }
}
export {
  DebugManager
};
//# sourceMappingURL=DebugManager.js.map
