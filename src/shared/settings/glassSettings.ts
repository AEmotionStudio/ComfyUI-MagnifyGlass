/**
 * ComfyUI MagnifyGlass - Glass Settings Registration
 * 
 * Registers all magnify glass settings with ComfyUI.
 */

// @ts-ignore
import { app } from "/scripts/app.js";
import {
    GLASS_POSITIONS,
    GLASS_SHAPES,
    ACTIVATION_KEYS,
    RESET_KEYS,
    TOGGLE_FOLLOW_KEYS
} from '../constants';
import { DEFAULT_GLASS_SETTINGS } from './defaults';

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
        options: ACTIVATION_KEYS.map(k => ({ value: k, text: k })),
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
