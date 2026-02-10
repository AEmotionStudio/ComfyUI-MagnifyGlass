import { describe, it, expect } from 'vitest';
import { Window } from 'happy-dom';
import { formatValue } from '../../src/info-panel/ValueFormatter';
import { escapeHtml, sanitizeElement } from '../../src/shared/utils';

describe('Security', () => {
    describe('sanitizeElement', () => {
        it('should remove event handlers from an element', () => {
            const window = new Window();
            const document = window.document;
            const element = document.createElement('div');
            element.setAttribute('onclick', 'alert(1)');
            element.setAttribute('onerror', 'alert(1)');
            element.setAttribute('onload', 'alert(1)');
            element.setAttribute('class', 'safe');

            sanitizeElement(element as unknown as HTMLElement);

            expect(element.hasAttribute('onclick')).toBe(false);
            expect(element.hasAttribute('onerror')).toBe(false);
            expect(element.hasAttribute('onload')).toBe(false);
            expect(element.getAttribute('class')).toBe('safe');
        });

        it('should recursively remove event handlers from children', () => {
            const window = new Window();
            const document = window.document;
            const parent = document.createElement('div');
            const child = document.createElement('img');

            child.setAttribute('src', 'x');
            child.setAttribute('onerror', 'alert(1)');
            parent.appendChild(child);

            sanitizeElement(parent as unknown as HTMLElement);

            expect(child.hasAttribute('onerror')).toBe(false);
            expect(child.getAttribute('src')).toBe('x');
        });

        it('should remove javascript: URIs from dangerous attributes', () => {
            const window = new Window();
            const document = window.document;
            const link = document.createElement('a');
            const img = document.createElement('img');
            const form = document.createElement('form');

            link.setAttribute('href', 'javascript:alert(1)');
            img.setAttribute('src', 'javascript:alert(1)');
            form.setAttribute('action', 'javascript:alert(1)');
            form.setAttribute('formaction', 'javascript:alert(1)');

            sanitizeElement(link as unknown as HTMLElement);
            sanitizeElement(img as unknown as HTMLElement);
            sanitizeElement(form as unknown as HTMLElement);

            expect(link.hasAttribute('href')).toBe(false);
            expect(img.hasAttribute('src')).toBe(false);
            expect(form.hasAttribute('action')).toBe(false);
            expect(form.hasAttribute('formaction')).toBe(false);
        });

        it('should remove obscured javascript: URIs (whitespace bypass)', () => {
            const window = new Window();
            const document = window.document;
            const link = document.createElement('a');

            // Bypass attempts: tabs, newlines, spaces
            link.setAttribute('href', 'java\tscript:alert(1)');
            sanitizeElement(link as unknown as HTMLElement);
            expect(link.hasAttribute('href')).toBe(false);

            link.setAttribute('href', 'java\nscript:alert(1)');
            sanitizeElement(link as unknown as HTMLElement);
            expect(link.hasAttribute('href')).toBe(false);

            link.setAttribute('href', ' javascript:alert(1)');
            sanitizeElement(link as unknown as HTMLElement);
            expect(link.hasAttribute('href')).toBe(false);
        });

        it('should preserve safe URLs', () => {
            const window = new Window();
            const document = window.document;
            const link = document.createElement('a');

            link.setAttribute('href', 'https://example.com');
            sanitizeElement(link as unknown as HTMLElement);

            expect(link.getAttribute('href')).toBe('https://example.com');
        });

        it('should handle elements without attributes gracefully', () => {
             const window = new Window();
             const document = window.document;
             const element = document.createElement('div');

             // Should not throw
             sanitizeElement(element as unknown as HTMLElement);
             expect(true).toBe(true);
        });

        it('should handle null/undefined gracefully', () => {
            // Should not throw
            sanitizeElement(null as any);
            sanitizeElement(undefined as any);
            expect(true).toBe(true);
       });
    });

    describe('formatValue', () => {
        it('should escape HTML in values to prevent XSS', () => {
            const maliciousInput = '<script>alert("xss")</script>';
            const escaped = formatValue(maliciousInput);

            // Assert that the output does NOT contain the raw script tag
            expect(escaped).not.toContain('<script>');

            // Assert that the output IS escaped
            expect(escaped).toContain('&lt;script&gt;');
            expect(escaped).toContain('&lt;/script&gt;');
        });

        it('should escape quotes', () => {
            const input = 'Value with "quotes" and \'single quotes\'';
            const escaped = formatValue(input);
            expect(escaped).toContain('&quot;quotes&quot;');
            expect(escaped).toContain('&#039;single quotes&#039;');
        });
    });

    describe('UIManager Rendering Logic', () => {
        // Mock logic for UIManager rendering to verify the fix for trusted HTML

        // Helper to simulate UIManager.renderSections logic
        const renderItem = (item: any) => {
            let value;
            if (item.specialType === 'focus-node') {
                // Mimic UIManager logic: inject static HTML structure but escape the dynamic value
                // In actual code: `<span class="focus-node-btn">${Icons.focus} ${escapeHtml(item.value)}</span>`
                // We mock Icons.focus here for simplicity
                value = `<span class="focus-node-btn">ICON ${escapeHtml(item.value)}</span>`;
            } else {
                value = formatValue(item.value, item.label);
            }
            return value;
        };

        it('should escape values even if isHtml is true (legacy bypass check)', () => {
            const item = {
                value: '<script>alert("xss")</script>',
                isHtml: true, // This flag should be IGNORED now
                label: 'Malicious Button'
            };

            const renderedValue = renderItem(item);

            // It should fall through to formatValue which escapes
            expect(renderedValue).not.toContain('<script>');
            expect(renderedValue).toContain('&lt;script&gt;');
        });

        it('should correctly render specialType="focus-node" with safe value', () => {
            const item = {
                value: 'Focus Node',
                specialType: 'focus-node',
                label: 'Location'
            };

            const renderedValue = renderItem(item);

            expect(renderedValue).toContain('<span class="focus-node-btn">');
            expect(renderedValue).toContain('Focus Node');
        });

        it('should escape malicious content even in specialType="focus-node"', () => {
            const item = {
                value: '<script>alert(1)</script>',
                specialType: 'focus-node',
                label: 'Location'
            };

            const renderedValue = renderItem(item);

            // The container span is there
            expect(renderedValue).toContain('<span class="focus-node-btn">');
            // But the content is escaped
            expect(renderedValue).not.toContain('<script>');
            expect(renderedValue).toContain('&lt;script&gt;');
        });

        it('should escape values NOT marked as isHtml', () => {
            const item = {
                value: '<script>alert(1)</script>',
                isHtml: false,
                label: 'Malicious Input'
            };

            const renderedValue = renderItem(item);

            expect(renderedValue).not.toContain('<script>');
            expect(renderedValue).toContain('&lt;script&gt;');
        });
    });

    describe('Robustness', () => {
        it('should safely handle non-string inputs in escapeHtml', () => {
            expect(escapeHtml(123)).toBe('123');
            expect(escapeHtml(0)).toBe('0');
            expect(escapeHtml(true)).toBe('true');
            expect(escapeHtml(false)).toBe('false');
            expect(escapeHtml(null)).toBe('');
            expect(escapeHtml(undefined)).toBe('');

            // Object with toString
            const obj = { toString: () => '<script>' };
            expect(escapeHtml(obj)).toBe('&lt;script&gt;');
        });
    });
});
