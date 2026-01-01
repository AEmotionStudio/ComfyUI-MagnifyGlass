/**
 * ComfyUI MagnifyGlass - Info Panel State Manager (TypeScript)
 * 
 * Centralized state management for the information panel.
 */

import { getSettingValue } from '../shared/utils';
import { DEFAULT_PANEL_SETTINGS } from '../shared/settings';

export interface InfoPanelStateData {
    // Panel visibility and positioning
    isPanelVisible: boolean;
    isPanelMinimized: boolean;
    isPanelPinned: boolean;
    isPanelLocked: boolean; // New lock state
    isAutoPinned: boolean; // Track if panel was auto-pinned by glass hide
    pinnedPosition: { x: number; y: number };
    lastPinnedPosition: { x: number; y: number } | null; // Remember last pinned location

    // Glass visibility
    isGlassPreviewVisible: boolean;

    // Section expansion
    expandedSections: Set<string>;

    // Interaction states
    isPanelHovered: boolean;
    isHoveringNode: boolean;

    // Auto-collapse
    autoExpandTimer: ReturnType<typeof setTimeout> | null;
    lastNodeId: string | number | null;

    // Update scheduling
    updateScheduled: boolean;
    isInitialLoading: boolean;

    // Current data
    currentInfo: any;

    // Settings cache
    settings: { [key: string]: any };

    // Auto-detected theme
    currentTheme: string;
}

/**
 * State Manager class.
 * Handles all state-related operations and provides clean state transitions.
 */
export class StateManager {
    state: InfoPanelStateData;

    constructor() {
        this.state = {
            // Panel visibility and positioning
            isPanelVisible: false,
            isPanelMinimized: false,
            isPanelPinned: false,
            isPanelLocked: false, // New lock state
            isAutoPinned: false, // Track if panel was auto-pinned by glass hide
            pinnedPosition: { x: 0, y: 0 },
            lastPinnedPosition: null, // Remember last pinned location

            // Glass visibility
            isGlassPreviewVisible: true,

            // Section expansion
            expandedSections: new Set(['node']),

            // Interaction states
            isPanelHovered: false,
            isHoveringNode: false,

            // Auto-collapse
            autoExpandTimer: null,
            lastNodeId: null,

            // Update scheduling
            updateScheduled: false,
            isInitialLoading: false,

            // Current data
            currentInfo: {},

            // Settings cache
            settings: {},

            // Auto-detected theme
            currentTheme: 'dark' // Will be auto-detected
        };

        this.initThemeDetection();
        this.loadSettings();
    }

    initThemeDetection(): void {
        // Detect ComfyUI's current theme
        this.detectCurrentTheme();

        // Force an immediate check in case we missed the initial state
        setTimeout(() => {
            if (this.detectCurrentTheme()) {
                this.notifyThemeChange();
            }
        }, 1000);

        // Set up mutation observer to watch for theme changes
        this.setupThemeObserver();

        // Listen for system theme changes as fallback
        if (window.matchMedia) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
            if (prefersDark.addListener) {
                prefersDark.addListener(() => this.detectCurrentTheme());
            } else if (prefersDark.addEventListener) {
                prefersDark.addEventListener('change', () => this.detectCurrentTheme());
            }
        }

        // Add click listener to theme toggle buttons for immediate detection
        this.setupThemeButtonListeners();
    }

    detectCurrentTheme(): boolean {
        let detectedTheme = 'dark'; // Default fallback

        const body = document.body;
        const html = document.documentElement;
        const vueApp = document.querySelector('#vue-app');
        const sidebar = document.querySelector('.comfy-menu, .sidebar, .menu, [class*="sidebar"], [class*="menu"]');

        // Get all possible theme-related elements
        const allElements = [body, html, vueApp, sidebar].filter(Boolean) as Element[];

        // Check CSS variables
        const rootStyles = window.getComputedStyle(html);
        const bodyStyles = window.getComputedStyle(body);

        // Method 2: Analyze background colors of multiple elements
        const backgrounds = allElements.map(el => {
            const styles = window.getComputedStyle(el);
            return {
                element: el.tagName || el.className,
                backgroundColor: styles.backgroundColor,
                color: styles.color
            };
        });

        // Method 3: Check for light backgrounds
        for (const bg of backgrounds) {
            if (bg.backgroundColor && bg.backgroundColor !== 'rgba(0, 0, 0, 0)' && bg.backgroundColor !== 'transparent') {
                const rgbMatch = bg.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                if (rgbMatch) {
                    const [, r, g, b] = rgbMatch.map(Number);
                    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                    if (brightness > 180) { // Higher threshold for light detection
                        detectedTheme = 'light';
                        break;
                    }
                }
            }
        }

        // Method 5: Force light theme detection if we see light backgrounds
        if (detectedTheme === 'dark') {
            // Look for any element with very light background
            const lightElements = document.querySelectorAll('*');
            for (let i = 0; i < Math.min(lightElements.length, 50); i++) { // Check first 50 elements
                const el = lightElements[i];
                const styles = window.getComputedStyle(el);
                const bgColor = styles.backgroundColor;

                if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                    const rgbMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                    if (rgbMatch) {
                        const [, r, g, b] = rgbMatch.map(Number);
                        const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                        if (brightness > 200) { // Very light elements
                            detectedTheme = 'light';
                            break;
                        }
                    }
                }
            }
        }

        // Update theme if it changed
        if (this.state.currentTheme !== detectedTheme) {
            this.state.currentTheme = detectedTheme;
            return true; // Theme changed
        }

        return false; // No change
    }

    setupThemeObserver(): void {
        // Watch for changes to body/html classes and attributes
        const observer = new MutationObserver((mutations) => {
            let shouldCheck = false;
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' &&
                    (mutation.attributeName === 'class' ||
                        mutation.attributeName === 'data-theme' ||
                        mutation.attributeName === 'style')) {
                    shouldCheck = true;
                }
            });

            if (shouldCheck && this.detectCurrentTheme()) {
                // Theme changed, update UI immediately
                this.notifyThemeChange();
            }
        });

        // Observe changes to body, html, and vue app
        observer.observe(document.body, { attributes: true, attributeOldValue: true });
        observer.observe(document.documentElement, { attributes: true, attributeOldValue: true });

        const vueApp = document.querySelector('#vue-app');
        if (vueApp) {
            observer.observe(vueApp, { attributes: true, attributeOldValue: true });
        }

        // Also watch for changes to any element with theme-related classes
        const themeElements = document.querySelectorAll('[class*="theme"], [class*="dark"], [class*="light"], [data-theme]');
        themeElements.forEach(el => {
            observer.observe(el, { attributes: true, attributeOldValue: true });
        });

        // Periodic fallback check every 2 seconds
        setInterval(() => {
            if (this.detectCurrentTheme()) {
                this.notifyThemeChange();
            }
        }, 2000);
    }

    setupThemeButtonListeners(): void {
        // Listen for clicks on theme toggle buttons
        document.addEventListener('click', (e) => {
            // Check if clicked element might be a theme toggle
            const target = e.target as HTMLElement;
            const isThemeButton = target.textContent?.toLowerCase().includes('theme') ||
                target.textContent?.toLowerCase().includes('light') ||
                target.textContent?.toLowerCase().includes('dark') ||
                target.title?.toLowerCase().includes('theme') ||
                target.className?.toLowerCase().includes('theme');

            if (isThemeButton) {
                setTimeout(() => {
                    if (this.detectCurrentTheme()) {
                        this.notifyThemeChange();
                    }
                }, 100);
            }
        });
    }

    notifyThemeChange(): void {
        // Update settings to reflect new theme
        this.state.settings["🔍MagnifyGlass.InfoPanelTheme"] = this.state.currentTheme;

        // Notify UI components of theme change immediately
        if (window.infoPanelManager && window.infoPanelManager.uiManager) {
            window.infoPanelManager.uiManager.updateTheme(this.state.currentTheme);
        }
    }

    loadSettings(): void {
        Object.keys(DEFAULT_PANEL_SETTINGS).forEach(key => {
            // Skip the theme setting since we auto-detect it
            if (key !== "🔍MagnifyGlass.InfoPanelTheme") {
                this.state.settings[key] = getSettingValue(key, (DEFAULT_PANEL_SETTINGS as any)[key]);
            }
        });

        // Set theme to auto-detected value
        this.state.settings["🔍MagnifyGlass.InfoPanelTheme"] = this.state.currentTheme;
    }

    updateSettings(): { [key: string]: { old: any, new: any } } {
        const oldSettings = { ...this.state.settings };
        this.loadSettings();

        // Return what changed for reactive updates
        const changes: { [key: string]: { old: any, new: any } } = {};
        Object.keys(this.state.settings).forEach(key => {
            if (oldSettings[key] !== this.state.settings[key]) {
                changes[key] = {
                    old: oldSettings[key],
                    new: this.state.settings[key]
                };
            }
        });

        return changes;
    }

    togglePanelVisibility(): boolean {
        this.state.isPanelVisible = !this.state.isPanelVisible;
        return this.state.isPanelVisible;
    }

    toggleGlassPreview(): boolean {
        this.state.isGlassPreviewVisible = !this.state.isGlassPreviewVisible;
        return this.state.isGlassPreviewVisible;
    }

    togglePinning(): boolean {
        const wasPinned = this.state.isPanelPinned;
        this.state.isPanelPinned = !this.state.isPanelPinned;

        // When unpinning, also unlock and clear auto-pin flag
        if (!this.state.isPanelPinned) {
            this.state.isPanelLocked = false;
            this.state.isAutoPinned = false; // Clear auto-pin flag when manually unpinning
        }

        if (this.state.isPanelPinned && this.state.lastPinnedPosition) {
            // Restore to last pinned position
            this.state.pinnedPosition = { ...this.state.lastPinnedPosition };
        } else if (!this.state.isPanelPinned && wasPinned) {
            // Save current position when unpinning
            this.state.lastPinnedPosition = { ...this.state.pinnedPosition };
        }

        return this.state.isPanelPinned;
    }

    toggleLocking(): boolean {
        // Only allow locking when pinned
        if (!this.state.isPanelPinned) {
            return false;
        }

        this.state.isPanelLocked = !this.state.isPanelLocked;
        return this.state.isPanelLocked;
    }

    toggleMinimized(): boolean {
        this.state.isPanelMinimized = !this.state.isPanelMinimized;
        return this.state.isPanelMinimized;
    }

    toggleSection(sectionId: string): boolean {
        if (sectionId === 'node') return false; // Node section always expanded

        if (this.state.expandedSections.has(sectionId)) {
            this.state.expandedSections.delete(sectionId);
        } else {
            this.state.expandedSections.add(sectionId);
        }
        return true;
    }

    setPinnedPosition(x: number, y: number): void {
        this.state.pinnedPosition = { x, y };
        // Also save as last pinned position for memory
        this.state.lastPinnedPosition = { x, y };
    }

    setCurrentInfo(info: any): void {
        this.state.currentInfo = info;
    }

    scheduleAutoCollapse(): void {
        this.clearAutoExpandTimer();
        if (this.state.settings["🔍MagnifyGlass.InfoPanelAnimations"]) {
            this.state.autoExpandTimer = setTimeout(() => {
                if (!this.state.isPanelHovered) {
                    this.collapseNodeSections();
                }
            }, 1500);
        }
    }

    clearAutoExpandTimer(): void {
        if (this.state.autoExpandTimer) {
            clearTimeout(this.state.autoExpandTimer);
            this.state.autoExpandTimer = null;
        }
    }

    expandNodeSections(): void {
        this.state.expandedSections.add('hoveredNode');
        this.state.expandedSections.add('node');
        this.state.expandedSections.add('cursor');
        this.state.expandedSections.add('canvas');
        this.state.expandedSections.add('magnifier');
        this.clearAutoExpandTimer();
    }

    collapseNodeSections(): void {
        this.state.expandedSections.delete('hoveredNode');
        this.state.expandedSections.delete('node');
        this.state.expandedSections.delete('widget');
    }

    cleanup(): void {
        this.clearAutoExpandTimer();
    }
}
