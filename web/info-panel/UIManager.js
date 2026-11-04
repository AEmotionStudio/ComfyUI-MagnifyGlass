var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { Icons } from "../shared/icons.js";
import { INFO_PANEL_ID } from "../shared/constants.js";
import { DEFAULT_PANEL_SETTINGS } from "../shared/settings/defaults.js";
import "/scripts/app.js";
import { isUserTyping, setSettingValue, escapeHtml } from "../shared/utils.js";
import { isLongText, formatWidgetValue } from "./ValueFormatter.js";
import { getImportantNodeParameters } from "./NodeDataExtractor.js";
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
    // Updates the panel at once, for changes made without moving the mouse over the canvas
    __publicField(this, "onRefresh", null);
    // Nodes visited by jumps, for Back and Forward. Ids only mean something in the graph they came from
    __publicField(this, "history", { graph: null, ids: [], index: -1 });
    // Track active widget editors for cleanup
    __publicField(this, "activeEditors", /* @__PURE__ */ new Map());
    // Track active inline controls for cleanup
    __publicField(this, "activeInlineControls", /* @__PURE__ */ new Map());
    // Track active drag controllers for cleanup
    __publicField(this, "activeDragControllers", /* @__PURE__ */ new Map());
    // What the content was last rendered from; emptied when hide() tears the controls down
    __publicField(this, "renderKey", []);
    // Long values the user expanded, by node id and label, so a re-render keeps them open
    __publicField(this, "expandedValues", /* @__PURE__ */ new Set());
    // Hotkey handler for Focus Node
    __publicField(this, "hotkeyHandler", null);
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
    this.setupHotkeys();
  }
  /**
   * Create the main panel and its components.
   */
  createPanel() {
    this.elements.panel = document.createElement("div");
    this.elements.panel.id = INFO_PANEL_ID;
    this.elements.panel.className = "magnify-info-panel";
    this.elements.panel.style.display = "none";
    this.elements.panel.setAttribute("role", "region");
    this.elements.panel.setAttribute("aria-label", "Node inspector");
    this.elements.header = document.createElement("div");
    this.elements.header.className = "panel-header";
    this.elements.header.innerHTML = `
            <div class="header-identity">
                <span class="header-title"></span>
                <span class="header-id"></span>
                <span class="header-badge"></span>
            </div>
            <button class="copy-btn" title="Copy title and id" aria-label="Copy title and id" data-action="copy">${Icons.copy}</button>
            <button class="control-btn lock-node-btn" aria-pressed="false" data-action="lock-node">${Icons.lock}</button>
            <button class="control-btn minimize-btn" title="Minimize Panel" aria-label="Minimize Panel" aria-expanded="true" data-action="minimize">${Icons.minus}</button>
        `;
    const nav = document.createElement("div");
    nav.className = "panel-nav";
    nav.setAttribute("role", "toolbar");
    nav.setAttribute("aria-label", "Node navigation");
    nav.innerHTML = `
            <button class="control-btn" title="Back" aria-label="Back" data-action="back">${Icons.arrowLeft}</button>
            <button class="control-btn" title="Forward" aria-label="Forward" data-action="forward">${Icons.arrowRight}</button>
            <button class="control-btn" title="Previous in execution order (←)" aria-label="Previous in execution order" data-action="prev-node">${Icons.chevronLeft}</button>
            <button class="control-btn" title="Next in execution order (→)" aria-label="Next in execution order" data-action="next-node">${Icons.chevronRight}</button>
            <button class="control-btn" title="Centre on node (*)" aria-label="Centre on node" data-action="focus-node">${Icons.focus}</button>
            <button class="goto-btn" aria-haspopup="listbox" aria-expanded="false" data-action="go-to-node">${Icons.magnifyGlass}<span>Go to node…</span></button>
        `;
    const breadcrumb = document.createElement("div");
    breadcrumb.className = "panel-breadcrumb";
    breadcrumb.hidden = true;
    this.elements.content = document.createElement("div");
    this.elements.content.className = "panel-content";
    const resize = document.createElement("div");
    resize.className = "panel-resize";
    resize.title = "Resize";
    this.elements.panel.append(this.elements.header, nav, breadcrumb, this.elements.content, resize);
    this.renderHeader(null);
    this.applyStyles();
    this.updateMinimizedState();
    document.body.appendChild(this.elements.panel);
    this.elements.panel.addEventListener("click", (e) => {
      const target = e.target;
      const button = target.closest("button[data-action]");
      if (button && !button.disabled) {
        this.handlePanelAction(button);
      }
    });
    this.elements.panel.addEventListener("mouseleave", () => {
      const focused = document.activeElement;
      if (focused && this.elements.panel.contains(focused) && !isUserTyping()) focused.blur();
    });
    this.elements.header.addEventListener("dblclick", (e) => {
      if (e.target.closest("button")) return;
      this.toggleMinimized();
    });
    if (!this.elements.controls) {
      this.createFloatingControls();
      this.updateControlStates();
    }
  }
  handlePanelAction(button) {
    var _a;
    const state = this.stateManager.state;
    switch (button.dataset.action) {
      case "minimize":
        this.toggleMinimized();
        break;
      case "lock-node":
        this.lockTo(state.lockedNodeId === null ? state.currentNodeId : null);
        (_a = this.onRefresh) == null ? void 0 : _a.call(this);
        break;
      case "back":
        this.goThroughHistory(-1);
        break;
      case "forward":
        this.goThroughHistory(1);
        break;
      case "prev-node":
        this.navigateExecOrder(-1);
        break;
      case "next-node":
        this.navigateExecOrder(1);
        break;
      case "focus-node":
        this.focusCurrentNode();
        break;
      case "go-to-node":
        if (this.currentDropdown) {
          this.hideDropdown();
        } else {
          this.showNodePicker(button);
        }
        break;
      case "copy":
        this.copyValue(button);
        break;
      case "expand-value": {
        const row = button.closest(".info-row");
        const key = row.dataset.expandKey;
        const expanded = !this.expandedValues.has(key);
        if (expanded) {
          this.expandedValues.add(key);
        } else {
          this.expandedValues.delete(key);
        }
        row.classList.toggle("is-expanded", expanded);
        button.textContent = expanded ? "Show less" : "Show more";
        button.setAttribute("aria-expanded", String(expanded));
        break;
      }
      case "enter-subgraph": {
        const node = state.currentNodeId === null ? null : this.nodeSelector.getNodeById(state.currentNodeId);
        if (node == null ? void 0 : node.subgraph) {
          this.lockTo(null);
          app.canvas.openSubgraph(node.subgraph, node);
        }
        break;
      }
    }
  }
  toggleMinimized() {
    this.stateManager.toggleMinimized();
    this.stateManager.saveLayout();
    this.updateMinimizedState();
  }
  /**
   * Lock the panel to a node of the graph on screen, or release it with null.
   */
  lockTo(nodeId) {
    var _a;
    this.stateManager.state.lockedNodeId = nodeId;
    this.stateManager.state.lockedGraph = (_a = app.canvas) == null ? void 0 : _a.graph;
  }
  /**
   * Switch between following the glass and floating. A hidden glass cannot be followed.
   */
  toggleFloating() {
    var _a;
    const state = this.stateManager.state;
    if (state.isFloating && !state.isGlassPreviewVisible) return;
    state.isFloating = !state.isFloating;
    this.stateManager.saveLayout();
    this.updateControlStates();
    (_a = this.onRefresh) == null ? void 0 : _a.call(this);
  }
  /**
   * Sticky from the toolbar, the eye button and the S key. The settings dialog and the sidebar
   * save the setting themselves, and its onChange updates the toolbar.
   */
  setPersist(persist) {
    var _a;
    this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"] = persist;
    setSettingValue("🔍MagnifyGlass.InfoPanelPersist", persist);
    this.updateControlStates();
    (_a = this.onRefresh) == null ? void 0 : _a.call(this);
  }
  /**
   * Create the toolbar: panel, glass and pop-out groups with a fixed set of buttons.
   */
  createFloatingControls() {
    this.elements.controls = document.createElement("div");
    this.elements.controls.className = "floating-controls vertical-layout";
    this.elements.controls.setAttribute("role", "toolbar");
    this.elements.controls.setAttribute("aria-label", "Inspector and glass");
    this.elements.controls.innerHTML = `
            <button class="control-btn" aria-pressed="false" data-action="float">${Icons.pin}</button>
            <button class="control-btn" aria-pressed="false" data-action="persist">${Icons.magnet}</button>
            <button class="control-btn" aria-pressed="false" data-action="follow-selection">${Icons.selection}</button>
            <button class="control-btn" aria-pressed="true" data-action="toggle-panel">${Icons.eye}</button>
            <span class="controls-divider" role="separator"></span>
            <button class="control-btn" aria-pressed="true" data-action="toggle-glass">${Icons.magnifyGlass}</button>
            <button class="control-btn" aria-pressed="false" data-action="toggle-cursor">${Icons.cursor}</button>
            <button class="control-btn" aria-pressed="false" data-action="drag-glass">${Icons.move}</button>
            <button class="control-btn" title="Reset Glass Position (O)" aria-label="Reset Glass Position (O)" data-action="reset-glass">${Icons.reset}</button>
            <span class="controls-divider" role="separator"></span>
            <button class="control-btn" aria-pressed="false" data-action="popout">${Icons.externalLink}</button>
        `;
    document.body.appendChild(this.elements.controls);
    this.elements.controls.style.display = "none";
    this.elements.controls.style.visibility = "hidden";
    this.elements.controls.style.left = "-9999px";
    this.elements.controls.style.top = "-9999px";
    this.elements.controls.addEventListener("click", (e) => {
      const button = e.target.closest("button[data-action]");
      if (button) this.handleControlAction(button.dataset.action);
    });
    this.updateControlsLayout(String(this.stateManager.state.settings["🔍MagnifyGlass.ControlsPosition"]));
    this.updateControlStates();
  }
  handleControlAction(action) {
    var _a, _b, _c, _d, _e, _f, _g;
    const state = this.stateManager.state;
    const settings = state.settings;
    const glass = window.comfyUIMagnifyGlass;
    switch (action) {
      case "float":
        this.toggleFloating();
        break;
      case "persist":
        this.setPersist(!settings["🔍MagnifyGlass.InfoPanelPersist"]);
        break;
      case "follow-selection": {
        const follow = !settings["🔍MagnifyGlass.InfoPanelFollowSelection"];
        settings["🔍MagnifyGlass.InfoPanelFollowSelection"] = follow;
        setSettingValue("🔍MagnifyGlass.InfoPanelFollowSelection", follow);
        this.updateControlStates();
        (_a = this.onRefresh) == null ? void 0 : _a.call(this);
        break;
      }
      case "toggle-panel":
        if (state.isPanelVisible) {
          this.hide();
          this.setPersist(false);
        } else {
          this.show();
        }
        break;
      case "toggle-glass":
        state.isGlassPreviewVisible = !state.isGlassPreviewVisible;
        if (!state.isGlassPreviewVisible && !state.isFloating) {
          if (state.isPanelVisible) {
            const rect = this.elements.panel.getBoundingClientRect();
            state.floatPosition = { x: rect.left, y: rect.top };
          }
          state.isFloating = true;
          this.stateManager.saveLayout();
        }
        this.updateControlStates();
        glass == null ? void 0 : glass.setGlassPreviewActive(state.isGlassPreviewVisible);
        break;
      case "toggle-cursor":
        if (glass == null ? void 0 : glass.config) {
          glass.config.showCursorPreview = !glass.config.showCursorPreview;
          setSettingValue("🔍MagnifyGlass.ShowCursorPreview", glass.config.showCursorPreview);
          glass.updateMagnifiedView();
          this.updateControlStates();
        }
        break;
      case "drag-glass":
        if (glass == null ? void 0 : glass.state) {
          glass.state.isDragModeEnabled = !glass.state.isDragModeEnabled;
          (_c = (_b = glass.ui) == null ? void 0 : _b.setDragMode) == null ? void 0 : _c.call(_b, glass.state.isDragModeEnabled);
          this.updateControlStates();
        }
        break;
      case "reset-glass":
        if (glass) {
          glass.resetOffsets();
          if ((_d = glass.state) == null ? void 0 : _d.isDragModeEnabled) {
            glass.state.isDragModeEnabled = false;
            (_f = (_e = glass.ui) == null ? void 0 : _e.setDragMode) == null ? void 0 : _f.call(_e, false);
            this.updateControlStates();
          }
        }
        break;
      case "popout":
        (_g = glass == null ? void 0 : glass.popOutManager) == null ? void 0 : _g.toggle();
        break;
    }
  }
  /**
   * Update the toolbar's pressed states, titles and the buttons that cannot act right now.
   */
  updateControlStates() {
    var _a, _b, _c;
    const controls = this.elements.controls;
    if (!controls) return;
    const state = this.stateManager.state;
    const settings = state.settings;
    const glass = window.comfyUIMagnifyGlass;
    const glassVisible = state.isGlassPreviewVisible;
    const set = (action, pressed, title, disabled = false) => {
      const button = controls.querySelector(`[data-action="${action}"]`);
      button.classList.toggle("active", pressed);
      button.setAttribute("aria-pressed", String(pressed));
      button.title = title;
      button.setAttribute("aria-label", title);
      button.disabled = disabled;
    };
    set(
      "float",
      state.isFloating,
      !glassVisible ? "Floating: the glass preview is hidden" : state.isFloating ? "Floating: click to follow the glass (U)" : "Following the glass: click to float, or drag the header (U)",
      !glassVisible
    );
    set("persist", !!settings["🔍MagnifyGlass.InfoPanelPersist"], "Sticky: keep the last node over empty canvas (S)");
    set("follow-selection", !!settings["🔍MagnifyGlass.InfoPanelFollowSelection"], "Follow selection: show the selected node");
    const keepPanel = !glassVisible && state.isPanelVisible;
    set(
      "toggle-panel",
      state.isPanelVisible,
      keepPanel ? "The panel stays visible while the glass preview is hidden" : state.isPanelVisible ? "Hide Panel (I)" : "Show Panel (I)",
      keepPanel
    );
    set("toggle-glass", glassVisible, glassVisible ? "Hide Glass Preview (G)" : "Show Glass Preview (G)");
    const showCursor = !!((_a = glass == null ? void 0 : glass.config) == null ? void 0 : _a.showCursorPreview);
    set("toggle-cursor", showCursor, showCursor ? "Hide Cursor Preview" : "Show Cursor Preview", !glassVisible);
    const isDragMode = !!((_b = glass == null ? void 0 : glass.state) == null ? void 0 : _b.isDragModeEnabled);
    set("drag-glass", isDragMode, isDragMode ? "Cancel Move Mode (H)" : "Move Glass Position (H)", !glassVisible);
    controls.querySelector('[data-action="reset-glass"]').disabled = !glassVisible;
    const isOpen = !!((_c = glass == null ? void 0 : glass.popOutManager) == null ? void 0 : _c.isPopOutOpen());
    set("popout", isOpen, isOpen ? "Close Pop-out Viewer (Shift+P)" : "Open Pop-out Viewer (Shift+P)");
  }
  /**
   * A row above or below the panel, a column beside it.
   */
  updateControlsLayout(position) {
    if (!this.elements.controls) return;
    const horizontal = position.startsWith("top") || position.startsWith("bottom");
    this.elements.controls.classList.toggle("horizontal-layout", horizontal);
    this.elements.controls.classList.toggle("vertical-layout", !horizontal);
  }
  /**
   * Apply current styles to elements.
   */
  applyStyles() {
    if (!this.elements.panel) return;
    const settings = this.stateManager.state.settings;
    const style = this.elements.panel.style;
    style.width = `${settings["🔍MagnifyGlass.InfoPanelWidth"]}px`;
    style.setProperty("--panel-max-height", `${settings["🔍MagnifyGlass.InfoPanelMaxHeight"]}px`);
    style.setProperty("--panel-opacity", `${Number(settings["🔍MagnifyGlass.InfoPanelOpacity"]) || 100}%`);
    const fontFamily = settings["🔍MagnifyGlass.InfoPanelFontFamily"];
    if (fontFamily === "System Default") {
      style.fontFamily = "inherit";
    } else if (fontFamily === "monospace") {
      style.fontFamily = "'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, monospace";
    } else {
      style.fontFamily = `'${fontFamily}', Inter, Arial, sans-serif`;
    }
    style.fontSize = `${settings["🔍MagnifyGlass.InfoPanelFontSize"] || 14}px`;
    const root = document.documentElement.style;
    for (const [property, key] of [["--mg-panel-fg", "🔍MagnifyGlass.InfoPanelTextColor"], ["--mg-panel-accent", "🔍MagnifyGlass.InfoPanelAccentColor"]]) {
      const color = String(settings[key] || "");
      if (color && color.toLowerCase() !== DEFAULT_PANEL_SETTINGS[key].toLowerCase()) {
        root.setProperty(property, color);
      } else {
        root.removeProperty(property);
      }
    }
    this.elements.panel.classList.toggle("high-contrast-text", !!settings["🔍MagnifyGlass.HighContrastText"]);
  }
  /**
   * Show the panel.
   */
  show() {
    if (!this.elements.panel) return;
    this.elements.panel.style.pointerEvents = "auto";
    this.elements.panel.style.display = "";
    this.stateManager.state.isPanelVisible = true;
    this.updateControlStates();
  }
  /**
   * Hide the panel.
   */
  hide() {
    if (!this.elements.panel) return;
    this.cleanupEditors();
    this.renderKey = [];
    this.hideDropdown();
    this.elements.panel.style.pointerEvents = "none";
    this.elements.panel.style.display = "none";
    this.stateManager.state.isPanelVisible = false;
    this.stateManager.state.isPanelHovered = false;
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
      minimizeBtn.innerHTML = this.stateManager.state.isPanelMinimized ? Icons.plus : Icons.minus;
      minimizeBtn.title = this.stateManager.state.isPanelMinimized ? "Expand Panel" : "Minimize Panel";
      minimizeBtn.setAttribute("aria-label", minimizeBtn.title);
      minimizeBtn.setAttribute("aria-expanded", String(!this.stateManager.state.isPanelMinimized));
    }
  }
  /**
   * Display information in the panel.
   * @param info
   */
  displayInfo(info) {
    const renderKey = this.getRenderKey(info);
    if (this.isEditing() || renderKey.length === this.renderKey.length && renderKey.every((v, i) => Object.is(v, this.renderKey[i]))) {
      return;
    }
    this.renderKey = renderKey;
    this.renderHeader(info.hoveredNode);
    this.renderContent(info.hoveredNode);
  }
  /**
   * Show the node's identity, its subgraph path and group, and which navigation applies.
   * The header is built once and only updated, so focus stays on its buttons.
   */
  renderHeader(node) {
    const panel = this.elements.panel;
    const state = this.stateManager.state;
    const find = (selector) => panel.querySelector(selector);
    const title = find(".header-title");
    title.textContent = node ? node.title : "Inspector";
    title.title = node ? node.title : "";
    title.classList.toggle("is-empty", !node);
    const id = find(".header-id");
    id.hidden = !node;
    id.textContent = node ? `#${node.id}` : "";
    const badge = find(".header-badge");
    badge.textContent = node ? node.type : "";
    badge.title = node ? node.type : "";
    badge.hidden = !node || badge.textContent === node.title;
    const copy = find('.panel-header [data-action="copy"]');
    copy.hidden = !node;
    copy.dataset.copyValue = node ? `${node.title} #${node.id}` : "";
    const locked = state.lockedNodeId !== null;
    const lock = find('[data-action="lock-node"]');
    lock.disabled = !node && !locked;
    lock.classList.toggle("active", locked);
    lock.setAttribute("aria-pressed", String(locked));
    lock.title = locked ? "Unlock: show the hovered node" : "Lock to this node";
    lock.setAttribute("aria-label", lock.title);
    find('[data-action="focus-node"]').disabled = !node;
    const { canBack, canForward } = this.getHistoryNav();
    find('[data-action="back"]').disabled = !canBack;
    find('[data-action="forward"]').disabled = !canForward;
    const breadcrumb = find(".panel-breadcrumb");
    const path = (node == null ? void 0 : node.graphPath.length) ? ["Root", ...node.graphPath] : [];
    breadcrumb.innerHTML = [
      path.map((name, i) => `<span class="crumb" title="${escapeHtml(name)}"${i === path.length - 1 ? ' aria-current="location"' : ""}>${escapeHtml(name)}</span>`).join('<span class="crumb-sep" aria-hidden="true">›</span>'),
      (node == null ? void 0 : node.group) ? `<span class="crumb-group" title="Group">${escapeHtml(node.group)}</span>` : "",
      (node == null ? void 0 : node.isSubgraph) ? '<button class="crumb-action" data-action="enter-subgraph">Enter subgraph</button>' : ""
    ].join("");
    breadcrumb.hidden = !breadcrumb.innerHTML;
  }
  /**
   * Whether Back and Forward have a jump to go to in the graph on screen.
   */
  getHistoryNav() {
    var _a;
    const history = this.history;
    const inHistory = history.ids.length > 0 && history.graph === ((_a = app.canvas) == null ? void 0 : _a.graph);
    const atEntry = history.ids[history.index] === this.stateManager.state.currentNodeId;
    return {
      canBack: inHistory && history.index >= (atEntry ? 1 : 0),
      canForward: inHistory && atEntry && history.index < history.ids.length - 1
    };
  }
  /**
   * Everything the rendered content depends on, compared value by value.
   */
  getRenderKey(info) {
    var _a;
    const state = this.stateManager.state;
    const key = [
      (_a = app.canvas) == null ? void 0 : _a.graph,
      state.settings["🔍MagnifyGlass.InfoPanelPersist"],
      state.showsSelection,
      state.lockedNodeId,
      state.isPanelMinimized
    ];
    const node = info.hoveredNode;
    if (node) {
      key.push(node.id, node.title, node.mode, node.executionOrder, node.group, node.graphPath.join("\n"));
      for (const widget of node.widgets) key.push(widget.value, widget.computedDisabled);
      for (const input of node.inputs) key.push(input.link);
    }
    return key;
  }
  /**
   * Widgets are editable when the shown node cannot change under the cursor on its way to the panel.
   */
  canEdit() {
    const state = this.stateManager.state;
    return !!state.settings["🔍MagnifyGlass.InfoPanelPersist"] || state.lockedNodeId !== null || state.showsSelection;
  }
  isEditing() {
    return this.activeEditors.size > 0 || [...this.activeDragControllers.values()].some((controller) => controller.isDragging) || [...this.activeInlineControls.values()].some((control) => control.isOpen());
  }
  /**
   * The node's rows: exec order, category and source path, then its widgets.
   */
  buildRows(node) {
    const rows = [];
    if (node.executionOrder !== void 0) {
      rows.push({ label: "Exec Order", value: node.executionOrder });
    }
    if (node.category) {
      rows.push({ label: "Category", value: node.category });
    }
    if (node.pythonModule) {
      rows.push({ label: "Path", value: node.pythonModule.replace(/\./g, "/") + ".py" });
    }
    rows.push(...getImportantNodeParameters(node));
    return rows;
  }
  /**
   * Render the node's rows, or the empty state when no node is shown.
   */
  renderContent(node) {
    if (!this.elements.content) return;
    this.cleanupEditors();
    if (!node) {
      this.elements.content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">${Icons.mapPin}</div>
                    <div class="empty-state-text">Empty canvas area</div>
                </div>
            `;
      return;
    }
    const canEdit = this.canEdit();
    const rows = this.buildRows(node);
    const copyTexts = [];
    this.elements.content.innerHTML = `
            <div class="info-rows">
                ${rows.map((item) => {
      const text = String(item.value ?? "");
      const isLong = isLongText(text);
      const expandKey = `${node.id}:${item.label}`;
      const isExpanded = isLong && this.expandedValues.has(expandKey);
      let value = escapeHtml(text);
      if (item.isLinked) {
        value += '<span class="linked-tag" title="Set by a link">linked</span>';
      }
      const nodeIdAttr = item.nodeId !== void 0 ? `data-node-id="${item.nodeId}"` : "";
      const isEditable = item.isEditable && canEdit && item.widgetName && item.nodeId !== void 0;
      const editableClass = isEditable ? "editable" : "";
      const constraintsJson = isEditable && item.constraints ? escapeHtml(JSON.stringify(item.constraints)) : "";
      const rawValueStr = isEditable ? typeof item.rawValue === "boolean" ? item.rawValue ? "true" : "false" : escapeHtml(String(item.rawValue ?? "")) : "";
      const editableAttrs = isEditable ? `data-editable="true" data-widget-name="${escapeHtml(item.widgetName)}" data-widget-type="${escapeHtml(item.widgetType || "text")}" data-raw-value="${rawValueStr}" data-constraints="${constraintsJson}"` : "";
      const isActionable = item.isActionable && item.widgetName && item.nodeId !== void 0;
      const actionableClass = isActionable ? "actionable" : "";
      const actionableAttrs = isActionable ? `data-actionable="true" data-widget-name="${escapeHtml(item.widgetName)}" data-widget-type="button"` : "";
      if (!isActionable) copyTexts.push(text);
      const copyButton = isActionable ? "" : `<button class="copy-btn" data-action="copy" title="Copy value" aria-label="Copy ${escapeHtml(item.label)}">${Icons.copy}</button>`;
      const expandButton = isLong ? `<button class="value-expand" data-action="expand-value" aria-expanded="${isExpanded}">${isExpanded ? "Show less" : "Show more"}</button>` : "";
      return `
                            <div class="info-row ${editableClass} ${actionableClass}${isExpanded ? " is-expanded" : ""}" ${nodeIdAttr} ${editableAttrs} ${actionableAttrs}${isLong ? ` data-expand-key="${escapeHtml(expandKey)}"` : ""}>
                                <span class="info-label">${escapeHtml(item.label).replace(/_/g, "_<wbr>")}</span>
                                <span class="info-value${isLong ? " is-clamped" : ""} original">${value}</span>
                                ${copyButton}
                                ${expandButton}
                                <div class="inline-control-container" style="display: none;"></div>
                                <div class="widget-editor-container" style="display: none;"></div>
                            </div>`;
    }).join("")}
                ${!canEdit && rows.some((item) => item.isEditable) ? '<button class="edit-hint" data-action="lock-node" title="Lock the panel to this node to edit its widgets">Lock to edit</button>' : ""}
            </div>`;
    this.elements.content.querySelectorAll(".copy-btn").forEach((button, i) => {
      button.dataset.copyValue = copyTexts[i];
    });
    if (canEdit) {
      this.attachEditableRowHandlers();
    }
    this.attachActionableRowHandlers();
  }
  /**
   * Attach handlers for actionable (button) widget rows.
   * Creates inline button controls that invoke widget callbacks.
   */
  attachActionableRowHandlers() {
    if (!this.elements.content) return;
    const actionableRows = this.elements.content.querySelectorAll('[data-actionable="true"]');
    actionableRows.forEach((row) => {
      const rowEl = row;
      const valueEl = rowEl.querySelector(".info-value.original");
      const inlineContainer = rowEl.querySelector(".inline-control-container");
      if (!valueEl || !inlineContainer) return;
      const nodeId = parseInt(rowEl.dataset.nodeId || "0", 10);
      const widgetName = rowEl.dataset.widgetName || "";
      if (isNaN(nodeId) || !widgetName) return;
      const controlKey = `action:${nodeId}:${widgetName}`;
      const control = InlineControlFactory.createControl({
        nodeId,
        widgetName,
        widgetType: "button",
        currentValue: widgetName,
        // Use widget name as button context
        onChange: () => {
        }
        // Buttons don't change values
      });
      if (control) {
        this.activeInlineControls.set(controlKey, control);
        inlineContainer.appendChild(control.element);
        inlineContainer.style.display = "flex";
        valueEl.style.display = "none";
      }
    });
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
        valueEl.tabIndex = 0;
        valueEl.setAttribute("role", "button");
        valueEl.setAttribute("aria-label", `Edit ${rowEl.querySelector(".info-label").textContent}`);
        valueEl.addEventListener("click", (e) => {
          e.stopPropagation();
          this.enterEditMode(rowEl, valueEl, editorContainer);
        });
        valueEl.addEventListener("keydown", (e) => {
          if (e.key !== "Enter" && e.key !== " ") return;
          e.preventDefault();
          e.stopPropagation();
          this.enterEditMode(rowEl, valueEl, editorContainer);
        });
      }
      if (DragValueController.isTypeSupported(widgetType) && !InlineControlFactory.shouldUseInlineControl(widgetType)) {
        const dragController = new DragValueController(rowEl, {
          nodeId,
          widgetName,
          constraints,
          onChange: (value) => {
            rowEl.dataset.rawValue = String(value);
            valueEl.textContent = formatWidgetValue(value, constraints.precision);
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
      valueEl.textContent = formatWidgetValue(actualValue ?? editor.getValue(), JSON.parse(row.dataset.constraints || "{}").precision);
      editor.destroy();
      this.activeEditors.delete(editorKey);
    }
    row.classList.remove("editing");
    valueEl.style.display = "";
    container.style.display = "none";
    container.innerHTML = "";
  }
  /**
   * Copy a button's value. navigator.clipboard is missing on plain http, such as ComfyUI opened
   * from another machine on the LAN, so fall back to a selected textarea there.
   */
  async copyValue(button) {
    const text = button.dataset.copyValue ?? "";
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.className = "copy-fallback";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      button.focus();
      if (!copied) {
        app.extensionManager.toast.add({ severity: "error", summary: "Copy failed", detail: "The browser blocked access to the clipboard.", life: 3e3 });
        return;
      }
    }
    button.innerHTML = Icons.check;
    button.classList.add("copied");
    setTimeout(() => {
      button.innerHTML = Icons.copy;
      button.classList.remove("copied");
    }, 1500);
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
   * Open the Go to node picker under its button. Typing filters by title, type or #id,
   * the arrows and Enter pick, and Escape or a pick returns focus to the button.
   */
  showNodePicker(anchor) {
    this.hideDropdown();
    const picker = document.createElement("div");
    picker.className = "node-selector-dropdown";
    picker.style.fontSize = this.elements.panel.style.fontSize;
    picker.innerHTML = `
            <input type="text" class="node-picker-filter" placeholder="Title, type or #id" role="combobox" aria-label="Go to node"
                aria-autocomplete="list" aria-expanded="true" aria-controls="magnify-node-picker-list">
            <div class="node-picker-list" id="magnify-node-picker-list" role="listbox" aria-label="Nodes"></div>
            <div class="node-picker-empty" hidden>No matching nodes</div>`;
    const filter = picker.querySelector("input");
    const list = picker.querySelector(".node-picker-list");
    const empty = picker.querySelector(".node-picker-empty");
    let entries = [];
    let active = -1;
    const setActive = (index, scroll = true) => {
      var _a;
      (_a = list.children[active]) == null ? void 0 : _a.classList.remove("active");
      active = entries.length ? Math.max(0, Math.min(index, entries.length - 1)) : -1;
      const item = list.children[active];
      if (item) {
        item.classList.add("active");
        if (scroll) item.scrollIntoView({ block: "nearest" });
        filter.setAttribute("aria-activedescendant", item.id);
      } else {
        filter.removeAttribute("aria-activedescendant");
      }
    };
    const render = () => {
      const current = this.stateManager.state.currentNodeId;
      entries = this.nodeSelector.search(filter.value);
      list.innerHTML = entries.map((node, i) => `
                <div class="dropdown-item" id="magnify-node-picker-${i}" role="option" aria-selected="${node.id === current}" data-index="${i}">
                    <span class="dropdown-item-order">${node.order >= 0 ? node.order : ""}</span>
                    <span class="dropdown-item-title">${escapeHtml(node.title)}</span>
                    <span class="dropdown-item-type">${escapeHtml(node.type)}</span>
                    <span class="dropdown-item-id">#${node.id}</span>
                </div>`).join("");
      empty.hidden = entries.length > 0;
      active = -1;
      setActive(filter.value ? 0 : entries.findIndex((node) => node.id === current));
    };
    const close = (refocus = true) => {
      this.hideDropdown();
      if (refocus) anchor.focus();
    };
    const pick = (index, refocus = true) => {
      const entry = entries[index];
      if (!entry) return;
      close(refocus);
      this.jumpToNode(entry.id);
    };
    filter.addEventListener("input", render);
    filter.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        setActive(active + 1);
      } else if (e.key === "ArrowUp") {
        setActive(active - 1);
      } else if (e.key === "Enter") {
        pick(active);
      } else if (e.key === "Escape") {
        close();
      } else {
        return;
      }
      e.preventDefault();
      e.stopPropagation();
    });
    list.addEventListener("mousedown", (e) => e.preventDefault());
    list.addEventListener("mouseover", (e) => {
      const item = e.target.closest(".dropdown-item");
      if (item) setActive(Number(item.dataset.index), false);
    });
    list.addEventListener("click", (e) => {
      const item = e.target.closest(".dropdown-item");
      if (item) pick(Number(item.dataset.index), false);
    });
    picker.addEventListener("focusout", (e) => {
      if (e.relatedTarget && !picker.contains(e.relatedTarget)) this.hideDropdown();
    });
    const onPointerDown = (e) => {
      if (!picker.contains(e.target) && !anchor.contains(e.target)) this.hideDropdown();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    this.currentDropdownCleanup = () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      anchor.setAttribute("aria-expanded", "false");
    };
    document.body.appendChild(picker);
    this.currentDropdown = picker;
    anchor.setAttribute("aria-expanded", "true");
    this.positionPicker(picker, anchor);
    render();
    filter.focus();
  }
  /**
   * Hide the Go to node picker.
   */
  hideDropdown() {
    var _a;
    const cleanup = this.currentDropdownCleanup;
    this.currentDropdownCleanup = null;
    cleanup == null ? void 0 : cleanup();
    (_a = this.currentDropdown) == null ? void 0 : _a.remove();
    this.currentDropdown = null;
  }
  /**
   * Below the button when there is room, otherwise above it, held by its bottom edge so filtering keeps it in place.
   * It lines up with the panel and is as wide.
   */
  positionPicker(picker, anchor) {
    const margin = 10;
    const gap = 4;
    const rect = anchor.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom - margin - gap;
    const spaceAbove = rect.top - margin - gap;
    if (spaceBelow >= 240 || spaceBelow >= spaceAbove) {
      picker.style.top = `${rect.bottom + gap}px`;
      picker.style.maxHeight = `${Math.max(100, spaceBelow)}px`;
    } else {
      picker.style.bottom = `${window.innerHeight - rect.top + gap}px`;
      picker.style.maxHeight = `${Math.max(100, spaceAbove)}px`;
    }
    const panelRect = this.elements.panel.getBoundingClientRect();
    picker.style.width = `${panelRect.width}px`;
    picker.style.left = `${Math.max(margin, Math.min(panelRect.left, window.innerWidth - margin - picker.offsetWidth))}px`;
  }
  /**
   * Panel hotkeys: * centres the canvas on the node, ←/→ step through execution order.
   * They act only while the panel is visible and hovered or focused; otherwise the glass keeps ←/→ for its nudge.
   */
  setupHotkeys() {
    this.hotkeyHandler = (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey || isUserTyping()) return;
      const { panel } = this.elements;
      const { isPanelVisible, isPanelHovered } = this.stateManager.state;
      if (!panel || !isPanelVisible || !(isPanelHovered || panel.contains(document.activeElement))) return;
      if (e.key === "*") {
        this.focusCurrentNode();
      } else if (e.key === "ArrowLeft") {
        this.navigateExecOrder(-1);
      } else if (e.key === "ArrowRight") {
        this.navigateExecOrder(1);
      } else {
        return;
      }
      e.preventDefault();
    };
    document.addEventListener("keydown", this.hotkeyHandler, true);
  }
  /**
   * Remove hotkey listeners
   */
  cleanupHotkeys() {
    if (this.hotkeyHandler) {
      document.removeEventListener("keydown", this.hotkeyHandler, true);
      this.hotkeyHandler = null;
    }
  }
  /**
   * Centre the canvas on a node and lock the panel to it, recording the jump for Back.
   */
  jumpToNode(nodeId) {
    const node = this.nodeSelector.getNodeById(nodeId);
    if (!node) return;
    this.recordCurrentNode();
    const history = this.history;
    if (history.ids[history.index] !== nodeId) {
      history.ids.splice(++history.index, Infinity, nodeId);
    }
    this.showNode(node);
  }
  /**
   * Back (-1) or Forward (1) through the jumps. Back from a node reached by hovering returns to the last jump.
   */
  goThroughHistory(step) {
    this.recordCurrentNode();
    const history = this.history;
    const atEntry = history.ids[history.index] === this.stateManager.state.currentNodeId;
    const index = atEntry ? history.index + step : step < 0 ? history.index : -1;
    const node = index >= 0 && index < history.ids.length ? this.nodeSelector.getNodeById(history.ids[index]) : null;
    if (!node) return;
    history.index = index;
    this.showNode(node);
  }
  /**
   * Add the shown node to the history, so Back returns to it. A new graph on screen starts a new history.
   */
  recordCurrentNode() {
    var _a;
    const graph = (_a = app.canvas) == null ? void 0 : _a.graph;
    if (this.history.graph !== graph) {
      this.history = { graph, ids: [], index: -1 };
    }
    const history = this.history;
    const current = this.stateManager.state.currentNodeId;
    if (current !== null && history.ids[history.index] !== current) {
      history.ids.splice(++history.index, Infinity, current);
    }
  }
  showNode(node) {
    var _a;
    this.lockTo(node.id);
    app.canvas.centerOnNode(node);
    (_a = this.onRefresh) == null ? void 0 : _a.call(this);
  }
  /**
   * Centre the canvas on the shown node and lock the panel to it.
   */
  focusCurrentNode() {
    const nodeId = this.stateManager.state.currentNodeId;
    if (nodeId !== null) this.jumpToNode(nodeId);
  }
  /**
   * Jump to the previous/next node by execution order, wrapping around.
   * From a node without an order, Next starts at the first node and Prev at the last.
   * @param direction -1 for previous, +1 for next
   */
  navigateExecOrder(direction) {
    const nodes = this.nodeSelector.getNodesSortedByExecOrder();
    if (nodes.length === 0) return;
    const index = nodes.findIndex((n) => n.id === this.stateManager.state.currentNodeId);
    const next = index === -1 ? direction > 0 ? 0 : nodes.length - 1 : (index + direction + nodes.length) % nodes.length;
    this.jumpToNode(nodes[next].id);
  }
  cleanup() {
    this.cleanupEditors();
    this.hideDropdown();
    this.cleanupHotkeys();
    document.documentElement.style.removeProperty("--mg-panel-fg");
    document.documentElement.style.removeProperty("--mg-panel-accent");
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
