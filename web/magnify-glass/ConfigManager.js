var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { getSettingValue } from "../shared/utils.js";
import { STORAGE_KEYS } from "../shared/constants.js";
const DEFAULT_GLASS_SETTINGS = {
  "🔍MagnifyGlass.ZoomFactor": 300,
  "🔍MagnifyGlass.GlassSize": 300,
  "🔍MagnifyGlass.BorderColor": "#6b7280",
  "🔍MagnifyGlass.BorderWidth": 1,
  "🔍MagnifyGlass.ActivationKey": "x",
  "🔍MagnifyGlass.AltRequired": false,
  "🔍MagnifyGlass.FollowCursor": false,
  "🔍MagnifyGlass.OffsetStep": 5,
  "🔍MagnifyGlass.GlassPosition": "Top-Right",
  "🔍MagnifyGlass.ResetKey": "o",
  "🔍MagnifyGlass.GlassShape": "Rounded Square",
  "🔍MagnifyGlass.BorderEnabled": true,
  "🔍MagnifyGlass.TextureFiltering": "Linear",
  "🔍MagnifyGlass.AlwaysActiveMode": true,
  "🔍MagnifyGlass.ToggleFollowCursorKey": "h",
  "🔍MagnifyGlass.GlassPreviewToggleHotkey": "g",
  "🔍MagnifyGlass.ShowCursorPreview": false,
  "🔍MagnifyGlass.ForceDirectCaptureKey": "d",
  "🔍MagnifyGlass.ForceDirectCapture": false,
  // Accessibility defaults
  "🔍MagnifyGlass.AccessibilityEnabled": false,
  "🔍MagnifyGlass.HighContrastMode": false,
  "🔍MagnifyGlass.TextGlowEnabled": false,
  "🔍MagnifyGlass.TextGlowColor": "#ffff00",
  "🔍MagnifyGlass.TextGlowIntensity": 5,
  "🔍MagnifyGlass.FontScaleFactor": 100,
  "🔍MagnifyGlass.BoldTextEnabled": false,
  "🔍MagnifyGlass.TextOutlineEnabled": false,
  "🔍MagnifyGlass.TextOutlineColor": "#000000",
  "🔍MagnifyGlass.NodeTitleEmphasis": false,
  "🔍MagnifyGlass.InvertColors": false,
  "🔍MagnifyGlass.GrayscaleMode": false,
  "🔍MagnifyGlass.ReduceMotion": false
};
class ConfigManager {
  constructor() {
    /** Zoom factor (1.0 = 100%, 3.0 = 300%) */
    __publicField(this, "zoomFactor");
    /** Glass size in pixels */
    __publicField(this, "glassSize");
    /** Border color (CSS color string) */
    __publicField(this, "borderColor");
    /** Border width in pixels */
    __publicField(this, "borderWidth");
    /** Activation key (lowercase) */
    __publicField(this, "activationKey");
    /** Whether Alt key is required for activation */
    __publicField(this, "altRequired");
    /** Whether glass follows cursor */
    __publicField(this, "followCursor");
    /** Offset step for arrow key adjustments */
    __publicField(this, "offsetStep");
    /** Glass position relative to cursor */
    __publicField(this, "glassPosition");
    /** Reset key (lowercase) */
    __publicField(this, "resetKey");
    /** Glass shape */
    __publicField(this, "glassShape");
    /** Whether border is enabled */
    __publicField(this, "borderEnabled");
    /** Texture filtering mode */
    __publicField(this, "textureFiltering");
    /** Always active mode */
    __publicField(this, "alwaysActiveMode");
    /** Toggle follow cursor key */
    __publicField(this, "toggleFollowCursorKey");
    /** Glass preview toggle key */
    __publicField(this, "toggleGlassPreviewKey");
    /** Show cursor preview in glass */
    __publicField(this, "showCursorPreview");
    /** Force Direct Capture key */
    __publicField(this, "forceDirectCaptureKey");
    /** Runtime flag: Force Direct Capture mode (not persisted) */
    __publicField(this, "forceDirectCapture");
    // ===== Accessibility Settings =====
    /** Master toggle for accessibility mode */
    __publicField(this, "accessibilityEnabled");
    /** High contrast mode - boost text contrast */
    __publicField(this, "highContrastMode");
    /** Text glow effect enabled */
    __publicField(this, "textGlowEnabled");
    /** Color of the text glow effect */
    __publicField(this, "textGlowColor");
    /** Blur radius for text glow (1-15px) */
    __publicField(this, "textGlowIntensity");
    /** Font size multiplier (100-200%) */
    __publicField(this, "fontScaleFactor");
    /** Force bolder font weight */
    __publicField(this, "boldTextEnabled");
    /** Add contrasting stroke around text */
    __publicField(this, "textOutlineEnabled");
    /** Color of the text outline */
    __publicField(this, "textOutlineColor");
    /** Extra styling for node names */
    __publicField(this, "nodeTitleEmphasis");
    /** Invert all colors */
    __publicField(this, "invertColors");
    /** Desaturate all colors */
    __publicField(this, "grayscaleMode");
    /** Disable smooth transitions */
    __publicField(this, "reduceMotion");
    /** Manual offset X in graph units */
    __publicField(this, "offsetX");
    /** Manual offset Y in graph units */
    __publicField(this, "offsetY");
    this.zoomFactor = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.ZoomFactor"] / 100;
    this.glassSize = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.GlassSize"];
    this.borderColor = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.BorderColor"];
    this.borderWidth = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.BorderWidth"];
    this.activationKey = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.ActivationKey"];
    this.altRequired = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.AltRequired"];
    this.followCursor = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.FollowCursor"];
    this.offsetStep = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.OffsetStep"];
    this.glassPosition = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.GlassPosition"];
    this.resetKey = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.ResetKey"];
    this.glassShape = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.GlassShape"];
    this.borderEnabled = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.BorderEnabled"];
    this.textureFiltering = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.TextureFiltering"];
    this.alwaysActiveMode = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.AlwaysActiveMode"];
    this.toggleFollowCursorKey = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.ToggleFollowCursorKey"];
    this.toggleGlassPreviewKey = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.GlassPreviewToggleHotkey"];
    this.showCursorPreview = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.ShowCursorPreview"];
    this.forceDirectCaptureKey = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.ForceDirectCaptureKey"];
    this.forceDirectCapture = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.ForceDirectCapture"];
    this.accessibilityEnabled = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.AccessibilityEnabled"];
    this.highContrastMode = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.HighContrastMode"];
    this.textGlowEnabled = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.TextGlowEnabled"];
    this.textGlowColor = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.TextGlowColor"];
    this.textGlowIntensity = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.TextGlowIntensity"];
    this.fontScaleFactor = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.FontScaleFactor"];
    this.boldTextEnabled = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.BoldTextEnabled"];
    this.textOutlineEnabled = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.TextOutlineEnabled"];
    this.textOutlineColor = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.TextOutlineColor"];
    this.nodeTitleEmphasis = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.NodeTitleEmphasis"];
    this.invertColors = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.InvertColors"];
    this.grayscaleMode = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.GrayscaleMode"];
    this.reduceMotion = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.ReduceMotion"];
    this.offsetX = 0;
    this.offsetY = 0;
  }
  /**
   * Load settings from ComfyUI settings system.
   */
  loadSettings() {
    this.zoomFactor = getSettingValue("🔍MagnifyGlass.ZoomFactor", this.zoomFactor * 100) / 100;
    this.glassSize = getSettingValue("🔍MagnifyGlass.GlassSize", this.glassSize);
    this.borderColor = getSettingValue("🔍MagnifyGlass.BorderColor", this.borderColor);
    this.borderWidth = getSettingValue("🔍MagnifyGlass.BorderWidth", this.borderWidth);
    this.activationKey = getSettingValue("🔍MagnifyGlass.ActivationKey", this.activationKey);
    this.altRequired = getSettingValue("🔍MagnifyGlass.AltRequired", this.altRequired);
    this.followCursor = getSettingValue("🔍MagnifyGlass.FollowCursor", this.followCursor);
    this.offsetStep = getSettingValue("🔍MagnifyGlass.OffsetStep", this.offsetStep);
    this.glassPosition = getSettingValue("🔍MagnifyGlass.GlassPosition", this.glassPosition);
    this.resetKey = getSettingValue("🔍MagnifyGlass.ResetKey", this.resetKey);
    this.glassShape = getSettingValue("🔍MagnifyGlass.GlassShape", this.glassShape);
    this.borderEnabled = getSettingValue("🔍MagnifyGlass.BorderEnabled", this.borderEnabled);
    this.textureFiltering = getSettingValue("🔍MagnifyGlass.TextureFiltering", this.textureFiltering);
    this.alwaysActiveMode = getSettingValue("🔍MagnifyGlass.AlwaysActiveMode", this.alwaysActiveMode);
    this.toggleFollowCursorKey = getSettingValue("🔍MagnifyGlass.ToggleFollowCursorKey", this.toggleFollowCursorKey);
    this.showCursorPreview = getSettingValue("🔍MagnifyGlass.ShowCursorPreview", this.showCursorPreview);
    this.forceDirectCaptureKey = getSettingValue("🔍MagnifyGlass.ForceDirectCaptureKey", this.forceDirectCaptureKey);
    this.toggleGlassPreviewKey = getSettingValue("🔍MagnifyGlass.GlassPreviewToggleHotkey", this.toggleGlassPreviewKey);
    this.accessibilityEnabled = getSettingValue("🔍MagnifyGlass.AccessibilityEnabled", this.accessibilityEnabled);
    this.highContrastMode = getSettingValue("🔍MagnifyGlass.HighContrastMode", this.highContrastMode);
    this.textGlowEnabled = getSettingValue("🔍MagnifyGlass.TextGlowEnabled", this.textGlowEnabled);
    this.textGlowColor = getSettingValue("🔍MagnifyGlass.TextGlowColor", this.textGlowColor);
    this.textGlowIntensity = getSettingValue("🔍MagnifyGlass.TextGlowIntensity", this.textGlowIntensity);
    this.fontScaleFactor = getSettingValue("🔍MagnifyGlass.FontScaleFactor", this.fontScaleFactor);
    this.boldTextEnabled = getSettingValue("🔍MagnifyGlass.BoldTextEnabled", this.boldTextEnabled);
    this.textOutlineEnabled = getSettingValue("🔍MagnifyGlass.TextOutlineEnabled", this.textOutlineEnabled);
    this.textOutlineColor = getSettingValue("🔍MagnifyGlass.TextOutlineColor", this.textOutlineColor);
    this.nodeTitleEmphasis = getSettingValue("🔍MagnifyGlass.NodeTitleEmphasis", this.nodeTitleEmphasis);
    this.invertColors = getSettingValue("🔍MagnifyGlass.InvertColors", this.invertColors);
    this.grayscaleMode = getSettingValue("🔍MagnifyGlass.GrayscaleMode", this.grayscaleMode);
    this.reduceMotion = getSettingValue("🔍MagnifyGlass.ReduceMotion", this.reduceMotion);
  }
  /**
   * Load saved offsets from localStorage.
   */
  loadSavedOffsets() {
    try {
      const savedOffsetX = localStorage.getItem(STORAGE_KEYS.OFFSET_X);
      const savedOffsetY = localStorage.getItem(STORAGE_KEYS.OFFSET_Y);
      if (savedOffsetX !== null) {
        this.offsetX = parseInt(savedOffsetX, 10);
      } else {
        this.offsetX = 0;
      }
      if (savedOffsetY !== null) {
        this.offsetY = parseInt(savedOffsetY, 10);
      } else {
        this.offsetY = 0;
      }
    } catch (e) {
      console.error("ComfyUI Magnifying Glass ERROR: Error loading saved offsets:", e);
      this.offsetX = 0;
      this.offsetY = 0;
    }
  }
  /**
   * Save current offsets to localStorage.
   */
  saveOffsets() {
    try {
      localStorage.setItem(STORAGE_KEYS.OFFSET_X, this.offsetX.toString());
      localStorage.setItem(STORAGE_KEYS.OFFSET_Y, this.offsetY.toString());
    } catch (e) {
      console.error("ComfyUI Magnifying Glass ERROR: Error saving offsets:", e);
    }
  }
  /**
   * Reset offsets to default (zero).
   */
  resetOffsets() {
    this.offsetX = 0;
    this.offsetY = 0;
    this.saveOffsets();
  }
}
export {
  ConfigManager
};
//# sourceMappingURL=ConfigManager.js.map
