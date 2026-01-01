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
    [key: string]: string | number | boolean; // Allow indexing
}

/**
 * Combined settings type.
 */
export type AllSettings = GlassSettings & PanelSettings;
