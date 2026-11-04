/**
 * ComfyUI MagnifyGlass - Value Formatter Utilities
 *
 * Pure utility functions for formatting values in the info panel display.
 */

/**
 * Format widget value for display, with the widget's own precision for numbers.
 * Arrays and objects show as JSON.
 */
export function formatWidgetValue(value: unknown, precision?: number): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'number') {
        return precision === undefined ? String(value) : value.toFixed(precision);
    }
    if (typeof value === 'object') {
        try {
            return JSON.stringify(value, null, 2);
        } catch {
            // Circular values from custom widgets
            return Array.isArray(value) ? `Array(${value.length})` : 'Object';
        }
    }
    return String(value);
}

/**
 * Values this long are clamped to a few lines with an expand toggle.
 */
export function isLongText(text: string): boolean {
    return text.length > 200 || text.split('\n').length > 4;
}
