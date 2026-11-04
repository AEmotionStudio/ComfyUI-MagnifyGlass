var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { BROADCAST_CHANNEL_NAME } from "../shared/constants.js";
import { Logger } from "../shared/logger.js";
import { WidgetSyncManager } from "../info-panel/widget-editors/WidgetSyncManager.js";
const SESSION_KEY = "magnifyglass-popout-session";
class PopOutManager {
  constructor(getStatus, onConnect) {
    __publicField(this, "channel", null);
    __publicField(this, "isOpen", false);
    __publicField(this, "popOutWindow", null);
    __publicField(this, "onStateChange", null);
    __publicField(this, "onNodeSelect", null);
    __publicField(this, "onWidgetEdit", null);
    __publicField(this, "pingInterval", null);
    // Pings since the last pong
    __publicField(this, "pendingPings", 0);
    // Closed from here: an announcing viewer waits until open() is called again
    __publicField(this, "dismissed", false);
    __publicField(this, "viewerHidden", false);
    __publicField(this, "session");
    __publicField(this, "viewerUrl");
    // The config last sent to the viewer, null until it connects
    __publicField(this, "sentConfig", null);
    __publicField(this, "onPageHide", () => {
      if (this.isOpen) this.sendMessage({ type: "close" });
    });
    /** Throttle frame sending to ~30fps */
    __publicField(this, "lastFrameTime", 0);
    __publicField(this, "FRAME_INTERVAL", 33);
    // ~30fps
    /** Unanswered pings, one a second, before the viewer counts as gone */
    __publicField(this, "PING_LIMIT", 5);
    this.getStatus = getStatus;
    this.onConnect = onConnect;
    this.session = sessionStorage.getItem(SESSION_KEY) ?? Math.random().toString(36).slice(2);
    sessionStorage.setItem(SESSION_KEY, this.session);
    this.viewerUrl = this.getViewerUrl();
    this.initChannel();
    window.addEventListener("pagehide", this.onPageHide);
  }
  /**
   * Get the URL for the pop-out viewer page, which sits at the web root next to this module's folder.
   */
  getViewerUrl() {
    const url = new URL(
      /* @vite-ignore */
      "../popout-viewer.html",
      import.meta.url
    );
    url.searchParams.set("v", "1.15.0");
    url.searchParams.set("session", this.session);
    return url.href;
  }
  /**
   * Open this session's BroadcastChannel; other ComfyUI tabs have their own.
   */
  initChannel() {
    try {
      this.channel = new BroadcastChannel(`${BROADCAST_CHANNEL_NAME}:${this.session}`);
      this.channel.onmessage = (event) => {
        this.handleMessage(event.data);
      };
    } catch (e) {
      Logger.error("[PopOut] Failed to create BroadcastChannel:", e);
    }
  }
  /**
   * Handle incoming messages from the viewer tab.
   */
  handleMessage(message) {
    var _a, _b;
    switch (message.type) {
      case "pong":
        this.pendingPings = 0;
        if (!this.isOpen && !this.dismissed) {
          this.isOpen = true;
          this.viewerHidden = false;
          this.sentConfig = null;
          this.startPing();
          if (this.onStateChange) this.onStateChange(true);
          this.onConnect();
        }
        if (this.isOpen) this.syncConfig();
        break;
      case "close":
        this.disconnect();
        break;
      case "visibility":
        this.viewerHidden = message.data;
        break;
      case "request-nodes":
        this.handleNodeListRequest(message.data);
        break;
      case "node-select":
        if (this.onNodeSelect && typeof message.data === "number") {
          this.onNodeSelect(message.data);
        }
        break;
      case "zoom-node":
        if (typeof message.data === "number") {
          const app = window.app;
          const node = (_b = (_a = app.canvas) == null ? void 0 : _a.graph) == null ? void 0 : _b.getNodeById(message.data);
          if (node) {
            app.canvas.centerOnNode(node);
          }
        }
        break;
      case "widget-edit":
        this.handleWidgetEdit(message.data);
        break;
      case "button-click":
        this.handleButtonClick(message.data);
        break;
    }
  }
  /**
   * Handle widget edit command from pop-out viewer.
   * Syncs the edit to the actual node widget on the canvas.
   */
  handleWidgetEdit(editData) {
    if (!editData || typeof editData.nodeId !== "number" || !editData.widgetName) {
      Logger.warn("[PopOut] Invalid widget edit data:", editData);
      return;
    }
    const result = WidgetSyncManager.syncWidgetValue(
      editData.nodeId,
      editData.widgetName,
      editData.value
    );
    if (result.success) {
      Logger.debug(`[PopOut] Widget edit synced: ${editData.widgetName} = ${editData.value}`);
      if (this.onWidgetEdit) {
        this.onWidgetEdit();
      }
    } else {
      Logger.warn(`[PopOut] Widget edit failed: ${result.error}`);
    }
  }
  /**
   * Handle button click command from pop-out viewer.
   * Invokes the widget's callback function.
   */
  handleButtonClick(buttonData) {
    var _a, _b;
    if (!buttonData || typeof buttonData.nodeId !== "number" || !buttonData.widgetName) {
      Logger.warn("[PopOut] Invalid button click data:", buttonData);
      return;
    }
    const app = window.app;
    const node = (_b = (_a = app == null ? void 0 : app.canvas) == null ? void 0 : _a.graph) == null ? void 0 : _b.getNodeById(buttonData.nodeId);
    if (!(node == null ? void 0 : node.widgets)) {
      Logger.warn(`[PopOut] Node ${buttonData.nodeId} not found or has no widgets`);
      return;
    }
    const widget = node.widgets.find((w) => w.name === buttonData.widgetName);
    if (widget && typeof widget.callback === "function") {
      try {
        widget.callback(widget.value, app.canvas, node, [0, 0], null);
        Logger.debug(`[PopOut] Button ${buttonData.widgetName} clicked successfully`);
      } catch (error) {
        Logger.warn(`[PopOut] Button callback failed:`, error);
      }
    } else {
      Logger.warn(`[PopOut] Widget ${buttonData.widgetName} not found or has no callback`);
    }
  }
  /**
   * Open the pop-out viewer in a popup window.
   */
  open() {
    var _a;
    this.dismissed = false;
    if (this.isOpen) {
      (_a = this.popOutWindow) == null ? void 0 : _a.focus();
      return;
    }
    this.popOutWindow = window.open(this.viewerUrl, "MagnifyGlassPopout", "popup,width=1100,height=720");
    if (!this.popOutWindow) {
      Logger.error("[PopOut] Failed to open the viewer - popup may be blocked");
    }
  }
  /**
   * Close the pop-out viewer tab.
   */
  close() {
    var _a;
    if (!this.isOpen) return;
    this.dismissed = true;
    this.sendMessage({ type: "close" });
    (_a = this.popOutWindow) == null ? void 0 : _a.close();
    this.popOutWindow = null;
    this.disconnect();
  }
  /**
   * Mark the viewer as gone. It announces itself again while it is alive.
   */
  disconnect() {
    this.stopPing();
    if (!this.isOpen) return;
    this.isOpen = false;
    if (this.onStateChange) this.onStateChange(false);
  }
  /**
   * Toggle the pop-out state.
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
  /**
   * Check if the pop-out tab is currently open.
   */
  isPopOutOpen() {
    return this.isOpen;
  }
  /**
   * Send a frame to the pop-out viewer, unless it is hidden.
   * Throttled to ~30fps for performance.
   * @param canvas - The source canvas to send
   */
  sendFrame(canvas) {
    if (!this.isOpen || this.viewerHidden || !this.channel) return;
    const now = Date.now();
    if (now - this.lastFrameTime < this.FRAME_INTERVAL) {
      return;
    }
    this.lastFrameTime = now;
    try {
      this.sendMessage({ type: "frame", data: canvas.toDataURL("image/png") });
    } catch (e) {
      Logger.error("[PopOut] Failed to send frame:", e);
    }
  }
  /**
   * Send the theme and the glass and Inspector state when they change.
   */
  syncConfig() {
    const config = {
      theme: document.body.classList.contains("dark-theme") ? "dark" : "light",
      ...this.getStatus()
    };
    const json = JSON.stringify(config);
    if (json === this.sentConfig) return;
    this.sentConfig = json;
    this.sendMessage({ type: "config", data: config });
  }
  /**
   * Send inspector info to the pop-out viewer.
   * @param info - Inspector panel information
   */
  sendInfo(info) {
    if (!this.isOpen || !this.channel) return;
    const sanitizedInfo = this.sanitizeInfo(info);
    this.sendMessage({
      type: "info",
      data: sanitizedInfo || void 0
    });
  }
  /**
   * Handle node list request from popout viewer.
   * Fetches nodes from canvas and sends them to the popout.
   */
  handleNodeListRequest(sortBy) {
    var _a, _b;
    if (!this.channel) return;
    try {
      const app = window.app;
      const nodes = ((_b = (_a = app == null ? void 0 : app.canvas) == null ? void 0 : _a.graph) == null ? void 0 : _b._nodes) || [];
      let nodeList;
      if (sortBy === "execOrder") {
        nodeList = nodes.map((n) => ({
          id: n.id,
          title: n.title || "Untitled",
          type: n.type || "Unknown",
          order: n.order ?? -1
        })).filter((n) => n.order >= 0).sort((a, b) => a.order - b.order);
      } else if (sortBy === "id") {
        nodeList = nodes.map((n) => ({
          id: n.id,
          title: n.title || "Untitled",
          type: n.type || "Unknown"
        })).sort((a, b) => a.id - b.id);
      } else {
        nodeList = nodes.map((n) => ({
          id: n.id,
          title: n.title || "Untitled",
          type: n.type || "Unknown"
        })).sort((a, b) => a.title.localeCompare(b.title));
      }
      this.sendMessage({
        type: "nodes-list",
        data: { nodes: nodeList, sortBy }
      });
      Logger.debug(`[PopOut] Sent ${nodeList.length} nodes to viewer (sorted by ${sortBy})`);
    } catch (e) {
      Logger.error("[PopOut] Failed to get node list:", e);
    }
  }
  /**
   * Sanitize info object for BroadcastChannel transfer.
   * Removes functions, circular references, and non-serializable data.
   * Handles both GatheredInfo and PopOutInfo formats.
   */
  sanitizeInfo(info) {
    var _a, _b, _c;
    if (!info) return null;
    try {
      const sanitized = {};
      if (info.hoveredNode) {
        sanitized.hoveredNode = {
          title: String(info.hoveredNode.title || ""),
          type: String(info.hoveredNode.type || ""),
          id: info.hoveredNode.id,
          mode: info.hoveredNode.mode,
          executionOrder: info.hoveredNode.executionOrder,
          category: info.hoveredNode.category ? String(info.hoveredNode.category) : void 0,
          pythonModule: info.hoveredNode.pythonModule ? String(info.hoveredNode.pythonModule) : void 0,
          // Map formatting or raw values
          pos: info.hoveredNode.position && typeof info.hoveredNode.position === "object" ? { x: info.hoveredNode.position.x, y: info.hoveredNode.position.y } : String(info.hoveredNode.position || ""),
          size: info.hoveredNode.size && typeof info.hoveredNode.size === "object" ? { w: info.hoveredNode.size.width, h: info.hoveredNode.size.height } : String(info.hoveredNode.size || ""),
          widgets: this.extractSafeData(info.hoveredNode.widgets),
          inputs: this.extractSafeData(info.hoveredNode.inputs),
          outputs: this.extractSafeData(info.hoveredNode.outputs),
          properties: this.sanitizeOptions(info.hoveredNode.properties) || {}
        };
      }
      if (info.cursor) {
        sanitized.cursor = {
          canvas: {
            x: Number(info.cursor.canvasX || ((_a = info.cursor.canvas) == null ? void 0 : _a.x) || 0),
            y: Number(info.cursor.canvasY || ((_b = info.cursor.canvas) == null ? void 0 : _b.y) || 0)
          }
        };
      }
      if (info.zoom !== void 0 || info.canvas) {
        sanitized.canvas = {
          scale: Number(info.zoom || ((_c = info.canvas) == null ? void 0 : _c.scale) || 1)
        };
      }
      const magnifyGlass = window.comfyUIMagnifyGlass;
      if (magnifyGlass == null ? void 0 : magnifyGlass.config) {
        sanitized.magnifier = {
          zoomFactor: Number(magnifyGlass.config.zoomFactor || 1)
        };
      }
      return sanitized;
    } catch (e) {
      Logger.error("[PopOut] Failed to sanitize info:", e);
      return null;
    }
  }
  /**
   * Extract specific safe fields from node lists (widgets, inputs, outputs).
   * Removes functions like onFloatValueChange which cause cloning errors.
   */
  extractSafeData(list) {
    if (!list || !Array.isArray(list)) return [];
    return list.map((item) => {
      if (!item || typeof item !== "object") return {};
      const safeItem = {
        name: item.name,
        type: item.type,
        label: item.label
      };
      if (item.value !== void 0 && typeof item.value !== "function") {
        safeItem.value = item.value;
      }
      if (item.options !== void 0) {
        if (Array.isArray(item.options)) {
          safeItem.options = item.options.filter(
            (opt) => typeof opt !== "function"
          );
        } else if (typeof item.options === "object" && item.options !== null) {
          if (Array.isArray(item.options.values)) {
            safeItem.options = item.options.values.filter(
              (opt) => typeof opt !== "function"
            );
          } else {
            safeItem.options = this.sanitizeOptions(item.options);
          }
        }
      }
      return safeItem;
    });
  }
  /**
   * Shallow copy object removing functions.
   */
  sanitizeOptions(options) {
    if (!options || typeof options !== "object") return {};
    const clean = {};
    for (const key in options) {
      const val = options[key];
      if (typeof val !== "function" && !key.startsWith("_")) {
        if (typeof val === "object" && val !== null) {
          try {
            JSON.stringify(val);
            clean[key] = val;
          } catch (e) {
          }
        } else {
          clean[key] = val;
        }
      }
    }
    return clean;
  }
  /**
   * Send a message through the BroadcastChannel.
   */
  sendMessage(message) {
    if (!this.channel) return;
    try {
      this.channel.postMessage(message);
    } catch (e) {
      Logger.error("[PopOut] Failed to send message:", e);
    }
  }
  /**
   * Ping the viewer once a second while it is connected.
   */
  startPing() {
    const ping = () => {
      if (++this.pendingPings > this.PING_LIMIT) {
        Logger.debug("[PopOut] Connection timeout, marking as closed");
        this.disconnect();
        return;
      }
      this.sendMessage({ type: "ping" });
    };
    this.stopPing();
    this.pendingPings = 0;
    ping();
    this.pingInterval = window.setInterval(ping, 1e3);
  }
  /**
   * Stop pinging.
   */
  stopPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  /**
   * Cleanup resources.
   */
  cleanup() {
    this.close();
    window.removeEventListener("pagehide", this.onPageHide);
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    Logger.debug("[PopOut] Cleaned up");
  }
}
export {
  PopOutManager
};
