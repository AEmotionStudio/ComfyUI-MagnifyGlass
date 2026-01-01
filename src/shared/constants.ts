/**
 * ComfyUI MagnifyGlass - Shared Constants
 * 
 * Configuration constants shared between magnify glass and info panel modules.
 */

// Glass positioning options
export const GLASS_POSITIONS = [
    "Top",
    "Bottom",
    "Left",
    "Right",
    "Top-Left",
    "Top-Right",
    "Bottom-Left",
    "Bottom-Right"
] as const;

export type GlassPosition = typeof GLASS_POSITIONS[number];

// Glass shape options
export const GLASS_SHAPES = [
    "Circle",
    "Square",
    "Rounded Square"
] as const;

export type GlassShape = typeof GLASS_SHAPES[number];

// Texture filtering modes
export const TEXTURE_FILTERS = [
    "Linear",
    "Nearest"
] as const;

export type TextureFilter = typeof TEXTURE_FILTERS[number];

// Info panel positions relative to glass
export const PANEL_POSITIONS = [
    "Top",
    "Bottom",
    "Left",
    "Right"
] as const;

export type PanelPosition = typeof PANEL_POSITIONS[number];

// Available keys for settings
export const ACTIVATION_KEYS = ["x", "z", "m", "q", "v", "c"] as const;
export const RESET_KEYS = ["r", "o", "p", "k", "l"] as const;
export const TOGGLE_FOLLOW_KEYS = ["f", "g", "h", "j", "k"] as const;

// UI Constants
export const DEFAULT_PADDING = 20;
export const DEFAULT_GLASS_SIZE = 300;
export const DEFAULT_ZOOM_FACTOR = 300; // 3x as percentage
export const DEFAULT_BORDER_WIDTH = 1;
export const DEFAULT_BORDER_COLOR = "#6b7280";
export const DEFAULT_OFFSET_STEP = 5;

// Panel Constants
export const DEFAULT_PANEL_WIDTH = 320;
export const DEFAULT_PANEL_MAX_HEIGHT = 1000;
export const DEFAULT_PANEL_OPACITY = 100;

// Z-Index hierarchy
export const Z_INDEX = {
    GLASS: 98999,
    DEBUG: 99000,
    PANEL: 99999,
    CONTROLS: 99998
} as const;

// Animation durations (ms)
export const ANIMATION = {
    PANEL_TRANSITION: 300,
    AUTO_COLLAPSE_DELAY: 1500,
    THEME_DETECTION_INTERVAL: 2000
} as const;

// LocalStorage keys
export const STORAGE_KEYS = {
    OFFSET_X: 'comfyui_magnify_offset_x',
    OFFSET_Y: 'comfyui_magnify_offset_y'
} as const;
