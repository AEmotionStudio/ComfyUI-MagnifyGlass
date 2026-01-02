/**
 * ComfyUI MagnifyGlass - Panel Settings Registration
 * 
 * Registers all info panel settings with ComfyUI.
 */

// @ts-ignore
import { app } from "/scripts/app.js";
import { PANEL_POSITIONS } from '../constants';
import { DEFAULT_PANEL_SETTINGS } from './defaults';

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
        id: "🔍MagnifyGlass.InfoPanelFontSize",
        name: "📊 Info Panel: Font Size (px)",
        type: "slider",
        defaultValue: settings["🔍MagnifyGlass.InfoPanelFontSize"],
        min: 8,
        max: 24,
        step: 1,
        tooltip: "Font size of the information panel text.",
        onChange: (value: any) => {
            if (stateManager) {
                stateManager.state.settings["🔍MagnifyGlass.InfoPanelFontSize"] = parseInt(String(value), 10);
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
