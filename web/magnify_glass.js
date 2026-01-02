import { MagnifyGlass } from "./magnify-glass/MagnifyGlass.js";
import { app } from "/scripts/app.js";
import { Logger } from "./shared/logger.js";
import { initSidebar } from "./sidebar/sidebar.js";
app.registerExtension({
  name: "comfyui.magnify.glass",
  init() {
    const magnifyGlass = new MagnifyGlass();
    magnifyGlass.init();
    window.comfyUIMagnifyGlass = magnifyGlass;
    initSidebar();
    Logger.info("Magnify Glass extension initialized");
  }
});
//# sourceMappingURL=magnify_glass.js.map
