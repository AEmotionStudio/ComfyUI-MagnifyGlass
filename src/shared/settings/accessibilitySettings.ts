/**
 * ComfyUI MagnifyGlass - Accessibility Settings Registration
 * 
 * Registers all accessibility settings with ComfyUI.
 */

// @ts-ignore
import { app } from "/scripts/app.js";
import { DEFAULT_ACCESSIBILITY_SETTINGS } from './defaults';

/**
 * Register all accessibility settings with ComfyUI.
 * @param magnifyGlass - The MagnifyGlass instance
 */
export function registerAccessibilitySettings(magnifyGlass: any): void {
    const settings = DEFAULT_ACCESSIBILITY_SETTINGS;

    // ===== Master Toggle =====
    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.AccessibilityEnabled",
        name: "♿ Accessibility: Enable Accessibility Mode",
        type: "combo",
        options: [{ value: true, text: "Yes" }, { value: false, text: "No" }],
        defaultValue: settings["🔍MagnifyGlass.AccessibilityEnabled"],
        tooltip: "Master toggle for all accessibility enhancements in the glass preview.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.accessibilityEnabled = !!value;
                if (magnifyGlass.state.active) {
                    magnifyGlass.updateMagnifiedView();
                }
            }
        }
    });

    // ===== High Contrast Mode =====
    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.HighContrastMode",
        name: "♿ Accessibility: High Contrast Mode",
        type: "combo",
        options: [{ value: true, text: "Yes" }, { value: false, text: "No" }],
        defaultValue: settings["🔍MagnifyGlass.HighContrastMode"],
        tooltip: "Boost text contrast with bright white/yellow text on dark backgrounds.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.highContrastMode = !!value;
                if (magnifyGlass.state.active) {
                    magnifyGlass.updateMagnifiedView();
                }
            }
        }
    });

    // ===== Text Glow =====
    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.TextGlowEnabled",
        name: "♿ Accessibility: Text Glow Effect",
        type: "combo",
        options: [{ value: true, text: "Yes" }, { value: false, text: "No" }],
        defaultValue: settings["🔍MagnifyGlass.TextGlowEnabled"],
        tooltip: "Add a glow/shadow effect behind text for emphasis.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.textGlowEnabled = !!value;
                if (magnifyGlass.state.active) {
                    magnifyGlass.updateMagnifiedView();
                }
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.TextGlowColor",
        name: "🎨 Accessibility: Text Glow Color",
        type: "color",
        defaultValue: settings["🔍MagnifyGlass.TextGlowColor"],
        tooltip: "Color of the text glow effect.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                const strValue = String(value);
                const normalizedColor = strValue && !strValue.startsWith('#') ? `#${strValue}` : strValue;
                magnifyGlass.config.textGlowColor = normalizedColor;
                if (magnifyGlass.state.active) {
                    magnifyGlass.updateMagnifiedView();
                }
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.TextGlowIntensity",
        name: "♿ Accessibility: Text Glow Intensity",
        type: "slider",
        defaultValue: settings["🔍MagnifyGlass.TextGlowIntensity"],
        min: 1,
        max: 15,
        step: 1,
        tooltip: "Blur radius for the text glow effect (1-15 pixels).",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.textGlowIntensity = parseInt(String(value), 10);
                if (magnifyGlass.state.active) {
                    magnifyGlass.updateMagnifiedView();
                }
            }
        }
    });

    // ===== Font Scaling =====
    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.FontScaleFactor",
        name: "♿ Accessibility: Font Scale Factor (%)",
        type: "slider",
        defaultValue: settings["🔍MagnifyGlass.FontScaleFactor"],
        min: 100,
        max: 200,
        step: 10,
        tooltip: "Extra font size multiplier for text in the glass (100-200%).",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.fontScaleFactor = parseInt(String(value), 10);
                if (magnifyGlass.state.active) {
                    magnifyGlass.updateMagnifiedView();
                }
            }
        }
    });

    // ===== Bold Text =====
    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.BoldTextEnabled",
        name: "♿ Accessibility: Bold Text",
        type: "combo",
        options: [{ value: true, text: "Yes" }, { value: false, text: "No" }],
        defaultValue: settings["🔍MagnifyGlass.BoldTextEnabled"],
        tooltip: "Force bolder font weight for improved readability.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.boldTextEnabled = !!value;
                if (magnifyGlass.state.active) {
                    magnifyGlass.updateMagnifiedView();
                }
            }
        }
    });

    // ===== Text Outline =====
    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.TextOutlineEnabled",
        name: "♿ Accessibility: Text Outline",
        type: "combo",
        options: [{ value: true, text: "Yes" }, { value: false, text: "No" }],
        defaultValue: settings["🔍MagnifyGlass.TextOutlineEnabled"],
        tooltip: "Add a contrasting stroke/outline around text characters.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.textOutlineEnabled = !!value;
                if (magnifyGlass.state.active) {
                    magnifyGlass.updateMagnifiedView();
                }
            }
        }
    });

    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.TextOutlineColor",
        name: "🎨 Accessibility: Text Outline Color",
        type: "color",
        defaultValue: settings["🔍MagnifyGlass.TextOutlineColor"],
        tooltip: "Color of the text outline stroke.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                const strValue = String(value);
                const normalizedColor = strValue && !strValue.startsWith('#') ? `#${strValue}` : strValue;
                magnifyGlass.config.textOutlineColor = normalizedColor;
                if (magnifyGlass.state.active) {
                    magnifyGlass.updateMagnifiedView();
                }
            }
        }
    });

    // ===== Node Title Emphasis =====
    app.ui.settings.addSetting({
        id: "🔍MagnifyGlass.NodeTitleEmphasis",
        name: "♿ Accessibility: Node Title Emphasis",
        type: "combo",
        options: [{ value: true, text: "Yes" }, { value: false, text: "No" }],
        defaultValue: settings["🔍MagnifyGlass.NodeTitleEmphasis"],
        tooltip: "Extra styling for node names/titles to make them more prominent.",
        onChange: (value: any) => {
            if (magnifyGlass?.config) {
                magnifyGlass.config.nodeTitleEmphasis = !!value;
                if (magnifyGlass.state.active) {
                    magnifyGlass.updateMagnifiedView();
                }
            }
        }
    });
}
