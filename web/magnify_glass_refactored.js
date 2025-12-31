/**
 * ComfyUI Magnifying Glass - Entry Point (Refactored)
 * 
 * This script adds a magnifying glass feature to ComfyUI.
 * Press X to activate the magnifying glass and see a zoomed view of the canvas.
 * 
 * This file has been refactored to use modular ES6 imports.
 * The actual implementation is split across the magnify-glass/ directory.
 */

import { app } from "../../../scripts/app.js";
import { MagnifyGlass } from './magnify-glass/MagnifyGlass.js';
import { registerGlassSettings, DEFAULT_GLASS_SETTINGS } from './shared/settings.js';

app.registerExtension({
    name: "comfyui.magnify.glass",
    async setup() {
        // Instantiate the main magnify glass
        const magnifyGlass = new MagnifyGlass();

        // Register settings with ComfyUI
        registerGlassSettings(magnifyGlass);

        // Load settings into the config object
        magnifyGlass.config.loadSettings();

        // Initialize the magnifier
        magnifyGlass.init();

        // Apply UI changes
        magnifyGlass.applyUiChanges();

        // Expose magnifyGlass globally for extensions
        window.comfyUIMagnifyGlass = magnifyGlass;

        // Diagnostic Info
        console.log("---- Enhanced Magnifier Diagnostic Info ----");
        console.log("User Agent:", navigator.userAgent);
        console.log("Device Pixel Ratio:", window.devicePixelRatio);

        if (typeof app !== 'undefined' && app.canvas && app.canvas.ds) {
            console.log("ComfyUI Canvas Scale:", app.canvas.ds.scale);
            console.log("ComfyUI Canvas Offset:", app.canvas.ds.offset);
        } else {
            console.log("ComfyUI Canvas State: Could not access app.canvas.ds");
        }

        try {
            const offsetX = localStorage.getItem('comfyui_magnify_offset_x') || 'Not Set (Will be 0)';
            const offsetY = localStorage.getItem('comfyui_magnify_offset_y') || 'Not Set (Will be 0)';
            console.log("Stored Manual Offset X:", offsetX);
            console.log("Stored Manual Offset Y:", offsetY);
        } catch (e) {
            console.error("Error reading offsets from localStorage:", e);
        }
        console.log("---- End Diagnostic Info ----");
    }
});
