import { app } from "/scripts/app.js";
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
  }
});
function initializeInfoPanel(magnifyGlass) {
  registerPanelSettings((on) => on ? mountInfoPanel(magnifyGlass) : unmountInfoPanel(magnifyGlass));
}
