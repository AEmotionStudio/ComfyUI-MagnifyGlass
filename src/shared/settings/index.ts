/**
 * ComfyUI MagnifyGlass - Settings Module
 * 
 * Re-exports all settings-related types, defaults, and registration functions.
 */

// Type definitions
export type { GlassSettings, PanelSettings, AllSettings } from './types';

// Default values
export { DEFAULT_GLASS_SETTINGS, DEFAULT_PANEL_SETTINGS } from './defaults';

// Registration functions
export { registerGlassSettings } from './glassSettings';
export { registerPanelSettings } from './panelSettings';
