import { MagnifyGlass } from "./magnify-glass/MagnifyGlass.js";
import { app } from "/scripts/app.js";
import { Logger } from "./shared/logger.js";
app.registerExtension({
  name: "comfyui.magnify.glass",
  init() {
    const magnifyGlass = new MagnifyGlass();
    magnifyGlass.init();
    window.comfyUIMagnifyGlass = magnifyGlass;
    Logger.info("Magnify Glass extension initialized");
  }
});
//# sourceMappingURL=magnify_glass.js.map
