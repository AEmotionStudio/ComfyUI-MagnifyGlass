import { app } from "/scripts/app.js";
import "./shared/settings/defaults.js";
import { registerPanelSettings } from "./shared/settings/panelSettings.js";
import { mountInfoPanel, unmountInfoPanel } from "./info-panel/InfoPanel.js";
app.registerExtension({
  name: "comfyui.magnify.info.panel",
  init() {
    const checkDependencies = () => {
      if (window.comfyUIMagnifyGlass) {
        initializeInfoPanel(window.comfyUIMagnifyGlass);
      } else {
        setTimeout(checkDependencies, 100);
      }
    };
    checkDependencies();
  },
  // Undo, redo and loading a workflow replace the nodes without moving the mouse, which drives the other updates
  afterConfigureGraph() {
    var _a, _b;
    if ((_a = window.comfyUIMagnifyGlass) == null ? void 0 : _a.state.active) (_b = window.infoPanelManager) == null ? void 0 : _b.scheduleInfoUpdate();
  }
});
function initializeInfoPanel(magnifyGlass) {
  registerPanelSettings((on) => on ? mountInfoPanel(magnifyGlass) : unmountInfoPanel(magnifyGlass));
}
