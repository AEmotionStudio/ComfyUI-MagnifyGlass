/**
 * ComfyUI Magnify Glass - Main Entry Point
 * 
 * Initializes the Magnify Glass extension.
 */

import { MagnifyGlass } from './magnify-glass';
import { Logger } from './shared/logger';
// @ts-ignore
import { app } from "/scripts/app.js";

// Global declaration handled in comfyui.d.ts

// We rely on the global 'app' object provided by ComfyUI
// Register extension
app.registerExtension({
    name: "comfyui.magnify.glass",
    init() {
        // Initialize the magnify glass
        const magnifyGlass = new MagnifyGlass();
        magnifyGlass.init();

        // Expose to window for other extensions (like info panel) to access
        window.comfyUIMagnifyGlass = magnifyGlass;

        Logger.info('Magnify Glass extension initialized');
    }
});
