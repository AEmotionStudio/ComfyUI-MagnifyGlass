/**
 * ComfyUI MagnifyGlass - Info Panel State Manager (TypeScript)
 * 
 * Centralized state management for the information panel.
 */

import { getSettingValue, clamp } from '../shared/utils';
import { DEFAULT_PANEL_SETTINGS } from '../shared/settings';
import { PANEL_FONTS, STORAGE_KEYS } from '../shared/constants';

export interface InfoPanelStateData {
    // Panel visibility and positioning
    isPanelVisible: boolean;
    wasPanelVisibleBeforeHide: boolean; // Persist state across glass toggles
    isPanelMinimized: boolean;
    // Floating: stays where it was dragged instead of following the glass
    isFloating: boolean;
    // Where it floats; null until it first floats
    floatPosition: { x: number; y: number } | null;

    // Glass visibility
    isGlassPreviewVisible: boolean;

    isPanelHovered: boolean;

    // The node the panel shows
    currentNodeId: number | null;

    // Node the panel is locked to: shown instead of the hovered node until unlocked
    lockedNodeId: number | null;
    // The graph that id belongs to; another graph on screen releases the lock
    lockedGraph: unknown;
    // The shown node is the canvas selection (Follow selection)
    showsSelection: boolean;

    // Settings cache - using index signature for dynamic ComfyUI settings
    settings: { [key: string]: string | number | boolean };
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
            wasPanelVisibleBeforeHide: false,
            isPanelMinimized: false,
            isFloating: false,
            floatPosition: null,

            // Glass visibility
            isGlassPreviewVisible: true,

            isPanelHovered: false,
            currentNodeId: null,

            lockedNodeId: null,
            lockedGraph: null,
            showsSelection: false,

            // Settings cache
            settings: {}
        };

        this.loadSettings();
        this.loadLayout();
    }

    /**
     * Float mode, float position and minimized state are kept per browser.
     */
    private loadLayout(): void {
        try {
            const layout = JSON.parse(localStorage.getItem(STORAGE_KEYS.INSPECTOR_LAYOUT) || '{}');
            this.state.isFloating = layout.floating === true;
            this.state.isPanelMinimized = layout.minimized === true;
            if (Number.isFinite(layout.x) && Number.isFinite(layout.y)) {
                this.state.floatPosition = { x: layout.x, y: layout.y };
            }
        } catch (e) {
            // Storage blocked or the saved layout unreadable: start from the defaults
        }
    }

    saveLayout(): void {
        const { isFloating, floatPosition, isPanelMinimized } = this.state;
        try {
            localStorage.setItem(STORAGE_KEYS.INSPECTOR_LAYOUT, JSON.stringify({ floating: isFloating, minimized: isPanelMinimized, ...floatPosition }));
        } catch (e) {
            // Storage blocked: the layout lasts until reload
        }
    }

    loadSettings(): void {
        const defaults = DEFAULT_PANEL_SETTINGS;

        Object.keys(defaults).forEach(key => {
            this.state.settings[key] = getSettingValue(key, (defaults as any)[key]);
        });

        // Validate numeric settings
        this.state.settings["🔍MagnifyGlass.InfoPanelWidth"] = this.validateNumber(
            this.state.settings["🔍MagnifyGlass.InfoPanelWidth"], 200, 600, defaults["🔍MagnifyGlass.InfoPanelWidth"] as number
        );

        this.state.settings["🔍MagnifyGlass.InfoPanelMaxHeight"] = this.validateNumber(
            this.state.settings["🔍MagnifyGlass.InfoPanelMaxHeight"], 200, 1500, defaults["🔍MagnifyGlass.InfoPanelMaxHeight"] as number
        );

        this.state.settings["🔍MagnifyGlass.InfoPanelOpacity"] = this.validateNumber(
            this.state.settings["🔍MagnifyGlass.InfoPanelOpacity"], 10, 100, defaults["🔍MagnifyGlass.InfoPanelOpacity"] as number
        );

        this.state.settings["🔍MagnifyGlass.InfoPanelFontSize"] = this.validateNumber(
            this.state.settings["🔍MagnifyGlass.InfoPanelFontSize"], 8, 24, defaults["🔍MagnifyGlass.InfoPanelFontSize"] as number
        );

        // Validate colors
        this.state.settings["🔍MagnifyGlass.InfoPanelTextColor"] = this.validateColor(
            this.state.settings["🔍MagnifyGlass.InfoPanelTextColor"], defaults["🔍MagnifyGlass.InfoPanelTextColor"] as string
        );

        this.state.settings["🔍MagnifyGlass.InfoPanelAccentColor"] = this.validateColor(
            this.state.settings["🔍MagnifyGlass.InfoPanelAccentColor"], defaults["🔍MagnifyGlass.InfoPanelAccentColor"] as string
        );

        // Validate Enums
        const validPanelPositions = ['Bottom', 'Top', 'Left', 'Right'];
        this.state.settings["🔍MagnifyGlass.InfoPanelPosition"] = this.validateStringOption(
            this.state.settings["🔍MagnifyGlass.InfoPanelPosition"], validPanelPositions, defaults["🔍MagnifyGlass.InfoPanelPosition"] as string
        );

        const validControlPositions = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'top', 'bottom', 'left', 'right'];
        this.state.settings["🔍MagnifyGlass.ControlsPosition"] = this.validateStringOption(
            this.state.settings["🔍MagnifyGlass.ControlsPosition"], validControlPositions, defaults["🔍MagnifyGlass.ControlsPosition"] as string
        );

        this.state.settings["🔍MagnifyGlass.InfoPanelFontFamily"] = this.validateStringOption(
            this.state.settings["🔍MagnifyGlass.InfoPanelFontFamily"], PANEL_FONTS, defaults["🔍MagnifyGlass.InfoPanelFontFamily"] as string
        );
    }

    /**
     * Validate numeric input with bounds checking.
     */
    private validateNumber(value: unknown, min: number, max: number, fallback: number): number {
        const num = Number(value);
        if (isNaN(num)) return fallback;
        return clamp(num, min, max);
    }

    /**
     * Validate color string (hex).
     */
    private validateColor(color: unknown, fallback: string): string {
        if (!color || typeof color !== 'string') return fallback;
        // Basic hex validation: #RGB, #RRGGBB, #RRGGBBAA
        if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(color)) {
            return color;
        }
        return fallback;
    }

    /**
     * Validate string against an allowlist.
     */
    private validateStringOption(value: unknown, options: readonly string[], fallback: string): string {
        if (typeof value !== 'string') return fallback;
        return options.includes(value) ? value : fallback;
    }

    toggleMinimized(): boolean {
        this.state.isPanelMinimized = !this.state.isPanelMinimized;
        return this.state.isPanelMinimized;
    }
}
