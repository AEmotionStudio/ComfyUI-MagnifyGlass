import { describe, it, expect, vi } from 'vitest';
import { createToggle, createSlider, createSelect, createColorPicker } from '../../src/sidebar/SidebarSettings';

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

    describe('createSlider', () => {
        it('should create an accessible slider', () => {
            const onChange = vi.fn();
            const sliderRow = createSlider('Test Slider', 50, 0, 100, 1, '%', onChange);

            const labelEl = sliderRow.querySelector('label') as HTMLElement;
            const input = sliderRow.querySelector('input[type="range"]') as HTMLInputElement;

            expect(input).toBeTruthy();
            expect(input.id).toBeTruthy();
            expect(labelEl.getAttribute('for')).toBe(input.id);
            expect(input.id).toMatch(/^magnify-slider-/);
        });
    });

    describe('createSelect', () => {
        it('should create an accessible select', () => {
            const onChange = vi.fn();
            const selectRow = createSelect('Test Select', 'Option 1', ['Option 1', 'Option 2'], onChange);

            const labelEl = selectRow.querySelector('label') as HTMLElement;
            const select = selectRow.querySelector('select') as HTMLSelectElement;

            expect(select).toBeTruthy();
            expect(select.id).toBeTruthy();
            expect(labelEl.getAttribute('for')).toBe(select.id);
            expect(select.id).toMatch(/^magnify-select-/);
        });
    });

    describe('createColorPicker', () => {
        it('should create an accessible color picker', () => {
            const onChange = vi.fn();
            const colorRow = createColorPicker('Test Color', '#000000', onChange);

            const labelEl = colorRow.querySelector('label') as HTMLElement;
            const input = colorRow.querySelector('input[type="color"]') as HTMLInputElement;

            expect(input).toBeTruthy();
            expect(input.id).toBeTruthy();
            expect(labelEl.getAttribute('for')).toBe(input.id);
            expect(input.id).toMatch(/^magnify-color-/);
        });

        it('should sync text input with color picker', () => {
            const onChange = vi.fn();
            const colorRow = createColorPicker('Test Color', '#000000', onChange);

            const colorInput = colorRow.querySelector('input[type="color"]') as HTMLInputElement;
            const textInput = colorRow.querySelector('input.magnify-color-preview') as HTMLInputElement;

            expect(textInput).toBeTruthy();
            expect(textInput.value).toBe('#000000');

            // Simulate typing a valid hex code
            textInput.value = '#ffffff';
            textInput.dispatchEvent(new Event('change'));

            expect(colorInput.value).toBe('#ffffff');
            expect(onChange).toHaveBeenCalledWith('#ffffff');

            // Simulate typing a hex code without hash
            textInput.value = 'ff0000';
            textInput.dispatchEvent(new Event('change'));

            expect(textInput.value).toBe('#ff0000'); // Should normalize
            expect(colorInput.value).toBe('#ff0000');
            expect(onChange).toHaveBeenCalledWith('#ff0000');

            // Simulate typing invalid hex code
            textInput.value = 'invalid';
            textInput.dispatchEvent(new Event('change'));

            // Should not update color input (keeps previous value)
            expect(colorInput.value).toBe('#ff0000');

            // Simulate blur with invalid code -> should revert
            textInput.dispatchEvent(new Event('blur'));
            expect(textInput.value).toBe('#ff0000');
        });

        it('should stop keydown propagation on text input', () => {
            const onChange = vi.fn();
            const colorRow = createColorPicker('Test Color', '#000000', onChange);
            const textInput = colorRow.querySelector('input.magnify-color-preview') as HTMLInputElement;

            const event = new KeyboardEvent('keydown', { key: 'a' });
            const stopPropagationSpy = vi.spyOn(event, 'stopPropagation');

            textInput.dispatchEvent(event);

            expect(stopPropagationSpy).toHaveBeenCalled();
        });
    });
});
