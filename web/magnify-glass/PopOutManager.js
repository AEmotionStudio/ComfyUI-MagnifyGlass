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
    const scripts = document.querySelectorAll('script[src*="magnify"]');
    if (scripts.length > 0) {
      const src = scripts[0].src;
      const baseUrl = src.substring(0, src.lastIndexOf("/"));
      return `${baseUrl}/popout-viewer.html`;
    }
    return "/extensions/comfyui-magnifyglass/popout-viewer.html";
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
  sendConfig(config) {
    if (!this.channel) return;
    this.sendMessage({
      type: "config",
      data: config
    });
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
