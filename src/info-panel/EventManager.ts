/**
 * ComfyUI MagnifyGlass - Info Panel Event Manager (TypeScript)
 * 
 * Complete Event Manager extracted from magnify_info_panel.js
 * Handles all event binding and delegation for the info panel.
 */

import { StateManager } from './StateManager';
import { UIManager } from './UIManager';
import { PositionManager } from './PositionManager';
import { isUserTyping } from '../shared/utils';
import { Logger } from '../shared/logger';

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

        let isDragging = false;
        let rafId: number | null = null;
        let targetX = 0;
        let targetY = 0;

        const startDrag = (e: MouseEvent) => {
            if (!this.panelElement) return;
            const target = e.target as HTMLElement;

            // Only allow dragging from header (expand clickable area)
            const header = target.closest('.panel-header');
            if (!header) return;
            if (target.closest('button')) return;

            // Button 2 (pin icon, data-action="lock") prevents dragging
            if (this.stateManager.state.isPanelLocked) return;

            // Also prevent dragging if we are "Following Glass" (not pinned to screen)
            // This prevents fighting with the auto-positioner and accidental drags
            if (!this.stateManager.state.isPanelPinned) return;

            e.preventDefault();
            e.stopPropagation();

            isDragging = true;

            const startX = e.clientX;
            const startY = e.clientY;
            const rect = this.panelElement.getBoundingClientRect();
            const startLeft = rect.left;
            const startTop = rect.top;

            // Visual feedback - dragging state
            this.panelElement.style.cursor = 'grabbing';
            this.panelElement.style.opacity = '0.9';
            this.panelElement.style.transition = 'none'; // Disable transitions during drag
            document.body.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';

            const onMouseMove = (moveEvent: MouseEvent) => {
                if (!isDragging) return;

                const dx = moveEvent.clientX - startX;
                const dy = moveEvent.clientY - startY;

                targetX = startLeft + dx;
                targetY = startTop + dy;

                // Keep within viewport bounds
                const panelWidth = this.panelElement?.offsetWidth || 0;
                const panelHeight = this.panelElement?.offsetHeight || 0;
                targetX = Math.max(0, Math.min(targetX, window.innerWidth - panelWidth));
                targetY = Math.max(0, Math.min(targetY, window.innerHeight - panelHeight));

                // Use RAF for smooth updates
                if (rafId === null) {
                    rafId = requestAnimationFrame(() => {
                        if (this.panelElement && isDragging) {
                            this.panelElement.style.left = `${targetX}px`;
                            this.panelElement.style.top = `${targetY}px`;
                        }
                        rafId = null;
                    });
                }
            };

            const onMouseUp = () => {
                isDragging = false;

                // Cancel any pending RAF
                if (rafId !== null) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }

                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);

                // Restore visual state
                if (this.panelElement) {
                    this.panelElement.style.cursor = '';
                    this.panelElement.style.opacity = '';
                    this.panelElement.style.transition = '';

                    // Final position update
                    this.panelElement.style.left = `${targetX}px`;
                    this.panelElement.style.top = `${targetY}px`;

                    // Save pinned position
                    this.stateManager.state.pinnedPosition = { x: targetX, y: targetY };
                }

                document.body.style.cursor = '';
                document.body.style.userSelect = '';
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
            Logger.debug('Toggle visibility hotkey matched!');
            e.preventDefault();
            this.callbacks?.toggleVisibility();
        }

        // Toggle Pin
        if (key === (settings["🔍MagnifyGlass.PinPanelHotkey"] as string).toLowerCase()) {
            e.preventDefault();
            this.callbacks?.togglePin();
        }

        // Toggle Hold Info (Pause/Play)
        const holdInfoHotkey = (settings["🔍MagnifyGlass.HoldInfoHotkey"] as string || "p").toLowerCase();
        if (key === holdInfoHotkey) {
            // Only works when Sticky Info (Persist) is enabled
            if (settings["🔍MagnifyGlass.InfoPanelPersist"]) {
                e.preventDefault();
                const isHeld = this.stateManager.toggleHold();
                Logger.debug(`Hold Info toggled: ${isHeld ? 'PAUSED' : 'PLAYING'}`);
                // Update the hover controls UI
                const infoPanel = (window as any).infoPanelManager;
                if (infoPanel?.uiManager) {
                    infoPanel.uiManager.updateControlStates();
                }
            }
        }

        // Toggle Sticky Info (Persist mode)
        const stickyInfoHotkey = (settings["🔍MagnifyGlass.StickyInfoHotkey"] as string || "s").toLowerCase();
        if (key === stickyInfoHotkey) {
            e.preventDefault();
            const newValue = !(settings["🔍MagnifyGlass.InfoPanelPersist"] as boolean);
            // Update local state
            settings["🔍MagnifyGlass.InfoPanelPersist"] = newValue;
            // Persist to ComfyUI settings
            try {
                const app = (window as any).app;
                app.ui.settings.setSettingValue("🔍MagnifyGlass.InfoPanelPersist", newValue);
            } catch (err) {
                Logger.debug('Failed to persist sticky info setting');
            }
            // If disabling sticky, also disable hold
            if (!newValue) {
                this.stateManager.state.isInfoHeld = false;
            }
            Logger.debug(`Sticky Info toggled: ${newValue ? 'ON' : 'OFF'}`);
            // Update the hover controls UI
            const infoPanel = (window as any).infoPanelManager;
            if (infoPanel?.uiManager) {
                infoPanel.uiManager.updateControlStates();
            }
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
