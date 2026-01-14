/**
 * ComfyUI Magnify Glass - Main Entry Point
 * 
 * Initializes the Magnify Glass extension.
 */

import { MagnifyGlass } from './magnify-glass';
import { Logger } from './shared/logger';
import { initSidebar } from './sidebar';
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

        // Expose to window for other extensions (like info panel) to access
        // Must be done BEFORE init() because init() creates UI which accesses this global
        window.comfyUIMagnifyGlass = magnifyGlass;

        magnifyGlass.init();

        // Initialize sidebar
        initSidebar();

        Logger.debug('Magnify Glass extension initialized');
    }
});
