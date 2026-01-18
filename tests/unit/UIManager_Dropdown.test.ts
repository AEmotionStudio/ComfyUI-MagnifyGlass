
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
        expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function), true);

        vi.useRealTimers();
    });

    it('should ignore keyboard events when dropdown is not focused', () => {
        vi.useFakeTimers();

        const nodes = [{ id: 1, title: 'Node 1', type: 'Type A' }, { id: 2, title: 'Node 2', type: 'Type B' }];
        const anchor = document.createElement('div');
        document.body.appendChild(anchor);

        (uiManager as any).createDropdown(nodes, anchor, 'title');

        vi.advanceTimersByTime(100);

        const dropdown = document.querySelector('.node-selector-dropdown') as HTMLElement;
        const items = dropdown.querySelectorAll('.dropdown-item');

        // Simulate focus moving elsewhere (e.g., user tabs away)
        const otherInput = document.createElement('input');
        document.body.appendChild(otherInput);
        otherInput.focus();
        expect(document.activeElement).toBe(otherInput);

        // Arrow Down - should NOT change selection if focus is elsewhere
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

        document.dispatchEvent(event);

        expect(preventDefaultSpy).not.toHaveBeenCalled();
        expect(items[1].getAttribute('aria-selected')).toBe('false'); // Should stay on first item

        vi.useRealTimers();
    });

    it('should cleanup previous event listeners when opening a new dropdown via anchor click', () => {
        vi.useFakeTimers();
        const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

        const nodes = [{ id: 1, title: 'Node 1', type: 'Type A' }];
        const anchor = document.createElement('div');
        document.body.appendChild(anchor);

        // Open first time
        (uiManager as any).createDropdown(nodes, anchor, 'title');
        vi.advanceTimersByTime(100);

        // Reset spy to track calls for the next action
        removeEventListenerSpy.mockClear();

        // Simulate re-opening (which calls hideDropdown then createDropdown)
        (uiManager as any).showTitleDropdown(anchor);

        // Verify that cleanup for the FIRST dropdown occurred
        expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function), true);

        vi.useRealTimers();
    });

    it('should not intercept Escape key when focus is elsewhere', () => {
        vi.useFakeTimers();

        const nodes = [{ id: 1, title: 'Node 1', type: 'Type A' }];
        const anchor = document.createElement('div');
        document.body.appendChild(anchor);

        (uiManager as any).createDropdown(nodes, anchor, 'title');
        vi.advanceTimersByTime(100);

        // Simulate focus moving elsewhere
        const otherInput = document.createElement('input');
        document.body.appendChild(otherInput);
        otherInput.focus();

        const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
        const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
        const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

        document.dispatchEvent(event);

        // If the bug exists, these will be called. We expect them NOT to be called.
        expect(preventDefaultSpy).not.toHaveBeenCalled();
        expect(stopPropagationSpy).not.toHaveBeenCalled();

        // Also dropdown should still be open (or maybe not? The user requirement is just about blocking propagation)
        // If we don't intercept, it stays open. But ideally pressing Escape on another input might close that input's menu, not ours.
        // Or if it's a modal, maybe it should close?
        // The reviewer says: "dropdown's handler will intercept the event and block propagation".
        // So simply verifying propagation is not blocked is enough.

        vi.useRealTimers();
    });

    it('should not add listeners if dropdown is closed before timeout', () => {
        vi.useFakeTimers();
        const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

        const nodes = [{ id: 1, title: 'Node 1', type: 'Type A' }];
        const anchor = document.createElement('div');
        document.body.appendChild(anchor);

        (uiManager as any).createDropdown(nodes, anchor, 'title');

        // Immediately close it (before timeout fires)
        uiManager.hideDropdown();

        // Advance time to let timeout fire
        vi.advanceTimersByTime(100);

        // Listeners should NOT have been added
        expect(addEventListenerSpy).not.toHaveBeenCalledWith('keydown', expect.any(Function));
        expect(addEventListenerSpy).not.toHaveBeenCalledWith('mousedown', expect.any(Function), true);

        vi.useRealTimers();
    });
});
