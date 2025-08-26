import { app } from "../../../scripts/app.js";

/**
 * ComfyUI Magnifying Glass - Professional Information Panel Extension (Refactored)
 * 
 * This script provides a professional, highly interactive information panel that displays 
 * detailed analysis of whatever you're hovering over when the magnifying glass is active.
 * 
 * Key Features:
 * - Unified state management
 * - Smooth mode transitions
 * - Improved pin functionality with drag support
 * - Lock feature to prevent dragging when pinned
 * - Clean control system
 * - Better positioning logic
 */

app.registerExtension({
    name: "comfyui.magnify.glass.info.panel.pro.v2",
    async setup() {
        // Wait for the main magnifying glass to be ready
        let magnifyGlass = null;
        let retryCount = 0;
        const maxRetries = 50;
        
        const waitForMagnifyGlass = () => {
            if (window.comfyUIMagnifyGlass) {
                magnifyGlass = window.comfyUIMagnifyGlass;
                console.log("ComfyUI Magnify Info Panel Pro V2: Found magnifying glass instance");
                initializeInfoPanel();
            } else if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(waitForMagnifyGlass, 100);
            } else {
                console.warn("ComfyUI Magnify Info Panel Pro V2: Could not find magnifying glass instance after 5 seconds");
            }
        };
        
        setTimeout(waitForMagnifyGlass, 100);
        
        function initializeInfoPanel() {
            // Default settings configuration
            const DEFAULT_SETTINGS = {
                "🔍MagnifyGlass.InfoPanelEnabled": true,
                "🔍MagnifyGlass.InfoPanelPosition": "Bottom",
                "🔍MagnifyGlass.InfoPanelWidth": 320,
                "🔍MagnifyGlass.InfoPanelOpacity": 100,
                "🔍MagnifyGlass.InfoPanelMaxHeight": 1000,
                "🔍MagnifyGlass.InfoPanelAnimations": false,
                "🔍MagnifyGlass.ShowInspectorTab": false,
                "🔍MagnifyGlass.ToggleHotkey": "i",
                "🔍MagnifyGlass.GlassPreviewToggleHotkey": "g",
                "🔍MagnifyGlass.PinPanelHotkey": "u",
                "🔍MagnifyGlass.ShowHoveringControls": true,
                "🔍MagnifyGlass.ControlsPosition": "bottom",
                "🔍MagnifyGlass.InfoPanelTextColor": "#6b7280",
                "🔍MagnifyGlass.InfoPanelAccentColor": "#3b82f6",
            };

            const getSettingValue = (key, defaultValue) => {
                try {
                    const value = app.ui.settings.getSettingValue(key);
                    return value === undefined ? defaultValue : value;
                } catch (e) {
                    console.warn(`ComfyUI Magnify Info Panel Pro V2: Could not get setting ${key}, using default ${defaultValue}. Error: ${e}`);
                    return defaultValue;
                }
            };
            
            /**
             * Centralized State Manager
             * Handles all state-related operations and provides clean state transitions
             */
            class StateManager {
                constructor() {
                    this.state = {
                        // Panel visibility and positioning
                        isPanelVisible: false,
                        isPanelMinimized: false,
                        isPanelPinned: false,
                        isPanelLocked: false, // New lock state
                        isAutoPinned: false, // Track if panel was auto-pinned by glass hide
                        pinnedPosition: { x: 0, y: 0 },
                        lastPinnedPosition: null, // Remember last pinned location
                        
                        // Glass visibility
                        isGlassPreviewVisible: true,
                        
                        // Section expansion
                        expandedSections: new Set(['node']),
                        
                        // Interaction states
                        isPanelHovered: false,
                        isHoveringNode: false,
                        
                        // Auto-collapse
                        autoExpandTimer: null,
                        lastNodeId: null,
                        
                        // Update scheduling
                        updateScheduled: false,
                        isInitialLoading: false,
                        
                        // Current data
                        currentInfo: {},
                        
                        // Settings cache
                        settings: {},
                        
                        // Auto-detected theme
                        currentTheme: 'dark' // Will be auto-detected
                    };
                    
                    this.initThemeDetection();
                    this.loadSettings();
                }
                
                initThemeDetection() {
                    // Immediate forced detection
                    console.log('ComfyUI Magnify Glass: Starting theme detection...');
                    
                    // Detect ComfyUI's current theme
                    this.detectCurrentTheme();
                    
                    // Force an immediate check in case we missed the initial state
                    setTimeout(() => {
                        console.log('ComfyUI Magnify Glass: Delayed theme check...');
                        if (this.detectCurrentTheme()) {
                            this.notifyThemeChange();
                        }
                    }, 1000);
                    
                    // Set up mutation observer to watch for theme changes
                    this.setupThemeObserver();
                    
                    // Listen for system theme changes as fallback
                    if (window.matchMedia) {
                        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)');
                        prefersDark.addListener(() => this.detectCurrentTheme());
                    }
                    
                    // Add click listener to theme toggle buttons for immediate detection
                    this.setupThemeButtonListeners();
                }
                
                detectCurrentTheme() {
                    let detectedTheme = 'dark'; // Default fallback
                    
                    const body = document.body;
                    const html = document.documentElement;
                    const vueApp = document.querySelector('#vue-app');
                    const sidebar = document.querySelector('.comfy-menu, .sidebar, .menu, [class*="sidebar"], [class*="menu"]');
                    
                    // Get all possible theme-related elements
                    const allElements = [body, html, vueApp, sidebar].filter(Boolean);
                    
                    // Debug: Log current classes and attributes with more detail
                    const debugInfo = {
                        bodyClasses: Array.from(body.classList),
                        htmlClasses: Array.from(html.classList),
                        bodyDataTheme: body.getAttribute('data-theme'),
                        htmlDataTheme: html.getAttribute('data-theme'),
                        vueAppClasses: vueApp ? Array.from(vueApp.classList) : null,
                        sidebarClasses: sidebar ? Array.from(sidebar.classList) : null,
                        bodyBgColor: window.getComputedStyle(body).backgroundColor,
                        htmlBgColor: window.getComputedStyle(html).backgroundColor,
                        allComputedVars: {}
                    };
                    
                    // Check CSS variables
                    const rootStyles = window.getComputedStyle(html);
                    const bodyStyles = window.getComputedStyle(body);
                    
                    // Get all CSS custom properties
                    for (let i = 0; i < rootStyles.length; i++) {
                        const prop = rootStyles[i];
                        if (prop.startsWith('--')) {
                            debugInfo.allComputedVars[prop] = rootStyles.getPropertyValue(prop).trim();
                        }
                    }
                    
                    console.log('ComfyUI Magnify Glass: Comprehensive theme detection debug:', debugInfo);
                    
                    // Method 1: Look for specific light theme indicators in CSS variables
                    const primarySurface = rootStyles.getPropertyValue('--p-primary-color') || 
                                          rootStyles.getPropertyValue('--primary-color') ||
                                          bodyStyles.getPropertyValue('--p-primary-color') ||
                                          bodyStyles.getPropertyValue('--primary-color');
                    
                    const surfaceGround = rootStyles.getPropertyValue('--p-surface-ground') || 
                                         rootStyles.getPropertyValue('--surface-ground') ||
                                         bodyStyles.getPropertyValue('--p-surface-ground') ||
                                         bodyStyles.getPropertyValue('--surface-ground');
                    
                    const textColor = rootStyles.getPropertyValue('--p-text-color') || 
                                     rootStyles.getPropertyValue('--text-color') ||
                                     bodyStyles.getPropertyValue('--p-text-color') ||
                                     bodyStyles.getPropertyValue('--text-color');
                    
                    console.log('ComfyUI Magnify Glass: CSS Variables:', { primarySurface, surfaceGround, textColor });
                    
                    // Method 2: Analyze background colors of multiple elements
                    const backgrounds = allElements.map(el => {
                        const styles = window.getComputedStyle(el);
                        return {
                            element: el.tagName || el.className,
                            backgroundColor: styles.backgroundColor,
                            color: styles.color
                        };
                    });
                    
                    console.log('ComfyUI Magnify Glass: Background analysis:', backgrounds);
                    
                    // Method 3: Check for light backgrounds
                    for (const bg of backgrounds) {
                        if (bg.backgroundColor && bg.backgroundColor !== 'rgba(0, 0, 0, 0)' && bg.backgroundColor !== 'transparent') {
                            const rgbMatch = bg.backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                            if (rgbMatch) {
                                const [, r, g, b] = rgbMatch.map(Number);
                                const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                                console.log(`ComfyUI Magnify Glass: Element ${bg.element} brightness: ${brightness}`);
                                if (brightness > 180) { // Higher threshold for light detection
                                    detectedTheme = 'light';
                                    console.log(`ComfyUI Magnify Glass: Light theme detected via background analysis of ${bg.element}`);
                                    break;
                                }
                            }
                        }
                    }
                    
                    // Method 4: Check for theme toggle buttons state (they might indicate current theme)
                    const themeButtons = document.querySelectorAll('[class*="theme"], button[title*="theme"], button[title*="Theme"], .p-button[title*="light"], .p-button[title*="Light"]');
                    themeButtons.forEach(btn => {
                        console.log('ComfyUI Magnify Glass: Found theme button:', {
                            classes: Array.from(btn.classList),
                            text: btn.textContent,
                            title: btn.title,
                            active: btn.classList.contains('active') || btn.classList.contains('selected')
                        });
                    });
                    
                    // Method 5: Force light theme detection if we see light backgrounds
                    if (detectedTheme === 'dark') {
                        // Look for any element with very light background
                        const lightElements = document.querySelectorAll('*');
                        for (let i = 0; i < Math.min(lightElements.length, 50); i++) { // Check first 50 elements
                            const el = lightElements[i];
                            const styles = window.getComputedStyle(el);
                            const bgColor = styles.backgroundColor;
                            
                            if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)' && bgColor !== 'transparent') {
                                const rgbMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                                if (rgbMatch) {
                                    const [, r, g, b] = rgbMatch.map(Number);
                                    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
                                    if (brightness > 200) { // Very light elements
                                        detectedTheme = 'light';
                                        console.log(`ComfyUI Magnify Glass: Light theme forced via element ${el.tagName}.${el.className} with brightness ${brightness}`);
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    
                    // Update theme if it changed
                    if (this.state.currentTheme !== detectedTheme) {
                        console.log(`ComfyUI Magnify Glass: Theme changed from ${this.state.currentTheme} to ${detectedTheme}`);
                        this.state.currentTheme = detectedTheme;
                        return true; // Theme changed
                    }
                    
                    console.log(`ComfyUI Magnify Glass: Current theme remains: ${detectedTheme}`);
                    return false; // No change
                }
                
                setupThemeObserver() {
                    // Watch for changes to body/html classes and attributes
                    const observer = new MutationObserver((mutations) => {
                        let shouldCheck = false;
                        mutations.forEach((mutation) => {
                            if (mutation.type === 'attributes' && 
                                (mutation.attributeName === 'class' || 
                                 mutation.attributeName === 'data-theme' ||
                                 mutation.attributeName === 'style')) {
                                shouldCheck = true;
                                console.log('ComfyUI Magnify Glass: DOM change detected:', {
                                    target: mutation.target.tagName,
                                    attribute: mutation.attributeName,
                                    oldValue: mutation.oldValue,
                                    newValue: mutation.target.getAttribute(mutation.attributeName)
                                });
                            }
                        });
                        
                        if (shouldCheck && this.detectCurrentTheme()) {
                            // Theme changed, update UI immediately
                            this.notifyThemeChange();
                        }
                    });
                    
                    // Observe changes to body, html, and vue app
                    observer.observe(document.body, { attributes: true, attributeOldValue: true });
                    observer.observe(document.documentElement, { attributes: true, attributeOldValue: true });
                    
                    const vueApp = document.querySelector('#vue-app');
                    if (vueApp) {
                        observer.observe(vueApp, { attributes: true, attributeOldValue: true });
                    }
                    
                    // Also watch for changes to any element with theme-related classes
                    const themeElements = document.querySelectorAll('[class*="theme"], [class*="dark"], [class*="light"], [data-theme]');
                    themeElements.forEach(el => {
                        observer.observe(el, { attributes: true, attributeOldValue: true });
                    });
                    
                    // Periodic fallback check every 2 seconds
                    setInterval(() => {
                        if (this.detectCurrentTheme()) {
                            this.notifyThemeChange();
                        }
                    }, 2000);
                }
                
                setupThemeButtonListeners() {
                    // Listen for clicks on theme toggle buttons
                    document.addEventListener('click', (e) => {
                        // Check if clicked element might be a theme toggle
                        const target = e.target;
                        const isThemeButton = target.textContent?.toLowerCase().includes('theme') ||
                                            target.textContent?.toLowerCase().includes('light') ||
                                            target.textContent?.toLowerCase().includes('dark') ||
                                            target.title?.toLowerCase().includes('theme') ||
                                            target.className?.toLowerCase().includes('theme');
                        
                        if (isThemeButton) {
                            console.log('ComfyUI Magnify Glass: Theme button clicked, triggering detection');
                            setTimeout(() => {
                                if (this.detectCurrentTheme()) {
                                    this.notifyThemeChange();
                                }
                            }, 100);
                        }
                    });
                }
                
                notifyThemeChange() {
                    // Update settings to reflect new theme
                    this.state.settings["🔍MagnifyGlass.InfoPanelTheme"] = this.state.currentTheme;
                    
                    // Notify UI components of theme change immediately
                    if (window.infoPanelManager && window.infoPanelManager.uiManager) {
                        window.infoPanelManager.uiManager.updateTheme(this.state.currentTheme);
                    }
                }
                
                loadSettings() {
                    Object.keys(DEFAULT_SETTINGS).forEach(key => {
                        // Skip the theme setting since we auto-detect it
                        if (key !== "🔍MagnifyGlass.InfoPanelTheme") {
                            this.state.settings[key] = getSettingValue(key, DEFAULT_SETTINGS[key]);
                        }
                    });
                    
                    // Set theme to auto-detected value
                    this.state.settings["🔍MagnifyGlass.InfoPanelTheme"] = this.state.currentTheme;
                }
                
                updateSettings() {
                    const oldSettings = { ...this.state.settings };
                    this.loadSettings();
                    
                    // Return what changed for reactive updates
                    const changes = {};
                    Object.keys(this.state.settings).forEach(key => {
                        if (oldSettings[key] !== this.state.settings[key]) {
                            changes[key] = {
                                old: oldSettings[key],
                                new: this.state.settings[key]
                            };
                        }
                    });
                    
                    return changes;
                }
                
                togglePanelVisibility() {
                    this.state.isPanelVisible = !this.state.isPanelVisible;
                    console.log(`Info panel visibility toggled to ${this.state.isPanelVisible ? 'visible' : 'hidden'}`);
                    return this.state.isPanelVisible;
                }
                
                toggleGlassPreview() {
                    this.state.isGlassPreviewVisible = !this.state.isGlassPreviewVisible;
                    console.log(`Glass preview visibility toggled to ${this.state.isGlassPreviewVisible ? 'visible' : 'hidden'}`);
                    return this.state.isGlassPreviewVisible;
                }
                
                togglePinning() {
                    const wasPinned = this.state.isPanelPinned;
                    this.state.isPanelPinned = !this.state.isPanelPinned;
                    
                    // When unpinning, also unlock and clear auto-pin flag
                    if (!this.state.isPanelPinned) {
                        this.state.isPanelLocked = false;
                        this.state.isAutoPinned = false; // Clear auto-pin flag when manually unpinning
                    }
                    
                    if (this.state.isPanelPinned && this.state.lastPinnedPosition) {
                        // Restore to last pinned position
                        this.state.pinnedPosition = { ...this.state.lastPinnedPosition };
                        console.log(`Panel pinned at remembered position: (${this.state.pinnedPosition.x}, ${this.state.pinnedPosition.y})`);
                    } else if (!this.state.isPanelPinned && wasPinned) {
                        // Save current position when unpinning
                        this.state.lastPinnedPosition = { ...this.state.pinnedPosition };
                        console.log(`Panel unpinned, position saved: (${this.state.lastPinnedPosition.x}, ${this.state.lastPinnedPosition.y})`);
                    }
                    
                    console.log(`Panel ${this.state.isPanelPinned ? 'pinned' : 'unpinned'}`);
                    return this.state.isPanelPinned;
                }
                
                toggleLocking() {
                    // Only allow locking when pinned
                    if (!this.state.isPanelPinned) {
                        console.log("Cannot lock panel when not pinned");
                        return false;
                    }
                    
                    this.state.isPanelLocked = !this.state.isPanelLocked;
                    console.log(`Panel ${this.state.isPanelLocked ? 'locked' : 'unlocked'}`);
                    return this.state.isPanelLocked;
                }
                
                toggleMinimized() {
                    this.state.isPanelMinimized = !this.state.isPanelMinimized;
                    return this.state.isPanelMinimized;
                }
                
                toggleSection(sectionId) {
                    if (sectionId === 'node') return false; // Node section always expanded
                    
                    if (this.state.expandedSections.has(sectionId)) {
                        this.state.expandedSections.delete(sectionId);
                    } else {
                        this.state.expandedSections.add(sectionId);
                    }
                    return true;
                }
                
                setPinnedPosition(x, y) {
                    this.state.pinnedPosition = { x, y };
                    // Also save as last pinned position for memory
                    this.state.lastPinnedPosition = { x, y };
                }
                
                setCurrentInfo(info) {
                    this.state.currentInfo = info;
                }
                
                scheduleAutoCollapse() {
                    this.clearAutoExpandTimer();
                    if (this.state.settings["🔍MagnifyGlass.InfoPanelAnimations"]) {
                        this.state.autoExpandTimer = setTimeout(() => {
                            if (!this.state.isPanelHovered) {
                                this.collapseNodeSections();
                            }
                        }, 1500);
                    }
                }
                
                clearAutoExpandTimer() {
                    if (this.state.autoExpandTimer) {
                        clearTimeout(this.state.autoExpandTimer);
                        this.state.autoExpandTimer = null;
                    }
                }
                
                expandNodeSections() {
                    this.state.expandedSections.add('hoveredNode');
                    this.state.expandedSections.add('node');
                    this.state.expandedSections.add('cursor');
                    this.state.expandedSections.add('canvas');
                    this.state.expandedSections.add('magnifier');
                    this.clearAutoExpandTimer();
                }
                
                collapseNodeSections() {
                    this.state.expandedSections.delete('hoveredNode');
                    this.state.expandedSections.delete('node');
                    this.state.expandedSections.delete('widget');
                }
                
                cleanup() {
                    this.clearAutoExpandTimer();
                }
            }
            
            /**
             * UI Manager
             * Handles all DOM manipulation and UI creation
             */
            class UIManager {
                constructor(stateManager) {
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
                
                createPanel() {
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
                
                createFloatingControls() {
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
                
                updateControlStates() {
                    if (!this.elements.controls) return;
                    
                    const pinBtn = this.elements.controls.querySelector('[data-action="pin"]');
                    const lockBtn = this.elements.controls.querySelector('[data-action="lock"]');
                    const visibilityBtn = this.elements.controls.querySelector('[data-action="toggle-panel"]');
                    const glassBtn = this.elements.controls.querySelector('[data-action="toggle-glass"]');
                    
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
                
                updateControlsLayout(position) {
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
                
                applyStyles() {
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
                            this.elements.panel.style.opacity = opacityPercent / 100;
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
                
                show() {
                    if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"]) {
                        this.elements.panel.style.display = "block";
                        if (this.elements.controls) {
                            this.elements.controls.style.display = "flex";
                        }
                        // Apply user's opacity setting when showing (convert percentage to decimal)
                        const opacityPercent = this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelOpacity"];
                        this.elements.panel.style.opacity = opacityPercent / 100;
                        // Trigger reflow
                        this.elements.panel.offsetHeight;
                        this.elements.panel.classList.add('visible');
                        this.stateManager.state.isPanelVisible = true;
                    }
                }
                
                hide() {
                    this.elements.panel.classList.remove('visible');
                    setTimeout(() => {
                        if (!this.stateManager.state.isPanelVisible) {
                            this.elements.panel.style.display = "none";
                            if (this.elements.controls) {
                                this.elements.controls.style.display = "none";
                            }
                        }
                    }, this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelAnimations"] ? 300 : 0);
                    this.stateManager.state.isPanelVisible = false;
                }
                
                updateMinimizedState() {
                    this.elements.panel.classList.toggle('panel-minimized', this.stateManager.state.isPanelMinimized);
                    const minimizeBtn = this.elements.header.querySelector('.minimize-btn');
                    if (minimizeBtn) {
                        minimizeBtn.textContent = this.stateManager.state.isPanelMinimized ? '+' : '−';
                        minimizeBtn.title = this.stateManager.state.isPanelMinimized ? 'Expand Panel' : 'Minimize Panel';
                    }
                }
                
                updatePinnedState() {
                    this.elements.panel.classList.toggle('panel-pinned', this.stateManager.state.isPanelPinned);
                    this.elements.panel.classList.toggle('panel-locked', this.stateManager.state.isPanelLocked);
                    this.updateControlStates();
                }
                
                updateTheme(newTheme) {
                    if (this.elements.panel) {
                        this.elements.panel.className = this.elements.panel.className.replace(/theme-\w+/, `theme-${newTheme.toLowerCase()}`);
                        console.log(`ComfyUI Magnify Glass: Panel theme updated to ${newTheme}`);
                    }
                }
                
                displayInfo(info) {
                    const sections = this.buildSections(info);
                    this.renderSections(sections);
                    this.updateSectionStates();
                    this.updateHeaderSubtitle(info);
                }
                
                buildSections(info) {
                    const sections = [];
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
                        const nodeType = info.hoveredNode.type.toLowerCase();
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
                                } else if (typeof imageInfo === 'object') {
                                    nodeContent.push({ label: 'Image Size', value: `${imageInfo.width}×${imageInfo.height}` });
                                    if (imageInfo.src) {
                                        nodeContent.push({ label: 'Image Source', value: imageInfo.src });
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
                
                renderSections(sections) {
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
                                    ${section.content.map(item => {
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
                
                updateSectionStates() {
                    const sections = this.elements.content.querySelectorAll('.info-section');
                    sections.forEach(section => {
                        const sectionId = section.dataset.section;
                        const header = section.querySelector('.section-header');
                        const content = section.querySelector('.section-content');
                        
                        if (this.stateManager.state.expandedSections.has(sectionId)) {
                            header.classList.add('expanded');
                            content.classList.add('expanded');
                        } else {
                            header.classList.remove('expanded');
                            content.classList.remove('expanded');
                        }
                    });
                }
                
                formatValue(value, label) {
                    if (!value) return value;

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
                
                getValueClass(value) {
                    if (!value) return '';

                    const str = String(value);
                    let classes = [];

                    // Mark text that might benefit from special styling for readability
                    if (str.length > 100) {
                        classes.push('long-text');
                    }

                    return classes.join(' ');
                }
                
                getValueAttributes(value) {
                    // Since we show full text now, we don't need title attributes for long text
                    // Only add title for very long text that might benefit from tooltips
                    if (!value) return '';

                    const str = String(value);
                    if (str.length > 500) { // Only for extremely long text
                        return `title="${str.replace(/"/g, '&quot;')}"`;
                    }

                    return '';
                }
                
                updateHeaderSubtitle(info) {
                    const subtitleElement = this.elements.header.querySelector('.header-subtitle');
                    if (subtitleElement) {
                        const accentColor = this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelAccentColor"];
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
                
                // Helper methods for node information extraction
                getCheckpointInfo(nodeInfo) {
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
                
                getImageInfo(nodeInfo) {
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
                
                getTextBoxContent(nodeInfo) {
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
                
                getImportantNodeParameters(nodeInfo) {
                    const parameters = [];

                    // For complex nodes that have many parameters, show ALL widgets
                    const nodeType = nodeInfo.type.toLowerCase();
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
                                    // These are handled by specific extraction methods for simple nodes
                                    if (widgetName.includes('title') ||
                                        widgetName === 'node' ||
                                        widgetName === 'id' ||
                                        widgetName === 'type' ||
                                        widgetName === 'mode') {
                                        continue;
                                    }

                                    parameters.push({
                                        label: widget.name,
                                        value: this.formatValue(widget.value)
                                    });
                                }
                            }
                        }
                        return parameters;
                    }

                    // Special handling for Save nodes - only show essential parameters
                    let importantParams;
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
                                    value: this.formatValue(widget.value)
                                });
                            }
                        }
                    }

                    return parameters;
                }
                
                formatValue(value) {
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
                
                injectStyles() {
                    if (!document.getElementById('magnify-info-panel-styles-v2')) {
                        const style = document.createElement('style');
                        style.id = 'magnify-info-panel-styles-v2';
                        style.textContent = this.getCSS();
                        document.head.appendChild(style);
                    }
                }
                
                getCSS() {
                    return `
                        .magnify-info-panel {
                            border-radius: 12px;
                            backdrop-filter: blur(20px);
                            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.1);
                            overflow: hidden;
                            font-size: 16px;
                            line-height: 1.6;
                            pointer-events: auto;
                        }
                        
                        .magnify-info-panel * {
                            pointer-events: auto;
                        }
                        
                        .magnify-info-panel.theme-dark {
                            background: linear-gradient(135deg, rgba(0, 0, 0, 0.96), rgba(10, 10, 15, 0.96));
                            color: var(--info-panel-text-color, #e0e0e0);
                            border: 1px solid rgba(100, 100, 120, 0.4);
                            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3), 0 2px 16px rgba(0, 0, 0, 0.2);
                            backdrop-filter: blur(12px);
                        }
                        
                        .magnify-info-panel.theme-light {
                            background: linear-gradient(135deg, rgba(250, 250, 255, 0.96), rgba(240, 240, 250, 0.96));
                            color: var(--info-panel-text-color, #2a2a2a);
                            border: 1px solid rgba(200, 200, 220, 0.5);
                            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 16px rgba(0, 0, 0, 0.05);
                            backdrop-filter: blur(12px);
                        }
                        
                        .magnify-info-panel.visible {
                            transform: translateY(0) !important;
                        }
                        
                        .magnify-info-panel.panel-pinned {
                            cursor: grab;
                            box-shadow: 0 0 0 2px rgba(255, 215, 0, 0.5), 0 20px 40px rgba(0, 0, 0, 0.3);
                        }
                        
                        .magnify-info-panel.panel-locked {
                            cursor: default !important;
                            box-shadow: 0 0 0 2px rgba(255, 69, 0, 0.5), 0 20px 40px rgba(0, 0, 0, 0.3);
                        }
                        
                        .magnify-info-panel.panel-locked::after {
                            content: '📌';
                            position: absolute;
                            top: 8px;
                            right: 8px;
                            font-size: 14px;
                            opacity: 0.7;
                            pointer-events: none;
                            z-index: 1;
                        }
                        
                        .magnify-info-panel.panel-pinned.panel-dragging {
                            cursor: grabbing;
                            box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(255, 215, 0, 0.7);
                            transform: scale(1.02) !important;
                            z-index: 100001 !important;
                            transition: none !important;
                        }
                        
                        .magnify-info-panel.panel-pinned::before {
                            content: '';
                            position: absolute;
                            left: 0;
                            top: 0;
                            right: 0;
                            bottom: 0;
                            background: linear-gradient(45deg, rgba(255, 215, 0, 0.05) 0%, transparent 100%);
                            pointer-events: none;
                            border-radius: inherit;
                        }
                        
                        .panel-dragging * {
                            pointer-events: none !important;
                            user-select: none !important;
                            transition: none !important;
                        }
                        
                        .magnify-info-panel.panel-minimized .panel-content {
                            max-height: 0 !important;
                            overflow: hidden;
                            transition: max-height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        }
                        
                        .floating-controls {
                            position: fixed;
                            display: flex;
                            padding: 4px;
                            background: rgba(40, 40, 50, 0.95);
                            border: 1px solid rgba(255, 255, 255, 0.3);
                            border-radius: 4px;
                            opacity: 1;
                            z-index: 100000;
                            backdrop-filter: blur(8px);
                            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
                        }
                        
                        .floating-controls.vertical-layout {
                            flex-direction: column;
                            gap: 4px;
                        }
                        
                        .floating-controls.horizontal-layout {
                            flex-direction: row;
                            gap: 4px;
                        }
                        
                        .control-btn {
                            background: rgba(60, 60, 70, 0.8);
                            border: 1px solid rgba(255, 255, 255, 0.2);
                            width: 28px;
                            height: 28px;
                            font-size: 14px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            cursor: pointer;
                            color: #ddd;
                            border-radius: 3px;
                            transition: background-color 0.15s ease;
                        }
                        
                        .control-btn:hover {
                            background: rgba(80, 80, 90, 0.9);
                            color: white;
                        }
                        
                        .control-btn:active {
                            background: rgba(100, 100, 110, 0.9);
                        }
                        
                        .control-btn:disabled {
                            background: rgba(40, 40, 50, 0.5);
                            color: #666;
                            cursor: not-allowed;
                            opacity: 0.5;
                        }
                        
                        .control-btn.active {
                            background: rgba(255, 200, 50, 0.3);
                            border-color: rgba(255, 200, 50, 0.6);
                            color: #ffcc33;
                        }
                        
                        .control-btn.lock-btn.active {
                            background: rgba(255, 69, 0, 0.3);
                            border-color: rgba(255, 69, 0, 0.6);
                            color: #ff4500;
                        }
                        
                        .panel-header {
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            padding: 14px 18px;
                            background: linear-gradient(135deg, rgba(0, 0, 0, 0.1), rgba(255, 255, 255, 0.05));
                            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                            user-select: none;
                        }
                        
                        .header-content {
                            display: flex;
                            align-items: center;
                            gap: 10px;
                        }
                        
                        .header-icon {
                            font-size: 18px;
                            opacity: 0.9;
                        }
                        
                        .header-title {
                            font-weight: 600;
                            font-size: 18px;
                        }
                        
                        .header-subtitle {
                            font-size: 14px;
                            opacity: 0.7;
                            font-style: italic;
                        }
                        
                        .header-controls {
                            display: flex;
                            gap: 6px;
                        }
                        
                        .minimize-btn {
                            background: rgba(255, 255, 255, 0.1);
                            border: none;
                            border-radius: 6px;
                            color: inherit;
                            width: 28px;
                            height: 28px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            cursor: pointer;
                            transition: all 0.2s;
                            font-weight: bold;
                            font-size: 16px;
                        }
                        
                        .minimize-btn:hover {
                            background: rgba(255, 255, 255, 0.2);
                            transform: scale(1.05);
                        }
                        
                        .minimize-btn:active {
                            transform: scale(0.95);
                        }
                        
                        .panel-content {
                            padding: 0;
                            max-height: calc(100% - 60px);
                            overflow-y: auto;
                            scrollbar-width: thin;
                        }
                        
                        .panel-content::-webkit-scrollbar {
                            width: 8px;
                        }
                        
                        .panel-content::-webkit-scrollbar-track {
                            background: rgba(0, 0, 0, 0.1);
                        }
                        
                        .panel-content::-webkit-scrollbar-thumb {
                            background: rgba(255, 255, 255, 0.3);
                            border-radius: 3px;
                        }
                        
                        .info-section {
                            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                            margin-bottom: 8px;
                            border-radius: 10px;
                            overflow: visible;
                            background: rgba(255, 255, 255, 0.02);
                            transition: all 0.3s ease;
                        }
                        
                        .info-section:hover {
                            background: rgba(255, 255, 255, 0.04);
                            transform: translateY(-1px);
                        }
                        
                        .section-header {
                            display: flex;
                            align-items: center;
                            gap: 12px;
                            padding: 16px 20px;
                            cursor: pointer;
                            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                            font-weight: 500;
                            border-radius: 8px;
                            margin: 3px;
                            position: relative;
                            overflow: hidden;
                        }
                        
                        .section-header::before {
                            content: '';
                            position: absolute;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            background: linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.05) 50%, transparent 100%);
                            transform: translateX(-100%);
                            transition: transform 0.6s ease;
                        }
                        
                        .section-header:hover::before {
                            transform: translateX(100%);
                        }
                        
                        .section-header:hover {
                            background: rgba(255, 255, 255, 0.08);
                            transform: translateX(2px);
                            box-shadow: inset 2px 0 0 rgba(116, 185, 255, 0.5);
                        }
                        
                        .section-header:active {
                            background: rgba(255, 255, 255, 0.12);
                            transform: translateX(1px);
                        }
                        
                        .section-header.expanded {
                            background: rgba(116, 185, 255, 0.1);
                            border-left: 2px solid var(--info-panel-accent-color, #74b9ff);
                        }
                        
                        .info-section[data-section="node"] {
                            background: linear-gradient(135deg, rgba(116, 185, 255, 0.05), rgba(160, 212, 104, 0.05));
                            border: 1px solid rgba(116, 185, 255, 0.2);
                            border-radius: 8px;
                            margin: 6px;
                        }
                        
                        .info-section[data-section="node"] .section-header {
                            background: linear-gradient(135deg, rgba(116, 185, 255, 0.15), rgba(160, 212, 104, 0.15));
                            border-radius: 8px 8px 0 0;
                            cursor: default;
                        }
                        
                        .info-section[data-section="node"] .section-header:hover {
                            transform: none;
                            box-shadow: none;
                        }
                        
                        .info-section[data-section="node"] .section-title {
                            color: var(--info-panel-accent-color, #74b9ff);
                            font-weight: 700;
                        }
                        
                        .info-section[data-section="inspector"] {
                            background: linear-gradient(135deg, rgba(100, 150, 255, 0.05), rgba(74, 144, 226, 0.05));
                            border: 1px solid rgba(100, 150, 255, 0.2);
                            border-radius: 8px;
                            margin: 6px;
                        }
                        
                        .info-section[data-section="inspector"] .section-header {
                            background: linear-gradient(135deg, rgba(100, 150, 255, 0.15), rgba(74, 144, 226, 0.15));
                            border-radius: 8px 8px 0 0;
                        }
                        
                        .info-section[data-section="inspector"] .section-title {
                            color: #6496ff;
                            font-weight: 700;
                        }
                        
                        .info-section[data-section="media"] {
                            background: linear-gradient(135deg, rgba(253, 203, 110, 0.05), rgba(255, 215, 0, 0.05));
                            border: 1px solid rgba(253, 203, 110, 0.2);
                            border-radius: 8px;
                            margin: 6px;
                        }
                        
                        .info-section[data-section="media"] .section-header {
                            background: linear-gradient(135deg, rgba(253, 203, 110, 0.15), rgba(255, 215, 0, 0.15));
                            border-radius: 8px 8px 0 0;
                        }
                        
                        .info-section[data-section="media"] .section-title {
                            color: var(--info-panel-accent-color, #fdcb6e);
                            font-weight: 700;
                        }
                        
                        .section-icon {
                            font-size: 18px;
                            width: 22px;
                            text-align: center;
                        }
                        
                        .section-title {
                            flex: 1;
                            font-size: 16px;
                            font-weight: 600;
                            letter-spacing: 0.3px;
                            text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
                        }
                        
                        .section-badge {
                            background: rgba(100, 150, 255, 0.2);
                            color: #8bb3ff;
                            padding: 3px 10px;
                            border-radius: 10px;
                            font-size: 13px;
                            font-weight: 500;
                        }
                        
                        .expand-icon {
                            font-size: 14px;
                            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                            color: rgba(255, 255, 255, 0.6);
                            width: 20px;
                            height: 20px;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            border-radius: 50%;
                            background: rgba(255, 255, 255, 0.05);
                            margin-left: auto;
                        }
                        
                        .section-header:hover .expand-icon {
                            color: var(--info-panel-accent-color, #74b9ff);
                            background: rgba(116, 185, 255, 0.15);
                            transform: scale(1.1);
                        }
                        
                        .section-header.expanded .expand-icon {
                            transform: rotate(90deg) scale(1.1);
                            color: var(--info-panel-accent-color, #74b9ff);
                            background: rgba(116, 185, 255, 0.2);
                        }
                        
                        .section-content {
                            max-height: 0;
                            overflow: visible;
                            transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease;
                            opacity: 0;
                        }

                        .section-content.expanded {
                            max-height: 2000px;
                            opacity: 1;
                            overflow: visible;
                        }
                        
                        .section-body {
                            padding: 0 18px 16px 24px;
                        }
                        
                        .info-row {
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-start;
                            padding: 10px 0;
                            border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                            transition: all 0.2s ease;
                            border-radius: 4px;
                            margin: 0 -8px;
                            padding-left: 8px;
                            padding-right: 8px;
                        }
                        
                        .info-row:last-child {
                            border-bottom: none;
                        }
                        
                        .info-row:hover {
                            background: rgba(255, 255, 255, 0.03);
                            border-bottom-color: rgba(255, 255, 255, 0.08);
                        }
                        
                        .info-label {
                            font-weight: 500;
                            opacity: 0.85;
                            font-size: 15px;
                            min-width: 80px;
                            padding-right: 12px;
                            line-height: 1.5;
                        }
                        
                        .info-value {
                            font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
                            font-size: 14px;
                            color: var(--info-panel-accent-color, #a0d468);
                            background: rgba(160, 212, 104, 0.12);
                            padding: 4px 10px;
                            border-radius: 6px;
                            max-width: 100%;
                            word-wrap: break-word;
                            word-break: break-word;
                            hyphens: auto;
                            line-height: 1.4;
                            text-align: left;
                            white-space: pre-wrap;
                            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
                            transition: all 0.2s ease;
                        }
                        
                        .info-value:hover {
                            background: rgba(160, 212, 104, 0.18);
                            transform: translateY(-1px);
                            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                        }
                        
                        .info-value.long-text {
                            white-space: pre-wrap;
                            word-wrap: break-word;
                            max-width: 100%;
                            line-height: 1.4;
                        }
                        
                        .empty-state {
                            text-align: center;
                            padding: 50px 25px;
                            opacity: 0.6;
                        }
                        
                        .empty-state-icon {
                            font-size: 36px;
                            margin-bottom: 15px;
                            opacity: 0.5;
                        }
                        
                        /* Copy to clipboard functionality */
                        .info-value[title]:hover::after {
                            content: '📋';
                            position: absolute;
                            right: -20px;
                            top: 50%;
                            transform: translateY(-50%);
                            font-size: 12px;
                            opacity: 0.7;
                        }
                        
                        /* Smooth loading states */
                        .section-body.loading {
                            opacity: 0.5;
                            pointer-events: none;
                        }
                        
                        .section-body.loading::after {
                            content: '';
                            position: absolute;
                            top: 50%;
                            left: 50%;
                            width: 20px;
                            height: 20px;
                            border: 2px solid transparent;
                            border-top: 2px solid var(--info-panel-accent-color, #74b9ff);
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                            transform: translate(-50%, -50%);
                        }
                        
                        @keyframes spin {
                            to { transform: translate(-50%, -50%) rotate(360deg); }
                        }
                        
                        /* Enhanced scrollbar for better UX */
                        .section-body::-webkit-scrollbar {
                            width: 4px;
                        }
                        
                        .section-body::-webkit-scrollbar-track {
                            background: rgba(255, 255, 255, 0.05);
                            border-radius: 2px;
                        }
                        
                        .section-body::-webkit-scrollbar-thumb {
                            background: var(--info-panel-accent-color, #74b9ff);
                            border-radius: 2px;
                            opacity: 0.6;
                        }
                        
                        .section-body::-webkit-scrollbar-thumb:hover {
                            opacity: 1;
                        }
                        
                        .empty-state-text {
                            font-size: 16px;
                            font-style: italic;
                        }
                        
                        @keyframes pulse {
                            0%, 100% { opacity: 1; }
                            50% { opacity: 0.7; }
                        }
                        
                        .pulse {
                            animation: pulse 2s infinite;
                        }
                    `;
                }
                
                cleanup() {
                    if (this.elements.panel) {
                        this.elements.panel.remove();
                    }
                    
                    if (this.elements.controls) {
                        this.elements.controls.remove();
                    }
                    
                    const styles = document.getElementById('magnify-info-panel-styles-v2');
                    if (styles) {
                        styles.remove();
                    }
                }
            }
            
            /**
             * Position Manager
             * Handles all positioning logic including pinning and boundary checking
             */
            class PositionManager {
                constructor(stateManager, uiManager) {
                    this.stateManager = stateManager;
                    this.uiManager = uiManager;
                }
                
                positionPanel() {
                    if (!this.uiManager.elements.panel) return;
                    
                    // If panel is pinned, keep it at its pinned position
                    if (this.stateManager.state.isPanelPinned) {
                        this.applyPinnedPosition();
                        this.positionFloatingControls();
                        return;
                    }
                    
                    // Normal positioning logic
                    this.calculateNormalPosition();
                    this.positionFloatingControls();
                }
                
                positionFloatingControls() {
                    if (!this.uiManager.elements.controls) return;
                    
                    const panelRect = this.uiManager.elements.panel.getBoundingClientRect();
                    const controlsPosition = this.stateManager.state.settings["🔍MagnifyGlass.ControlsPosition"] || "top-right";
                    
                    let idealX, idealY;
                    // Determine dimensions based on layout. Fallback values are estimates.
                    const isHorizontal = ['top', 'bottom'].includes(controlsPosition);
                    const controlsWidth = this.uiManager.elements.controls.offsetWidth || (isHorizontal ? 160 : 40);
                    const controlsHeight = this.uiManager.elements.controls.offsetHeight || (isHorizontal ? 40 : 160);
                    const margin = 5;
                    
                    // Determine the ideal, unconstrained position for the controls
                    switch (controlsPosition) {
                        case "top-left":
                            idealX = panelRect.left - controlsWidth - margin;
                            idealY = panelRect.top;
                            break;
                        case "top-right":
                            idealX = panelRect.right + margin;
                            idealY = panelRect.top;
                            break;
                        case "bottom-left":
                            idealX = panelRect.left - controlsWidth - margin;
                            idealY = panelRect.bottom - controlsHeight;
                            break;
                        case "bottom-right":
                            idealX = panelRect.right + margin;
                            idealY = panelRect.bottom - controlsHeight;
                            break;
                        case "top":
                            idealX = panelRect.left + (panelRect.width - controlsWidth) / 2;
                            idealY = panelRect.top - controlsHeight - margin;
                            break;
                        case "bottom":
                            idealX = panelRect.left + (panelRect.width - controlsWidth) / 2;
                            idealY = panelRect.bottom + margin;
                            break;
                        case "left":
                            idealX = panelRect.left - controlsWidth - margin;
                            idealY = panelRect.top + (panelRect.height - controlsHeight) / 2;
                            break;
                        case "right":
                            idealX = panelRect.right + margin;
                            idealY = panelRect.top + (panelRect.height - controlsHeight) / 2;
                            break;
                        default: // Fallback to top-right
                            idealX = panelRect.right + margin;
                            idealY = panelRect.top;
                            break;
                    }
                    
                    let finalX = idealX;
                    let finalY = idealY;

                    // For side-positioned controls, check if they are forced to move horizontally.
                    // If so, override their vertical alignment to be "top" instead of "center".
                    if (['left', 'right'].includes(controlsPosition)) {
                        if (idealX < margin || (idealX + controlsWidth) > (window.innerWidth - margin)) {
                            finalY = panelRect.top; // Switch to top alignment
                            
                            // Also, place it slightly inside the panel to ensure it's visible.
                            if (controlsPosition === 'left') {
                                finalX = margin;
                            } else { // 'right'
                                finalX = window.innerWidth - controlsWidth - margin;
                            }
                        }
                    }

                    // Apply boundary constraints to the final calculated position
                    finalX = Math.max(margin, Math.min(finalX, window.innerWidth - controlsWidth - margin));
                    finalY = Math.max(margin, Math.min(finalY, window.innerHeight - controlsHeight - margin));
                    
                    this.uiManager.elements.controls.style.left = `${finalX}px`;
                    this.uiManager.elements.controls.style.top = `${finalY}px`;
                    
                    // Update layout class based on the setting
                    this.uiManager.updateControlsLayout(controlsPosition);
                }
                
                applyPinnedPosition() {
                    let { x, y } = this.stateManager.state.pinnedPosition;
                    const panel = this.uiManager.elements.panel;
                    const panelWidth = panel.offsetWidth;
                    const panelHeight = panel.offsetHeight;
                    const margin = 10;

                    // Ensure the pinned panel stays within the viewport boundaries, e.g., after content expands.
                    // This adjustment is now temporary and won't update the stored pinned position.
                    const boundedX = Math.max(margin, Math.min(x, window.innerWidth - panelWidth - margin));
                    const boundedY = Math.max(margin, Math.min(y, window.innerHeight - panelHeight - margin));

                    panel.style.left = `${boundedX}px`;
                    panel.style.top = `${boundedY}px`;
                }
                
                calculateNormalPosition() {
                    const settings = this.stateManager.state.settings;
                    const panelWidth = settings["🔍MagnifyGlass.InfoPanelWidth"];
                    const panelHeight = Math.min(settings["🔍MagnifyGlass.InfoPanelMaxHeight"], this.uiManager.elements.panel.scrollHeight);
                    
                    let left, top;
                    const margin = 15;
                    
                    if (!this.stateManager.state.isGlassPreviewVisible) {
                        // Position at mouse cursor when glass is hidden
                        left = magnifyGlass.lastKnownMousePosition.x - (panelWidth / 2);
                        top = magnifyGlass.lastKnownMousePosition.y - 20;
                    } else {
                        // Position relative to magnify glass
                        const glassRect = magnifyGlass.ui.glassDiv?.getBoundingClientRect();
                        if (glassRect) {
                            const position = settings["🔍MagnifyGlass.InfoPanelPosition"];
                            
                            switch (position) {
                                case "Right":
                                    left = glassRect.right + margin;
                                    top = glassRect.top;
                                    break;
                                case "Left":
                                    left = glassRect.left - panelWidth - margin;
                                    top = glassRect.top;
                                    break;
                                case "Top":
                                    left = glassRect.left;
                                    top = glassRect.top - panelHeight - margin;
                                    break;
                                case "Bottom":
                                    left = glassRect.left;
                                    top = glassRect.bottom + margin;
                                    break;
                                default:
                                    left = glassRect.right + margin;
                                    top = glassRect.top;
                                    break;
                            }
                        } else {
                            // Fallback to mouse position
                            left = magnifyGlass.lastKnownMousePosition.x - (panelWidth / 2);
                            top = magnifyGlass.lastKnownMousePosition.y - 20;
                        }
                    }
                    
                    // Apply boundary constraints
                    left = Math.max(10, Math.min(left, window.innerWidth - panelWidth - 10));
                    top = Math.max(10, Math.min(top, window.innerHeight - panelHeight - 10));
                    
                    this.uiManager.elements.panel.style.left = `${left}px`;
                    this.uiManager.elements.panel.style.top = `${top}px`;
                }
            }
            
            /**
             * Event Manager
             * Handles all event binding and delegation
             */
            class EventManager {
                constructor(stateManager, uiManager, positionManager) {
                    this.stateManager = stateManager;
                    this.uiManager = uiManager;
                    this.positionManager = positionManager;
                    
                    this.setupEventListeners();
                }
                
                setupEventListeners() {
                    this.setupPanelEvents();
                    this.setupHotkeyEvents();
                    this.setupDragEvents();
                    this.setupHoverEvents();
                }
                
                setupPanelEvents() {
                    // Event delegation for panel controls
                    this.uiManager.elements.panel.addEventListener('click', (e) => {
                        const action = e.target.dataset.action;
                        if (action) {
                            e.stopPropagation();
                            e.preventDefault();
                            this.handleControlAction(action);
                        }
                        
                        // Section header clicks
                        const sectionHeader = e.target.closest('.section-header');
                        if (sectionHeader && sectionHeader.dataset.section) {
                            const sectionId = sectionHeader.dataset.section;
                            if (sectionId !== 'node') { // Node section is always expanded
                                this.stateManager.toggleSection(sectionId);
                                this.uiManager.updateSectionStates();
                            }
                        }
                    });
                    
                    // Event delegation for floating controls (separate since they're not children of panel)
                    if (this.uiManager.elements.controls) {
                        this.uiManager.elements.controls.addEventListener('click', (e) => {
                            const action = e.target.dataset.action;
                            if (action) {
                                e.stopPropagation();
                                e.preventDefault();
                                this.handleControlAction(action);
                            }
                        });
                        
                        // Prevent floating controls from propagating events
                        this.uiManager.elements.controls.addEventListener('mousedown', (e) => {
                            e.stopPropagation();
                        });
                        
                        this.uiManager.elements.controls.addEventListener('mouseup', (e) => {
                            e.stopPropagation();
                        });
                    }
                    
                    // Prevent panel interactions from propagating
                    this.uiManager.elements.panel.addEventListener('mousedown', (e) => {
                        e.stopPropagation();
                    });
                    
                    this.uiManager.elements.panel.addEventListener('mouseup', (e) => {
                        e.stopPropagation();
                    });
                }
                
                // Helper function to check if user is typing in an input field
                isUserTyping() {
                    const activeElement = document.activeElement;
                    if (!activeElement) return false;
                    
                    // Check if the active element is an input, textarea, or contenteditable
                    const tagName = activeElement.tagName.toLowerCase();
                    if (tagName === 'input' || tagName === 'textarea') {
                        return true;
                    }
                    
                    // Check for contenteditable elements
                    if (activeElement.contentEditable === 'true') {
                        return true;
                    }
                    
                    // Check if it's inside a form or has input-like classes
                    if (activeElement.closest('form') || 
                        activeElement.classList.contains('cm-editor') || // CodeMirror editor
                        activeElement.classList.contains('monaco-editor') || // Monaco editor
                        activeElement.closest('.cm-editor') ||
                        activeElement.closest('.monaco-editor')) {
                        return true;
                    }
                    
                    return false;
                }
                
                setupHotkeyEvents() {
                    document.addEventListener('keydown', (e) => {
                        // Don't handle hotkeys if user is typing in an input field (Smart Input Detection)
                        if (this.isUserTyping()) {
                            return;
                        }
                        
                        // Only handle hotkeys when magnifying glass is active
                        if (!magnifyGlass.state.active) return;
                        
                        const settings = this.stateManager.state.settings;
                        
                        // Toggle info panel
                        if (e.key.toLowerCase() === settings["🔍MagnifyGlass.ToggleHotkey"].toLowerCase() && 
                            (!magnifyGlass.config.altRequired || e.altKey) && !e.repeat) {
                            e.preventDefault();
                            e.stopPropagation();
                            this.handleControlAction('toggle-panel');
                        }
                        
                        // Toggle glass preview
                        if (e.key.toLowerCase() === settings["🔍MagnifyGlass.GlassPreviewToggleHotkey"].toLowerCase() && 
                            (!magnifyGlass.config.altRequired || e.altKey) && !e.repeat) {
                            e.preventDefault();
                            e.stopPropagation();
                            this.handleControlAction('toggle-glass');
                        }
                        
                        // Unlock panel from magnify glass and move to current mouse location (no Alt required due to Smart Input Detection)
                        if (e.key.toLowerCase() === settings["🔍MagnifyGlass.PinPanelHotkey"].toLowerCase() && !e.repeat) {
                            e.preventDefault();
                            e.stopPropagation();
                            this.handleControlAction('pin-at-mouse');
                        }
                    });
                }
                
                setupDragEvents() {
                    let dragState = {
                        isDragging: false,
                        startX: 0,
                        startY: 0,
                        currentX: 0,
                        currentY: 0,
                        offsetX: 0,
                        offsetY: 0
                    };

                    // Start drag
                    const startDrag = (e) => {
                        // Only when pinned and not locked
                        if (!this.stateManager.state.isPanelPinned || this.stateManager.state.isPanelLocked) return;
                        
                        // Block on specific elements only
                        if (e.target.closest('.minimize-btn') || 
                            e.target.closest('.control-btn') || 
                            e.target.tagName === 'BUTTON') {
                            return;
                        }

                        console.log('[DRAG] Starting drag');
                        
                        // Stop all event propagation immediately
                        e.preventDefault();
                        e.stopImmediatePropagation();

                        // Set drag state
                        dragState.isDragging = true;
                        dragState.startX = e.clientX;
                        dragState.startY = e.clientY;

                        // Get current panel position
                        const rect = this.uiManager.elements.panel.getBoundingClientRect();
                        dragState.currentX = rect.left;
                        dragState.currentY = rect.top;
                        dragState.offsetX = e.clientX - rect.left;
                        dragState.offsetY = e.clientY - rect.top;

                        // Visual feedback
                        this.uiManager.elements.panel.classList.add('panel-dragging');
                        this.uiManager.elements.panel.style.cursor = 'grabbing';
                        document.body.style.cursor = 'grabbing';
                        document.body.style.userSelect = 'none';

                        console.log('[DRAG] Drag started at:', { x: dragState.currentX, y: dragState.currentY });
                    };

                    // Handle drag movement
                    const doDrag = (e) => {
                        if (!dragState.isDragging) return;

                        e.preventDefault();
                        e.stopImmediatePropagation();

                        // Calculate new position based on mouse movement
                        const newX = e.clientX - dragState.offsetX;
                        const newY = e.clientY - dragState.offsetY;

                        // Apply boundaries
                        const panelWidth = this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelWidth"];
                        const panelHeight = this.uiManager.elements.panel.offsetHeight;
                        const margin = 10;

                        const boundedX = Math.max(margin, Math.min(newX, window.innerWidth - panelWidth - margin));
                        const boundedY = Math.max(margin, Math.min(newY, window.innerHeight - panelHeight - margin));

                        // Apply position immediately and forcefully
                        this.uiManager.elements.panel.style.position = 'fixed';
                        this.uiManager.elements.panel.style.left = `${boundedX}px`;
                        this.uiManager.elements.panel.style.top = `${boundedY}px`;
                        this.uiManager.elements.panel.style.transform = 'none';
                        this.uiManager.elements.panel.style.zIndex = '10010';

                        // Update current position
                        dragState.currentX = boundedX;
                        dragState.currentY = boundedY;

                        // Update floating controls
                        if (this.uiManager.elements.controls) {
                            this.positionManager.positionFloatingControls();
                        }

                        console.log('[DRAG] Moving to:', { x: boundedX, y: boundedY });
                    };

                    // End drag
                    const endDrag = (e) => {
                        if (!dragState.isDragging) return;

                        console.log('[DRAG] Ending drag');

                        e.preventDefault();
                        e.stopImmediatePropagation();

                        // Calculate if we actually moved significantly
                        const deltaX = Math.abs(e.clientX - dragState.startX);
                        const deltaY = Math.abs(e.clientY - dragState.startY);
                        const moved = deltaX > 5 || deltaY > 5;

                        if (moved) {
                            // Save the final position
                            this.stateManager.setPinnedPosition(dragState.currentX, dragState.currentY);
                            console.log('[DRAG] Position saved:', { x: dragState.currentX, y: dragState.currentY });
                        }

                        // Reset state
                        dragState.isDragging = false;

                        // Remove visual feedback
                        this.uiManager.elements.panel.classList.remove('panel-dragging');
                        this.uiManager.elements.panel.style.cursor = '';
                        this.uiManager.elements.panel.style.zIndex = '';
                        document.body.style.cursor = '';
                        document.body.style.userSelect = '';
                    };

                    // Cancel drag
                    const cancelDrag = () => {
                        if (!dragState.isDragging) return;

                        console.log('[DRAG] Cancelling drag');

                        // Restore original position from pinned state
                        const { x, y } = this.stateManager.state.pinnedPosition;
                        this.uiManager.elements.panel.style.left = `${x}px`;
                        this.uiManager.elements.panel.style.top = `${y}px`;

                        // Reset state
                        dragState.isDragging = false;

                        // Remove visual feedback
                        this.uiManager.elements.panel.classList.remove('panel-dragging');
                        this.uiManager.elements.panel.style.cursor = '';
                        this.uiManager.elements.panel.style.zIndex = '';
                        document.body.style.cursor = '';
                        document.body.style.userSelect = '';

                        // Update controls
                        if (this.uiManager.elements.controls) {
                            this.positionManager.positionFloatingControls();
                        }
                    };

                    // Attach events with capture to prevent interference
                    this.uiManager.elements.panel.addEventListener('mousedown', startDrag, { capture: true, passive: false });
                    document.addEventListener('mousemove', doDrag, { capture: true, passive: false });
                    document.addEventListener('mouseup', endDrag, { capture: true, passive: false });

                    // Handle escape key
                    document.addEventListener('keydown', (e) => {
                        if (e.key === 'Escape') {
                            cancelDrag();
                        }
                    });

                    // Handle mouse leaving window
                    document.addEventListener('mouseleave', endDrag);

                    // Visual feedback
                    this.uiManager.elements.panel.addEventListener('mouseenter', () => {
                        if (this.stateManager.state.isPanelPinned && !this.stateManager.state.isPanelLocked && !dragState.isDragging) {
                            this.uiManager.elements.panel.style.cursor = 'grab';
                        }
                    });

                    this.uiManager.elements.panel.addEventListener('mouseleave', () => {
                        if (!dragState.isDragging) {
                            this.uiManager.elements.panel.style.cursor = '';
                        }
                    });

                    console.log('[DRAG] Event listeners attached with capture mode');

                    // Store cleanup function
                    this.dragCleanup = () => {
                        this.uiManager.elements.panel.removeEventListener('mousedown', startDrag, { capture: true });
                        document.removeEventListener('mousemove', doDrag, { capture: true });
                        document.removeEventListener('mouseup', endDrag, { capture: true });
                        document.removeEventListener('mouseleave', endDrag);
                        cancelDrag();
                    };
                }
                
                setupHoverEvents() {
                    this.uiManager.elements.panel.addEventListener('mouseenter', () => {
                        this.stateManager.state.isPanelHovered = true;
                        this.stateManager.clearAutoExpandTimer();
                    });
                    
                    this.uiManager.elements.panel.addEventListener('mouseleave', () => {
                        this.stateManager.state.isPanelHovered = false;
                        if (!this.stateManager.state.isHoveringNode) {
                            this.stateManager.scheduleAutoCollapse();
                        }
                    });
                }
                
                captureCurrentPanelPosition() {
                    // Capture current position when pinning is activated
                    const panelRect = this.uiManager.elements.panel.getBoundingClientRect();
                    this.stateManager.setPinnedPosition(panelRect.left, panelRect.top);
                    console.log(`Panel pinned at current position: (${panelRect.left}, ${panelRect.top})`);
                }
                
                handleControlAction(action) {
                    switch (action) {
                        case 'minimize':
                            this.stateManager.toggleMinimized();
                            this.uiManager.updateMinimizedState();
                            break;
                            
                        case 'pin':
                            // If not currently pinned, either restore to last position or capture current
                            if (!this.stateManager.state.isPanelPinned) {
                                // If we don't have a remembered position, capture current position
                                if (!this.stateManager.state.lastPinnedPosition) {
                                    this.captureCurrentPanelPosition();
                                }
                                // Note: togglePinning will restore lastPinnedPosition if it exists
                            }
                            
                            this.stateManager.togglePinning();
                            this.uiManager.updatePinnedState();
                            this.positionManager.positionPanel();
                            break;
                            
                        case 'lock':
                            this.stateManager.toggleLocking();
                            this.uiManager.updatePinnedState(); // This updates both pinned and locked states
                            break;
                            
                        case 'pin-at-mouse':
                            // Pin at current mouse location (Alt + configured key)
                            const settings = this.stateManager.state.settings;
                            const panelWidth = settings["🔍MagnifyGlass.InfoPanelWidth"];
                            const panelHeight = Math.min(settings["🔍MagnifyGlass.InfoPanelMaxHeight"], 400);
                            
                            // Position panel near mouse with some offset to avoid covering cursor area
                            const mouseX = magnifyGlass.lastKnownMousePosition.x;
                            const mouseY = magnifyGlass.lastKnownMousePosition.y;
                            const pinKey = settings["🔍MagnifyGlass.PinPanelHotkey"];
                            
                            let pinX = mouseX + 50; // Offset to the right of mouse
                            let pinY = mouseY - 100; // Offset above mouse
                            
                            // Apply boundary constraints
                            pinX = Math.max(10, Math.min(pinX, window.innerWidth - panelWidth - 10));
                            pinY = Math.max(10, Math.min(pinY, window.innerHeight - panelHeight - 10));
                            
                            // Set the new pin position (this will also save as lastPinnedPosition)
                            this.stateManager.setPinnedPosition(pinX, pinY);
                            
                            // Enable pinning if not already pinned
                            if (!this.stateManager.state.isPanelPinned) {
                                this.stateManager.state.isPanelPinned = true;
                            }
                            
                            this.uiManager.updatePinnedState();
                            this.positionManager.positionPanel();
                            console.log(`Panel pinned at mouse location: (${pinX}, ${pinY}) using Alt+${pinKey.toUpperCase()}`);
                            break;
                            
                        case 'toggle-panel':
                            if (this.stateManager.togglePanelVisibility()) {
                                this.uiManager.show();
                            } else {
                                this.uiManager.hide();
                            }
                            this.uiManager.updateControlStates();
                            break;
                            
                        case 'toggle-glass':
                            const isVisible = this.stateManager.toggleGlassPreview();
                            this.applyGlassVisibility(isVisible);

                            // When the glass preview is hidden, automatically pin the panel at its current location.
                            if (!isVisible && !this.stateManager.state.isPanelPinned) {
                                this.captureCurrentPanelPosition(); // Capture current position before pinning
                                this.stateManager.togglePinning();
                                this.stateManager.state.isAutoPinned = true; // Mark as auto-pinned
                                this.uiManager.updatePinnedState();
                            }
                            
                            // When the glass preview is shown again, only auto-unlock if NOT manually locked with 📌 button
                            if (isVisible && this.stateManager.state.isPanelPinned && !this.stateManager.state.isPanelLocked) {
                                this.stateManager.togglePinning(); // Unpin the panel
                                this.stateManager.state.isAutoPinned = false; // Clear auto-pin flag
                                this.uiManager.updatePinnedState();
                            }

                            this.uiManager.updateControlStates();
                            this.positionManager.positionPanel(); // Reposition based on new glass state
                            break;
                    }
                }
                
                applyGlassVisibility(isVisible) {
                    if (magnifyGlass && magnifyGlass.ui && magnifyGlass.ui.glassDiv) {
                        magnifyGlass.ui.glassDiv.style.opacity = isVisible ? "1" : "0";
                    }
                }
            }
            
            /**
             * Information Gatherer
             * Responsible for collecting information about the current state
             */
            class InformationGatherer {
                constructor() {}
                
                gatherInformation() {
                    const info = {
                        timestamp: Date.now(),
                        cursor: {
                            canvas: { x: magnifyGlass.state.x, y: magnifyGlass.state.y },
                            screen: { 
                                x: magnifyGlass.lastKnownMousePosition.x, 
                                y: magnifyGlass.lastKnownMousePosition.y 
                            }
                        },
                        canvas: {
                            scale: magnifyGlass.state.canvasScale,
                            offset: {
                                x: magnifyGlass.state.canvasOffsetX,
                                y: magnifyGlass.state.canvasOffsetY
                            }
                        },
                        magnifier: {
                            zoomFactor: magnifyGlass.config.zoomFactor,
                            offsetX: magnifyGlass.config.offsetX,
                            offsetY: magnifyGlass.config.offsetY,
                            sourceRegion: {
                                x: magnifyGlass.state.sourceX,
                                y: magnifyGlass.state.sourceY,
                                width: magnifyGlass.state.sourceWidth,
                                height: magnifyGlass.state.sourceHeight
                            }
                        },
                        hoveredNode: null,
                        node: null,
                        widget: null,
                        connection: null,
                        media: null
                    };
                    
                    if (magnifyGlass.isOverMedia && magnifyGlass.currentMediaElement) {
                        info.media = this.getMediaInfo(magnifyGlass.currentMediaElement);
                    }
                    
                    const nodeUnderCursor = this.getNodeUnderCursor();
                    if (nodeUnderCursor) {
                        info.hoveredNode = this.getDetailedNodeInfo(nodeUnderCursor.node, nodeUnderCursor.localPos);
                        info.node = this.getNodeInfo(nodeUnderCursor.node);
                        
                        const widget = this.getWidgetUnderCursor(nodeUnderCursor.node, nodeUnderCursor.localPos);
                        if (widget) {
                            info.widget = this.getWidgetInfo(widget);
                        }
                    }
                    
                    return info;
                }
                
                getNodeUnderCursor() {
                    if (!app.graph || !app.canvas) {
                        return null;
                    }
                    
                    try {
                        // Try to get the node from ComfyUI's state
                        if (app.canvas.node_over) {
                            const node = app.canvas.node_over;
                            if (node && node.pos && node.size) {
                                const canvasRect = app.canvas.canvas.getBoundingClientRect();
                                const mouseX = magnifyGlass.lastKnownMousePosition.x - canvasRect.left;
                                const mouseY = magnifyGlass.lastKnownMousePosition.y - canvasRect.top;
                                
                                let graphPos;
                                if (app.canvas.convertOffsetToCanvasPos) {
                                    graphPos = app.canvas.convertOffsetToCanvasPos([mouseX, mouseY]);
                                } else {
                                    const ds = app.canvas.ds || { scale: 1, offset: [0, 0] };
                                    graphPos = [
                                        (mouseX / ds.scale) - (ds.offset[0] / ds.scale),
                                        (mouseY / ds.scale) - (ds.offset[1] / ds.scale)
                                    ];
                                }
                                
                                return {
                                    node: node,
                                    localPos: {
                                        x: graphPos[0] - node.pos[0],
                                        y: graphPos[1] - node.pos[1]
                                    }
                                };
                            }
                        }
                        
                        // Fallback to manual detection
                        const canvasRect = app.canvas.canvas.getBoundingClientRect();
                        const mouseX = magnifyGlass.lastKnownMousePosition.x - canvasRect.left;
                        const mouseY = magnifyGlass.lastKnownMousePosition.y - canvasRect.top;
                        
                        let graphPos;
                        if (app.canvas.convertOffsetToCanvasPos) {
                            graphPos = app.canvas.convertOffsetToCanvasPos([mouseX, mouseY]);
                        } else {
                            const ds = app.canvas.ds || { scale: 1, offset: [0, 0] };
                            graphPos = [
                                (mouseX / ds.scale) - (ds.offset[0] / ds.scale),
                                (mouseY / ds.scale) - (ds.offset[1] / ds.scale)
                            ];
                        }
                        
                        for (let i = app.graph._nodes.length - 1; i >= 0; i--) {
                            const node = app.graph._nodes[i];
                            if (!node.pos || !node.size || node.flags?.collapsed) continue;
                            
                            if (graphPos[0] >= node.pos[0] && 
                                graphPos[0] <= node.pos[0] + node.size[0] && 
                                graphPos[1] >= node.pos[1] && 
                                graphPos[1] <= node.pos[1] + node.size[1]) {
                                
                                return {
                                    node: node,
                                    localPos: {
                                        x: graphPos[0] - node.pos[0],
                                        y: graphPos[1] - node.pos[1]
                                    }
                                };
                            }
                        }
                    } catch (err) {
                        console.warn("Error in node detection:", err);
                    }
                    
                    return null;
                }
                
                getDetailedNodeInfo(node, localPos) {
                    return {
                        id: node.id,
                        title: node.title || "Untitled Node",
                        type: node.type,
                        mode: this.getNodeModeText(node.mode),
                        position: {
                            x: Math.round(node.pos[0]),
                            y: Math.round(node.pos[1]),
                            formatted: `(${Math.round(node.pos[0])}, ${Math.round(node.pos[1])})`
                        },
                        size: {
                            width: Math.round(node.size[0]),
                            height: Math.round(node.size[1]),
                            formatted: `${Math.round(node.size[0])}×${Math.round(node.size[1])}`
                        },
                        localPosition: {
                            x: Math.round(localPos.x),
                            y: Math.round(localPos.y),
                            formatted: `(${Math.round(localPos.x)}, ${Math.round(localPos.y)})`,
                            percentage: {
                                x: ((localPos.x / node.size[0]) * 100).toFixed(1),
                                y: ((localPos.y / node.size[1]) * 100).toFixed(1)
                            }
                        },
                        counts: {
                            widgets: node.widgets ? node.widgets.length : 0,
                            inputs: node.inputs ? node.inputs.length : 0,
                            outputs: node.outputs ? node.outputs.length : 0,
                            properties: node.properties ? Object.keys(node.properties).length : 0
                        },
                        widgets: node.widgets || [],
                        inputs: node.inputs || [],
                        outputs: node.outputs || [],
                        properties: node.properties || {},
                        hoverRegion: this.detectNodeRegion(localPos, node)
                    };
                }
                
                getNodeInfo(node) {
                    return {
                        id: node.id,
                        title: node.title || "Untitled",
                        type: node.type,
                        mode: node.mode,
                        size: node.size ? `${Math.round(node.size[0])}×${Math.round(node.size[1])}` : "Unknown",
                        position: node.pos ? `(${Math.round(node.pos[0])}, ${Math.round(node.pos[1])})` : "Unknown",
                        widgets: node.widgets || [],
                        inputs: node.inputs || [],
                        outputs: node.outputs || [],
                        properties: node.properties || {}
                    };
                }
                
                getWidgetUnderCursor(node, localPos) {
                    if (!node.widgets || !node.widgets.length) return null;
                    
                    const titleHeight = 30;
                    let currentY = titleHeight;
                    
                    for (const widget of node.widgets) {
                        const widgetHeight = 25;
                        
                        if (localPos.y >= currentY && localPos.y <= currentY + widgetHeight) {
                            return widget;
                        }
                        
                        currentY += widgetHeight + 5;
                    }
                    
                    return null;
                }
                
                getWidgetInfo(widget) {
                    return {
                        name: widget.name,
                        type: widget.type,
                        value: this.formatValue(widget.value),
                        options: widget.options || null,
                        min: widget.min,
                        max: widget.max,
                        step: widget.step
                    };
                }
                
                getMediaInfo(mediaElement) {
                    const info = {
                        tagName: mediaElement.tagName,
                        src: mediaElement.src ? mediaElement.src.substring(mediaElement.src.lastIndexOf('/') + 1) : "No source"
                    };
                    
                    if (mediaElement.tagName === 'IMG') {
                        info.naturalSize = `${mediaElement.naturalWidth}×${mediaElement.naturalHeight}`;
                        info.displaySize = `${Math.round(mediaElement.width)}×${Math.round(mediaElement.height)}`;
                        info.complete = mediaElement.complete;
                    } else if (mediaElement.tagName === 'VIDEO') {
                        info.videoSize = `${mediaElement.videoWidth}×${mediaElement.videoHeight}`;
                        info.duration = mediaElement.duration ? `${mediaElement.duration.toFixed(2)}s` : "Unknown";
                        info.currentTime = `${mediaElement.currentTime.toFixed(2)}s`;
                        info.paused = mediaElement.paused;
                        info.readyState = mediaElement.readyState;
                    }
                    
                    return info;
                }
                
                getNodeModeText(mode) {
                    const modes = {
                        0: "Always",
                        1: "On Event", 
                        2: "Never",
                        3: "On Trigger",
                        4: "On Request"
                    };
                    return modes[mode] || `Mode ${mode}`;
                }
                
                detectNodeRegion(localPos, node) {
                    const titleHeight = 30;
                    const regions = [];

                    if (localPos.y <= titleHeight) {
                        regions.push("Title Bar");
                    }

                    if (localPos.x <= 10) {
                        regions.push("Left Edge");
                    } else if (localPos.x >= node.size[0] - 10) {
                        regions.push("Right Edge");
                    }

                    if (localPos.y <= 10) {
                        regions.push("Top Edge");
                    } else if (localPos.y >= node.size[1] - 10) {
                        regions.push("Bottom Edge");
                    }

                    if (regions.length === 0) {
                        if (localPos.y > titleHeight) {
                            regions.push("Content Area");
                        }
                    }

                    if (localPos.x <= 20 && localPos.y > titleHeight) {
                        regions.push("Input Area");
                    } else if (localPos.x >= node.size[0] - 20 && localPos.y > titleHeight) {
                        regions.push("Output Area");
                    }

                    return regions.length > 0 ? regions.join(", ") : "Unknown";
                }

                formatValue(value) {
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
            }
            
            /**
             * Main Professional Info Panel Manager
             * Orchestrates all the other components
             */
            class ProfessionalInfoPanelManager {
                constructor(magnifyGlass) {
                    this.magnifyGlass = magnifyGlass;
                    
                    // Initialize all managers
                    this.stateManager = new StateManager();
                    this.uiManager = new UIManager(this.stateManager);
                    this.positionManager = new PositionManager(this.stateManager, this.uiManager);
                    this.eventManager = new EventManager(this.stateManager, this.uiManager, this.positionManager);
                    this.informationGatherer = new InformationGatherer();
                    
                    this.hookIntoMagnifyGlass();
                    
                    console.log("ComfyUI Magnify Info Panel Pro V2: Initialized successfully");
                }
                
                hookIntoMagnifyGlass() {
                    // Hook into magnify glass update cycle
                    const originalUpdateMagnifiedView = this.magnifyGlass.updateMagnifiedView.bind(this.magnifyGlass);
                    
                    this.magnifyGlass.updateMagnifiedView = (() => {
                        originalUpdateMagnifiedView();
                        
                        if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"] && this.magnifyGlass.state.active) {
                            this.scheduleInfoUpdate();
                        }
                    }).bind(this);
                    
                    // Hook into show/hide
                    const originalShow = this.magnifyGlass.ui.show.bind(this.magnifyGlass.ui);
                    const originalHide = this.magnifyGlass.ui.hide.bind(this.magnifyGlass.ui);
                    
                    this.magnifyGlass.ui.show = (() => {
                        originalShow();
                        if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"]) {
                            this.uiManager.show();
                            // Position controls after showing
                            setTimeout(() => this.positionManager.positionPanel(), 10);
                        }
                    }).bind(this);
                    
                    this.magnifyGlass.ui.hide = (() => {
                        originalHide();
                        this.uiManager.hide();
                    }).bind(this);
                }
                
                scheduleInfoUpdate() {
                    if (this.stateManager.state.updateScheduled) return;
                    
                    this.stateManager.state.updateScheduled = true;
                    requestAnimationFrame(() => {
                        this.updateInfo();
                        this.stateManager.state.updateScheduled = false;
                    });
                }
                
                updateInfo() {
                    if (!this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"] || !this.magnifyGlass.state.active) return;
                    
                    const info = this.informationGatherer.gatherInformation();
                    this.stateManager.setCurrentInfo(info);
                    this.uiManager.displayInfo(info);
                    this.positionManager.positionPanel();
                    
                    // Handle node hover state
                    if (info.hoveredNode) {
                        this.stateManager.state.isHoveringNode = true;
                        this.stateManager.expandNodeSections();
                        
                        if (this.stateManager.state.lastNodeId !== info.hoveredNode.id) {
                            this.stateManager.state.lastNodeId = info.hoveredNode.id;
                        }
                    } else {
                        this.stateManager.state.isHoveringNode = false;
                        
                        if (this.stateManager.state.lastNodeId !== null) {
                            this.stateManager.state.lastNodeId = null;
                            if (!this.stateManager.state.isPanelHovered) {
                                this.stateManager.scheduleAutoCollapse();
                            }
                        }
                    }
                }
                
                updateSettings() {
                    const changes = this.stateManager.updateSettings();
                    
                                    // React to setting changes (theme is now auto-detected)
                // Theme changes are handled automatically by the observer
                    
                    if (changes["🔍MagnifyGlass.ControlsPosition"]) {
                        // Update controls layout and position when position setting changes
                        this.positionManager.positionPanel();
                    }
                    
                    // Apply new styles
                    this.uiManager.applyStyles();
                    
                    if (this.stateManager.state.settings["🔍MagnifyGlass.InfoPanelEnabled"] && this.magnifyGlass.state.active) {
                        this.uiManager.show();
                    } else {
                        this.uiManager.hide();
                    }
                }
                
                cleanup() {
                    this.stateManager.cleanup();
                    this.uiManager.cleanup();
                }
            }
            
            // Create the main manager instance
            const infoPanelManager = new ProfessionalInfoPanelManager(magnifyGlass);
            
            // Store reference globally for cleanup and theme updates
            if (!window.comfyUIMagnifyGlassExtensions) {
                window.comfyUIMagnifyGlassExtensions = [];
            }
            window.comfyUIMagnifyGlassExtensions.push(infoPanelManager);
            
            // Store main manager reference for theme updates
            window.infoPanelManager = infoPanelManager;
            
            // Register settings with ComfyUI
            Object.keys(DEFAULT_SETTINGS).forEach(settingKey => {
                const settingConfig = getSettingConfig(settingKey, DEFAULT_SETTINGS[settingKey]);
                if (settingConfig) {
                    app.ui.settings.addSetting({
                        ...settingConfig,
                        onChange: (value) => {
                            infoPanelManager.updateSettings();
                        }
                    });
                }
            });
            
            function getSettingConfig(key, defaultValue) {
                const configs = {
                    "🔍MagnifyGlass.InfoPanelEnabled": {
                        id: key,
                        name: "📋 Magnify Glass: Info Panel",
                        type: "combo",
                        options: [
                            { value: true, text: "Enabled" },
                            { value: false, text: "Disabled" }
                        ],
                        defaultValue,
                        tooltip: "Enable or disable the professional information panel."
                    },
                    "🔍MagnifyGlass.InfoPanelPosition": {
                        id: key,
                        name: "📋 Magnify Glass: Info Panel Position",
                        type: "combo",
                        options: [
                            { value: "Right", text: "Right" },
                            { value: "Left", text: "Left" },
                            { value: "Top", text: "Top" },
                            { value: "Bottom", text: "Bottom" }
                        ],
                        defaultValue,
                        tooltip: "Position of the info panel relative to the magnifying glass."
                    },
                    "🔍MagnifyGlass.InfoPanelWidth": {
                        id: key,
                        name: "📋 Magnify Glass: Info Panel Width",
                        type: "slider",
                        defaultValue,
                        min: 250,
                        max: 450,
                        step: 10,
                        tooltip: "Width of the information panel in pixels."
                    },
                    "🔍MagnifyGlass.InfoPanelOpacity": {
                        id: key,
                        name: "📋 Magnify Glass: Info Panel Opacity (%)",
                        type: "slider",
                        defaultValue,
                        min: 10,
                        max: 100,
                        step: 5,
                        tooltip: "Opacity of the information panel background as a percentage (10 = very transparent, 100 = fully opaque).",
                        onChange: (value) => {
                            // Convert percentage to decimal and apply opacity immediately
                            const opacity = value / 100;
                            if (window.infoPanelManager && window.infoPanelManager.uiManager && window.infoPanelManager.uiManager.elements.panel) {
                                window.infoPanelManager.uiManager.elements.panel.style.opacity = opacity;
                            }
                        }
                    },
                    "🔍MagnifyGlass.InfoPanelMaxHeight": {
                        id: key,
                        name: "📋 Magnify Glass: Info Panel Max Height",
                        type: "slider",
                        defaultValue,
                        min: 300,
                        max: 700,
                        step: 25,
                        tooltip: "Maximum height of the information panel in pixels."
                    },

                    "🔍MagnifyGlass.InfoPanelAnimations": {
                        id: key,
                        name: "🎬 Magnify Glass: Info Panel Animations",
                        type: "combo",
                        options: [
                            { value: true, text: "Enabled" },
                            { value: false, text: "Disabled" }
                        ],
                        defaultValue,
                        tooltip: "Enable or disable animations for the info panel."
                    },
                    "🔍MagnifyGlass.ShowInspectorTab": {
                        id: key,
                        name: "📋 Magnify Glass: Show Inspector Tab",
                        type: "combo",
                        options: [
                            { value: true, text: "Enabled" },
                            { value: false, text: "Disabled" }
                        ],
                        defaultValue,
                        tooltip: "Show or hide the Inspector tab with cursor and canvas information."
                    },
                    "🔍MagnifyGlass.ToggleHotkey": {
                        id: key,
                        name: "🔑 Magnify Glass: Info Panel Toggle Hotkey",
                        type: "combo",
                        options: ["i", "p", "o", "l", "k"],
                        defaultValue,
                        tooltip: "Key to toggle the info panel visibility while the magnifier is active."
                    },
                    "🔍MagnifyGlass.GlassPreviewToggleHotkey": {
                        id: key,
                        name: "🔑 Magnify Glass: Preview Toggle Hotkey",
                        type: "combo",
                        options: ["g", "v", "b", "m", "n"],
                        defaultValue,
                        tooltip: "Key to toggle the magnifying glass preview visibility."
                    },
                    "🔍MagnifyGlass.PinPanelHotkey": {
                        id: key,
                        name: "🔓 Magnify Glass: Unlock Panel to Mouse Location",
                        type: "combo",
                        options: ["u", "p", "f", "x", "z"],
                        defaultValue,
                        tooltip: "Key to unlock the info panel from the magnify glass and move it to your current mouse position (e.g., U). Panel remains movable - use the pin button to lock it in place. Alt not required due to Smart Input Detection."
                    },
                    "🔍MagnifyGlass.ShowHoveringControls": {
                        id: key,
                        name: "🎮 Magnify Glass: Show Hover Controls",
                        type: "combo",
                        options: [
                            { value: true, text: "Enabled" },
                            { value: false, text: "Disabled" }
                        ],
                        defaultValue,
                        tooltip: "Show or hide hovering UI controls above the info panel."
                    },
                    "🔍MagnifyGlass.ControlsPosition": {
                        id: key,
                        name: "📍 Magnify Glass: Controls Position",
                        type: "combo",
                        options: [
                            { value: "top-left", text: "Top-Left" },
                            { value: "top-right", text: "Top-Right" },
                            { value: "bottom-left", text: "Bottom-Left" },
                            { value: "bottom-right", text: "Bottom-Right" },
                            { value: "top", text: "Top (Centered)" },
                            { value: "bottom", text: "Bottom (Centered)" },
                            { value: "left", text: "Left (Centered)" },
                            { value: "right", text: "Right (Centered)" }
                        ],
                        defaultValue,
                        tooltip: "Position of the floating control buttons relative to the info panel."
                    },
                    "🔍MagnifyGlass.InfoPanelTextColor": {
                        id: key,
                        name: "🎨 Magnify Glass: Info Panel Text Color",
                        type: "color",
                        defaultValue,
                        tooltip: "Color of the text in the info panel. This affects all text content including titles, values, and labels.",
                        onChange: (value) => {
                            // Ensure color value includes # symbol for valid CSS and persistence
                            const normalizedColor = value && !value.startsWith('#') ? `#${value}` : value;
                            
                            // Only save back if we actually normalized the color (to prevent recursion)
                            if (value !== normalizedColor) {
                                try {
                                    app.ui.settings.setSettingValue("🔍MagnifyGlass.InfoPanelTextColor", normalizedColor);
                                } catch (e) {
                                    console.warn('Failed to save normalized text color:', e);
                                }
                            }
                            
                            // Apply the color immediately
                            if (window.infoPanelManager && window.infoPanelManager.uiManager) {
                                window.infoPanelManager.uiManager.applyStyles();
                            }
                        }
                    },
                    "🔍MagnifyGlass.InfoPanelAccentColor": {
                        id: key,
                        name: "🎨 Magnify Glass: Info Panel Accent Color",
                        type: "color",
                        defaultValue,
                        tooltip: "Color used for highlighted elements like values, section titles, and active states in the info panel.",
                        onChange: (value) => {
                            // Ensure color value includes # symbol for valid CSS and persistence
                            const normalizedColor = value && !value.startsWith('#') ? `#${value}` : value;
                            
                            // Only save back if we actually normalized the color (to prevent recursion)
                            if (value !== normalizedColor) {
                                try {
                                    app.ui.settings.setSettingValue("🔍MagnifyGlass.InfoPanelAccentColor", normalizedColor);
                                } catch (e) {
                                    console.warn('Failed to save normalized accent color:', e);
                                }
                            }
                            
                            // Apply the color immediately
                            if (window.infoPanelManager && window.infoPanelManager.uiManager) {
                                window.infoPanelManager.uiManager.applyStyles();
                            }
                        }
                    }
                };
                
                return configs[key] || null;
            }
            
            console.log("ComfyUI Magnify Info Panel Pro V2: All settings registered and initialized");
        }
    }
});