/**
 * ConfigManager Unit Tests
 * 
 * Tests for the ConfigManager class which handles settings and offset management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

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
                getSettingValue: (key: string) => undefined
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
            expect(configManager.debugMode).toBe(false);
        });

        it('should initialize offsets to zero', () => {
            expect(configManager.offsetX).toBe(0);
            expect(configManager.offsetY).toBe(0);
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
