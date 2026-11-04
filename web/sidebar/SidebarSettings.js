import { GLASS_SHAPES, GLASS_POSITIONS, ACTIVATION_KEYS, RESET_KEYS, TOGGLE_FOLLOW_KEYS, DIRECT_CAPTURE_KEYS, PANEL_POSITIONS } from "../shared/constants.js";
import { setSettingValue, getSettingValue } from "../shared/utils.js";
import { DEFAULT_SETTINGS } from "../shared/settings/defaults.js";
import { resetAllSettings } from "../shared/settings/reset.js";
function settingValue(id) {
  return getSettingValue(id, DEFAULT_SETTINGS[id]);
}
function createSlider(label, value, min, max, step, unit, onChange, tooltip, onInput) {
  const row = document.createElement("div");
  row.className = "magnify-control-row";
  if (tooltip) row.title = tooltip;
  const sliderId = `magnify-slider-${Math.random().toString(36).substr(2, 9)}`;
  const labelRow = document.createElement("div");
  labelRow.className = "magnify-control-label-row";
  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  labelEl.htmlFor = sliderId;
  const valueEl = document.createElement("span");
  valueEl.className = "control-value";
  valueEl.textContent = `${value}${unit}`;
  labelRow.appendChild(labelEl);
  labelRow.appendChild(valueEl);
  const slider = document.createElement("input");
  slider.type = "range";
  slider.id = sliderId;
  slider.className = "magnify-slider";
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.value = String(value);
  slider.setAttribute("aria-valuetext", `${value}${unit}`);
  slider.addEventListener("mousedown", (e) => e.stopPropagation());
  slider.addEventListener("touchstart", (e) => e.stopPropagation());
  slider.addEventListener("pointerdown", (e) => e.stopPropagation());
  slider.addEventListener("input", (e) => {
    e.stopPropagation();
    const newValue = parseFloat(slider.value);
    valueEl.textContent = `${newValue}${unit}`;
    slider.setAttribute("aria-valuetext", `${newValue}${unit}`);
    if (onInput) onInput(newValue);
  });
  slider.addEventListener("change", (e) => {
    e.stopPropagation();
    const newValue = parseFloat(slider.value);
    onChange(newValue);
  });
  row.appendChild(labelRow);
  row.appendChild(slider);
  return row;
}
function createToggle(label, checked, onChange, tooltip) {
  const row = document.createElement("div");
  row.className = "magnify-toggle-row";
  if (tooltip) row.title = tooltip;
  const toggleId = `magnify-toggle-${Math.random().toString(36).substr(2, 9)}`;
  const labelId = `${toggleId}-label`;
  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  labelEl.id = labelId;
  labelEl.style.cursor = "pointer";
  const toggle = document.createElement("div");
  toggle.className = `magnify-toggle${checked ? " active" : ""}`;
  toggle.id = toggleId;
  toggle.setAttribute("role", "switch");
  toggle.setAttribute("aria-checked", String(checked));
  toggle.setAttribute("aria-labelledby", labelId);
  toggle.tabIndex = 0;
  const handleToggle = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const isActive = toggle.classList.toggle("active");
    toggle.setAttribute("aria-checked", String(isActive));
    onChange(isActive);
  };
  toggle.addEventListener("click", handleToggle);
  labelEl.addEventListener("click", handleToggle);
  toggle.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      handleToggle(e);
    }
  });
  row.appendChild(labelEl);
  row.appendChild(toggle);
  return row;
}
function createSelect(label, value, options, onChange, tooltip, onInput) {
  const row = document.createElement("div");
  row.className = "magnify-control-row";
  if (tooltip) row.title = tooltip;
  const selectId = `magnify-select-${Math.random().toString(36).substr(2, 9)}`;
  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  labelEl.htmlFor = selectId;
  const select = document.createElement("select");
  select.id = selectId;
  select.className = "magnify-select";
  options.forEach((opt) => {
    const option = document.createElement("option");
    option.value = opt;
    option.textContent = opt;
    if (opt === value) option.selected = true;
    select.appendChild(option);
  });
  select.addEventListener("change", () => {
    if (onInput) {
      onInput(select.value);
    }
    onChange(select.value);
  });
  row.appendChild(labelEl);
  row.appendChild(select);
  return row;
}
function createColorPicker(label, value, onChange, tooltip, onInput) {
  const row = document.createElement("div");
  row.className = "magnify-control-row magnify-color-row";
  if (tooltip) row.title = tooltip;
  const colorId = `magnify-color-${Math.random().toString(36).substr(2, 9)}`;
  const labelEl = document.createElement("label");
  labelEl.textContent = label;
  labelEl.htmlFor = colorId;
  const colorWrapper = document.createElement("div");
  colorWrapper.className = "magnify-color-wrapper";
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.id = colorId;
  colorInput.className = "magnify-color-input";
  colorInput.value = value;
  const colorPreview = document.createElement("input");
  colorPreview.type = "text";
  colorPreview.className = "magnify-color-preview";
  colorPreview.value = value;
  colorPreview.maxLength = 7;
  colorPreview.setAttribute("aria-label", `Hex code for ${label}`);
  colorPreview.addEventListener("keydown", (e) => e.stopPropagation());
  colorPreview.addEventListener("focus", () => colorPreview.select());
  const updateFromText = () => {
    let val = colorPreview.value;
    if (!val.startsWith("#") && /^[0-9A-Fa-f]{6}$/.test(val)) {
      val = "#" + val;
    }
    if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
      colorPreview.value = val;
      colorInput.value = val;
      if (onInput) onInput(val);
      onChange(val);
    } else {
      colorPreview.value = colorInput.value;
    }
  };
  colorPreview.addEventListener("change", updateFromText);
  colorInput.addEventListener("input", () => {
    colorPreview.value = colorInput.value;
    if (onInput) onInput(colorInput.value);
  });
  colorInput.addEventListener("change", () => {
    onChange(colorInput.value);
  });
  colorWrapper.appendChild(colorInput);
  colorWrapper.appendChild(colorPreview);
  row.appendChild(labelEl);
  row.appendChild(colorWrapper);
  return row;
}
function createSection(title) {
  const section = document.createElement("div");
  section.className = "magnify-sidebar-section";
  const sectionId = `magnify-section-${Math.random().toString(36).substr(2, 9)}`;
  const headerId = `${sectionId}-header`;
  const bodyId = `${sectionId}-body`;
  const header = document.createElement("button");
  header.type = "button";
  header.id = headerId;
  header.className = "magnify-sidebar-section-header";
  header.setAttribute("aria-expanded", "false");
  header.setAttribute("aria-controls", bodyId);
  const chevron = document.createElement("i");
  chevron.className = "pi pi-chevron-down";
  chevron.setAttribute("aria-hidden", "true");
  header.append(chevron, title);
  const body = document.createElement("div");
  body.className = "magnify-sidebar-section-body";
  body.id = bodyId;
  body.hidden = true;
  body.setAttribute("role", "region");
  body.setAttribute("aria-labelledby", headerId);
  header.addEventListener("click", () => {
    body.hidden = !body.hidden;
    header.setAttribute("aria-expanded", String(!body.hidden));
  });
  section.append(header, body);
  return { section, body };
}
function renderSettingsPanel(container) {
  const activationKey = settingValue("🔍MagnifyGlass.ActivationKey").toUpperCase();
  const resetKey = settingValue("🔍MagnifyGlass.ResetKey").toUpperCase();
  const toggleFollowKey = settingValue("🔍MagnifyGlass.ToggleFollowCursorKey").toUpperCase();
  const inspectorEnabled = settingValue("🔍MagnifyGlass.InfoPanelEnabled");
  const inspectorToggle = createToggle(
    "Inspector panel",
    inspectorEnabled,
    (checked) => {
      setSettingValue("🔍MagnifyGlass.InfoPanelEnabled", checked);
      panelSection.section.hidden = !checked;
      panelHotkeySection.section.hidden = !checked;
    },
    "Show the Inspector panel with node details next to the glass. Off: glass only."
  );
  inspectorToggle.classList.add("magnify-inspector-toggle");
  container.appendChild(inspectorToggle);
  const glassSection = createSection("Glass Settings");
  glassSection.body.appendChild(createSlider(
    "Zoom Factor",
    settingValue("🔍MagnifyGlass.ZoomFactor"),
    100,
    1e3,
    25,
    "%",
    (value) => setSettingValue("🔍MagnifyGlass.ZoomFactor", value),
    "Magnification level of the glass (100-1000%)",
    (value) => {
      const mg = window.comfyUIMagnifyGlass;
      if (mg == null ? void 0 : mg.config) {
        mg.config.zoomFactor = value / 100;
        if (mg.state.active) mg.updateMagnifiedView();
      }
    }
  ));
  glassSection.body.appendChild(createSlider(
    "Glass Size",
    settingValue("🔍MagnifyGlass.GlassSize"),
    50,
    500,
    10,
    "px",
    (value) => setSettingValue("🔍MagnifyGlass.GlassSize", value),
    "Size of the magnifying glass in pixels",
    (value) => {
      const mg = window.comfyUIMagnifyGlass;
      if (mg == null ? void 0 : mg.config) {
        mg.config.glassSize = value;
        mg.applyUiChanges();
        if (mg.state.active) mg.updateMagnifiedView();
      }
    }
  ));
  glassSection.body.appendChild(createSelect(
    "Shape",
    settingValue("🔍MagnifyGlass.GlassShape"),
    GLASS_SHAPES,
    (value) => setSettingValue("🔍MagnifyGlass.GlassShape", value),
    "Shape of the magnifying glass"
  ));
  glassSection.body.appendChild(createSelect(
    "Position",
    settingValue("🔍MagnifyGlass.GlassPosition"),
    GLASS_POSITIONS,
    (value) => setSettingValue("🔍MagnifyGlass.GlassPosition", value),
    "Position of the glass relative to the cursor"
  ));
  glassSection.body.appendChild(createSelect(
    "Filtering",
    settingValue("🔍MagnifyGlass.TextureFiltering"),
    ["Linear", "Nearest"],
    (value) => setSettingValue("🔍MagnifyGlass.TextureFiltering", value),
    "Texture filtering: Linear (smooth) or Nearest (pixelated)"
  ));
  glassSection.body.appendChild(createSlider(
    "Border Width",
    settingValue("🔍MagnifyGlass.BorderWidth"),
    0,
    10,
    0.5,
    "px",
    (value) => setSettingValue("🔍MagnifyGlass.BorderWidth", value),
    "Width of the glass border in pixels",
    (value) => {
      const mg = window.comfyUIMagnifyGlass;
      if (mg == null ? void 0 : mg.config) {
        mg.config.borderWidth = value;
        mg.applyUiChanges();
      }
    }
  ));
  glassSection.body.appendChild(createColorPicker(
    "Border Color",
    settingValue("🔍MagnifyGlass.BorderColor"),
    (value) => setSettingValue("🔍MagnifyGlass.BorderColor", value),
    "Color of the glass border",
    (value) => {
      const mg = window.comfyUIMagnifyGlass;
      if (mg == null ? void 0 : mg.config) {
        mg.config.borderColor = value;
        mg.applyUiChanges();
      }
    }
  ));
  glassSection.body.appendChild(createToggle(
    "Show Border",
    settingValue("🔍MagnifyGlass.BorderEnabled"),
    (checked) => setSettingValue("🔍MagnifyGlass.BorderEnabled", checked),
    "Show or hide the glass border"
  ));
  glassSection.body.appendChild(createToggle(
    "Follow Cursor",
    settingValue("🔍MagnifyGlass.FollowCursor"),
    (checked) => setSettingValue("🔍MagnifyGlass.FollowCursor", checked),
    `Glass follows the cursor. Hotkey: ${toggleFollowKey}`
  ));
  glassSection.body.appendChild(createToggle(
    "Always Active Mode",
    settingValue("🔍MagnifyGlass.AlwaysActiveMode"),
    (checked) => setSettingValue("🔍MagnifyGlass.AlwaysActiveMode", checked),
    `When enabled, glass stays visible. Toggle with ${activationKey}`
  ));
  glassSection.body.appendChild(createToggle(
    "Force Direct Capture",
    settingValue("🔍MagnifyGlass.ForceDirectCapture"),
    (checked) => setSettingValue("🔍MagnifyGlass.ForceDirectCapture", checked),
    `Force Direct Capture mode (accurate, pixel-perfect). Hotkey: ${settingValue("🔍MagnifyGlass.ForceDirectCaptureKey").toUpperCase()}`
  ));
  glassSection.body.appendChild(createToggle(
    "Show Mini Cursor",
    settingValue("🔍MagnifyGlass.ShowCursorPreview"),
    (checked) => setSettingValue("🔍MagnifyGlass.ShowCursorPreview", checked),
    "Display a mini cursor in the glass preview"
  ));
  container.appendChild(glassSection.section);
  const hotkeySection = createSection("Glass Hotkeys");
  hotkeySection.body.appendChild(createSelect(
    "Activation Key",
    settingValue("🔍MagnifyGlass.ActivationKey"),
    ACTIVATION_KEYS,
    (value) => setSettingValue("🔍MagnifyGlass.ActivationKey", value),
    "Key to toggle or hold to activate the magnifying glass"
  ));
  hotkeySection.body.appendChild(createSelect(
    "Reset Key",
    settingValue("🔍MagnifyGlass.ResetKey"),
    RESET_KEYS,
    (value) => setSettingValue("🔍MagnifyGlass.ResetKey", value),
    "Key to reset glass position and disable follow cursor"
  ));
  hotkeySection.body.appendChild(createSelect(
    "Toggle Follow Key",
    settingValue("🔍MagnifyGlass.ToggleFollowCursorKey"),
    TOGGLE_FOLLOW_KEYS,
    (value) => setSettingValue("🔍MagnifyGlass.ToggleFollowCursorKey", value),
    "Key to toggle follow cursor mode"
  ));
  hotkeySection.body.appendChild(createSelect(
    "Direct Capture Key",
    settingValue("🔍MagnifyGlass.ForceDirectCaptureKey"),
    DIRECT_CAPTURE_KEYS,
    (value) => setSettingValue("🔍MagnifyGlass.ForceDirectCaptureKey", value),
    "Key for Force Direct Capture mode"
  ));
  hotkeySection.body.appendChild(createSelect(
    "Glass Toggle Key",
    settingValue("🔍MagnifyGlass.GlassPreviewToggleHotkey"),
    ["g", "f", "v", "b"],
    (value) => setSettingValue("🔍MagnifyGlass.GlassPreviewToggleHotkey", value),
    "Key to show or hide the glass preview"
  ));
  const glassAltToggle = createToggle(
    "Require Alt Key",
    settingValue("🔍MagnifyGlass.AltRequired"),
    (checked) => {
      setSettingValue("🔍MagnifyGlass.AltRequired", checked);
      container.querySelectorAll(".magnify-alt-toggle .magnify-toggle").forEach((t) => {
        if (checked) t.classList.add("active");
        else t.classList.remove("active");
        t.setAttribute("aria-checked", String(checked));
      });
    },
    "Require Alt key to be held with activation key"
  );
  glassAltToggle.classList.add("magnify-alt-toggle");
  hotkeySection.body.appendChild(glassAltToggle);
  hotkeySection.body.appendChild(createSlider(
    "Offset Step",
    settingValue("🔍MagnifyGlass.OffsetStep"),
    1,
    50,
    1,
    "px",
    (value) => setSettingValue("🔍MagnifyGlass.OffsetStep", value),
    "Amount to move glass per arrow key press (pixels)"
  ));
  container.appendChild(hotkeySection.section);
  const accessibilitySection = createSection("Accessibility");
  accessibilitySection.body.appendChild(createToggle(
    "Enable Accessibility",
    settingValue("🔍MagnifyGlass.AccessibilityEnabled"),
    (checked) => {
      setSettingValue("🔍MagnifyGlass.AccessibilityEnabled", checked);
      const mg = window.comfyUIMagnifyGlass;
      if (mg == null ? void 0 : mg.config) {
        mg.config.accessibilityEnabled = checked;
        if (mg.state.active) mg.updateMagnifiedView();
      }
    },
    "Enable accessibility enhancements for the glass preview"
  ));
  accessibilitySection.body.appendChild(createToggle(
    "High Contrast",
    settingValue("🔍MagnifyGlass.HighContrastMode"),
    (checked) => {
      setSettingValue("🔍MagnifyGlass.HighContrastMode", checked);
      const mg = window.comfyUIMagnifyGlass;
      if (mg == null ? void 0 : mg.config) {
        mg.config.highContrastMode = checked;
        if (mg.state.active) mg.updateMagnifiedView();
      }
    },
    "Boost text contrast with bright colors"
  ));
  accessibilitySection.body.appendChild(createToggle(
    "Text Glow",
    settingValue("🔍MagnifyGlass.TextGlowEnabled"),
    (checked) => {
      setSettingValue("🔍MagnifyGlass.TextGlowEnabled", checked);
      const mg = window.comfyUIMagnifyGlass;
      if (mg == null ? void 0 : mg.config) {
        mg.config.textGlowEnabled = checked;
        if (mg.state.active) mg.updateMagnifiedView();
      }
    },
    "Add glow effect behind text"
  ));
  accessibilitySection.body.appendChild(createColorPicker(
    "Glow Color",
    settingValue("🔍MagnifyGlass.TextGlowColor"),
    (value) => {
      setSettingValue("🔍MagnifyGlass.TextGlowColor", value);
      const mg = window.comfyUIMagnifyGlass;
      if (mg == null ? void 0 : mg.config) {
        mg.config.textGlowColor = value;
        if (mg.state.active) mg.updateMagnifiedView();
      }
    },
    "Color of the text glow"
  ));
  accessibilitySection.body.appendChild(createSlider(
    "Glow Intensity",
    settingValue("🔍MagnifyGlass.TextGlowIntensity"),
    1,
    15,
    1,
    "px",
    (value) => setSettingValue("🔍MagnifyGlass.TextGlowIntensity", value),
    "Blur radius of the text glow",
    (value) => {
      const mg = window.comfyUIMagnifyGlass;
      if (mg == null ? void 0 : mg.config) {
        mg.config.textGlowIntensity = value;
        if (mg.state.active) mg.updateMagnifiedView();
      }
    }
  ));
  accessibilitySection.body.appendChild(createSlider(
    "Font Scale",
    settingValue("🔍MagnifyGlass.FontScaleFactor"),
    100,
    200,
    10,
    "%",
    (value) => setSettingValue("🔍MagnifyGlass.FontScaleFactor", value),
    "Increase text size in the glass",
    (value) => {
      const mg = window.comfyUIMagnifyGlass;
      if (mg == null ? void 0 : mg.config) {
        mg.config.fontScaleFactor = value;
        if (mg.state.active) mg.updateMagnifiedView();
      }
    }
  ));
  accessibilitySection.body.appendChild(createToggle(
    "Bold Text",
    settingValue("🔍MagnifyGlass.BoldTextEnabled"),
    (checked) => {
      setSettingValue("🔍MagnifyGlass.BoldTextEnabled", checked);
      const mg = window.comfyUIMagnifyGlass;
      if (mg == null ? void 0 : mg.config) {
        mg.config.boldTextEnabled = checked;
        if (mg.state.active) mg.updateMagnifiedView();
      }
    },
    "Force bold text weight"
  ));
  accessibilitySection.body.appendChild(createToggle(
    "Text Outline",
    settingValue("🔍MagnifyGlass.TextOutlineEnabled"),
    (checked) => {
      setSettingValue("🔍MagnifyGlass.TextOutlineEnabled", checked);
      const mg = window.comfyUIMagnifyGlass;
      if (mg == null ? void 0 : mg.config) {
        mg.config.textOutlineEnabled = checked;
        if (mg.state.active) mg.updateMagnifiedView();
      }
    },
    "Add outline execution around text"
  ));
  accessibilitySection.body.appendChild(createColorPicker(
    "Outline Color",
    settingValue("🔍MagnifyGlass.TextOutlineColor"),
    (value) => {
      setSettingValue("🔍MagnifyGlass.TextOutlineColor", value);
      const mg = window.comfyUIMagnifyGlass;
      if (mg == null ? void 0 : mg.config) {
        mg.config.textOutlineColor = value;
        if (mg.state.active) mg.updateMagnifiedView();
      }
    },
    "Color of the text outline"
  ));
  accessibilitySection.body.appendChild(createToggle(
    "Node Emphasis",
    settingValue("🔍MagnifyGlass.NodeTitleEmphasis"),
    (checked) => {
      setSettingValue("🔍MagnifyGlass.NodeTitleEmphasis", checked);
      const mg = window.comfyUIMagnifyGlass;
      if (mg == null ? void 0 : mg.config) {
        mg.config.nodeTitleEmphasis = checked;
        if (mg.state.active) mg.updateMagnifiedView();
      }
    },
    "Extra styling for node titles"
  ));
  accessibilitySection.body.appendChild(createToggle(
    "Invert Colors",
    settingValue("🔍MagnifyGlass.InvertColors"),
    (checked) => {
      setSettingValue("🔍MagnifyGlass.InvertColors", checked);
      const mg = window.comfyUIMagnifyGlass;
      if (mg == null ? void 0 : mg.config) {
        mg.config.invertColors = checked;
        if (mg.state.active) mg.updateMagnifiedView();
      }
    },
    "Invert all colors in the glass view"
  ));
  accessibilitySection.body.appendChild(createToggle(
    "Grayscale Mode",
    settingValue("🔍MagnifyGlass.GrayscaleMode"),
    (checked) => {
      setSettingValue("🔍MagnifyGlass.GrayscaleMode", checked);
      const mg = window.comfyUIMagnifyGlass;
      if (mg == null ? void 0 : mg.config) {
        mg.config.grayscaleMode = checked;
        if (mg.state.active) mg.updateMagnifiedView();
      }
    },
    "Remove all color saturation"
  ));
  accessibilitySection.body.appendChild(createToggle(
    "Reduce Motion",
    settingValue("🔍MagnifyGlass.ReduceMotion"),
    (checked) => {
      setSettingValue("🔍MagnifyGlass.ReduceMotion", checked);
      const mg = window.comfyUIMagnifyGlass;
      if (mg == null ? void 0 : mg.config) {
        mg.config.reduceMotion = checked;
        if (mg.ui) mg.ui.applyStyles();
      }
    },
    "Disable smooth animations"
  ));
  container.appendChild(accessibilitySection.section);
  const panelSection = createSection("Info Panel");
  panelSection.section.hidden = !inspectorEnabled;
  panelSection.body.appendChild(createToggle(
    "Persist Info",
    settingValue("🔍MagnifyGlass.InfoPanelPersist"),
    (checked) => {
      setSettingValue("🔍MagnifyGlass.InfoPanelPersist", checked);
      const infoPanel = window.infoPanelManager;
      if (infoPanel == null ? void 0 : infoPanel.uiManager) {
        infoPanel.uiManager.updateControlStates();
      }
    },
    "Keep displaying the last node info when hovering empty space"
  ));
  panelSection.body.appendChild(createToggle(
    "Node Highlight Border",
    settingValue("🔍MagnifyGlass.NodeHighlightEnabled"),
    (checked) => {
      setSettingValue("🔍MagnifyGlass.NodeHighlightEnabled", checked);
      const app = window.app;
      if (app && app.canvas) {
        app.canvas.setDirty(true, true);
      }
    },
    "Show a blue highlight border around the currently inspected node"
  ));
  panelSection.body.appendChild(createSelect(
    "Position",
    settingValue("🔍MagnifyGlass.InfoPanelPosition"),
    PANEL_POSITIONS,
    (value) => setSettingValue("🔍MagnifyGlass.InfoPanelPosition", value),
    "Position of the info panel relative to the glass"
  ));
  panelSection.body.appendChild(createSlider(
    "Width",
    settingValue("🔍MagnifyGlass.InfoPanelWidth"),
    200,
    600,
    20,
    "px",
    (value) => setSettingValue("🔍MagnifyGlass.InfoPanelWidth", value),
    "Width of the info panel",
    (value) => {
      var _a, _b;
      const infoPanel = window.infoPanelManager;
      if ((_b = (_a = infoPanel == null ? void 0 : infoPanel.stateManager) == null ? void 0 : _a.state) == null ? void 0 : _b.settings) {
        infoPanel.stateManager.state.settings["🔍MagnifyGlass.InfoPanelWidth"] = value;
        infoPanel.uiManager.applyStyles();
        if (infoPanel.magnifyGlass.state.active) {
          infoPanel.uiManager.show();
          infoPanel.positionManager.positionPanel();
        }
      }
    }
  ));
  panelSection.body.appendChild(createSlider(
    "Max Height",
    settingValue("🔍MagnifyGlass.InfoPanelMaxHeight"),
    200,
    1500,
    50,
    "px",
    (value) => setSettingValue("🔍MagnifyGlass.InfoPanelMaxHeight", value),
    "Maximum height of the info panel",
    (value) => {
      var _a, _b;
      const infoPanel = window.infoPanelManager;
      if ((_b = (_a = infoPanel == null ? void 0 : infoPanel.stateManager) == null ? void 0 : _a.state) == null ? void 0 : _b.settings) {
        infoPanel.stateManager.state.settings["🔍MagnifyGlass.InfoPanelMaxHeight"] = value;
        infoPanel.uiManager.applyStyles();
        if (infoPanel.magnifyGlass.state.active) {
          infoPanel.uiManager.show();
          infoPanel.positionManager.positionPanel();
        }
      }
    }
  ));
  panelSection.body.appendChild(createSlider(
    "Font Size",
    settingValue("🔍MagnifyGlass.InfoPanelFontSize"),
    8,
    24,
    1,
    "px",
    (value) => setSettingValue("🔍MagnifyGlass.InfoPanelFontSize", value),
    "Font size of text in the info panel",
    (value) => {
      var _a, _b;
      const infoPanel = window.infoPanelManager;
      if ((_b = (_a = infoPanel == null ? void 0 : infoPanel.stateManager) == null ? void 0 : _a.state) == null ? void 0 : _b.settings) {
        infoPanel.stateManager.state.settings["🔍MagnifyGlass.InfoPanelFontSize"] = value;
        infoPanel.uiManager.applyStyles();
      }
    }
  ));
  panelSection.body.appendChild(createSlider(
    "Opacity",
    settingValue("🔍MagnifyGlass.InfoPanelOpacity"),
    10,
    100,
    5,
    "%",
    (value) => setSettingValue("🔍MagnifyGlass.InfoPanelOpacity", value),
    "Background opacity of the info panel",
    (value) => {
      var _a, _b;
      const infoPanel = window.infoPanelManager;
      if ((_b = (_a = infoPanel == null ? void 0 : infoPanel.stateManager) == null ? void 0 : _a.state) == null ? void 0 : _b.settings) {
        infoPanel.stateManager.state.settings["🔍MagnifyGlass.InfoPanelOpacity"] = value;
        infoPanel.uiManager.applyStyles();
      }
    }
  ));
  const fontFamilyOptions = [
    "System Default",
    "Inter",
    "Roboto",
    "JetBrains Mono",
    "Fira Code",
    "IBM Plex Sans",
    "Space Grotesk",
    "Lexend",
    "Outfit",
    "Cinzel",
    "Playfair Display",
    "Orbitron",
    "Dancing Script",
    "Amatic SC",
    "Comfortaa",
    "Righteous",
    "Bangers",
    "Press Start 2P",
    "Audiowide",
    "monospace"
  ];
  panelSection.body.appendChild(createSelect(
    "Font Family",
    settingValue("🔍MagnifyGlass.InfoPanelFontFamily"),
    fontFamilyOptions,
    (value) => setSettingValue("🔍MagnifyGlass.InfoPanelFontFamily", value),
    "Font family for the info panel text",
    (value) => {
      var _a, _b;
      const infoPanel = window.infoPanelManager;
      if ((_b = (_a = infoPanel == null ? void 0 : infoPanel.stateManager) == null ? void 0 : _a.state) == null ? void 0 : _b.settings) {
        infoPanel.stateManager.state.settings["🔍MagnifyGlass.InfoPanelFontFamily"] = value;
        infoPanel.uiManager.applyStyles();
      }
    }
  ));
  panelSection.body.appendChild(createColorPicker(
    "Text Color",
    settingValue("🔍MagnifyGlass.InfoPanelTextColor"),
    (value) => setSettingValue("🔍MagnifyGlass.InfoPanelTextColor", value),
    "Text color in the info panel",
    (value) => {
      var _a, _b;
      const infoPanel = window.infoPanelManager;
      if ((_b = (_a = infoPanel == null ? void 0 : infoPanel.stateManager) == null ? void 0 : _a.state) == null ? void 0 : _b.settings) {
        infoPanel.stateManager.state.settings["🔍MagnifyGlass.InfoPanelTextColor"] = value;
        infoPanel.uiManager.applyStyles();
      }
    }
  ));
  panelSection.body.appendChild(createColorPicker(
    "Accent Color",
    settingValue("🔍MagnifyGlass.InfoPanelAccentColor"),
    (value) => setSettingValue("🔍MagnifyGlass.InfoPanelAccentColor", value),
    "Accent color for highlights",
    (value) => {
      var _a, _b;
      const infoPanel = window.infoPanelManager;
      if ((_b = (_a = infoPanel == null ? void 0 : infoPanel.stateManager) == null ? void 0 : _a.state) == null ? void 0 : _b.settings) {
        infoPanel.stateManager.state.settings["🔍MagnifyGlass.InfoPanelAccentColor"] = value;
        infoPanel.uiManager.applyStyles();
      }
    }
  ));
  panelSection.body.appendChild(createToggle(
    "High Contrast Text",
    settingValue("🔍MagnifyGlass.HighContrastText"),
    (checked) => {
      var _a, _b;
      setSettingValue("🔍MagnifyGlass.HighContrastText", checked);
      const infoPanel = window.infoPanelManager;
      if ((_b = (_a = infoPanel == null ? void 0 : infoPanel.stateManager) == null ? void 0 : _a.state) == null ? void 0 : _b.settings) {
        infoPanel.stateManager.state.settings["🔍MagnifyGlass.HighContrastText"] = checked;
        infoPanel.uiManager.applyStyles();
      }
    },
    "Increase text contrast for easier reading"
  ));
  panelSection.body.appendChild(createToggle(
    "Hover Controls",
    settingValue("🔍MagnifyGlass.ShowHoveringControls"),
    (checked) => setSettingValue("🔍MagnifyGlass.ShowHoveringControls", checked),
    "Show floating control buttons near the panel"
  ));
  panelSection.body.appendChild(createSelect(
    "Controls Position",
    settingValue("🔍MagnifyGlass.ControlsPosition"),
    ["top", "bottom", "left", "right", "top-left", "top-right", "bottom-left", "bottom-right"],
    (value) => setSettingValue("🔍MagnifyGlass.ControlsPosition", value),
    "Position of floating control buttons",
    (value) => {
      var _a, _b;
      const infoPanel = window.infoPanelManager;
      if ((_b = (_a = infoPanel == null ? void 0 : infoPanel.stateManager) == null ? void 0 : _a.state) == null ? void 0 : _b.settings) {
        infoPanel.stateManager.state.settings["🔍MagnifyGlass.ControlsPosition"] = value;
        infoPanel.uiManager.updateControlsLayout(value);
        if (infoPanel.magnifyGlass.state.active) {
          infoPanel.positionManager.positionFloatingControls(infoPanel.uiManager.elements.controls);
        }
      }
    }
  ));
  container.appendChild(panelSection.section);
  const panelHotkeySection = createSection("Panel Hotkeys");
  panelHotkeySection.section.hidden = !inspectorEnabled;
  panelHotkeySection.body.appendChild(createSelect(
    "Toggle Key",
    settingValue("🔍MagnifyGlass.ToggleHotkey"),
    ["i", "j", "k", "l", "n", "m"],
    (value) => setSettingValue("🔍MagnifyGlass.ToggleHotkey", value),
    "Key to toggle info panel visibility"
  ));
  panelHotkeySection.body.appendChild(createSelect(
    "Pin Key",
    settingValue("🔍MagnifyGlass.PinPanelHotkey"),
    ["u", "p", "y", "t"],
    (value) => setSettingValue("🔍MagnifyGlass.PinPanelHotkey", value),
    "Key to pin/unpin the info panel position"
  ));
  const panelAltToggle = createToggle(
    "Require Alt Key",
    settingValue("🔍MagnifyGlass.AltRequired"),
    (checked) => {
      setSettingValue("🔍MagnifyGlass.AltRequired", checked);
      container.querySelectorAll(".magnify-alt-toggle .magnify-toggle").forEach((t) => {
        if (checked) t.classList.add("active");
        else t.classList.remove("active");
        t.setAttribute("aria-checked", String(checked));
      });
    },
    "Require Alt key to be held with hotkeys"
  );
  panelAltToggle.classList.add("magnify-alt-toggle");
  panelHotkeySection.body.appendChild(panelAltToggle);
  container.appendChild(panelHotkeySection.section);
  const buttonRow = document.createElement("div");
  buttonRow.className = "magnify-sidebar-actions";
  const resetBtn = createButton("Reset Position", `Reset glass position and disable follow cursor. Hotkey: ${resetKey}`);
  resetBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const magnifyGlass = window.comfyUIMagnifyGlass;
    if (magnifyGlass) {
      magnifyGlass.resetOffsets();
      const followToggles = container.querySelectorAll(".magnify-toggle-row");
      followToggles.forEach((row) => {
        const label = row.querySelector("label");
        if (label && label.textContent === "Follow Cursor") {
          const toggle = row.querySelector(".magnify-toggle");
          if (toggle) {
            toggle.classList.remove("active");
            toggle.setAttribute("aria-checked", "false");
          }
        }
      });
    }
  });
  const resetAllBtn = createButton("Reset All Settings", "Reset all settings to their default values");
  resetAllBtn.classList.add("magnify-btn-secondary");
  resetAllBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!confirm("Reset all MagnifyGlass settings to defaults?")) {
      return;
    }
    resetAllSettings();
    const infoPanel = window.infoPanelManager;
    if (infoPanel) {
      const controlsPosition = DEFAULT_SETTINGS["🔍MagnifyGlass.ControlsPosition"];
      infoPanel.stateManager.state.settings["🔍MagnifyGlass.ControlsPosition"] = controlsPosition;
      infoPanel.uiManager.updateControlsLayout(controlsPosition);
      if (infoPanel.magnifyGlass.state.active) {
        infoPanel.positionManager.positionFloatingControls(infoPanel.uiManager.elements.controls);
      }
    }
    container.innerHTML = "";
    renderSettingsPanel(container);
  });
  buttonRow.append(resetBtn, resetAllBtn);
  container.appendChild(buttonRow);
}
function createButton(text, title) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "magnify-btn";
  button.title = title;
  const icon = document.createElement("i");
  icon.className = "pi pi-refresh";
  icon.setAttribute("aria-hidden", "true");
  button.append(icon, text);
  return button;
}
export {
  createColorPicker,
  createSelect,
  createSlider,
  createToggle,
  renderSettingsPanel
};
