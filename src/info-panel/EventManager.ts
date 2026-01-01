/**
 * ComfyUI MagnifyGlass - Info Panel Event Manager (TypeScript)
 * 
 * Complete Event Manager extracted from magnify_info_panel.js
 * Handles all event binding and delegation for the info panel.
 */

import { StateManager } from './StateManager';
import { UIManager } from './UIManager'; // Kept for type compatibility if needed, though we use HTMLElement mostly
import { PositionManager } from './PositionManager';
import { isUserTyping } from '../shared/utils';

export interface EventCallbacks {
    toggleVisibility: () => void;
    togglePin: () => void;
    updatePosition: () => void;
}

/**
 * Event Manager class.
 * Handles all event listeners for the info panel.
 */
export class EventManager {
    stateManager: StateManager;
    panelElement: HTMLElement | null;
    positionManager: PositionManager;
    callbacks: EventCallbacks | null;

    dragCleanup: (() => void) | null;

    boundHandleMouseMove: (e: MouseEvent) => void;
    boundHandleKeyDown: (e: KeyboardEvent) => void;
    boundHandleKeyUp: (e: KeyboardEvent) => void;

    constructor(stateManager: StateManager, panelElement: HTMLElement | null, positionManager: PositionManager, callbacks?: EventCallbacks) {
        this.stateManager = stateManager;
        this.panelElement = panelElement;
        this.positionManager = positionManager;
        this.callbacks = callbacks || null;
        this.dragCleanup = null;

        this.boundHandleMouseMove = this.handleMouseMove.bind(this);
        this.boundHandleKeyDown = this.handleKeyDown.bind(this);
        this.boundHandleKeyUp = this.handleKeyUp.bind(this);

        this.setupEventListeners();
    }

    setupEventListeners(): void {
        this.setupPanelEvents();
        this.setupHotkeyEvents();
        this.setupDragEvents();
        this.setupHoverEvents();
    }

    setupPanelEvents(): void {
        if (!this.panelElement) return;

        // Vue handles most internal events now.
        // We can keep specific global-ish listeners if needed here.
    }

    setupHotkeyEvents(): void {
        document.addEventListener('keydown', this.boundHandleKeyDown);
    }

    setupDragEvents(): void {
        if (!this.panelElement) return;

        // Simple drag implementation for the Vue panel
        // The dragging logic could be inside Vue, but if we want to update global state/position, we can do it here.
        // For now, let's look for the header element.

        // We need to wait for Vue to render the header?
        // Since we pass the container, and Vue mounts to it, the header might be inside.
        // We can use event delegation on the container.

        const startDrag = (e: MouseEvent) => {
            if (!this.panelElement) return;
            const target = e.target as HTMLElement;

            // Only allow dragging from header
            if (!target.closest('.mag-panel-header')) return;
            if (target.closest('button')) return;

            e.preventDefault();

            const startX = e.clientX;
            const startY = e.clientY;
            const rect = this.panelElement.getBoundingClientRect();
            const startLeft = rect.left;
            const startTop = rect.top;

            // Use requestAnimationFrame for smoother dragging?
            const onMouseMove = (moveEvent: MouseEvent) => {
                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;

                if (this.panelElement) {
                    this.panelElement.style.left = `${startLeft + dx}px`;
                    this.panelElement.style.top = `${startTop + dy}px`;
                }
            };

            const onMouseUp = () => {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                // Save pinned position
                if (this.panelElement) {
                    const finalRect = this.panelElement.getBoundingClientRect();
                    this.stateManager.state.pinnedPosition = { x: finalRect.left, y: finalRect.top };
                    // Auto-pin on drag end?
                    if (!this.stateManager.state.isPanelPinned) {
                        // callbacks.togglePin? Or just set state?
                        // Better to let user manually pin, or follow existing logic.
                    }
                }
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        };

        this.panelElement.addEventListener('mousedown', startDrag);

        this.dragCleanup = () => {
            if (this.panelElement) this.panelElement.removeEventListener('mousedown', startDrag);
        };
    }

    setupHoverEvents(): void {
        if (!this.panelElement) return;

        this.panelElement.addEventListener('mouseenter', () => {
            this.stateManager.state.isPanelHovered = true;
            this.stateManager.clearAutoExpandTimer();
        });

        this.panelElement.addEventListener('mouseleave', () => {
            this.stateManager.state.isPanelHovered = false;
            if (!this.stateManager.state.isHoveringNode) {
                this.stateManager.scheduleAutoCollapse();
            }
        });
    }

    handleKeyDown(e: KeyboardEvent): void {
        if (isUserTyping()) return;

        const settings = this.stateManager.state.settings;
        const key = e.key.toLowerCase();
        // console.log(`[InfoPanel] KeyDown: ${key}`);

        // Toggle visibility
        if (key === (settings["🔍MagnifyGlass.ToggleHotkey"] as string).toLowerCase()) {
            console.log("[InfoPanel] Toggle visibility hotkey matched!");
            e.preventDefault();
            this.callbacks?.toggleVisibility();
        }

        // Toggle Pin
        if (key === (settings["🔍MagnifyGlass.PinPanelHotkey"] as string).toLowerCase()) {
            e.preventDefault();
            this.callbacks?.togglePin();
        }
    }

    handleMouseMove(e: MouseEvent): void {
        // Placeholder
    }

    handleKeyUp(e: KeyboardEvent): void {
        // Placeholder
    }

    cleanup(): void {
        document.removeEventListener('keydown', this.boundHandleKeyDown);
        if (this.dragCleanup) this.dragCleanup();
    }
}
