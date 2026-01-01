var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { Icons } from "../shared/icons.js";
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
    document.body.appendChild(this.elements.panel);
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
    if (this.stateManager.state.settings["🔍MagnifyGlass.ShowHoveringControls"]) {
      this.createFloatingControls();
      this.updateControlStates();
    }
  }
  /**
   * Create floating control buttons.
   */
  createFloatingControls() {
    this.elements.controls = document.createElement("div");
    this.elements.controls.className = "floating-controls vertical-layout";
    this.elements.controls.innerHTML = `
            <button class="control-btn pin-btn" title="Unlock Panel to Mouse Location (U)" data-action="pin">${Icons.unlock}</button>
            <button class="control-btn lock-btn" title="Lock Panel Position" data-action="lock">${Icons.pin}</button>
            <button class="control-btn visibility-btn" title="Toggle Panel Visibility (I)" data-action="toggle-panel">${Icons.eye}</button>
            <button class="control-btn glass-btn" title="Toggle Glass Preview (G)" data-action="toggle-glass">${Icons.magnifyGlass}</button>
        `;
    document.body.appendChild(this.elements.controls);
    this.elements.controls.style.display = "none";
    this.elements.controls.style.visibility = "hidden";
    this.elements.controls.style.left = "-9999px";
    this.elements.controls.style.top = "-9999px";
    this.elements.controls.addEventListener("click", (e) => {
      const target = e.target;
      const button = target.closest("button[data-action]");
      if (!button) return;
      const action = button.getAttribute("data-action");
      console.log(`[InfoPanel] Control button clicked: ${action}`);
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
          this.updateControlStates();
          if (window.magnifyGlass) {
            if (this.stateManager.state.isGlassPreviewVisible) {
              window.magnifyGlass.ui.show();
            } else {
              window.magnifyGlass.ui.hide();
            }
          }
          break;
      }
    });
    const controlsPosition = this.stateManager.state.settings["🔍MagnifyGlass.ControlsPosition"] || "top-right";
    this.updateControlsLayout(controlsPosition);
  }
  /**
   * Update control button states.
   */
  updateControlStates() {
    if (!this.elements.controls) return;
    const pinBtn = this.elements.controls.querySelector('[data-action="pin"]');
    const lockBtn = this.elements.controls.querySelector('[data-action="lock"]');
    const visibilityBtn = this.elements.controls.querySelector('[data-action="toggle-panel"]');
    const glassBtn = this.elements.controls.querySelector('[data-action="toggle-glass"]');
    if (pinBtn) {
      pinBtn.classList.toggle("active", this.stateManager.state.isPanelPinned);
      pinBtn.title = this.stateManager.state.isPanelPinned ? "Lock Panel" : "Unlock Panel";
      pinBtn.innerHTML = this.stateManager.state.isPanelPinned ? Icons.lock : Icons.unlock;
    }
    if (lockBtn) {
      lockBtn.style.display = this.stateManager.state.isPanelPinned ? "flex" : "none";
      lockBtn.classList.toggle("active", this.stateManager.state.isPanelLocked);
      lockBtn.title = this.stateManager.state.isPanelLocked ? "Upin Panel Position" : "Pin Panel Position";
      lockBtn.disabled = !this.stateManager.state.isPanelPinned;
    }
    if (visibilityBtn) {
      visibilityBtn.classList.toggle("active", this.stateManager.state.isPanelVisible);
      visibilityBtn.title = this.stateManager.state.isPanelVisible ? "Show Panel" : "Hide Panel";
    }
    if (glassBtn) {
      glassBtn.classList.toggle("active", this.stateManager.state.isGlassPreviewVisible);
      glassBtn.title = this.stateManager.state.isGlassPreviewVisible ? "Hide Glass Preview" : "Show Glass Preview";
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
   * Apply current styles to elements.
   */
  applyStyles() {
    if (!this.elements.panel) return;
    const settings = this.stateManager.state.settings;
    const textColor = settings["🔍MagnifyGlass.InfoPanelTextColor"];
    if (textColor) {
      const normalizedTextColor = textColor.startsWith("#") ? textColor : `#${textColor}`;
      this.elements.panel.style.setProperty("--info-panel-text-color", normalizedTextColor);
    }
    const accentColor = settings["🔍MagnifyGlass.InfoPanelAccentColor"];
    if (accentColor) {
      const normalizedAccentColor = accentColor.startsWith("#") ? accentColor : `#${accentColor}`;
      this.elements.panel.style.setProperty("--info-panel-accent-color", normalizedAccentColor);
    }
    if (this.stateManager.state.isPanelVisible) {
      const opacityPercent = settings["🔍MagnifyGlass.InfoPanelOpacity"];
      this.elements.panel.style.opacity = (opacityPercent / 100).toString();
    }
    this.elements.panel.style.cssText = `
            position: absolute;
            width: ${settings["🔍MagnifyGlass.InfoPanelWidth"]}px;
            max-height: ${settings["🔍MagnifyGlass.InfoPanelMaxHeight"]}px;
            z-index: 99999;
            display: none;
            opacity: 0;
            transform: translateY(-10px);
            transition: ${settings["🔍MagnifyGlass.InfoPanelAnimations"] ? "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" : "none"};
            pointer-events: auto;
            user-select: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ${textColor ? `--info-panel-text-color: ${textColor.startsWith("#") ? textColor : `#${textColor}`};` : ""}
            ${accentColor ? `--info-panel-accent-color: ${accentColor.startsWith("#") ? accentColor : `#${accentColor}`};` : ""}
        `;
  }
  /**
   * Show the panel.
   */
  show() {
    if (!this.elements.panel) return;
    if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"]) {
      this.elements.panel.style.display = "block";
      const opacityPercent = this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelOpacity"];
      this.elements.panel.style.opacity = (opacityPercent / 100).toString();
      this.elements.panel.offsetHeight;
      this.elements.panel.classList.add("visible");
      this.stateManager.state.isPanelVisible = true;
    }
  }
  /**
   * Hide the panel.
   */
  hide() {
    if (!this.elements.panel) return;
    this.elements.panel.classList.remove("visible");
    setTimeout(() => {
      if (!this.stateManager.state.isPanelVisible && this.elements.panel) {
        this.elements.panel.style.display = "none";
        if (this.elements.controls) {
          this.elements.controls.style.display = "none";
        }
      }
    }, this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelAnimations"] ? 300 : 0);
    this.stateManager.state.isPanelVisible = false;
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
    if (settings["🔍MagnifyGlass.ShowInspectorTab"]) {
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
      const nodeType = info.hoveredNode.type ? info.hoveredNode.type.toLowerCase() : "";
      const isSaveNode = nodeType.includes("save") && !nodeType.includes("checkpoint") && !nodeType.includes("model") && !nodeType.includes("preview");
      const showAllWidgets = info.hoveredNode.type && (nodeType.includes("ksampler") || nodeType.includes("sampler") || nodeType.includes("k_samplers") || nodeType.includes("checkpoint") || nodeType.includes("model") || nodeType.includes("lora") || nodeType.includes("controlnet") || nodeType.includes("advanced") || nodeType.includes("detailer") || nodeType.includes("inpaint") || nodeType.includes("upscale") || nodeType.includes("clip") || nodeType.includes("text") || nodeType.includes("encode")) && !isSaveNode;
      if (!showAllWidgets) {
        const checkpointInfo = this.getCheckpointInfo(info.hoveredNode);
        if (checkpointInfo) {
          nodeContent.push({ label: "Model", value: checkpointInfo });
        }
        const imageInfo = this.getImageInfo(info.hoveredNode);
        if (imageInfo) {
          if (typeof imageInfo === "string") {
            nodeContent.push({ label: "Image", value: imageInfo });
          } else if (typeof imageInfo === "object" && imageInfo !== null) {
            const imgInfoAny = imageInfo;
            nodeContent.push({ label: "Image Size", value: `${imgInfoAny.width}×${imgInfoAny.height}` });
            if (imgInfoAny.src) {
              nodeContent.push({ label: "Image Source", value: imgInfoAny.src });
            }
          }
        }
        const textBoxContent = this.getTextBoxContent(info.hoveredNode);
        if (textBoxContent) {
          nodeContent.push({ label: "Text", value: textBoxContent });
        }
      }
      const importantParameters = this.getImportantNodeParameters(info.hoveredNode);
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
      const value = this.formatValue(item.value, item.label);
      const valueClass = this.getValueClass(item.value);
      const valueAttributes = this.getValueAttributes(item.value);
      return `
                            <div class="info-row">
                                <span class="info-label">${item.label}</span>
                                <span class="info-value ${valueClass}" ${valueAttributes}>${value}</span>
                            </div>`;
    }).join("")}
                    </div>
                </div>
            </div>
        `).join("");
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
   * Format a value for display.
   * @param value 
   * @param label
   * @returns 
   */
  formatValue(value, label) {
    if (value === null || value === void 0) return "";
    const str = String(value);
    if (label && (label.toLowerCase().includes("text") || label.toLowerCase().includes("prompt") || label.toLowerCase().includes("model") || label.toLowerCase().includes("file") || label.toLowerCase().includes("conditioning") || label.toLowerCase().includes("positive") || label.toLowerCase().includes("negative"))) {
      return str;
    }
    return str;
  }
  /**
   * Get value class for styling.
   * @param value 
   * @returns 
   */
  getValueClass(value) {
    if (!value) return "";
    const str = String(value);
    let classes = [];
    if (str.length > 100) {
      classes.push("long-text");
    }
    return classes.join(" ");
  }
  /**
   * Get value attributes.
   * @param value 
   * @returns 
   */
  getValueAttributes(value) {
    if (!value) return "";
    const str = String(value);
    if (str.length > 500) {
      return `title="${str.replace(/"/g, "&quot;")}"`;
    }
    return "";
  }
  /**
   * Update header subtitle.
   * @param info 
   */
  updateHeaderSubtitle(info) {
    if (!this.elements.header) return;
    const subtitleElement = this.elements.header.querySelector(".header-subtitle");
    if (subtitleElement) {
      const accentColor = this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelAccentColor"];
      if (info.hoveredNode) {
        subtitleElement.textContent = `Analyzing: ${info.hoveredNode.title}`;
        subtitleElement.style.color = accentColor || "";
      } else if (info.media) {
        subtitleElement.textContent = `Media: ${info.media.tagName}`;
        subtitleElement.style.color = accentColor || "";
      } else if (info.connection) {
        subtitleElement.textContent = `Connection: ${info.connection.type}`;
        subtitleElement.style.color = accentColor || "";
      } else {
        subtitleElement.textContent = "Real-time analysis";
        subtitleElement.style.color = "";
      }
    }
  }
  // ============== Helper methods for node information extraction ==============
  /**
   * Get checkpoint/model info from a node.
   * @param nodeInfo 
   * @returns 
   */
  getCheckpointInfo(nodeInfo) {
    if (nodeInfo.type && (nodeInfo.type.includes("CheckpointLoader") || nodeInfo.type.includes("LoadCheckpoint") || nodeInfo.type.includes("ModelLoader") || nodeInfo.type.includes("UNETLoader") || nodeInfo.type.includes("VAELoader") || nodeInfo.type.includes("LoraLoader"))) {
      if (nodeInfo.widgets && nodeInfo.widgets.length > 0) {
        for (const widget of nodeInfo.widgets) {
          if (widget.name && (widget.name.toLowerCase().includes("model") || widget.name.toLowerCase().includes("checkpoint") || widget.name.toLowerCase().includes("ckpt") || widget.name.toLowerCase().includes("lora") || widget.name.toLowerCase().includes("vae") || widget.name.toLowerCase().includes("file"))) {
            const value = String(widget.value);
            const filename = value.split(/[\/\\]/).pop();
            return filename || value;
          }
        }
      }
    }
    return null;
  }
  /**
   * Get image info from a node.
   * @param nodeInfo 
   * @returns 
   */
  getImageInfo(nodeInfo) {
    if (nodeInfo.type && (nodeInfo.type.includes("SaveImage") || nodeInfo.type.includes("PreviewImage") || nodeInfo.type.includes("VisionOutput") || nodeInfo.type.includes("ImageOutput") || nodeInfo.type.includes("LoadImage") || nodeInfo.type.includes("Display"))) {
      if (nodeInfo.widgets) {
        for (const widget of nodeInfo.widgets) {
          if (widget.name && (widget.name.toLowerCase().includes("image") || widget.name.toLowerCase().includes("filename") || widget.name.toLowerCase().includes("file"))) {
            return widget.value;
          }
        }
      }
      if (nodeInfo.properties && nodeInfo.properties.img) {
        const img = nodeInfo.properties.img;
        return {
          width: img.width || "unknown",
          height: img.height || "unknown",
          src: img.src ? img.src.split(/[\/\\]/).pop() : "Preview available"
        };
      }
      if (nodeInfo.outputs) {
        for (const output of nodeInfo.outputs) {
          if (output.links && output.links.length > 0) {
            return "Image connected to " + output.links.length + " node(s)";
          }
        }
      }
      return "Image node";
    }
    return null;
  }
  /**
   * Get text box content from a node.
   * @param nodeInfo 
   * @returns 
   */
  getTextBoxContent(nodeInfo) {
    if (nodeInfo.widgets && nodeInfo.widgets.length > 0) {
      if (nodeInfo.type && nodeInfo.type.includes("CLIPTextEncode")) {
        for (const widget of nodeInfo.widgets) {
          if (widget.name === "text" && typeof widget.value === "string") {
            return widget.value;
          }
        }
      }
      for (const widget of nodeInfo.widgets) {
        if ((widget.name.toLowerCase().includes("prompt") || widget.name.toLowerCase().includes("conditioning")) && typeof widget.value === "string" && widget.value.length > 0) {
          return widget.value;
        }
      }
      for (const widget of nodeInfo.widgets) {
        if ((widget.type === "text" || widget.type === "textarea" || widget.type === "string" || widget.name.toLowerCase().includes("text")) && typeof widget.value === "string" && widget.value.length > 0) {
          return widget.value;
        }
      }
    }
    return null;
  }
  /**
   * Get important node parameters based on node type.
   * @param nodeInfo 
   * @returns 
   */
  getImportantNodeParameters(nodeInfo) {
    const parameters = [];
    const nodeType = nodeInfo.type ? nodeInfo.type.toLowerCase() : "";
    const isSaveNode = nodeType.includes("save") && !nodeType.includes("checkpoint") && !nodeType.includes("model") && !nodeType.includes("preview");
    const showAllWidgets = nodeInfo.type && (nodeType.includes("ksampler") || nodeType.includes("sampler") || nodeType.includes("k_samplers") || nodeType.includes("checkpoint") || nodeType.includes("model") || nodeType.includes("lora") || nodeType.includes("controlnet") || nodeType.includes("advanced") || nodeType.includes("detailer") || nodeType.includes("inpaint") || nodeType.includes("upscale") || nodeType.includes("clip") || nodeType.includes("text") || nodeType.includes("encode")) && !isSaveNode;
    if (showAllWidgets) {
      if (nodeInfo.widgets && nodeInfo.widgets.length > 0) {
        for (const widget of nodeInfo.widgets) {
          if (widget.name && widget.name !== "") {
            const widgetName = widget.name.toLowerCase();
            if (widgetName.includes("title") || widgetName === "node" || widgetName === "id" || widgetName === "type" || widgetName === "mode") {
              continue;
            }
            parameters.push({
              label: widget.name,
              value: this.formatWidgetValue(widget.value)
            });
          }
        }
      }
      return parameters;
    }
    let importantParams;
    if (isSaveNode) {
      importantParams = [
        "filename_prefix",
        "filename",
        "directory",
        "path",
        "format",
        "quality",
        "extension"
      ];
    } else {
      importantParams = [
        "seed",
        "steps",
        "cfg",
        "scale",
        "sampler",
        "scheduler",
        "positive",
        "negative",
        "width",
        "height",
        "denoise",
        "strength",
        "noise",
        "count",
        "batch",
        "size",
        "phase",
        "color",
        "intensity",
        // KSampler specific parameters (for other samplers)
        "control_after_generate",
        "control",
        "after",
        "generate",
        "start_at_step",
        "end_at_step",
        "start",
        "end",
        "return_with_leftover_noise",
        "leftover",
        "noise_return",
        // Additional common parameters (but avoid duplicates with specific extractors)
        "model",
        "vae",
        "clip",
        "lora",
        "checkpoint",
        "latent",
        "image",
        "mask",
        "filename",
        "directory",
        "prompt",
        "conditioning",
        "filename_prefix",
        // New detection vocabulary
        "resolution",
        "num_chunks",
        "seconds",
        "aspect_ratio",
        "style_type",
        "background",
        "n",
        "human",
        "raw",
        "guidance",
        "skip_preprocessing",
        "movement_amplitude",
        "animation",
        "material_type",
        "b1",
        "b2",
        "s1",
        "s2",
        "type",
        "channel",
        "sigma",
        "rho",
        // Additional detection vocabulary
        "alpha",
        "base_shift",
        "shift",
        "stretch",
        "terminal",
        "spacing",
        "style",
        "eta",
        "norm_threshold",
        "momentum",
        "hypernetwork_name",
        "reuse_threshold",
        "verbose",
        "layers",
        "set_cond_area",
        "audioui",
        // Camera and 3D parameters
        "camera_pose",
        "fx",
        "cx",
        "fy",
        "cy"
        // Note: 'text' and 'string' removed to avoid duplication with getTextBoxContent
      ];
    }
    if (nodeInfo.widgets && nodeInfo.widgets.length > 0) {
      for (const widget of nodeInfo.widgets) {
        const paramName = widget.name.toLowerCase();
        if (importantParams.some((param) => paramName.includes(param))) {
          parameters.push({
            label: widget.name,
            value: this.formatWidgetValue(widget.value)
          });
        }
      }
    }
    return parameters;
  }
  /**
   * Format widget value for display.
   * @param value 
   * @returns 
   */
  formatWidgetValue(value) {
    if (value === null) return "null";
    if (value === void 0) return "undefined";
    if (typeof value === "string") {
      return value;
    }
    if (typeof value === "number") {
      return Number.isInteger(value) ? value.toString() : value.toFixed(3);
    }
    if (typeof value === "boolean") return value.toString();
    if (Array.isArray(value)) {
      return `Array(${value.length})`;
    }
    if (typeof value === "object") {
      return "Object";
    }
    return String(value);
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
