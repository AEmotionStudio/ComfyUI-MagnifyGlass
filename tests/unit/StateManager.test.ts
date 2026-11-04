/**
 * StateManager Unit Tests
 * 
 * Tests for the StateManager class which manages info panel state.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock app object for settings
vi.mock('/scripts/app.js', () => ({
    app: {
        ui: {
            settings: {
                getSettingValue: (key: string) => undefined
            }
        }
    }
}));

import { StateManager } from '../../src/info-panel/StateManager';

describe('StateManager', () => {
    let stateManager: StateManager;

    beforeEach(() => {
        vi.useFakeTimers();
        // Node's own localStorage global hides happy-dom's
        vi.stubGlobal('localStorage', new Storage());
        stateManager = new StateManager();
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    describe('constructor', () => {
        it('should initialize with default state values', () => {
            expect(stateManager.state.isPanelVisible).toBe(false);
            expect(stateManager.state.isPanelMinimized).toBe(false);
            expect(stateManager.state.isFloating).toBe(false);
            expect(stateManager.state.floatPosition).toBeNull();
        });

        it('should initialize glass preview as visible', () => {
            expect(stateManager.state.isGlassPreviewVisible).toBe(true);
        });

    });

    describe('layout', () => {
        it('keeps float mode, position and minimized state across reloads', () => {
            stateManager.state.isFloating = true;
            stateManager.state.floatPosition = { x: 120, y: 80 };
            stateManager.state.isPanelMinimized = true;
            stateManager.saveLayout();

            const reloaded = new StateManager();
            expect(reloaded.state.isFloating).toBe(true);
            expect(reloaded.state.floatPosition).toEqual({ x: 120, y: 80 });
            expect(reloaded.state.isPanelMinimized).toBe(true);
        });

        it('starts from the defaults when storage is blocked or holds junk', () => {
            localStorage.setItem('comfyui_magnify_inspector_layout', '{not json');
            expect(new StateManager().state.isFloating).toBe(false);

            const blocked = () => { throw new Error('blocked'); };
            vi.stubGlobal('localStorage', { getItem: blocked, setItem: blocked });
            const manager = new StateManager();
            expect(manager.state.floatPosition).toBeNull();
            expect(() => manager.saveLayout()).not.toThrow();
        });
    });

    describe('toggleMinimized', () => {
        it('should toggle minimized state', () => {
            expect(stateManager.state.isPanelMinimized).toBe(false);

            stateManager.toggleMinimized();
            expect(stateManager.state.isPanelMinimized).toBe(true);

            stateManager.toggleMinimized();
            expect(stateManager.state.isPanelMinimized).toBe(false);
        });
    });

    it('starts showing and locked to no node', () => {
        expect(stateManager.state.currentNodeId).toBeNull();
        expect(stateManager.state.lockedNodeId).toBeNull();
    });
});
