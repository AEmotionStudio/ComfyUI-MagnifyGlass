/**
 * ComfyUI MagnifyGlass - Settings Configuration
 * 
 * Centralized settings definitions and registration functions.
 * 
 * This file re-exports from the modular settings directory for backwards compatibility.
 */

// Re-export everything from the settings module
export type { GlassSettings, PanelSettings, AllSettings } from './settings/types';
export { DEFAULT_GLASS_SETTINGS, DEFAULT_PANEL_SETTINGS } from './settings/defaults';
export { registerGlassSettings } from './settings/glassSettings';
export { registerPanelSettings } from './settings/panelSettings';

// Legacy getSettingConfig function for backwards compatibility
// @ts-ignore
import { app } from "/scripts/app.js";
import { PANEL_POSITIONS } from './constants';
import { DEFAULT_PANEL_SETTINGS } from './settings/defaults';

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
