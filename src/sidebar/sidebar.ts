/**
 * ComfyUI MagnifyGlass - Sidebar Entry Point
 * 
 * Registers the MagnifyGlass sidebar tab with ComfyUI.
 */

// @ts-ignore
import { app } from "/scripts/app.js";
import { renderSettingsPanel } from './SidebarSettings';

/**
 * Magnify glass icon SVG
 */
const MAGNIFY_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;

/** Track if sidebar has been registered */
let sidebarRegistered = false;

/**
 * Load sidebar CSS
 */
function loadSidebarStyles(): void {
    if (!document.getElementById('magnify-sidebar-styles')) {
        const link = document.createElement('link');
        link.id = 'magnify-sidebar-styles';
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = 'extensions/comfyui-magnifyglass/sidebar.css';
        document.head.appendChild(link);
    }
}

/**
 * Render the sidebar content
 */
function renderSidebar(container: HTMLElement): void {
    // Load styles
    loadSidebarStyles();

    // Clear existing content to prevent duplicates
    container.innerHTML = '';

    // Create main container
    const sidebar = document.createElement('div');
    sidebar.className = 'magnify-sidebar';

    // Header
    const header = document.createElement('div');
    header.className = 'magnify-sidebar-header';
    header.innerHTML = `${MAGNIFY_ICON}<h2>Magnify G.</h2>`;
    sidebar.appendChild(header);

    // Content area
    const content = document.createElement('div');
    content.className = 'magnify-sidebar-content';

    // Render settings panel (contains all settings)
    renderSettingsPanel(content);

    sidebar.appendChild(content);
    container.appendChild(sidebar);
}

/**
 * Register the sidebar tab with ComfyUI
 */
export function registerSidebar(): void {
    // Prevent duplicate registration
    if (sidebarRegistered) {
        return;
    }

    // Wait for app to be ready
    if (!app.extensionManager) {
        console.warn('MagnifyGlass: extensionManager not available, sidebar registration skipped');
        return;
    }

    try {
        app.extensionManager.registerSidebarTab({
            id: 'magnifyglass',
            icon: 'pi pi-search',
            title: 'Magnify G.',
            tooltip: 'MagnifyGlass Settings',
            type: 'custom',
            render: (el: HTMLElement) => {
                renderSidebar(el);
            }
        });

        sidebarRegistered = true;
        console.log('MagnifyGlass: Sidebar registered successfully');
    } catch (e) {
        console.warn('MagnifyGlass: Failed to register sidebar:', e);
    }
}

/**
 * Initialize sidebar (called after app setup)
 */
export function initSidebar(): void {
    // Register on next tick to ensure app is ready
    setTimeout(() => {
        registerSidebar();
    }, 100);
}
