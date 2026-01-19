var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class CustomDropdown {
  // Track active item for keyboard navigation
  constructor(config) {
    __publicField(this, "dropdown", null);
    __publicField(this, "config");
    __publicField(this, "closeHandler", null);
    __publicField(this, "keyHandler", null);
    __publicField(this, "scrollHandler", null);
    __publicField(this, "currentIndex", 0);
    this.config = config;
  }
  /**
   * Show the dropdown
   */
  show() {
    this.hide();
    const dropdown = document.createElement("div");
    dropdown.className = `custom-dropdown-menu${this.config.theme ? ` theme-${this.config.theme}` : ""}`;
    dropdown.style.cssText = `
            position: fixed;
            z-index: 100001;
            overflow-y: auto;
            background: var(--comfy-menu-bg, #1a1a1f);
            border: 1px solid var(--border-color, #444);
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            min-width: 120px;
        `;
    this.config.options.forEach((optionValue) => {
      const item = document.createElement("div");
      item.className = "custom-dropdown-item";
      item.dataset.value = optionValue;
      const isSelected = optionValue === this.config.currentValue;
      item.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid var(--border-color, #333);
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 13px;
                color: ${isSelected ? "var(--info-panel-accent-color, #4ecdc4)" : "inherit"};
                background: ${isSelected ? "rgba(78, 205, 196, 0.1)" : "transparent"};
                white-space: nowrap;
            `;
      item.textContent = optionValue;
      item.addEventListener("mouseenter", () => {
        if (!isSelected) {
          item.style.background = "var(--comfy-input-bg, #3a3a3a)";
        }
      });
      item.addEventListener("mouseleave", () => {
        item.style.background = isSelected ? "rgba(78, 205, 196, 0.1)" : "transparent";
      });
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        this.config.onChange(optionValue);
        this.hide();
      });
      dropdown.appendChild(item);
    });
    const lastItem = dropdown.lastElementChild;
    if (lastItem) {
      lastItem.style.borderBottom = "none";
    }
    document.body.appendChild(dropdown);
    this.dropdown = dropdown;
    this.currentIndex = this.config.options.indexOf(this.config.currentValue);
    if (this.currentIndex < 0) this.currentIndex = 0;
    dropdown.setAttribute("tabindex", "-1");
    this.positionWithinViewport();
    this.scrollToSelected();
    this.setupCloseHandlers();
    dropdown.focus();
  }
  /**
   * Hide the dropdown
   */
  hide() {
    var _a, _b;
    if (this.dropdown && this.dropdown.parentNode) {
      this.dropdown.parentNode.removeChild(this.dropdown);
      this.dropdown = null;
    }
    this.cleanupHandlers();
    (_b = (_a = this.config).onClose) == null ? void 0 : _b.call(_a);
  }
  /**
   * Position dropdown within viewport bounds
   */
  positionWithinViewport() {
    if (!this.dropdown) return;
    const margin = 10;
    const gap = 4;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const anchorRect = this.config.anchor.getBoundingClientRect();
    this.dropdown.style.maxWidth = "none";
    this.dropdown.style.maxHeight = "none";
    const naturalRect = this.dropdown.getBoundingClientRect();
    const spaceBelow = viewportHeight - anchorRect.bottom - margin - gap;
    const spaceAbove = anchorRect.top - margin - gap;
    const spaceRight = viewportWidth - anchorRect.left - margin;
    let top;
    let maxHeight;
    if (spaceBelow >= naturalRect.height || spaceBelow >= spaceAbove) {
      top = anchorRect.bottom + gap;
      maxHeight = Math.max(100, spaceBelow);
    } else {
      maxHeight = Math.max(100, spaceAbove);
      top = anchorRect.top - gap - Math.min(naturalRect.height, maxHeight);
    }
    let left = anchorRect.left;
    let maxWidth;
    if (naturalRect.width <= spaceRight) {
      maxWidth = spaceRight;
    } else {
      left = Math.max(margin, viewportWidth - naturalRect.width - margin);
      maxWidth = viewportWidth - margin * 2;
    }
    const minWidth = Math.max(120, anchorRect.width);
    this.dropdown.style.top = `${Math.max(margin, top)}px`;
    this.dropdown.style.left = `${Math.max(margin, left)}px`;
    this.dropdown.style.minWidth = `${minWidth}px`;
    this.dropdown.style.maxWidth = `${maxWidth}px`;
    this.dropdown.style.maxHeight = `${maxHeight}px`;
  }
  /**
   * Scroll to the currently selected item
   */
  scrollToSelected() {
    if (!this.dropdown) return;
    const selectedItem = this.dropdown.querySelector(
      `[data-value="${CSS.escape(this.config.currentValue)}"]`
    );
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: "nearest" });
    }
  }
  /**
   * Setup event handlers for closing the dropdown
   */
  setupCloseHandlers() {
    this.closeHandler = (e) => {
      if (this.dropdown && !this.dropdown.contains(e.target) && !this.config.anchor.contains(e.target)) {
        this.hide();
      }
    };
    const updateActiveItem = (newIndex) => {
      if (!this.dropdown) return;
      const items = this.dropdown.querySelectorAll(".custom-dropdown-item");
      if (items.length === 0) return;
      if (newIndex < 0) newIndex = 0;
      if (newIndex >= items.length) newIndex = items.length - 1;
      if (this.currentIndex >= 0 && this.currentIndex < items.length) {
        const oldItem = items[this.currentIndex];
        const isOldSelected = this.config.options[this.currentIndex] === this.config.currentValue;
        oldItem.style.background = isOldSelected ? "rgba(78, 205, 196, 0.1)" : "transparent";
      }
      this.currentIndex = newIndex;
      const newItem = items[this.currentIndex];
      newItem.style.background = "var(--comfy-input-bg, #3a3a3a)";
      newItem.scrollIntoView({ block: "nearest" });
    };
    this.keyHandler = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        this.hide();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        updateActiveItem(this.currentIndex + 1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        updateActiveItem(this.currentIndex - 1);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (this.currentIndex >= 0 && this.currentIndex < this.config.options.length) {
          this.config.onChange(this.config.options[this.currentIndex]);
          this.hide();
        }
      }
    };
    this.scrollHandler = (e) => {
      if (this.dropdown && e.target instanceof Node && this.dropdown.contains(e.target)) {
        return;
      }
      this.hide();
    };
    setTimeout(() => {
      window.addEventListener("keydown", this.keyHandler, true);
      document.addEventListener("mousedown", this.closeHandler, true);
      document.addEventListener("click", this.closeHandler, true);
      window.addEventListener("scroll", this.scrollHandler, true);
    }, 50);
  }
  /**
   * Cleanup event handlers
   */
  cleanupHandlers() {
    if (this.closeHandler) {
      document.removeEventListener("mousedown", this.closeHandler, true);
      document.removeEventListener("click", this.closeHandler, true);
      this.closeHandler = null;
    }
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler, true);
      this.keyHandler = null;
    }
    if (this.scrollHandler) {
      window.removeEventListener("scroll", this.scrollHandler, true);
      this.scrollHandler = null;
    }
  }
}
function createDropdownTrigger(currentValue, className = "custom-dropdown-trigger") {
  const trigger = document.createElement("div");
  trigger.className = className;
  trigger.setAttribute("tabindex", "0");
  trigger.setAttribute("role", "combobox");
  trigger.setAttribute("aria-haspopup", "listbox");
  const valueSpan = document.createElement("span");
  valueSpan.className = "custom-dropdown-value";
  valueSpan.textContent = currentValue;
  valueSpan.style.cssText = `
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    `;
  const arrow = document.createElement("span");
  arrow.className = "custom-dropdown-arrow";
  arrow.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
  arrow.style.cssText = `
        flex-shrink: 0;
        display: flex;
        align-items: center;
        opacity: 0.7;
    `;
  trigger.appendChild(valueSpan);
  trigger.appendChild(arrow);
  return trigger;
}
function updateDropdownTriggerValue(trigger, value) {
  const valueSpan = trigger.querySelector(".custom-dropdown-value");
  if (valueSpan) {
    valueSpan.textContent = value;
  }
}
export {
  CustomDropdown,
  createDropdownTrigger,
  updateDropdownTriggerValue
};
