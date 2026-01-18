/**
 * ComfyUI MagnifyGlass - Info Panel UI Manager (TypeScript)
 * 
 * Complete UI Manager extracted from magnify_info_panel.js
 * Handles all DOM manipulation and UI creation for the info panel.
 */

import { StateManager } from './StateManager';
import { Icons } from '../shared/icons';
import { Logger } from '../shared/logger';
import { INFO_PANEL_ID } from '../shared/constants';
import { escapeHtml } from '../shared/utils';
import { formatValue, getValueClass, getValueAttributes, formatWidgetValue } from './ValueFormatter';
import {
    getCheckpointInfo,
    getImageInfo,
    getTextBoxContent,
    getImportantNodeParameters,
    type ImageInfoResult,
    type ParameterItem
} from './NodeDataExtractor';
import { NodeSelector, type NodeListEntry, type NodeExecOrderEntry } from './NodeSelector';
import {
    WidgetEditorFactory,
    WidgetSyncManager,
    InlineControlFactory,
    DragValueController,
    type WidgetEditorInstance,
    type InlineControlInstance
} from './widget-editors';

interface InfoPanelElements {
    panel: HTMLDivElement | null;
    header: HTMLDivElement | null;
    content: HTMLDivElement | null;
    controls: HTMLDivElement | null;
}

/**
 * UI Manager class.
 * Handles all DOM manipulation and UI creation.
 */
export class UIManager {
    stateManager: StateManager;
    elements: InfoPanelElements;
    nodeSelector: NodeSelector;
    currentDropdown: HTMLDivElement | null = null;
    private currentDropdownCleanup: (() => void) | null = null;
    onNodeSelected: ((nodeId: number) => void) | null = null;
    // Track active widget editors for cleanup
    private activeEditors: Map<string, WidgetEditorInstance> = new Map();
    // Track active inline controls for cleanup
    private activeInlineControls: Map<string, InlineControlInstance> = new Map();
    // Track active drag controllers for cleanup
    private activeDragControllers: Map<string, DragValueController> = new Map();
    // Hotkey handler for Focus Node
    private hotkeyHandler: ((e: KeyboardEvent) => void) | null = null;

    constructor(stateManager: StateManager) {
        this.stateManager = stateManager;
        this.elements = {
            panel: null,
            header: null,
            content: null,
            controls: null
        };
        this.nodeSelector = new NodeSelector();

        this.createPanel();
        this.injectStyles();
        this.setupHotkeys();
    }

    /**
     * Create the main panel and its components.
     */
    createPanel(): void {
        // Main panel container
        this.elements.panel = document.createElement("div");
        this.elements.panel.id = INFO_PANEL_ID;
        this.elements.panel.className = `magnify-info-panel theme-${this.stateManager.state.currentTheme}`;

        // Header
        this.elements.header = document.createElement("div");
        this.elements.header.className = "panel-header";
        this.elements.header.innerHTML = `
            <div class="header-content">
                <div class="header-icon">${Icons.magnifyGlass}</div>
                <div class="header-title">Inspector</div>
                <div class="header-subtitle">Real-time analysis</div>
            </div>
            <div class="header-controls">
                <button class="control-btn minimize-btn" title="Minimize Panel" aria-label="Minimize Panel" aria-expanded="true" data-action="minimize">${Icons.minus}</button>
            </div>
        `;

        // Content container
        this.elements.content = document.createElement("div");
        this.elements.content.className = "panel-content";

        this.elements.panel.appendChild(this.elements.header);
        this.elements.panel.appendChild(this.elements.content);

        this.applyStyles();
        // Apply initial minimized state if set
        if (this.stateManager.state.isPanelMinimized) {
            this.elements.panel.classList.add('panel-minimized');
            this.updateMinimizedState(); // Correctly set aria-expanded state
        }
        document.body.appendChild(this.elements.panel);

        // Hover-expand: Add/remove 'is-expanded' class, reposition, and resize font if needed
        let originalTop: number | null = null;
        let originalFontSize: number | null = null;
        const MIN_FONT_SIZE = 10; // Minimum font size in pixels
        const MARGIN = 20; // Minimum margin from viewport edges

        this.elements.panel.addEventListener('mouseenter', () => {
            // Sticky Mode (Persist): disable this behavior to prevent bouncing
            if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"]) {
                return;
            }

            if (!this.stateManager.state.isPanelMinimized && this.elements.panel) {
                // Save original position
                originalTop = this.elements.panel.offsetTop;
                // Save original font size just in case, though we won't change it
                originalFontSize = parseFloat(getComputedStyle(this.elements.panel).fontSize);

                // Add expanded class
                this.elements.panel.classList.add('is-expanded');

                // Simple repositioning logic only (no font scaling)
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        if (!this.elements.panel) return;

                        const viewportHeight = window.innerHeight;
                        const rect = this.elements.panel.getBoundingClientRect();

                        // Position the panel to fit (move up if needed)
                        if (rect.bottom > viewportHeight - MARGIN) {
                            const newTop = Math.max(MARGIN, originalTop! - (rect.bottom - viewportHeight + MARGIN));
                            this.elements.panel.style.top = `${newTop}px`;
                        }
                    });
                });
            }
        });

        this.elements.panel.addEventListener('mouseleave', () => {
            // Sticky Mode (Persist): disable this behavior to prevent bouncing
            if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"]) {
                return;
            }

            if (this.elements.panel) {
                this.elements.panel.classList.remove('is-expanded');

                // Restore original position
                if (originalTop !== null) {
                    this.elements.panel.style.top = `${originalTop}px`;
                    originalTop = null;
                }

                // Restore original font size (if it was somehow changed)
                if (originalFontSize !== null) {
                    this.elements.panel.style.fontSize = `${originalFontSize}px`;
                    originalFontSize = null;
                }

                // Clear any inline styles that might have been set
                this.elements.panel.style.transform = '';
                this.elements.panel.style.transformOrigin = '';
            }
        });

        // Add click event delegation for panel elements
        this.elements.panel.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as HTMLElement;

            // Handle minimize button
            const minimizeBtn = target.closest('[data-action="minimize"]');
            if (minimizeBtn) {
                this.stateManager.state.isPanelMinimized = !this.stateManager.state.isPanelMinimized;
                this.updateMinimizedState();
                return;
            }

            // Handle section header clicks for expand/collapse
            const sectionHeader = target.closest('.section-header') as HTMLElement;
            if (sectionHeader) {
                const sectionId = sectionHeader.getAttribute('data-section');
                // Skip node section (always expanded)
                if (sectionId && sectionId !== 'node') {
                    const isExpanded = this.stateManager.state.expandedSections.has(sectionId);
                    if (isExpanded) {
                        this.stateManager.state.expandedSections.delete(sectionId);
                    } else {
                        this.stateManager.state.expandedSections.add(sectionId);
                    }

                    // Update visual state
                    sectionHeader.classList.toggle('expanded', !isExpanded);
                    const sectionContent = sectionHeader.nextElementSibling as HTMLElement;
                    if (sectionContent && sectionContent.classList.contains('section-content')) {
                        sectionContent.classList.toggle('expanded', !isExpanded);
                    }
                }
            }
        });

        // Create floating controls after panel is in DOM
        if (!this.elements.controls) {
            this.createFloatingControls();
            // Update control states immediately after creation
            this.updateControlStates();
        }
    }

    /**
     * Create floating control buttons.
     */
    createFloatingControls(): void {
        this.elements.controls = document.createElement("div");
        this.elements.controls.className = `floating-controls vertical-layout theme-${this.stateManager.state.currentTheme}`; // Default to vertical + theme

        /**
         * BUTTON MAPPING DOCUMENTATION:
         * =============================
         * Button 1 (Unlock Icon): data-action="pin" → controls isPanelPinned
         *   - Unpinned (default): Panel follows magnify glass
         *   - Pinned: Panel stays at fixed position (unlocked from following glass)
         * 
         * Button 2 (Pin Icon): data-action="lock" → controls isPanelLocked
         *   - Unlocked (default): Panel can be dragged
         *   - Locked: Panel cannot be dragged (pinned in place)
         * 
         * NOTE: The data-action names are counterintuitive but kept for backwards compatibility.
         * The ICONS correctly represent the functionality:
         *   - Unlock icon = unlock from following glass
         *   - Pin icon = pin position (prevent drag)
         */
        this.elements.controls.innerHTML = `
            <button class="control-btn unlock-btn" title="Unlock/Lock Panel from Glass" aria-label="Unlock or Lock Panel from Glass" aria-pressed="false" data-action="pin">${Icons.unlock}</button>
            <button class="control-btn pin-btn" title="Pin/Unpin Panel Position (Prevent Drag)" aria-label="Pin or Unpin Panel Position" aria-pressed="false" data-action="lock">${Icons.pin}</button>
            <button class="control-btn persist-btn" title="Toggle Persist Mode - Sticky Info (S)" aria-label="Toggle Sticky Info" aria-pressed="false" data-action="persist">${Icons.magnet}</button>
            <button class="control-btn hold-btn" title="Hold Info - Pause/Play (P)" aria-label="Hold Info" aria-pressed="false" data-action="toggle-hold">${Icons.pause}</button>
            <button class="control-btn visibility-btn" title="Toggle Panel Visibility (I)" aria-label="Toggle Panel Visibility" aria-pressed="true" data-action="toggle-panel">${Icons.eye}</button>
            <button class="control-btn glass-btn" title="Toggle Glass Preview (G)" aria-label="Toggle Glass Preview" aria-pressed="true" data-action="toggle-glass">${Icons.magnifyGlass}</button>
            <button class="control-btn cursor-btn" title="Toggle Cursor Preview" aria-label="Toggle Cursor Preview" aria-pressed="false" data-action="toggle-cursor">${Icons.cursor}</button>
            <button class="control-btn drag-glass-btn" title="Move Glass Position (H)" aria-label="Move Glass Position" aria-pressed="false" data-action="drag-glass">${Icons.move}</button>
            <button class="control-btn reset-glass-btn" title="Reset Glass Position (O)" aria-label="Reset Glass Position" data-action="reset-glass">${Icons.reset}</button>
            <button class="control-btn popout-btn" title="Open in New Tab (Shift+P)" aria-label="Open in New Tab" aria-pressed="false" data-action="popout">${Icons.externalLink}</button>
        `;

        // Insert before the panel in the document body, not as a child
        document.body.appendChild(this.elements.controls);

        // Hide and position off-screen initially - will be shown when magnify glass activates and positions them
        this.elements.controls.style.display = 'none';
        this.elements.controls.style.visibility = 'hidden';
        this.elements.controls.style.left = '-9999px';
        this.elements.controls.style.top = '-9999px';

        // Add click event delegation for control buttons
        this.elements.controls.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const button = target.closest('button[data-action]') as HTMLButtonElement;
            if (!button) return;

            const action = button.getAttribute('data-action');
            Logger.debug(`Control button clicked: ${action}`);

            switch (action) {
                case 'pin':
                    this.stateManager.togglePinning();
                    this.updatePinnedState();
                    this.updateControlStates();
                    break;
                case 'lock':
                    this.stateManager.state.isPanelLocked = !this.stateManager.state.isPanelLocked;
                    this.updateControlStates();
                    if (this.elements.panel) {
                        this.elements.panel.classList.toggle('panel-locked', this.stateManager.state.isPanelLocked);
                    }
                    break;
                case 'persist':
                    this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"] = !this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"];
                    this.updateControlStates();
                    this.applyStyles(); // Update persist-active class
                    // Sync sidebar setting if needed (optional, sidebar updates on reopen usually)
                    break;
                case 'toggle-panel':
                    if (this.stateManager.state.isPanelVisible) {
                        // User requested to hide the panel
                        this.hide();

                        // User Request: Disable sticky info when hiding via button
                        if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"]) {
                            this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"] = false;
                            this.applyStyles(); // Update visual styles if necessary
                        }
                    } else {
                        this.show();
                    }
                    this.updateControlStates();
                    break;
                case 'toggle-glass':
                    this.stateManager.state.isGlassPreviewVisible = !this.stateManager.state.isGlassPreviewVisible;

                    // Link Glass Visibility to Panel Pinning
                    if (!this.stateManager.state.isGlassPreviewVisible) {
                        // Glass Hidden
                        console.log(`[MagnifyGlass Debug] Glass Hidden. pinned=${this.stateManager.state.isPanelPinned}, autoPinned=${this.stateManager.state.isAutoPinned}`);
                        // Only auto-pin if not already pinned by the user
                        if (!this.stateManager.state.isPanelPinned) {
                            if (this.elements.panel) {
                                const rect = this.elements.panel.getBoundingClientRect();
                                this.stateManager.state.pinnedPosition = { x: rect.left, y: rect.top };
                            }
                            this.stateManager.state.isPanelPinned = true;
                            this.stateManager.state.isAutoPinned = true; // Track that this was auto-pinned
                            console.log(`[MagnifyGlass Debug] Auto-Pinned panel.`);
                        }
                        // Do NOT reset isPanelLocked here - preserve user's lock state
                    } else {
                        // Glass Shown
                        console.log(`[MagnifyGlass Debug] Glass Shown. pinned=${this.stateManager.state.isPanelPinned}, autoPinned=${this.stateManager.state.isAutoPinned}`);
                        // Only unpin if it was auto-pinned (not user-pinned)
                        if (this.stateManager.state.isAutoPinned) {
                            this.stateManager.state.isPanelPinned = false;
                            this.stateManager.state.isAutoPinned = false;
                            console.log(`[MagnifyGlass Debug] Auto-Unpinned panel.`);
                        }
                        // If user manually pinned, keep the panel pinned
                    }

                    this.updateControlStates();
                    this.updatePinnedState(); // Update visual class

                    // Toggle BOTH the visual visibility AND the rendering
                    // This fully disables the offscreen renderer when preview is hidden
                    const magnifyGlass = (window as any).comfyUIMagnifyGlass;
                    if (magnifyGlass && magnifyGlass.setGlassPreviewActive) {
                        magnifyGlass.setGlassPreviewActive(this.stateManager.state.isGlassPreviewVisible);
                    } else if (magnifyGlass && magnifyGlass.ui?.setPreviewVisibility) {
                        // Fallback for backwards compatibility
                        magnifyGlass.ui.setPreviewVisibility(this.stateManager.state.isGlassPreviewVisible);
                    }
                    break;
                case 'popout':
                    // Toggle the pop-out tab
                    const glass = (window as any).comfyUIMagnifyGlass;
                    if (glass && glass.popOutManager) {
                        glass.popOutManager.toggle();
                    }
                    break;
                case 'drag-glass':
                    // Toggle glass drag mode
                    const mglass = (window as any).comfyUIMagnifyGlass;
                    if (mglass && mglass.state) {
                        mglass.state.isDragModeEnabled = !mglass.state.isDragModeEnabled;
                        this.updateControlStates();

                        // Update UI to indicate drag mode
                        if (mglass.ui && mglass.ui.setDragMode) {
                            mglass.ui.setDragMode(mglass.state.isDragModeEnabled);
                        }
                    }
                    break;
                case 'reset-glass':
                    // Reset glass offsets
                    const rglass = (window as any).comfyUIMagnifyGlass;
                    if (rglass) {
                        rglass.resetOffsets();
                        Logger.debug("Reset glass position via hover controls");

                        // Disable drag mode if active
                        if (rglass.state && rglass.state.isDragModeEnabled) {
                            rglass.state.isDragModeEnabled = false;
                            if (rglass.ui && rglass.ui.setDragMode) {
                                rglass.ui.setDragMode(false);
                            }
                            this.updateControlStates();
                        }
                    }
                    break;
                case 'toggle-cursor':
                    const cglass = (window as any).comfyUIMagnifyGlass;
                    if (cglass && cglass.config) {
                        cglass.config.showCursorPreview = !cglass.config.showCursorPreview;
                        cglass.updateMagnifiedView();
                        this.updateControlStates();
                    }
                    break;
                case 'toggle-hold':
                    this.stateManager.toggleHold();
                    this.updateControlStates();
                    break;
            }
        });

        // Set initial layout based on settings
        const controlsPosition = String(this.stateManager.state.settings["🔍MagnifyGlass.ControlsPosition"] || "top-right");
        this.updateControlsLayout(controlsPosition);

        // Initial state update
        this.updateControlStates();
    }

    /**
     * Update control button states.
     */
    updateControlStates(): void {
        if (!this.elements.controls) return;

        const pinBtn = this.elements.controls.querySelector('[data-action="pin"]') as HTMLButtonElement;
        const lockBtn = this.elements.controls.querySelector('[data-action="lock"]') as HTMLButtonElement;
        const visibilityBtn = this.elements.controls.querySelector('[data-action="toggle-panel"]') as HTMLButtonElement;
        const glassBtn = this.elements.controls.querySelector('[data-action="toggle-glass"]') as HTMLButtonElement;
        const isPanelVisible = this.stateManager.state.isPanelVisible;
        const isGlassVisible = this.stateManager.state.isGlassPreviewVisible;

        if (pinBtn) {
            pinBtn.classList.toggle('active', this.stateManager.state.isPanelPinned);
            pinBtn.setAttribute('aria-pressed', String(this.stateManager.state.isPanelPinned));
            pinBtn.title = this.stateManager.state.isPanelPinned ? "Lock Panel" : "Unlock Panel";
            pinBtn.innerHTML = this.stateManager.state.isPanelPinned ? Icons.lock : Icons.unlock;
            // Hide unlock button when panel is hidden
            pinBtn.style.display = isPanelVisible ? 'flex' : 'none';

            // Disable lock button when glass is hidden (no point unlocking to follow invisible glass)
            if (!isGlassVisible) {
                pinBtn.disabled = true;
                pinBtn.style.opacity = '0.5';
                pinBtn.title = "Cannot toggle lock when glass preview is hidden";
            } else {
                pinBtn.disabled = false;
                pinBtn.style.opacity = '';
                pinBtn.title = this.stateManager.state.isPanelPinned ? "Lock Panel Position (Follow Glass)" : "Unlock Panel Position (Drag Inspector)";
            }
        }

        if (lockBtn) {
            // Only show pin button when panel is visible AND unlocked from glass
            const showLockBtn = isPanelVisible && this.stateManager.state.isPanelPinned;
            lockBtn.style.display = showLockBtn ? 'flex' : 'none';
            lockBtn.classList.toggle('active', this.stateManager.state.isPanelLocked);
            lockBtn.setAttribute('aria-pressed', String(this.stateManager.state.isPanelLocked));
            lockBtn.title = this.stateManager.state.isPanelLocked ? "Unpin Panel Position" : "Pin Panel Position";
            lockBtn.disabled = !this.stateManager.state.isPanelPinned;
        }

        const persistBtn = this.elements.controls.querySelector('[data-action="persist"]') as HTMLButtonElement;
        if (persistBtn) {
            const isPersistConfigured = !!this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"];
            persistBtn.classList.toggle('active', isPersistConfigured);
            persistBtn.setAttribute('aria-pressed', String(isPersistConfigured));
            persistBtn.title = isPersistConfigured ? "Disable Sticky Info (S)" : "Enable Sticky Info (S)";
            persistBtn.style.display = isPanelVisible ? 'flex' : 'none';
        }

        const holdBtn = this.elements.controls.querySelector('[data-action="toggle-hold"]') as HTMLButtonElement;
        if (holdBtn) {
            const isPersistConfigured = !!this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"];
            const isHeld = this.stateManager.state.isInfoHeld;

            // Only show Hold button when Sticky Info (Persist) is enabled AND panel is visible
            holdBtn.style.display = (isPanelVisible && isPersistConfigured) ? 'flex' : 'none';

            holdBtn.classList.toggle('active', isHeld);
            holdBtn.setAttribute('aria-pressed', String(isHeld));
            // Toggle icon: Pause (to hold) vs Play (to resume)
            holdBtn.innerHTML = isHeld ? Icons.play : Icons.pause;
            holdBtn.title = isHeld ? "Resume Info Update (P)" : "Pause Info Update (P)";
        }

        if (visibilityBtn) {
            // Active means "Panel is Visible"
            visibilityBtn.classList.toggle('active', isPanelVisible);
            visibilityBtn.setAttribute('aria-pressed', String(isPanelVisible));
            visibilityBtn.title = isPanelVisible ? "Hide Panel" : "Show Panel";

            // Disable hide button if glass is hidden (prevent hiding everything)
            if (!isGlassVisible) {
                visibilityBtn.disabled = true;
                visibilityBtn.style.opacity = '0.5';
                visibilityBtn.title = "Cannot hide panel when glass preview is hidden";
            } else {
                visibilityBtn.disabled = false;
                visibilityBtn.style.opacity = '';
            }
        }

        if (glassBtn) {
            glassBtn.classList.toggle('active', isGlassVisible);
            glassBtn.setAttribute('aria-pressed', String(isGlassVisible));
            glassBtn.title = isGlassVisible ? "Hide Glass Preview" : "Show Glass Preview";

            // Only show glass toggle button if the inspector panel is visible
            glassBtn.style.display = isPanelVisible ? 'flex' : 'none';
        }

        const cursorBtn = this.elements.controls.querySelector('[data-action="toggle-cursor"]') as HTMLButtonElement;
        if (cursorBtn) {
            const cglass = (window as any).comfyUIMagnifyGlass;
            const showCursor = cglass?.config?.showCursorPreview || false;
            cursorBtn.classList.toggle('active', showCursor);
            cursorBtn.setAttribute('aria-pressed', String(showCursor));
            cursorBtn.title = showCursor ? "Hide Cursor Preview" : "Show Cursor Preview";

            // Logic: Visible when glass is visible AND:
            // 1. Panel is NOT pinned (attached to glass) - original logic
            // 2. Sticky Info (Persist) is NOT enabled - user request
            const isPersistConfigured = !!this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"];

            cursorBtn.style.display = (isGlassVisible && !this.stateManager.state.isPanelPinned && !isPersistConfigured) ? 'flex' : 'none';
        }

        const dragGlassBtn = this.elements.controls.querySelector('[data-action="drag-glass"]') as HTMLButtonElement;
        if (dragGlassBtn) {
            const mglass = (window as any).comfyUIMagnifyGlass;
            const isDragMode = mglass?.state?.isDragModeEnabled || false;
            dragGlassBtn.classList.toggle('active', isDragMode);
            dragGlassBtn.setAttribute('aria-pressed', String(isDragMode));
            dragGlassBtn.title = isDragMode ? "Cancel Move Mode (H)" : "Move Glass Position (H)";
            // Only show drag button when glass is visible (even if panel is hidden)
            dragGlassBtn.style.display = isGlassVisible ? 'flex' : 'none';
        }

        const resetGlassBtn = this.elements.controls.querySelector('[data-action="reset-glass"]') as HTMLButtonElement;
        if (resetGlassBtn) {
            // Only show reset button when glass is visible (moves with drag/popout buttons)
            resetGlassBtn.style.display = isGlassVisible ? 'flex' : 'none';
        }

        const popoutBtn = this.elements.controls.querySelector('[data-action="popout"]') as HTMLButtonElement;
        if (popoutBtn) {
            const glass = (window as any).comfyUIMagnifyGlass;
            const isOpen = glass?.popOutManager?.isPopOutOpen() || false;
            // Logger.debug(`[UIManager] Popout button update - Glass: ${!!glass}, IsOpen: ${isOpen}`);
            popoutBtn.classList.toggle('active', isOpen);
            popoutBtn.setAttribute('aria-pressed', String(isOpen));
            popoutBtn.title = isOpen ? "Close Pop-out Viewer" : "Open Pop-out Viewer";
        }
    }

    /**
     * Update controls layout based on position setting.
     * @param position 
     */
    updateControlsLayout(position: string): void {
        if (!this.elements.controls) return;

        // Remove existing layout classes
        this.elements.controls.classList.remove('horizontal-layout', 'vertical-layout');

        // Add appropriate layout class
        if (['top', 'bottom'].includes(position)) {
            this.elements.controls.classList.add('horizontal-layout');
        } else {
            this.elements.controls.classList.add('vertical-layout');
        }
    }

    /**
     * Load a Google Font dynamically.
     * @param fontName - Name of the font to load
     */
    loadGoogleFont(fontName: string): void {
        // Skip if already loaded
        const linkId = `google-font-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
        if (document.getElementById(linkId)) return;

        // Create link element for Google Fonts
        const link = document.createElement('link');
        link.id = linkId;
        link.rel = 'stylesheet';
        link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;500;600;700&display=swap`;
        document.head.appendChild(link);

        Logger.debug(`[UIManager] Loaded Google Font: ${fontName}`);
    }

    /**
     * Apply current styles to elements.
     */
    applyStyles(): void {
        if (!this.elements.panel) return;

        const settings = this.stateManager.state.settings;

        // Apply dimensions
        this.elements.panel.style.width = `${settings["🔍MagnifyGlass.InfoPanelWidth"]}px`;
        // Set max-height via CSS variable so CSS :hover rules can override
        const maxHeight = settings["🔍MagnifyGlass.InfoPanelMaxHeight"];
        this.elements.panel.style.setProperty('--panel-max-height', `${maxHeight}px`);
        this.elements.panel.style.height = 'auto';

        // 2. Apply static styles (only needed once or if overwritten, but safe to set)
        this.elements.panel.style.position = 'absolute';
        this.elements.panel.style.zIndex = '99999';
        this.elements.panel.style.transform = 'translateY(-10px)';
        this.elements.panel.style.pointerEvents = 'auto';
        this.elements.panel.style.userSelect = 'none';

        // Apply Font Family
        const fontFamily = settings["🔍MagnifyGlass.InfoPanelFontFamily"] as string || "System Default";
        if (fontFamily === "System Default" || fontFamily === "system-ui") {
            this.elements.panel.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        } else if (fontFamily === "monospace") {
            this.elements.panel.style.fontFamily = "'JetBrains Mono', 'Fira Code', 'SF Mono', Monaco, monospace";
        } else {
            // Load Google Font dynamically
            this.loadGoogleFont(fontFamily);
            this.elements.panel.style.fontFamily = `'${fontFamily}', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`;
        }

        // Apply Font Size
        const fontSize = settings["🔍MagnifyGlass.InfoPanelFontSize"] || 14;
        this.elements.panel.style.fontSize = `${fontSize}px`;

        // 3. Apply transition
        this.elements.panel.style.transition = 'none';

        // 4. Apply Custom Colors (CSS Variables)
        const textColor = settings["🔍MagnifyGlass.InfoPanelTextColor"] as string | undefined;
        if (textColor && typeof textColor === 'string') {
            const normalizedTextColor = textColor.startsWith('#') ? textColor : `#${textColor}`;
            this.elements.panel.style.setProperty('--info-panel-text-color', normalizedTextColor);
        }

        const accentColor = settings["🔍MagnifyGlass.InfoPanelAccentColor"] as string | undefined;
        if (accentColor && typeof accentColor === 'string') {
            const normalizedAccentColor = accentColor.startsWith('#') ? accentColor : `#${accentColor}`;
            this.elements.panel.style.setProperty('--info-panel-accent-color', normalizedAccentColor);
        }

        // 5. Apply Opacity
        // Logic: If visible, use setting. If hidden, use 0.
        // We do NOT touch 'display' here to avoid hiding it if it's currently shown.
        // 'display' is managed by show() / hide() methods exclusively.
        if (this.stateManager.state.isPanelVisible) {
            const opacityPercent = Number(settings["🔍MagnifyGlass.InfoPanelOpacity"]) || 100;
            this.elements.panel.style.opacity = (opacityPercent / 100).toString();
        } else {
            this.elements.panel.style.opacity = '0';
        }

        // 6. Apply Persist Mode Class
        const isPersist = !!settings["🔍MagnifyGlass.InfoPanelPersist"];
        if (isPersist) {
            this.elements.panel.classList.add('persist-active');
        } else {
            this.elements.panel.classList.remove('persist-active');
        }

        // 7. Apply High Contrast Text Class
        const isHighContrastText = !!settings["🔍MagnifyGlass.HighContrastText"];
        if (isHighContrastText) {
            this.elements.panel.classList.add('high-contrast-text');
        } else {
            this.elements.panel.classList.remove('high-contrast-text');
        }
    }

    /**
     * Show the panel.
     */
    show(): void {
        if (!this.elements.panel) return;

        if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"]) {
            this.elements.panel.style.display = "block";
            // Controls are shown by positionFloatingControls() after proper positioning
            // Apply user's opacity setting when showing (convert percentage to decimal)
            const opacityPercent = Number(this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelOpacity"]) || 100;
            this.elements.panel.style.opacity = (opacityPercent / 100).toString();
            // Trigger reflow
            this.elements.panel.offsetHeight;
            this.elements.panel.classList.add('visible');
            this.stateManager.state.isPanelVisible = true;
            this.updateControlStates();
        }
    }

    /**
     * Hide the panel.
     */
    hide(): void {
        if (!this.elements.panel) return;

        this.elements.panel.classList.remove('visible');
        this.elements.panel.classList.remove('visible');
        if (this.elements.panel) {
            this.elements.panel.style.display = "none";
        }
        this.stateManager.state.isPanelVisible = false;
        this.updateControlStates();
    }

    /**
     * Update minimized state.
     */
    updateMinimizedState(): void {
        if (!this.elements.panel || !this.elements.header) return;

        this.elements.panel.classList.toggle('panel-minimized', this.stateManager.state.isPanelMinimized);
        const minimizeBtn = this.elements.header.querySelector('.minimize-btn');
        if (minimizeBtn) {
            minimizeBtn.textContent = this.stateManager.state.isPanelMinimized ? '+' : '−';
            (minimizeBtn as HTMLElement).title = this.stateManager.state.isPanelMinimized ? 'Expand Panel' : 'Minimize Panel';
            minimizeBtn.setAttribute('aria-expanded', String(!this.stateManager.state.isPanelMinimized));
        }
    }

    /**
     * Update pinned state.
     */
    updatePinnedState(): void {
        if (!this.elements.panel) return;

        this.elements.panel.classList.toggle('panel-pinned', this.stateManager.state.isPanelPinned);
        this.elements.panel.classList.toggle('panel-locked', this.stateManager.state.isPanelLocked);
        this.updateControlStates();
    }

    /**
     * Update theme class.
     * @param newTheme 
     */
    updateTheme(newTheme: string): void {
        if (this.elements.panel) {
            // Use [\w-]+ to match hyphenated theme names like milk-white, obsidian-dark
            this.elements.panel.className = this.elements.panel.className.replace(/theme-[\w-]+/, `theme-${newTheme.toLowerCase()}`);

            // Reapply opacity setting after theme change
            const opacityPercent = Number(this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelOpacity"]) || 100;
            this.elements.panel.style.opacity = (opacityPercent / 100).toString();
        }
        if (this.elements.controls) {
            this.elements.controls.className = this.elements.controls.className.replace(/theme-[\w-]+/, `theme-${newTheme.toLowerCase()}`);
        }
    }

    /**
     * Display information in the panel.
     * @param info
     */
    displayInfo(info: any): void {
        // Skip re-rendering if user is actively editing a value
        // This prevents the editor from being destroyed mid-edit
        if (this.activeEditors.size > 0) {
            // Only update the header subtitle, don't re-render content
            this.updateHeaderSubtitle(info);
            return;
        }

        const sections = this.buildSections(info);
        this.renderSections(sections);
        this.updateSectionStates();
        this.updateHeaderSubtitle(info);
    }

    /**
     * Build section data from info object.
     * @param info 
     * @returns 
     */
    buildSections(info: any): any[] {
        const sections: any[] = [];
        const settings = this.stateManager.state.settings;

        // Inspector section
        if (settings["🔍MagnifyGlass.ShowInspectorTab"] && info.cursor && info.cursor.canvas) {
            const inspectorContent = [
                { label: 'Cursor Canvas', value: `(${Math.round(info.cursor.canvas.x)}, ${Math.round(info.cursor.canvas.y)})` },
                { label: 'Canvas Scale', value: `${(info.canvas.scale * 100).toFixed(1)}%` },
                { label: 'Magnifier Zoom', value: `${info.magnifier.zoomFactor}×` }
            ];

            sections.push({
                id: 'inspector',
                icon: Icons.info,
                title: 'Inspector',
                content: inspectorContent
            });
        }

        // Media section
        if (info.media) {
            const mediaContent = [
                { label: 'Type', value: info.media.tagName },
                { label: 'Source', value: info.media.src }
            ];

            if (info.media.naturalSize) {
                mediaContent.push({ label: 'Natural', value: info.media.naturalSize });
            }

            sections.push({
                id: 'media',
                icon: Icons.camera,
                title: 'Media',
                badge: info.media.tagName,
                content: mediaContent
            });
        }

        // Node Details section
        if (info.hoveredNode) {
            const nodeContent: any[] = [];        // Initial Node details
            nodeContent.push({
                label: 'Title',
                value: `${info.hoveredNode.title || 'Untitled'} (#${info.hoveredNode.id})`,
                clickable: 'title'
            });
            if (info.hoveredNode.executionOrder !== undefined) {
                nodeContent.push({ label: 'Exec Order', value: info.hoveredNode.executionOrder, clickable: 'execOrder' });
            }

            // Add Zoom to Node button
            nodeContent.push({
                label: 'Location',
                value: `<span class="focus-node-btn">${Icons.focus} Focus Node</span>`,
                clickable: 'zoom',
                nodeId: info.hoveredNode.id,
                isHtml: true
            });

            // Add category if available
            if (info.hoveredNode.category) {
                nodeContent.push({ label: 'Category', value: info.hoveredNode.category, copyable: true });
            }

            // Add python module path if available
            if (info.hoveredNode.pythonModule) {
                const path = info.hoveredNode.pythonModule.replace(/\./g, '/') + '.py';
                nodeContent.push({ label: 'Path', value: path, copyable: true });
            }

            // Check if this is a complex node that shows all widgets
            const nodeType = info.hoveredNode.type ? info.hoveredNode.type.toLowerCase() : '';
            const isSaveNode = nodeType.includes('save') &&
                !nodeType.includes('checkpoint') &&
                !nodeType.includes('model') &&
                !nodeType.includes('preview');

            const showAllWidgets = info.hoveredNode.type && (
                nodeType.includes('ksampler') ||
                nodeType.includes('sampler') ||
                nodeType.includes('k_samplers') ||
                nodeType.includes('checkpoint') ||
                nodeType.includes('model') ||
                nodeType.includes('lora') ||
                nodeType.includes('controlnet') ||
                nodeType.includes('advanced') ||
                nodeType.includes('detailer') ||
                nodeType.includes('inpaint') ||
                nodeType.includes('upscale') ||
                nodeType.includes('clip') ||
                nodeType.includes('text') ||
                nodeType.includes('encode')
            ) && !isSaveNode;

            if (!showAllWidgets) {
                // Add specific extractions for simple nodes
                const checkpoint = getCheckpointInfo(info.hoveredNode);
                if (checkpoint) {
                    nodeContent.push({ label: 'Model', value: checkpoint });
                }

                const imgInfo = getImageInfo(info.hoveredNode);
                if (imgInfo) {
                    if (typeof imgInfo === 'string') {
                        nodeContent.push({ label: 'Image', value: imgInfo });
                    } else if (typeof imgInfo === 'object' && imgInfo !== null) {
                        const imgResult = imgInfo as ImageInfoResult;
                        nodeContent.push({ label: 'Image Size', value: `${imgResult.width}×${imgResult.height}` });
                        if (imgResult.src) {
                            nodeContent.push({ label: 'Image Source', value: imgResult.src });
                        }
                    }
                }

                const textContent = getTextBoxContent(info.hoveredNode);
                if (textContent) {
                    nodeContent.push({ label: 'Text', value: textContent });
                }
            }

            const importantParameters = getImportantNodeParameters(info.hoveredNode);
            nodeContent.push(...importantParameters);

            sections.push({
                id: 'node',
                icon: Icons.box,
                title: 'Node',
                badge: info.hoveredNode.type,
                content: nodeContent
            });
        }

        return sections;
    }

    /**
     * Render sections to the panel.
     * @param sections 
     */
    renderSections(sections: any[]): void {
        if (!this.elements.content) return;

        // Cleanup existing editors before re-rendering
        this.cleanupEditors();

        if (sections.length === 0) {
            this.elements.content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">${Icons.mapPin}</div>
                    <div class="empty-state-text">Empty canvas area</div>
                </div>
            `;
            return;
        }

        // Check if Sticky Info is enabled (editing only works when sticky)
        const isStickyEnabled = !!this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelPersist"];

        this.elements.content.innerHTML = sections.map(section => `
            <div class="info-section" data-section="${escapeHtml(section.id)}">
                <div class="section-header" data-section="${escapeHtml(section.id)}">
                    <span class="section-icon">${section.icon}</span>
                    <span class="section-title">${escapeHtml(section.title)}</span>
                    ${section.badge ? `<span class="section-badge">${escapeHtml(section.badge)}</span>` : ''}
                    ${section.id !== 'node' ? `<span class="expand-icon">${Icons.chevronRight}</span>` : ''}
                </div>
                <div class="section-content">
                    <div class="section-body">
                        ${section.content.map((item: any) => {
            const value = item.isHtml ? item.value : formatValue(item.value, item.label);
            const valueClass = getValueClass(item.value);
            const valueAttributes = getValueAttributes(item.value);
            const clickableAttr = item.clickable ? `data-clickable="${item.clickable}"` : '';
            const nodeIdAttr = item.nodeId !== undefined ? `data-node-id="${item.nodeId}"` : '';
            const clickableClass = item.clickable ? 'clickable-row' : '';

            // Editable widget detection
            const isEditable = item.isEditable && isStickyEnabled && item.widgetName && item.nodeId !== undefined;
            const editableClass = isEditable ? 'editable' : '';
            // Serialize constraints and rawValue properly (handle boolean specially to avoid "false" -> true coercion)
            const constraintsJson = isEditable && item.constraints ? escapeHtml(JSON.stringify(item.constraints)) : '';
            const rawValueStr = isEditable ? (typeof item.rawValue === 'boolean' ? (item.rawValue ? 'true' : 'false') : escapeHtml(String(item.rawValue ?? ''))) : '';
            const editableAttrs = isEditable ? `data-editable="true" data-widget-name="${escapeHtml(item.widgetName)}" data-widget-type="${escapeHtml(item.widgetType || 'text')}" data-raw-value="${rawValueStr}" data-constraints="${constraintsJson}"` : '';

            // Actionable (button) widget detection - these have callbacks but aren't value-editable
            const isActionable = item.isActionable && item.widgetName && item.nodeId !== undefined;
            const actionableClass = isActionable ? 'actionable' : '';
            const actionableAttrs = isActionable ? `data-actionable="true" data-widget-name="${escapeHtml(item.widgetName)}" data-widget-type="button"` : '';

            // Only show dropdown arrow for actual dropdowns, not actions like zoom
            const dropdownIcon = (item.clickable && item.clickable !== 'zoom') ? '<span class="dropdown-indicator" style="margin-left: 4px; opacity: 0.6; font-size: 10px;">▼</span>' : '';
            // Add copy button for copyable items (category, path) - placed as direct child of row for absolute positioning
            const copyButton = item.copyable ? `<button class="copy-btn" data-copy-value="${escapeHtml(String(item.value))}" title="Copy to clipboard">${Icons.copy}</button>` : '';
            return `
                            <div class="info-row ${clickableClass} ${editableClass} ${actionableClass}${item.copyable ? ' copyable-row' : ''}" ${clickableAttr} ${nodeIdAttr} ${editableAttrs} ${actionableAttrs} style="${item.clickable ? 'cursor: pointer;' : ''}">
                                ${copyButton}
                                <span class="info-label">${escapeHtml(item.label)}</span>
                                <span class="info-value ${valueClass} original" ${valueAttributes}>${value}${dropdownIcon}</span>
                                <div class="inline-control-container" style="display: none;"></div>
                                <div class="widget-editor-container" style="display: none;"></div>
                            </div>`;
        }).join('')}
                    </div>
                </div>
            </div>`).join('');

        // Add click handlers for clickable rows
        this.attachDropdownClickHandlers();

        // Add click handlers for copy buttons
        this.attachCopyButtonHandlers();

        // Add click handlers for editable rows (only when sticky is enabled)
        if (isStickyEnabled) {
            this.attachEditableRowHandlers();
        }

        // Add handlers for actionable (button) rows - always active
        this.attachActionableRowHandlers();
    }

    /**
     * Attach handlers for actionable (button) widget rows.
     * Creates inline button controls that invoke widget callbacks.
     */
    private attachActionableRowHandlers(): void {
        if (!this.elements.content) return;

        const actionableRows = this.elements.content.querySelectorAll('[data-actionable="true"]');
        actionableRows.forEach(row => {
            const rowEl = row as HTMLElement;
            const valueEl = rowEl.querySelector('.info-value.original') as HTMLElement;
            const inlineContainer = rowEl.querySelector('.inline-control-container') as HTMLElement;

            if (!valueEl || !inlineContainer) return;

            const nodeId = parseInt(rowEl.dataset.nodeId || '0', 10);
            const widgetName = rowEl.dataset.widgetName || '';

            if (isNaN(nodeId) || !widgetName) return;

            const controlKey = `action:${nodeId}:${widgetName}`;

            // Create inline button control
            const control = InlineControlFactory.createControl({
                nodeId,
                widgetName,
                widgetType: 'button',
                currentValue: widgetName, // Use widget name as button context
                onChange: () => { } // Buttons don't change values
            });

            if (control) {
                this.activeInlineControls.set(controlKey, control);
                inlineContainer.appendChild(control.element);
                inlineContainer.style.display = 'flex';
                // Hide the text value display (which shows null/true/false)
                valueEl.style.display = 'none';
            }
        });
    }

    /**
     * Cleanup active widget editors, inline controls, and drag controllers.
     */
    private cleanupEditors(): void {
        this.activeEditors.forEach(editor => {
            try {
                editor.destroy();
            } catch (e) {
                // Ignore cleanup errors
            }
        });
        this.activeEditors.clear();

        this.activeInlineControls.forEach(control => {
            try {
                control.destroy();
            } catch (e) {
                // Ignore cleanup errors
            }
        });
        this.activeInlineControls.clear();

        this.activeDragControllers.forEach(controller => {
            try {
                controller.destroy();
            } catch (e) {
                // Ignore cleanup errors
            }
        });
        this.activeDragControllers.clear();
    }

    /**
     * Attach click handlers to editable widget rows.
     * Also creates inline controls for toggle/combo widgets and drag controllers.
     */
    private attachEditableRowHandlers(): void {
        if (!this.elements.content) return;

        const editableRows = this.elements.content.querySelectorAll('[data-editable="true"]');
        editableRows.forEach(row => {
            const rowEl = row as HTMLElement;
            const valueEl = rowEl.querySelector('.info-value.original') as HTMLElement;
            const editorContainer = rowEl.querySelector('.widget-editor-container') as HTMLElement;
            const inlineContainer = rowEl.querySelector('.inline-control-container') as HTMLElement;

            if (!valueEl) return;

            const nodeId = parseInt(rowEl.dataset.nodeId || '0', 10);
            const widgetName = rowEl.dataset.widgetName || '';
            const widgetType = rowEl.dataset.widgetType || 'text';
            const rawValue = rowEl.dataset.rawValue;

            // Parse constraints
            let constraints: any = {};
            try {
                const constraintsStr = rowEl.dataset.constraints;
                if (constraintsStr) {
                    constraints = JSON.parse(constraintsStr);
                }
            } catch (e) {
                // Ignore parse errors
            }

            if (isNaN(nodeId) || !widgetName) return;

            const controlKey = `${nodeId}:${widgetName}`;

            // Check if this widget type should use inline controls
            if (InlineControlFactory.shouldUseInlineControl(widgetType) && inlineContainer) {
                // Create inline control
                const control = InlineControlFactory.createControl({
                    nodeId,
                    widgetName,
                    widgetType,
                    currentValue: widgetType.toLowerCase() === 'boolean' || widgetType.toLowerCase() === 'toggle'
                        ? rawValue === 'true'
                        : rawValue,
                    constraints,
                    onChange: (value) => {
                        rowEl.dataset.rawValue = String(value);
                    }
                });

                if (control) {
                    this.activeInlineControls.set(controlKey, control);
                    inlineContainer.appendChild(control.element);
                    inlineContainer.style.display = 'flex';
                    // Hide the text value display
                    valueEl.style.display = 'none';
                }
            } else if (editorContainer) {
                // Fall back to click-to-edit for text/number types
                valueEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.enterEditMode(rowEl, valueEl, editorContainer);
                });
            }

            // Attach drag controller if widget type supports it and we don't have an inline control
            if (DragValueController.isTypeSupported(widgetType) &&
                !InlineControlFactory.shouldUseInlineControl(widgetType)) {
                const dragController = new DragValueController(rowEl, {
                    nodeId,
                    widgetName,
                    widgetType,
                    currentValue: rawValue,
                    constraints,
                    onChange: (value) => {
                        rowEl.dataset.rawValue = String(value);
                        // Update displayed value
                        valueEl.textContent = formatWidgetValue(value);
                    }
                });
                this.activeDragControllers.set(controlKey, dragController);
            }
        });
    }

    /**
     * Enter edit mode for a row.
     */
    private enterEditMode(row: HTMLElement, valueEl: HTMLElement, container: HTMLElement): void {
        // Exit if already editing
        if (row.classList.contains('editing')) return;

        const nodeId = parseInt(row.dataset.nodeId || '0', 10);
        const widgetName = row.dataset.widgetName || '';
        const widgetType = row.dataset.widgetType || 'text';
        const rawValue = row.dataset.rawValue;

        // Use isNaN check instead of !nodeId to allow nodeId 0
        if (isNaN(nodeId) || !widgetName) return;

        // Get current constraints from the data extractor
        let constraints: any = {};
        try {
            // Try to parse constraints if they were stored
            const constraintsStr = row.dataset.constraints;
            if (constraintsStr) {
                constraints = JSON.parse(constraintsStr);
            }
        } catch (e) {
            // Ignore parse errors
        }

        // Create the editor
        const editorKey = `${nodeId}:${widgetName}`;
        const editor = WidgetEditorFactory.createEditor({
            nodeId,
            widgetName,
            widgetType,
            currentValue: rawValue,
            constraints,
            onChange: (value) => {
                // Update the raw value attribute for next time
                row.dataset.rawValue = String(value);
            },
            onBlur: () => {
                // Exit edit mode after a small delay (allows for clicks within editor)
                // Capture the current editor reference to avoid race condition
                const currentEditor = this.activeEditors.get(editorKey);
                setTimeout(() => {
                    // Only exit if the same editor is still active (not replaced by a new one)
                    if (currentEditor && this.activeEditors.get(editorKey) === currentEditor) {
                        if (!container.contains(document.activeElement)) {
                            this.exitEditMode(row, valueEl, container);
                        }
                    }
                }, 100);
            }
        });

        // Track the editor
        this.activeEditors.set(editorKey, editor);

        // Show editor, hide value
        row.classList.add('editing');
        valueEl.style.display = 'none';
        container.style.display = 'block';
        container.innerHTML = '';
        container.appendChild(editor.element);

        // Focus the editor
        editor.focus();
    }

    /**
     * Exit edit mode for a row.
     */
    private exitEditMode(row: HTMLElement, valueEl: HTMLElement, container: HTMLElement): void {
        if (!row.classList.contains('editing')) return;

        const nodeId = row.dataset.nodeId || '';
        const widgetName = row.dataset.widgetName || '';
        const editorKey = `${nodeId}:${widgetName}`;

        // Get and destroy the editor
        const editor = this.activeEditors.get(editorKey);
        if (editor) {
            // Get the actual constrained value from the widget (not the unconstrained input value)
            // This ensures displayed value matches what was actually stored
            const actualValue = WidgetSyncManager.getWidgetValue(parseInt(nodeId, 10), widgetName);
            valueEl.textContent = formatWidgetValue(actualValue ?? editor.getValue());
            editor.destroy();
            this.activeEditors.delete(editorKey);
        }

        // Hide editor, show value
        row.classList.remove('editing');
        valueEl.style.display = '';
        container.style.display = 'none';
        container.innerHTML = '';
    }

    /**
     * Attach click handlers to copy buttons for copying values to clipboard.
     */
    private attachCopyButtonHandlers(): void {
        if (!this.elements.content) return;

        const copyButtons = this.elements.content.querySelectorAll('.copy-btn');
        copyButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();

                const button = btn as HTMLButtonElement;
                const valueToCopy = button.dataset.copyValue || '';

                try {
                    await navigator.clipboard.writeText(valueToCopy);

                    // Visual feedback - temporarily change to checkmark
                    const originalHtml = button.innerHTML;
                    button.innerHTML = '✓';
                    button.classList.add('copied');

                    setTimeout(() => {
                        button.innerHTML = originalHtml;
                        button.classList.remove('copied');
                    }, 1500);
                } catch (err) {
                    Logger.error('[UIManager] Failed to copy to clipboard:', err);
                }
            });
        });
    }

    /**
     * Attach click handlers to clickable dropdown rows.
     */
    attachDropdownClickHandlers(): void {
        if (!this.elements.content) return;

        const clickableRows = this.elements.content.querySelectorAll('[data-clickable]');
        clickableRows.forEach(row => {
            const clickableType = (row as HTMLElement).dataset.clickable;

            row.addEventListener('click', (e) => {
                e.stopPropagation();

                if (clickableType === 'title') {
                    this.showTitleDropdown(row as HTMLElement);
                } else if (clickableType === 'execOrder') {
                    this.showExecOrderDropdown(row as HTMLElement);
                } else if (clickableType === 'id') {
                    this.showIdDropdown(row as HTMLElement);
                } else if (clickableType === 'zoom') {
                    const nodeId = (row as HTMLElement).dataset.nodeId;
                    if (nodeId) {
                        const app = (window as any).app;
                        const node = app.graph.getNodeById(parseInt(nodeId));
                        if (node && app.canvas) {
                            app.canvas.centerOnNode(node);
                        }
                    }
                }
            });

            // Add hover effect
            row.addEventListener('mouseenter', () => {
                (row as HTMLElement).style.background = 'var(--comfy-input-bg, rgba(255,255,255,0.05))';
            });
            row.addEventListener('mouseleave', () => {
                (row as HTMLElement).style.background = '';
            });
        });
    }

    /**
     * Update section expansion states.
     */
    updateSectionStates(): void {
        if (!this.elements.content) return;

        const sections = this.elements.content.querySelectorAll('.info-section');
        sections.forEach(section => {
            const sectionId = (section as HTMLElement).dataset.section;
            if (!sectionId) return;

            const header = section.querySelector('.section-header');
            const content = section.querySelector('.section-content');

            if (header && content) {
                if (this.stateManager.state.expandedSections.has(sectionId)) {
                    header.classList.add('expanded');
                    content.classList.add('expanded');
                } else {
                    header.classList.remove('expanded');
                    content.classList.remove('expanded');
                }
            }
        });
    }

    /**
     * Update header subtitle.
     * @param info 
     */
    updateHeaderSubtitle(info: any): void {
        if (!this.elements.header) return;

        const subtitleElement = this.elements.header.querySelector('.header-subtitle') as HTMLElement;
        if (subtitleElement) {
            const accentColor = String(this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelAccentColor"] || '');
            if (info.hoveredNode) {
                subtitleElement.textContent = `Analyzing: ${info.hoveredNode.title} `;
                subtitleElement.style.color = accentColor;
            } else if (info.media) {
                subtitleElement.textContent = `Media: ${info.media.tagName} `;
                subtitleElement.style.color = accentColor;
            } else if (info.connection) {
                subtitleElement.textContent = `Connection: ${info.connection.type} `;
                subtitleElement.style.color = accentColor;
            } else {
                subtitleElement.textContent = 'Real-time analysis';
                subtitleElement.style.color = '';
            }
        }
    }

    /**
     * Inject CSS styles by loading external stylesheet.
     */
    injectStyles(): void {
        if (!document.getElementById('magnify-info-panel-styles-v2')) {
            const link = document.createElement('link');
            link.id = 'magnify-info-panel-styles-v2';
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = 'extensions/comfyui-magnifyglass/info-panel.css';
            document.head.appendChild(link);
        }
    }

    /**
     * Show dropdown with nodes sorted by title.
     * @param anchorElement - Element to anchor the dropdown to
     */
    showTitleDropdown(anchorElement: HTMLElement): void {
        this.hideDropdown();

        const nodes = this.nodeSelector.getNodesSortedByTitle();
        if (nodes.length === 0) return;

        this.createDropdown(nodes, anchorElement, 'title');
    }

    /**
     * Show dropdown with nodes sorted by execution order.
     * @param anchorElement - Element to anchor the dropdown to
     */
    showExecOrderDropdown(anchorElement: HTMLElement): void {
        this.hideDropdown();

        const nodes = this.nodeSelector.getNodesSortedByExecOrder();
        if (nodes.length === 0) return;

        this.createDropdown(nodes, anchorElement, 'execOrder');
    }

    /**
     * Show dropdown with nodes sorted by ID.
     * @param anchorElement - Element to anchor the dropdown to
     */
    showIdDropdown(anchorElement: HTMLElement): void {
        this.hideDropdown();

        const nodes = this.nodeSelector.getNodesSortedById();
        if (nodes.length === 0) return;

        this.createDropdown(nodes, anchorElement, 'id');
    }

    /**
     * Create and show the dropdown.
     */
    private createDropdown(
        nodes: NodeListEntry[] | NodeExecOrderEntry[],
        anchorElement: HTMLElement,
        type: 'title' | 'execOrder' | 'id'
    ): void {
        const dropdown = document.createElement('div');
        dropdown.className = `node-selector-dropdown theme-${this.stateManager.state.currentTheme}`;
        // Accessibility attributes
        dropdown.setAttribute('role', 'listbox');
        dropdown.setAttribute('tabindex', '-1');
        dropdown.setAttribute('aria-label', type === 'title' ? 'Select Node by Title' : (type === 'execOrder' ? 'Select Node by Execution Order' : 'Select Node by ID'));

        dropdown.style.cssText = `
            position: fixed;
            z-index: 100000;
            overflow-y: auto;
            background: var(--comfy-menu-bg, #2a2a2a);
            border: 1px solid var(--border-color, #444);
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            min-width: 200px;
            outline: none;
        `;

        let activeIndex = 0; // Default to first item

        // Build dropdown items
        nodes.forEach((node, index) => {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', index === activeIndex ? 'true' : 'false');
            if (index === activeIndex) {
                item.classList.add('focused');
            }

            item.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                border-bottom: 1px solid var(--border-color, #333);
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 13px;
                background: ${index === activeIndex ? 'var(--comfy-input-bg, #3a3a3a)' : ''};
            `;

            // Check if this is an exec order entry
            const isExecOrder = 'order' in node;

            if (isExecOrder) {
                const execNode = node as NodeExecOrderEntry;
                item.innerHTML = `
                    <span style="color: var(--info-panel-accent-color, #4ecdc4); font-weight: 600; min-width: 24px;">#${execNode.order}</span>
                    <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(execNode.title)} (#${execNode.id})</span>
                    <span style="color: #888; font-size: 11px;">${escapeHtml(execNode.type)}</span>
                `;
            } else {
                item.innerHTML = `
                    <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(node.title)} (#${node.id})</span>
                    <span style="color: #888; font-size: 11px;">${escapeHtml(node.type)}</span>
                `;
            }

            // Hover effect - also update active state for keyboard compatibility
            item.addEventListener('mouseenter', () => {
                // Update visual state of previously active item
                if (activeIndex !== index) {
                    const items = dropdown.querySelectorAll('.dropdown-item');
                    if (items[activeIndex]) {
                        const prev = items[activeIndex] as HTMLElement;
                        prev.style.background = '';
                        prev.classList.remove('focused');
                        prev.setAttribute('aria-selected', 'false');
                    }
                    activeIndex = index;
                    item.classList.add('focused');
                    item.setAttribute('aria-selected', 'true');
                }
                item.style.background = 'var(--comfy-input-bg, #3a3a3a)';
            });
            item.addEventListener('mouseleave', () => {
                // Don't clear background if it's the active item (keep it focused)
                if (index !== activeIndex) {
                    item.style.background = '';
                }
            });

            // Selection handler
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.hideDropdown();
                // cleanup() is called by hideDropdown

                // Set selected node in state
                this.stateManager.setSelectedNode(node.id);

                // Notify callback if set
                if (this.onNodeSelected) {
                    this.onNodeSelected(node.id);
                }
            });

            dropdown.appendChild(item);
        });

        // Position dropdown within viewport bounds
        document.body.appendChild(dropdown);
        this.positionDropdownWithinViewport(dropdown, anchorElement);

        this.currentDropdown = dropdown;

        // Cleanup function to remove all listeners
        const cleanup = () => {
            document.removeEventListener('mousedown', closeHandler, true);
            window.removeEventListener('keydown', keyHandler, true);  // Match window listener
            if (this.elements.panel) {
                this.elements.panel.removeEventListener('mousedown', panelCloseHandler, true);
            }
            // Remove canvas listener
            const canvas = document.querySelector('canvas.main-canvas, canvas') as HTMLCanvasElement;
            if (canvas) {
                canvas.removeEventListener('pointerdown', canvasCloseHandler, true);
            }
            // Clear the global reference
            if (this.currentDropdownCleanup === cleanup) {
                this.currentDropdownCleanup = null;
            }
        };

        // Store cleanup globally so hideDropdown can call it
        this.currentDropdownCleanup = cleanup;

        // Close on click outside - use mousedown with capture to ensure it fires before other handlers
        const closeHandler = (e: MouseEvent) => {
            if (!dropdown.contains(e.target as Node) && !anchorElement.contains(e.target as Node)) {
                this.hideDropdown();
                // Cleanup is now handled by hideDropdown calling this.currentDropdownCleanup
            }
        };

        // Close when clicking within the panel but outside dropdown
        const panelCloseHandler = (e: MouseEvent) => {
            if (!dropdown.contains(e.target as Node) && !anchorElement.contains(e.target as Node)) {
                this.hideDropdown();
                // Cleanup is now handled by hideDropdown calling this.currentDropdownCleanup
            }
        };

        // Close when clicking on the canvas (canvas intercepts events before document receives them)
        const canvasCloseHandler = (_e: PointerEvent) => {
            this.hideDropdown();
        };

        // Helper to update active item
        const updateActiveItem = (newIndex: number) => {
            const items = dropdown.querySelectorAll('.dropdown-item');
            if (items.length === 0) return;

            // Clamp index
            if (newIndex < 0) newIndex = 0;
            if (newIndex >= items.length) newIndex = items.length - 1;

            // Remove focus from old
            if (activeIndex >= 0 && activeIndex < items.length) {
                const oldItem = items[activeIndex] as HTMLElement;
                oldItem.classList.remove('focused');
                oldItem.setAttribute('aria-selected', 'false');
                oldItem.style.background = '';
            }

            activeIndex = newIndex;

            // Add focus to new
            const newItem = items[activeIndex] as HTMLElement;
            newItem.classList.add('focused');
            newItem.setAttribute('aria-selected', 'true');
            newItem.style.background = 'var(--comfy-input-bg, #3a3a3a)';

            // Scroll into view
            newItem.scrollIntoView({ block: 'nearest' });
        };

        // Keyboard handler - works while dropdown is open regardless of focus
        // Uses window-level listener with stopImmediatePropagation to intercept before ComfyUI/LiteGraph
        const keyHandler = (e: KeyboardEvent) => {
            // DEBUG: Log all key events while dropdown is open
            console.debug('[DropdownKeyHandler] Key pressed:', e.key, 'activeIndex:', activeIndex);

            // Handle arrow keys and Enter for navigation regardless of focus
            // Only Escape should check focus to avoid intercepting when user tabs away

            if (e.key === 'Escape') {
                // For Escape, require focus to avoid breaking other components
                if (document.activeElement !== dropdown && !dropdown.contains(document.activeElement)) {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                this.hideDropdown();
                return;
            }

            // Arrow keys and Enter work while dropdown is visible
            if (e.key === 'ArrowDown') {
                console.debug('[DropdownKeyHandler] ArrowDown - moving to', activeIndex + 1);
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                updateActiveItem(activeIndex + 1);
            } else if (e.key === 'ArrowUp') {
                console.debug('[DropdownKeyHandler] ArrowUp - moving to', activeIndex - 1);
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                updateActiveItem(activeIndex - 1);
            } else if (e.key === 'Enter') {
                console.debug('[DropdownKeyHandler] Enter - selecting', activeIndex);
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                const items = dropdown.querySelectorAll('.dropdown-item');
                if (activeIndex >= 0 && activeIndex < items.length) {
                    (items[activeIndex] as HTMLElement).click();
                }
            }
        };

        // Delay adding the listener to avoid immediate closure
        setTimeout(() => {
            // Check if dropdown was already closed (cleanup reference changed or nulled)
            // or if it was removed from DOM
            if (this.currentDropdownCleanup !== cleanup || !dropdown.parentNode) {
                return;
            }

            document.addEventListener('mousedown', closeHandler, true);  // true = capture phase
            // Use window-level listener with capture phase to intercept before ComfyUI canvas handlers
            window.addEventListener('keydown', keyHandler, true);

            // Also focus the dropdown for accessibility
            dropdown.focus();

            // Also listen on the panel itself with capture phase
            if (this.elements.panel) {
                this.elements.panel.addEventListener('mousedown', panelCloseHandler, true);
            }

            // Listen on canvas for clicks (canvas intercepts pointer events)
            const canvas = document.querySelector('canvas.main-canvas, canvas') as HTMLCanvasElement;
            if (canvas) {
                canvas.addEventListener('pointerdown', canvasCloseHandler, true);
            }
        }, 10);
    }

    /**
     * Hide the current dropdown.
     */
    hideDropdown(): void {
        // Run cleanup if it exists
        if (this.currentDropdownCleanup) {
            this.currentDropdownCleanup();
            this.currentDropdownCleanup = null;
        }

        if (this.currentDropdown && this.currentDropdown.parentNode) {
            this.currentDropdown.parentNode.removeChild(this.currentDropdown);
            this.currentDropdown = null;
        }
    }

    /**
     * Position a dropdown within viewport bounds.
     * Allows dropdown to expand to fit content, constrained by available space.
     */
    private positionDropdownWithinViewport(
        dropdown: HTMLElement,
        anchor: HTMLElement
    ): void {
        const margin = 10;
        const gap = 4;
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const anchorRect = anchor.getBoundingClientRect();

        // Temporarily remove constraints to measure natural size
        dropdown.style.maxWidth = 'none';
        dropdown.style.maxHeight = 'none';
        const naturalRect = dropdown.getBoundingClientRect();

        // Calculate available space in each direction
        const spaceBelow = viewportHeight - anchorRect.bottom - margin - gap;
        const spaceAbove = anchorRect.top - margin - gap;
        const spaceRight = viewportWidth - anchorRect.left - margin;
        const spaceLeft = anchorRect.right - margin;

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

        // Horizontal positioning: prefer left-aligned, shift if needed
        let left = anchorRect.left;
        let maxWidth: number;

        if (naturalRect.width <= spaceRight) {
            // Fits when left-aligned
            maxWidth = spaceRight;
        } else if (naturalRect.width <= spaceLeft) {
            // Right-align to anchor
            left = anchorRect.right - naturalRect.width;
            maxWidth = spaceLeft;
        } else {
            // Constrain to available viewport width
            left = margin;
            maxWidth = viewportWidth - margin * 2;
        }

        // Ensure left position is within bounds
        left = Math.max(margin, Math.min(left, viewportWidth - margin - naturalRect.width));

        // Apply final position and constraints
        dropdown.style.top = `${Math.max(margin, top)}px`;
        dropdown.style.left = `${Math.max(margin, left)}px`;
        dropdown.style.maxWidth = `${maxWidth}px`;
        dropdown.style.maxHeight = `${maxHeight}px`;
    }

    /**
     * Setup global hotkeys for the info panel
     */
    private setupHotkeys(): void {
        this.hotkeyHandler = (e: KeyboardEvent) => {
            // Don't trigger if user is typing in an input field
            const activeElement = document.activeElement;
            if (activeElement && (
                activeElement.tagName === 'INPUT' ||
                activeElement.tagName === 'TEXTAREA' ||
                (activeElement as HTMLElement).isContentEditable
            )) {
                return;
            }

            // Check for * key (Shift+8 on US keyboard or NumPad *) - Focus Node
            if (e.key === '*') {
                e.preventDefault();
                e.stopPropagation();
                this.focusCurrentNode();
                return;
            }

            // Left arrow - Previous node in execution order
            if (e.key === 'ArrowLeft') {
                // Only if panel is visible
                if (!this.elements.panel || this.elements.panel.style.display === 'none') {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                this.navigateExecOrder(-1);
                return;
            }

            // Right arrow - Next node in execution order
            if (e.key === 'ArrowRight') {
                // Only if panel is visible
                if (!this.elements.panel || this.elements.panel.style.display === 'none') {
                    return;
                }
                e.preventDefault();
                e.stopPropagation();
                this.navigateExecOrder(1);
                return;
            }
        };

        // Use capture phase to get the event before other handlers
        window.addEventListener('keydown', this.hotkeyHandler, true);
    }

    /**
     * Remove hotkey listeners
     */
    private cleanupHotkeys(): void {
        if (this.hotkeyHandler) {
            window.removeEventListener('keydown', this.hotkeyHandler, true);
            this.hotkeyHandler = null;
        }
    }

    /**
     * Focus/center the canvas on the currently displayed node
     */
    focusCurrentNode(): void {
        // Get current node from state or content
        const nodeRow = this.elements.content?.querySelector('[data-node-id]') as HTMLElement;
        if (!nodeRow) return;

        const nodeId = nodeRow.dataset.nodeId;
        if (!nodeId) return;

        const app = (window as any).app;
        if (!app?.graph) return;

        const node = app.graph.getNodeById(parseInt(nodeId));
        if (node && app.canvas) {
            app.canvas.centerOnNode(node);
        }
    }

    /**
     * Navigate to previous/next node by execution order
     * @param direction -1 for previous, +1 for next
     */
    navigateExecOrder(direction: number): void {
        // Get current node ID from content
        const nodeRow = this.elements.content?.querySelector('[data-node-id]') as HTMLElement;
        if (!nodeRow) return;

        const currentNodeId = parseInt(nodeRow.dataset.nodeId || '0');
        if (!currentNodeId && currentNodeId !== 0) return;

        // Get nodes sorted by execution order
        const nodes = this.nodeSelector.getNodesSortedByExecOrder();
        if (nodes.length === 0) return;

        // Find current node's position in the list
        const currentIndex = nodes.findIndex(n => n.id === currentNodeId);
        if (currentIndex === -1) {
            // Current node not in exec order list, select first node
            this.selectNodeById(nodes[0].id);
            return;
        }

        // Calculate new index with wrapping
        let newIndex = currentIndex + direction;
        if (newIndex < 0) newIndex = nodes.length - 1;
        if (newIndex >= nodes.length) newIndex = 0;

        // Select the new node
        this.selectNodeById(nodes[newIndex].id);
    }

    /**
     * Select a node by ID and update the inspector panel
     */
    private selectNodeById(nodeId: number): void {
        // Set selected node in state
        this.stateManager.setSelectedNode(nodeId);

        // Notify callback if set
        if (this.onNodeSelected) {
            this.onNodeSelected(nodeId);
        }
    }

    cleanup(): void {
        // Clean up active editors to prevent memory leaks
        this.cleanupEditors();

        // Clean up hotkey listeners
        this.cleanupHotkeys();

        if (this.elements.panel && this.elements.panel.parentNode) {
            this.elements.panel.parentNode.removeChild(this.elements.panel);
        }
        if (this.elements.controls && this.elements.controls.parentNode) {
            this.elements.controls.parentNode.removeChild(this.elements.controls);
        }
    }
}
