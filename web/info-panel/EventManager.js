/**
 * ComfyUI MagnifyGlass - Info Panel Event Manager
 * 
 * Complete Event Manager extracted from magnify_info_panel.js
 * Handles all event binding and delegation for the info panel.
 */

import { isUserTyping } from '../shared/utils.js';

/**
 * Event Manager class.
 * Handles all event binding and delegation.
 */
export class EventManager {
    /**
     * @param {import('./StateManager.js').StateManager} stateManager 
     * @param {import('./UIManager.js').UIManager} uiManager 
     * @param {import('./PositionManager.js').PositionManager} positionManager 
     */
    constructor(stateManager, uiManager, positionManager) {
        this.stateManager = stateManager;
        this.uiManager = uiManager;
        this.positionManager = positionManager;
        this.dragCleanup = null;

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.setupPanelEvents();
        this.setupHotkeyEvents();
        this.setupDragEvents();
        this.setupHoverEvents();
    }

    setupPanelEvents() {
        // Event delegation for panel controls
        this.uiManager.elements.panel.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action) {
                e.stopPropagation();
                e.preventDefault();
                this.handleControlAction(action);
            }

            // Section header clicks
            const sectionHeader = e.target.closest('.section-header');
            if (sectionHeader && sectionHeader.dataset.section) {
                const sectionId = sectionHeader.dataset.section;
                if (sectionId !== 'node') { // Node section is always expanded
                    this.stateManager.toggleSection(sectionId);
                    this.uiManager.updateSectionStates();
                }
            }
        });

        // Event delegation for floating controls (separate since they're not children of panel)
        if (this.uiManager.elements.controls) {
            this.uiManager.elements.controls.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                if (action) {
                    e.stopPropagation();
                    e.preventDefault();
                    this.handleControlAction(action);
                }
            });

            // Prevent floating controls from propagating events
            this.uiManager.elements.controls.addEventListener('mousedown', (e) => {
                e.stopPropagation();
            });

            this.uiManager.elements.controls.addEventListener('mouseup', (e) => {
                e.stopPropagation();
            });
        }

        // Prevent panel interactions from propagating
        this.uiManager.elements.panel.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        this.uiManager.elements.panel.addEventListener('mouseup', (e) => {
            e.stopPropagation();
        });
    }

    // Helper function to check if user is typing in an input field
    isUserTyping() {
        const activeElement = document.activeElement;
        if (!activeElement) return false;

        // Check if the active element is an input, textarea, or contenteditable
        const tagName = activeElement.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea') {
            return true;
        }

        // Check for contenteditable elements
        if (activeElement.contentEditable === 'true') {
            return true;
        }

        // Check if it's inside a form or has input-like classes
        if (activeElement.closest('form') ||
            activeElement.classList.contains('cm-editor') || // CodeMirror editor
            activeElement.classList.contains('monaco-editor') || // Monaco editor
            activeElement.closest('.cm-editor') ||
            activeElement.closest('.monaco-editor')) {
            return true;
        }

        return false;
    }

    setupHotkeyEvents() {
        const magnifyGlass = window.comfyUIMagnifyGlass;

        document.addEventListener('keydown', (e) => {
            // Don't handle hotkeys if user is typing in an input field (Smart Input Detection)
            if (this.isUserTyping()) {
                return;
            }

            // Only handle hotkeys when magnifying glass is active
            const magnifyGlass = window.comfyUIMagnifyGlass;
            if (!magnifyGlass || !magnifyGlass.state.active) return;

            const settings = this.stateManager.state.settings;

            // Toggle info panel
            if (e.key.toLowerCase() === settings["🔍MagnifyGlass.ToggleHotkey"].toLowerCase() &&
                (!magnifyGlass.config.altRequired || e.altKey) && !e.repeat) {
                e.preventDefault();
                e.stopPropagation();
                this.handleControlAction('toggle-panel');
            }

            // Toggle glass preview
            if (e.key.toLowerCase() === settings["🔍MagnifyGlass.GlassPreviewToggleHotkey"].toLowerCase() &&
                (!magnifyGlass.config.altRequired || e.altKey) && !e.repeat) {
                e.preventDefault();
                e.stopPropagation();
                this.handleControlAction('toggle-glass');
            }

            // Unlock panel from magnify glass and move to current mouse location (no Alt required due to Smart Input Detection)
            if (e.key.toLowerCase() === settings["🔍MagnifyGlass.PinPanelHotkey"].toLowerCase() && !e.repeat) {
                e.preventDefault();
                e.stopPropagation();
                this.handleControlAction('pin-at-mouse');
            }
        });
    }

    setupDragEvents() {
        let dragState = {
            isDragging: false,
            startX: 0,
            startY: 0,
            currentX: 0,
            currentY: 0,
            offsetX: 0,
            offsetY: 0
        };

        // Start drag
        const startDrag = (e) => {
            // Only when pinned and not locked
            if (!this.stateManager.state.isPanelPinned || this.stateManager.state.isPanelLocked) return;

            // Block on specific elements only
            if (e.target.closest('.minimize-btn') ||
                e.target.closest('.control-btn') ||
                e.target.tagName === 'BUTTON') {
                return;
            }

            // Stop all event propagation immediately
            e.preventDefault();
            e.stopImmediatePropagation();

            // Set drag state
            dragState.isDragging = true;
            dragState.startX = e.clientX;
            dragState.startY = e.clientY;

            // Get current panel position
            const rect = this.uiManager.elements.panel.getBoundingClientRect();
            dragState.currentX = rect.left;
            dragState.currentY = rect.top;
            dragState.offsetX = e.clientX - rect.left;
            dragState.offsetY = e.clientY - rect.top;

            // Visual feedback
            this.uiManager.elements.panel.classList.add('panel-dragging');
            this.uiManager.elements.panel.style.cursor = 'grabbing';
            document.body.style.cursor = 'grabbing';
            document.body.style.userSelect = 'none';
        };

        // Handle drag movement
        const doDrag = (e) => {
            if (!dragState.isDragging) return;

            e.preventDefault();
            e.stopImmediatePropagation();

            // Calculate new position based on mouse movement
            const newX = e.clientX - dragState.offsetX;
            const newY = e.clientY - dragState.offsetY;

            // Apply boundaries
            const panelWidth = this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelWidth"];
            const panelHeight = this.uiManager.elements.panel.offsetHeight;
            const margin = 10;

            const boundedX = Math.max(margin, Math.min(newX, window.innerWidth - panelWidth - margin));
            const boundedY = Math.max(margin, Math.min(newY, window.innerHeight - panelHeight - margin));

            // Apply position immediately and forcefully
            this.uiManager.elements.panel.style.position = 'fixed';
            this.uiManager.elements.panel.style.left = `${boundedX}px`;
            this.uiManager.elements.panel.style.top = `${boundedY}px`;
            this.uiManager.elements.panel.style.transform = 'none';
            this.uiManager.elements.panel.style.zIndex = '10010';

            // Update current position
            dragState.currentX = boundedX;
            dragState.currentY = boundedY;

            // Update floating controls
            if (this.uiManager.elements.controls) {
                this.positionManager.positionFloatingControls();
            }
        };

        // End drag
        const endDrag = (e) => {
            if (!dragState.isDragging) return;

            e.preventDefault();
            e.stopImmediatePropagation();

            // Calculate if we actually moved significantly
            const deltaX = Math.abs(e.clientX - dragState.startX);
            const deltaY = Math.abs(e.clientY - dragState.startY);
            const moved = deltaX > 5 || deltaY > 5;

            if (moved) {
                // Save the final position
                this.stateManager.setPinnedPosition(dragState.currentX, dragState.currentY);
            }

            // Reset state
            dragState.isDragging = false;

            // Remove visual feedback
            this.uiManager.elements.panel.classList.remove('panel-dragging');
            this.uiManager.elements.panel.style.cursor = '';
            this.uiManager.elements.panel.style.zIndex = '';
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        // Cancel drag
        const cancelDrag = () => {
            if (!dragState.isDragging) return;

            // Restore original position from pinned state
            const { x, y } = this.stateManager.state.pinnedPosition;
            this.uiManager.elements.panel.style.left = `${x}px`;
            this.uiManager.elements.panel.style.top = `${y}px`;

            // Reset state
            dragState.isDragging = false;

            // Remove visual feedback
            this.uiManager.elements.panel.classList.remove('panel-dragging');
            this.uiManager.elements.panel.style.cursor = '';
            this.uiManager.elements.panel.style.zIndex = '';
            document.body.style.cursor = '';
            document.body.style.userSelect = '';

            // Update controls
            if (this.uiManager.elements.controls) {
                this.positionManager.positionFloatingControls();
            }
        };

        // Attach events with capture to prevent interference
        this.uiManager.elements.panel.addEventListener('mousedown', startDrag, { capture: true, passive: false });
        document.addEventListener('mousemove', doDrag, { capture: true, passive: false });
        document.addEventListener('mouseup', endDrag, { capture: true, passive: false });

        // Handle escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                cancelDrag();
            }
        });

        // Handle mouse leaving window
        document.addEventListener('mouseleave', endDrag);

        // Visual feedback
        this.uiManager.elements.panel.addEventListener('mouseenter', () => {
            if (this.stateManager.state.isPanelPinned && !this.stateManager.state.isPanelLocked && !dragState.isDragging) {
                this.uiManager.elements.panel.style.cursor = 'grab';
            }
        });

        this.uiManager.elements.panel.addEventListener('mouseleave', () => {
            if (!dragState.isDragging) {
                this.uiManager.elements.panel.style.cursor = '';
            }
        });

        // Store cleanup function
        this.dragCleanup = () => {
            this.uiManager.elements.panel.removeEventListener('mousedown', startDrag, { capture: true });
            document.removeEventListener('mousemove', doDrag, { capture: true });
            document.removeEventListener('mouseup', endDrag, { capture: true });
            document.removeEventListener('mouseleave', endDrag);
            cancelDrag();
        };
    }

    setupHoverEvents() {
        this.uiManager.elements.panel.addEventListener('mouseenter', () => {
            this.stateManager.state.isPanelHovered = true;
            this.stateManager.clearAutoExpandTimer();
        });

        this.uiManager.elements.panel.addEventListener('mouseleave', () => {
            this.stateManager.state.isPanelHovered = false;
            if (!this.stateManager.state.isHoveringNode) {
                this.stateManager.scheduleAutoCollapse();
            }
        });
    }

    captureCurrentPanelPosition() {
        // Capture current position when pinning is activated
        const panelRect = this.uiManager.elements.panel.getBoundingClientRect();
        this.stateManager.setPinnedPosition(panelRect.left, panelRect.top);
    }

    handleControlAction(action) {
        const magnifyGlass = window.comfyUIMagnifyGlass;

        switch (action) {
            case 'minimize':
                this.stateManager.toggleMinimized();
                this.uiManager.updateMinimizedState();
                break;

            case 'pin':
                // If not currently pinned, either restore to last position or capture current
                if (!this.stateManager.state.isPanelPinned) {
                    // If we don't have a remembered position, capture current position
                    if (!this.stateManager.state.lastPinnedPosition) {
                        this.captureCurrentPanelPosition();
                    }
                    // Note: togglePinning will restore lastPinnedPosition if it exists
                }

                this.stateManager.togglePinning();
                this.uiManager.updatePinnedState();
                this.positionManager.positionPanel();
                break;

            case 'lock':
                this.stateManager.toggleLocking();
                this.uiManager.updatePinnedState(); // This updates both pinned and locked states
                break;

            case 'pin-at-mouse':
                if (!magnifyGlass) return;

                // Pin at current mouse location (Alt + configured key)
                const settings = this.stateManager.state.settings;
                const panelWidth = settings["🔍MagnifyGlass.InfoPanelWidth"];
                const panelHeight = Math.min(settings["🔍MagnifyGlass.InfoPanelMaxHeight"], 400);

                // Position panel near mouse with some offset to avoid covering cursor area
                const mouseX = magnifyGlass.lastKnownMousePosition.x;
                const mouseY = magnifyGlass.lastKnownMousePosition.y;

                let pinX = mouseX + 50; // Offset to the right of mouse
                let pinY = mouseY - 100; // Offset above mouse

                // Apply boundary constraints
                pinX = Math.max(10, Math.min(pinX, window.innerWidth - panelWidth - 10));
                pinY = Math.max(10, Math.min(pinY, window.innerHeight - panelHeight - 10));

                // Set the new pin position (this will also save as lastPinnedPosition)
                this.stateManager.setPinnedPosition(pinX, pinY);

                // Enable pinning if not already pinned
                if (!this.stateManager.state.isPanelPinned) {
                    this.stateManager.state.isPanelPinned = true;
                }

                this.uiManager.updatePinnedState();
                this.positionManager.positionPanel();
                break;

            case 'toggle-panel':
                if (this.stateManager.togglePanelVisibility()) {
                    this.uiManager.show();
                } else {
                    this.uiManager.hide();
                }
                this.uiManager.updateControlStates();
                break;

            case 'toggle-glass':
                const isVisible = this.stateManager.toggleGlassPreview();
                this.applyGlassVisibility(isVisible);

                // When the glass preview is hidden, automatically pin the panel at its current location.
                if (!isVisible && !this.stateManager.state.isPanelPinned) {
                    this.captureCurrentPanelPosition(); // Capture current position before pinning
                    this.stateManager.togglePinning();
                    this.stateManager.state.isAutoPinned = true; // Mark as auto-pinned
                    this.uiManager.updatePinnedState();
                }

                // When the glass preview is shown again, only auto-unlock if NOT manually locked with 📌 button
                if (isVisible && this.stateManager.state.isPanelPinned && !this.stateManager.state.isPanelLocked) {
                    this.stateManager.togglePinning(); // Unpin the panel
                    this.stateManager.state.isAutoPinned = false; // Clear auto-pin flag
                    this.uiManager.updatePinnedState();
                }

                this.uiManager.updateControlStates();
                this.positionManager.positionPanel(); // Reposition based on new glass state
                break;
        }
    }

    applyGlassVisibility(isVisible) {
        const magnifyGlass = window.comfyUIMagnifyGlass;
        if (magnifyGlass && magnifyGlass.ui && magnifyGlass.ui.glassDiv) {
            magnifyGlass.ui.glassDiv.style.opacity = isVisible ? "1" : "0";
        }
    }

    cleanup() {
        if (this.dragCleanup) {
            this.dragCleanup();
        }
    }
}
