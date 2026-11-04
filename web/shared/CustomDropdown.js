var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
import { Icons } from "./icons.js";
let dropdownCount = 0;
class CustomDropdown {
  // Item that Enter picks, moved by the arrows and hover
  constructor(config) {
    __publicField(this, "dropdown", null);
    __publicField(this, "filter", null);
    __publicField(this, "visibleItems", []);
    __publicField(this, "config");
    __publicField(this, "closeHandler", null);
    __publicField(this, "keyHandler", null);
    __publicField(this, "scrollHandler", null);
    __publicField(this, "listenerTimer", null);
    __publicField(this, "activeItem", null);
    this.config = config;
  }
  /**
   * Show the dropdown. Does nothing while it is already open.
   */
  show() {
    if (this.dropdown) return;
    const id = `custom-dropdown-${++dropdownCount}`;
    const dropdown = document.createElement("div");
    dropdown.className = "custom-dropdown-menu";
    dropdown.style.fontSize = getComputedStyle(this.config.anchor).fontSize;
    const filter = document.createElement("input");
    filter.type = "text";
    filter.className = "custom-dropdown-filter";
    filter.placeholder = "Filter…";
    filter.setAttribute("role", "combobox");
    filter.setAttribute("aria-label", "Filter options");
    filter.setAttribute("aria-autocomplete", "list");
    filter.setAttribute("aria-expanded", "true");
    filter.setAttribute("aria-controls", `${id}-list`);
    const list = document.createElement("div");
    list.className = "custom-dropdown-list";
    list.id = `${id}-list`;
    list.setAttribute("role", "listbox");
    const items = this.config.options.map((optionValue, i) => {
      const item = document.createElement("div");
      item.className = "custom-dropdown-item";
      item.id = `${id}-${i}`;
      item.dataset.value = optionValue;
      item.setAttribute("role", "option");
      item.setAttribute("aria-selected", String(optionValue === this.config.currentValue));
      item.textContent = optionValue;
      item.addEventListener("mouseenter", () => this.setActive(this.visibleItems.indexOf(item), false));
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        this.select(optionValue);
      });
      list.appendChild(item);
      return item;
    });
    filter.addEventListener("input", () => {
      const query = filter.value.toLowerCase();
      for (const item of items) {
        item.hidden = !item.dataset.value.toLowerCase().includes(query);
      }
      this.visibleItems = items.filter((item) => !item.hidden);
      this.setActive(0);
    });
    dropdown.append(filter, list);
    document.body.appendChild(dropdown);
    this.dropdown = dropdown;
    this.filter = filter;
    this.visibleItems = items;
    this.positionWithinViewport();
    this.setActive(Math.max(0, this.config.options.indexOf(this.config.currentValue)));
    this.setupCloseHandlers();
    this.config.anchor.setAttribute("aria-expanded", "true");
    filter.focus();
  }
  /**
   * Hide the dropdown. Fires onClose once, and does nothing when it is not open.
   */
  hide() {
    var _a, _b;
    if (!this.dropdown) return;
    this.dropdown.remove();
    this.dropdown = null;
    this.filter = null;
    this.visibleItems = [];
    this.activeItem = null;
    this.cleanupHandlers();
    this.config.anchor.setAttribute("aria-expanded", "false");
    (_b = (_a = this.config).onClose) == null ? void 0 : _b.call(_a);
  }
  select(value) {
    this.config.onChange(value);
    this.hide();
    this.config.anchor.focus();
  }
  /**
   * Move the active item, clamped to the visible items
   */
  setActive(index, scroll = true) {
    var _a, _b, _c;
    (_a = this.activeItem) == null ? void 0 : _a.classList.remove("active");
    this.activeItem = this.visibleItems[Math.max(0, Math.min(index, this.visibleItems.length - 1))] ?? null;
    if (this.activeItem) {
      this.activeItem.classList.add("active");
      if (scroll) this.activeItem.scrollIntoView({ block: "nearest" });
      (_b = this.filter) == null ? void 0 : _b.setAttribute("aria-activedescendant", this.activeItem.id);
    } else {
      (_c = this.filter) == null ? void 0 : _c.removeAttribute("aria-activedescendant");
    }
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
    const naturalRect = this.dropdown.getBoundingClientRect();
    const spaceBelow = viewportHeight - anchorRect.bottom - margin - gap;
    const spaceAbove = anchorRect.top - margin - gap;
    const spaceRight = viewportWidth - anchorRect.left - margin;
    let maxHeight;
    if (spaceBelow >= naturalRect.height || spaceBelow >= spaceAbove) {
      this.dropdown.style.top = `${anchorRect.bottom + gap}px`;
      maxHeight = Math.max(100, spaceBelow);
    } else {
      this.dropdown.style.bottom = `${viewportHeight - anchorRect.top + gap}px`;
      maxHeight = Math.max(100, spaceAbove);
    }
    let left = anchorRect.left;
    let maxWidth;
    if (naturalRect.width <= spaceRight) {
      maxWidth = spaceRight;
    } else {
      left = Math.max(margin, viewportWidth - naturalRect.width - margin);
      maxWidth = viewportWidth - margin * 2;
    }
    const width = Math.min(Math.max(120, anchorRect.width, naturalRect.width), maxWidth);
    this.dropdown.style.left = `${Math.max(margin, left)}px`;
    this.dropdown.style.width = `${width}px`;
    this.dropdown.style.maxHeight = `${maxHeight}px`;
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
    this.keyHandler = (e) => {
      if (e.key === "Tab") {
        this.hide();
        this.config.anchor.focus();
        return;
      }
      if (e.key !== "Escape" && e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "Enter") return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      const index = this.activeItem ? this.visibleItems.indexOf(this.activeItem) : -1;
      if (e.key === "Escape") {
        this.hide();
        this.config.anchor.focus();
      } else if (e.key === "ArrowDown") {
        this.setActive(index + 1);
      } else if (e.key === "ArrowUp") {
        this.setActive(index - 1);
      } else if (this.activeItem) {
        this.select(this.activeItem.dataset.value);
      }
    };
    this.scrollHandler = (e) => {
      if (this.dropdown && e.target instanceof Node && this.dropdown.contains(e.target)) {
        return;
      }
      this.hide();
    };
    this.listenerTimer = setTimeout(() => {
      this.listenerTimer = null;
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
    if (this.listenerTimer) {
      clearTimeout(this.listenerTimer);
      this.listenerTimer = null;
    }
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
  trigger.setAttribute("aria-expanded", "false");
  const valueSpan = document.createElement("span");
  valueSpan.className = "custom-dropdown-value";
  valueSpan.textContent = currentValue;
  const arrow = document.createElement("span");
  arrow.className = "custom-dropdown-arrow";
  arrow.innerHTML = Icons.chevronDown;
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
