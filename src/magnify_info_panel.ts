/**
 * ComfyUI Magnify Info Panel - Main Entry Point
 * 
 * Initializes the Info Panel extension.
 */

import { InfoPanel } from './info-panel';
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
        console.error("ComfyUI Magnify Info Panel: Failed to find MagnifyGlass instance.");
        return;
    }

    try {
        // Initialize the info panel
        const infoPanel = new InfoPanel(magnifyGlass);

        // Expose orchestrator globally if needed
        window.infoPanelManager = infoPanel as any;

        // CSS is loaded by UIManager.injectStyles() - no need to load separately

        console.log("ComfyUI Magnify Info Panel: Extension initialized");
    } catch (e) {
        console.error("ComfyUI Magnify Info Panel: Error during initialization:", e);
    }
}

