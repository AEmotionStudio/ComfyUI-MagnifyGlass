/**
 * ComfyUI MagnifyGlass - ConfigManager
 * 
 * Manages configuration and settings for the magnifying glass.
 */

import { getSettingValue } from '../shared/utils.js';
import { DEFAULT_GLASS_SETTINGS } from '../shared/settings.js';
import { STORAGE_KEYS } from '../shared/constants.js';

/**
 * Configuration manager class.
 * Reads settings from ComfyUI and manages persistent offsets.
 */
export class ConfigManager {
    constructor() {
        // Initialize properties with defaults
        this.zoomFactor = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.ZoomFactor"] / 100;
        this.glassSize = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.GlassSize"];
        this.borderColor = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.BorderColor"];
        this.borderWidth = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.BorderWidth"];
        this.activationKey = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.ActivationKey"];
        this.altRequired = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.AltRequired"];
        this.followCursor = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.FollowCursor"];
        this.debugMode = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.DebugMode"];
        this.offsetStep = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.OffsetStep"];
        this.glassPosition = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.GlassPosition"];
        this.resetKey = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.ResetKey"];
        this.glassShape = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.GlassShape"];
        this.borderEnabled = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.BorderEnabled"];
        this.textureFiltering = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.TextureFiltering"];
        this.alwaysActiveMode = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.AlwaysActiveMode"];
        this.toggleFollowCursorKey = DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.ToggleFollowCursorKey"];

        // Alignment adjustment parameters - managed separately
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
        this.debugMode = getSettingValue("🔍MagnifyGlass.DebugMode", this.debugMode);
        this.offsetStep = getSettingValue("🔍MagnifyGlass.OffsetStep", this.offsetStep);
        this.glassPosition = getSettingValue("🔍MagnifyGlass.GlassPosition", this.glassPosition);
        this.resetKey = getSettingValue("🔍MagnifyGlass.ResetKey", this.resetKey);
        this.glassShape = getSettingValue("🔍MagnifyGlass.GlassShape", this.glassShape);
        this.borderEnabled = getSettingValue("🔍MagnifyGlass.BorderEnabled", this.borderEnabled);
        this.textureFiltering = getSettingValue("🔍MagnifyGlass.TextureFiltering", this.textureFiltering);
        this.alwaysActiveMode = getSettingValue("🔍MagnifyGlass.AlwaysActiveMode", this.alwaysActiveMode);
        this.toggleFollowCursorKey = getSettingValue("🔍MagnifyGlass.ToggleFollowCursorKey", this.toggleFollowCursorKey);
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
