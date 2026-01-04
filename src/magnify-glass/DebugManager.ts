/**
 * ComfyUI MagnifyGlass - DebugManager (TypeScript)
 * 
 * Handles debug visualization and logging.
 */

import type { ComfyApp } from '../types/comfyui';
import type { ConfigManager } from './ConfigManager';
import type { MagnifierState } from './MagnifierState';
import type { UiManager } from './UiManager';

declare const app: ComfyApp;

/**
 * Debug Manager class.
 * Provides debug logging and canvas visualization.
 */
export class DebugManager {
    config: ConfigManager;
    state: MagnifierState;
    ui: UiManager;

    constructor(config: ConfigManager, state: MagnifierState, ui: UiManager) {
        this.config = config;
        this.state = state;
        this.ui = ui;
    }

    /**
     * Log a message if debug mode is enabled.
     */
    log(...args: unknown[]): void {
        // Debug logging disabled by default
        // console.log("ComfyUI Magnifying Glass:", ...args);
    }

    /**
     * Log an error message.
     */
    error(...args: unknown[]): void {
        console.error("ComfyUI Magnifying Glass ERROR:", ...args);
    }
}
