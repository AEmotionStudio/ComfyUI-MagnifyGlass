import { app } from "/scripts/app.js";
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
    console.error("ComfyUI Magnify Info Panel: Failed to find MagnifyGlass instance.");
    return;
  }
  try {
    const infoPanel = new InfoPanel(magnifyGlass);
    window.infoPanelManager = infoPanel;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = "extensions/comfyui-magnifyglass/style.css";
    document.head.appendChild(link);
    console.log("ComfyUI Magnify Info Panel: CSS loaded");
    console.log("ComfyUI Magnify Info Panel: Extension initialized");
  } catch (e) {
    console.error("ComfyUI Magnify Info Panel: Error during initialization:", e);
  }
}
//# sourceMappingURL=magnify_info_panel.js.map
