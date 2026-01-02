const GLASS_POSITIONS = [
  "Top",
  "Bottom",
  "Left",
  "Right",
  "Top-Left",
  "Top-Right",
  "Bottom-Left",
  "Bottom-Right"
];
const GLASS_SHAPES = [
  "Circle",
  "Square",
  "Rounded Square"
];
const PANEL_POSITIONS = [
  "Top",
  "Bottom",
  "Left",
  "Right"
];
const ACTIVATION_KEYS = ["x", "z", "m", "q", "v", "c"];
const RESET_KEYS = ["r", "o", "p", "k", "l"];
const TOGGLE_FOLLOW_KEYS = ["f", "g", "h", "j", "k"];
const DEFAULT_PADDING = 4;
const DEFAULT_GLASS_Y_OFFSET = 110;
const DEFAULT_GLASS_SIZE = 300;
const DEFAULT_ZOOM_FACTOR = 300;
const DEFAULT_BORDER_WIDTH = 1;
const DEFAULT_BORDER_COLOR = "#6b7280";
const DEFAULT_OFFSET_STEP = 5;
const DEFAULT_PANEL_WIDTH = 300;
const DEFAULT_PANEL_MAX_HEIGHT = 300;
const DEFAULT_PANEL_OPACITY = 100;
const Z_INDEX = {
  GLASS: 98999,
  DEBUG: 99e3
};
const STORAGE_KEYS = {
  OFFSET_X: "comfyui_magnify_offset_x",
  OFFSET_Y: "comfyui_magnify_offset_y"
};
export {
  ACTIVATION_KEYS,
  DEFAULT_BORDER_COLOR,
  DEFAULT_BORDER_WIDTH,
  DEFAULT_GLASS_SIZE,
  DEFAULT_GLASS_Y_OFFSET,
  DEFAULT_OFFSET_STEP,
  DEFAULT_PADDING,
  DEFAULT_PANEL_MAX_HEIGHT,
  DEFAULT_PANEL_OPACITY,
  DEFAULT_PANEL_WIDTH,
  DEFAULT_ZOOM_FACTOR,
  GLASS_POSITIONS,
  GLASS_SHAPES,
  PANEL_POSITIONS,
  RESET_KEYS,
  STORAGE_KEYS,
  TOGGLE_FOLLOW_KEYS,
  Z_INDEX
};
//# sourceMappingURL=constants.js.map
