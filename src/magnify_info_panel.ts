/**
 * ComfyUI Magnify Info Panel - Main Entry Point
 *
 * Initializes the Info Panel extension.
 */

import { mountInfoPanel, unmountInfoPanel } from './info-panel';
import { registerPanelSettings } from './shared/settings';
import type { MagnifyGlassInstance } from './types/comfyui';
// @ts-ignore
import { app } from "/scripts/app.js";

app.registerExtension({
    name: "comfyui.magnify.info.panel",
    init() {
        // Wait for magnify glass to be available
        const checkDependencies = () => {
            if (window.comfyUIMagnifyGlass) {
                initializeInfoPanel(window.comfyUIMagnifyGlass);
            } else {
                setTimeout(checkDependencies, 100);
            }
        };

        checkDependencies();
    },
    // Undo, redo and loading a workflow replace the nodes without moving the mouse, which drives the other updates
    afterConfigureGraph() {
        if (window.comfyUIMagnifyGlass?.state.active) window.infoPanelManager?.scheduleInfoUpdate();
    }
});

function initializeInfoPanel(magnifyGlass: MagnifyGlassInstance) {
    // The InfoPanelEnabled handler runs on registration and mounts the panel when enabled
    registerPanelSettings(on => on ? mountInfoPanel(magnifyGlass) : unmountInfoPanel(magnifyGlass));
}
