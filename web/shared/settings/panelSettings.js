import { app } from "/scripts/app.js";
import { PANEL_POSITIONS } from "../constants.js";
import { DEFAULT_PANEL_SETTINGS } from "./defaults.js";
function registerPanelSettings(stateManager, uiManager, positionManager) {
  const settings = DEFAULT_PANEL_SETTINGS;
  app.ui.settings.addSetting({
    id: "🔍MagnifyGlass.InfoPanelEnabled",
    name: "🔍 [4] Info Panel: Enable",
    type: "combo",
    options: [{ value: true, text: "Yes" }, { value: false, text: "No" }],
    defaultValue: settings["🔍MagnifyGlass.InfoPanelEnabled"],
    tooltip: "Enable or disable the information panel.",
    onChange: (value) => {
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
    name: "🔍 [4] Info Panel: Position",
    type: "combo",
    options: PANEL_POSITIONS.map((p) => ({ value: p, text: p })),
    defaultValue: settings["🔍MagnifyGlass.InfoPanelPosition"],
    tooltip: "Position of the info panel relative to the magnifying glass.",
    onChange: (value) => {
      if (stateManager) {
        stateManager.state.settings["🔍MagnifyGlass.InfoPanelPosition"] = String(value);
        if (positionManager) {
          positionManager.positionPanel();
        }
      }
    }
  });
  app.ui.settings.addSetting({
    id: "🔍MagnifyGlass.InfoPanelPersist",
    name: "🔍 [4] Info Panel: Sticky Mode (Persist)",
    type: "boolean",
    defaultValue: settings["🔍MagnifyGlass.InfoPanelPersist"],
    tooltip: "Keep displaying the last node's info until you hover over another node.",
    onChange: (value) => {
      if (stateManager) {
        stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"] = !!value;
        if (uiManager) {
          uiManager.updateControlStates();
        }
      }
    }
  });
  app.ui.settings.addSetting({
    id: "🔍MagnifyGlass.NodeHighlightEnabled",
    name: "🔍 [4] Info Panel: Node Highlight Border",
    type: "boolean",
    defaultValue: settings["🔍MagnifyGlass.NodeHighlightEnabled"],
    tooltip: "Show a blue highlight border around the currently inspected node.",
    onChange: (value) => {
      if (stateManager) {
        stateManager.state.settings["🔍MagnifyGlass.NodeHighlightEnabled"] = !!value;
        const app2 = window.app;
        if (app2 && app2.canvas) {
          app2.canvas.setDirty(true, true);
        }
      }
    }
  });
  app.ui.settings.addSetting({
    id: "🔍MagnifyGlass.ShowInspectorTab",
    name: "🔍 [4] Info Panel: Show Inspector Tab",
    type: "combo",
    options: [{ value: true, text: "Yes" }, { value: false, text: "No" }],
    defaultValue: settings["🔍MagnifyGlass.ShowInspectorTab"],
    tooltip: "Show or hide the Inspector tab with cursor and canvas information.",
    onChange: (value) => {
      if (stateManager) {
        stateManager.state.settings["🔍MagnifyGlass.ShowInspectorTab"] = !!value;
      }
    }
  });
  app.ui.settings.addSetting({
    id: "🔍MagnifyGlass.ShowHoveringControls",
    name: "🔍 [4] Info Panel: Show Hover Controls",
    type: "combo",
    options: [{ value: true, text: "Yes" }, { value: false, text: "No" }],
    defaultValue: settings["🔍MagnifyGlass.ShowHoveringControls"],
    tooltip: "Show or hide hovering UI controls above the info panel.",
    onChange: (value) => {
      if (stateManager) {
        stateManager.state.settings["🔍MagnifyGlass.ShowHoveringControls"] = !!value;
        if (uiManager && uiManager.elements.controls) {
          uiManager.elements.controls.style.display = value ? "flex" : "none";
        }
      }
    }
  });
  app.ui.settings.addSetting({
    id: "🔍MagnifyGlass.InfoPanelWidth",
    name: "🔍 [5] Panel Sizing: Width (px)",
    type: "slider",
    defaultValue: settings["🔍MagnifyGlass.InfoPanelWidth"],
    min: 200,
    max: 600,
    step: 20,
    tooltip: "Width of the information panel in pixels.",
    onChange: (value) => {
      if (stateManager) {
        stateManager.state.settings["🔍MagnifyGlass.InfoPanelWidth"] = parseInt(String(value), 10);
        if (uiManager) {
          uiManager.applyStyles();
        }
      }
    }
  });
  app.ui.settings.addSetting({
    id: "🔍MagnifyGlass.InfoPanelMaxHeight",
    name: "🔍 [5] Panel Sizing: Max Height (px)",
    type: "slider",
    defaultValue: settings["🔍MagnifyGlass.InfoPanelMaxHeight"],
    min: 200,
    max: 1500,
    step: 50,
    tooltip: "Maximum height of the information panel in pixels.",
    onChange: (value) => {
      if (stateManager) {
        stateManager.state.settings["🔍MagnifyGlass.InfoPanelMaxHeight"] = parseInt(String(value), 10);
        if (uiManager) {
          uiManager.applyStyles();
        }
      }
    }
  });
  app.ui.settings.addSetting({
    id: "🔍MagnifyGlass.InfoPanelOpacity",
    name: "🔍 [5] Panel Sizing: Opacity (%)",
    type: "slider",
    defaultValue: settings["🔍MagnifyGlass.InfoPanelOpacity"],
    min: 10,
    max: 100,
    step: 5,
    tooltip: "Opacity of the information panel background.",
    onChange: (value) => {
      if (stateManager) {
        stateManager.state.settings["🔍MagnifyGlass.InfoPanelOpacity"] = parseInt(String(value), 10);
        if (uiManager) {
          uiManager.applyStyles();
        }
      }
    }
  });
  app.ui.settings.addSetting({
    id: "🔍MagnifyGlass.InfoPanelFontSize",
    name: "🔍 [6] Panel Style: Font Size (px)",
    type: "slider",
    defaultValue: settings["🔍MagnifyGlass.InfoPanelFontSize"],
    min: 8,
    max: 24,
    step: 1,
    tooltip: "Font size of the information panel text.",
    onChange: (value) => {
      if (stateManager) {
        stateManager.state.settings["🔍MagnifyGlass.InfoPanelFontSize"] = parseInt(String(value), 10);
        if (uiManager) {
          uiManager.applyStyles();
        }
      }
    }
  });
  app.ui.settings.addSetting({
    id: "🔍MagnifyGlass.InfoPanelFontFamily",
    name: "🔍 [6] Panel Style: Font Family",
    type: "combo",
    options: [
      { value: "System Default", text: "System Default" },
      { value: "Inter", text: "Inter" },
      { value: "Roboto", text: "Roboto" },
      { value: "JetBrains Mono", text: "JetBrains Mono" },
      { value: "Fira Code", text: "Fira Code" },
      { value: "IBM Plex Sans", text: "IBM Plex Sans" },
      { value: "Space Grotesk", text: "Space Grotesk" },
      { value: "Lexend", text: "Lexend" },
      { value: "Outfit", text: "Outfit" },
      { value: "Cinzel", text: "Cinzel (Epic)" },
      { value: "Playfair Display", text: "Playfair Display (Elegant)" },
      { value: "Orbitron", text: "Orbitron (Sci-Fi)" },
      { value: "Dancing Script", text: "Dancing Script (Cursive)" },
      { value: "Amatic SC", text: "Amatic SC (Handwritten)" },
      { value: "Comfortaa", text: "Comfortaa (Rounded)" },
      { value: "Righteous", text: "Righteous (Modern)" },
      { value: "Bangers", text: "Bangers (Comic)" },
      { value: "Press Start 2P", text: "Press Start 2P (Pixel)" },
      { value: "Audiowide", text: "Audiowide (Techno)" },
      { value: "monospace", text: "Monospace" }
    ],
    defaultValue: settings["🔍MagnifyGlass.InfoPanelFontFamily"],
    tooltip: "Font family for the info panel text.",
    onChange: (value) => {
      if (stateManager) {
        stateManager.state.settings["🔍MagnifyGlass.InfoPanelFontFamily"] = String(value);
        if (uiManager) {
          uiManager.applyStyles();
        }
      }
    }
  });
  app.ui.settings.addSetting({
    id: "🔍MagnifyGlass.InfoPanelTextColor",
    name: "🔍 [6] Panel Style: Text Color",
    type: "color",
    defaultValue: settings["🔍MagnifyGlass.InfoPanelTextColor"],
    tooltip: "Custom text color for the info panel.",
    onChange: (value) => {
      if (stateManager) {
        const strValue = String(value);
        const normalizedColor = strValue && !strValue.startsWith("#") ? `#${strValue}` : strValue;
        stateManager.state.settings["🔍MagnifyGlass.InfoPanelTextColor"] = normalizedColor;
        if (uiManager) {
          uiManager.applyStyles();
        }
      }
    }
  });
  app.ui.settings.addSetting({
    id: "🔍MagnifyGlass.InfoPanelAccentColor",
    name: "🔍 [6] Panel Style: Accent Color",
    type: "color",
    defaultValue: settings["🔍MagnifyGlass.InfoPanelAccentColor"],
    tooltip: "Custom accent color for the info panel.",
    onChange: (value) => {
      if (stateManager) {
        const strValue = String(value);
        const normalizedColor = strValue && !strValue.startsWith("#") ? `#${strValue}` : strValue;
        stateManager.state.settings["🔍MagnifyGlass.InfoPanelAccentColor"] = normalizedColor;
        if (uiManager) {
          uiManager.applyStyles();
        }
      }
    }
  });
  app.ui.settings.addSetting({
    id: "🔍MagnifyGlass.HighContrastText",
    name: "🔍 [6] Panel Style: High Contrast Text",
    type: "boolean",
    defaultValue: settings["🔍MagnifyGlass.HighContrastText"] ?? false,
    tooltip: "Increase contrast for text in input fields for better legibility.",
    onChange: (value) => {
      if (stateManager) {
        stateManager.state.settings["🔍MagnifyGlass.HighContrastText"] = !!value;
        if (uiManager) {
          uiManager.applyStyles();
        }
      }
    }
  });
}
export {
  registerPanelSettings
};
