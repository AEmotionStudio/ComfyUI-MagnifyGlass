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

// Info panel fonts; each is used only when installed on this computer
export const PANEL_FONTS = [
    "System Default", "Inter", "Roboto", "JetBrains Mono", "Fira Code",
    "IBM Plex Sans", "Space Grotesk", "Lexend", "Outfit",
    "Cinzel", "Playfair Display", "Orbitron", "Dancing Script", "Amatic SC",
    "Comfortaa", "Righteous", "Bangers", "Press Start 2P", "Audiowide",
    "monospace"
] as const;

// Available keys for settings
export const ACTIVATION_KEYS = ["x", "z", "m", "q", "v", "c"] as const;
export const RESET_KEYS = ["r", "o", "p", "k", "l"] as const;
export const TOGGLE_FOLLOW_KEYS = ["f", "g", "h", "j", "k"] as const;
export const DIRECT_CAPTURE_KEYS = ["d", "s", "a", "q", "e"] as const;

// UI Constants
export const DEFAULT_PADDING = 4;
export const DEFAULT_GLASS_Y_OFFSET = 198; // Starting Y position offset (below top bar with 3px gap)
export const DEFAULT_GLASS_SIZE = 300;
export const DEFAULT_ZOOM_FACTOR = 300; // 3x as percentage
export const DEFAULT_BORDER_WIDTH = 1;
export const DEFAULT_BORDER_COLOR = "#6b7280";
export const DEFAULT_OFFSET_STEP = 5;

// Panel Constants
export const DEFAULT_PANEL_WIDTH = 300;
export const DEFAULT_PANEL_MAX_HEIGHT = 600;
export const DEFAULT_PANEL_OPACITY = 100;
export const INFO_PANEL_ID = "comfyui-magnify-info-panel-pro-v2";

// Z-Index hierarchy
export const Z_INDEX = {
    GLASS: 98999,
    DEBUG: 99000,
    PANEL: 99999,
    CONTROLS: 99998
} as const;

// LocalStorage keys
export const STORAGE_KEYS = {
    OFFSET_X: 'comfyui_magnify_offset_x',
    OFFSET_Y: 'comfyui_magnify_offset_y',
    INSPECTOR_LAYOUT: 'comfyui_magnify_inspector_layout'
} as const;

// BroadcastChannel for pop-out tab communication
export const BROADCAST_CHANNEL_NAME = 'comfyui-magnifyglass-popout';

