/**
 * ComfyUI MagnifyGlass - ConfigManager (TypeScript)
 * 
 * Manages configuration and settings for the magnifying glass.
 */

import { getSettingValue } from '../shared/utils';
import { STORAGE_KEYS } from '../shared/constants';
import type { GlassPosition, GlassShape, TextureFilter } from '../shared/constants';

// Default settings (we'll import these properly later)
const DEFAULT_GLASS_SETTINGS = {
    "🔍MagnifyGlass.ZoomFactor": 300,
    "🔍MagnifyGlass.GlassSize": 300,
    "🔍MagnifyGlass.BorderColor": "#6b7280",
    "🔍MagnifyGlass.BorderWidth": 1,
    "🔍MagnifyGlass.ActivationKey": "x",
    "🔍MagnifyGlass.AltRequired": false,
    "🔍MagnifyGlass.FollowCursor": false,
    "🔍MagnifyGlass.OffsetStep": 5,
    "🔍MagnifyGlass.GlassPosition": "Top-Right" as GlassPosition,
    "🔍MagnifyGlass.ResetKey": "o",
    "🔍MagnifyGlass.GlassShape": "Rounded Square" as GlassShape,
    "🔍MagnifyGlass.BorderEnabled": true,
    "🔍MagnifyGlass.TextureFiltering": "Linear" as TextureFilter,
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
};

/**
 * Configuration manager class.
 * Reads settings from ComfyUI and manages persistent offsets.
 */
export class ConfigManager {
    /** Zoom factor (1.0 = 100%, 3.0 = 300%) */
    zoomFactor: number;

    /** Glass size in pixels */
    glassSize: number;

    /** Border color (CSS color string) */
    borderColor: string;

    /** Border width in pixels */
    borderWidth: number;

    /** Activation key (lowercase) */
    activationKey: string;

    /** Whether Alt key is required for activation */
    altRequired: boolean;

    /** Whether glass follows cursor */
    followCursor: boolean;



    /** Offset step for arrow key adjustments */
    offsetStep: number;

    /** Glass position relative to cursor */
    glassPosition: string;

    /** Reset key (lowercase) */
    resetKey: string;

    /** Glass shape */
    glassShape: string;

    /** Whether border is enabled */
    borderEnabled: boolean;

    /** Texture filtering mode */
    textureFiltering: string;

    /** Always active mode */
    alwaysActiveMode: boolean;

    /** Toggle follow cursor key */
    toggleFollowCursorKey: string;

    /** Glass preview toggle key */
    toggleGlassPreviewKey: string;

    /** Show cursor preview in glass */
    showCursorPreview: boolean;

    /** Force Direct Capture key */
    forceDirectCaptureKey: string;

    /** Runtime flag: Force Direct Capture mode (not persisted) */
    forceDirectCapture: boolean;

    // ===== Accessibility Settings =====

    /** Master toggle for accessibility mode */
    accessibilityEnabled: boolean;

    /** High contrast mode - boost text contrast */
    highContrastMode: boolean;

    /** Text glow effect enabled */
    textGlowEnabled: boolean;

    /** Color of the text glow effect */
    textGlowColor: string;

    /** Blur radius for text glow (1-15px) */
    textGlowIntensity: number;

    /** Font size multiplier (100-200%) */
    fontScaleFactor: number;

    /** Force bolder font weight */
    boldTextEnabled: boolean;

    /** Add contrasting stroke around text */
    textOutlineEnabled: boolean;

    /** Color of the text outline */
    textOutlineColor: string;

    /** Extra styling for node names */
    nodeTitleEmphasis: boolean;

    /** Manual offset X in graph units */
    offsetX: number;

    /** Manual offset Y in graph units */
    offsetY: number;

    constructor() {
        // Initialize properties with defaults
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
        this.forceDirectCapture = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.ForceDirectCapture"]; // Initialize from default

        // Accessibility settings
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

        // Alignment adjustment parameters - managed separately
        this.offsetX = 0;
        this.offsetY = 0;
    }

    /**
     * Load settings from ComfyUI settings system.
     */
    loadSettings(): void {
        this.zoomFactor = getSettingValue<number>("🔍MagnifyGlass.ZoomFactor", this.zoomFactor * 100) / 100;
        this.glassSize = getSettingValue<number>("🔍MagnifyGlass.GlassSize", this.glassSize);
        this.borderColor = getSettingValue<string>("🔍MagnifyGlass.BorderColor", this.borderColor);
        this.borderWidth = getSettingValue<number>("🔍MagnifyGlass.BorderWidth", this.borderWidth);
        this.activationKey = getSettingValue<string>("🔍MagnifyGlass.ActivationKey", this.activationKey);
        this.altRequired = getSettingValue<boolean>("🔍MagnifyGlass.AltRequired", this.altRequired);
        this.followCursor = getSettingValue<boolean>("🔍MagnifyGlass.FollowCursor", this.followCursor);

        this.offsetStep = getSettingValue<number>("🔍MagnifyGlass.OffsetStep", this.offsetStep);
        this.glassPosition = getSettingValue<string>("🔍MagnifyGlass.GlassPosition", this.glassPosition);
        this.resetKey = getSettingValue<string>("🔍MagnifyGlass.ResetKey", this.resetKey);
        this.glassShape = getSettingValue<string>("🔍MagnifyGlass.GlassShape", this.glassShape);
        this.borderEnabled = getSettingValue<boolean>("🔍MagnifyGlass.BorderEnabled", this.borderEnabled);
        this.textureFiltering = getSettingValue<string>("🔍MagnifyGlass.TextureFiltering", this.textureFiltering);
        this.alwaysActiveMode = getSettingValue<boolean>("🔍MagnifyGlass.AlwaysActiveMode", this.alwaysActiveMode);
        this.toggleFollowCursorKey = getSettingValue<string>("🔍MagnifyGlass.ToggleFollowCursorKey", this.toggleFollowCursorKey);
        this.showCursorPreview = getSettingValue<boolean>("🔍MagnifyGlass.ShowCursorPreview", this.showCursorPreview);
        this.forceDirectCaptureKey = getSettingValue<string>("🔍MagnifyGlass.ForceDirectCaptureKey", this.forceDirectCaptureKey);
        this.toggleGlassPreviewKey = getSettingValue<string>("🔍MagnifyGlass.GlassPreviewToggleHotkey", this.toggleGlassPreviewKey);

        // Accessibility settings
        this.accessibilityEnabled = getSettingValue<boolean>("🔍MagnifyGlass.AccessibilityEnabled", this.accessibilityEnabled);
        this.highContrastMode = getSettingValue<boolean>("🔍MagnifyGlass.HighContrastMode", this.highContrastMode);
        this.textGlowEnabled = getSettingValue<boolean>("🔍MagnifyGlass.TextGlowEnabled", this.textGlowEnabled);
        this.textGlowColor = getSettingValue<string>("🔍MagnifyGlass.TextGlowColor", this.textGlowColor);
        this.textGlowIntensity = getSettingValue<number>("🔍MagnifyGlass.TextGlowIntensity", this.textGlowIntensity);
        this.fontScaleFactor = getSettingValue<number>("🔍MagnifyGlass.FontScaleFactor", this.fontScaleFactor);
        this.boldTextEnabled = getSettingValue<boolean>("🔍MagnifyGlass.BoldTextEnabled", this.boldTextEnabled);
        this.textOutlineEnabled = getSettingValue<boolean>("🔍MagnifyGlass.TextOutlineEnabled", this.textOutlineEnabled);
        this.textOutlineColor = getSettingValue<string>("🔍MagnifyGlass.TextOutlineColor", this.textOutlineColor);
        this.nodeTitleEmphasis = getSettingValue<boolean>("🔍MagnifyGlass.NodeTitleEmphasis", this.nodeTitleEmphasis);
    }

    /**
     * Load saved offsets from localStorage.
     */
    loadSavedOffsets(): void {
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
    saveOffsets(): void {
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
    resetOffsets(): void {
        this.offsetX = 0;
        this.offsetY = 0;
        this.saveOffsets();
    }
}
