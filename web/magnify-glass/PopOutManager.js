var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { BROADCAST_CHANNEL_NAME } from "../shared/constants.js";
import { Logger } from "../shared/logger.js";
class PopOutManager {
  constructor() {
    __publicField(this, "channel", null);
    __publicField(this, "isOpen", false);
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
    const version = "v5";
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
          this.sendConfig({ theme: this.currentTheme });
        }
        break;
      case "close":
        this.isOpen = false;
        this.stopPing();
        Logger.debug("[PopOut] Viewer tab closed");
        break;
    }
  }
  /**
   * Open the pop-out viewer in a new tab.
   */
  open() {
    if (this.isOpen) {
      Logger.debug("[PopOut] Tab already open");
      return;
    }
    const newTab = window.open(this.viewerUrl, "_blank");
    if (!newTab) {
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
    if (!this.isOpen) return;
    this.sendMessage({ type: "close" });
    this.isOpen = false;
    this.stopPing();
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
          executionOrder: info.hoveredNode.executionOrder,
          category: info.hoveredNode.category ? String(info.hoveredNode.category) : void 0
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
    this.stopPing();
    this.pingInterval = setInterval(() => {
      this.sendMessage({ type: "ping", timestamp: Date.now() });
      if (this.isOpen && Date.now() - this.lastPongTime > this.CONNECTION_TIMEOUT) {
        Logger.debug("[PopOut] Connection timeout, marking as closed");
        this.isOpen = false;
        this.stopPing();
      }
    }, 1e3);
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
