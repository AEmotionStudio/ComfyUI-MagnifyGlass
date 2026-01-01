import { MagnifyGlass } from "./magnify-glass/MagnifyGlass.js";
import { app } from "/scripts/app.js";
app.registerExtension({
  name: "comfyui.magnify.glass",
  init() {
    const magnifyGlass = new MagnifyGlass();
    magnifyGlass.init();
    window.comfyUIMagnifyGlass = magnifyGlass;
    console.log("ComfyUI Magnify Glass: Extension initialized");
  }
});
//# sourceMappingURL=magnify_glass.js.map
