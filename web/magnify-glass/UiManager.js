var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { Z_INDEX, DEFAULT_PADDING } from "../shared/constants.js";
import { Icons } from "../shared/icons.js";
import { Logger } from "../shared/logger.js";
class UiManager {
  constructor(config, state, onToggle) {
    __publicField(this, "config");
    __publicField(this, "state");
    __publicField(this, "glassDiv");
    __publicField(this, "glassCanvas");
    __publicField(this, "htmlOverlayContainer");
    __publicField(this, "onToggle");
    this.config = config;
    this.state = state;
    this.glassDiv = null;
    this.glassCanvas = null;
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
    document.body.appendChild(this.glassDiv);
    this.injectMenuButton();
  }
  /**
   * Show the magnifying glass.
   */
  show() {
    if (this.glassDiv) {
      this.glassDiv.style.display = "block";
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
   * Enable or disable glass drag mode.
   * When enabled, the glass can be dragged to a new position.
   */
  setDragMode(enabled) {
    if (!this.glassDiv) return;
    if (enabled) {
      this.glassDiv.style.cursor = "all-scroll";
      this.glassDiv.style.pointerEvents = "auto";
      this.glassDiv.classList.add("drag-mode");
      const onMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = this.glassDiv.getBoundingClientRect();
        const grabOffsetX = rect.left - e.clientX;
        const grabOffsetY = rect.top - e.clientY;
        this.glassDiv.style.left = `${rect.left}px`;
        this.glassDiv.style.top = `${rect.top}px`;
        this.glassDiv.style.right = "auto";
        this.glassDiv.style.bottom = "auto";
        this.glassDiv.style.transform = "none";
        const onMouseMove = (moveEvent) => {
          moveEvent.preventDefault();
          moveEvent.stopPropagation();
          const newLeft = moveEvent.clientX + grabOffsetX;
          const newTop = moveEvent.clientY + grabOffsetY;
          if (this.glassDiv) {
            this.glassDiv.style.left = `${newLeft}px`;
            this.glassDiv.style.top = `${newTop}px`;
          }
        };
        const onMouseUp = (upEvent) => {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
          this.state.isDragModeEnabled = false;
          this.setDragMode(false);
          const infoPanel = window.infoPanelManager;
          if (infoPanel == null ? void 0 : infoPanel.uiManager) {
            infoPanel.uiManager.updateControlStates();
          }
        };
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      };
      this.glassDiv.addEventListener("mousedown", onMouseDown);
      this.glassDiv._dragHandler = onMouseDown;
    } else {
      this.glassDiv.style.cursor = "";
      this.glassDiv.style.pointerEvents = "none";
      this.glassDiv.classList.remove("drag-mode");
      if (this.glassDiv._dragHandler) {
        this.glassDiv.removeEventListener("mousedown", this.glassDiv._dragHandler);
        delete this.glassDiv._dragHandler;
      }
    }
  }
  /**
   * Hide the magnifying glass.
   */
  hide() {
    if (this.glassDiv) {
      this.glassDiv.style.display = "none";
    }
    if (this.htmlOverlayContainer) {
      this.htmlOverlayContainer.innerHTML = "";
    }
  }
  /**
   * Position the glass relative to cursor.
   * Uses dynamic anchoring (Left/Right, Top/Bottom) based on screen quadrant.
   * @param clientX - Client X coordinate
   * @param clientY - Client Y coordinate
   */
  positionGlass(clientX, clientY) {
    if (!this.config.followCursor || !this.glassDiv || this.state.isDragModeEnabled) return;
    const glassSize = this.config.glassSize;
    const offsetAmount = DEFAULT_PADDING;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let targetX = this.config.offsetX || 0;
    let targetY = this.config.offsetY || 0;
    switch (this.config.glassPosition) {
      case "Top":
        targetX += clientX - glassSize / 2;
        targetY += clientY - glassSize - offsetAmount;
        break;
      case "Bottom":
        targetX += clientX - glassSize / 2;
        targetY += clientY + offsetAmount;
        break;
      case "Left":
        targetX += clientX - glassSize - offsetAmount;
        targetY += clientY - glassSize / 2;
        break;
      case "Right":
        targetX += clientX + offsetAmount;
        targetY += clientY - glassSize / 2;
        break;
      case "Top-Left":
        targetX += clientX - glassSize - offsetAmount;
        targetY += clientY - glassSize - offsetAmount;
        break;
      case "Top-Right":
        targetX += clientX + offsetAmount;
        targetY += clientY - glassSize - offsetAmount;
        break;
      case "Bottom-Left":
        targetX += clientX - glassSize - offsetAmount;
        targetY += clientY + offsetAmount;
        break;
      case "Bottom-Right":
        targetX += clientX + offsetAmount;
        targetY += clientY + offsetAmount;
        break;
      default:
        targetX += clientX - glassSize / 2;
        targetY += clientY + offsetAmount;
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
      if (this.config.reduceMotion) {
        this.glassDiv.style.transition = "none !important";
        this.glassDiv.style.animation = "none !important";
        this.glassDiv.style.setProperty("transition", "none", "important");
        this.glassDiv.style.setProperty("animation", "none", "important");
      } else {
        this.glassDiv.style.transition = "";
        this.glassDiv.style.animation = "";
        this.glassDiv.style.removeProperty("transition");
        this.glassDiv.style.removeProperty("animation");
      }
    }
    if (this.glassCanvas) {
      this.glassCanvas.width = this.config.glassSize;
      this.glassCanvas.height = this.config.glassSize;
    }
  }
  /**
   * Cleanup DOM elements.
   */
  cleanup() {
    if (this.glassDiv) this.glassDiv.remove();
    const btn = document.querySelector(".magnify-toggle-btn");
    if (btn) btn.remove();
  }
  /**
   * Inject a quick toggle button into the ComfyUI menu.
   */
  injectMenuButton() {
    const stopTime = Date.now() + 3e4;
    const attemptInjection = () => {
      const minimapBtn = document.querySelector('button[data-testid="toggle-minimap-button"]');
      const linkVisibilityBtn = document.querySelector('button[data-testid="toggle-link-visibility-button"]');
      if (!minimapBtn || !minimapBtn.parentElement) {
        return false;
      }
      if (minimapBtn.parentElement.querySelector(".magnify-toggle-btn")) {
        return true;
      }
      Logger.debug("Found minimap button in bottom toolbar, injecting magnify glass toggle");
      const btn = document.createElement("button");
      btn.className = minimapBtn.className + " magnify-toggle-btn";
      const computed = window.getComputedStyle(minimapBtn);
      btn.style.height = computed.height;
      btn.style.minHeight = computed.minHeight;
      btn.style.width = computed.width;
      btn.title = "Toggle Magnify Glass (X)";
      btn.setAttribute("data-testid", "toggle-magnify-glass-button");
      btn.innerHTML = Icons.magnifyGlass;
      btn.style.display = "inline-flex";
      btn.style.alignItems = "center";
      btn.style.justifyContent = "center";
      btn.style.padding = "0";
      btn.style.cursor = "pointer";
      if (minimapBtn.style.borderRadius) {
        btn.style.borderRadius = minimapBtn.style.borderRadius;
      } else {
        btn.style.borderRadius = computed.borderRadius;
      }
      btn.addEventListener("click", () => {
        if (this.onToggle) {
          this.onToggle();
          btn.classList.toggle("active");
          btn.classList.toggle("p-highlight");
          btn.classList.toggle("selected");
        }
      });
      if (linkVisibilityBtn && minimapBtn.parentElement === linkVisibilityBtn.parentElement) {
        minimapBtn.parentElement.insertBefore(btn, linkVisibilityBtn);
      } else if (minimapBtn.nextSibling) {
        minimapBtn.parentElement.insertBefore(btn, minimapBtn.nextSibling);
      } else {
        minimapBtn.parentElement.appendChild(btn);
      }
      Logger.debug("Menu toggle button injected successfully between minimap and link visibility");
      return true;
    };
    if (attemptInjection()) return;
    const checkForMenu = setInterval(() => {
      if (Date.now() > stopTime) {
        console.warn("[MagnifyGlass] Menu injection timed out. Could not find toggle-minimap-button");
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
