/**
 * ComfyUI MagnifyGlass - Default Settings Values
 * 
 * Default values for all magnify glass and info panel settings.
 */

import {
    DEFAULT_GLASS_SIZE,
    DEFAULT_ZOOM_FACTOR,
    DEFAULT_BORDER_WIDTH,
    DEFAULT_BORDER_COLOR,
    DEFAULT_OFFSET_STEP,
    DEFAULT_PANEL_WIDTH,
    DEFAULT_PANEL_MAX_HEIGHT,
    DEFAULT_PANEL_OPACITY
} from '../constants';
import type { GlassSettings, PanelSettings } from './types';

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
    "🔍MagnifyGlass.ControlsPosition": "left",
    "🔍MagnifyGlass.InfoPanelTextColor": "#6b7280",
    "🔍MagnifyGlass.InfoPanelAccentColor": "#3b82f6",
    "🔍MagnifyGlass.InfoPanelFontSize": 14,
    "🔍MagnifyGlass.InfoPanelFontFamily": "System Default",
    "🔍MagnifyGlass.InfoPanelPersist": false,
};
