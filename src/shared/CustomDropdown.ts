/**
 * ComfyUI MagnifyGlass - Custom Dropdown
 *
 * A custom dropdown component that stays within viewport bounds.
 * Replaces native select elements for better positioning control.
 * Its filter input holds focus while it is open, so typing never reaches ComfyUI's hotkeys.
 */

import { Icons } from './icons';

export interface CustomDropdownConfig {
    options: string[];
    currentValue: string;
    anchor: HTMLElement;
    onChange: (value: string) => void;
    onClose?: () => void;
}

let dropdownCount = 0;

/**
 * Custom dropdown that positions itself within viewport bounds.
 * Use this instead of native <select> elements when positioning control is needed.
 */
export class CustomDropdown {
    private dropdown: HTMLElement | null = null;
    private filter: HTMLInputElement | null = null;
    private visibleItems: HTMLElement[] = [];
    private config: CustomDropdownConfig;
    private closeHandler: ((e: MouseEvent) => void) | null = null;
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;
    private scrollHandler: ((e: Event) => void) | null = null;
    private listenerTimer: ReturnType<typeof setTimeout> | null = null;
    private activeItem: HTMLElement | null = null;  // Item that Enter picks, moved by the arrows and hover

    constructor(config: CustomDropdownConfig) {
        this.config = config;
    }

    /**
     * Show the dropdown. Does nothing while it is already open.
     */
    show(): void {
        if (this.dropdown) return;

        const id = `custom-dropdown-${++dropdownCount}`;
        const dropdown = document.createElement('div');
        dropdown.className = 'custom-dropdown-menu';
        // Appended to body, so it takes the size of the text it opens from
        dropdown.style.fontSize = getComputedStyle(this.config.anchor).fontSize;

        const filter = document.createElement('input');
        filter.type = 'text';
        filter.className = 'custom-dropdown-filter';
        filter.placeholder = 'Filter…';
        filter.setAttribute('role', 'combobox');
        filter.setAttribute('aria-label', 'Filter options');
        filter.setAttribute('aria-autocomplete', 'list');
        filter.setAttribute('aria-expanded', 'true');
        filter.setAttribute('aria-controls', `${id}-list`);

        const list = document.createElement('div');
        list.className = 'custom-dropdown-list';
        list.id = `${id}-list`;
        list.setAttribute('role', 'listbox');

        const items = this.config.options.map((optionValue, i) => {
            const item = document.createElement('div');
            item.className = 'custom-dropdown-item';
            item.id = `${id}-${i}`;
            item.dataset.value = optionValue;
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', String(optionValue === this.config.currentValue));
            item.textContent = optionValue;

            item.addEventListener('mouseenter', () => this.setActive(this.visibleItems.indexOf(item), false));
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.select(optionValue);
            });

            list.appendChild(item);
            return item;
        });

        filter.addEventListener('input', () => {
            const query = filter.value.toLowerCase();
            for (const item of items) {
                item.hidden = !item.dataset.value!.toLowerCase().includes(query);
            }
            this.visibleItems = items.filter(item => !item.hidden);
            this.setActive(0);
        });

        dropdown.append(filter, list);
        document.body.appendChild(dropdown);
        this.dropdown = dropdown;
        this.filter = filter;
        this.visibleItems = items;

        // Position within viewport
        this.positionWithinViewport();

        // Start on the current value
        this.setActive(Math.max(0, this.config.options.indexOf(this.config.currentValue)));

        // Setup close handlers
        this.setupCloseHandlers();

        this.config.anchor.setAttribute('aria-expanded', 'true');
        filter.focus();
    }

    /**
     * Hide the dropdown. Fires onClose once, and does nothing when it is not open.
     */
    hide(): void {
        if (!this.dropdown) return;
        this.dropdown.remove();
        this.dropdown = null;
        this.filter = null;
        this.visibleItems = [];
        this.activeItem = null;
        this.cleanupHandlers();
        this.config.anchor.setAttribute('aria-expanded', 'false');
        this.config.onClose?.();
    }

    private select(value: string): void {
        this.config.onChange(value);
        this.hide();
        this.config.anchor.focus();
    }

    /**
     * Move the active item, clamped to the visible items
     */
    private setActive(index: number, scroll = true): void {
        this.activeItem?.classList.remove('active');
        this.activeItem = this.visibleItems[Math.max(0, Math.min(index, this.visibleItems.length - 1))] ?? null;

        if (this.activeItem) {
            this.activeItem.classList.add('active');
            if (scroll) this.activeItem.scrollIntoView({ block: 'nearest' });
            this.filter?.setAttribute('aria-activedescendant', this.activeItem.id);
        } else {
            this.filter?.removeAttribute('aria-activedescendant');
        }
    }

    /**
     * Position dropdown within viewport bounds
     */
    private positionWithinViewport(): void {
        if (!this.dropdown) return;

        const margin = 10;
        const gap = 4;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const anchorRect = this.config.anchor.getBoundingClientRect();

        const naturalRect = this.dropdown.getBoundingClientRect();

        // Calculate available space in each direction
        const spaceBelow = viewportHeight - anchorRect.bottom - margin - gap;
        const spaceAbove = anchorRect.top - margin - gap;
        const spaceRight = viewportWidth - anchorRect.left - margin;

        // Vertical positioning: prefer below, flip above if needed. Above, it is anchored by its
        // bottom edge so it stays against the anchor when the filter shrinks the list
        let maxHeight: number;

        if (spaceBelow >= naturalRect.height || spaceBelow >= spaceAbove) {
            this.dropdown.style.top = `${anchorRect.bottom + gap}px`;
            maxHeight = Math.max(100, spaceBelow);
        } else {
            this.dropdown.style.bottom = `${viewportHeight - anchorRect.top + gap}px`;
            maxHeight = Math.max(100, spaceAbove);
        }

        // Horizontal positioning: prefer left-aligned with anchor, shift if needed
        let left = anchorRect.left;
        let maxWidth: number;

        if (naturalRect.width <= spaceRight) {
            // Fits when left-aligned
            maxWidth = spaceRight;
        } else {
            // Shift left to fit, or constrain width
            left = Math.max(margin, viewportWidth - naturalRect.width - margin);
            maxWidth = viewportWidth - margin * 2;
        }

        // At least as wide as the anchor, and a fixed width so filtering does not resize it
        const width = Math.min(Math.max(120, anchorRect.width, naturalRect.width), maxWidth);

        this.dropdown.style.left = `${Math.max(margin, left)}px`;
        this.dropdown.style.width = `${width}px`;
        this.dropdown.style.maxHeight = `${maxHeight}px`;
    }

    /**
     * Setup event handlers for closing the dropdown
     */
    private setupCloseHandlers(): void {
        // Close on click/mousedown outside - use capture phase to ensure we get the event
        this.closeHandler = (e: MouseEvent) => {
            if (this.dropdown &&
                !this.dropdown.contains(e.target as Node) &&
                !this.config.anchor.contains(e.target as Node)) {
                this.hide();
            }
        };

        // Key handler for navigation and closing
        this.keyHandler = (e: KeyboardEvent) => {
            // Tab closes it like a native select, and moves on from the trigger
            if (e.key === 'Tab') {
                this.hide();
                this.config.anchor.focus();
                return;
            }
            if (e.key !== 'Escape' && e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return;
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            const index = this.activeItem ? this.visibleItems.indexOf(this.activeItem) : -1;
            if (e.key === 'Escape') {
                this.hide();
                this.config.anchor.focus();
            } else if (e.key === 'ArrowDown') {
                this.setActive(index + 1);
            } else if (e.key === 'ArrowUp') {
                this.setActive(index - 1);
            } else if (this.activeItem) {
                this.select(this.activeItem.dataset.value!);
            }
        };

        // Close on scroll outside the dropdown (not when scrolling within it)
        this.scrollHandler = (e: Event) => {
            if (this.dropdown && e.target instanceof Node && this.dropdown.contains(e.target)) {
                return;
            }
            this.hide();
        };

        // Delay adding listeners to avoid immediate closure from the opening click
        this.listenerTimer = setTimeout(() => {
            this.listenerTimer = null;
            // Use window and capture phase for key events to intercept before ComfyUI
            window.addEventListener('keydown', this.keyHandler!, true);
            // Use capture phase (true) to get events before they can be stopped
            document.addEventListener('mousedown', this.closeHandler!, true);
            document.addEventListener('click', this.closeHandler!, true);
            window.addEventListener('scroll', this.scrollHandler!, true);
        }, 50);
    }

    /**
     * Cleanup event handlers
     */
    private cleanupHandlers(): void {
        if (this.listenerTimer) {
            clearTimeout(this.listenerTimer);
            this.listenerTimer = null;
        }
        if (this.closeHandler) {
            document.removeEventListener('mousedown', this.closeHandler, true);
            document.removeEventListener('click', this.closeHandler, true);
            this.closeHandler = null;
        }
        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler, true);
            this.keyHandler = null;
        }
        if (this.scrollHandler) {
            window.removeEventListener('scroll', this.scrollHandler, true);
            this.scrollHandler = null;
        }
    }
}

/**
 * Create a custom dropdown trigger element that looks like a select
 */
export function createDropdownTrigger(
    currentValue: string,
    className: string = 'custom-dropdown-trigger'
): HTMLElement {
    const trigger = document.createElement('div');
    trigger.className = className;
    trigger.setAttribute('tabindex', '0');
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const valueSpan = document.createElement('span');
    valueSpan.className = 'custom-dropdown-value';
    valueSpan.textContent = currentValue;

    const arrow = document.createElement('span');
    arrow.className = 'custom-dropdown-arrow';
    arrow.innerHTML = Icons.chevronDown;

    trigger.appendChild(valueSpan);
    trigger.appendChild(arrow);

    return trigger;
}

/**
 * Update the displayed value in a dropdown trigger
 */
export function updateDropdownTriggerValue(trigger: HTMLElement, value: string): void {
    const valueSpan = trigger.querySelector('.custom-dropdown-value');
    if (valueSpan) {
        valueSpan.textContent = value;
    }
}
