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
];

// Glass shape options
export const GLASS_SHAPES = [
    "Circle",
    "Square",
    "Rounded Square"
];

// Texture filtering modes
export const TEXTURE_FILTERS = [
    "Linear",
    "Nearest"
];

// Info panel positions relative to glass
export const PANEL_POSITIONS = [
    "Top",
    "Bottom",
    "Left",
    "Right"
];

// Available activation keys
export const ACTIVATION_KEYS = ["x", "z", "m", "q", "v", "c"];

// Available reset keys
export const RESET_KEYS = ["r", "o", "p", "k", "l"];

// Available toggle follow keys
export const TOGGLE_FOLLOW_KEYS = ["f", "g", "h", "j", "k"];

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
};

// Animation durations (ms)
export const ANIMATION = {
    PANEL_TRANSITION: 300,
    AUTO_COLLAPSE_DELAY: 1500,
    THEME_DETECTION_INTERVAL: 2000
};

// LocalStorage keys
export const STORAGE_KEYS = {
    OFFSET_X: 'comfyui_magnify_offset_x',
    OFFSET_Y: 'comfyui_magnify_offset_y'
};
