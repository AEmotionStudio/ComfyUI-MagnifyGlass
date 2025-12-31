/**
 * ComfyUI MagnifyGlass - Shared Utilities
 * 
 * Common utility functions shared between magnify glass and info panel modules.
 */

import { app } from "../../../../scripts/app.js";

/**
 * Safely get a setting value from ComfyUI settings with fallback to default.
 * @param {string} key - The setting key
 * @param {*} defaultValue - Default value if setting not found
 * @returns {*} The setting value or default
 */
export function getSettingValue(key, defaultValue) {
    try {
        const value = app.ui.settings.getSettingValue(key);
        return value === undefined ? defaultValue : value;
    } catch (e) {
        console.warn(`ComfyUI Magnifying Glass: Could not get setting ${key}, using default ${defaultValue}. Error: ${e}`);
        return defaultValue;
    }
}

/**
 * Check if the user is currently typing in an input field.
 * Used for smart input detection to avoid triggering hotkeys while typing.
 * @returns {boolean} True if user is typing in an input field
 */
export function isUserTyping() {
    const activeElement = document.activeElement;
    if (!activeElement) return false;

    // Check if the active element is an input, textarea, or contenteditable
    const tagName = activeElement.tagName.toLowerCase();
    if (tagName === 'input' || tagName === 'textarea') {
        return true;
    }

    // Check for contenteditable elements
    if (activeElement.contentEditable === 'true') {
        return true;
    }

    // Check if it's inside a form or has input-like classes
    if (activeElement.closest('form') ||
        activeElement.classList.contains('cm-editor') || // CodeMirror editor
        activeElement.classList.contains('monaco-editor') || // Monaco editor
        activeElement.closest('.cm-editor') ||
        activeElement.closest('.monaco-editor')) {
        return true;
    }

    return false;
}

/**
 * Check if two rectangles overlap.
 * @param {{x: number, y: number, width: number, height: number}} rect1 
 * @param {{x: number, y: number, width: number, height: number}} rect2 
 * @returns {boolean} True if rectangles overlap
 */
export function rectsOverlap(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y;
}

/**
 * Find the LiteGraph canvas element in the DOM.
 * Tries multiple selectors for compatibility with different ComfyUI versions.
 * @returns {HTMLCanvasElement|null} The canvas element or null if not found
 */
export function findLiteGraphCanvas() {
    return document.getElementById("graph-canvas") ||
        document.querySelector("canvas.graphcanvas") ||
        app.canvas_manager?.container?.querySelector("canvas") ||
        (app.canvas && app.canvas.graph_canvas ? app.canvas.graph_canvas : null);
}

/**
 * Normalize a color value to include the # symbol for CSS.
 * @param {string} color - The color value (with or without #)
 * @returns {string} The normalized color with # prefix
 */
export function normalizeColor(color) {
    if (!color) return color;
    return color.startsWith('#') ? color : `#${color}`;
}

/**
 * Clamp a value between min and max bounds.
 * @param {number} value - The value to clamp
 * @param {number} min - Minimum bound
 * @param {number} max - Maximum bound
 * @returns {number} The clamped value
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Create a debug logger that only logs when debug mode is enabled.
 * @param {string} prefix - Prefix for log messages
 * @param {function} isDebugEnabled - Function that returns whether debug is enabled
 * @returns {{log: function, error: function}} Logger object
 */
export function createDebugLogger(prefix, isDebugEnabled) {
    return {
        log(...args) {
            if (isDebugEnabled()) {
                console.log(`${prefix}:`, ...args);
            }
        },
        error(...args) {
            console.error(`${prefix} ERROR:`, ...args);
        }
    };
}
