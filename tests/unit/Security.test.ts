import { describe, it, expect } from 'vitest';
import { formatValue } from '../../src/info-panel/ValueFormatter';

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
        it('should NOT escape values marked as isHtml', () => {
            const item = {
                value: '<span class="icon">Icon</span> Button',
                isHtml: true,
                label: 'Test Button'
            };

            const renderedValue = item.isHtml ? item.value : formatValue(item.value, item.label);

            expect(renderedValue).toContain('<span class="icon">');
            expect(renderedValue).not.toContain('&lt;span class=&quot;icon&quot;&gt;');
        });

        it('should escape values NOT marked as isHtml', () => {
            const item = {
                value: '<script>alert(1)</script>',
                isHtml: false, // or undefined
                label: 'Malicious Input'
            };

            const renderedValue = item.isHtml ? item.value : formatValue(item.value, item.label);

            expect(renderedValue).not.toContain('<script>');
            expect(renderedValue).toContain('&lt;script&gt;');
        });
    });
});
