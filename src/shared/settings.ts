/**
 * ComfyUI MagnifyGlass - Settings Configuration
 * 
 * Centralized settings definitions and registration functions.
 */

// @ts-ignore
import { app } from "/scripts/app.js";
import {
    DEFAULT_GLASS_SIZE,
    DEFAULT_ZOOM_FACTOR,
    DEFAULT_BORDER_WIDTH,
    DEFAULT_BORDER_COLOR,
    DEFAULT_OFFSET_STEP,
    DEFAULT_PANEL_WIDTH,
    DEFAULT_PANEL_MAX_HEIGHT,
    DEFAULT_PANEL_OPACITY,
    GLASS_POSITIONS,
    GLASS_SHAPES,
    ACTIVATION_KEYS,
    RESET_KEYS,
    TOGGLE_FOLLOW_KEYS,
    PANEL_POSITIONS
} from './constants';

// Define the shape of our settings objects for better type safety
export interface GlassSettings {
    "🔍MagnifyGlass.ZoomFactor": number;
    "🔍MagnifyGlass.GlassSize": number;
    "🔍MagnifyGlass.BorderColor": string;
    "🔍MagnifyGlass.BorderWidth": number;
    "🔍MagnifyGlass.ActivationKey": string;
    "🔍MagnifyGlass.AltRequired": boolean;
    "🔍MagnifyGlass.FollowCursor": boolean;
    "🔍MagnifyGlass.DebugMode": boolean;
    "🔍MagnifyGlass.OffsetStep": number;
    "🔍MagnifyGlass.GlassPosition": string;
    "🔍MagnifyGlass.ResetKey": string;
    "🔍MagnifyGlass.GlassShape": string;
    "🔍MagnifyGlass.BorderEnabled": boolean;
    "🔍MagnifyGlass.TextureFiltering": string;
    "🔍MagnifyGlass.AlwaysActiveMode": boolean;
    "🔍MagnifyGlass.ToggleFollowCursorKey": string;
}

export interface PanelSettings {
    "🔍MagnifyGlass.InfoPanelEnabled": boolean;
    "🔍MagnifyGlass.InfoPanelPosition": string;
    "🔍MagnifyGlass.InfoPanelWidth": number;
    "🔍MagnifyGlass.InfoPanelOpacity": number;
    "🔍MagnifyGlass.InfoPanelMaxHeight": number;
    "🔍MagnifyGlass.InfoPanelAnimations": boolean;
    "🔍MagnifyGlass.ShowInspectorTab": boolean;
    "🔍MagnifyGlass.ToggleHotkey": string;
    "🔍MagnifyGlass.GlassPreviewToggleHotkey": string;
    "🔍MagnifyGlass.PinPanelHotkey": string;
    "🔍MagnifyGlass.ShowHoveringControls": boolean;
    "🔍MagnifyGlass.ControlsPosition": string;
    "🔍MagnifyGlass.InfoPanelTextColor": string;
    "🔍MagnifyGlass.InfoPanelAccentColor": string;
    [key: string]: any; // Allow indexing
}

/**
 * Default settings for the magnify glass component.
 */
export const DEFAULT_GLASS_SETTINGS: GlassSettings = {
    "🔍MagnifyGlass.ZoomFactor": DEFAULT_ZOOM_FACTOR,
    "🔍MagnifyGlass.GlassSize": DEFAULT_GLASS_SIZE,
    "🔍MagnifyGlass.BorderColor": DEFAULT_BORDER_COLOR,
    "🔍MagnifyGlass.BorderWidth": DEFAULT_BORDER_WIDTH,
    "🔍MagnifyGlass.ActivationKey": "x",
    "🔍MagnifyGlass.AltRequired": false,
    "🔍MagnifyGlass.FollowCursor": false,
    "🔍MagnifyGlass.DebugMode": false,
    "🔍MagnifyGlass.OffsetStep": DEFAULT_OFFSET_STEP,
    "🔍MagnifyGlass.GlassPosition": "Top-Right",
    "🔍MagnifyGlass.ResetKey": "o",
    "🔍MagnifyGlass.GlassShape": "Rounded Square",
    "🔍MagnifyGlass.BorderEnabled": true,
    "🔍MagnifyGlass.TextureFiltering": "Linear",
    "🔍MagnifyGlass.AlwaysActiveMode": true,
    "🔍MagnifyGlass.ToggleFollowCursorKey": "h",
};

/**
 * Default settings for the info panel component.
 */
export const DEFAULT_PANEL_SETTINGS: PanelSettings = {
    "🔍MagnifyGlass.InfoPanelEnabled": true,
    "🔍MagnifyGlass.InfoPanelPosition": "Bottom",
    "🔍MagnifyGlass.InfoPanelWidth": DEFAULT_PANEL_WIDTH,
    "🔍MagnifyGlass.InfoPanelOpacity": DEFAULT_PANEL_OPACITY,
    "🔍MagnifyGlass.InfoPanelMaxHeight": DEFAULT_PANEL_MAX_HEIGHT,
    "🔍MagnifyGlass.InfoPanelAnimations": false,
    "🔍MagnifyGlass.ShowInspectorTab": false,
    "🔍MagnifyGlass.ToggleHotkey": "i",
    "🔍MagnifyGlass.GlassPreviewToggleHotkey": "g",
    "🔍MagnifyGlass.PinPanelHotkey": "u",
    "🔍MagnifyGlass.ShowHoveringControls": true,
    "🔍MagnifyGlass.ControlsPosition": "bottom",
    "🔍MagnifyGlass.InfoPanelTextColor": "#6b7280",
    "🔍MagnifyGlass.InfoPanelAccentColor": "#3b82f6",
};

/**
 * Register all magnify glass settings with ComfyUI.
 * @param magnifyGlass - The MagnifyGlass instance
 */
export function registerGlassSettings(magnifyGlass: any): void {
    const settings = DEFAULT_GLASS_SETTINGS;

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.ZoomFactor",
        name: "🔍 Magnify Glass: Zoom Factor (%)",
        type: "slider",
        defaultValue: settings["🔍MagnifyGlass.ZoomFactor"],
        min: 100,
        max: 1000,
        step: 25,
        tooltip: "Magnification level as a percentage (e.g., 300 = 3x zoom, 150 = 1.5x zoom).",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.zoomFactor = typeof value === 'number' ? value / 100 : parseFloat(value) / 100;
                if (magnifyGlass.state.active) {
                    magnifyGlass.updateMagnifiedView();
                }
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.GlassSize",
        name: "🔍 Magnify Glass: Size (px)",
        type: "slider",
        defaultValue: settings["🔍MagnifyGlass.GlassSize"],
        min: 50,
        max: 100,
        step: 10,
        tooltip: "Diameter of the magnifying glass circle in pixels.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.glassSize = parseInt(String(value), 10);
                magnifyGlass.applyUiChanges();
                if (magnifyGlass.state.active) {
                    magnifyGlass.updateMagnifiedView();
                }
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.BorderWidth",
        name: "🔍 Magnify Glass: Border Width (px)",
        type: "slider",
        defaultValue: settings["🔍MagnifyGlass.BorderWidth"],
        min: 0,
        max: 10,
        step: 0.1,
        tooltip: "Width of the border around the magnifying glass.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.borderWidth = parseFloat(String(value));
                magnifyGlass.applyUiChanges();
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.BorderColor",
        name: "🎨 Magnify Glass: Border Color",
        type: "color",
        defaultValue: settings["🔍MagnifyGlass.BorderColor"],
        tooltip: "Color of the border around the magnifying glass.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                const strValue = String(value);
                const normalizedColor = strValue && !strValue.startsWith('#') ? `#${strValue}` : strValue;
                magnifyGlass.config.borderColor = normalizedColor;
                if (strValue !== normalizedColor) {
                    try {
                        app.ui.settings.setSettingValue("🔍MagnifyGlass.BorderColor", normalizedColor);
                    } catch (e) {
                        console.warn('Failed to save normalized border color:', e);
                    }
                }
                magnifyGlass.applyUiChanges();
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.ActivationKey",
        name: "⌨️ Magnify Glass: Activation Key",
        type: "combo",
        options: ACTIVATION_KEYS.map(k => ({ value: k, text: k })), // Assuming ACTIVATION_KEYS is simply an array of strings
        defaultValue: settings["🔍MagnifyGlass.ActivationKey"],
        tooltip: "The key to activate the magnifier.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.activationKey = String(value).toLowerCase();
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.AltRequired",
        name: "⌨️ Magnify Glass: Require Alt/Option Key",
        type: "combo",
        options: [{ value: true, text: "Yes" }, { value: false, text: "No" }],
        defaultValue: settings["🔍MagnifyGlass.AltRequired"],
        tooltip: "If Yes, Alt (Windows/Linux) or Option (Mac) must be held for activation.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.altRequired = !!value;
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.FollowCursor",
        name: "🖱️ Magnify Glass: Follow Cursor Position",
        type: "combo",
        options: [{ value: true, text: "Yes" }, { value: false, text: "No" }],
        defaultValue: settings["🔍MagnifyGlass.FollowCursor"],
        tooltip: "If Yes, the magnifier window moves with the cursor.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.followCursor = !!value;
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.OffsetStep",
        name: "⌨️ Magnify Glass: Offset Adjust Step",
        type: "slider",
        defaultValue: settings["🔍MagnifyGlass.OffsetStep"],
        min: 1,
        max: 50,
        step: 1,
        tooltip: "How many graph units the view shifts when pressing arrow keys.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.offsetStep = parseInt(String(value), 10);
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.ResetKey",
        name: "⌨️ Magnify Glass: Reset Offset Key",
        type: "combo",
        options: RESET_KEYS.map(k => ({ value: k, text: k })),
        defaultValue: settings["🔍MagnifyGlass.ResetKey"],
        tooltip: "The key to reset the magnify glass offset to default.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.resetKey = String(value).toLowerCase();
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.DebugMode",
        name: "🐞 Magnify Glass: Debug Mode",
        type: "combo",
        options: [{ value: true, text: "Enabled" }, { value: false, text: "Disabled" }],
        defaultValue: settings["🔍MagnifyGlass.DebugMode"],
        tooltip: "Show detailed logging and the debug visualization overlay.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.debugMode = !!value;
                magnifyGlass.applyUiChanges();
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.GlassPosition",
        name: "🖱️ Magnify Glass: Glass Position",
        type: "combo",
        options: GLASS_POSITIONS.map(p => ({ value: p, text: p === "Bottom" ? "Bottom (Default)" : p })),
        defaultValue: settings["🔍MagnifyGlass.GlassPosition"],
        tooltip: "Position of the magnifying glass relative to the cursor.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.glassPosition = String(value);
                if (magnifyGlass.state.active && !magnifyGlass.config.followCursor) {
                    const { x, y } = magnifyGlass.lastKnownMousePosition;
                    magnifyGlass.ui.positionGlass(x, y);
                }
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.GlassShape",
        name: "🖼️ Magnify Glass: Shape",
        type: "combo",
        options: GLASS_SHAPES.map(s => ({ value: s, text: s })),
        defaultValue: settings["🔍MagnifyGlass.GlassShape"],
        tooltip: "Shape of the magnifying glass.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.glassShape = String(value);
                magnifyGlass.applyUiChanges();
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.BorderEnabled",
        name: "🖼️ Magnify Glass: Show Border",
        type: "combo",
        options: [{ value: true, text: "Yes" }, { value: false, text: "No" }],
        defaultValue: settings["🔍MagnifyGlass.BorderEnabled"],
        tooltip: "Enable or disable the border around the magnifying glass.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.borderEnabled = !!value;
                magnifyGlass.applyUiChanges();
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.TextureFiltering",
        name: "🖼️ Magnify Glass: Texture Filtering",
        type: "combo",
        options: [
            { value: "Linear", text: "Linear (Smooth)" },
            { value: "Nearest", text: "Nearest (Pixelated)" }
        ],
        defaultValue: settings["🔍MagnifyGlass.TextureFiltering"],
        tooltip: "Controls how the magnified image is scaled.",
        onChange: (value: any) => {
            if (magnifyGlass?.config && magnifyGlass.renderer) {
                magnifyGlass.config.textureFiltering = String(value);
                magnifyGlass.renderer.updateTextureFiltering(value);
                if (magnifyGlass.state.active) {
                    magnifyGlass.updateMagnifiedView();
                }
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.AlwaysActiveMode",
        name: "🔒 Magnify Glass: Always Active Mode",
        type: "combo",
        options: [{ value: true, text: "Yes" }, { value: false, text: "No" }],
        defaultValue: settings["🔍MagnifyGlass.AlwaysActiveMode"],
        tooltip: "If Yes, activating the magnifier keeps it on until activated again.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.alwaysActiveMode = !!value;
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.ToggleFollowCursorKey",
        name: "🔑 Magnify Glass: Toggle Follow Key",
        type: "combo",
        options: TOGGLE_FOLLOW_KEYS.map(k => ({ value: k, text: k })),
        defaultValue: settings["🔍MagnifyGlass.ToggleFollowCursorKey"],
        tooltip: "The key to toggle the 'Follow Cursor' behavior.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.toggleFollowCursorKey = String(value).toLowerCase();
            }
        }
    });
}

/**
 * Register all info panel settings with ComfyUI.
 * @param stateManager - The StateManager instance for the info panel
 * @param uiManager - The UIManager instance for the info panel
 * @param positionManager - The PositionManager instance for the info panel
 */
export function registerPanelSettings(stateManager: any, uiManager: any, positionManager: any): void {
    const settings = DEFAULT_PANEL_SETTINGS;

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.InfoPanelEnabled",
        name: "📊 Info Panel: Enable",
        type: "combo",
        options: [{ value: true, text: "Yes" }, { value: false, text: "No" }],
        defaultValue: settings["🔍MagnifyGlass.InfoPanelEnabled"],
        tooltip: "Enable or disable the information panel.",
        onChange: (value: any) => {
            if (stateManager) {
                stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"] = !!value;
                if (!value && uiManager) {
                    uiManager.hide();
                }
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.InfoPanelPosition",
        name: "📊 Info Panel: Position",
        type: "combo",
        options: PANEL_POSITIONS.map(p => ({ value: p, text: p })),
        defaultValue: settings["🔍MagnifyGlass.InfoPanelPosition"],
        tooltip: "Position of the info panel relative to the magnifying glass.",
        onChange: (value: any) => {
            if (stateManager) {
                stateManager.state.settings["🔍MagnifyGlass.InfoPanelPosition"] = String(value);
                if (positionManager) {
                    positionManager.positionPanel();
                }
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.InfoPanelWidth",
        name: "📊 Info Panel: Width (px)",
        type: "slider",
        defaultValue: settings["🔍MagnifyGlass.InfoPanelWidth"],
        min: 200,
        max: 600,
        step: 20,
        tooltip: "Width of the information panel in pixels.",
        onChange: (value: any) => {
            if (stateManager) {
                stateManager.state.settings["🔍MagnifyGlass.InfoPanelWidth"] = parseInt(String(value), 10);
                if (uiManager) {
                    uiManager.applyStyles();
                }
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.InfoPanelOpacity",
        name: "📊 Info Panel: Opacity (%)",
        type: "slider",
        defaultValue: settings["🔍MagnifyGlass.InfoPanelOpacity"],
        min: 10,
        max: 100,
        step: 5,
        tooltip: "Opacity of the information panel background.",
        onChange: (value: any) => {
            if (stateManager) {
                stateManager.state.settings["🔍MagnifyGlass.InfoPanelOpacity"] = parseInt(String(value), 10);
                if (uiManager) {
                    uiManager.applyStyles();
                }
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.InfoPanelMaxHeight",
        name: "📊 Info Panel: Max Height (px)",
        type: "slider",
        defaultValue: settings["🔍MagnifyGlass.InfoPanelMaxHeight"],
        min: 200,
        max: 1500,
        step: 50,
        tooltip: "Maximum height of the information panel in pixels.",
        onChange: (value: any) => {
            if (stateManager) {
                stateManager.state.settings["🔍MagnifyGlass.InfoPanelMaxHeight"] = parseInt(String(value), 10);
                if (uiManager) {
                    uiManager.applyStyles();
                }
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.InfoPanelAnimations",
        name: "📊 Info Panel: Animations",
        type: "combo",
        options: [{ value: true, text: "Enabled" }, { value: false, text: "Disabled" }],
        defaultValue: settings["🔍MagnifyGlass.InfoPanelAnimations"],
        tooltip: "Enable or disable animations for the info panel.",
        onChange: (value: any) => {
            if (stateManager) {
                stateManager.state.settings["🔍MagnifyGlass.InfoPanelAnimations"] = !!value;
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.ShowInspectorTab",
        name: "📊 Info Panel: Show Inspector Tab",
        type: "combo",
        options: [{ value: true, text: "Yes" }, { value: false, text: "No" }],
        defaultValue: settings["🔍MagnifyGlass.ShowInspectorTab"],
        tooltip: "Show or hide the Inspector tab with cursor and canvas information.",
        onChange: (value: any) => {
            if (stateManager) {
                stateManager.state.settings["🔍MagnifyGlass.ShowInspectorTab"] = !!value;
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.ShowHoveringControls",
        name: "📊 Info Panel: Show Hover Controls",
        type: "combo",
        options: [{ value: true, text: "Yes" }, { value: false, text: "No" }],
        defaultValue: settings["🔍MagnifyGlass.ShowHoveringControls"],
        tooltip: "Show or hide hovering UI controls above the info panel.",
        onChange: (value: any) => {
            if (stateManager) {
                stateManager.state.settings["🔍MagnifyGlass.ShowHoveringControls"] = !!value;
                if (uiManager && uiManager.elements.controls) {
                    uiManager.elements.controls.style.display = value ? 'flex' : 'none';
                }
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.InfoPanelTextColor",
        name: "🎨 Info Panel: Text Color",
        type: "color",
        defaultValue: settings["🔍MagnifyGlass.InfoPanelTextColor"],
        tooltip: "Custom text color for the info panel.",
        onChange: (value: any) => {
            if (stateManager) {
                const strValue = String(value);
                const normalizedColor = strValue && !strValue.startsWith('#') ? `#${strValue}` : strValue;
                stateManager.state.settings["🔍MagnifyGlass.InfoPanelTextColor"] = normalizedColor;
                if (uiManager) {
                    uiManager.applyStyles();
                }
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.InfoPanelAccentColor",
        name: "🎨 Info Panel: Accent Color",
        type: "color",
        defaultValue: settings["🔍MagnifyGlass.InfoPanelAccentColor"],
        tooltip: "Custom accent color for the info panel.",
        onChange: (value: any) => {
            if (stateManager) {
                const strValue = String(value);
                const normalizedColor = strValue && !strValue.startsWith('#') ? `#${strValue}` : strValue;
                stateManager.state.settings["🔍MagnifyGlass.InfoPanelAccentColor"] = normalizedColor;
                if (uiManager) {
                    uiManager.applyStyles();
                }
            }
        }
    });
}

/**
 * Get a setting configuration object for ComfyUI settings registration.
 * This function generates the setting config based on the key and default value.
 * 
 * @param key - The setting key
 * @param defaultValue - The default value for the setting
 * @returns The setting configuration or null if not found
 */
export function getSettingConfig(key: string, defaultValue: any): any {
    const configs: Record<string, any> = {
        "🔍MagnifyGlass.InfoPanelEnabled": {
            id: key,
            name: "📋 Magnify Glass: Info Panel",
            type: "combo",
            options: [
                { value: true, text: "Enabled" },
                { value: false, text: "Disabled" }
            ],
            defaultValue,
            tooltip: "Enable or disable the professional information panel."
        },
        "🔍MagnifyGlass.InfoPanelPosition": {
            id: key,
            name: "📋 Info Panel: Position",
            type: "combo",
            options: PANEL_POSITIONS.map(pos => ({ value: pos, text: pos })),
            defaultValue,
            tooltip: "Position of the info panel relative to the magnify glass."
        },
        "🔍MagnifyGlass.InfoPanelWidth": {
            id: key,
            name: "📋 Info Panel: Width (px)",
            type: "slider",
            defaultValue,
            min: 200,
            max: 600,
            step: 20,
            tooltip: "Width of the info panel in pixels."
        },
        "🔍MagnifyGlass.InfoPanelMaxHeight": {
            id: key,
            name: "📋 Info Panel: Max Height (px)",
            type: "slider",
            defaultValue,
            min: 200,
            max: 1500,
            step: 50,
            tooltip: "Maximum height of the info panel."
        },
        "🔍MagnifyGlass.InfoPanelOpacity": {
            id: key,
            name: "📋 Info Panel: Opacity (%)",
            type: "slider",
            defaultValue,
            min: 10,
            max: 100,
            step: 5,
            tooltip: "Opacity of the info panel background."
        },
        "🔍MagnifyGlass.InfoPanelAnimations": {
            id: key,
            name: "📋 Info Panel: Animations",
            type: "combo",
            options: [
                { value: true, text: "Enabled" },
                { value: false, text: "Disabled" }
            ],
            defaultValue,
            tooltip: "Enable smooth animations for the info panel."
        },
        "🔍MagnifyGlass.ShowInspectorTab": {
            id: key,
            name: "📋 Info Panel: Show Inspector",
            type: "combo",
            options: [
                { value: true, text: "Yes" },
                { value: false, text: "No" }
            ],
            defaultValue,
            tooltip: "Show the inspector tab with cursor and canvas information."
        },
        "🔍MagnifyGlass.ToggleHotkey": {
            id: key,
            name: "📋 Info Panel: Toggle Hotkey",
            type: "combo",
            options: ["i", "j", "k", "l", "n", "m"].map(k => ({ value: k, text: k.toUpperCase() })),
            defaultValue,
            tooltip: "Key to toggle the info panel visibility."
        },
        "🔍MagnifyGlass.GlassPreviewToggleHotkey": {
            id: key,
            name: "📋 Info Panel: Glass Toggle Hotkey",
            type: "combo",
            options: ["g", "f", "v", "b"].map(k => ({ value: k, text: k.toUpperCase() })),
            defaultValue,
            tooltip: "Key to toggle the magnify glass preview visibility."
        },
        "🔍MagnifyGlass.PinPanelHotkey": {
            id: key,
            name: "📋 Info Panel: Pin Hotkey",
            type: "combo",
            options: ["u", "p", "y", "t"].map(k => ({ value: k, text: k.toUpperCase() })),
            defaultValue,
            tooltip: "Key to pin/unlock the info panel at the current mouse location."
        },
        "🔍MagnifyGlass.ShowHoveringControls": {
            id: key,
            name: "📋 Info Panel: Floating Controls",
            type: "combo",
            options: [
                { value: true, text: "Show" },
                { value: false, text: "Hide" }
            ],
            defaultValue,
            tooltip: "Show floating control buttons near the info panel."
        },
        "🔍MagnifyGlass.ControlsPosition": {
            id: key,
            name: "📋 Info Panel: Controls Position",
            type: "combo",
            options: ["top-left", "top-right", "bottom-left", "bottom-right", "top", "bottom", "left", "right"].map(p => ({ value: p, text: p })),
            defaultValue,
            tooltip: "Position of the floating control buttons."
        },
        "🔍MagnifyGlass.InfoPanelTextColor": {
            id: key,
            name: "🎨 Info Panel: Text Color",
            type: "color",
            defaultValue,
            tooltip: "Color for text in the info panel."
        },
        "🔍MagnifyGlass.InfoPanelAccentColor": {
            id: key,
            name: "🎨 Info Panel: Accent Color",
            type: "color",
            defaultValue,
            tooltip: "Accent color for highlights in the info panel."
        }
    };

    return configs[key] || null;
}
