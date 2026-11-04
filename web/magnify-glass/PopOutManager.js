var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { BROADCAST_CHANNEL_NAME } from "../shared/constants.js";
import { Logger } from "../shared/logger.js";
const PALETTE_PROPERTIES = [
  "--fg-color",
  "--comfy-menu-bg",
  "--comfy-menu-secondary-bg",
  "--comfy-input-bg",
  "--border-color",
  "--descrip-text",
  "--error-text",
  "--interface-stroke",
  "--secondary-background",
  "--secondary-background-hover",
  "--primary-background",
  "--border-default",
  "--base-background",
  "--mg-panel-fg",
  "--mg-panel-accent"
];
const SESSION_KEY = "magnifyglass-popout-session";
class PopOutManager {
  constructor(getStatus, onConnect, onZoom) {
    __publicField(this, "channel", null);
    __publicField(this, "isOpen", false);
    __publicField(this, "popOutWindow", null);
    __publicField(this, "onStateChange", null);
    // The Inspector owns the info and decides what the viewer may change
    __publicField(this, "onNodeSelect", null);
    __publicField(this, "onWidgetEdit", null);
    __publicField(this, "onButtonClick", null);
    __publicField(this, "onPanelAction", null);
    __publicField(this, "onRequestOptions", null);
    __publicField(this, "onSearchNodes", null);
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
    /** One frame is encoded at a time; a slow encode drops frames instead of queueing them */
    __publicField(this, "frameInFlight", false);
    /** Unanswered pings, one a second, before the viewer counts as gone */
    __publicField(this, "PING_LIMIT", 5);
    this.getStatus = getStatus;
    this.onConnect = onConnect;
    this.onZoom = onZoom;
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
    var _a, _b, _c, _d;
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
      case "zoom":
        this.onZoom(message.data);
        this.syncConfig();
        break;
      case "search-nodes":
        if (this.onSearchNodes) {
          this.sendMessage({ type: "nodes-list", data: { query: message.data, nodes: this.onSearchNodes(message.data) } });
        }
        break;
      case "node-select":
        (_a = this.onNodeSelect) == null ? void 0 : _a.call(this, message.data);
        break;
      case "panel-action":
        (_b = this.onPanelAction) == null ? void 0 : _b.call(this, message.data.name, message.data.nodeId);
        break;
      case "widget-edit":
        (_c = this.onWidgetEdit) == null ? void 0 : _c.call(this, message.data);
        break;
      case "button-click":
        (_d = this.onButtonClick) == null ? void 0 : _d.call(this, message.data);
        break;
      case "request-options":
        if (this.onRequestOptions) {
          this.sendMessage({ type: "options", data: { ...message.data, options: this.onRequestOptions(message.data) } });
        }
        break;
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
   * Send a frame to the pop-out viewer as a PNG Blob, unless it is hidden.
   * Throttled to ~30fps for performance.
   * @param canvas - The source canvas to send
   */
  sendFrame(canvas) {
    if (!this.isOpen || this.viewerHidden || this.frameInFlight || !this.channel) return;
    const now = Date.now();
    if (now - this.lastFrameTime < this.FRAME_INTERVAL) {
      return;
    }
    this.lastFrameTime = now;
    this.frameInFlight = true;
    canvas.toBlob((blob) => {
      this.frameInFlight = false;
      if (blob && this.isOpen) this.sendMessage({ type: "frame", data: blob });
    }, "image/png");
  }
  /**
   * Send the palette and the glass and Inspector state when they change.
   */
  syncConfig() {
    const style = getComputedStyle(document.body);
    const config = {
      ...this.getStatus(),
      palette: {
        scheme: document.body.classList.contains("dark-theme") ? "dark" : "light",
        fontFamily: style.fontFamily,
        fontSize: style.fontSize,
        properties: Object.fromEntries(PALETTE_PROPERTIES.map((name) => [name, style.getPropertyValue(name).trim()]))
      }
    };
    const json = JSON.stringify(config);
    if (json === this.sentConfig) return;
    this.sentConfig = json;
    this.sendMessage({ type: "config", data: config });
  }
  /**
   * Send the Inspector's info to the pop-out viewer.
   */
  sendInfo(info) {
    if (!this.isOpen) return;
    this.sendMessage({ type: "info", data: info });
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
