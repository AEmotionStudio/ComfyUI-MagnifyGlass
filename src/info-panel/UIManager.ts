/**
 * ComfyUI MagnifyGlass - Info Panel UI Manager (TypeScript)
 * 
 * Complete UI Manager extracted from magnify_info_panel.js
 * Handles all DOM manipulation and UI creation for the info panel.
 */

import { StateManager } from './StateManager';
import { Icons } from '../shared/icons';
import { Logger } from '../shared/logger';
import { formatValue, getValueClass, getValueAttributes, formatWidgetValue } from './ValueFormatter';
import {
    getCheckpointInfo,
    getImageInfo,
    getTextBoxContent,
    getImportantNodeParameters,
    type ImageInfoResult
} from './NodeDataExtractor';

interface InfoPanelElements {
    panel: HTMLDivElement | null;
    header: HTMLDivElement | null;
    content: HTMLDivElement | null;
    controls: HTMLDivElement | null;
}

/**
 * UI Manager class.
 * Handles all DOM manipulation and UI creation.
 */
export class UIManager {
    stateManager: StateManager;
    elements: InfoPanelElements;

    constructor(stateManager: StateManager) {
        this.stateManager = stateManager;
        this.elements = {
            panel: null,
            header: null,
            content: null,
            controls: null
        };

        this.createPanel();
        this.injectStyles();
    }

    /**
     * Create the main panel and its components.
     */
    createPanel(): void {
        // Main panel container
        this.elements.panel = document.createElement("div");
        this.elements.panel.id = "comfyui-magnify-info-panel-pro-v2";
        this.elements.panel.className = `magnify-info-panel theme-${this.stateManager.state.currentTheme}`;

        // Header
        this.elements.header = document.createElement("div");
        this.elements.header.className = "panel-header";
        this.elements.header.innerHTML = `
            <div class="header-content">
                <div class="header-icon">${Icons.magnifyGlass}</div>
                <div class="header-title">Inspector</div>
                <div class="header-subtitle">Real-time analysis</div>
            </div>
            <div class="header-controls">
                <button class="control-btn minimize-btn" title="Minimize Panel" data-action="minimize">${Icons.minus}</button>
            </div>
        `;

        // Content container
        this.elements.content = document.createElement("div");
        this.elements.content.className = "panel-content";

        this.elements.panel.appendChild(this.elements.header);
        this.elements.panel.appendChild(this.elements.content);

        this.applyStyles();
        document.body.appendChild(this.elements.panel);

        // Add click event delegation for panel elements
        this.elements.panel.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as HTMLElement;

            // Handle minimize button
            const minimizeBtn = target.closest('[data-action="minimize"]');
            if (minimizeBtn) {
                this.stateManager.state.isPanelMinimized = !this.stateManager.state.isPanelMinimized;
                this.updateMinimizedState();
                return;
            }

            // Handle section header clicks for expand/collapse
            const sectionHeader = target.closest('.section-header') as HTMLElement;
            if (sectionHeader) {
                const sectionId = sectionHeader.getAttribute('data-section');
                // Skip node section (always expanded)
                if (sectionId && sectionId !== 'node') {
                    const isExpanded = this.stateManager.state.expandedSections.has(sectionId);
                    if (isExpanded) {
                        this.stateManager.state.expandedSections.delete(sectionId);
                    } else {
                        this.stateManager.state.expandedSections.add(sectionId);
                    }

                    // Update visual state
                    sectionHeader.classList.toggle('expanded', !isExpanded);
                    const sectionContent = sectionHeader.nextElementSibling as HTMLElement;
                    if (sectionContent && sectionContent.classList.contains('section-content')) {
                        sectionContent.classList.toggle('expanded', !isExpanded);
                    }
                }
            }
        });

        // Create floating controls after panel is in DOM
        if (this.stateManager.state.settings["🔍MagnifyGlass.ShowHoveringControls"]) {
            this.createFloatingControls();
            // Update control states immediately after creation
            this.updateControlStates();
        }
    }

    /**
     * Create floating control buttons.
     */
    createFloatingControls(): void {
        this.elements.controls = document.createElement("div");
        this.elements.controls.className = "floating-controls vertical-layout"; // Default to vertical

        /**
         * BUTTON MAPPING DOCUMENTATION:
         * =============================
         * Button 1 (Unlock Icon): data-action="pin" → controls isPanelPinned
         *   - Unpinned (default): Panel follows magnify glass
         *   - Pinned: Panel stays at fixed position (unlocked from following glass)
         * 
         * Button 2 (Pin Icon): data-action="lock" → controls isPanelLocked
         *   - Unlocked (default): Panel can be dragged
         *   - Locked: Panel cannot be dragged (pinned in place)
         * 
         * NOTE: The data-action names are counterintuitive but kept for backwards compatibility.
         * The ICONS correctly represent the functionality:
         *   - Unlock icon = unlock from following glass
         *   - Pin icon = pin position (prevent drag)
         */
        this.elements.controls.innerHTML = `
            <button class="control-btn unlock-btn" title="Unlock/Lock Panel from Glass" data-action="pin">${Icons.unlock}</button>
            <button class="control-btn pin-btn" title="Pin/Unpin Panel Position (Prevent Drag)" data-action="lock">${Icons.pin}</button>
            <button class="control-btn visibility-btn" title="Toggle Panel Visibility (I)" data-action="toggle-panel">${Icons.eye}</button>
            <button class="control-btn glass-btn" title="Toggle Glass Preview (G)" data-action="toggle-glass">${Icons.magnifyGlass}</button>
        `;

        // Insert before the panel in the document body, not as a child
        document.body.appendChild(this.elements.controls);

        // Hide and position off-screen initially - will be shown when magnify glass activates and positions them
        this.elements.controls.style.display = 'none';
        this.elements.controls.style.visibility = 'hidden';
        this.elements.controls.style.left = '-9999px';
        this.elements.controls.style.top = '-9999px';

        // Add click event delegation for control buttons
        this.elements.controls.addEventListener('click', (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            const button = target.closest('button[data-action]') as HTMLButtonElement;
            if (!button) return;

            const action = button.getAttribute('data-action');
            Logger.debug(`Control button clicked: ${action}`);

            switch (action) {
                case 'pin':
                    this.stateManager.togglePinning();
                    this.updatePinnedState();
                    this.updateControlStates();
                    break;
                case 'lock':
                    this.stateManager.state.isPanelLocked = !this.stateManager.state.isPanelLocked;
                    this.updateControlStates();
                    if (this.elements.panel) {
                        this.elements.panel.classList.toggle('panel-locked', this.stateManager.state.isPanelLocked);
                    }
                    break;
                case 'toggle-panel':
                    if (this.stateManager.state.isPanelVisible) {
                        this.hide();
                    } else {
                        this.show();
                    }
                    this.updateControlStates();
                    break;
                case 'toggle-glass':
                    this.stateManager.state.isGlassPreviewVisible = !this.stateManager.state.isGlassPreviewVisible;

                    // Link Glass Visibility to Panel Pinning
                    if (!this.stateManager.state.isGlassPreviewVisible) {
                        // Glass Hidden -> Enter "Unlocked Mode" (Pinned to Screen, Draggable)
                        if (this.elements.panel) {
                            const rect = this.elements.panel.getBoundingClientRect();
                            this.stateManager.state.pinnedPosition = { x: rect.left, y: rect.top };
                        }
                        this.stateManager.state.isPanelPinned = true;
                        this.stateManager.state.isPanelLocked = false; // Ensure dragging is allowed
                    } else {
                        // Glass Shown -> Enter "Locked Position" (Follow Glass)
                        this.stateManager.state.isPanelPinned = false;
                        // Note: Dragging is automatically disabled when !isPanelPinned by EventManager logic
                    }

                    this.updateControlStates();
                    this.updatePinnedState(); // Update visual class

                    // Toggle ONLY the visual visibility (opacity) of the glass preview
                    // The tool remains active so the inspector can track position
                    const magnifyGlass = (window as any).comfyUIMagnifyGlass;
                    if (magnifyGlass && magnifyGlass.ui?.setPreviewVisibility) {
                        magnifyGlass.ui.setPreviewVisibility(this.stateManager.state.isGlassPreviewVisible);
                    }
                    break;
            }
        });

        // Set initial layout based on settings
        const controlsPosition = String(this.stateManager.state.settings["🔍MagnifyGlass.ControlsPosition"] || "top-right");
        this.updateControlsLayout(controlsPosition);

        // Initial state update
        this.updateControlStates();
    }

    /**
     * Update control button states.
     */
    updateControlStates(): void {
        if (!this.elements.controls) return;

        const pinBtn = this.elements.controls.querySelector('[data-action="pin"]') as HTMLButtonElement;
        const lockBtn = this.elements.controls.querySelector('[data-action="lock"]') as HTMLButtonElement;
        const visibilityBtn = this.elements.controls.querySelector('[data-action="toggle-panel"]') as HTMLButtonElement;
        const glassBtn = this.elements.controls.querySelector('[data-action="toggle-glass"]') as HTMLButtonElement;
        const isPanelVisible = this.stateManager.state.isPanelVisible;
        const isGlassVisible = this.stateManager.state.isGlassPreviewVisible;

        if (pinBtn) {
            pinBtn.classList.toggle('active', this.stateManager.state.isPanelPinned);
            pinBtn.title = this.stateManager.state.isPanelPinned ? "Lock Panel" : "Unlock Panel";
            pinBtn.innerHTML = this.stateManager.state.isPanelPinned ? Icons.lock : Icons.unlock;
            // Hide unlock button when panel is hidden
            pinBtn.style.display = isPanelVisible ? 'flex' : 'none';

            // Disable unlock (unpin) button if glass is hidden
            // This prevents entering "Follow Mouse" mode when glass is invisible
            if (!isGlassVisible) {
                pinBtn.disabled = true;
                pinBtn.style.opacity = '0.5';
                pinBtn.title = "Cannot unlock panel from screen when glass preview is hidden";
            } else {
                pinBtn.disabled = false;
                pinBtn.style.opacity = '';
            }
        }

        if (lockBtn) {
            // Only show pin button when panel is visible AND unlocked from glass
            const showLockBtn = isPanelVisible && this.stateManager.state.isPanelPinned;
            lockBtn.style.display = showLockBtn ? 'flex' : 'none';
            lockBtn.classList.toggle('active', this.stateManager.state.isPanelLocked);
            lockBtn.title = this.stateManager.state.isPanelLocked ? "Unpin Panel Position" : "Pin Panel Position";
            lockBtn.disabled = !this.stateManager.state.isPanelPinned;
        }

        if (visibilityBtn) {
            // Active means "Panel is Visible"
            visibilityBtn.classList.toggle('active', isPanelVisible);
            visibilityBtn.title = isPanelVisible ? "Hide Panel" : "Show Panel";

            // Disable hide button if glass is hidden (prevent hiding everything)
            if (!isGlassVisible) {
                visibilityBtn.disabled = true;
                visibilityBtn.style.opacity = '0.5';
                visibilityBtn.title = "Cannot hide panel when glass preview is hidden";
            } else {
                visibilityBtn.disabled = false;
                visibilityBtn.style.opacity = '';
            }
        }

        if (glassBtn) {
            glassBtn.classList.toggle('active', isGlassVisible);
            glassBtn.title = isGlassVisible ? "Hide Glass Preview" : "Show Glass Preview";

            // Only show glass toggle button if the inspector panel is visible
            glassBtn.style.display = isPanelVisible ? 'flex' : 'none';
        }
    }

    /**
     * Update controls layout based on position setting.
     * @param position 
     */
    updateControlsLayout(position: string): void {
        if (!this.elements.controls) return;

        // Remove existing layout classes
        this.elements.controls.classList.remove('horizontal-layout', 'vertical-layout');

        // Add appropriate layout class
        if (['top', 'bottom'].includes(position)) {
            this.elements.controls.classList.add('horizontal-layout');
        } else {
            this.elements.controls.classList.add('vertical-layout');
        }
    }

    /**
     * Apply current styles to elements.
     */
    applyStyles(): void {
        if (!this.elements.panel) return;

        const settings = this.stateManager.state.settings;

        // Apply custom text color via CSS variable if provided
        const textColor = settings["🔍MagnifyGlass.InfoPanelTextColor"] as string | undefined;
        if (textColor && typeof textColor === 'string') {
            // Ensure color has # symbol
            const normalizedTextColor = textColor.startsWith('#') ? textColor : `#${textColor}`;
            this.elements.panel.style.setProperty('--info-panel-text-color', normalizedTextColor);
        }

        // Apply custom accent color via CSS variable if provided
        const accentColor = settings["🔍MagnifyGlass.InfoPanelAccentColor"] as string | undefined;
        if (accentColor && typeof accentColor === 'string') {
            // Ensure color has # symbol
            const normalizedAccentColor = accentColor.startsWith('#') ? accentColor : `#${accentColor}`;
            this.elements.panel.style.setProperty('--info-panel-accent-color', normalizedAccentColor);
        }

        // Apply opacity setting if panel is visible (convert percentage to decimal)
        if (this.stateManager.state.isPanelVisible) {
            const opacityPercent = Number(settings["🔍MagnifyGlass.InfoPanelOpacity"]) || 100;
            this.elements.panel.style.opacity = (opacityPercent / 100).toString();
        }

        this.elements.panel.style.cssText = `
            position: absolute;
            width: ${settings["🔍MagnifyGlass.InfoPanelWidth"]}px;
            max-height: ${settings["🔍MagnifyGlass.InfoPanelMaxHeight"]}px;
            z-index: 99999;
            display: none;
            opacity: 0;
            transform: translateY(-10px);
            transition: ${settings["🔍MagnifyGlass.InfoPanelAnimations"] ? 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)' : 'none'};
            pointer-events: auto;
            user-select: none;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            ${textColor && typeof textColor === 'string' ? `--info-panel-text-color: ${textColor.startsWith('#') ? textColor : `#${textColor}`};` : ''}
            ${accentColor && typeof accentColor === 'string' ? `--info-panel-accent-color: ${accentColor.startsWith('#') ? accentColor : `#${accentColor}`};` : ''}
        `;
    }

    /**
     * Show the panel.
     */
    show(): void {
        if (!this.elements.panel) return;

        if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"]) {
            this.elements.panel.style.display = "block";
            // Controls are shown by positionFloatingControls() after proper positioning
            // Apply user's opacity setting when showing (convert percentage to decimal)
            const opacityPercent = Number(this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelOpacity"]) || 100;
            this.elements.panel.style.opacity = (opacityPercent / 100).toString();
            // Trigger reflow
            this.elements.panel.offsetHeight;
            this.elements.panel.classList.add('visible');
            this.stateManager.state.isPanelVisible = true;
            this.updateControlStates();
        }
    }

    /**
     * Hide the panel.
     */
    hide(): void {
        if (!this.elements.panel) return;

        this.elements.panel.classList.remove('visible');
        setTimeout(() => {
            if (!this.stateManager.state.isPanelVisible && this.elements.panel) {
                this.elements.panel.style.display = "none";
                // Do NOT hide controls when panel is hidden - they should remain visible on glass
                // if (this.elements.controls) {
                //    this.elements.controls.style.display = "none";
                // }
            }
        }, this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelAnimations"] ? 300 : 0);
        this.stateManager.state.isPanelVisible = false;
        this.updateControlStates();
    }

    /**
     * Update minimized state.
     */
    updateMinimizedState(): void {
        if (!this.elements.panel || !this.elements.header) return;

        this.elements.panel.classList.toggle('panel-minimized', this.stateManager.state.isPanelMinimized);
        const minimizeBtn = this.elements.header.querySelector('.minimize-btn');
        if (minimizeBtn) {
            minimizeBtn.textContent = this.stateManager.state.isPanelMinimized ? '+' : '−';
            (minimizeBtn as HTMLElement).title = this.stateManager.state.isPanelMinimized ? 'Expand Panel' : 'Minimize Panel';
        }
    }

    /**
     * Update pinned state.
     */
    updatePinnedState(): void {
        if (!this.elements.panel) return;

        this.elements.panel.classList.toggle('panel-pinned', this.stateManager.state.isPanelPinned);
        this.elements.panel.classList.toggle('panel-locked', this.stateManager.state.isPanelLocked);
        this.updateControlStates();
    }

    /**
     * Update theme class.
     * @param newTheme 
     */
    updateTheme(newTheme: string): void {
        if (this.elements.panel) {
            this.elements.panel.className = this.elements.panel.className.replace(/theme-\w+/, `theme-${newTheme.toLowerCase()}`);
        }
    }

    /**
     * Display information in the panel.
     * @param info 
     */
    displayInfo(info: any): void {
        const sections = this.buildSections(info);
        this.renderSections(sections);
        this.updateSectionStates();
        this.updateHeaderSubtitle(info);
    }

    /**
     * Build section data from info object.
     * @param info 
     * @returns 
     */
    buildSections(info: any): any[] {
        const sections: any[] = [];
        const settings = this.stateManager.state.settings;

        // Inspector section
        if (settings["🔍MagnifyGlass.ShowInspectorTab"]) {
            const inspectorContent = [
                { label: 'Cursor Canvas', value: `(${Math.round(info.cursor.canvas.x)}, ${Math.round(info.cursor.canvas.y)})` },
                { label: 'Canvas Scale', value: `${(info.canvas.scale * 100).toFixed(1)}%` },
                { label: 'Magnifier Zoom', value: `${info.magnifier.zoomFactor}×` }
            ];

            sections.push({
                id: 'inspector',
                icon: Icons.info,
                title: 'Inspector',
                content: inspectorContent
            });
        }

        // Media section
        if (info.media) {
            const mediaContent = [
                { label: 'Type', value: info.media.tagName },
                { label: 'Source', value: info.media.src }
            ];

            if (info.media.naturalSize) {
                mediaContent.push({ label: 'Natural', value: info.media.naturalSize });
            }

            sections.push({
                id: 'media',
                icon: Icons.camera,
                title: 'Media',
                badge: info.media.tagName,
                content: mediaContent
            });
        }

        // Node Details section
        if (info.hoveredNode) {
            const nodeContent = [
                { label: 'Title', value: info.hoveredNode.title }
            ];

            // Check if this is a complex node that shows all widgets
            const nodeType = info.hoveredNode.type ? info.hoveredNode.type.toLowerCase() : '';
            const isSaveNode = nodeType.includes('save') &&
                !nodeType.includes('checkpoint') &&
                !nodeType.includes('model') &&
                !nodeType.includes('preview');

            const showAllWidgets = info.hoveredNode.type && (
                nodeType.includes('ksampler') ||
                nodeType.includes('sampler') ||
                nodeType.includes('k_samplers') ||
                nodeType.includes('checkpoint') ||
                nodeType.includes('model') ||
                nodeType.includes('lora') ||
                nodeType.includes('controlnet') ||
                nodeType.includes('advanced') ||
                nodeType.includes('detailer') ||
                nodeType.includes('inpaint') ||
                nodeType.includes('upscale') ||
                nodeType.includes('clip') ||
                nodeType.includes('text') ||
                nodeType.includes('encode')
            ) && !isSaveNode;

            if (!showAllWidgets) {
                // Add specific extractions for simple nodes
                const checkpoint = getCheckpointInfo(info.hoveredNode);
                if (checkpoint) {
                    nodeContent.push({ label: 'Model', value: checkpoint });
                }

                const imgInfo = getImageInfo(info.hoveredNode);
                if (imgInfo) {
                    if (typeof imgInfo === 'string') {
                        nodeContent.push({ label: 'Image', value: imgInfo });
                    } else if (typeof imgInfo === 'object' && imgInfo !== null) {
                        const imgResult = imgInfo as ImageInfoResult;
                        nodeContent.push({ label: 'Image Size', value: `${imgResult.width}×${imgResult.height}` });
                        if (imgResult.src) {
                            nodeContent.push({ label: 'Image Source', value: imgResult.src });
                        }
                    }
                }

                const textContent = getTextBoxContent(info.hoveredNode);
                if (textContent) {
                    nodeContent.push({ label: 'Text', value: textContent });
                }
            }

            const importantParameters = getImportantNodeParameters(info.hoveredNode);
            nodeContent.push(...importantParameters);

            sections.push({
                id: 'node',
                icon: Icons.box,
                title: 'Node',
                badge: info.hoveredNode.type,
                content: nodeContent
            });
        }

        return sections;
    }

    /**
     * Render sections to the panel.
     * @param sections 
     */
    renderSections(sections: any[]): void {
        if (!this.elements.content) return;

        if (sections.length === 0) {
            this.elements.content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">${Icons.mapPin}</div>
                    <div class="empty-state-text">Empty canvas area</div>
                </div>
            `;
            return;
        }

        this.elements.content.innerHTML = sections.map(section => `
            <div class="info-section" data-section="${section.id}">
                <div class="section-header" data-section="${section.id}">
                    <span class="section-icon">${section.icon}</span>
                    <span class="section-title">${section.title}</span>
                    ${section.badge ? `<span class="section-badge">${section.badge}</span>` : ''}
                    ${section.id !== 'node' ? `<span class="expand-icon">${Icons.chevronRight}</span>` : ''}
                </div>
                <div class="section-content">
                    <div class="section-body">
                        ${section.content.map((item: any) => {
            const value = formatValue(item.value, item.label);
            const valueClass = getValueClass(item.value);
            const valueAttributes = getValueAttributes(item.value);
            return `
                            <div class="info-row">
                                <span class="info-label">${item.label}</span>
                                <span class="info-value ${valueClass}" ${valueAttributes}>${value}</span>
                            </div>`;
        }).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Update section expansion states.
     */
    updateSectionStates(): void {
        if (!this.elements.content) return;

        const sections = this.elements.content.querySelectorAll('.info-section');
        sections.forEach(section => {
            const sectionId = (section as HTMLElement).dataset.section;
            if (!sectionId) return;

            const header = section.querySelector('.section-header');
            const content = section.querySelector('.section-content');

            if (header && content) {
                if (this.stateManager.state.expandedSections.has(sectionId)) {
                    header.classList.add('expanded');
                    content.classList.add('expanded');
                } else {
                    header.classList.remove('expanded');
                    content.classList.remove('expanded');
                }
            }
        });
    }

    /**
     * Update header subtitle.
     * @param info 
     */
    updateHeaderSubtitle(info: any): void {
        if (!this.elements.header) return;

        const subtitleElement = this.elements.header.querySelector('.header-subtitle') as HTMLElement;
        if (subtitleElement) {
            const accentColor = String(this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelAccentColor"] || '');
            if (info.hoveredNode) {
                subtitleElement.textContent = `Analyzing: ${info.hoveredNode.title}`;
                subtitleElement.style.color = accentColor;
            } else if (info.media) {
                subtitleElement.textContent = `Media: ${info.media.tagName}`;
                subtitleElement.style.color = accentColor;
            } else if (info.connection) {
                subtitleElement.textContent = `Connection: ${info.connection.type}`;
                subtitleElement.style.color = accentColor;
            } else {
                subtitleElement.textContent = 'Real-time analysis';
                subtitleElement.style.color = '';
            }
        }
    }

    /**
     * Inject CSS styles by loading external stylesheet.
     */
    injectStyles(): void {
        if (!document.getElementById('magnify-info-panel-styles-v2')) {
            const link = document.createElement('link');
            link.id = 'magnify-info-panel-styles-v2';
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = 'extensions/comfyui-magnifyglass/info-panel.css';
            document.head.appendChild(link);
        }
    }

    cleanup(): void {
        if (this.elements.panel && this.elements.panel.parentNode) {
            this.elements.panel.parentNode.removeChild(this.elements.panel);
        }
        if (this.elements.controls && this.elements.controls.parentNode) {
            this.elements.controls.parentNode.removeChild(this.elements.controls);
        }
    }
}
