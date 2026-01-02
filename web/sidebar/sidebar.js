import { app } from "/scripts/app.js";
import { renderSettingsPanel } from "./SidebarSettings.js";
const MAGNIFY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
let sidebarRegistered = false;
function loadSidebarStyles() {
  if (!document.getElementById("magnify-sidebar-styles")) {
    const link = document.createElement("link");
    link.id = "magnify-sidebar-styles";
    link.rel = "stylesheet";
    link.type = "text/css";
    link.href = "extensions/comfyui-magnifyglass/sidebar.css";
    document.head.appendChild(link);
  }
}
function renderSidebar(container) {
  loadSidebarStyles();
  container.innerHTML = "";
  const sidebar = document.createElement("div");
  sidebar.className = "magnify-sidebar";
  const header = document.createElement("div");
  header.className = "magnify-sidebar-header";
  header.innerHTML = `${MAGNIFY_ICON}<h2>Magnify G.</h2>`;
  sidebar.appendChild(header);
  const content = document.createElement("div");
  content.className = "magnify-sidebar-content";
  renderSettingsPanel(content);
  sidebar.appendChild(content);
  container.appendChild(sidebar);
}
function registerSidebar() {
  if (sidebarRegistered) {
    return;
  }
  if (!app.extensionManager) {
    console.warn("MagnifyGlass: extensionManager not available, sidebar registration skipped");
    return;
  }
  try {
    app.extensionManager.registerSidebarTab({
      id: "magnifyglass",
      icon: "pi pi-search",
      title: "Magnify G.",
      tooltip: "MagnifyGlass Settings",
      type: "custom",
      render: (el) => {
        renderSidebar(el);
      }
    });
    sidebarRegistered = true;
    console.log("MagnifyGlass: Sidebar registered successfully");
  } catch (e) {
    console.warn("MagnifyGlass: Failed to register sidebar:", e);
  }
}
function initSidebar() {
  setTimeout(() => {
    registerSidebar();
  }, 100);
}
export {
  initSidebar,
  registerSidebar
};
//# sourceMappingURL=sidebar.js.map
