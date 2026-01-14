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
});
