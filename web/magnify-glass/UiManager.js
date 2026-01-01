var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { Z_INDEX, DEFAULT_PADDING } from "../shared/constants.js";
import { Icons } from "../shared/icons.js";
class UiManager {
  constructor(config, state, onToggle) {
    __publicField(this, "config");
    __publicField(this, "state");
    __publicField(this, "glassDiv");
    __publicField(this, "glassCanvas");
    __publicField(this, "debugCanvas");
    __publicField(this, "debugCtx");
    __publicField(this, "htmlOverlayContainer");
    __publicField(this, "onToggle");
    this.config = config;
    this.state = state;
    this.glassDiv = null;
    this.glassCanvas = null;
    this.debugCanvas = null;
    this.debugCtx = null;
    this.htmlOverlayContainer = null;
    this.onToggle = onToggle;
  }
  /**
   * Create all DOM elements for the magnifying glass.
   */
  createElements() {
    this.glassDiv = document.createElement("div");
    this.glassDiv.id = "comfyui-magnify-glass";
    this.glassDiv.style.cssText = `
            position: absolute;
            width: ${this.config.glassSize}px;
            height: ${this.config.glassSize}px;
            border-radius: ${this.config.glassShape === "Circle" ? "50%" : "0px"};
            border: ${this.config.borderEnabled ? `${this.config.borderWidth}px solid ${this.config.borderColor}` : "none"};
            overflow: hidden;
            pointer-events: none;
            z-index: ${Z_INDEX.GLASS};
            display: none;
            box-shadow: 0 5px 15px rgba(0,0,0,0.3);
            background-color: rgba(255,255,255,0.1);
        `;
    this.glassCanvas = document.createElement("canvas");
    this.glassCanvas.width = this.config.glassSize;
    this.glassCanvas.height = this.config.glassSize;
    this.glassCanvas.id = "comfyui-magnify-canvas";
    this.glassDiv.appendChild(this.glassCanvas);
    this.htmlOverlayContainer = document.createElement("div");
    this.htmlOverlayContainer.id = "comfyui-magnify-html-overlay";
    this.htmlOverlayContainer.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            overflow: hidden; 
        `;
    this.glassDiv.appendChild(this.htmlOverlayContainer);
    document.body.appendChild(this.glassDiv);
    if (this.config.debugMode) {
      this.createDebugCanvas();
    }
    this.injectMenuButton();
  }
  /**
   * Create the debug canvas overlay.
   */
  createDebugCanvas() {
    this.debugCanvas = document.createElement("canvas");
    this.debugCanvas.id = "comfyui-magnify-debug";
    this.debugCanvas.width = 400;
    this.debugCanvas.height = 350;
    this.debugCanvas.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: rgba(0,0,0,0.7);
            border: 1px solid #fff;
            z-index: ${Z_INDEX.DEBUG};
            pointer-events: none;
            color: white;
            font-family: monospace;
            display: none;
        `;
    document.body.appendChild(this.debugCanvas);
    this.debugCtx = this.debugCanvas.getContext("2d");
  }
  /**
   * Show the magnifying glass.
   */
  show() {
    if (this.glassDiv) {
      this.glassDiv.style.display = "block";
    }
    if (this.config.debugMode && this.debugCanvas) {
      this.debugCanvas.style.display = "block";
    }
  }
  /**
   * Set the visual visibility of the glass preview (opacity).
   * This allows the tool to remain "Active" (tracking mouse) but invisible,
   * so that the Inspector Panel can be used in "Inspector Only" mode.
   */
  setPreviewVisibility(visible) {
    if (this.glassDiv) {
      this.glassDiv.style.opacity = visible ? "1" : "0";
    }
  }
  /**
   * Hide the magnifying glass.
   */
  hide() {
    if (this.glassDiv) {
      this.glassDiv.style.display = "none";
    }
    if (this.config.debugMode && this.debugCanvas) {
      this.debugCanvas.style.display = "none";
    }
    if (this.htmlOverlayContainer) {
      this.htmlOverlayContainer.innerHTML = "";
    }
  }
  /**
   * Position the glass relative to cursor.
   * @param clientX - Client X coordinate
   * @param clientY - Client Y coordinate
   */
  positionGlass(clientX, clientY) {
    if (!this.config.followCursor || !this.glassDiv) return;
    const glassSize = this.config.glassSize;
    const offsetAmount = DEFAULT_PADDING;
    let newLeft;
    let newTop;
    switch (this.config.glassPosition) {
      case "Top":
        newLeft = clientX - glassSize / 2;
        newTop = clientY - glassSize - offsetAmount;
        break;
      case "Bottom":
        newLeft = clientX - glassSize / 2;
        newTop = clientY + offsetAmount;
        break;
      case "Left":
        newLeft = clientX - glassSize - offsetAmount;
        newTop = clientY - glassSize / 2;
        break;
      case "Right":
        newLeft = clientX + offsetAmount;
        newTop = clientY - glassSize / 2;
        break;
      case "Top-Left":
        newLeft = clientX - glassSize - offsetAmount;
        newTop = clientY - glassSize - offsetAmount;
        break;
      case "Top-Right":
        newLeft = clientX + offsetAmount;
        newTop = clientY - glassSize - offsetAmount;
        break;
      case "Bottom-Left":
        newLeft = clientX - glassSize - offsetAmount;
        newTop = clientY + offsetAmount;
        break;
      case "Bottom-Right":
        newLeft = clientX + offsetAmount;
        newTop = clientY + offsetAmount;
        break;
      default:
        newLeft = clientX - glassSize / 2;
        newTop = clientY + offsetAmount;
        break;
    }
    this.glassDiv.style.left = `${newLeft}px`;
    this.glassDiv.style.top = `${newTop}px`;
    this.adjustForBoundaries(clientX, clientY);
  }
  /**
   * Adjust glass position to stay within viewport boundaries.
   * @param clientX - Client X coordinate
   * @param clientY - Client Y coordinate
   */
  adjustForBoundaries(clientX, clientY) {
    if (!this.glassDiv) return;
    const glassRect = this.glassDiv.getBoundingClientRect();
    if (glassRect.right > window.innerWidth) {
      this.glassDiv.style.left = `${clientX - glassRect.width - DEFAULT_PADDING}px`;
    }
    const currentRectLeft = this.glassDiv.getBoundingClientRect();
    if (currentRectLeft.left < 0) {
      this.glassDiv.style.left = "10px";
    }
    if (glassRect.bottom > window.innerHeight) {
      this.glassDiv.style.top = `${clientY - glassRect.height - DEFAULT_PADDING}px`;
    }
    const currentRectTop = this.glassDiv.getBoundingClientRect();
    if (currentRectTop.top < 0) {
      this.glassDiv.style.top = "10px";
    }
  }
  /**
   * Apply current config to UI elements.
   */
  applyStyles() {
    if (this.glassDiv) {
      this.glassDiv.style.width = `${this.config.glassSize}px`;
      this.glassDiv.style.height = `${this.config.glassSize}px`;
      this.glassDiv.style.border = this.config.borderEnabled ? `${this.config.borderWidth}px solid ${this.config.borderColor}` : "none";
      this.glassDiv.style.clipPath = "none";
      this.glassDiv.style.borderRadius = "0px";
      switch (this.config.glassShape) {
        case "Circle":
          this.glassDiv.style.borderRadius = "50%";
          break;
        case "Square":
          break;
        case "Rounded Square":
          this.glassDiv.style.borderRadius = "20%";
          break;
        default:
          this.glassDiv.style.borderRadius = "50%";
          break;
      }
    }
    if (this.glassCanvas) {
      this.glassCanvas.width = this.config.glassSize;
      this.glassCanvas.height = this.config.glassSize;
    }
    if (this.config.debugMode) {
      if (!this.debugCanvas) this.createDebugCanvas();
      if (this.state.active && this.debugCanvas) this.debugCanvas.style.display = "block";
    } else {
      if (this.debugCanvas) this.debugCanvas.style.display = "none";
    }
  }
  /**
   * Cleanup DOM elements.
   */
  cleanup() {
    if (this.glassDiv) this.glassDiv.remove();
    if (this.debugCanvas) this.debugCanvas.remove();
    const btn = document.querySelector(".magnify-toggle-btn");
    if (btn) btn.remove();
  }
  /**
   * Inject a quick toggle button into the ComfyUI menu.
   */
  /**
   * Inject a quick toggle button into the ComfyUI menu.
   */
  injectMenuButton() {
    const stopTime = Date.now() + 3e4;
    const attemptInjection = () => {
      const buttons = Array.from(document.querySelectorAll("button"));
      let anchorBtn = buttons.find((b) => {
        const title = (b.title || "").toLowerCase();
        const aria = (b.getAttribute("aria-label") || "").toLowerCase();
        const text = (b.textContent || "").toLowerCase();
        return title.includes("map") && !title.includes("open") || aria.includes("map") && !aria.includes("open") || text.includes("map");
      });
      if (!anchorBtn) {
        anchorBtn = buttons.find((b) => {
          const title = (b.title || "").toLowerCase();
          const aria = (b.getAttribute("aria-label") || "").toLowerCase();
          return title.includes("link") || aria.includes("link");
        });
      }
      if (anchorBtn && anchorBtn.parentElement) {
        if (anchorBtn.parentElement.querySelector(".magnify-toggle-btn")) return true;
        console.log("[MagnifyGlass] Found menu anchor:", anchorBtn.title || anchorBtn.getAttribute("aria-label") || "Unknown Button");
        const btn = document.createElement("button");
        btn.className = anchorBtn.className + " magnify-toggle-btn";
        const computed = window.getComputedStyle(anchorBtn);
        btn.style.height = computed.height;
        btn.style.minHeight = computed.minHeight;
        btn.title = "Toggle Magnify Glass";
        btn.innerHTML = Icons.magnifyGlass;
        btn.style.display = "inline-flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.padding = "0 8px";
        btn.style.cursor = "pointer";
        btn.style.border = anchorBtn.style.border || computed.border;
        btn.style.borderRadius = anchorBtn.style.borderRadius || computed.borderRadius;
        if (!btn.style.background) btn.style.background = computed.background;
        if (!btn.style.color) btn.style.color = computed.color;
        btn.addEventListener("click", () => {
          if (this.onToggle) {
            this.onToggle();
            btn.classList.toggle("active");
            btn.classList.toggle("p-highlight");
            btn.classList.toggle("selected");
          }
        });
        const isMinimap = (anchorBtn.title || "").toLowerCase().includes("map") || (anchorBtn.getAttribute("aria-label") || "").toLowerCase().includes("map");
        if (isMinimap) {
          if (anchorBtn.nextSibling) {
            anchorBtn.parentElement.insertBefore(btn, anchorBtn.nextSibling);
          } else {
            anchorBtn.parentElement.appendChild(btn);
          }
        } else {
          anchorBtn.parentElement.insertBefore(btn, anchorBtn);
        }
        console.log("[MagnifyGlass] Menu toggle button injected successfully");
        return true;
      }
      return false;
    };
    if (attemptInjection()) return;
    const checkForMenu = setInterval(() => {
      if (Date.now() > stopTime) {
        console.warn(
          "[MagnifyGlass] Menu injection timed out. Found buttons:",
          Array.from(document.querySelectorAll("button")).map((b) => b.title || b.getAttribute("aria-label") || b.textContent || b.className).slice(0, 5)
        );
        clearInterval(checkForMenu);
        return;
      }
      if (attemptInjection()) {
        clearInterval(checkForMenu);
      }
    }, 100);
  }
}
export {
  UiManager
};
//# sourceMappingURL=UiManager.js.map
