import { app } from "/scripts/app.js";
import { renderSettingsPanel } from "./SidebarSettings.js";
import { renderAbout } from "./SidebarAbout.js";
let sidebarRegistered = false;
function loadSidebarStyles(onLoaded) {
  const existingLink = document.getElementById("magnify-sidebar-styles");
  if (existingLink) {
    if (onLoaded) onLoaded();
    return;
  }
  const link = document.createElement("link");
  link.id = "magnify-sidebar-styles";
  link.rel = "stylesheet";
  link.type = "text/css";
  link.href = "extensions/comfyui-magnifyglass/sidebar.css";
  if (onLoaded) {
    link.onload = onLoaded;
    link.onerror = onLoaded;
  }
  document.head.appendChild(link);
}
function renderSidebar(container) {
  if (container.querySelector(".magnify-sidebar")) {
    return;
  }
  container.innerHTML = "";
  container.style.height = "100%";
  const sidebar = document.createElement("div");
  sidebar.className = "magnify-sidebar";
  sidebar.style.visibility = "hidden";
  sidebar.style.opacity = "0";
  const header = document.createElement("header");
  header.className = "magnify-sidebar-header";
  const mark = document.createElement("i");
  mark.className = "pi pi-search magnify-mark";
  mark.setAttribute("aria-hidden", "true");
  const title = document.createElement("h2");
  title.className = "magnify-sidebar-title";
  title.textContent = "MagnifyGlass";
  header.append(mark, title);
  sidebar.appendChild(header);
  const content = document.createElement("div");
  content.className = "magnify-sidebar-content";
  const settings = document.createElement("div");
  settings.className = "magnify-settings";
  renderSettingsPanel(settings);
  content.append(settings, renderAbout());
  sidebar.appendChild(content);
  container.appendChild(sidebar);
  loadSidebarStyles(() => {
    requestAnimationFrame(() => {
      sidebar.style.visibility = "visible";
      sidebar.style.opacity = "1";
      sidebar.style.transition = "opacity 0.1s ease-in";
    });
  });
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
      title: "Magnify",
      tooltip: "MagnifyGlass Settings",
      type: "custom",
      render: (el) => {
        renderSidebar(el);
      }
    });
    sidebarRegistered = true;
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
