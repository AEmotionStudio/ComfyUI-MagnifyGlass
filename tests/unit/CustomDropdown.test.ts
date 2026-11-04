/**
 * Shared dropdown: open/close lifecycle, filter, hover and keyboard navigation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CustomDropdown, createDropdownTrigger } from '../../src/shared/CustomDropdown';
import { InlineControlFactory } from '../../src/info-panel/widget-editors/InlineControlFactory';
import { WidgetSyncManager } from '../../src/info-panel/widget-editors/WidgetSyncManager';

const press = (key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    (document.activeElement ?? document.body).dispatchEvent(event);
    return event;
};
const menus = () => document.querySelectorAll('.custom-dropdown-menu');
const items = () => [...document.querySelectorAll<HTMLElement>('.custom-dropdown-item')];
const visible = () => items().filter(item => !item.hidden).map(item => item.textContent);
const active = () => document.querySelector('.custom-dropdown-item.active')?.textContent;

describe('CustomDropdown', () => {
    let anchor: HTMLElement;
    let onChange: ReturnType<typeof vi.fn>;
    let onClose: ReturnType<typeof vi.fn>;
    let dropdown: CustomDropdown;

    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '';
        anchor = createDropdownTrigger('euler');
        document.body.appendChild(anchor);
        onChange = vi.fn();
        onClose = vi.fn();
        dropdown = new CustomDropdown({
            options: ['euler', 'euler_ancestral', 'dpmpp_2m', 'ddim'],
            currentValue: 'euler',
            anchor,
            onChange,
            onClose
        });
    });

    afterEach(() => {
        dropdown.hide();
        vi.useRealTimers();
    });

    it('show() does not fire onClose, hide() fires it once', () => {
        dropdown.show();
        dropdown.show();

        expect(onClose).not.toHaveBeenCalled();
        expect(menus()).toHaveLength(1);

        dropdown.hide();
        dropdown.hide();

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(menus()).toHaveLength(0);
    });

    it('closing before the listeners attach leaves none behind', () => {
        const add = vi.spyOn(window, 'addEventListener');
        dropdown.show();
        dropdown.hide();
        vi.advanceTimersByTime(100);

        expect(add).not.toHaveBeenCalledWith('keydown', expect.any(Function), true);
    });

    it('has listbox roles and tracks the active option', () => {
        dropdown.show();
        const filter = document.querySelector('.custom-dropdown-filter') as HTMLInputElement;
        const list = document.querySelector('.custom-dropdown-list')!;

        expect(document.activeElement).toBe(filter);
        expect(anchor.getAttribute('aria-expanded')).toBe('true');
        expect(list.getAttribute('role')).toBe('listbox');
        expect(filter.getAttribute('aria-controls')).toBe(list.id);
        expect(items().map(item => item.getAttribute('role'))).toEqual(['option', 'option', 'option', 'option']);
        expect(items().map(item => item.getAttribute('aria-selected'))).toEqual(['true', 'false', 'false', 'false']);
        expect(filter.getAttribute('aria-activedescendant')).toBe(items()[0].id);

        dropdown.hide();
        expect(anchor.getAttribute('aria-expanded')).toBe('false');
    });

    it('hover moves the item that Enter picks', () => {
        dropdown.show();
        vi.advanceTimersByTime(100);

        items()[2].dispatchEvent(new MouseEvent('mouseenter'));
        expect(active()).toBe('dpmpp_2m');
        press('ArrowDown');
        expect(active()).toBe('ddim');
        press('ArrowUp');
        press('ArrowUp');
        expect(active()).toBe('euler_ancestral');

        expect(press('Enter').defaultPrevented).toBe(true);
        expect(onChange).toHaveBeenCalledWith('euler_ancestral');
        expect(menus()).toHaveLength(0);
        expect(document.activeElement).toBe(anchor);
    });

    it('typing filters the options and Enter picks the first match', () => {
        dropdown.show();
        vi.advanceTimersByTime(100);
        const filter = document.activeElement as HTMLInputElement;

        filter.value = 'EUL';
        filter.dispatchEvent(new Event('input'));
        expect(visible()).toEqual(['euler', 'euler_ancestral']);
        press('ArrowDown');
        press('ArrowDown');
        expect(active()).toBe('euler_ancestral');

        filter.value = 'dd';
        filter.dispatchEvent(new Event('input'));
        expect(visible()).toEqual(['ddim']);
        expect(active()).toBe('ddim');

        press('Enter');
        expect(onChange).toHaveBeenCalledWith('ddim');
    });

    it('Enter with no match keeps the menu open', () => {
        dropdown.show();
        vi.advanceTimersByTime(100);
        const filter = document.activeElement as HTMLInputElement;

        filter.value = 'zzz';
        filter.dispatchEvent(new Event('input'));
        press('Enter');

        expect(onChange).not.toHaveBeenCalled();
        expect(menus()).toHaveLength(1);
        expect(filter.hasAttribute('aria-activedescendant')).toBe(false);
    });

    it('Tab closes without a change and leaves focus on the trigger to move on from', () => {
        dropdown.show();
        vi.advanceTimersByTime(60);
        press('ArrowDown');

        const tab = press('Tab');

        expect(tab.defaultPrevented).toBe(false);
        expect(menus()).toHaveLength(0);
        expect(onChange).not.toHaveBeenCalled();
        expect(document.activeElement).toBe(anchor);
        expect(press('Enter').defaultPrevented).toBe(false);
    });

    it('Escape closes without a change', () => {
        dropdown.show();
        vi.advanceTimersByTime(100);

        press('Escape');

        expect(onChange).not.toHaveBeenCalled();
        expect(onClose).toHaveBeenCalledTimes(1);
        expect(menus()).toHaveLength(0);
    });
});

describe('inline combo control', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        document.body.innerHTML = '';
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('destroy() closes an open menu, so it cannot write after a re-render', () => {
        const sync = vi.spyOn(WidgetSyncManager, 'syncWidgetValue');
        const control = InlineControlFactory.createControl({
            nodeId: 1, widgetName: 'sampler_name', widgetType: 'combo', currentValue: 'euler',
            constraints: { options: ['euler', 'ddim'] }
        })!;
        document.body.appendChild(control.element);
        const trigger = control.element.querySelector('.inline-dropdown-trigger') as HTMLElement;

        trigger.click();
        expect(menus()).toHaveLength(1);
        expect(trigger.style.background).toBe('');

        control.destroy();
        vi.advanceTimersByTime(100);

        expect(menus()).toHaveLength(0);
        press('Enter');
        expect(sync).not.toHaveBeenCalled();
    });

    it('clicking the trigger again closes the menu', () => {
        const control = InlineControlFactory.createControl({
            nodeId: 1, widgetName: 'sampler_name', widgetType: 'combo', currentValue: 'euler',
            constraints: { options: ['euler', 'ddim'] }
        })!;
        document.body.appendChild(control.element);
        const trigger = control.element.querySelector('.inline-dropdown-trigger') as HTMLElement;

        trigger.click();
        trigger.click();
        expect(menus()).toHaveLength(0);
        trigger.click();
        expect(menus()).toHaveLength(1);

        control.destroy();
    });
});
