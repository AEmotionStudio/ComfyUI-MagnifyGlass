
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();

Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock
});

// Mock window
Object.defineProperty(globalThis, 'window', {
    value: {
        matchMedia: () => ({
            addListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        }),
        infoPanelManager: null,
        getComputedStyle: () => ({
            backgroundColor: 'rgb(30, 30, 30)'
        })
    },
    writable: true
});

// Mock document
Object.defineProperty(globalThis, 'document', {
    value: {
        body: {
            getAttribute: () => null,
            className: ''
        },
        documentElement: {
            getAttribute: () => null,
            className: ''
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: vi.fn()
    },
    writable: true
});

// Mock getComputedStyle
(globalThis as any).getComputedStyle = () => ({
    backgroundColor: 'rgb(30, 30, 30)'
});

// Mock MutationObserver
(globalThis as any).MutationObserver = class {
    observe = vi.fn();
    disconnect = vi.fn();
    takeRecords = vi.fn();
};

// Mock utils
vi.mock('../../src/shared/utils', () => ({
    getSettingValue: vi.fn((key, def) => def), // Default implementation returns default
    clamp: (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
}));

import { StateManager } from '../../src/info-panel/StateManager';
import { getSettingValue } from '../../src/shared/utils';
import { DEFAULT_PANEL_SETTINGS } from '../../src/shared/settings';

describe('StateManager Settings Validation', () => {
    let stateManager: StateManager;

    beforeEach(() => {
        vi.clearAllMocks();
        // Reset getSettingValue to return default
        (getSettingValue as any).mockImplementation((key: string, def: any) => def);
        stateManager = new StateManager();
    });

    afterEach(() => {
        if (stateManager) {
            stateManager.cleanup();
        }
    });

    it('should validate InfoPanelWidth (number validation)', () => {
        // Mock invalid string input
        (getSettingValue as any).mockImplementation((key: string, def: any) => {
            if (key === '🔍MagnifyGlass.InfoPanelWidth') return 'invalid-width';
            return def;
        });

        stateManager.loadSettings();
        expect(stateManager.state.settings['🔍MagnifyGlass.InfoPanelWidth']).toBe(DEFAULT_PANEL_SETTINGS['🔍MagnifyGlass.InfoPanelWidth']);

        // Mock out of bounds input
        (getSettingValue as any).mockImplementation((key: string, def: any) => {
            if (key === '🔍MagnifyGlass.InfoPanelWidth') return 10000;
            return def;
        });
        stateManager.loadSettings();
        expect(stateManager.state.settings['🔍MagnifyGlass.InfoPanelWidth']).toBe(600); // Max is 600
    });

    it('should validate InfoPanelOpacity (number validation)', () => {
        (getSettingValue as any).mockImplementation((key: string, def: any) => {
            if (key === '🔍MagnifyGlass.InfoPanelOpacity') return -50;
            return def;
        });
        stateManager.loadSettings();
        expect(stateManager.state.settings['🔍MagnifyGlass.InfoPanelOpacity']).toBe(10); // Min is 10
    });

    it('should validate InfoPanelTextColor (color validation)', () => {
        (getSettingValue as any).mockImplementation((key: string, def: any) => {
            if (key === '🔍MagnifyGlass.InfoPanelTextColor') return 'not-a-color';
            return def;
        });
        stateManager.loadSettings();
        expect(stateManager.state.settings['🔍MagnifyGlass.InfoPanelTextColor']).toBe('#6b7280'); // Default
    });

    it('should validate InfoPanelFontFamily (allowlist validation)', () => {
        (getSettingValue as any).mockImplementation((key: string, def: any) => {
            if (key === '🔍MagnifyGlass.InfoPanelFontFamily') return 'DangerousFont';
            return def;
        });
        stateManager.loadSettings();
        expect(stateManager.state.settings['🔍MagnifyGlass.InfoPanelFontFamily']).toBe('System Default'); // Default
    });
});
