var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { getSettingValue, clamp } from "../shared/utils.js";
import { DEFAULT_PANEL_SETTINGS } from "../shared/settings/defaults.js";
import "/scripts/app.js";
import { STORAGE_KEYS, PANEL_FONTS } from "../shared/constants.js";
class StateManager {
  constructor() {
    __publicField(this, "state");
    this.state = {
      // Panel visibility and positioning
      isPanelVisible: false,
      wasPanelVisibleBeforeHide: false,
      isPanelMinimized: false,
      isFloating: false,
      floatPosition: null,
      // Glass visibility
      isGlassPreviewVisible: true,
      isPanelHovered: false,
      currentNodeId: null,
      lockedNodeId: null,
      lockedGraph: null,
      showsSelection: false,
      // Settings cache
      settings: {}
    };
    this.loadSettings();
    this.loadLayout();
  }
  /**
   * Float mode, float position and minimized state are kept per browser.
   */
  loadLayout() {
    try {
      const layout = JSON.parse(localStorage.getItem(STORAGE_KEYS.INSPECTOR_LAYOUT) || "{}");
      this.state.isFloating = layout.floating === true;
      this.state.isPanelMinimized = layout.minimized === true;
      if (Number.isFinite(layout.x) && Number.isFinite(layout.y)) {
        this.state.floatPosition = { x: layout.x, y: layout.y };
      }
    } catch (e) {
    }
  }
  saveLayout() {
    const { isFloating, floatPosition, isPanelMinimized } = this.state;
    try {
      localStorage.setItem(STORAGE_KEYS.INSPECTOR_LAYOUT, JSON.stringify({ floating: isFloating, minimized: isPanelMinimized, ...floatPosition }));
    } catch (e) {
    }
  }
  loadSettings() {
    const defaults = DEFAULT_PANEL_SETTINGS;
    Object.keys(defaults).forEach((key) => {
      this.state.settings[key] = getSettingValue(key, defaults[key]);
    });
    this.state.settings["🔍MagnifyGlass.InfoPanelWidth"] = this.validateNumber(
      this.state.settings["🔍MagnifyGlass.InfoPanelWidth"],
      200,
      600,
      defaults["🔍MagnifyGlass.InfoPanelWidth"]
    );
    this.state.settings["🔍MagnifyGlass.InfoPanelMaxHeight"] = this.validateNumber(
      this.state.settings["🔍MagnifyGlass.InfoPanelMaxHeight"],
      200,
      1500,
      defaults["🔍MagnifyGlass.InfoPanelMaxHeight"]
    );
    this.state.settings["🔍MagnifyGlass.InfoPanelOpacity"] = this.validateNumber(
      this.state.settings["🔍MagnifyGlass.InfoPanelOpacity"],
      10,
      100,
      defaults["🔍MagnifyGlass.InfoPanelOpacity"]
    );
    this.state.settings["🔍MagnifyGlass.InfoPanelFontSize"] = this.validateNumber(
      this.state.settings["🔍MagnifyGlass.InfoPanelFontSize"],
      8,
      24,
      defaults["🔍MagnifyGlass.InfoPanelFontSize"]
    );
    this.state.settings["🔍MagnifyGlass.InfoPanelTextColor"] = this.validateColor(
      this.state.settings["🔍MagnifyGlass.InfoPanelTextColor"],
      defaults["🔍MagnifyGlass.InfoPanelTextColor"]
    );
    this.state.settings["🔍MagnifyGlass.InfoPanelAccentColor"] = this.validateColor(
      this.state.settings["🔍MagnifyGlass.InfoPanelAccentColor"],
      defaults["🔍MagnifyGlass.InfoPanelAccentColor"]
    );
    const validPanelPositions = ["Bottom", "Top", "Left", "Right"];
    this.state.settings["🔍MagnifyGlass.InfoPanelPosition"] = this.validateStringOption(
      this.state.settings["🔍MagnifyGlass.InfoPanelPosition"],
      validPanelPositions,
      defaults["🔍MagnifyGlass.InfoPanelPosition"]
    );
    const validControlPositions = ["top-left", "top-right", "bottom-left", "bottom-right", "top", "bottom", "left", "right"];
    this.state.settings["🔍MagnifyGlass.ControlsPosition"] = this.validateStringOption(
      this.state.settings["🔍MagnifyGlass.ControlsPosition"],
      validControlPositions,
      defaults["🔍MagnifyGlass.ControlsPosition"]
    );
    this.state.settings["🔍MagnifyGlass.InfoPanelFontFamily"] = this.validateStringOption(
      this.state.settings["🔍MagnifyGlass.InfoPanelFontFamily"],
      PANEL_FONTS,
      defaults["🔍MagnifyGlass.InfoPanelFontFamily"]
    );
  }
  /**
   * Validate numeric input with bounds checking.
   */
  validateNumber(value, min, max, fallback) {
    const num = Number(value);
    if (isNaN(num)) return fallback;
    return clamp(num, min, max);
  }
  /**
   * Validate color string (hex).
   */
  validateColor(color, fallback) {
    if (!color || typeof color !== "string") return fallback;
    if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color)) {
      return color;
    }
    return fallback;
  }
  /**
   * Validate string against an allowlist.
   */
  validateStringOption(value, options, fallback) {
    if (typeof value !== "string") return fallback;
    return options.includes(value) ? value : fallback;
  }
  toggleMinimized() {
    this.state.isPanelMinimized = !this.state.isPanelMinimized;
    return this.state.isPanelMinimized;
  }
}
export {
  StateManager
};
