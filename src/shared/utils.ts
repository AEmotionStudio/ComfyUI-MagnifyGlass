/**
 * ComfyUI MagnifyGlass - Shared Utilities
 * 
 * Common utility functions shared between magnify glass and info panel modules.
 */

import type { ComfyApp } from '../types/comfyui';

// Reference to ComfyUI's app - will be set at runtime
// @ts-ignore
import { app } from "/scripts/app.js";

/**
 * Rectangle interface for overlap calculations
 */
export interface Rectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Debug logger interface
 */
export interface DebugLogger {
    log(...args: unknown[]): void;
    error(...args: unknown[]): void;
}

/**
 * Safely get a setting value from ComfyUI settings with fallback to default.
 * @param key - The setting key
 * @param defaultValue - Default value if setting not found
 * @returns The setting value or default
 */
export function getSettingValue<T>(key: string, defaultValue: T): T {
    try {
        const value = app.ui.settings.getSettingValue(key);
        return value === undefined ? defaultValue : value as T;
    } catch (e) {
        console.warn(`ComfyUI Magnifying Glass: Could not get setting ${key}, using default ${defaultValue}. Error: ${e}`);
        return defaultValue;
    }
}

/**
 * Check if the user is currently typing in an input field.
 * Used for smart input detection to avoid triggering hotkeys while typing.
 * @returns True if user is typing in an input field
 */
export function isUserTyping(): boolean {
    const activeElement = document.activeElement as HTMLElement | null;
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
 * @param rect1 - First rectangle
 * @param rect2 - Second rectangle
 * @returns True if rectangles overlap
 */
export function rectsOverlap(rect1: Rectangle, rect2: Rectangle): boolean {
    return rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y;
}

/**
 * Find the LiteGraph canvas element in the DOM.
 * Tries multiple selectors for compatibility with different ComfyUI versions.
 * @returns The canvas element or null if not found
 */
export function findLiteGraphCanvas(): HTMLCanvasElement | null {
    // Try multiple selectors for compatibility
    const canvas = document.getElementById("graph-canvas") as HTMLCanvasElement | null;
    if (canvas) return canvas;

    const graphCanvas = document.querySelector("canvas.graphcanvas") as HTMLCanvasElement | null;
    if (graphCanvas) return graphCanvas;

    // Try canvas manager (dynamic access for ComfyUI compatibility)
    const appAny = app as any;
    if (appAny?.canvas_manager?.container) {
        const managerCanvas = appAny.canvas_manager.container.querySelector("canvas") as HTMLCanvasElement | null;
        if (managerCanvas) return managerCanvas;
    }

    // Try direct canvas reference
    if (appAny?.canvas?.graph_canvas) {
        return appAny.canvas.graph_canvas;
    }

    return null;
}

/**
 * Normalize a color value to include the # symbol for CSS.
 * @param color - The color value (with or without #)
 * @returns The normalized color with # prefix
 */
export function normalizeColor(color: string | null | undefined): string {
    if (!color) return color ?? '';
    return color.startsWith('#') ? color : `#${color}`;
}

/**
 * Clamp a value between min and max bounds.
 * @param value - The value to clamp
 * @param min - Minimum bound
 * @param max - Maximum bound
 * @returns The clamped value
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * Create a debug logger that only logs when debug mode is enabled.
 * @param prefix - Prefix for log messages
 * @param isDebugEnabled - Function that returns whether debug is enabled
 * @returns Logger object
 */
export function createDebugLogger(
    prefix: string,
    isDebugEnabled: () => boolean
): DebugLogger {
    return {
        log(...args: unknown[]): void {
            if (isDebugEnabled()) {
                console.log(`${prefix}:`, ...args);
            }
        },
        error(...args: unknown[]): void {
            console.error(`${prefix} ERROR:`, ...args);
        }
    };
}

/**
 * Escapes HTML special characters in a string to prevent XSS.
 * @param str - The string to escape
 * @returns Escaped string
 */
export function escapeHtml(str: unknown): string {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
