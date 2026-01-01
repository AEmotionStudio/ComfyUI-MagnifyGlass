/**
 * ComfyUI MagnifyGlass - Info Panel UI Manager (TypeScript)
 * 
 * Complete UI Manager extracted from magnify_info_panel.js
 * Handles all DOM manipulation and UI creation for the info panel.
 */

// import { Z_INDEX } from '../shared/constants'; // Not used in original code? Kept for reference if needed
import { getInfoPanelCSS } from './styles';
import { StateManager } from './StateManager';

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
                <div class="header-icon">🔍</div>
                <div class="header-title">Inspector</div>
                <div class="header-subtitle">Real-time analysis</div>
            </div>
            <div class="header-controls">
                <button class="control-btn minimize-btn" title="Minimize Panel" data-action="minimize">−</button>
            </div>
        `;

        // Content container
        this.elements.content = document.createElement("div");
        this.elements.content.className = "panel-content";

        this.elements.panel.appendChild(this.elements.header);
        this.elements.panel.appendChild(this.elements.content);

        this.applyStyles();
        document.body.appendChild(this.elements.panel);

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
        this.elements.controls.innerHTML = `
            <button class="control-btn pin-btn" title="Unlock Panel to Mouse Location (U)" data-action="pin">🔓</button>
            <button class="control-btn lock-btn" title="Lock Panel Position" data-action="lock">📌</button>
            <button class="control-btn visibility-btn" title="Toggle Panel Visibility (I)" data-action="toggle-panel">👁️</button>
            <button class="control-btn glass-btn" title="Toggle Glass Preview (G)" data-action="toggle-glass">🔍</button>
        `;

        // Insert before the panel in the document body, not as a child
        document.body.appendChild(this.elements.controls);

        // Set initial layout based on settings
        const controlsPosition = this.stateManager.state.settings["🔍MagnifyGlass.ControlsPosition"] || "top-right";
        this.updateControlsLayout(controlsPosition);
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

        if (pinBtn) {
            pinBtn.classList.toggle('active', this.stateManager.state.isPanelPinned);
            pinBtn.title = this.stateManager.state.isPanelPinned ? "Lock Panel" : "Unlock Panel";
            pinBtn.textContent = this.stateManager.state.isPanelPinned ? "🔒" : "🔓";
        }

        if (lockBtn) {
            // Only show/enable lock button when pinned
            lockBtn.style.display = this.stateManager.state.isPanelPinned ? 'flex' : 'none';
            lockBtn.classList.toggle('active', this.stateManager.state.isPanelLocked);
            lockBtn.title = this.stateManager.state.isPanelLocked ? "Upin Panel Position" : "Pin Panel Position";
            lockBtn.disabled = !this.stateManager.state.isPanelPinned;
        }

        if (visibilityBtn) {
            visibilityBtn.classList.toggle('active', this.stateManager.state.isPanelVisible);
            visibilityBtn.title = this.stateManager.state.isPanelVisible ? "Show Panel" : "Hide Panel";
        }

        if (glassBtn) {
            glassBtn.classList.toggle('active', this.stateManager.state.isGlassPreviewVisible);
            glassBtn.title = this.stateManager.state.isGlassPreviewVisible ? "Hide Glass Preview" : "Show Glass Preview";
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
        const textColor = settings["🔍MagnifyGlass.InfoPanelTextColor"];
        if (textColor) {
            // Ensure color has # symbol
            const normalizedTextColor = textColor.startsWith('#') ? textColor : `#${textColor}`;
            this.elements.panel.style.setProperty('--info-panel-text-color', normalizedTextColor);
        }

        // Apply custom accent color via CSS variable if provided
        const accentColor = settings["🔍MagnifyGlass.InfoPanelAccentColor"];
        if (accentColor) {
            // Ensure color has # symbol
            const normalizedAccentColor = accentColor.startsWith('#') ? accentColor : `#${accentColor}`;
            this.elements.panel.style.setProperty('--info-panel-accent-color', normalizedAccentColor);
        }

        // Apply opacity setting if panel is visible (convert percentage to decimal)
        if (this.stateManager.state.isPanelVisible) {
            const opacityPercent = settings["🔍MagnifyGlass.InfoPanelOpacity"];
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
            ${textColor ? `--info-panel-text-color: ${textColor.startsWith('#') ? textColor : `#${textColor}`};` : ''}
            ${accentColor ? `--info-panel-accent-color: ${accentColor.startsWith('#') ? accentColor : `#${accentColor}`};` : ''}
        `;
    }

    /**
     * Show the panel.
     */
    show(): void {
        if (!this.elements.panel) return;

        if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"]) {
            this.elements.panel.style.display = "block";
            if (this.elements.controls) {
                this.elements.controls.style.display = "flex";
            }
            // Apply user's opacity setting when showing (convert percentage to decimal)
            const opacityPercent = this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelOpacity"];
            this.elements.panel.style.opacity = (opacityPercent / 100).toString();
            // Trigger reflow
            this.elements.panel.offsetHeight;
            this.elements.panel.classList.add('visible');
            this.stateManager.state.isPanelVisible = true;
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
                if (this.elements.controls) {
                    this.elements.controls.style.display = "none";
                }
            }
        }, this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelAnimations"] ? 300 : 0);
        this.stateManager.state.isPanelVisible = false;
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
                icon: '🔍',
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
                icon: '📷',
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
                const checkpointInfo = this.getCheckpointInfo(info.hoveredNode);
                if (checkpointInfo) {
                    nodeContent.push({ label: 'Model', value: checkpointInfo });
                }

                const imageInfo = this.getImageInfo(info.hoveredNode);
                if (imageInfo) {
                    if (typeof imageInfo === 'string') {
                        nodeContent.push({ label: 'Image', value: imageInfo });
                    } else if (typeof imageInfo === 'object' && imageInfo !== null) {
                        const imgInfoAny = imageInfo as any;
                        nodeContent.push({ label: 'Image Size', value: `${imgInfoAny.width}×${imgInfoAny.height}` });
                        if (imgInfoAny.src) {
                            nodeContent.push({ label: 'Image Source', value: imgInfoAny.src });
                        }
                    }
                }

                const textBoxContent = this.getTextBoxContent(info.hoveredNode);
                if (textBoxContent) {
                    nodeContent.push({ label: 'Text', value: textBoxContent });
                }
            }

            const importantParameters = this.getImportantNodeParameters(info.hoveredNode);
            nodeContent.push(...importantParameters);

            sections.push({
                id: 'node',
                icon: '🎯',
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
                    <div class="empty-state-icon">📍</div>
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
                    ${section.id !== 'node' ? '<span class="expand-icon">▶</span>' : ''}
                </div>
                <div class="section-content">
                    <div class="section-body">
                        ${section.content.map((item: any) => {
            const value = this.formatValue(item.value, item.label);
            const valueClass = this.getValueClass(item.value);
            const valueAttributes = this.getValueAttributes(item.value);
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
     * Format a value for display.
     * @param value 
     * @param label
     * @returns 
     */
    formatValue(value: any, label?: string): string {
        if (value === null || value === undefined) return '';

        const str = String(value);

        // Show full text for prompts, text content, model names, and file paths
        if (label && (
            label.toLowerCase().includes('text') ||
            label.toLowerCase().includes('prompt') ||
            label.toLowerCase().includes('model') ||
            label.toLowerCase().includes('file') ||
            label.toLowerCase().includes('conditioning') ||
            label.toLowerCase().includes('positive') ||
            label.toLowerCase().includes('negative')
        )) {
            return str;
        }

        // Show full text for very long values (no truncation)
        return str;
    }

    /**
     * Get value class for styling.
     * @param value 
     * @returns 
     */
    getValueClass(value: any): string {
        if (!value) return '';

        const str = String(value);
        let classes: string[] = [];

        // Mark text that might benefit from special styling for readability
        if (str.length > 100) {
            classes.push('long-text');
        }

        return classes.join(' ');
    }

    /**
     * Get value attributes.
     * @param value 
     * @returns 
     */
    getValueAttributes(value: any): string {
        // Since we show full text now, we don't need title attributes for long text
        // Only add title for very long text that might benefit from tooltips
        if (!value) return '';

        const str = String(value);
        if (str.length > 500) { // Only for extremely long text
            return `title="${str.replace(/"/g, '&quot;')}"`;
        }

        return '';
    }

    /**
     * Update header subtitle.
     * @param info 
     */
    updateHeaderSubtitle(info: any): void {
        if (!this.elements.header) return;

        const subtitleElement = this.elements.header.querySelector('.header-subtitle') as HTMLElement;
        if (subtitleElement) {
            const accentColor = this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelAccentColor"];
            if (info.hoveredNode) {
                subtitleElement.textContent = `Analyzing: ${info.hoveredNode.title}`;
                subtitleElement.style.color = accentColor || '';
            } else if (info.media) {
                subtitleElement.textContent = `Media: ${info.media.tagName}`;
                subtitleElement.style.color = accentColor || '';
            } else if (info.connection) {
                subtitleElement.textContent = `Connection: ${info.connection.type}`;
                subtitleElement.style.color = accentColor || '';
            } else {
                subtitleElement.textContent = 'Real-time analysis';
                subtitleElement.style.color = '';
            }
        }
    }

    // ============== Helper methods for node information extraction ==============

    /**
     * Get checkpoint/model info from a node.
     * @param nodeInfo 
     * @returns 
     */
    getCheckpointInfo(nodeInfo: any): string | null {
        if (nodeInfo.type && (
            nodeInfo.type.includes("CheckpointLoader") ||
            nodeInfo.type.includes("LoadCheckpoint") ||
            nodeInfo.type.includes("ModelLoader") ||
            nodeInfo.type.includes("UNETLoader") ||
            nodeInfo.type.includes("VAELoader") ||
            nodeInfo.type.includes("LoraLoader")
        )) {
            if (nodeInfo.widgets && nodeInfo.widgets.length > 0) {
                for (const widget of nodeInfo.widgets) {
                    if (widget.name && (
                        widget.name.toLowerCase().includes("model") ||
                        widget.name.toLowerCase().includes("checkpoint") ||
                        widget.name.toLowerCase().includes("ckpt") ||
                        widget.name.toLowerCase().includes("lora") ||
                        widget.name.toLowerCase().includes("vae") ||
                        widget.name.toLowerCase().includes("file")
                    )) {
                        const value = String(widget.value);
                        const filename = value.split(/[\/\\]/).pop();
                        return filename || value;
                    }
                }
            }
        }
        return null;
    }

    /**
     * Get image info from a node.
     * @param nodeInfo 
     * @returns 
     */
    getImageInfo(nodeInfo: any): string | object | null {
        if (nodeInfo.type && (
            nodeInfo.type.includes("SaveImage") ||
            nodeInfo.type.includes("PreviewImage") ||
            nodeInfo.type.includes("VisionOutput") ||
            nodeInfo.type.includes("ImageOutput") ||
            nodeInfo.type.includes("LoadImage") ||
            nodeInfo.type.includes("Display")
        )) {
            if (nodeInfo.widgets) {
                for (const widget of nodeInfo.widgets) {
                    if (widget.name && (
                        widget.name.toLowerCase().includes("image") ||
                        widget.name.toLowerCase().includes("filename") ||
                        widget.name.toLowerCase().includes("file")
                    )) {
                        return widget.value;
                    }
                }
            }

            if (nodeInfo.properties && nodeInfo.properties.img) {
                const img = nodeInfo.properties.img;
                return {
                    width: img.width || "unknown",
                    height: img.height || "unknown",
                    src: img.src ? img.src.split(/[\/\\]/).pop() : "Preview available"
                };
            }

            if (nodeInfo.outputs) {
                for (const output of nodeInfo.outputs) {
                    if (output.links && output.links.length > 0) {
                        return "Image connected to " + output.links.length + " node(s)";
                    }
                }
            }

            return "Image node";
        }
        return null;
    }

    /**
     * Get text box content from a node.
     * @param nodeInfo 
     * @returns 
     */
    getTextBoxContent(nodeInfo: any): string | null {
        if (nodeInfo.widgets && nodeInfo.widgets.length > 0) {
            if (nodeInfo.type && nodeInfo.type.includes("CLIPTextEncode")) {
                for (const widget of nodeInfo.widgets) {
                    if (widget.name === "text" && typeof widget.value === 'string') {
                        return widget.value;
                    }
                }
            }

            for (const widget of nodeInfo.widgets) {
                if ((widget.name.toLowerCase().includes("prompt") ||
                    widget.name.toLowerCase().includes("conditioning")) &&
                    typeof widget.value === 'string' && widget.value.length > 0) {
                    return widget.value;
                }
            }

            for (const widget of nodeInfo.widgets) {
                if ((widget.type === 'text' || widget.type === 'textarea' ||
                    widget.type === 'string' || widget.name.toLowerCase().includes('text')) &&
                    typeof widget.value === 'string' && widget.value.length > 0) {

                    // Show full text without truncation
                    return widget.value;
                }
            }
        }
        return null;
    }

    /**
     * Get important node parameters based on node type.
     * @param nodeInfo 
     * @returns 
     */
    getImportantNodeParameters(nodeInfo: any): any[] {
        const parameters: any[] = [];

        // For complex nodes that have many parameters, show ALL widgets
        const nodeType = nodeInfo.type ? nodeInfo.type.toLowerCase() : '';
        const isSaveNode = nodeType.includes('save') &&
            !nodeType.includes('checkpoint') &&
            !nodeType.includes('model') &&
            !nodeType.includes('preview');

        const showAllWidgets = nodeInfo.type && (
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

        if (showAllWidgets) {
            if (nodeInfo.widgets && nodeInfo.widgets.length > 0) {
                for (const widget of nodeInfo.widgets) {
                    // Show all widgets for complex nodes, but filter out some duplicates
                    if (widget.name && widget.name !== '') {
                        const widgetName = widget.name.toLowerCase();

                        // Skip some generic widget names that might be duplicates
                        if (widgetName.includes('title') ||
                            widgetName === 'node' ||
                            widgetName === 'id' ||
                            widgetName === 'type' ||
                            widgetName === 'mode') {
                            continue;
                        }

                        parameters.push({
                            label: widget.name,
                            value: this.formatWidgetValue(widget.value)
                        });
                    }
                }
            }
            return parameters;
        }

        // Special handling for Save nodes - only show essential parameters
        let importantParams: string[];
        if (isSaveNode) {
            importantParams = [
                'filename_prefix', 'filename', 'directory', 'path',
                'format', 'quality', 'extension'
            ];
        } else {
            // For other nodes, use the filtered list but avoid duplicates with specific extractions
            importantParams = [
                'seed', 'steps', 'cfg', 'scale', 'sampler', 'scheduler',
                'positive', 'negative', 'width', 'height', 'denoise', 'strength',
                'noise', 'count', 'batch', 'size', 'phase', 'color', 'intensity',
                // KSampler specific parameters (for other samplers)
                'control_after_generate', 'control', 'after', 'generate',
                'start_at_step', 'end_at_step', 'start', 'end',
                'return_with_leftover_noise', 'leftover', 'noise_return',
                // Additional common parameters (but avoid duplicates with specific extractors)
                'model', 'vae', 'clip', 'lora', 'checkpoint',
                'latent', 'image', 'mask', 'filename', 'directory',
                'prompt', 'conditioning', 'filename_prefix',
                // New detection vocabulary
                'resolution', 'num_chunks', 'seconds', 'aspect_ratio',
                'style_type', 'background', 'n', 'human', 'raw', 'guidance',
                'skip_preprocessing', 'movement_amplitude', 'animation',
                'material_type', 'b1', 'b2', 's1', 's2', 'type', 'channel',
                'sigma', 'rho',
                // Additional detection vocabulary
                'alpha', 'base_shift', 'shift', 'stretch', 'terminal',
                'spacing', 'style', 'eta', 'norm_threshold', 'momentum',
                'hypernetwork_name', 'reuse_threshold', 'verbose', 'layers',
                'set_cond_area', 'audioui',
                // Camera and 3D parameters
                'camera_pose', 'fx', 'cx', 'fy', 'cy'
                // Note: 'text' and 'string' removed to avoid duplication with getTextBoxContent
            ];
        }

        if (nodeInfo.widgets && nodeInfo.widgets.length > 0) {
            for (const widget of nodeInfo.widgets) {
                const paramName = widget.name.toLowerCase();
                if (importantParams.some(param => paramName.includes(param))) {
                    parameters.push({
                        label: widget.name,
                        value: this.formatWidgetValue(widget.value)
                    });
                }
            }
        }

        return parameters;
    }

    /**
     * Format widget value for display.
     * @param value 
     * @returns 
     */
    formatWidgetValue(value: any): string {
        if (value === null) return "null";
        if (value === undefined) return "undefined";
        if (typeof value === "string") {
            return value; // Show full text without truncation
        }
        if (typeof value === "number") {
            return Number.isInteger(value) ? value.toString() : value.toFixed(3);
        }
        if (typeof value === "boolean") return value.toString();
        if (Array.isArray(value)) {
            return `Array(${value.length})`;
        }
        if (typeof value === "object") {
            return "Object";
        }
        return String(value);
    }

    /**
     * Inject CSS styles.
     */
    injectStyles(): void {
        if (!document.getElementById('magnify-info-panel-styles-v2')) {
            const style = document.createElement('style');
            style.id = 'magnify-info-panel-styles-v2';
            style.textContent = getInfoPanelCSS();
            document.head.appendChild(style);
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
