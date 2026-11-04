/**
 * ComfyUI MagnifyGlass - Info Panel Event Manager (TypeScript)
 * 
 * Complete Event Manager extracted from magnify_info_panel.js
 * Handles all event binding and delegation for the info panel.
 */

import { StateManager } from './StateManager';
import { isUserTyping, getSettingValue, setSettingValue, clamp } from '../shared/utils';
import { DEFAULT_PANEL_SETTINGS, DEFAULT_GLASS_SETTINGS } from '../shared/settings/defaults';

export interface EventCallbacks {
    toggleVisibility: () => void;
    toggleFloat: () => void;
    toggleSticky: () => void;
    /** Apply a dragged position or size: styles, toolbar states and positions */
    updateLayout: () => void;
    isGlassActive: () => boolean;
}

/**
 * Event Manager class.
 * Handles all event listeners for the info panel.
 */
export class EventManager {
    stateManager: StateManager;
    panelElement: HTMLElement | null;
    callbacks: EventCallbacks | null;

    dragCleanup: (() => void) | null;

    boundHandleKeyDown: (e: KeyboardEvent) => void;

    constructor(stateManager: StateManager, panelElement: HTMLElement | null, callbacks?: EventCallbacks) {
        this.stateManager = stateManager;
        this.panelElement = panelElement;
        this.callbacks = callbacks || null;
        this.dragCleanup = null;

        this.boundHandleKeyDown = this.handleKeyDown.bind(this);

        this.setupEventListeners();
    }

    setupEventListeners(): void {
        this.setupHotkeyEvents();
        this.setupDragEvents();
        this.setupHoverEvents();
    }

    setupHotkeyEvents(): void {
        document.addEventListener('keydown', this.boundHandleKeyDown);
    }

    /**
     * Dragging the header floats the panel; the corner handle resizes it into the Width and Max Height settings.
     * A press that does not move is a click, so it leaves the panel where it is.
     */
    setupDragEvents(): void {
        const panel = this.panelElement;
        if (!panel) return;

        const startDrag = (e: PointerEvent) => {
            const target = e.target as HTMLElement;
            const resizing = !!target.closest('.panel-resize');
            if (e.button !== 0 || (!resizing && (!target.closest('.panel-header') || target.closest('button')))) return;
            e.preventDefault();

            const state = this.stateManager.state;
            const settings = state.settings;
            const startX = e.clientX;
            const startY = e.clientY;
            const rect = panel.getBoundingClientRect();
            const content = panel.querySelector('.panel-content') as HTMLElement;
            const startContentHeight = content.offsetHeight;
            // Max Height shows only while the content is at it
            const capped = content.scrollHeight > startContentHeight;
            const startWidth = settings["🔍MagnifyGlass.InfoPanelWidth"];
            const startMaxHeight = settings["🔍MagnifyGlass.InfoPanelMaxHeight"];
            let moved = false;

            const onPointerMove = (move: PointerEvent) => {
                const dx = move.clientX - startX;
                const dy = move.clientY - startY;
                if (!moved && Math.abs(dx) + Math.abs(dy) < 3) return;
                moved = true;
                if (resizing) {
                    // An axis that moves less than a drag keeps its setting, so a sideways drag keeps Max Height
                    settings["🔍MagnifyGlass.InfoPanelWidth"] = Math.abs(dx) >= 3 ? clamp(Math.round(rect.width + dx), 200, 600) : startWidth;
                    settings["🔍MagnifyGlass.InfoPanelMaxHeight"] = capped && Math.abs(dy) >= 3 ? clamp(Math.round(startContentHeight + dy), 200, 1500) : startMaxHeight;
                } else {
                    state.isFloating = true;
                    state.floatPosition = { x: rect.left + dx, y: rect.top + dy };
                }
                this.callbacks?.updateLayout();
            };

            const onPointerUp = () => {
                document.removeEventListener('pointermove', onPointerMove);
                document.removeEventListener('pointerup', onPointerUp);
                document.removeEventListener('pointercancel', onPointerUp);
                panel.classList.remove('is-dragging');
                if (!moved) return;
                if (resizing) {
                    for (const [id, start] of [["🔍MagnifyGlass.InfoPanelWidth", startWidth], ["🔍MagnifyGlass.InfoPanelMaxHeight", startMaxHeight]] as const) {
                        if (settings[id] !== start) setSettingValue(id, settings[id]);
                    }
                } else {
                    this.stateManager.saveLayout();
                }
            };

            panel.classList.add('is-dragging');
            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', onPointerUp);
            document.addEventListener('pointercancel', onPointerUp);
        };

        panel.addEventListener('pointerdown', startDrag);
        this.dragCleanup = () => panel.removeEventListener('pointerdown', startDrag);
    }

    setupHoverEvents(): void {
        if (!this.panelElement) return;

        this.panelElement.addEventListener('mouseenter', () => {
            this.stateManager.state.isPanelHovered = true;
        });

        this.panelElement.addEventListener('mouseleave', () => {
            this.stateManager.state.isPanelHovered = false;
        });
    }

    /**
     * Panel hotkeys act only while the glass is active and never with Ctrl, Meta or Shift held. Alt must be
     * held when AltRequired is on and must not be otherwise. Keys are read on each press, so changes apply at once.
     */
    handleKeyDown(e: KeyboardEvent): void {
        if (isUserTyping() || !this.callbacks?.isGlassActive()) return;
        if (e.ctrlKey || e.metaKey || e.shiftKey) return;
        const altRequired = getSettingValue("🔍MagnifyGlass.AltRequired", DEFAULT_GLASS_SETTINGS["🔍MagnifyGlass.AltRequired"]);
        if (e.altKey !== altRequired) return;

        const key = e.key.toLowerCase();
        const hotkey = (id: keyof typeof DEFAULT_PANEL_SETTINGS & string) => String(getSettingValue(id, DEFAULT_PANEL_SETTINGS[id])).toLowerCase();

        if (key === hotkey("🔍MagnifyGlass.ToggleHotkey")) {
            e.preventDefault();
            this.callbacks.toggleVisibility();
        }

        // Follow glass / Float
        if (key === hotkey("🔍MagnifyGlass.PinPanelHotkey")) {
            e.preventDefault();
            this.callbacks.toggleFloat();
        }

        if (key === hotkey("🔍MagnifyGlass.StickyInfoHotkey")) {
            e.preventDefault();
            this.callbacks.toggleSticky();
        }
    }

    cleanup(): void {
        document.removeEventListener('keydown', this.boundHandleKeyDown);
        if (this.dragCleanup) this.dragCleanup();
    }
}
