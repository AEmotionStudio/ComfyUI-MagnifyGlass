var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { Z_INDEX, DEFAULT_PADDING } from "../shared/constants.js";
import { Icons } from "../shared/icons.js";
import { Logger } from "../shared/logger.js";
class UiManager {
  constructor(config, state, onToggle, onPopOut) {
    __publicField(this, "config");
    __publicField(this, "state");
    __publicField(this, "glassDiv");
    __publicField(this, "glassCanvas");
    __publicField(this, "debugCanvas");
    __publicField(this, "debugCtx");
    __publicField(this, "htmlOverlayContainer");
    __publicField(this, "popOutButton");
    __publicField(this, "onToggle");
    __publicField(this, "onPopOut");
    this.config = config;
    this.state = state;
    this.glassDiv = null;
    this.glassCanvas = null;
    this.debugCanvas = null;
    this.debugCtx = null;
    this.htmlOverlayContainer = null;
    this.popOutButton = null;
    this.onToggle = onToggle;
    this.onPopOut = onPopOut;
  }
  /**
   * Create all DOM elements for the magnifying glass.
   */
  createElements() {
    this.glassDiv = document.createElement("div");
    this.glassDiv.id = "comfyui-magnify-glass";
    this.glassDiv.style.cssText = `
            position: absolute;
            box-sizing: border-box;
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
    this.popOutButton = document.createElement("button");
    this.popOutButton.id = "comfyui-magnify-popout-btn";
    this.popOutButton.title = "Open in New Tab (Shift+P)";
    this.popOutButton.innerHTML = Icons.externalLink;
    this.popOutButton.style.cssText = `
            position: absolute;
            top: 6px;
            right: 6px;
            width: 24px;
            height: 24px;
            padding: 4px;
            border: none;
            border-radius: 4px;
            background: rgba(0, 0, 0, 0.4);
            color: rgba(255, 255, 255, 0.7);
            cursor: pointer;
            pointer-events: auto;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            transition: opacity 0.2s ease, background 0.2s ease, color 0.2s ease;
            z-index: 10;
        `;
    this.popOutButton.addEventListener("click", (e) => {
      e.stopPropagation();
      if (this.onPopOut) {
        this.onPopOut();
      }
    });
    this.popOutButton.addEventListener("mouseenter", () => {
      if (this.popOutButton) {
        this.popOutButton.style.background = "rgba(99, 102, 241, 0.6)";
        this.popOutButton.style.color = "#fff";
      }
    });
    this.popOutButton.addEventListener("mouseleave", () => {
      if (this.popOutButton) {
        this.popOutButton.style.background = "rgba(0, 0, 0, 0.4)";
        this.popOutButton.style.color = "rgba(255, 255, 255, 0.7)";
      }
    });
    this.glassDiv.appendChild(this.popOutButton);
    this.glassDiv.addEventListener("mouseenter", () => {
      if (this.popOutButton) {
        this.popOutButton.style.opacity = "1";
      }
    });
    this.glassDiv.addEventListener("mouseleave", () => {
      if (this.popOutButton) {
        this.popOutButton.style.opacity = "0";
      }
    });
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
  /**
   * Position the glass relative to cursor.
   * Uses dynamic anchoring (Left/Right, Top/Bottom) based on screen quadrant.
   * @param clientX - Client X coordinate
   * @param clientY - Client Y coordinate
   */
  positionGlass(clientX, clientY) {
    if (!this.config.followCursor || !this.glassDiv) return;
    const glassSize = this.config.glassSize;
    const offsetAmount = DEFAULT_PADDING;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let targetX;
    let targetY;
    switch (this.config.glassPosition) {
      case "Top":
        targetX = clientX - glassSize / 2;
        targetY = clientY - glassSize - offsetAmount;
        break;
      case "Bottom":
        targetX = clientX - glassSize / 2;
        targetY = clientY + offsetAmount;
        break;
      case "Left":
        targetX = clientX - glassSize - offsetAmount;
        targetY = clientY - glassSize / 2;
        break;
      case "Right":
        targetX = clientX + offsetAmount;
        targetY = clientY - glassSize / 2;
        break;
      case "Top-Left":
        targetX = clientX - glassSize - offsetAmount;
        targetY = clientY - glassSize - offsetAmount;
        break;
      case "Top-Right":
        targetX = clientX + offsetAmount;
        targetY = clientY - glassSize - offsetAmount;
        break;
      case "Bottom-Left":
        targetX = clientX - glassSize - offsetAmount;
        targetY = clientY + offsetAmount;
        break;
      case "Bottom-Right":
        targetX = clientX + offsetAmount;
        targetY = clientY + offsetAmount;
        break;
      default:
        targetX = clientX - glassSize / 2;
        targetY = clientY + offsetAmount;
        break;
    }
    const glassCenterX = targetX + glassSize / 2;
    const glassCenterY = targetY + glassSize / 2;
    if (glassCenterX > vw / 2) {
      const rightPos = vw - (targetX + glassSize);
      this.glassDiv.style.right = `${rightPos}px`;
      this.glassDiv.style.left = "auto";
    } else {
      this.glassDiv.style.left = `${targetX}px`;
      this.glassDiv.style.right = "auto";
    }
    if (glassCenterY > vh / 2) {
      const bottomPos = vh - (targetY + glassSize);
      this.glassDiv.style.bottom = `${bottomPos}px`;
      this.glassDiv.style.top = "auto";
    } else {
      this.glassDiv.style.top = `${targetY}px`;
      this.glassDiv.style.bottom = "auto";
    }
    this.adjustForBoundaries();
  }
  /**
   * Adjust glass position to stay within viewport boundaries.
   * @param clientX - Client X coordinate
   * @param clientY - Client Y coordinate
   */
  /**
   * Adjust glass position to stay within viewport boundaries.
   * Respects the current anchor (Left/Right, Top/Bottom).
   */
  adjustForBoundaries() {
    if (!this.glassDiv) return;
    const glassSize = this.config.glassSize;
    const padding = DEFAULT_PADDING;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const isAnchoredRight = this.glassDiv.style.right !== "auto" && this.glassDiv.style.right !== "";
    if (isAnchoredRight) {
      let currentRight = parseFloat(this.glassDiv.style.right) || padding;
      currentRight = Math.max(padding, Math.min(currentRight, vw - glassSize - padding));
      this.glassDiv.style.right = `${currentRight}px`;
    } else {
      let currentLeft = parseFloat(this.glassDiv.style.left) || padding;
      currentLeft = Math.max(padding, Math.min(currentLeft, vw - glassSize - padding));
      this.glassDiv.style.left = `${currentLeft}px`;
    }
    const isAnchoredBottom = this.glassDiv.style.bottom !== "auto" && this.glassDiv.style.bottom !== "";
    if (isAnchoredBottom) {
      let currentBottom = parseFloat(this.glassDiv.style.bottom) || padding;
      currentBottom = Math.max(padding, Math.min(currentBottom, vh - glassSize - padding));
      this.glassDiv.style.bottom = `${currentBottom}px`;
    } else {
      let currentTop = parseFloat(this.glassDiv.style.top) || padding;
      currentTop = Math.max(padding, Math.min(currentTop, vh - glassSize - padding));
      this.glassDiv.style.top = `${currentTop}px`;
    }
  }
  /**
   * Update position safely on resize.
   * Since we use dynamic anchoring in positionGlass, CSS handles most resize cases.
   * This method ensures we verify boundaries (clamping) and fix anchors if we cross thresholds drastically.
   */
  updateResponsivePosition() {
    if (!this.glassDiv) return;
    this.adjustForBoundaries();
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
        Logger.debug("Found menu anchor:", anchorBtn.title || anchorBtn.getAttribute("aria-label") || "Unknown Button");
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
        Logger.debug("Menu toggle button injected successfully");
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
