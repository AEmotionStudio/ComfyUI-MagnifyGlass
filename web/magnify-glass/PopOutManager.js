var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { BROADCAST_CHANNEL_NAME } from "../shared/constants.js";
import { Logger } from "../shared/logger.js";
class PopOutManager {
  constructor() {
    __publicField(this, "channel", null);
    __publicField(this, "isOpen", false);
    __publicField(this, "popOutWindow", null);
    __publicField(this, "onStateChange", null);
    __publicField(this, "onNodeSelect", null);
    __publicField(this, "lastPongTime", 0);
    __publicField(this, "pingInterval", null);
    __publicField(this, "viewerUrl");
    __publicField(this, "currentTheme", "dark");
    // Default theme
    /** Throttle frame sending to ~30fps */
    __publicField(this, "lastFrameTime", 0);
    __publicField(this, "FRAME_INTERVAL", 33);
    // ~30fps
    /** Connection timeout (ms) */
    __publicField(this, "CONNECTION_TIMEOUT", 5e3);
    this.viewerUrl = this.getViewerUrl();
    this.initChannel();
  }
  /**
   * Get the URL for the pop-out viewer page.
   */
  getViewerUrl() {
    const version = "v24";
    const scripts = document.querySelectorAll('script[src*="magnify"]');
    Logger.debug(`[PopOut] Found ${scripts.length} magnify scripts`);
    if (scripts.length > 0) {
      const src = scripts[0].src;
      Logger.debug(`[PopOut] First script src: ${src}`);
      const urlParts = src.split("/");
      let extensionIndex = -1;
      for (let i = 0; i < urlParts.length; i++) {
        if (urlParts[i].toLowerCase().includes("magnify")) {
          extensionIndex = i;
          break;
        }
      }
      if (extensionIndex >= 0) {
        const baseUrl = urlParts.slice(0, extensionIndex + 1).join("/");
        const viewerUrl = `${baseUrl}/popout-viewer.html?${version}`;
        Logger.debug(`[PopOut] Using viewer URL: ${viewerUrl}`);
        return viewerUrl;
      }
    }
    const fallbackUrl = `/extensions/comfyui-magnifyglass/popout-viewer.html?${version}`;
    Logger.debug(`[PopOut] Using fallback URL: ${fallbackUrl}`);
    return fallbackUrl;
  }
  /**
   * Initialize the BroadcastChannel.
   */
  initChannel() {
    try {
      this.channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
      this.channel.onmessage = (event) => {
        this.handleMessage(event.data);
      };
      Logger.debug("[PopOut] BroadcastChannel initialized");
      this.startPing();
    } catch (e) {
      Logger.error("[PopOut] Failed to create BroadcastChannel:", e);
    }
  }
  /**
   * Handle incoming messages from the viewer tab.
   */
  handleMessage(message) {
    switch (message.type) {
      case "pong":
        this.lastPongTime = Date.now();
        if (!this.isOpen) {
          this.isOpen = true;
          Logger.debug("[PopOut] Viewer tab connected");
          if (this.onStateChange) this.onStateChange(true);
          this.sendConfig({ theme: this.currentTheme });
        }
        break;
      case "close":
        this.isOpen = false;
        this.popOutWindow = null;
        Logger.debug("[PopOut] Viewer tab closed");
        if (this.onStateChange) this.onStateChange(false);
        break;
      case "request-nodes":
        Logger.debug("[PopOut] Received request-nodes:", message.data);
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
          const node = app.graph.getNodeById(message.data);
          if (node && app.canvas) {
            app.canvas.centerOnNode(node);
          }
        }
        break;
    }
  }
  /**
   * Open the pop-out viewer in a new tab.
   */
  open() {
    if (this.popOutWindow && !this.popOutWindow.closed) {
      this.popOutWindow.focus();
      return;
    }
    this.popOutWindow = window.open(this.viewerUrl, "MagnifyGlassPopout");
    if (!this.popOutWindow) {
      Logger.error("[PopOut] Failed to open new tab - popup may be blocked");
      return;
    }
    this.startPing();
    Logger.debug("[PopOut] Opening viewer tab...");
  }
  /**
   * Close the pop-out viewer tab.
   */
  close() {
    if (!this.isOpen && !this.popOutWindow) return;
    this.isOpen = false;
    if (this.onStateChange) this.onStateChange(false);
    this.stopPing();
    this.sendMessage({ type: "close" });
    if (this.popOutWindow) {
      this.popOutWindow.close();
      this.popOutWindow = null;
    }
    Logger.debug("[PopOut] Sent close message to viewer");
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
   * Send a frame to the pop-out viewer.
   * Throttled to ~30fps for performance.
   * @param canvas - The source canvas to send
   */
  sendFrame(canvas) {
    if (!this.isOpen || !this.channel) return;
    const now = Date.now();
    if (now - this.lastFrameTime < this.FRAME_INTERVAL) {
      return;
    }
    this.lastFrameTime = now;
    try {
      const dataUrl = canvas.toDataURL("image/png");
      this.sendMessage({
        type: "frame",
        data: dataUrl,
        timestamp: now
      });
    } catch (e) {
      Logger.error("[PopOut] Failed to send frame:", e);
    }
  }
  /**
   * Send configuration to the pop-out viewer.
   */
  /**
   * Send configuration to the pop-out viewer.
   */
  sendConfig(config) {
    if (!this.channel) return;
    const finalConfig = {
      theme: this.currentTheme,
      ...config
    };
    if (config.theme) {
      this.currentTheme = config.theme;
    }
    this.sendMessage({
      type: "config",
      data: finalConfig
    });
  }
  /**
   * Update the viewer theme.
   * @param theme - Theme name (e.g. 'dark', 'light')
   */
  updateTheme(theme) {
    if (this.currentTheme === theme) return;
    this.currentTheme = theme;
    this.sendConfig({ theme });
    Logger.debug(`[PopOut] Theme updated to: ${theme}`);
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
    var _a;
    if (!this.channel) return;
    try {
      const app = window.app;
      const nodes = ((_a = app == null ? void 0 : app.graph) == null ? void 0 : _a._nodes) || [];
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
      if (info.mediaElement || info.media) {
        const media = info.mediaElement || info.media;
        sanitized.media = {
          tagName: String(media.tagName || media.type || ""),
          naturalSize: media.naturalWidth && media.naturalHeight ? `${media.naturalWidth}×${media.naturalHeight}` : media.naturalSize
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
      if (item.options) {
        safeItem.options = this.sanitizeOptions(item.options);
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
   * Start pinging to check connection.
   */
  startPing() {
    const ping = () => {
      if (this.channel) {
        this.channel.postMessage({ type: "ping", timestamp: Date.now() });
      }
      if (this.isOpen && Date.now() - this.lastPongTime > this.CONNECTION_TIMEOUT) {
        Logger.debug("[PopOut] Connection timeout, marking as closed");
        this.isOpen = false;
        this.stopPing();
        if (this.onStateChange) this.onStateChange(false);
      }
    };
    ping();
    if (this.pingInterval) return;
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
    this.stopPing();
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
//# sourceMappingURL=PopOutManager.js.map
