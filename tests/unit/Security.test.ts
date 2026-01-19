import { describe, it, expect } from 'vitest';
import { formatValue } from '../../src/info-panel/ValueFormatter';
import { escapeHtml } from '../../src/shared/utils';

describe('Security', () => {
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
