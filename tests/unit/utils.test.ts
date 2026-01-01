import { describe, it, expect } from 'vitest';
import { clamp, normalizeColor } from '../../src/shared/utils';

describe('Shared Utilities', () => {
    describe('clamp', () => {
        it('should clamp value within range', () => {
            expect(clamp(150, 0, 100)).toBe(100);
            expect(clamp(-50, 0, 100)).toBe(0);
            expect(clamp(50, 0, 100)).toBe(50);
        });
    });

    describe('normalizeColor', () => {
        it('should add # prefix if missing', () => {
            expect(normalizeColor('ffffff')).toBe('#ffffff');
            expect(normalizeColor('000')).toBe('#000');
        });

        it('should keep # prefix if present', () => {
            expect(normalizeColor('#ff0000')).toBe('#ff0000');
        });

        it('should handle falsy values', () => {
            expect(normalizeColor('')).toBe('');
            // @ts-ignore
            expect(normalizeColor(null)).toBe(null);
        });
    });
});
