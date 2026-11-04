
import { describe, it, expect, beforeEach, vi } from 'vitest';

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

    it('keeps every font the settings offer', () => {
        (getSettingValue as any).mockImplementation((key: string, def: any) => {
            if (key === '🔍MagnifyGlass.InfoPanelFontFamily') return 'Press Start 2P';
            return def;
        });
        stateManager.loadSettings();
        expect(stateManager.state.settings['🔍MagnifyGlass.InfoPanelFontFamily']).toBe('Press Start 2P');
    });
});
