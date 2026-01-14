/**
 * ComfyUI Magnify Info Panel - Main Entry Point
 * 
 * Initializes the Info Panel extension.
 */

import { InfoPanel } from './info-panel';
import { Logger } from './shared/logger';
// @ts-ignore
import { app } from "/scripts/app.js";

// We rely on the global 'app' object provided by ComfyUI
// No need to import it as it's global, but TypeScript needs to know about it.
// We handled this in types/comfyui.d.ts

app.registerExtension({
    name: "comfyui.magnify.info.panel",
    init() {
        // Wait for magnify glass to be available
        const checkDependencies = () => {
            if (window.comfyUIMagnifyGlass) {
                initializeInfoPanel();
            } else {
                setTimeout(checkDependencies, 100);
            }
        };

        checkDependencies();
    }
});

function initializeInfoPanel() {
    const magnifyGlass = window.comfyUIMagnifyGlass;
    if (!magnifyGlass) {
        Logger.error('Failed to find MagnifyGlass instance.');
        return;
    }

    try {
        // Initialize the info panel
        const infoPanel = new InfoPanel(magnifyGlass);

        // Expose orchestrator globally if needed
        window.infoPanelManager = infoPanel as any;

        // Register as extension for central management (e.g. force hide on toggle)
        if (!window.comfyUIMagnifyGlassExtensions) {
            window.comfyUIMagnifyGlassExtensions = [];
        }
        window.comfyUIMagnifyGlassExtensions.push(infoPanel);

        // CSS is loaded by UIManager.injectStyles() - no need to load separately

        Logger.debug('Info Panel extension initialized');
    } catch (e) {
        Logger.error('Error during initialization:', e);
    }
}

