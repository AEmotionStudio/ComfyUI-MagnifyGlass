import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { UIManager } from '../../src/info-panel/UIManager';
import { StateManager } from '../../src/info-panel/StateManager';

const nodes = [
    { id: 1, title: 'KSampler', type: 'KSampler', order: 2 },
    { id: 2, title: 'Load Checkpoint', type: 'CheckpointLoaderSimple', order: 0 },
    { id: 3, title: 'Positive', type: 'CLIPTextEncode', order: 1 },
    { id: 12, title: 'Note', type: 'Note' }
];

(globalThis as any).app = {
    canvas: {
        graph: { _nodes: nodes, getNodeById: (id: number) => nodes.find(n => n.id === id) ?? null },
        centerOnNode: vi.fn()
    }
};

describe('Go to node picker', () => {
    let uiManager: UIManager;
    let stateManager: StateManager;
    let anchor: HTMLButtonElement;

    const picker = () => document.querySelector('.node-selector-dropdown') as HTMLElement | null;
    const filter = () => picker()!.querySelector('input') as HTMLInputElement;
    const items = () => Array.from(picker()!.querySelectorAll('.dropdown-item')) as HTMLElement[];
    const activeItem = () => picker()!.querySelector('.dropdown-item.active') as HTMLElement | null;
    const type = (text: string) => {
        filter().value = text;
        filter().dispatchEvent(new Event('input'));
    };
    const press = (key: string) => {
        const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        filter().dispatchEvent(event);
        return event;
    };

    beforeEach(() => {
        // Keep happy-dom from fetching the panel stylesheet
        document.head.innerHTML = '<style id="magnify-info-panel-styles-v2"></style>';
        stateManager = new StateManager();
        uiManager = new UIManager(stateManager);
        uiManager.onRefresh = vi.fn();
        anchor = uiManager.elements.panel!.querySelector('[data-action="go-to-node"]') as HTMLButtonElement;
        Element.prototype.scrollIntoView = vi.fn();
        (globalThis as any).app.canvas.centerOnNode.mockClear();
    });

    afterEach(() => {
        uiManager.cleanup();
        document.body.innerHTML = '';
        vi.restoreAllMocks();
    });

    it('opens from the header as a combobox over a listbox, on the current node', () => {
        stateManager.state.currentNodeId = 1;
        anchor.click();

        expect(anchor.getAttribute('aria-expanded')).toBe('true');
        expect(document.activeElement).toBe(filter());
        expect(filter().getAttribute('role')).toBe('combobox');
        const list = picker()!.querySelector('[role="listbox"]')!;
        expect(filter().getAttribute('aria-controls')).toBe(list.id);

        // Rows in execution order: exec number, title, type and id
        expect(items().map(item => item.querySelector('.dropdown-item-id')!.textContent)).toEqual(['#2', '#3', '#1', '#12']);
        expect(items()[0].querySelector('.dropdown-item-order')!.textContent).toBe('0');
        expect(items()[0].querySelector('.dropdown-item-type')!.textContent).toBe('CheckpointLoaderSimple');
        expect(items()[3].querySelector('.dropdown-item-order')!.textContent).toBe('');

        expect(activeItem()).toBe(items()[2]);
        expect(items()[2].getAttribute('aria-selected')).toBe('true');
        expect(filter().getAttribute('aria-activedescendant')).toBe(items()[2].id);
    });

    it('filters by title, type or #id', () => {
        anchor.click();

        type('posit');
        expect(items().map(item => item.querySelector('.dropdown-item-title')!.textContent)).toEqual(['Positive']);
        type('checkpointloader');
        expect(items()).toHaveLength(1);
        type('#12');
        expect(items().map(item => item.querySelector('.dropdown-item-title')!.textContent)).toEqual(['Note']);
        expect(activeItem()).toBe(items()[0]);

        type('nothing like it');
        expect(items()).toHaveLength(0);
        expect((picker()!.querySelector('.node-picker-empty') as HTMLElement).hidden).toBe(false);
        expect(filter().hasAttribute('aria-activedescendant')).toBe(false);
        expect(press('Enter').defaultPrevented).toBe(true);
        expect(picker()).not.toBeNull();
    });

    it('escapes node titles', () => {
        nodes.push({ id: 99, title: '<img src=x onerror=alert(1)>', type: 'Evil' });
        try {
            anchor.click();
            type('#99');

            expect(picker()!.querySelector('img')).toBeNull();
            expect(items()[0].textContent).toContain('<img src=x onerror=alert(1)>');
        } finally {
            nodes.pop();
        }
    });

    it('moves with the arrows and jumps with Enter: centre, lock, focus back', () => {
        anchor.click();
        expect(activeItem()).toBe(items()[0]);

        press('ArrowDown');
        press('ArrowDown');
        press('ArrowDown');
        press('ArrowDown'); // stays on the last
        expect(activeItem()).toBe(items()[3]);
        press('ArrowUp');
        expect(filter().getAttribute('aria-activedescendant')).toBe(items()[2].id);

        // Hovering moves the item Enter picks
        items()[1].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        expect(activeItem()).toBe(items()[1]);

        const event = press('Enter');
        expect(event.defaultPrevented).toBe(true);
        expect(picker()).toBeNull();
        expect(document.activeElement).toBe(anchor);
        expect(anchor.getAttribute('aria-expanded')).toBe('false');
        expect((globalThis as any).app.canvas.centerOnNode).toHaveBeenCalledWith(nodes[2]);
        expect(stateManager.state.lockedNodeId).toBe(3);
        expect(uiManager.onRefresh).toHaveBeenCalledTimes(1);
    });

    it('picks with a click', () => {
        anchor.click();
        items()[3].click();

        expect(picker()).toBeNull();
        expect(stateManager.state.lockedNodeId).toBe(12);
    });

    it('Escape closes it, returns focus and stays out of other listeners', () => {
        anchor.click();
        const later = vi.fn();
        window.addEventListener('keydown', later);

        press('Escape');

        expect(picker()).toBeNull();
        expect(document.activeElement).toBe(anchor);
        expect(later).not.toHaveBeenCalled();
        expect(stateManager.state.lockedNodeId).toBeNull();
        window.removeEventListener('keydown', later);
    });

    it('closes on a press outside, on the button again, and removes its listener', () => {
        const docRemove = vi.spyOn(document, 'removeEventListener');
        anchor.click();

        picker()!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(picker()).not.toBeNull();
        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        expect(picker()).toBeNull();
        expect(docRemove).toHaveBeenCalledWith('pointerdown', expect.any(Function), true);

        anchor.click();
        anchor.click();
        expect(picker()).toBeNull();
        expect(anchor.getAttribute('aria-expanded')).toBe('false');
    });

    it('closes when focus moves elsewhere', () => {
        anchor.click();
        const other = document.createElement('button');
        document.body.appendChild(other);

        other.focus();

        expect(picker()).toBeNull();
    });
});

describe('Inspector header', () => {
    it('is built before window.app exists, as the panel mounts during extension setup', () => {
        const saved = (globalThis as any).app;
        delete (globalThis as any).app;
        try {
            document.head.innerHTML = '<style id="magnify-info-panel-styles-v2"></style>';
            const ui = new UIManager(new StateManager());

            expect(ui.elements.panel!.querySelector('.header-title')!.textContent).toBe('Inspector');
            expect((ui.elements.panel!.querySelector('[data-action="back"]') as HTMLButtonElement).disabled).toBe(true);
            ui.cleanup();
        } finally {
            (globalThis as any).app = saved;
        }
    });
});
