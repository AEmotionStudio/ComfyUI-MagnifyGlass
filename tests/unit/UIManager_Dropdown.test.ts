
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UIManager } from '../../src/info-panel/UIManager';
import { StateManager } from '../../src/info-panel/StateManager';

// Mock app global
(globalThis as any).app = {
    graph: { _nodes: [] },
    canvas: { centerOnNode: vi.fn() }
};

describe('UIManager Dropdown Accessibility', () => {
    let uiManager: UIManager;
    let stateManager: StateManager;

    beforeEach(() => {
        stateManager = new StateManager();
        stateManager.state.currentTheme = 'dark';

        uiManager = new UIManager(stateManager);

        document.body.innerHTML = '';
        Element.prototype.scrollIntoView = vi.fn();
    });

    afterEach(() => {
        uiManager.cleanup();
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('should create a dropdown with accessible attributes', () => {
        const nodes = [
            { id: 1, title: 'Node 1', type: 'Type A' },
            { id: 2, title: 'Node 2', type: 'Type B' }
        ];
        const anchor = document.createElement('div');
        document.body.appendChild(anchor);

        (uiManager as any).createDropdown(nodes, anchor, 'title');

        const dropdown = document.querySelector('.node-selector-dropdown');
        expect(dropdown).not.toBeNull();
        expect(dropdown?.getAttribute('role')).toBe('listbox');
        expect(dropdown?.getAttribute('tabindex')).toBe('-1');

        const items = dropdown?.querySelectorAll('.dropdown-item');
        expect(items?.length).toBe(2);
        expect(items?.[0].getAttribute('role')).toBe('option');
        expect(items?.[0].getAttribute('aria-selected')).toBe('true');
    });

    it('should navigate dropdown with keyboard', async () => {
        vi.useFakeTimers();

        const nodes = [
            { id: 1, title: 'Node 1', type: 'Type A' },
            { id: 2, title: 'Node 2', type: 'Type B' }
        ];
        const anchor = document.createElement('div');
        document.body.appendChild(anchor);

        (uiManager as any).createDropdown(nodes, anchor, 'title');

        vi.advanceTimersByTime(100);

        const dropdown = document.querySelector('.node-selector-dropdown') as HTMLElement;
        const items = dropdown.querySelectorAll('.dropdown-item');

        expect(document.activeElement).toBe(dropdown);

        // Arrow Down
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
        expect(items[1].getAttribute('aria-selected')).toBe('true');

        // Arrow Up
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        expect(items[0].getAttribute('aria-selected')).toBe('true');

        vi.useRealTimers();
    });

    it('should cleanup event listeners when item is selected', () => {
        vi.useFakeTimers();
        const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

        const nodes = [{ id: 1, title: 'Node 1', type: 'Type A' }];
        const anchor = document.createElement('div');
        document.body.appendChild(anchor);

        (uiManager as any).createDropdown(nodes, anchor, 'title');

        vi.advanceTimersByTime(100);

        const dropdown = document.querySelector('.node-selector-dropdown') as HTMLElement;
        const item = dropdown.querySelector('.dropdown-item') as HTMLElement;

        // Simulate click
        item.click();

        // Assert cleanup was called
        // The cleanup function removes 'mousedown' and 'keydown' from document
        expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function), true);

        vi.useRealTimers();
    });
});
