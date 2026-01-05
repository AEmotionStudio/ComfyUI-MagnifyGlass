/**
 * ComfyUI MagnifyGlass - Settings Type Definitions
 * 
 * Type definitions for magnify glass and info panel settings.
 */

/**
 * Settings for the magnify glass component.
 */
export interface GlassSettings {
    "🔍MagnifyGlass.ZoomFactor": number;
    "🔍MagnifyGlass.GlassSize": number;
    "🔍MagnifyGlass.BorderColor": string;
    "🔍MagnifyGlass.BorderWidth": number;
    "🔍MagnifyGlass.ActivationKey": string;
    "🔍MagnifyGlass.AltRequired": boolean;
    "🔍MagnifyGlass.FollowCursor": boolean;
    "🔍MagnifyGlass.OffsetStep": number;
    "🔍MagnifyGlass.GlassPosition": string;
    "🔍MagnifyGlass.ResetKey": string;
    "🔍MagnifyGlass.GlassShape": string;
    "🔍MagnifyGlass.BorderEnabled": boolean;
    "🔍MagnifyGlass.TextureFiltering": string;
    "🔍MagnifyGlass.AlwaysActiveMode": boolean;
    "🔍MagnifyGlass.ToggleFollowCursorKey": string;
    "🔍MagnifyGlass.ShowCursorPreview": boolean;
    "🔍MagnifyGlass.ForceDirectCaptureKey": string;
    "🔍MagnifyGlass.ForceDirectCapture": boolean;
}

/**
 * Settings for the info panel component.
 */
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
    "🔍MagnifyGlass.InfoPanelFontSize": number;
    "🔍MagnifyGlass.InfoPanelFontFamily": string;
    "🔍MagnifyGlass.InfoPanelPersist": boolean;
    [key: string]: string | number | boolean; // Allow indexing
}

/**
 * Settings for accessibility enhancements in the glass preview.
 */
export interface AccessibilitySettings {
    /** Master toggle for accessibility mode */
    "🔍MagnifyGlass.AccessibilityEnabled": boolean;
    /** High contrast mode - boost text contrast */
    "🔍MagnifyGlass.HighContrastMode": boolean;
    /** Text glow effect enabled */
    "🔍MagnifyGlass.TextGlowEnabled": boolean;
    /** Color of the text glow effect */
    "🔍MagnifyGlass.TextGlowColor": string;
    /** Blur radius for text glow (1-15px) */
    "🔍MagnifyGlass.TextGlowIntensity": number;
    /** Font size multiplier (100-200%) */
    "🔍MagnifyGlass.FontScaleFactor": number;
    /** Force bolder font weight */
    "🔍MagnifyGlass.BoldTextEnabled": boolean;
    /** Add contrasting stroke around text */
    "🔍MagnifyGlass.TextOutlineEnabled": boolean;
    /** Color of the text outline */
    "🔍MagnifyGlass.TextOutlineColor": string;
    /** Extra styling for node names */
    "🔍MagnifyGlass.NodeTitleEmphasis": boolean;
    /** Invert all colors */
    "🔍MagnifyGlass.InvertColors": boolean;
    /** Desaturate all colors */
    "🔍MagnifyGlass.GrayscaleMode": boolean;
    /** Disable smooth transitions */
    "🔍MagnifyGlass.ReduceMotion": boolean;
}

/**
 * Combined settings type.
 */
export type AllSettings = GlassSettings & PanelSettings & AccessibilitySettings;
