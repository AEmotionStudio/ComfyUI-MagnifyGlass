/**
 * ComfyUI MagnifyGlass - Info Panel (Refactored Entry Point)
 * 
 * This is the refactored version of the info panel that uses modular imports.
 * The original magnify_info_panel.js is preserved as a backup.
 */

import { app } from "../../../scripts/app.js";
import { InfoPanel } from './info-panel/index.js';
import { DEFAULT_PANEL_SETTINGS, getSettingConfig } from './shared/settings.js';

app.registerExtension({
    name: "Comfy.MagnifyGlass.InfoPanel.Refactored",

    async setup() {
        // Wait for magnify glass to be ready
        const checkForMagnifyGlass = () => {
            return new Promise((resolve) => {
                const check = () => {
                    if (window.comfyUIMagnifyGlass) {
                        resolve(window.comfyUIMagnifyGlass);
                    } else {
                        setTimeout(check, 100);
                    }
                };
                check();
            });
        };

        // Get magnify glass instance
        const magnifyGlass = await checkForMagnifyGlass();

        // Create info panel manager
        const infoPanelManager = new InfoPanel(magnifyGlass);

        // Store reference globally for cleanup and theme updates
        if (!window.comfyUIMagnifyGlassExtensions) {
            window.comfyUIMagnifyGlassExtensions = [];
        }
        window.comfyUIMagnifyGlassExtensions.push(infoPanelManager);

        // Store main manager reference for theme updates
        window.infoPanelManager = infoPanelManager;

        // Register settings with ComfyUI
        Object.keys(DEFAULT_PANEL_SETTINGS).forEach(settingKey => {
            const settingConfig = getSettingConfig(settingKey, DEFAULT_PANEL_SETTINGS[settingKey]);
            if (settingConfig) {
                app.ui.settings.addSetting({
                    ...settingConfig,
                    onChange: (value) => {
                        infoPanelManager.updateSettings();
                    }
                });
            }
        });

        console.log("ComfyUI Magnify Info Panel (Refactored): Loaded successfully");
    }
});
