/**
 * ComfyUI MagnifyGlass - Custom Dropdown
 *
 * A custom dropdown component that stays within viewport bounds.
 * Replaces native select elements for better positioning control.
 */

export interface CustomDropdownConfig {
    options: string[];
    currentValue: string;
    anchor: HTMLElement;
    onChange: (value: string) => void;
    onClose?: () => void;
    theme?: string;
}

/**
 * Custom dropdown that positions itself within viewport bounds.
 * Use this instead of native <select> elements when positioning control is needed.
 */
export class CustomDropdown {
    private dropdown: HTMLElement | null = null;
    private config: CustomDropdownConfig;
    private closeHandler: ((e: MouseEvent) => void) | null = null;
    private keyHandler: ((e: KeyboardEvent) => void) | null = null;
    private scrollHandler: ((e: Event) => void) | null = null;
    private currentIndex: number = 0;  // Track active item for keyboard navigation

    constructor(config: CustomDropdownConfig) {
        this.config = config;
    }

    /**
     * Show the dropdown
     */
    show(): void {
        this.hide(); // Close any existing dropdown first

        const dropdown = document.createElement('div');
        dropdown.className = `custom-dropdown-menu${this.config.theme ? ` theme-${this.config.theme}` : ''}`;
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

        // Build dropdown items
        this.config.options.forEach((optionValue) => {
            const item = document.createElement('div');
            item.className = 'custom-dropdown-item';
            item.dataset.value = optionValue;

            const isSelected = optionValue === this.config.currentValue;
            item.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid var(--border-color, #333);
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                font-size: 13px;
                color: ${isSelected ? 'var(--info-panel-accent-color, #4ecdc4)' : 'inherit'};
                background: ${isSelected ? 'rgba(78, 205, 196, 0.1)' : 'transparent'};
                white-space: nowrap;
            `;
            item.textContent = optionValue;

            // Hover effect
            item.addEventListener('mouseenter', () => {
                if (!isSelected) {
                    item.style.background = 'var(--comfy-input-bg, #3a3a3a)';
                }
            });
            item.addEventListener('mouseleave', () => {
                item.style.background = isSelected ? 'rgba(78, 205, 196, 0.1)' : 'transparent';
            });

            // Selection handler
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.config.onChange(optionValue);
                this.hide();
            });

            dropdown.appendChild(item);
        });

        // Remove border from last item
        const lastItem = dropdown.lastElementChild as HTMLElement;
        if (lastItem) {
            lastItem.style.borderBottom = 'none';
        }

        document.body.appendChild(dropdown);
        this.dropdown = dropdown;

        // Initialize currentIndex based on currently selected value
        this.currentIndex = this.config.options.indexOf(this.config.currentValue);
        if (this.currentIndex < 0) this.currentIndex = 0;

        // Make dropdown focusable for keyboard events
        dropdown.setAttribute('tabindex', '-1');

        // Position within viewport
        this.positionWithinViewport();

        // Scroll to selected item
        this.scrollToSelected();

        // Setup close handlers
        this.setupCloseHandlers();

        // Focus dropdown for keyboard navigation
        dropdown.focus();
    }

    /**
     * Hide the dropdown
     */
    hide(): void {
        if (this.dropdown && this.dropdown.parentNode) {
            this.dropdown.parentNode.removeChild(this.dropdown);
            this.dropdown = null;
        }
        this.cleanupHandlers();
        this.config.onClose?.();
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

        // Temporarily remove constraints to measure natural size
        this.dropdown.style.maxWidth = 'none';
        this.dropdown.style.maxHeight = 'none';
        const naturalRect = this.dropdown.getBoundingClientRect();

        // Calculate available space in each direction
        const spaceBelow = viewportHeight - anchorRect.bottom - margin - gap;
        const spaceAbove = anchorRect.top - margin - gap;
        const spaceRight = viewportWidth - anchorRect.left - margin;

        // Vertical positioning: prefer below, flip above if needed
        let top: number;
        let maxHeight: number;

        if (spaceBelow >= naturalRect.height || spaceBelow >= spaceAbove) {
            // Position below anchor
            top = anchorRect.bottom + gap;
            maxHeight = Math.max(100, spaceBelow);
        } else {
            // Position above anchor
            maxHeight = Math.max(100, spaceAbove);
            top = anchorRect.top - gap - Math.min(naturalRect.height, maxHeight);
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

        // Ensure minimum width matches anchor
        const minWidth = Math.max(120, anchorRect.width);

        // Apply final position and constraints
        this.dropdown.style.top = `${Math.max(margin, top)}px`;
        this.dropdown.style.left = `${Math.max(margin, left)}px`;
        this.dropdown.style.minWidth = `${minWidth}px`;
        this.dropdown.style.maxWidth = `${maxWidth}px`;
        this.dropdown.style.maxHeight = `${maxHeight}px`;
    }

    /**
     * Scroll to the currently selected item
     */
    private scrollToSelected(): void {
        if (!this.dropdown) return;

        const selectedItem = this.dropdown.querySelector(
            `[data-value="${CSS.escape(this.config.currentValue)}"]`
        ) as HTMLElement;

        if (selectedItem) {
            // Scroll the item into view, centered if possible
            selectedItem.scrollIntoView({ block: 'nearest' });
        }
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

        // Helper to update active item visually
        const updateActiveItem = (newIndex: number) => {
            if (!this.dropdown) return;
            const items = this.dropdown.querySelectorAll('.custom-dropdown-item');
            if (items.length === 0) return;

            // Clamp index
            if (newIndex < 0) newIndex = 0;
            if (newIndex >= items.length) newIndex = items.length - 1;

            // Remove highlight from old item
            if (this.currentIndex >= 0 && this.currentIndex < items.length) {
                const oldItem = items[this.currentIndex] as HTMLElement;
                const isOldSelected = this.config.options[this.currentIndex] === this.config.currentValue;
                oldItem.style.background = isOldSelected ? 'rgba(78, 205, 196, 0.1)' : 'transparent';
            }

            this.currentIndex = newIndex;

            // Highlight new item
            const newItem = items[this.currentIndex] as HTMLElement;
            newItem.style.background = 'var(--comfy-input-bg, #3a3a3a)';
            newItem.scrollIntoView({ block: 'nearest' });
        };

        // Key handler for navigation and closing
        this.keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.hide();
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                updateActiveItem(this.currentIndex + 1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                updateActiveItem(this.currentIndex - 1);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                if (this.currentIndex >= 0 && this.currentIndex < this.config.options.length) {
                    this.config.onChange(this.config.options[this.currentIndex]);
                    this.hide();
                }
            }
        };

        // Close on scroll outside the dropdown (not when scrolling within it)
        this.scrollHandler = (e: Event) => {
            // Don't close if scrolling within the dropdown itself
            if (this.dropdown && e.target instanceof Node && this.dropdown.contains(e.target)) {
                return;
            }
            this.hide();
        };

        // Delay adding listeners to avoid immediate closure from the opening click
        setTimeout(() => {
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
        if (this.closeHandler) {
            document.removeEventListener('mousedown', this.closeHandler, true);
            document.removeEventListener('click', this.closeHandler, true);
            this.closeHandler = null;
        }
        if (this.keyHandler) {
            window.removeEventListener('keydown', this.keyHandler, true);  // Match window listener
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

    const valueSpan = document.createElement('span');
    valueSpan.className = 'custom-dropdown-value';
    valueSpan.textContent = currentValue;
    valueSpan.style.cssText = `
        flex: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    `;

    const arrow = document.createElement('span');
    arrow.className = 'custom-dropdown-arrow';
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

/**
 * Update the displayed value in a dropdown trigger
 */
export function updateDropdownTriggerValue(trigger: HTMLElement, value: string): void {
    const valueSpan = trigger.querySelector('.custom-dropdown-value');
    if (valueSpan) {
        valueSpan.textContent = value;
    }
}
