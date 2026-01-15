import { describe, it, expect, vi } from 'vitest';
import { createToggle } from '../../src/sidebar/SidebarSettings';

describe('Sidebar Controls', () => {
    describe('createToggle', () => {
        it('should create an accessible toggle switch', () => {
            const onChange = vi.fn();
            const label = 'Test Toggle';
            const toggleRow = createToggle(label, false, onChange);

            const toggle = toggleRow.querySelector('.magnify-toggle') as HTMLElement;
            const labelEl = toggleRow.querySelector('label') as HTMLElement;

            // Check role
            expect(toggle.getAttribute('role')).toBe('switch');

            // Check checked state
            expect(toggle.getAttribute('aria-checked')).toBe('false');

            // Check tabindex
            expect(toggle.tabIndex).toBe(0);

            // Check label association
            const toggleId = toggle.id;
            const labelId = labelEl.id;
            expect(toggleId).toBeTruthy();
            expect(labelId).toBeTruthy();
            expect(toggle.getAttribute('aria-labelledby')).toBe(labelId);
        });

        it('should toggle state on click', () => {
            const onChange = vi.fn();
            const toggleRow = createToggle('Test', false, onChange);
            const toggle = toggleRow.querySelector('.magnify-toggle') as HTMLElement;

            toggle.click();

            expect(toggle.classList.contains('active')).toBe(true);
            expect(toggle.getAttribute('aria-checked')).toBe('true');
            expect(onChange).toHaveBeenCalledWith(true);

            toggle.click();

            expect(toggle.classList.contains('active')).toBe(false);
            expect(toggle.getAttribute('aria-checked')).toBe('false');
            expect(onChange).toHaveBeenCalledWith(false);
        });

        it('should toggle state when clicking label', () => {
            const onChange = vi.fn();
            const toggleRow = createToggle('Test', false, onChange);
            const labelEl = toggleRow.querySelector('label') as HTMLElement;
            const toggle = toggleRow.querySelector('.magnify-toggle') as HTMLElement;

            labelEl.click();

            expect(toggle.classList.contains('active')).toBe(true);
            expect(toggle.getAttribute('aria-checked')).toBe('true');
            expect(onChange).toHaveBeenCalledWith(true);
        });

        it('should toggle state and stop propagation on Enter key', () => {
            const onChange = vi.fn();
            const toggleRow = createToggle('Test', false, onChange);
            const toggle = toggleRow.querySelector('.magnify-toggle') as HTMLElement;

            // Create keyboard event with spies
            const event = new KeyboardEvent('keydown', { key: 'Enter' });
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
            const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

            toggle.dispatchEvent(event);

            expect(toggle.classList.contains('active')).toBe(true);
            expect(toggle.getAttribute('aria-checked')).toBe('true');
            expect(onChange).toHaveBeenCalledWith(true);
            expect(preventDefaultSpy).toHaveBeenCalled();
            expect(stopPropagationSpy).toHaveBeenCalled();
        });

        it('should toggle state and stop propagation on Space key', () => {
            const onChange = vi.fn();
            const toggleRow = createToggle('Test', false, onChange);
            const toggle = toggleRow.querySelector('.magnify-toggle') as HTMLElement;

            // Create keyboard event with spies
            const event = new KeyboardEvent('keydown', { key: ' ' });
            const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
            const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

            toggle.dispatchEvent(event);

            expect(toggle.classList.contains('active')).toBe(true);
            expect(toggle.getAttribute('aria-checked')).toBe('true');
            expect(onChange).toHaveBeenCalledWith(true);
            expect(preventDefaultSpy).toHaveBeenCalled();
            expect(stopPropagationSpy).toHaveBeenCalled();
        });
    });
});
