/**
 * ConfigManager Unit Tests
 * 
 * Tests for the ConfigManager class which handles settings and offset management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock settings store
const settingsStore: Record<string, any> = {};

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

// Mock global app object for getSettingValue
vi.mock('/scripts/app.js', () => ({
    app: {
        ui: {
            settings: {
                getSettingValue: (key: string) => settingsStore[key]
            }
        }
    }
}));

// Apply localStorage mock
Object.defineProperty(globalThis, 'localStorage', {
    value: localStorageMock
});

// Import after mocks are set up
import { ConfigManager } from '../../src/magnify-glass/ConfigManager';

describe('ConfigManager', () => {
    let configManager: ConfigManager;

    beforeEach(() => {
        localStorageMock.clear();
        // Clear settings store
        for (const key in settingsStore) delete settingsStore[key];
        configManager = new ConfigManager();
    });

    describe('constructor', () => {
        it('should initialize with default values', () => {
            expect(configManager.zoomFactor).toBe(3); // 300 / 100
            expect(configManager.glassSize).toBe(300);
            expect(configManager.borderColor).toBe('#6b7280');
            expect(configManager.borderWidth).toBe(1);
            expect(configManager.activationKey).toBe('x');
            expect(configManager.altRequired).toBe(false);
            expect(configManager.followCursor).toBe(false);
            // Note: debugMode was removed from ConfigManager
        });

        it('should initialize offsets to zero', () => {
            expect(configManager.offsetX).toBe(0);
            expect(configManager.offsetY).toBe(0);
        });
    });

    describe('loadSettings Validation', () => {
        it('should load valid settings correctly', () => {
            settingsStore['🔍MagnifyGlass.ZoomFactor'] = 500;
            settingsStore['🔍MagnifyGlass.GlassSize'] = 400;

            configManager.loadSettings();

            expect(configManager.zoomFactor).toBe(5);
            expect(configManager.glassSize).toBe(400);
        });

        it('should clamp values exceeding maximum', () => {
            settingsStore['🔍MagnifyGlass.ZoomFactor'] = 10000; // Way too high
            settingsStore['🔍MagnifyGlass.GlassSize'] = 5000; // Way too big
            settingsStore['🔍MagnifyGlass.BorderWidth'] = 100; // Too thick
            settingsStore['🔍MagnifyGlass.OffsetStep'] = 200; // Too fast

            configManager.loadSettings();

            expect(configManager.zoomFactor).toBe(50); // Clamped to 5000 (50x)
            expect(configManager.glassSize).toBe(2000); // Clamped to 2000
            expect(configManager.borderWidth).toBe(50); // Clamped to 50
            expect(configManager.offsetStep).toBe(100); // Clamped to 100
        });

        it('should clamp values below minimum', () => {
            settingsStore['🔍MagnifyGlass.ZoomFactor'] = -100;
            settingsStore['🔍MagnifyGlass.GlassSize'] = 10;
            settingsStore['🔍MagnifyGlass.BorderWidth'] = -5;
            settingsStore['🔍MagnifyGlass.OffsetStep'] = 0;

            configManager.loadSettings();

            expect(configManager.zoomFactor).toBe(0.1); // Clamped to 10 (0.1x)
            expect(configManager.glassSize).toBe(50); // Clamped to 50
            expect(configManager.borderWidth).toBe(0); // Clamped to 0
            expect(configManager.offsetStep).toBe(1); // Clamped to 1
        });

        it('should validate hex colors', () => {
            settingsStore['🔍MagnifyGlass.BorderColor'] = '#ff0000'; // Valid
            configManager.loadSettings();
            expect(configManager.borderColor).toBe('#ff0000');

            settingsStore['🔍MagnifyGlass.BorderColor'] = 'invalid-color'; // Invalid
            configManager.loadSettings();
            expect(configManager.borderColor).toBe('#6b7280'); // Fallback to default (initialized in constructor)

            settingsStore['🔍MagnifyGlass.BorderColor'] = '#123'; // Valid short hex
            configManager.loadSettings();
            expect(configManager.borderColor).toBe('#123');

             settingsStore['🔍MagnifyGlass.BorderColor'] = '#12345678'; // Valid alpha hex
            configManager.loadSettings();
            expect(configManager.borderColor).toBe('#12345678');
        });

        it('should handle non-numeric inputs gracefully', () => {
             settingsStore['🔍MagnifyGlass.GlassSize'] = "not a number";
             configManager.loadSettings();
             // Should fallback to default (300) or previous value
             expect(configManager.glassSize).toBe(300);
        });
    });

    describe('loadSavedOffsets', () => {
        it('should load offsets from localStorage', () => {
            localStorageMock.setItem('comfyui_magnify_offset_x', '50');
            localStorageMock.setItem('comfyui_magnify_offset_y', '-25');

            configManager.loadSavedOffsets();

            expect(configManager.offsetX).toBe(50);
            expect(configManager.offsetY).toBe(-25);
        });

        it('should default to zero if localStorage is empty', () => {
            configManager.loadSavedOffsets();

            expect(configManager.offsetX).toBe(0);
            expect(configManager.offsetY).toBe(0);
        });
    });

    describe('saveOffsets', () => {
        it('should save offsets to localStorage', () => {
            configManager.offsetX = 100;
            configManager.offsetY = -50;

            configManager.saveOffsets();

            expect(localStorageMock.getItem('comfyui_magnify_offset_x')).toBe('100');
            expect(localStorageMock.getItem('comfyui_magnify_offset_y')).toBe('-50');
        });
    });

    describe('resetOffsets', () => {
        it('should reset offsets to zero', () => {
            configManager.offsetX = 100;
            configManager.offsetY = -50;

            configManager.resetOffsets();

            expect(configManager.offsetX).toBe(0);
            expect(configManager.offsetY).toBe(0);
        });

        it('should save reset offsets to localStorage', () => {
            configManager.offsetX = 100;
            configManager.offsetY = -50;

            configManager.resetOffsets();

            expect(localStorageMock.getItem('comfyui_magnify_offset_x')).toBe('0');
            expect(localStorageMock.getItem('comfyui_magnify_offset_y')).toBe('0');
        });
    });
});
