import { MagnifyGlass } from "./magnify-glass/MagnifyGlass.js";
import { app } from "/scripts/app.js";
import { Logger } from "./shared/logger.js";
import { initSidebar } from "./sidebar/sidebar.js";
import "./shared/settings/defaults.js";
import { ABOUT_BADGES } from "./sidebar/SidebarAbout.js";
app.registerExtension({
  name: "comfyui.magnify.glass",
  aboutPageBadges: ABOUT_BADGES,
  init() {
    const magnifyGlass = new MagnifyGlass();
    window.comfyUIMagnifyGlass = magnifyGlass;
    magnifyGlass.init();
    initSidebar();
    Logger.debug("Magnify Glass extension initialized");
  }
});
