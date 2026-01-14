import { app } from "/scripts/app.js";
function getSettingValue(key, fallback) {
  try {
    const value = app.ui.settings.getSettingValue(key);
    return value === void 0 ? fallback : value;
  } catch (e) {
    console.warn(`ComfyUI Magnifying Glass: Could not get setting ${key}, using default ${fallback}. Error: ${e}`);
    return fallback;
  }
}
function setSettingValue(key, value) {
  try {
    app.ui.settings.setSettingValue(key, value);
  } catch (e) {
    console.warn(`Failed to set setting ${key}:`, e);
  }
}
function isUserTyping() {
  const activeElement = document.activeElement;
  if (!activeElement) return false;
  const tagName = activeElement.tagName.toLowerCase();
  if (tagName === "input" || tagName === "textarea") {
    return true;
  }
  if (activeElement.contentEditable === "true") {
    return true;
  }
  if (activeElement.closest("form") || activeElement.classList.contains("cm-editor") || // CodeMirror editor
  activeElement.classList.contains("monaco-editor") || // Monaco editor
  activeElement.closest(".cm-editor") || activeElement.closest(".monaco-editor")) {
    return true;
  }
  return false;
}
function rectsOverlap(rect1, rect2) {
  return rect1.x < rect2.x + rect2.width && rect1.x + rect1.width > rect2.x && rect1.y < rect2.y + rect2.height && rect1.y + rect1.height > rect2.y;
}
function findLiteGraphCanvas() {
  var _a, _b;
  const canvas = document.getElementById("graph-canvas");
  if (canvas) return canvas;
  const graphCanvas = document.querySelector("canvas.graphcanvas");
  if (graphCanvas) return graphCanvas;
  const appAny = app;
  if ((_a = appAny == null ? void 0 : appAny.canvas_manager) == null ? void 0 : _a.container) {
    const managerCanvas = appAny.canvas_manager.container.querySelector("canvas");
    if (managerCanvas) return managerCanvas;
  }
  if ((_b = appAny == null ? void 0 : appAny.canvas) == null ? void 0 : _b.graph_canvas) {
    return appAny.canvas.graph_canvas;
  }
  return null;
}
function escapeHtml(str) {
  if (str === null || str === void 0) return "";
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
export {
  escapeHtml,
  findLiteGraphCanvas,
  getSettingValue,
  isUserTyping,
  rectsOverlap,
  setSettingValue
};
//# sourceMappingURL=utils.js.map
