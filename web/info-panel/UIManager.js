var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { Icons } from "../shared/icons.js";
import { Logger } from "../shared/logger.js";
import { INFO_PANEL_ID } from "../shared/constants.js";
import { escapeHtml } from "../shared/utils.js";
import { formatValue, getValueClass, getValueAttributes, formatWidgetValue } from "./ValueFormatter.js";
import { getCheckpointInfo, getImageInfo, getTextBoxContent, getImportantNodeParameters } from "./NodeDataExtractor.js";
import { NodeSelector } from "./NodeSelector.js";
import { WidgetSyncManager } from "./widget-editors/WidgetSyncManager.js";
import { WidgetEditorFactory } from "./widget-editors/WidgetEditorFactory.js";
import { InlineControlFactory } from "./widget-editors/InlineControlFactory.js";
import { DragValueController } from "./widget-editors/DragValueController.js";
class UIManager {
  constructor(stateManager) {
    __publicField(this, "stateManager");
    __publicField(this, "elements");
    __publicField(this, "nodeSelector");
    __publicField(this, "currentDropdown", null);
    __publicField(this, "currentDropdownCleanup", null);
    __publicField(this, "onNodeSelected", null);
    // Track active widget editors for cleanup
    __publicField(this, "activeEditors", /* @__PURE__ */ new Map());
    // Track active inline controls for cleanup
    __publicField(this, "activeInlineControls", /* @__PURE__ */ new Map());
    // Track active drag controllers for cleanup
    __publicField(this, "activeDragControllers", /* @__PURE__ */ new Map());
    this.stateManager = stateManager;
    this.elements = {
      panel: null,
      header: null,
      content: null,
      controls: null
    };
    this.nodeSelector = new NodeSelector();
    this.createPanel();
    this.injectStyles();
  }
  /**
   * Create the main panel and its components.
   */
  createPanel() {
    this.elements.panel = document.createElement("div");
    this.elements.panel.id = INFO_PANEL_ID;
    this.elements.panel.className = `magnify-info-panel theme-${this.stateManager.state.currentTheme}`;
    this.elements.header = document.createElement("div");
    this.elements.header.className = "panel-header";
    this.elements.header.innerHTML = `
            <div class="header-content">
                <div class="header-icon">${Icons.magnifyGlass}</div>
                <div class="header-title">Inspector</div>
                <div class="header-subtitle">Real-time analysis</div>
            </div>
            <div class="header-controls">
                <button class="control-btn minimize-btn" title="Minimize Panel" aria-label="Minimize Panel" aria-expanded="true" data-action="minimize">${Icons.minus}</button>
            </div>
        `;
    this.elements.content = document.createElement("div");
    this.elements.content.className = "panel-content";
    this.elements.panel.appendChild(this.elements.header);
    this.elements.panel.appendChild(this.elements.content);
    this.applyStyles();
    if (this.stateManager.state.isPanelMinimized) {
      this.elements.panel.classList.add("panel-minimized");
      this.updateMinimizedState();
    }
    document.body.appendChild(this.elements.panel);
    let originalTop = null;
    let originalFontSize = null;
    const MARGIN = 20;
    this.elements.panel.addEventListener("mouseenter", () => {
      if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"]) {
        return;
      }
      if (!this.stateManager.state.isPanelMinimized && this.elements.panel) {
        originalTop = this.elements.panel.offsetTop;
        originalFontSize = parseFloat(getComputedStyle(this.elements.panel).fontSize);
        this.elements.panel.classList.add("is-expanded");
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (!this.elements.panel) return;
            const viewportHeight = window.innerHeight;
            const rect = this.elements.panel.getBoundingClientRect();
            if (rect.bottom > viewportHeight - MARGIN) {
              const newTop = Math.max(MARGIN, originalTop - (rect.bottom - viewportHeight + MARGIN));
              this.elements.panel.style.top = `${newTop}px`;
            }
          });
        });
      }
    });
    this.elements.panel.addEventListener("mouseleave", () => {
      if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"]) {
        return;
      }
      if (this.elements.panel) {
        this.elements.panel.classList.remove("is-expanded");
        if (originalTop !== null) {
          this.elements.panel.style.top = `${originalTop}px`;
          originalTop = null;
        }
        if (originalFontSize !== null) {
          this.elements.panel.style.fontSize = `${originalFontSize}px`;
          originalFontSize = null;
        }
        this.elements.panel.style.transform = "";
        this.elements.panel.style.transformOrigin = "";
      }
    });
    this.elements.panel.addEventListener("click", (e) => {
      const target = e.target;
      const minimizeBtn = target.closest('[data-action="minimize"]');
      if (minimizeBtn) {
        this.stateManager.state.isPanelMinimized = !this.stateManager.state.isPanelMinimized;
        this.updateMinimizedState();
        return;
      }
      const sectionHeader = target.closest(".section-header");
      if (sectionHeader) {
        const sectionId = sectionHeader.getAttribute("data-section");
        if (sectionId && sectionId !== "node") {
          const isExpanded = this.stateManager.state.expandedSections.has(sectionId);
          if (isExpanded) {
            this.stateManager.state.expandedSections.delete(sectionId);
          } else {
            this.stateManager.state.expandedSections.add(sectionId);
          }
          sectionHeader.classList.toggle("expanded", !isExpanded);
          const sectionContent = sectionHeader.nextElementSibling;
          if (sectionContent && sectionContent.classList.contains("section-content")) {
            sectionContent.classList.toggle("expanded", !isExpanded);
          }
        }
      }
    });
    if (!this.elements.controls) {
      this.createFloatingControls();
      this.updateControlStates();
    }
  }
  /**
   * Create floating control buttons.
   */
  createFloatingControls() {
    this.elements.controls = document.createElement("div");
    this.elements.controls.className = `floating-controls vertical-layout theme-${this.stateManager.state.currentTheme}`;
    this.elements.controls.innerHTML = `
            <button class="control-btn unlock-btn" title="Unlock/Lock Panel from Glass" aria-label="Unlock or Lock Panel from Glass" aria-pressed="false" data-action="pin">${Icons.unlock}</button>
            <button class="control-btn pin-btn" title="Pin/Unpin Panel Position (Prevent Drag)" aria-label="Pin or Unpin Panel Position" aria-pressed="false" data-action="lock">${Icons.pin}</button>
            <button class="control-btn persist-btn" title="Toggle Persist Mode - Sticky Info (S)" aria-label="Toggle Sticky Info" aria-pressed="false" data-action="persist">${Icons.magnet}</button>
            <button class="control-btn hold-btn" title="Hold Info - Pause/Play (P)" aria-label="Hold Info" aria-pressed="false" data-action="toggle-hold">${Icons.pause}</button>
            <button class="control-btn visibility-btn" title="Toggle Panel Visibility (I)" aria-label="Toggle Panel Visibility" aria-pressed="true" data-action="toggle-panel">${Icons.eye}</button>
            <button class="control-btn glass-btn" title="Toggle Glass Preview (G)" aria-label="Toggle Glass Preview" aria-pressed="true" data-action="toggle-glass">${Icons.magnifyGlass}</button>
            <button class="control-btn cursor-btn" title="Toggle Cursor Preview" aria-label="Toggle Cursor Preview" aria-pressed="false" data-action="toggle-cursor">${Icons.cursor}</button>
            <button class="control-btn drag-glass-btn" title="Move Glass Position (H)" aria-label="Move Glass Position" aria-pressed="false" data-action="drag-glass">${Icons.move}</button>
            <button class="control-btn reset-glass-btn" title="Reset Glass Position (O)" aria-label="Reset Glass Position" data-action="reset-glass">${Icons.reset}</button>
            <button class="control-btn popout-btn" title="Open in New Tab (Shift+P)" aria-label="Open in New Tab" aria-pressed="false" data-action="popout">${Icons.externalLink}</button>
        `;
    document.body.appendChild(this.elements.controls);
    this.elements.controls.style.display = "none";
    this.elements.controls.style.visibility = "hidden";
    this.elements.controls.style.left = "-9999px";
    this.elements.controls.style.top = "-9999px";
    this.elements.controls.addEventListener("click", (e) => {
      var _a;
      const target = e.target;
      const button = target.closest("button[data-action]");
      if (!button) return;
      const action = button.getAttribute("data-action");
      Logger.debug(`Control button clicked: ${action}`);
      switch (action) {
        case "pin":
          this.stateManager.togglePinning();
          this.updatePinnedState();
          this.updateControlStates();
          break;
        case "lock":
          this.stateManager.state.isPanelLocked = !this.stateManager.state.isPanelLocked;
          this.updateControlStates();
          if (this.elements.panel) {
            this.elements.panel.classList.toggle("panel-locked", this.stateManager.state.isPanelLocked);
          }
          break;
        case "persist":
          this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"] = !this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"];
          this.updateControlStates();
          this.applyStyles();
          break;
        case "toggle-panel":
          if (this.stateManager.state.isPanelVisible) {
            this.hide();
            if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"]) {
              this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"] = false;
              this.applyStyles();
            }
          } else {
            this.show();
          }
          this.updateControlStates();
          break;
        case "toggle-glass":
          this.stateManager.state.isGlassPreviewVisible = !this.stateManager.state.isGlassPreviewVisible;
          if (!this.stateManager.state.isGlassPreviewVisible) {
            console.log(`[MagnifyGlass Debug] Glass Hidden. pinned=${this.stateManager.state.isPanelPinned}, autoPinned=${this.stateManager.state.isAutoPinned}`);
            if (!this.stateManager.state.isPanelPinned) {
              if (this.elements.panel) {
                const rect = this.elements.panel.getBoundingClientRect();
                this.stateManager.state.pinnedPosition = { x: rect.left, y: rect.top };
              }
              this.stateManager.state.isPanelPinned = true;
              this.stateManager.state.isAutoPinned = true;
              console.log(`[MagnifyGlass Debug] Auto-Pinned panel.`);
            }
          } else {
            console.log(`[MagnifyGlass Debug] Glass Shown. pinned=${this.stateManager.state.isPanelPinned}, autoPinned=${this.stateManager.state.isAutoPinned}`);
            if (this.stateManager.state.isAutoPinned) {
              this.stateManager.state.isPanelPinned = false;
              this.stateManager.state.isAutoPinned = false;
              console.log(`[MagnifyGlass Debug] Auto-Unpinned panel.`);
            }
          }
          this.updateControlStates();
          this.updatePinnedState();
          const magnifyGlass = window.comfyUIMagnifyGlass;
          if (magnifyGlass && magnifyGlass.setGlassPreviewActive) {
            magnifyGlass.setGlassPreviewActive(this.stateManager.state.isGlassPreviewVisible);
          } else if (magnifyGlass && ((_a = magnifyGlass.ui) == null ? void 0 : _a.setPreviewVisibility)) {
            magnifyGlass.ui.setPreviewVisibility(this.stateManager.state.isGlassPreviewVisible);
          }
          break;
        case "popout":
          const glass = window.comfyUIMagnifyGlass;
          if (glass && glass.popOutManager) {
            glass.popOutManager.toggle();
          }
          break;
        case "drag-glass":
          const mglass = window.comfyUIMagnifyGlass;
          if (mglass && mglass.state) {
            mglass.state.isDragModeEnabled = !mglass.state.isDragModeEnabled;
            this.updateControlStates();
            if (mglass.ui && mglass.ui.setDragMode) {
              mglass.ui.setDragMode(mglass.state.isDragModeEnabled);
            }
          }
          break;
        case "reset-glass":
          const rglass = window.comfyUIMagnifyGlass;
          if (rglass) {
            rglass.resetOffsets();
            Logger.debug("Reset glass position via hover controls");
            if (rglass.state && rglass.state.isDragModeEnabled) {
              rglass.state.isDragModeEnabled = false;
              if (rglass.ui && rglass.ui.setDragMode) {
                rglass.ui.setDragMode(false);
              }
              this.updateControlStates();
            }
          }
          break;
        case "toggle-cursor":
          const cglass = window.comfyUIMagnifyGlass;
          if (cglass && cglass.config) {
            cglass.config.showCursorPreview = !cglass.config.showCursorPreview;
            cglass.updateMagnifiedView();
            this.updateControlStates();
          }
          break;
        case "toggle-hold":
          this.stateManager.toggleHold();
          this.updateControlStates();
          break;
      }
    });
    const controlsPosition = String(this.stateManager.state.settings["🔍MagnifyGlass.ControlsPosition"] || "top-right");
    this.updateControlsLayout(controlsPosition);
    this.updateControlStates();
  }
  /**
   * Update control button states.
   */
  updateControlStates() {
    var _a, _b, _c;
    if (!this.elements.controls) return;
    const pinBtn = this.elements.controls.querySelector('[data-action="pin"]');
    const lockBtn = this.elements.controls.querySelector('[data-action="lock"]');
    const visibilityBtn = this.elements.controls.querySelector('[data-action="toggle-panel"]');
    const glassBtn = this.elements.controls.querySelector('[data-action="toggle-glass"]');
    const isPanelVisible = this.stateManager.state.isPanelVisible;
    const isGlassVisible = this.stateManager.state.isGlassPreviewVisible;
    if (pinBtn) {
      pinBtn.classList.toggle("active", this.stateManager.state.isPanelPinned);
      pinBtn.setAttribute("aria-pressed", String(this.stateManager.state.isPanelPinned));
      pinBtn.title = this.stateManager.state.isPanelPinned ? "Lock Panel" : "Unlock Panel";
      pinBtn.innerHTML = this.stateManager.state.isPanelPinned ? Icons.lock : Icons.unlock;
      pinBtn.style.display = isPanelVisible ? "flex" : "none";
      if (!isGlassVisible) {
        pinBtn.disabled = true;
        pinBtn.style.opacity = "0.5";
        pinBtn.title = "Cannot toggle lock when glass preview is hidden";
      } else {
        pinBtn.disabled = false;
        pinBtn.style.opacity = "";
        pinBtn.title = this.stateManager.state.isPanelPinned ? "Lock Panel Position (Follow Glass)" : "Unlock Panel Position (Drag Inspector)";
      }
    }
    if (lockBtn) {
      const showLockBtn = isPanelVisible && this.stateManager.state.isPanelPinned;
      lockBtn.style.display = showLockBtn ? "flex" : "none";
      lockBtn.classList.toggle("active", this.stateManager.state.isPanelLocked);
      lockBtn.setAttribute("aria-pressed", String(this.stateManager.state.isPanelLocked));
      lockBtn.title = this.stateManager.state.isPanelLocked ? "Unpin Panel Position" : "Pin Panel Position";
      lockBtn.disabled = !this.stateManager.state.isPanelPinned;
    }
    const persistBtn = this.elements.controls.querySelector('[data-action="persist"]');
    if (persistBtn) {
      const isPersistConfigured = !!this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"];
      persistBtn.classList.toggle("active", isPersistConfigured);
      persistBtn.setAttribute("aria-pressed", String(isPersistConfigured));
      persistBtn.title = isPersistConfigured ? "Disable Sticky Info (S)" : "Enable Sticky Info (S)";
      persistBtn.style.display = isPanelVisible ? "flex" : "none";
    }
    const holdBtn = this.elements.controls.querySelector('[data-action="toggle-hold"]');
    if (holdBtn) {
      const isPersistConfigured = !!this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"];
      const isHeld = this.stateManager.state.isInfoHeld;
      holdBtn.style.display = isPanelVisible && isPersistConfigured ? "flex" : "none";
      holdBtn.classList.toggle("active", isHeld);
      holdBtn.setAttribute("aria-pressed", String(isHeld));
      holdBtn.innerHTML = isHeld ? Icons.play : Icons.pause;
      holdBtn.title = isHeld ? "Resume Info Update (P)" : "Pause Info Update (P)";
    }
    if (visibilityBtn) {
      visibilityBtn.classList.toggle("active", isPanelVisible);
      visibilityBtn.setAttribute("aria-pressed", String(isPanelVisible));
      visibilityBtn.title = isPanelVisible ? "Hide Panel" : "Show Panel";
      if (!isGlassVisible) {
        visibilityBtn.disabled = true;
        visibilityBtn.style.opacity = "0.5";
        visibilityBtn.title = "Cannot hide panel when glass preview is hidden";
      } else {
        visibilityBtn.disabled = false;
        visibilityBtn.style.opacity = "";
      }
    }
    if (glassBtn) {
      glassBtn.classList.toggle("active", isGlassVisible);
      glassBtn.setAttribute("aria-pressed", String(isGlassVisible));
      glassBtn.title = isGlassVisible ? "Hide Glass Preview" : "Show Glass Preview";
      glassBtn.style.display = isPanelVisible ? "flex" : "none";
    }
    const cursorBtn = this.elements.controls.querySelector('[data-action="toggle-cursor"]');
    if (cursorBtn) {
      const cglass = window.comfyUIMagnifyGlass;
      const showCursor = ((_a = cglass == null ? void 0 : cglass.config) == null ? void 0 : _a.showCursorPreview) || false;
      cursorBtn.classList.toggle("active", showCursor);
      cursorBtn.setAttribute("aria-pressed", String(showCursor));
      cursorBtn.title = showCursor ? "Hide Cursor Preview" : "Show Cursor Preview";
      const isPersistConfigured = !!this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"];
      cursorBtn.style.display = isGlassVisible && !this.stateManager.state.isPanelPinned && !isPersistConfigured ? "flex" : "none";
    }
    const dragGlassBtn = this.elements.controls.querySelector('[data-action="drag-glass"]');
    if (dragGlassBtn) {
      const mglass = window.comfyUIMagnifyGlass;
      const isDragMode = ((_b = mglass == null ? void 0 : mglass.state) == null ? void 0 : _b.isDragModeEnabled) || false;
      dragGlassBtn.classList.toggle("active", isDragMode);
      dragGlassBtn.setAttribute("aria-pressed", String(isDragMode));
      dragGlassBtn.title = isDragMode ? "Cancel Move Mode (H)" : "Move Glass Position (H)";
      dragGlassBtn.style.display = isGlassVisible ? "flex" : "none";
    }
    const resetGlassBtn = this.elements.controls.querySelector('[data-action="reset-glass"]');
    if (resetGlassBtn) {
      resetGlassBtn.style.display = isGlassVisible ? "flex" : "none";
    }
    const popoutBtn = this.elements.controls.querySelector('[data-action="popout"]');
    if (popoutBtn) {
      const glass = window.comfyUIMagnifyGlass;
      const isOpen = ((_c = glass == null ? void 0 : glass.popOutManager) == null ? void 0 : _c.isPopOutOpen()) || false;
      popoutBtn.classList.toggle("active", isOpen);
      popoutBtn.setAttribute("aria-pressed", String(isOpen));
      popoutBtn.title = isOpen ? "Close Pop-out Viewer" : "Open Pop-out Viewer";
    }
  }
  /**
   * Update controls layout based on position setting.
   * @param position 
   */
  updateControlsLayout(position) {
    if (!this.elements.controls) return;
    this.elements.controls.classList.remove("horizontal-layout", "vertical-layout");
    if (["top", "bottom"].includes(position)) {
      this.elements.controls.classList.add("horizontal-layout");
    } else {
      this.elements.controls.classList.add("vertical-layout");
    }
  }
  /**
   * Load a Google Font dynamically.
   * @param fontName - Name of the font to load
   */
  loadGoogleFont(fontName) {
    const linkId = `google-font-${fontName.replace(/\s+/g, "-").toLowerCase()}`;
    if (document.getElementById(linkId)) return;
    const link = document.createElement("link");
    link.id = linkId;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700&display=swap`;
    document.head.appendChild(link);
    Logger.debug(`[UIManager] Loaded Google Font: ${fontName}`);
  }
  /**
   * Apply current styles to elements.
   */
  applyStyles() {
    if (!this.elements.panel) return;
    const settings = this.stateManager.state.settings;
    this.elements.panel.style.width = `${settings["🔍MagnifyGlass.InfoPanelWidth"]}px`;
    const maxHeight = settings["🔍MagnifyGlass.InfoPanelMaxHeight"];
    this.elements.panel.style.setProperty("--panel-max-height", `${maxHeight}px`);
    this.elements.panel.style.height = "auto";
    this.elements.panel.style.position = "absolute";
    this.elements.panel.style.zIndex = "99999";
    this.elements.panel.style.transform = "translateY(-10px)";
    this.elements.panel.style.pointerEvents = "auto";
    this.elements.panel.style.userSelect = "none";
    const fontFamily = settings["🔍MagnifyGlass.InfoPanelFontFamily"] || "System Default";
    if (fontFamily === "System Default" || fontFamily === "system-ui") {
      this.elements.panel.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    } else if (fontFamily === "monospace") {
      this.elements.panel.style.fontFamily = "'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, monospace";
    } else {
      this.loadGoogleFont(fontFamily);
      this.elements.panel.style.fontFamily = `'${fontFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
    }
    const fontSize = settings["🔍MagnifyGlass.InfoPanelFontSize"] || 14;
    this.elements.panel.style.fontSize = `${fontSize}px`;
    this.elements.panel.style.transition = "none";
    const textColor = settings["🔍MagnifyGlass.InfoPanelTextColor"];
    if (textColor && typeof textColor === "string") {
      const normalizedTextColor = textColor.startsWith("#") ? textColor : `#${textColor}`;
      this.elements.panel.style.setProperty("--info-panel-text-color", normalizedTextColor);
    }
    const accentColor = settings["🔍MagnifyGlass.InfoPanelAccentColor"];
    if (accentColor && typeof accentColor === "string") {
      const normalizedAccentColor = accentColor.startsWith("#") ? accentColor : `#${accentColor}`;
      this.elements.panel.style.setProperty("--info-panel-accent-color", normalizedAccentColor);
    }
    if (this.stateManager.state.isPanelVisible) {
      const opacityPercent = Number(settings["🔍MagnifyGlass.InfoPanelOpacity"]) || 100;
      this.elements.panel.style.opacity = (opacityPercent / 100).toString();
    } else {
      this.elements.panel.style.opacity = "0";
    }
    const isPersist = !!settings["🔍MagnifyGlass.InfoPanelPersist"];
    if (isPersist) {
      this.elements.panel.classList.add("persist-active");
    } else {
      this.elements.panel.classList.remove("persist-active");
    }
    const isHighContrastText = !!settings["🔍MagnifyGlass.HighContrastText"];
    if (isHighContrastText) {
      this.elements.panel.classList.add("high-contrast-text");
    } else {
      this.elements.panel.classList.remove("high-contrast-text");
    }
  }
  /**
   * Show the panel.
   */
  show() {
    if (!this.elements.panel) return;
    if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"]) {
      this.elements.panel.style.display = "block";
      const opacityPercent = Number(this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelOpacity"]) || 100;
      this.elements.panel.style.opacity = (opacityPercent / 100).toString();
      this.elements.panel.offsetHeight;
      this.elements.panel.classList.add("visible");
      this.stateManager.state.isPanelVisible = true;
      this.updateControlStates();
    }
  }
  /**
   * Hide the panel.
   */
  hide() {
    if (!this.elements.panel) return;
    this.elements.panel.classList.remove("visible");
    this.elements.panel.classList.remove("visible");
    if (this.elements.panel) {
      this.elements.panel.style.display = "none";
    }
    this.stateManager.state.isPanelVisible = false;
    this.updateControlStates();
  }
  /**
   * Update minimized state.
   */
  updateMinimizedState() {
    if (!this.elements.panel || !this.elements.header) return;
    this.elements.panel.classList.toggle("panel-minimized", this.stateManager.state.isPanelMinimized);
    const minimizeBtn = this.elements.header.querySelector(".minimize-btn");
    if (minimizeBtn) {
      minimizeBtn.textContent = this.stateManager.state.isPanelMinimized ? "+" : "−";
      minimizeBtn.title = this.stateManager.state.isPanelMinimized ? "Expand Panel" : "Minimize Panel";
      minimizeBtn.setAttribute("aria-expanded", String(!this.stateManager.state.isPanelMinimized));
    }
  }
  /**
   * Update pinned state.
   */
  updatePinnedState() {
    if (!this.elements.panel) return;
    this.elements.panel.classList.toggle("panel-pinned", this.stateManager.state.isPanelPinned);
    this.elements.panel.classList.toggle("panel-locked", this.stateManager.state.isPanelLocked);
    this.updateControlStates();
  }
  /**
   * Update theme class.
   * @param newTheme 
   */
  updateTheme(newTheme) {
    if (this.elements.panel) {
      this.elements.panel.className = this.elements.panel.className.replace(/theme-\w+/, `theme-${newTheme.toLowerCase()}`);
    }
    if (this.elements.controls) {
      this.elements.controls.className = this.elements.controls.className.replace(/theme-\w+/, `theme-${newTheme.toLowerCase()}`);
    }
  }
  /**
   * Display information in the panel.
   * @param info
   */
  displayInfo(info) {
    if (this.activeEditors.size > 0) {
      this.updateHeaderSubtitle(info);
      return;
    }
    const sections = this.buildSections(info);
    this.renderSections(sections);
    this.updateSectionStates();
    this.updateHeaderSubtitle(info);
  }
  /**
   * Build section data from info object.
   * @param info 
   * @returns 
   */
  buildSections(info) {
    const sections = [];
    const settings = this.stateManager.state.settings;
    if (settings["🔍MagnifyGlass.ShowInspectorTab"] && info.cursor && info.cursor.canvas) {
      const inspectorContent = [
        { label: "Cursor Canvas", value: `(${Math.round(info.cursor.canvas.x)}, ${Math.round(info.cursor.canvas.y)})` },
        { label: "Canvas Scale", value: `${(info.canvas.scale * 100).toFixed(1)}%` },
        { label: "Magnifier Zoom", value: `${info.magnifier.zoomFactor}×` }
      ];
      sections.push({
        id: "inspector",
        icon: Icons.info,
        title: "Inspector",
        content: inspectorContent
      });
    }
    if (info.media) {
      const mediaContent = [
        { label: "Type", value: info.media.tagName },
        { label: "Source", value: info.media.src }
      ];
      if (info.media.naturalSize) {
        mediaContent.push({ label: "Natural", value: info.media.naturalSize });
      }
      sections.push({
        id: "media",
        icon: Icons.camera,
        title: "Media",
        badge: info.media.tagName,
        content: mediaContent
      });
    }
    if (info.hoveredNode) {
      const nodeContent = [];
      nodeContent.push({
        label: "Title",
        value: `${info.hoveredNode.title || "Untitled"} (#${info.hoveredNode.id})`,
        clickable: "title"
      });
      if (info.hoveredNode.executionOrder !== void 0) {
        nodeContent.push({ label: "Exec Order", value: info.hoveredNode.executionOrder, clickable: "execOrder" });
      }
      nodeContent.push({
        label: "Location",
        value: `<span class="focus-node-btn">${Icons.focus} Focus Node</span>`,
        clickable: "zoom",
        nodeId: info.hoveredNode.id,
        isHtml: true
      });
      if (info.hoveredNode.category) {
        nodeContent.push({ label: "Category", value: info.hoveredNode.category, copyable: true });
      }
      if (info.hoveredNode.pythonModule) {
        const path = info.hoveredNode.pythonModule.replace(/\./g, "/") + ".py";
        nodeContent.push({ label: "Path", value: path, copyable: true });
      }
      const nodeType = info.hoveredNode.type ? info.hoveredNode.type.toLowerCase() : "";
      const isSaveNode = nodeType.includes("save") && !nodeType.includes("checkpoint") && !nodeType.includes("model") && !nodeType.includes("preview");
      const showAllWidgets = info.hoveredNode.type && (nodeType.includes("ksampler") || nodeType.includes("sampler") || nodeType.includes("k_samplers") || nodeType.includes("checkpoint") || nodeType.includes("model") || nodeType.includes("lora") || nodeType.includes("controlnet") || nodeType.includes("advanced") || nodeType.includes("detailer") || nodeType.includes("inpaint") || nodeType.includes("upscale") || nodeType.includes("clip") || nodeType.includes("text") || nodeType.includes("encode")) && !isSaveNode;
      if (!showAllWidgets) {
        const checkpoint = getCheckpointInfo(info.hoveredNode);
        if (checkpoint) {
          nodeContent.push({ label: "Model", value: checkpoint });
        }
        const imgInfo = getImageInfo(info.hoveredNode);
        if (imgInfo) {
          if (typeof imgInfo === "string") {
            nodeContent.push({ label: "Image", value: imgInfo });
          } else if (typeof imgInfo === "object" && imgInfo !== null) {
            const imgResult = imgInfo;
            nodeContent.push({ label: "Image Size", value: `${imgResult.width}×${imgResult.height}` });
            if (imgResult.src) {
              nodeContent.push({ label: "Image Source", value: imgResult.src });
            }
          }
        }
        const textContent = getTextBoxContent(info.hoveredNode);
        if (textContent) {
          nodeContent.push({ label: "Text", value: textContent });
        }
      }
      const importantParameters = getImportantNodeParameters(info.hoveredNode);
      nodeContent.push(...importantParameters);
      sections.push({
        id: "node",
        icon: Icons.box,
        title: "Node",
        badge: info.hoveredNode.type,
        content: nodeContent
      });
    }
    return sections;
  }
  /**
   * Render sections to the panel.
   * @param sections 
   */
  renderSections(sections) {
    if (!this.elements.content) return;
    this.cleanupEditors();
    if (sections.length === 0) {
      this.elements.content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">${Icons.mapPin}</div>
                    <div class="empty-state-text">Empty canvas area</div>
                </div>
            `;
      return;
    }
    const isStickyEnabled = !!this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"];
    this.elements.content.innerHTML = sections.map((section) => `
            <div class="info-section" data-section="${escapeHtml(section.id)}">
                <div class="section-header" data-section="${escapeHtml(section.id)}">
                    <span class="section-icon">${section.icon}</span>
                    <span class="section-title">${escapeHtml(section.title)}</span>
                    ${section.badge ? `<span class="section-badge">${escapeHtml(section.badge)}</span>` : ""}
                    ${section.id !== "node" ? `<span class="expand-icon">${Icons.chevronRight}</span>` : ""}
                </div>
                <div class="section-content">
                    <div class="section-body">
                        ${section.content.map((item) => {
      const value = item.isHtml ? item.value : formatValue(item.value, item.label);
      const valueClass = getValueClass(item.value);
      const valueAttributes = getValueAttributes(item.value);
      const clickableAttr = item.clickable ? `data-clickable="${item.clickable}"` : "";
      const nodeIdAttr = item.nodeId !== void 0 ? `data-node-id="${item.nodeId}"` : "";
      const clickableClass = item.clickable ? "clickable-row" : "";
      const isEditable = item.isEditable && isStickyEnabled && item.widgetName && item.nodeId !== void 0;
      const editableClass = isEditable ? "editable" : "";
      const constraintsJson = isEditable && item.constraints ? escapeHtml(JSON.stringify(item.constraints)) : "";
      const rawValueStr = isEditable ? typeof item.rawValue === "boolean" ? item.rawValue ? "true" : "false" : escapeHtml(String(item.rawValue ?? "")) : "";
      const editableAttrs = isEditable ? `data-editable="true" data-widget-name="${escapeHtml(item.widgetName)}" data-widget-type="${escapeHtml(item.widgetType || "text")}" data-raw-value="${rawValueStr}" data-constraints="${constraintsJson}"` : "";
      const dropdownIcon = item.clickable && item.clickable !== "zoom" ? '<span class="dropdown-indicator" style="margin-left: 4px; opacity: 0.6; font-size: 10px;">▼</span>' : "";
      const copyButton = item.copyable ? `<button class="copy-btn" data-copy-value="${escapeHtml(String(item.value))}" title="Copy to clipboard">${Icons.copy}</button>` : "";
      return `
                            <div class="info-row ${clickableClass} ${editableClass}${item.copyable ? " copyable-row" : ""}" ${clickableAttr} ${nodeIdAttr} ${editableAttrs} style="${item.clickable ? "cursor: pointer;" : ""}">
                                ${copyButton}
                                <span class="info-label">${escapeHtml(item.label)}</span>
                                <span class="info-value ${valueClass} original" ${valueAttributes}>${value}${dropdownIcon}</span>
                                <div class="inline-control-container" style="display: none;"></div>
                                <div class="widget-editor-container" style="display: none;"></div>
                            </div>`;
    }).join("")}
                    </div>
                </div>
            </div>`).join("");
    this.attachDropdownClickHandlers();
    this.attachCopyButtonHandlers();
    if (isStickyEnabled) {
      this.attachEditableRowHandlers();
    }
  }
  /**
   * Cleanup active widget editors, inline controls, and drag controllers.
   */
  cleanupEditors() {
    this.activeEditors.forEach((editor) => {
      try {
        editor.destroy();
      } catch (e) {
      }
    });
    this.activeEditors.clear();
    this.activeInlineControls.forEach((control) => {
      try {
        control.destroy();
      } catch (e) {
      }
    });
    this.activeInlineControls.clear();
    this.activeDragControllers.forEach((controller) => {
      try {
        controller.destroy();
      } catch (e) {
      }
    });
    this.activeDragControllers.clear();
  }
  /**
   * Attach click handlers to editable widget rows.
   * Also creates inline controls for toggle/combo widgets and drag controllers.
   */
  attachEditableRowHandlers() {
    if (!this.elements.content) return;
    const editableRows = this.elements.content.querySelectorAll('[data-editable="true"]');
    editableRows.forEach((row) => {
      const rowEl = row;
      const valueEl = rowEl.querySelector(".info-value.original");
      const editorContainer = rowEl.querySelector(".widget-editor-container");
      const inlineContainer = rowEl.querySelector(".inline-control-container");
      if (!valueEl) return;
      const nodeId = parseInt(rowEl.dataset.nodeId || "0", 10);
      const widgetName = rowEl.dataset.widgetName || "";
      const widgetType = rowEl.dataset.widgetType || "text";
      const rawValue = rowEl.dataset.rawValue;
      let constraints = {};
      try {
        const constraintsStr = rowEl.dataset.constraints;
        if (constraintsStr) {
          constraints = JSON.parse(constraintsStr);
        }
      } catch (e) {
      }
      if (isNaN(nodeId) || !widgetName) return;
      const controlKey = `${nodeId}:${widgetName}`;
      if (InlineControlFactory.shouldUseInlineControl(widgetType) && inlineContainer) {
        const control = InlineControlFactory.createControl({
          nodeId,
          widgetName,
          widgetType,
          currentValue: widgetType.toLowerCase() === "boolean" || widgetType.toLowerCase() === "toggle" ? rawValue === "true" : rawValue,
          constraints,
          onChange: (value) => {
            rowEl.dataset.rawValue = String(value);
          }
        });
        if (control) {
          this.activeInlineControls.set(controlKey, control);
          inlineContainer.appendChild(control.element);
          inlineContainer.style.display = "flex";
          valueEl.style.display = "none";
        }
      } else if (editorContainer) {
        valueEl.addEventListener("click", (e) => {
          e.stopPropagation();
          this.enterEditMode(rowEl, valueEl, editorContainer);
        });
      }
      if (DragValueController.isTypeSupported(widgetType) && !InlineControlFactory.shouldUseInlineControl(widgetType)) {
        const dragController = new DragValueController(rowEl, {
          nodeId,
          widgetName,
          widgetType,
          currentValue: rawValue,
          constraints,
          onChange: (value) => {
            rowEl.dataset.rawValue = String(value);
            valueEl.textContent = formatWidgetValue(value);
          }
        });
        this.activeDragControllers.set(controlKey, dragController);
      }
    });
  }
  /**
   * Enter edit mode for a row.
   */
  enterEditMode(row, valueEl, container) {
    if (row.classList.contains("editing")) return;
    const nodeId = parseInt(row.dataset.nodeId || "0", 10);
    const widgetName = row.dataset.widgetName || "";
    const widgetType = row.dataset.widgetType || "text";
    const rawValue = row.dataset.rawValue;
    if (isNaN(nodeId) || !widgetName) return;
    let constraints = {};
    try {
      const constraintsStr = row.dataset.constraints;
      if (constraintsStr) {
        constraints = JSON.parse(constraintsStr);
      }
    } catch (e) {
    }
    const editorKey = `${nodeId}:${widgetName}`;
    const editor = WidgetEditorFactory.createEditor({
      nodeId,
      widgetName,
      widgetType,
      currentValue: rawValue,
      constraints,
      onChange: (value) => {
        row.dataset.rawValue = String(value);
      },
      onBlur: () => {
        const currentEditor = this.activeEditors.get(editorKey);
        setTimeout(() => {
          if (currentEditor && this.activeEditors.get(editorKey) === currentEditor) {
            if (!container.contains(document.activeElement)) {
              this.exitEditMode(row, valueEl, container);
            }
          }
        }, 100);
      }
    });
    this.activeEditors.set(editorKey, editor);
    row.classList.add("editing");
    valueEl.style.display = "none";
    container.style.display = "block";
    container.innerHTML = "";
    container.appendChild(editor.element);
    editor.focus();
  }
  /**
   * Exit edit mode for a row.
   */
  exitEditMode(row, valueEl, container) {
    if (!row.classList.contains("editing")) return;
    const nodeId = row.dataset.nodeId || "";
    const widgetName = row.dataset.widgetName || "";
    const editorKey = `${nodeId}:${widgetName}`;
    const editor = this.activeEditors.get(editorKey);
    if (editor) {
      const actualValue = WidgetSyncManager.getWidgetValue(parseInt(nodeId, 10), widgetName);
      valueEl.textContent = formatWidgetValue(actualValue ?? editor.getValue());
      editor.destroy();
      this.activeEditors.delete(editorKey);
    }
    row.classList.remove("editing");
    valueEl.style.display = "";
    container.style.display = "none";
    container.innerHTML = "";
  }
  /**
   * Attach click handlers to copy buttons for copying values to clipboard.
   */
  attachCopyButtonHandlers() {
    if (!this.elements.content) return;
    const copyButtons = this.elements.content.querySelectorAll(".copy-btn");
    copyButtons.forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        e.preventDefault();
        const button = btn;
        const valueToCopy = button.dataset.copyValue || "";
        try {
          await navigator.clipboard.writeText(valueToCopy);
          const originalHtml = button.innerHTML;
          button.innerHTML = "✓";
          button.classList.add("copied");
          setTimeout(() => {
            button.innerHTML = originalHtml;
            button.classList.remove("copied");
          }, 1500);
        } catch (err) {
          Logger.error("[UIManager] Failed to copy to clipboard:", err);
        }
      });
    });
  }
  /**
   * Attach click handlers to clickable dropdown rows.
   */
  attachDropdownClickHandlers() {
    if (!this.elements.content) return;
    const clickableRows = this.elements.content.querySelectorAll("[data-clickable]");
    clickableRows.forEach((row) => {
      const clickableType = row.dataset.clickable;
      row.addEventListener("click", (e) => {
        e.stopPropagation();
        if (clickableType === "title") {
          this.showTitleDropdown(row);
        } else if (clickableType === "execOrder") {
          this.showExecOrderDropdown(row);
        } else if (clickableType === "id") {
          this.showIdDropdown(row);
        } else if (clickableType === "zoom") {
          const nodeId = row.dataset.nodeId;
          if (nodeId) {
            const app = window.app;
            const node = app.graph.getNodeById(parseInt(nodeId));
            if (node && app.canvas) {
              app.canvas.centerOnNode(node);
            }
          }
        }
      });
      row.addEventListener("mouseenter", () => {
        row.style.background = "var(--comfy-input-bg, rgba(255,255,255,0.05))";
      });
      row.addEventListener("mouseleave", () => {
        row.style.background = "";
      });
    });
  }
  /**
   * Update section expansion states.
   */
  updateSectionStates() {
    if (!this.elements.content) return;
    const sections = this.elements.content.querySelectorAll(".info-section");
    sections.forEach((section) => {
      const sectionId = section.dataset.section;
      if (!sectionId) return;
      const header = section.querySelector(".section-header");
      const content = section.querySelector(".section-content");
      if (header && content) {
        if (this.stateManager.state.expandedSections.has(sectionId)) {
          header.classList.add("expanded");
          content.classList.add("expanded");
        } else {
          header.classList.remove("expanded");
          content.classList.remove("expanded");
        }
      }
    });
  }
  /**
   * Update header subtitle.
   * @param info 
   */
  updateHeaderSubtitle(info) {
    if (!this.elements.header) return;
    const subtitleElement = this.elements.header.querySelector(".header-subtitle");
    if (subtitleElement) {
      const accentColor = String(this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelAccentColor"] || "");
      if (info.hoveredNode) {
        subtitleElement.textContent = `Analyzing: ${info.hoveredNode.title} `;
        subtitleElement.style.color = accentColor;
      } else if (info.media) {
        subtitleElement.textContent = `Media: ${info.media.tagName} `;
        subtitleElement.style.color = accentColor;
      } else if (info.connection) {
        subtitleElement.textContent = `Connection: ${info.connection.type} `;
        subtitleElement.style.color = accentColor;
      } else {
        subtitleElement.textContent = "Real-time analysis";
        subtitleElement.style.color = "";
      }
    }
  }
  /**
   * Inject CSS styles by loading external stylesheet.
   */
  injectStyles() {
    if (!document.getElementById("magnify-info-panel-styles-v2")) {
      const link = document.createElement("link");
      link.id = "magnify-info-panel-styles-v2";
      link.rel = "stylesheet";
      link.type = "text/css";
      link.href = "extensions/comfyui-magnifyglass/info-panel.css";
      document.head.appendChild(link);
    }
  }
  /**
   * Show dropdown with nodes sorted by title.
   * @param anchorElement - Element to anchor the dropdown to
   */
  showTitleDropdown(anchorElement) {
    this.hideDropdown();
    const nodes = this.nodeSelector.getNodesSortedByTitle();
    if (nodes.length === 0) return;
    this.createDropdown(nodes, anchorElement, "title");
  }
  /**
   * Show dropdown with nodes sorted by execution order.
   * @param anchorElement - Element to anchor the dropdown to
   */
  showExecOrderDropdown(anchorElement) {
    this.hideDropdown();
    const nodes = this.nodeSelector.getNodesSortedByExecOrder();
    if (nodes.length === 0) return;
    this.createDropdown(nodes, anchorElement, "execOrder");
  }
  /**
   * Show dropdown with nodes sorted by ID.
   * @param anchorElement - Element to anchor the dropdown to
   */
  showIdDropdown(anchorElement) {
    this.hideDropdown();
    const nodes = this.nodeSelector.getNodesSortedById();
    if (nodes.length === 0) return;
    this.createDropdown(nodes, anchorElement, "id");
  }
  /**
   * Create and show the dropdown.
   */
  createDropdown(nodes, anchorElement, type) {
    const dropdown = document.createElement("div");
    dropdown.className = `node-selector-dropdown theme-${this.stateManager.state.currentTheme}`;
    dropdown.setAttribute("role", "listbox");
    dropdown.setAttribute("tabindex", "-1");
    dropdown.setAttribute("aria-label", type === "title" ? "Select Node by Title" : type === "execOrder" ? "Select Node by Execution Order" : "Select Node by ID");
    dropdown.style.cssText = `
            position: fixed;
            z-index: 100000;
            overflow-y: auto;
            background: var(--comfy-menu-bg, #2a2a2a);
            border: 1px solid var(--border-color, #444);
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            min-width: 200px;
            outline: none;
        `;
    let activeIndex = 0;
    nodes.forEach((node, index) => {
      const item = document.createElement("div");
      item.className = "dropdown-item";
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", index === activeIndex ? "true" : "false");
      if (index === activeIndex) {
        item.classList.add("focused");
      }
      item.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid var(--border-color, #333);
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 13px;
                background: ${index === activeIndex ? "var(--comfy-input-bg, #3a3a3a)" : ""};
            `;
      const isExecOrder = "order" in node;
      if (isExecOrder) {
        const execNode = node;
        item.innerHTML = `
                    <span style="color: var(--info-panel-accent-color, #4ecdc4); font-weight: 600; min-width: 24px;">#${execNode.order}</span>
                    <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(execNode.title)} (#${execNode.id})</span>
                    <span style="color: #888; font-size: 11px;">${escapeHtml(execNode.type)}</span>
                `;
      } else {
        item.innerHTML = `
                    <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(node.title)} (#${node.id})</span>
                    <span style="color: #888; font-size: 11px;">${escapeHtml(node.type)}</span>
                `;
      }
      item.addEventListener("mouseenter", () => {
        if (activeIndex !== index) {
          const items = dropdown.querySelectorAll(".dropdown-item");
          if (items[activeIndex]) {
            const prev = items[activeIndex];
            prev.style.background = "";
            prev.classList.remove("focused");
            prev.setAttribute("aria-selected", "false");
          }
          activeIndex = index;
          item.classList.add("focused");
          item.setAttribute("aria-selected", "true");
        }
        item.style.background = "var(--comfy-input-bg, #3a3a3a)";
      });
      item.addEventListener("mouseleave", () => {
        if (index !== activeIndex) {
          item.style.background = "";
        }
      });
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        this.hideDropdown();
        this.stateManager.setSelectedNode(node.id);
        if (this.onNodeSelected) {
          this.onNodeSelected(node.id);
        }
      });
      dropdown.appendChild(item);
    });
    document.body.appendChild(dropdown);
    this.positionDropdownWithinViewport(dropdown, anchorElement);
    this.currentDropdown = dropdown;
    const cleanup = () => {
      document.removeEventListener("mousedown", closeHandler, true);
      document.removeEventListener("keydown", keyHandler);
      if (this.elements.panel) {
        this.elements.panel.removeEventListener("mousedown", panelCloseHandler, true);
      }
      const canvas = document.querySelector("canvas.main-canvas, canvas");
      if (canvas) {
        canvas.removeEventListener("pointerdown", canvasCloseHandler, true);
      }
      if (this.currentDropdownCleanup === cleanup) {
        this.currentDropdownCleanup = null;
      }
    };
    this.currentDropdownCleanup = cleanup;
    const closeHandler = (e) => {
      if (!dropdown.contains(e.target) && !anchorElement.contains(e.target)) {
        this.hideDropdown();
      }
    };
    const panelCloseHandler = (e) => {
      if (!dropdown.contains(e.target) && !anchorElement.contains(e.target)) {
        this.hideDropdown();
      }
    };
    const canvasCloseHandler = (_e) => {
      this.hideDropdown();
    };
    const updateActiveItem = (newIndex) => {
      const items = dropdown.querySelectorAll(".dropdown-item");
      if (items.length === 0) return;
      if (newIndex < 0) newIndex = 0;
      if (newIndex >= items.length) newIndex = items.length - 1;
      if (activeIndex >= 0 && activeIndex < items.length) {
        const oldItem = items[activeIndex];
        oldItem.classList.remove("focused");
        oldItem.setAttribute("aria-selected", "false");
        oldItem.style.background = "";
      }
      activeIndex = newIndex;
      const newItem = items[activeIndex];
      newItem.classList.add("focused");
      newItem.setAttribute("aria-selected", "true");
      newItem.style.background = "var(--comfy-input-bg, #3a3a3a)";
      newItem.scrollIntoView({ block: "nearest" });
    };
    const keyHandler = (e) => {
      if (document.activeElement !== dropdown && !dropdown.contains(document.activeElement)) {
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        this.hideDropdown();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        updateActiveItem(activeIndex + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        updateActiveItem(activeIndex - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        const items = dropdown.querySelectorAll(".dropdown-item");
        if (activeIndex >= 0 && activeIndex < items.length) {
          items[activeIndex].click();
        }
      }
    };
    setTimeout(() => {
      if (this.currentDropdownCleanup !== cleanup || !dropdown.parentNode) {
        return;
      }
      document.addEventListener("mousedown", closeHandler, true);
      document.addEventListener("keydown", keyHandler);
      dropdown.focus();
      if (this.elements.panel) {
        this.elements.panel.addEventListener("mousedown", panelCloseHandler, true);
      }
      const canvas = document.querySelector("canvas.main-canvas, canvas");
      if (canvas) {
        canvas.addEventListener("pointerdown", canvasCloseHandler, true);
      }
    }, 10);
  }
  /**
   * Hide the current dropdown.
   */
  hideDropdown() {
    if (this.currentDropdownCleanup) {
      this.currentDropdownCleanup();
      this.currentDropdownCleanup = null;
    }
    if (this.currentDropdown && this.currentDropdown.parentNode) {
      this.currentDropdown.parentNode.removeChild(this.currentDropdown);
      this.currentDropdown = null;
    }
  }
  /**
   * Position a dropdown within viewport bounds.
   * Allows dropdown to expand to fit content, constrained by available space.
   */
  positionDropdownWithinViewport(dropdown, anchor) {
    const margin = 10;
    const gap = 4;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const anchorRect = anchor.getBoundingClientRect();
    dropdown.style.maxWidth = "none";
    dropdown.style.maxHeight = "none";
    const naturalRect = dropdown.getBoundingClientRect();
    const spaceBelow = viewportHeight - anchorRect.bottom - margin - gap;
    const spaceAbove = anchorRect.top - margin - gap;
    const spaceRight = viewportWidth - anchorRect.left - margin;
    const spaceLeft = anchorRect.right - margin;
    let top;
    let maxHeight;
    if (spaceBelow >= naturalRect.height || spaceBelow >= spaceAbove) {
      top = anchorRect.bottom + gap;
      maxHeight = Math.max(100, spaceBelow);
    } else {
      maxHeight = Math.max(100, spaceAbove);
      top = anchorRect.top - gap - Math.min(naturalRect.height, maxHeight);
    }
    let left = anchorRect.left;
    let maxWidth;
    if (naturalRect.width <= spaceRight) {
      maxWidth = spaceRight;
    } else if (naturalRect.width <= spaceLeft) {
      left = anchorRect.right - naturalRect.width;
      maxWidth = spaceLeft;
    } else {
      left = margin;
      maxWidth = viewportWidth - margin * 2;
    }
    left = Math.max(margin, Math.min(left, viewportWidth - margin - naturalRect.width));
    dropdown.style.top = `${Math.max(margin, top)}px`;
    dropdown.style.left = `${Math.max(margin, left)}px`;
    dropdown.style.maxWidth = `${maxWidth}px`;
    dropdown.style.maxHeight = `${maxHeight}px`;
  }
  cleanup() {
    this.cleanupEditors();
    if (this.elements.panel && this.elements.panel.parentNode) {
      this.elements.panel.parentNode.removeChild(this.elements.panel);
    }
    if (this.elements.controls && this.elements.controls.parentNode) {
      this.elements.controls.parentNode.removeChild(this.elements.controls);
    }
  }
}
export {
  UIManager
};
//# sourceMappingURL=UIManager.js.map
