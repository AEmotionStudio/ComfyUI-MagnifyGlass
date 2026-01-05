/**
 * StateManager Unit Tests
 * 
 * Tests for the StateManager class which manages info panel state.
 */

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
        stateManager = new StateManager();
    });

    afterEach(() => {
        vi.useRealTimers();
        stateManager.cleanup();
    });

    describe('constructor', () => {
        it('should initialize with default state values', () => {
            expect(stateManager.state.isPanelVisible).toBe(false);
            expect(stateManager.state.isPanelMinimized).toBe(false);
            expect(stateManager.state.isPanelPinned).toBe(false);
            expect(stateManager.state.isPanelLocked).toBe(false);
        });

        it('should initialize glass preview as visible', () => {
            expect(stateManager.state.isGlassPreviewVisible).toBe(true);
        });

        it('should initialize with node section expanded', () => {
            expect(stateManager.state.expandedSections.has('node')).toBe(true);
        });

        it('should initialize currentInfo as null', () => {
            expect(stateManager.state.currentInfo).toBeNull();
        });

        it('should initialize with dark theme as default', () => {
            expect(stateManager.state.currentTheme).toBe('dark');
        });
    });

    describe('togglePanelVisibility', () => {
        it('should toggle panel visibility', () => {
            expect(stateManager.state.isPanelVisible).toBe(false);

            stateManager.togglePanelVisibility();
            expect(stateManager.state.isPanelVisible).toBe(true);

            stateManager.togglePanelVisibility();
            expect(stateManager.state.isPanelVisible).toBe(false);
        });

        it('should return new visibility state', () => {
            expect(stateManager.togglePanelVisibility()).toBe(true);
            expect(stateManager.togglePanelVisibility()).toBe(false);
        });
    });

    describe('toggleGlassPreview', () => {
        it('should toggle glass preview visibility', () => {
            expect(stateManager.state.isGlassPreviewVisible).toBe(true);

            stateManager.toggleGlassPreview();
            expect(stateManager.state.isGlassPreviewVisible).toBe(false);

            stateManager.toggleGlassPreview();
            expect(stateManager.state.isGlassPreviewVisible).toBe(true);
        });
    });

    describe('togglePinning', () => {
        it('should toggle pinned state', () => {
            expect(stateManager.state.isPanelPinned).toBe(false);

            stateManager.togglePinning();
            expect(stateManager.state.isPanelPinned).toBe(true);

            stateManager.togglePinning();
            expect(stateManager.state.isPanelPinned).toBe(false);
        });

        it('should clear locked state when unpinning', () => {
            stateManager.state.isPanelPinned = true;
            stateManager.state.isPanelLocked = true;

            stateManager.togglePinning(); // Unpin

            expect(stateManager.state.isPanelLocked).toBe(false);
        });
    });

    describe('toggleLocking', () => {
        it('should not allow locking when not pinned', () => {
            stateManager.state.isPanelPinned = false;

            const result = stateManager.toggleLocking();

            expect(result).toBe(false);
            expect(stateManager.state.isPanelLocked).toBe(false);
        });

        it('should toggle locking when pinned', () => {
            stateManager.state.isPanelPinned = true;

            stateManager.toggleLocking();
            expect(stateManager.state.isPanelLocked).toBe(true);

            stateManager.toggleLocking();
            expect(stateManager.state.isPanelLocked).toBe(false);
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

    describe('toggleSection', () => {
        it('should not toggle node section (always expanded)', () => {
            const result = stateManager.toggleSection('node');
            expect(result).toBe(false);
        });

        it('should toggle other sections', () => {
            expect(stateManager.state.expandedSections.has('media')).toBe(false);

            stateManager.toggleSection('media');
            expect(stateManager.state.expandedSections.has('media')).toBe(true);

            stateManager.toggleSection('media');
            expect(stateManager.state.expandedSections.has('media')).toBe(false);
        });
    });

    describe('setPinnedPosition', () => {
        it('should set pinned position', () => {
            stateManager.setPinnedPosition(100, 200);

            expect(stateManager.state.pinnedPosition).toEqual({ x: 100, y: 200 });
            expect(stateManager.state.lastPinnedPosition).toEqual({ x: 100, y: 200 });
        });
    });

    describe('setCurrentInfo', () => {
        it('should set current info', () => {
            const mockInfo = {
                timestamp: Date.now(),
                cursor: { screenX: 0, screenY: 0, canvasX: 0, canvasY: 0 },
                zoom: 1,
                nodeCount: 5,
                hoveredNode: null,
                hoveredWidget: null,
                mediaElement: null
            };

            stateManager.setCurrentInfo(mockInfo);

            expect(stateManager.state.currentInfo).toEqual(mockInfo);
        });
    });

    describe('expandNodeSections', () => {
        it('should expand all node-related sections', () => {
            stateManager.expandNodeSections();

            expect(stateManager.state.expandedSections.has('hoveredNode')).toBe(true);
            expect(stateManager.state.expandedSections.has('node')).toBe(true);
            expect(stateManager.state.expandedSections.has('cursor')).toBe(true);
            expect(stateManager.state.expandedSections.has('canvas')).toBe(true);
            expect(stateManager.state.expandedSections.has('magnifier')).toBe(true);
        });
    });

    describe('collapseNodeSections', () => {
        it('should collapse node-related sections', () => {
            stateManager.state.expandedSections.add('hoveredNode');
            stateManager.state.expandedSections.add('widget');

            stateManager.collapseNodeSections();

            expect(stateManager.state.expandedSections.has('hoveredNode')).toBe(false);
            expect(stateManager.state.expandedSections.has('widget')).toBe(false);
        });
    });

    describe('setSelectedNode', () => {
        it('should set selected node ID', () => {
            expect(stateManager.state.selectedNodeId).toBeNull();

            stateManager.setSelectedNode(42);
            expect(stateManager.state.selectedNodeId).toBe(42);
        });

        it('should allow setting to null', () => {
            stateManager.setSelectedNode(42);
            stateManager.setSelectedNode(null);
            expect(stateManager.state.selectedNodeId).toBeNull();
        });
    });

    describe('clearSelectedNode', () => {
        it('should clear selected node ID', () => {
            stateManager.setSelectedNode(42);
            expect(stateManager.state.selectedNodeId).toBe(42);

            stateManager.clearSelectedNode();
            expect(stateManager.state.selectedNodeId).toBeNull();
        });
    });
});
