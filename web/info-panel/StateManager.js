var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { getSettingValue } from "../shared/utils.js";
import { DEFAULT_PANEL_SETTINGS } from "../shared/settings.js";
class StateManager {
  constructor() {
    __publicField(this, "state");
    this.state = {
      // Panel visibility and positioning
      isPanelVisible: false,
      wasPanelVisibleBeforeHide: false,
      isPanelMinimized: false,
      isPanelPinned: false,
      isPanelLocked: false,
      // New lock state
      isAutoPinned: false,
      // Track if panel was auto-pinned by glass hide
      pinnedPosition: { x: 0, y: 0 },
      lastPinnedPosition: null,
      // Remember last pinned location
      // Glass visibility
      isGlassPreviewVisible: true,
      // Section expansion
      expandedSections: /* @__PURE__ */ new Set(["node"]),
      // Interaction states
      isPanelHovered: false,
      isHoveringNode: false,
      // Auto-collapse
      autoExpandTimer: null,
      lastNodeId: null,
      // Update scheduling
      updateScheduled: false,
      isInitialLoading: false,
      // Current data
      currentInfo: {},
      // Settings cache
      settings: {},
      // Auto-detected theme
      currentTheme: "dark"
      // Will be auto-detected
    };
    this.initThemeDetection();
    this.loadSettings();
  }
  initThemeDetection() {
    this.detectCurrentTheme();
    setTimeout(() => {
      if (this.detectCurrentTheme()) {
        this.notifyThemeChange();
      }
    }, 1e3);
    this.setupThemeObserver();
    if (window.matchMedia) {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
      if (prefersDark.addListener) {
        prefersDark.addListener(() => this.detectCurrentTheme());
      } else if (prefersDark.addEventListener) {
        prefersDark.addEventListener("change", () => this.detectCurrentTheme());
      }
    }
    this.setupThemeButtonListeners();
  }
  detectCurrentTheme() {
    let detectedTheme = "dark";
    try {
      const colorPalette = getSettingValue("Comfy.ColorPalette", "");
      if (colorPalette) {
        const paletteStr = String(colorPalette).toLowerCase();
        if (paletteStr.includes("solarized")) {
          detectedTheme = "solarized";
        } else if (paletteStr.includes("arc")) {
          detectedTheme = "arc";
        } else if (paletteStr.includes("nord")) {
          detectedTheme = "nord";
        } else if (paletteStr.includes("github")) {
          detectedTheme = "github";
        } else if (paletteStr.includes("light")) {
          detectedTheme = "light";
        } else if (paletteStr.includes("dark")) {
          detectedTheme = "dark";
        }
      }
    } catch (e) {
      console.warn("ComfyUI Info Panel: Could not read theme from settings, using fallback detection");
    }
    if (detectedTheme === "dark") {
      const body = document.body;
      const html = document.documentElement;
      const dataTheme = body.getAttribute("data-theme") || html.getAttribute("data-theme");
      if (dataTheme) {
        detectedTheme = dataTheme.toLowerCase();
      }
      const classes = (body.className + " " + html.className).toLowerCase();
      if (classes.includes("theme-solarized") || classes.includes("solarized")) {
        detectedTheme = "solarized";
      } else if (classes.includes("theme-arc") || classes.includes("arc-theme")) {
        detectedTheme = "arc";
      } else if (classes.includes("theme-nord") || classes.includes("nord-theme")) {
        detectedTheme = "nord";
      } else if (classes.includes("theme-github") || classes.includes("github-theme")) {
        detectedTheme = "github";
      } else if (classes.includes("theme-light") || classes.includes("light-theme")) {
        detectedTheme = "light";
      }
    }
    if (detectedTheme === "dark") {
      const bodyStyles = window.getComputedStyle(document.body);
      const bgColor = bodyStyles.backgroundColor;
      if (bgColor && bgColor !== "rgba(0, 0, 0, 0)" && bgColor !== "transparent") {
        const rgbMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
        if (rgbMatch) {
          const [, r, g, b] = rgbMatch.map(Number);
          const brightness = (r * 299 + g * 587 + b * 114) / 1e3;
          if (brightness > 180) {
            detectedTheme = "light";
          }
        }
      }
    }
    if (this.state.currentTheme !== detectedTheme) {
      this.state.currentTheme = detectedTheme;
      return true;
    }
    return false;
  }
  setupThemeObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      mutations.forEach((mutation) => {
        if (mutation.type === "attributes" && (mutation.attributeName === "class" || mutation.attributeName === "data-theme" || mutation.attributeName === "style")) {
          shouldCheck = true;
        }
      });
      if (shouldCheck && this.detectCurrentTheme()) {
        this.notifyThemeChange();
      }
    });
    observer.observe(document.body, { attributes: true, attributeOldValue: true });
    observer.observe(document.documentElement, { attributes: true, attributeOldValue: true });
    const vueApp = document.querySelector("#vue-app");
    if (vueApp) {
      observer.observe(vueApp, { attributes: true, attributeOldValue: true });
    }
    const themeElements = document.querySelectorAll('[class*="theme"], [class*="dark"], [class*="light"], [data-theme]');
    themeElements.forEach((el) => {
      observer.observe(el, { attributes: true, attributeOldValue: true });
    });
    setInterval(() => {
      if (this.detectCurrentTheme()) {
        this.notifyThemeChange();
      }
    }, 2e3);
  }
  setupThemeButtonListeners() {
    document.addEventListener("click", (e) => {
      var _a, _b, _c, _d, _e;
      const target = e.target;
      const isThemeButton = ((_a = target.textContent) == null ? void 0 : _a.toLowerCase().includes("theme")) || ((_b = target.textContent) == null ? void 0 : _b.toLowerCase().includes("light")) || ((_c = target.textContent) == null ? void 0 : _c.toLowerCase().includes("dark")) || ((_d = target.title) == null ? void 0 : _d.toLowerCase().includes("theme")) || ((_e = target.className) == null ? void 0 : _e.toLowerCase().includes("theme"));
      if (isThemeButton) {
        setTimeout(() => {
          if (this.detectCurrentTheme()) {
            this.notifyThemeChange();
          }
        }, 100);
      }
    });
  }
  notifyThemeChange() {
    this.state.settings["🔍MagnifyGlass.InfoPanelTheme"] = this.state.currentTheme;
    if (window.infoPanelManager && window.infoPanelManager.uiManager) {
      window.infoPanelManager.uiManager.updateTheme(this.state.currentTheme);
    }
  }
  loadSettings() {
    Object.keys(DEFAULT_PANEL_SETTINGS).forEach((key) => {
      if (key !== "🔍MagnifyGlass.InfoPanelTheme") {
        this.state.settings[key] = getSettingValue(key, DEFAULT_PANEL_SETTINGS[key]);
      }
    });
    this.state.settings["🔍MagnifyGlass.InfoPanelTheme"] = this.state.currentTheme;
  }
  updateSettings() {
    const oldSettings = { ...this.state.settings };
    this.loadSettings();
    const changes = {};
    Object.keys(this.state.settings).forEach((key) => {
      if (oldSettings[key] !== this.state.settings[key]) {
        changes[key] = {
          old: oldSettings[key],
          new: this.state.settings[key]
        };
      }
    });
    return changes;
  }
  togglePanelVisibility() {
    this.state.isPanelVisible = !this.state.isPanelVisible;
    return this.state.isPanelVisible;
  }
  toggleGlassPreview() {
    this.state.isGlassPreviewVisible = !this.state.isGlassPreviewVisible;
    return this.state.isGlassPreviewVisible;
  }
  togglePinning() {
    const wasPinned = this.state.isPanelPinned;
    this.state.isPanelPinned = !this.state.isPanelPinned;
    if (!this.state.isPanelPinned) {
      this.state.isPanelLocked = false;
      this.state.isAutoPinned = false;
    }
    if (this.state.isPanelPinned && this.state.lastPinnedPosition) {
      this.state.pinnedPosition = { ...this.state.lastPinnedPosition };
    } else if (!this.state.isPanelPinned && wasPinned) {
      this.state.lastPinnedPosition = { ...this.state.pinnedPosition };
    }
    return this.state.isPanelPinned;
  }
  toggleLocking() {
    if (!this.state.isPanelPinned) {
      return false;
    }
    this.state.isPanelLocked = !this.state.isPanelLocked;
    return this.state.isPanelLocked;
  }
  toggleMinimized() {
    this.state.isPanelMinimized = !this.state.isPanelMinimized;
    return this.state.isPanelMinimized;
  }
  toggleSection(sectionId) {
    if (sectionId === "node") return false;
    if (this.state.expandedSections.has(sectionId)) {
      this.state.expandedSections.delete(sectionId);
    } else {
      this.state.expandedSections.add(sectionId);
    }
    return true;
  }
  setPinnedPosition(x, y) {
    this.state.pinnedPosition = { x, y };
    this.state.lastPinnedPosition = { x, y };
  }
  setCurrentInfo(info) {
    this.state.currentInfo = info;
  }
  scheduleAutoCollapse() {
    this.clearAutoExpandTimer();
    if (this.state.settings["🔍MagnifyGlass.InfoPanelAnimations"]) {
      this.state.autoExpandTimer = setTimeout(() => {
        if (!this.state.isPanelHovered) {
          this.collapseNodeSections();
        }
      }, 1500);
    }
  }
  clearAutoExpandTimer() {
    if (this.state.autoExpandTimer) {
      clearTimeout(this.state.autoExpandTimer);
      this.state.autoExpandTimer = null;
    }
  }
  expandNodeSections() {
    this.state.expandedSections.add("hoveredNode");
    this.state.expandedSections.add("node");
    this.state.expandedSections.add("cursor");
    this.state.expandedSections.add("canvas");
    this.state.expandedSections.add("magnifier");
    this.clearAutoExpandTimer();
  }
  collapseNodeSections() {
    this.state.expandedSections.delete("hoveredNode");
    this.state.expandedSections.delete("node");
    this.state.expandedSections.delete("widget");
  }
  cleanup() {
    this.clearAutoExpandTimer();
  }
}
export {
  StateManager
};
//# sourceMappingURL=StateManager.js.map
