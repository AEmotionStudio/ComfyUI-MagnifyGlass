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
const RUN_EVENTS = [
  "status",
  "execution_start",
  "executing",
  "progress",
  "progress_state",
  "execution_cached",
  "executed",
  "execution_success",
  "execution_error",
  "execution_interrupted"
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
    __publicField(this, "run", PopOutManager.idleRun(0));
    // The workflow tab on screen when the prompt started; the run's ids name other nodes in any other tab
    __publicField(this, "runWorkflow", null);
    // Execution events can come many times a second; the viewer gets their result at most every 100 ms
    __publicField(this, "runTimer", null);
    __publicField(this, "onRunEvent", (event) => {
      this.reduceRun(event.type, event.detail);
      this.runTimer ?? (this.runTimer = window.setTimeout(() => {
        this.runTimer = null;
        this.sendMessage({ type: "run", data: this.run });
      }, 100));
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
    var _a, _b, _c, _d, _e, _f;
    switch (message.type) {
      case "pong":
        this.pendingPings = 0;
        if (!this.isOpen && !this.dismissed) {
          this.isOpen = true;
          this.viewerHidden = false;
          this.sentConfig = null;
          this.startPing();
          this.run = PopOutManager.idleRun(app.ui.lastQueueSize ?? 0);
          this.runWorkflow = app.extensionManager.workflow.activeWorkflow;
          this.sendMessage({ type: "run", data: this.run });
          for (const name of RUN_EVENTS) app.api.addEventListener(name, this.onRunEvent);
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
      case "run-node-select": {
        const node = this.runNode(message.data);
        if (node && node.graph === ((_b = app.canvas) == null ? void 0 : _b.graph)) (_c = this.onNodeSelect) == null ? void 0 : _c.call(this, node.id);
        break;
      }
      case "panel-action":
        (_d = this.onPanelAction) == null ? void 0 : _d.call(this, message.data.name, message.data.nodeId);
        break;
      case "widget-edit":
        (_e = this.onWidgetEdit) == null ? void 0 : _e.call(this, message.data);
        break;
      case "button-click":
        (_f = this.onButtonClick) == null ? void 0 : _f.call(this, message.data);
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
    for (const name of RUN_EVENTS) app.api.removeEventListener(name, this.onRunEvent);
    if (this.runTimer !== null) {
      clearTimeout(this.runTimer);
      this.runTimer = null;
    }
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
  static idleRun(queue) {
    return { queue, nodeId: null, title: "", value: 0, max: 0, cached: [], done: [], error: null };
  }
  /**
   * Apply one of ComfyUI's execution events to the run the viewer shows.
   */
  reduceRun(type, detail) {
    var _a;
    const run = this.run;
    switch (type) {
      case "status":
        run.queue = (detail == null ? void 0 : detail.exec_info.queue_remaining) ?? 0;
        break;
      case "execution_start":
        this.run = PopOutManager.idleRun(run.queue);
        this.runWorkflow = app.extensionManager.workflow.activeWorkflow;
        break;
      case "executing":
        this.setRunNode(detail === null ? null : String(detail));
        break;
      case "progress":
        run.value = detail.value;
        run.max = detail.max;
        break;
      case "progress_state": {
        const nodes = detail.nodes;
        const state = run.nodeId !== null ? nodes[run.nodeId] : Object.values(nodes).find((node) => node.state === "running");
        if (!state) break;
        if (run.nodeId === null) this.setRunNode(state.display_node_id || state.node_id);
        run.value = state.value;
        run.max = state.max;
        break;
      }
      case "execution_cached":
        run.cached.push(...detail.nodes.map(String));
        break;
      case "executed": {
        const id = String(detail.display_node || detail.node);
        if (!run.done.includes(id)) run.done.push(id);
        break;
      }
      case "execution_error": {
        const nodeId = String(detail.node_id);
        run.error = {
          nodeId,
          title: ((_a = this.runNode(nodeId)) == null ? void 0 : _a.title) ?? "",
          type: detail.node_type,
          message: detail.exception_message,
          traceback: detail.traceback.join("")
        };
        this.setRunNode(null);
        break;
      }
      case "execution_success":
        this.setRunNode(null);
        break;
      case "execution_interrupted":
        run.nodeId = null;
        this.setRunNode(null);
        break;
    }
  }
  /**
   * Start showing a node as running; the one running before is done.
   */
  setRunNode(nodeId) {
    var _a;
    const run = this.run;
    if (run.nodeId !== null && !run.done.includes(run.nodeId)) run.done.push(run.nodeId);
    run.nodeId = nodeId;
    run.title = nodeId === null ? "" : ((_a = this.runNode(nodeId)) == null ? void 0 : _a.title) ?? "";
    run.value = 0;
    run.max = 0;
  }
  /**
   * The node an execution id names, found from the root graph through the subgraph nodes it is in.
   * None while another workflow tab is on screen than the one the prompt started in.
   */
  runNode(executionId) {
    if (app.extensionManager.workflow.activeWorkflow !== this.runWorkflow) return null;
    let graph = app.graph;
    let node = null;
    for (const id of executionId.split(":")) {
      node = (graph == null ? void 0 : graph.getNodeById(Number(id))) ?? null;
      graph = node == null ? void 0 : node.subgraph;
    }
    return node;
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
