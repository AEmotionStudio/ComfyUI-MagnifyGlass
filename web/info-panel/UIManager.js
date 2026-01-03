var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { Icons } from "../shared/icons.js";
import { Logger } from "../shared/logger.js";
import { formatValue, getValueClass, getValueAttributes } from "./ValueFormatter.js";
import { getCheckpointInfo, getImageInfo, getTextBoxContent, getImportantNodeParameters } from "./NodeDataExtractor.js";
class UIManager {
  constructor(stateManager) {
    __publicField(this, "stateManager");
    __publicField(this, "elements");
    this.stateManager = stateManager;
    this.elements = {
      panel: null,
      header: null,
      content: null,
      controls: null
    };
    this.createPanel();
    this.injectStyles();
  }
  /**
   * Create the main panel and its components.
   */
  createPanel() {
    this.elements.panel = document.createElement("div");
    this.elements.panel.id = "comfyui-magnify-info-panel-pro-v2";
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
                <button class="control-btn minimize-btn" title="Minimize Panel" data-action="minimize">${Icons.minus}</button>
            </div>
        `;
    this.elements.content = document.createElement("div");
    this.elements.content.className = "panel-content";
    this.elements.panel.appendChild(this.elements.header);
    this.elements.panel.appendChild(this.elements.content);
    this.applyStyles();
    if (this.stateManager.state.isPanelMinimized) {
      this.elements.panel.classList.add("panel-minimized");
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
            <button class="control-btn unlock-btn" title="Unlock/Lock Panel from Glass" data-action="pin">${Icons.unlock}</button>
            <button class="control-btn pin-btn" title="Pin/Unpin Panel Position (Prevent Drag)" data-action="lock">${Icons.pin}</button>
            <button class="control-btn persist-btn" title="Toggle Persist Mode (Sticky Info)" data-action="persist">${Icons.magnet}</button>
            <button class="control-btn visibility-btn" title="Toggle Panel Visibility (I)" data-action="toggle-panel">${Icons.eye}</button>
            <button class="control-btn glass-btn" title="Toggle Glass Preview (G)" data-action="toggle-glass">${Icons.magnifyGlass}</button>
            <button class="control-btn drag-glass-btn" title="Move Glass Position (H)" data-action="drag-glass">${Icons.move}</button>
            <button class="control-btn reset-glass-btn" title="Reset Glass Position (O)" data-action="reset-glass">${Icons.reset}</button>
            <button class="control-btn popout-btn" title="Open in New Tab (Shift+P)" data-action="popout">${Icons.externalLink}</button>
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
          if (magnifyGlass && ((_a = magnifyGlass.ui) == null ? void 0 : _a.setPreviewVisibility)) {
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
    var _a;
    if (!this.elements.controls) return;
    const pinBtn = this.elements.controls.querySelector('[data-action="pin"]');
    const lockBtn = this.elements.controls.querySelector('[data-action="lock"]');
    const visibilityBtn = this.elements.controls.querySelector('[data-action="toggle-panel"]');
    const glassBtn = this.elements.controls.querySelector('[data-action="toggle-glass"]');
    const isPanelVisible = this.stateManager.state.isPanelVisible;
    const isGlassVisible = this.stateManager.state.isGlassPreviewVisible;
    if (pinBtn) {
      pinBtn.classList.toggle("active", this.stateManager.state.isPanelPinned);
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
      lockBtn.title = this.stateManager.state.isPanelLocked ? "Unpin Panel Position" : "Pin Panel Position";
      lockBtn.disabled = !this.stateManager.state.isPanelPinned;
    }
    const persistBtn = this.elements.controls.querySelector('[data-action="persist"]');
    if (persistBtn) {
      const isPersistConfigured = !!this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"];
      persistBtn.classList.toggle("active", isPersistConfigured);
      persistBtn.title = isPersistConfigured ? "Disable Sticky Info" : "Enable Sticky Info (Persist)";
      persistBtn.style.display = isPanelVisible ? "flex" : "none";
    }
    if (visibilityBtn) {
      visibilityBtn.classList.toggle("active", isPanelVisible);
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
      glassBtn.title = isGlassVisible ? "Hide Glass Preview" : "Show Glass Preview";
      glassBtn.style.display = isPanelVisible ? "flex" : "none";
    }
    const dragGlassBtn = this.elements.controls.querySelector('[data-action="drag-glass"]');
    if (dragGlassBtn) {
      const mglass = window.comfyUIMagnifyGlass;
      const isDragMode = ((_a = mglass == null ? void 0 : mglass.state) == null ? void 0 : _a.isDragModeEnabled) || false;
      dragGlassBtn.classList.toggle("active", isDragMode);
      dragGlassBtn.title = isDragMode ? "Cancel Move Mode (H)" : "Move Glass Position (H)";
      dragGlassBtn.style.display = isGlassVisible ? "flex" : "none";
    }
    const resetGlassBtn = this.elements.controls.querySelector('[data-action="reset-glass"]');
    if (resetGlassBtn) {
      resetGlassBtn.style.display = isGlassVisible ? "flex" : "none";
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
    console.log(`[UIManager] applyStyles - MaxHeight: ${settings["🔍MagnifyGlass.InfoPanelMaxHeight"]}`);
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
      const nodeContent = [
        { label: "Title", value: info.hoveredNode.title }
      ];
      if (info.hoveredNode.executionOrder !== void 0) {
        nodeContent.push({ label: "Exec Order", value: info.hoveredNode.executionOrder });
      }
      if (info.hoveredNode.category) {
        nodeContent.push({ label: "Category", value: info.hoveredNode.category });
      }
      if (info.hoveredNode.pythonModule) {
        const path = info.hoveredNode.pythonModule.replace(/\./g, "/") + ".py";
        nodeContent.push({ label: "Path", value: path });
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
    if (sections.length === 0) {
      this.elements.content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">${Icons.mapPin}</div>
                    <div class="empty-state-text">Empty canvas area</div>
                </div>
            `;
      return;
    }
    this.elements.content.innerHTML = sections.map((section) => `
            <div class="info-section" data-section="${section.id}">
                <div class="section-header" data-section="${section.id}">
                    <span class="section-icon">${section.icon}</span>
                    <span class="section-title">${section.title}</span>
                    ${section.badge ? `<span class="section-badge">${section.badge}</span>` : ""}
                    ${section.id !== "node" ? `<span class="expand-icon">${Icons.chevronRight}</span>` : ""}
                </div>
                <div class="section-content">
                    <div class="section-body">
                        ${section.content.map((item) => {
      const value = formatValue(item.value, item.label);
      const valueClass = getValueClass(item.value);
      const valueAttributes = getValueAttributes(item.value);
      return `
                            <div class="info-row">
                                <span class="info-label">${item.label}</span>
                                <span class="info-value ${valueClass}" ${valueAttributes}>${value}</span>
                            </div>`;
    }).join("")}
                    </div>
                </div>
            </div>`).join("");
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
  cleanup() {
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
