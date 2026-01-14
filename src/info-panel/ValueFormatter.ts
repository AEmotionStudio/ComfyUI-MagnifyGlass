/**
 * ComfyUI MagnifyGlass - Value Formatter Utilities
 * 
 * Pure utility functions for formatting values in the info panel display.
 * Extracted from UIManager.ts for better modularity.
 */

import { escapeHtml } from '../shared/utils';

/**
 * Format a value for display in the info panel.
 * @param value - The value to format
 * @param label - Optional label to determine formatting rules
 * @returns Formatted string representation
 */
export function formatValue(value: unknown, label?: string): string {
    if (value === null || value === undefined) return '';

    const str = String(value);

    // Show full text for prompts, text content, model names, and file paths
    if (label && (
        label.toLowerCase().includes('text') ||
        label.toLowerCase().includes('prompt') ||
        label.toLowerCase().includes('model') ||
        label.toLowerCase().includes('file') ||
        label.toLowerCase().includes('conditioning') ||
        label.toLowerCase().includes('positive') ||
        label.toLowerCase().includes('negative')
    )) {
        return escapeHtml(str);
    }

    // Show full text for very long values (no truncation)
    return escapeHtml(str);
}

/**
 * Get CSS class names for styling a value.
 * @param value - The value to get classes for
 * @returns CSS class string
 */
export function getValueClass(value: unknown): string {
    if (!value) return '';

    const str = String(value);
    const classes: string[] = [];

    // Mark text that might benefit from special styling for readability
    if (str.length > 100) {
        classes.push('long-text');
    }

    return classes.join(' ');
}

/**
 * Get HTML attributes for a value element.
 * @param value - The value to get attributes for
 * @returns HTML attribute string
 */
export function getValueAttributes(value: unknown): string {
    // Since we show full text now, we don't need title attributes for long text
    // Only add title for very long text that might benefit from tooltips
    if (!value) return '';

    const str = String(value);
    if (str.length > 500) { // Only for extremely long text
        return `title="${escapeHtml(str)}"`;
    }

    return '';
}

/**
 * Format widget value for display.
 * @param value - Widget value to format
 * @returns Formatted string representation
 */
export function formatWidgetValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') {
        return value; // Show full text without truncation
    }
    if (typeof value === 'number') {
        return Number.isInteger(value) ? value.toString() : value.toFixed(3);
    }
    if (typeof value === 'boolean') return value.toString();
    if (Array.isArray(value)) {
        return `Array(${value.length})`;
    }
    if (typeof value === 'object') {
        return 'Object';
    }
    return String(value);
}
