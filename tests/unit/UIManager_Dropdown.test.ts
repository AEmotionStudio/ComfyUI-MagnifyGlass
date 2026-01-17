
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
        // Mock valid theme to avoid issues
        stateManager.state.currentTheme = 'dark';

        uiManager = new UIManager(stateManager);

        // Mock body.appendChild to just add to a test container or document.body
        document.body.innerHTML = '';

        // Mock scrollIntoView
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

        // Access private method
        (uiManager as any).createDropdown(nodes, anchor, 'title');

        const dropdown = document.querySelector('.node-selector-dropdown');
        expect(dropdown).not.toBeNull();
        expect(dropdown?.getAttribute('role')).toBe('listbox');
        expect(dropdown?.getAttribute('tabindex')).toBe('-1');

        const items = dropdown?.querySelectorAll('.dropdown-item');
        expect(items?.length).toBe(2);
        expect(items?.[0].getAttribute('role')).toBe('option');
        // Initial state: first item selected
        expect(items?.[0].getAttribute('aria-selected')).toBe('true');
        expect(items?.[1].getAttribute('aria-selected')).toBe('false');
    });

    it('should navigate dropdown with keyboard', async () => {
        vi.useFakeTimers();

        const nodes = [
            { id: 1, title: 'Node 1', type: 'Type A' },
            { id: 2, title: 'Node 2', type: 'Type B' },
            { id: 3, title: 'Node 3', type: 'Type C' }
        ];
        const anchor = document.createElement('div');
        document.body.appendChild(anchor);

        (uiManager as any).createDropdown(nodes, anchor, 'title');

        // Fast-forward time to let setTimeout fire (attaching listeners and focusing)
        vi.advanceTimersByTime(100);

        const dropdown = document.querySelector('.node-selector-dropdown') as HTMLElement;
        const items = dropdown.querySelectorAll('.dropdown-item');

        // Check initial focus
        expect(document.activeElement).toBe(dropdown);
        expect(items[0].classList.contains('focused')).toBe(true);
        expect(items[1].classList.contains('focused')).toBe(false);

        // Simulate ArrowDown on the dropdown (or document, since listener is on document)
        // Code attaches to document: document.addEventListener('keydown', keyHandler);
        // It uses activeIndex from closure.

        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));

        expect(items[0].classList.contains('focused')).toBe(false);
        expect(items[1].classList.contains('focused')).toBe(true);
        expect(items[1].getAttribute('aria-selected')).toBe('true');
        expect(Element.prototype.scrollIntoView).toHaveBeenCalled();

        // Simulate ArrowUp
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        expect(items[0].classList.contains('focused')).toBe(true);
        expect(items[1].classList.contains('focused')).toBe(false);

        // Simulate Enter
        // Mock click
        const clickSpy = vi.spyOn(items[0] as HTMLElement, 'click');
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
        expect(clickSpy).toHaveBeenCalled();

        vi.useRealTimers();
    });
});
