/**
 * ComfyUI MagnifyGlass - Logger Utility
 * 
 * Conditional debug logging with environment awareness.
 * Debug logs are only shown when:
 * - localStorage.getItem('magnifyGlass.debug') === 'true'
 * - OR window.magnifyGlassDebug === true
 */

const PREFIX = '[MagnifyGlass]';

/**
 * Check if debug mode is enabled.
 */
function isDebugEnabled(): boolean {
    try {
        return (
            localStorage.getItem('magnifyGlass.debug') === 'true' ||
            (window as unknown as { magnifyGlassDebug?: boolean }).magnifyGlassDebug === true
        );
    } catch {
        return false;
    }
}

/**
 * Logger utility with conditional debug output.
 */
export const Logger = {
    /**
     * Debug log - only shown when debug mode is enabled.
     * Use for verbose development logging.
     */
    debug: (...args: unknown[]): void => {
        if (isDebugEnabled()) {
            console.log(PREFIX, ...args);
        }
    },

    /**
     * Info log - always shown.
     * Use for important initialization messages.
     */
    info: (...args: unknown[]): void => {
        console.log(PREFIX, ...args);
    },

    /**
     * Warning log - always shown.
     * Use for non-critical issues.
     */
    warn: (...args: unknown[]): void => {
        console.warn(PREFIX, ...args);
    },

    /**
     * Error log - always shown.
     * Use for critical errors.
     */
    error: (...args: unknown[]): void => {
        console.error(PREFIX, ...args);
    }
};

/**
 * Enable debug mode programmatically.
 */
export function enableDebug(): void {
    try {
        localStorage.setItem('magnifyGlass.debug', 'true');
        console.log(PREFIX, 'Debug mode enabled');
    } catch {
        (window as unknown as { magnifyGlassDebug?: boolean }).magnifyGlassDebug = true;
    }
}

/**
 * Disable debug mode.
 */
export function disableDebug(): void {
    try {
        localStorage.removeItem('magnifyGlass.debug');
        console.log(PREFIX, 'Debug mode disabled');
    } catch {
        (window as unknown as { magnifyGlassDebug?: boolean }).magnifyGlassDebug = false;
    }
}
