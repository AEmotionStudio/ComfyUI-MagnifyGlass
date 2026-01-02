import { app } from "/scripts/app.js";
import { Logger } from "./shared/logger.js";
import { InfoPanel } from "./info-panel/InfoPanel.js";
app.registerExtension({
  name: "comfyui.magnify.info.panel",
  init() {
    const checkDependencies = () => {
      if (window.comfyUIMagnifyGlass) {
        initializeInfoPanel();
      } else {
        setTimeout(checkDependencies, 100);
      }
    };
    checkDependencies();
  }
});
function initializeInfoPanel() {
  const magnifyGlass = window.comfyUIMagnifyGlass;
  if (!magnifyGlass) {
    Logger.error("Failed to find MagnifyGlass instance.");
    return;
  }
  try {
    const infoPanel = new InfoPanel(magnifyGlass);
    window.infoPanelManager = infoPanel;
    Logger.info("Info Panel extension initialized");
  } catch (e) {
    Logger.error("Error during initialization:", e);
  }
}
//# sourceMappingURL=magnify_info_panel.js.map
