/**
 * ComfyUI MagnifyGlass - Sidebar Entry Point
 * 
 * Registers the MagnifyGlass sidebar tab with ComfyUI.
 */

// @ts-ignore
import { app } from "/scripts/app.js";
import { renderSettingsPanel } from './SidebarSettings';
import { renderAbout } from './SidebarAbout';

/** Track if sidebar has been registered */
let sidebarRegistered = false;

/**
 * Load sidebar CSS
 */
function loadSidebarStyles(onLoaded?: () => void): void {
    const existingLink = document.getElementById('magnify-sidebar-styles') as HTMLLinkElement;

    if (existingLink) {
        // Already exists, call callback immediately
        if (onLoaded) onLoaded();
        return;
    }

    const link = document.createElement('link');
    link.id = 'magnify-sidebar-styles';
    link.rel = 'stylesheet';
    link.type = 'text/css';
    link.href = 'extensions/comfyui-magnifyglass/sidebar.css';

    if (onLoaded) {
        link.onload = onLoaded;
        link.onerror = onLoaded; // Still show content even if CSS fails
    }

    document.head.appendChild(link);
}

/**
 * Render the sidebar content
 */
function renderSidebar(container: HTMLElement): void {
    // Check if sidebar already exists to prevent re-rendering on setting changes
    if (container.querySelector('.magnify-sidebar')) {
        return;
    }

    // Clear existing content to prevent duplicates
    container.innerHTML = '';

    // Create main container (hidden initially to prevent flash of unstyled content)
    const sidebar = document.createElement('div');
    sidebar.className = 'magnify-sidebar';
    sidebar.style.visibility = 'hidden';
    sidebar.style.opacity = '0';

    const header = document.createElement('header');
    header.className = 'magnify-sidebar-header';
    const mark = document.createElement('i');
    mark.className = 'pi pi-search magnify-mark';
    mark.setAttribute('aria-hidden', 'true');
    const title = document.createElement('h2');
    title.className = 'magnify-sidebar-title';
    title.textContent = 'MagnifyGlass';
    header.append(mark, title);
    sidebar.appendChild(header);

    // Settings get their own container: Reset All empties and re-renders it, which must leave About alone
    const content = document.createElement('div');
    content.className = 'magnify-sidebar-content';
    const settings = document.createElement('div');
    settings.className = 'magnify-settings';
    renderSettingsPanel(settings);
    content.append(settings, renderAbout());

    sidebar.appendChild(content);
    container.appendChild(sidebar);

    // Load styles and show sidebar after loaded
    loadSidebarStyles(() => {
        // Small delay to ensure styles are applied
        requestAnimationFrame(() => {
            sidebar.style.visibility = 'visible';
            sidebar.style.opacity = '1';
            sidebar.style.transition = 'opacity 0.1s ease-in';
        });
    });
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
            title: 'Magnify',
            tooltip: 'MagnifyGlass Settings',
            type: 'custom',
            render: (el: HTMLElement) => {
                renderSidebar(el);
            }
        });

        sidebarRegistered = true;
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
