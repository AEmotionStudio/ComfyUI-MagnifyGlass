import { app } from "../../../scripts/app.js";

/**
 * ComfyUI Magnifying Glass
 * 
 * This script adds a magnifying glass feature to ComfyUI.
 * Hold Alt+X to activate the magnifying glass and see a zoomed view of the canvas.
 */

app.registerExtension({
    name: "comfyui.magnify.glass",
    async setup() {
        // Default settings configuration
        const DEFAULT_SETTINGS = {
            "🔍MagnifyGlass.ZoomFactor": 3,
            "🔍MagnifyGlass.GlassSize": 300,
            "🔍MagnifyGlass.BorderColor": "#ffffff",
            "🔍MagnifyGlass.BorderWidth": 2,
            "🔍MagnifyGlass.ActivationKey": "x",
            "🔍MagnifyGlass.AltRequired": true,
            "🔍MagnifyGlass.FollowCursor": true,
            "🔍MagnifyGlass.DebugMode": false,
            "🔍MagnifyGlass.OffsetStep": 5,
            "🔍MagnifyGlass.GlassPosition": "Bottom",
            "🔍MagnifyGlass.ResetKey": "r",
            "🔍MagnifyGlass.ResetAltRequired": true,
            "🔍MagnifyGlass.GlassShape": "Circle",
            "🔍MagnifyGlass.BorderEnabled": true,
            "🔍MagnifyGlass.TextureFiltering": "Linear",
        };

        // Function to safely get settings values
        const getSettingValue = (key, defaultValue) => {
            try {
                const value = app.ui.settings.getSettingValue(key);
                return value === undefined ? defaultValue : value;
            } catch (e) {
                console.warn(`ComfyUI Magnifying Glass: Could not get setting ${key}, using default ${defaultValue}. Error: ${e}`);
                return defaultValue;
            }
        };
        
        // Main MagnifyGlass class
        class MagnifyGlass {
            constructor() {
                this.config = new ConfigManager(); // ConfigManager will now read from settings
                this.state = new MagnifierState();
                this.ui = new UiManager(this.config, this.state);
                this.renderer = null;
                this.debugger = new DebugManager(this.config, this.state, this.ui);
                this.eventHandler = new EventHandler(this);
                
                // The LiteGraph canvas
                this.litegraphCanvas = null;
                
                // Last known mouse position for better initial positioning
                this.lastKnownMousePosition = { x: 0, y: 0 };
            }
            
            init() {
                if (typeof LiteGraph === 'undefined' || typeof app === 'undefined' || !app.canvas) {
                    this.debugger.log("LiteGraph or app not ready, retrying in 100ms.");
                    setTimeout(() => this.init(), 100);
                    return;
                }
                this.debugger.log("LiteGraph and app ready.");
        
                // Load saved offsets first (before UI creation depends on them)
                this.config.loadSavedOffsets();
                
                // Print detailed information about the canvas setup (if debug enabled)
                this.debugger.printCanvasInfo();
        
                // Create UI elements (now depends on config potentially updated by settings)
                this.ui.createElements();
                
                // Setup WebGL renderer
                this.renderer = new WebGLRenderer(this.config, this.state, this.ui);
                if (!this.renderer.isValid()) {
                    this.ui.cleanup();
                    return;
                }
                
                // Find the LiteGraph canvas
                this.litegraphCanvas = this.findLiteGraphCanvas();
                this.debugger.log("LiteGraph canvas found:", this.litegraphCanvas);
                if (!this.litegraphCanvas) {
                    this.debugger.error("Could not find LiteGraph canvas. Magnifier will not work.");
                    this.ui.cleanup();
                    return;
                }
                
                // Attach event handlers
                this.eventHandler.attachListeners();
        
                this.debugger.log(`Initialized (WebGL). Hold ${this.config.altRequired ? 'Alt+' : ''}${this.config.activationKey.toUpperCase()} to activate. Arrow keys to adjust offset, R to reset.`);
            }
            
            findLiteGraphCanvas() {
                return document.getElementById("graph-canvas") || 
                      document.querySelector("canvas.graphcanvas") ||
                      app.canvas_manager?.container?.querySelector("canvas") ||
                      (app.canvas && app.canvas.graph_canvas ? app.canvas.graph_canvas : null);
            }
            
            updateMagnifiedView() {
                if (!this.state.active || !this.renderer || !this.litegraphCanvas) {
                    //this.debugger.log("updateMagnifiedView skipped: not active, no renderer, or no litegraphCanvas."); // Too noisy
                    return;
                }
                
                // Get canvas transformation info
                this.updateCanvasTransformation();
                
                // Calculate the source region
                this.calculateSourceRegion();
                
                // Schedule the rendering operation if not already scheduled
                if (!this.state.isRenderScheduled) {
                    this.state.isRenderScheduled = true;
                    requestAnimationFrame(() => {
                        if (!this.state.active || !this.renderer || !this.litegraphCanvas) { // Re-check before actual rendering
                            this.state.isRenderScheduled = false;
                            return;
                        }
                        // Render the magnified view
                        this.renderer.render(this.litegraphCanvas);
                        
                        // Update debug visualization
                        this.debugger.updateDebugView();

                        // Render HTML overlays
                        this.renderHtmlOverlays();

                        this.state.isRenderScheduled = false; // Reset the flag
                    });
                }
            }
            
            updateCanvasTransformation() {
                this.state.canvasScale = 1.0;
                this.state.canvasOffsetX = 0;
                this.state.canvasOffsetY = 0;
                
                if (app && app.canvas) {
                    if (app.canvas.ds) {
                        if (typeof app.canvas.ds.scale === 'number') {
                            this.state.canvasScale = app.canvas.ds.scale;
                        }
                        
                        if (app.canvas.ds.offset) {
                            this.state.canvasOffsetX = app.canvas.ds.offset[0] || 0;
                            this.state.canvasOffsetY = app.canvas.ds.offset[1] || 0;
                        }
                    }
                    //this.debugger.log(`Canvas transform: scale=${this.state.canvasScale}, offsetX=${this.state.canvasOffsetX}, offsetY=${this.state.canvasOffsetY}`); // Too noisy
                }
            }
            
            calculateSourceRegion() {
                // 1. We have cursor position in canvas pixels (state.x, state.y)
                const cursorPixelX = this.state.x;
                const cursorPixelY = this.state.y;
                
                // 2. Get LiteGraph's current transform
                const canvasScale = this.state.canvasScale;
                const canvasOffsetX = this.state.canvasOffsetX;
                const canvasOffsetY = this.state.canvasOffsetY;
                
                // Avoid division by zero if scale is somehow 0
                if (canvasScale === 0) return;
                
                // 3. Convert cursor canvas pixels to LiteGraph graph coordinates
                const cursorGraphX = (cursorPixelX - canvasOffsetX) / canvasScale;
                const cursorGraphY = (cursorPixelY - canvasOffsetY) / canvasScale;
                
                // 4. Determine the target center in graph coordinates, applying the manual offset
                //    The manual offset now conceptually works in graph units.
                const targetGraphCenterX = cursorGraphX + this.config.offsetX;
                const targetGraphCenterY = cursorGraphY + this.config.offsetY;
                
                // 5. Calculate source dimensions in graph units
                //    The size on the source canvas (in pixels) that we want to sample is glassSize / zoomFactor.
                //    Convert this pixel size to graph units by dividing by canvasScale.
                const sourceGraphWidth = (this.config.glassSize / this.config.zoomFactor) / canvasScale;
                const sourceGraphHeight = (this.config.glassSize / this.config.zoomFactor) / canvasScale;
                
                // 6. Calculate source top-left corner in graph coordinates
                const sourceGraphX = targetGraphCenterX - (sourceGraphWidth / 2);
                const sourceGraphY = targetGraphCenterY - (sourceGraphHeight / 2);
                
                // 7. Convert the source rectangle from graph coordinates back to canvas pixel coordinates
                this.state.sourceX = (sourceGraphX * canvasScale) + canvasOffsetX;
                this.state.sourceY = (sourceGraphY * canvasScale) + canvasOffsetY;
                
                // The width/height in pixels is the graph size * scale
                this.state.sourceWidth = sourceGraphWidth * canvasScale;
                this.state.sourceHeight = sourceGraphHeight * canvasScale;
            
                // Keep the debug logging (adjust to show graph coords too)
                // this.debugger.log(`Cursor (Canvas Pixels): X=${cursorPixelX.toFixed(1)}, Y=${cursorPixelY.toFixed(1)}`); // Too noisy
                // this.debugger.log(`Cursor (Graph Coords): X=${cursorGraphX.toFixed(1)}, Y=${cursorGraphY.toFixed(1)}`); // Too noisy
                // this.debugger.log(`Target Center (Graph Coords + Manual Offset): X=${targetGraphCenterX.toFixed(1)}, Y=${targetGraphCenterY.toFixed(1)}`); // Too noisy
                // this.debugger.log(`Source Rect (Graph Coords): X=${sourceGraphX.toFixed(1)}, Y=${sourceGraphY.toFixed(1)}, W=${sourceGraphWidth.toFixed(1)}, H=${sourceGraphHeight.toFixed(1)}`); // Too noisy
                // this.debugger.log(`Source Rect (Canvas Pixels): X=${this.state.sourceX.toFixed(1)}, Y=${this.state.sourceY.toFixed(1)}, W=${this.state.sourceWidth.toFixed(1)}, H=${this.state.sourceHeight.toFixed(1)}`); // Too noisy
                // this.debugger.log(`Using Manual Offsets (Graph Units): X=${this.config.offsetX}, Y=${this.config.offsetY}`); // Too noisy
                // this.debugger.log(`LiteGraph Canvas Transform: scale=${canvasScale.toFixed(3)}, offset=(${canvasOffsetX.toFixed(1)}, ${canvasOffsetY.toFixed(1)})`); // Too noisy
            }
            
            // Helper function to check if two rectangles overlap
            rectsOverlap(rect1, rect2) {
                return rect1.x < rect2.x + rect2.width &&
                       rect1.x + rect1.width > rect2.x &&
                       rect1.y < rect2.y + rect2.height &&
                       rect1.y + rect1.height > rect2.y;
            }

            renderHtmlOverlays() {
                if (!this.state.active || !this.ui.htmlOverlayContainer || !app.graph || !this.litegraphCanvas) {
                    if (this.ui.htmlOverlayContainer) this.ui.htmlOverlayContainer.innerHTML = '';
                    return;
                }

                this.ui.htmlOverlayContainer.innerHTML = '';

                const magnifyRect = {
                    x: this.state.sourceX,
                    y: this.state.sourceY,
                    width: this.state.sourceWidth,
                    height: this.state.sourceHeight
                };

                const nodes = app.graph._nodes;
                if (!nodes) return;

                for (const node of nodes) {
                    if (!node.widgets) continue;

                    for (const widget of node.widgets) {
                        let isTextElement = false;
                        let isVideoElement = false;
                        let isImageElement = false; // New flag for image elements
                        let elementToProcess = null;

                        if (widget.element) {
                            if (widget.type === "text" || widget.type === "string" || widget.element.tagName === 'TEXTAREA') {
                                isTextElement = true;
                                elementToProcess = widget.element;
                            } else if (widget.element.tagName === 'VIDEO') {
                                isVideoElement = true;
                                elementToProcess = widget.element;
                            } else if (widget.element.tagName === 'IMG') { // Check for IMG tag directly
                                isImageElement = true;
                                elementToProcess = widget.element;
                            } else {
                                // Try to find a video or image element as a child
                                const potentialVideo = widget.element.querySelector('video');
                                if (potentialVideo) {
                                    isVideoElement = true;
                                    elementToProcess = potentialVideo;
                                } else {
                                    const potentialImage = widget.element.querySelector('img');
                                    if (potentialImage) {
                                        isImageElement = true;
                                        elementToProcess = potentialImage;
                                    }
                                }
                            }
                        }

                        if (elementToProcess && (isTextElement || isVideoElement || isImageElement)) {
                            const widgetRect = elementToProcess.getBoundingClientRect();
                            const canvasRect = this.litegraphCanvas.getBoundingClientRect();

                            const canvasToViewportScaleX = canvasRect.width > 0 ? (this.litegraphCanvas.width / canvasRect.width) : 1;
                            const canvasToViewportScaleY = canvasRect.height > 0 ? (this.litegraphCanvas.height / canvasRect.height) : 1;

                            const widgetCanvasX = (widgetRect.left - canvasRect.left) * canvasToViewportScaleX;
                            const widgetCanvasY = (widgetRect.top - canvasRect.top) * canvasToViewportScaleY;
                            const widgetCanvasWidth = widgetRect.width * canvasToViewportScaleX;
                            const widgetCanvasHeight = widgetRect.height * canvasToViewportScaleY;

                            const widgetSourceRect = {
                                x: widgetCanvasX,
                                y: widgetCanvasY,
                                width: widgetCanvasWidth,
                                height: widgetCanvasHeight
                            };

                            if (this.rectsOverlap(magnifyRect, widgetSourceRect)) {
                                const clonedElement = elementToProcess.cloneNode(true);
                                clonedElement.style.position = 'absolute';
                                clonedElement.style.pointerEvents = 'none';

                                if (isTextElement) {
                                    clonedElement.style.backgroundColor = elementToProcess.style.backgroundColor || '#222';
                                    clonedElement.style.color = elementToProcess.style.color || '#DDD';
                                    clonedElement.style.border = elementToProcess.style.border || '1px solid #555';
                                    clonedElement.disabled = true;
                                } else if (isVideoElement) {
                                    clonedElement.src = elementToProcess.src;
                                    clonedElement.autoplay = elementToProcess.autoplay;
                                    clonedElement.loop = elementToProcess.loop;
                                    clonedElement.preload = elementToProcess.preload;
                                    clonedElement.crossOrigin = elementToProcess.crossOrigin;
                                    clonedElement.muted = true;
                                    if (!elementToProcess.paused) {
                                        clonedElement.play().catch(e => console.warn("Magnify Glass: Cloned video play failed", e));
                                    }
                                    clonedElement.currentTime = elementToProcess.currentTime;
                                } else if (isImageElement) {
                                    // For images, ensure src and alt are copied.
                                    // The browser will handle rendering based on src.
                                    clonedElement.src = elementToProcess.src;
                                    clonedElement.alt = elementToProcess.alt;
                                    // Preserve original display characteristics if needed, but usually not for simple images
                                    // clonedElement.style.objectFit = elementToProcess.style.objectFit || 'contain'; 
                                }

                                const relativeX = widgetSourceRect.x - magnifyRect.x;
                                const relativeY = widgetSourceRect.y - magnifyRect.y;

                                const magnifiedX = relativeX * this.config.zoomFactor;
                                const magnifiedY = relativeY * this.config.zoomFactor;

                                clonedElement.style.left = `${magnifiedX}px`;
                                clonedElement.style.top = `${magnifiedY}px`;
                                clonedElement.style.width = `${widgetSourceRect.width}px`;
                                clonedElement.style.height = `${widgetSourceRect.height}px`;
                                clonedElement.style.transformOrigin = 'top left';
                                clonedElement.style.transform = `scale(${this.config.zoomFactor})`;

                                if (isTextElement && clonedElement.style.fontSize) {
                                    const originalFontSize = parseFloat(window.getComputedStyle(elementToProcess).fontSize);
                                    clonedElement.style.fontSize = `${originalFontSize}px`;
                                }

                                this.ui.htmlOverlayContainer.appendChild(clonedElement);
                            }
                        }
                    }
                }
            }
            
            // Method to update config from settings (can be called from callbacks)
            updateConfigFromSettings() {
                this.config.zoomFactor = getSettingValue("🔍MagnifyGlass.ZoomFactor", DEFAULT_SETTINGS["🔍MagnifyGlass.ZoomFactor"]);
                this.config.glassSize = getSettingValue("🔍MagnifyGlass.GlassSize", DEFAULT_SETTINGS["🔍MagnifyGlass.GlassSize"]);
                this.config.borderColor = getSettingValue("🔍MagnifyGlass.BorderColor", DEFAULT_SETTINGS["🔍MagnifyGlass.BorderColor"]);
                this.config.borderWidth = getSettingValue("🔍MagnifyGlass.BorderWidth", DEFAULT_SETTINGS["🔍MagnifyGlass.BorderWidth"]);
                this.config.activationKey = getSettingValue("🔍MagnifyGlass.ActivationKey", DEFAULT_SETTINGS["🔍MagnifyGlass.ActivationKey"]);
                this.config.altRequired = getSettingValue("🔍MagnifyGlass.AltRequired", DEFAULT_SETTINGS["🔍MagnifyGlass.AltRequired"]);
                this.config.followCursor = getSettingValue("🔍MagnifyGlass.FollowCursor", DEFAULT_SETTINGS["🔍MagnifyGlass.FollowCursor"]);
                this.config.debugMode = getSettingValue("🔍MagnifyGlass.DebugMode", DEFAULT_SETTINGS["🔍MagnifyGlass.DebugMode"]);
                this.config.offsetStep = getSettingValue("🔍MagnifyGlass.OffsetStep", DEFAULT_SETTINGS["🔍MagnifyGlass.OffsetStep"]);
                this.config.glassPosition = getSettingValue("🔍MagnifyGlass.GlassPosition", DEFAULT_SETTINGS["🔍MagnifyGlass.GlassPosition"]);
                this.config.resetKey = getSettingValue("🔍MagnifyGlass.ResetKey", DEFAULT_SETTINGS["🔍MagnifyGlass.ResetKey"]);
                this.config.resetAltRequired = getSettingValue("🔍MagnifyGlass.ResetAltRequired", DEFAULT_SETTINGS["🔍MagnifyGlass.ResetAltRequired"]);
                this.config.glassShape = getSettingValue("🔍MagnifyGlass.GlassShape", DEFAULT_SETTINGS["🔍MagnifyGlass.GlassShape"]);
                this.config.borderEnabled = getSettingValue("🔍MagnifyGlass.BorderEnabled", DEFAULT_SETTINGS["🔍MagnifyGlass.BorderEnabled"]);
                this.config.textureFiltering = getSettingValue("🔍MagnifyGlass.TextureFiltering", DEFAULT_SETTINGS["🔍MagnifyGlass.TextureFiltering"]);
                // Offsets X/Y are managed separately via load/save/arrow keys
            }
            
            // Method to apply UI changes based on config
            applyUiChanges() {
                if (this.ui.glassDiv) {
                    this.ui.glassDiv.style.width = `${this.config.glassSize}px`;
                    this.ui.glassDiv.style.height = `${this.config.glassSize}px`;
                    this.ui.glassDiv.style.border = this.config.borderEnabled ? `${this.config.borderWidth}px solid ${this.config.borderColor}` : 'none';
                    // this.ui.glassDiv.style.borderRadius = this.config.glassShape === "Circle" ? "50%" : "0px";

                    // Reset clip-path and set default border-radius, then apply shape-specific styles
                    this.ui.glassDiv.style.clipPath = 'none'; 
                    this.ui.glassDiv.style.borderRadius = '0px'; // Default to square before specific shape styling

                    switch (this.config.glassShape) {
                        case "Circle":
                            this.ui.glassDiv.style.borderRadius = "50%";
                            break;
                        case "Square":
                            // borderRadius is already '0px'
                            break;
                        case "Rounded Square":
                            this.ui.glassDiv.style.borderRadius = "20%"; // Adjust as desired
                            break;
                        default: // Fallback to Circle if shape is unknown or unsupported for border
                            this.ui.glassDiv.style.borderRadius = "50%"; 
                            break;
                    }
                }
                if (this.ui.glassCanvas) {
                    this.ui.glassCanvas.width = this.config.glassSize;
                    this.ui.glassCanvas.height = this.config.glassSize;
                    // Re-initialize or update viewport if needed for WebGL
                    if(this.renderer && this.renderer.gl) {
                        this.renderer.gl.viewport(0, 0, this.renderer.gl.canvas.width, this.renderer.gl.canvas.height);
                    }
                }
                // Handle debug canvas show/hide
                if (this.config.debugMode) {
                    if (!this.ui.debugCanvas) this.ui.createDebugCanvas();
                    if (this.state.active) this.ui.debugCanvas.style.display = "block";
                } else {
                    if (this.ui.debugCanvas) this.ui.debugCanvas.style.display = "none";
                }
            }
            
            resetOffsets() {
                this.config.offsetX = 0;
                this.config.offsetY = 0;
                this.config.saveOffsets(); // Save the reset values
                if (this.state.active) {
                    this.updateMagnifiedView(); // Update if active
                }
                this.debugger.log("Offsets reset to 0, 0");
            }
        }
        
        // Configuration manager - Reads from settings
        class ConfigManager {
            constructor() {
                // Initialize properties that will be set by reading settings
                this.zoomFactor = DEFAULT_SETTINGS["🔍MagnifyGlass.ZoomFactor"];
                this.glassSize = DEFAULT_SETTINGS["🔍MagnifyGlass.GlassSize"];
                this.borderColor = DEFAULT_SETTINGS["🔍MagnifyGlass.BorderColor"];
                this.borderWidth = DEFAULT_SETTINGS["🔍MagnifyGlass.BorderWidth"];
                this.activationKey = DEFAULT_SETTINGS["🔍MagnifyGlass.ActivationKey"];
                this.altRequired = DEFAULT_SETTINGS["🔍MagnifyGlass.AltRequired"];
                this.followCursor = DEFAULT_SETTINGS["🔍MagnifyGlass.FollowCursor"];
                this.debugMode = DEFAULT_SETTINGS["🔍MagnifyGlass.DebugMode"];
                this.offsetStep = DEFAULT_SETTINGS["🔍MagnifyGlass.OffsetStep"];
                this.glassPosition = DEFAULT_SETTINGS["🔍MagnifyGlass.GlassPosition"];
                this.resetKey = DEFAULT_SETTINGS["🔍MagnifyGlass.ResetKey"];
                this.resetAltRequired = DEFAULT_SETTINGS["🔍MagnifyGlass.ResetAltRequired"];
                this.glassShape = DEFAULT_SETTINGS["🔍MagnifyGlass.GlassShape"];
                this.borderEnabled = DEFAULT_SETTINGS["🔍MagnifyGlass.BorderEnabled"];
                this.textureFiltering = DEFAULT_SETTINGS["🔍MagnifyGlass.TextureFiltering"];
                
                // Alignment adjustment parameters - managed separately
                this.offsetX = 0; // Default before loading saved
                this.offsetY = 0; // Default before loading saved
            }
            
            // Call this after settings are registered and potentially read by MagnifyGlass
            loadSettings() {
                this.zoomFactor = getSettingValue("🔍MagnifyGlass.ZoomFactor", this.zoomFactor);
                this.glassSize = getSettingValue("🔍MagnifyGlass.GlassSize", this.glassSize);
                this.borderColor = getSettingValue("🔍MagnifyGlass.BorderColor", this.borderColor);
                this.borderWidth = getSettingValue("🔍MagnifyGlass.BorderWidth", this.borderWidth);
                this.activationKey = getSettingValue("🔍MagnifyGlass.ActivationKey", this.activationKey);
                this.altRequired = getSettingValue("🔍MagnifyGlass.AltRequired", this.altRequired);
                this.followCursor = getSettingValue("🔍MagnifyGlass.FollowCursor", this.followCursor);
                this.debugMode = getSettingValue("🔍MagnifyGlass.DebugMode", this.debugMode);
                this.offsetStep = getSettingValue("🔍MagnifyGlass.OffsetStep", this.offsetStep);
                this.glassPosition = getSettingValue("🔍MagnifyGlass.GlassPosition", this.glassPosition);
                this.resetKey = getSettingValue("🔍MagnifyGlass.ResetKey", this.resetKey);
                this.resetAltRequired = getSettingValue("🔍MagnifyGlass.ResetAltRequired", this.resetAltRequired);
                this.glassShape = getSettingValue("🔍MagnifyGlass.GlassShape", this.glassShape);
                this.borderEnabled = getSettingValue("🔍MagnifyGlass.BorderEnabled", this.borderEnabled);
                this.textureFiltering = getSettingValue("🔍MagnifyGlass.TextureFiltering", this.textureFiltering);
            }
            
            loadSavedOffsets() {
            try {
                const savedOffsetX = localStorage.getItem('comfyui_magnify_offset_x');
                const savedOffsetY = localStorage.getItem('comfyui_magnify_offset_y');
                
                if (savedOffsetX !== null) {
                        this.offsetX = parseInt(savedOffsetX, 10);
                    } else {
                        this.offsetX = 0; // Ensure reset if not found
                    }
                    
                    if (savedOffsetY !== null) {
                        this.offsetY = parseInt(savedOffsetY, 10);
                    } else {
                        this.offsetY = 0; // Ensure reset if not found
                    }
                    
                    // No initial debug log here, DebugManager handles it based on config.debugMode
                } catch (e) {
                    console.error("ComfyUI Magnifying Glass ERROR: Error loading saved offsets:", e);
                    this.offsetX = 0; // Reset on error
                    this.offsetY = 0;
                }
            }
            
            saveOffsets() {
                try {
                    localStorage.setItem('comfyui_magnify_offset_x', this.offsetX.toString());
                    localStorage.setItem('comfyui_magnify_offset_y', this.offsetY.toString());
                    // No log here, EventHandler handles it
                } catch (e) {
                    console.error("ComfyUI Magnifying Glass ERROR: Error saving offsets:", e);
                }
            }
        }
        
        // Magnifier state
        class MagnifierState {
            constructor() {
                this.active = false;
                this.x = 0; // Cursor X relative to litegraphCanvas
                this.y = 0; // Cursor Y relative to litegraphCanvas
                this.sourceX = 0; // Calculated source area X
                this.sourceY = 0; // Calculated source area Y
                this.sourceWidth = 0; // Calculated source area width
                this.sourceHeight = 0; // Calculated source area height
                this.canvasScale = 1.0; // Current canvas scale/zoom
                this.canvasOffsetX = 0; // Canvas translation X
                this.canvasOffsetY = 0; // Canvas translation Y
                this.isRenderScheduled = false; // Flag to manage requestAnimationFrame
            }
        }
        
        // UI Manager - handles creation and management of DOM elements (Minor changes for config)
        class UiManager {
            constructor(config, state) {
                this.config = config;
                this.state = state;
                this.glassDiv = null;
                this.glassCanvas = null;
                this.debugCanvas = null;
                this.debugCtx = null;
                this.htmlOverlayContainer = null; // Added for HTML overlays
            }
            
            createElements() {
                // Create magnifying glass container
                this.glassDiv = document.createElement("div");
                this.glassDiv.id = "comfyui-magnify-glass";
                this.glassDiv.style.cssText = `
                    position: absolute;
                    width: ${this.config.glassSize}px;
                    height: ${this.config.glassSize}px;
                    border-radius: ${this.config.glassShape === "Circle" ? "50%" : "0px"};
                    border: ${this.config.borderEnabled ? `${this.config.borderWidth}px solid ${this.config.borderColor}` : 'none'};
                    overflow: hidden;
                    pointer-events: none;
                    z-index: 9999;
                    display: none;
                    box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                    background-color: rgba(255,255,255,0.1);
                `;
                
                // Create WebGL canvas for the magnifying glass
                this.glassCanvas = document.createElement("canvas");
                this.glassCanvas.width = this.config.glassSize;
                this.glassCanvas.height = this.config.glassSize;
                this.glassCanvas.id = "comfyui-magnify-canvas";
                this.glassDiv.appendChild(this.glassCanvas);
                
                // Create HTML overlay container
                this.htmlOverlayContainer = document.createElement("div");
                this.htmlOverlayContainer.id = "comfyui-magnify-html-overlay";
                this.htmlOverlayContainer.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    overflow: hidden; 
                `;
                this.glassDiv.appendChild(this.htmlOverlayContainer);
                
                document.body.appendChild(this.glassDiv);
                
                // Create debug canvas if debug mode is enabled
                if (this.config.debugMode) {
                    this.createDebugCanvas();
                }
            }
            
            createDebugCanvas() {
                this.debugCanvas = document.createElement("canvas");
                this.debugCanvas.id = "comfyui-magnify-debug";
                this.debugCanvas.width = 400;
                this.debugCanvas.height = 320;
                this.debugCanvas.style.cssText = `
                    position: fixed;
                    top: 10px;
                    right: 10px;
                    background: rgba(0,0,0,0.7);
                    border: 1px solid #fff;
                    z-index: 10000;
                    pointer-events: none;
                    color: white;
                    font-family: monospace;
                    display: none;
                `;
                document.body.appendChild(this.debugCanvas);
                this.debugCtx = this.debugCanvas.getContext('2d');
            }
            
            show() {
                this.glassDiv.style.display = "block";
                if (this.config.debugMode && this.debugCanvas) {
                    this.debugCanvas.style.display = "block";
                }
            }
            
            hide() {
                this.glassDiv.style.display = "none";
                if (this.config.debugMode && this.debugCanvas) {
                    this.debugCanvas.style.display = "none";
                }
                // Clear HTML overlays when hiding
                if (this.htmlOverlayContainer) {
                    this.htmlOverlayContainer.innerHTML = '';
                }
            }
            
            positionGlass(clientX, clientY) {
                if (!this.config.followCursor) return;
                
                // Default position: Horizontally centered with cursor, top of glass 20px below cursor
                let newLeft = clientX - (this.config.glassSize / 2);
                let newTop = clientY + 20; // Default to Bottom

                const glassSize = this.config.glassSize;
                const offsetAmount = 20; // How far from the cursor the glass edge should be

                switch (this.config.glassPosition) {
                    case "Top":
                        newLeft = clientX - (glassSize / 2);
                        newTop = clientY - glassSize - offsetAmount;
                        break;
                    case "Bottom":
                        newLeft = clientX - (glassSize / 2);
                        newTop = clientY + offsetAmount;
                        break;
                    case "Left":
                        newLeft = clientX - glassSize - offsetAmount;
                        newTop = clientY - (glassSize / 2);
                        break;
                    case "Right":
                        newLeft = clientX + offsetAmount;
                        newTop = clientY - (glassSize / 2);
                        break;
                    case "Top-Left":
                        newLeft = clientX - glassSize - offsetAmount;
                        newTop = clientY - glassSize - offsetAmount;
                        break;
                    case "Top-Right":
                        newLeft = clientX + offsetAmount;
                        newTop = clientY - glassSize - offsetAmount;
                        break;
                    case "Bottom-Left":
                        newLeft = clientX - glassSize - offsetAmount;
                        newTop = clientY + offsetAmount;
                        break;
                    case "Bottom-Right":
                        newLeft = clientX + offsetAmount;
                        newTop = clientY + offsetAmount;
                        break;
                    default: // Default to Bottom if something is wrong
                        newLeft = clientX - (glassSize / 2);
                        newTop = clientY + offsetAmount;
                        break;
                }
                
                this.glassDiv.style.left = `${newLeft}px`;
                this.glassDiv.style.top = `${newTop}px`;
                
                this.adjustForBoundaries(clientX, clientY);
            }
            
            adjustForBoundaries(clientX, clientY) {
                const glassRect = this.glassDiv.getBoundingClientRect();
                
                // Check right boundary
                if (glassRect.right > window.innerWidth) {
                    this.glassDiv.style.left = `${clientX - glassRect.width - 20}px`;
                }
                
                // Check left boundary
                const currentRectLeft = this.glassDiv.getBoundingClientRect();
                if (currentRectLeft.left < 0) {
                    this.glassDiv.style.left = "10px";
                }
                
                // Check bottom boundary
                if (glassRect.bottom > window.innerHeight) {
                    this.glassDiv.style.top = `${clientY - glassRect.height - 20}px`;
                }
                
                // Check top boundary
                const currentRectTop = this.glassDiv.getBoundingClientRect();
                if (currentRectTop.top < 0) {
                    this.glassDiv.style.top = "10px";
                }
            }
            
            cleanup() {
                if (this.glassDiv) this.glassDiv.remove();
                if (this.debugCanvas) this.debugCanvas.remove();
                // No need to explicitly remove htmlOverlayContainer as it's a child of glassDiv
            }
        }
        
        // WebGL Renderer
        class WebGLRenderer {
            constructor(config, state, ui) {
                this.config = config;
                this.state = state;
                this.ui = ui;
                
                this.gl = null;
                this.program = null;
                this.texture = null;
                this.positionBuffer = null;
                this.texCoordBuffer = null;
                this.uniformLocations = null;
                this.attributeLocations = null;
                this.currentFilteringMode = null; // To store the GL constant for filtering
                
                this.vertexShaderSource = `
            attribute vec2 a_position;
            attribute vec2 a_texCoord;
            varying vec2 v_texCoord;
            void main() {
                gl_Position = vec4(a_position, 0.0, 1.0);
                v_texCoord = a_texCoord;
            }
        `;

                this.fragmentShaderSource = `
            precision mediump float;
            varying vec2 v_texCoord;
            uniform sampler2D u_sourceTexture;
            uniform vec2 u_textureOffset;
            uniform vec2 u_textureRepeat;
                    uniform float u_glassSize;

            void main() {
                vec2 sampleCoord = u_textureOffset + v_texCoord * u_textureRepeat;
                vec4 color = texture2D(u_sourceTexture, sampleCoord);
                gl_FragColor = color;
            }
        `;

                this.initialize();
            }
            
            initialize() {
                // Get WebGL context
                this.gl = this.ui.glassCanvas.getContext("webgl", { preserveDrawingBuffer: true });
                if (!this.gl) {
                    console.error("ComfyUI Magnifying Glass ERROR: WebGL not supported or context creation failed.");
                    return;
                }
                
                // Create shader program
                this.program = this.createShaderProgram(this.gl, this.vertexShaderSource, this.fragmentShaderSource);
                if (!this.program) return;
                
                // Create position buffer
                this.positionBuffer = this.gl.createBuffer();
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
                const positions = [-1, -1, 1, -1, -1, 1, 1, 1];
                this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
                
                // Create texture coordinate buffer
                this.texCoordBuffer = this.gl.createBuffer();
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
                const texCoords = [0, 1, 1, 1, 0, 0, 1, 0]; // Flipped Y for texCoords
                this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(texCoords), this.gl.STATIC_DRAW);
                
                // Create texture
                this.texture = this.gl.createTexture();
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
                this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
                this.updateTextureFiltering(this.config.textureFiltering); // Initialize with config setting
                
                // Get uniform and attribute locations
                this.uniformLocations = {
                    sourceTexture: this.gl.getUniformLocation(this.program, "u_sourceTexture"),
                    textureOffset: this.gl.getUniformLocation(this.program, "u_textureOffset"),
                    textureRepeat: this.gl.getUniformLocation(this.program, "u_textureRepeat"),
                    glassSize: this.gl.getUniformLocation(this.program, "u_glassSize"),
                };
                
                this.attributeLocations = {
                    position: this.gl.getAttribLocation(this.program, "a_position"),
                    texCoord: this.gl.getAttribLocation(this.program, "a_texCoord"),
                };
            }
            
            updateTextureFiltering(filteringModeString) {
                if (!this.gl) return;

                let glFilterMode;
                if (filteringModeString === "Nearest") {
                    glFilterMode = this.gl.NEAREST;
                } else { // Default to Linear
                    glFilterMode = this.gl.LINEAR;
                }

                if (this.currentFilteringMode === glFilterMode) return; // No change needed

                this.currentFilteringMode = glFilterMode;

                this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, glFilterMode);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, glFilterMode);
                this.gl.bindTexture(this.gl.TEXTURE_2D, null); // Unbind
                // console.log(`ComfyUI Magnifying Glass: Texture filtering updated to ${filteringModeString}`);
            }

            isValid() {
                return this.gl !== null && this.program !== null;
            }
            
            createShaderProgram(gl, vsSource, fsSource) {
            const vertexShader = gl.createShader(gl.VERTEX_SHADER);
            gl.shaderSource(vertexShader, vsSource);
            gl.compileShader(vertexShader);
            if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
                    console.error('ComfyUI Magnifying Glass ERROR: Vertex shader compilation error:', gl.getShaderInfoLog(vertexShader));
                gl.deleteShader(vertexShader);
                return null;
            }

            const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
            gl.shaderSource(fragmentShader, fsSource);
            gl.compileShader(fragmentShader);
            if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
                    console.error('ComfyUI Magnifying Glass ERROR: Fragment shader compilation error:', gl.getShaderInfoLog(fragmentShader));
                gl.deleteShader(vertexShader);
                gl.deleteShader(fragmentShader);
                return null;
            }

            const program = gl.createProgram();
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);

            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                    console.error('ComfyUI Magnifying Glass ERROR: Shader program linking error:', gl.getProgramInfoLog(program));
                gl.deleteProgram(program);
                gl.deleteShader(vertexShader);
                gl.deleteShader(fragmentShader);
                return null;
            }
                
            return program;
            }
            
            render(sourceCanvas) {
                // Bind texture and update with source canvas
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
                
                try {
                    this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, sourceCanvas);
                } catch (e) {
                    console.error("ComfyUI Magnifying Glass ERROR: Error in texImage2D:", e);
                    return;
                }
                
                // Calculate normalized texture coordinates (UV space: 0-1)
                const uvX = this.state.sourceX / sourceCanvas.width;
                const uvY = this.state.sourceY / sourceCanvas.height;
                // Corrected: sourceWidth/Height are now *already* in sourceCanvas pixel units
                const uvWidth = this.state.sourceWidth / sourceCanvas.width;
                const uvHeight = this.state.sourceHeight / sourceCanvas.height;
                
                // Set up rendering
                this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
                this.gl.clearColor(0.0, 0.0, 0.0, 0.0);
                this.gl.clear(this.gl.COLOR_BUFFER_BIT);
                
                this.gl.useProgram(this.program);
                
                // Set uniforms
                this.gl.activeTexture(this.gl.TEXTURE0);
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
                this.gl.uniform1i(this.uniformLocations.sourceTexture, 0);
                this.gl.uniform2f(this.uniformLocations.textureOffset, uvX, uvY);
                this.gl.uniform2f(this.uniformLocations.textureRepeat, uvWidth, uvHeight);
                this.gl.uniform1f(this.uniformLocations.glassSize, this.config.glassSize);
                
                // Set attributes
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
                this.gl.vertexAttribPointer(this.attributeLocations.position, 2, this.gl.FLOAT, false, 0, 0);
                this.gl.enableVertexAttribArray(this.attributeLocations.position);
                
                this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
                this.gl.vertexAttribPointer(this.attributeLocations.texCoord, 2, this.gl.FLOAT, false, 0, 0);
                this.gl.enableVertexAttribArray(this.attributeLocations.texCoord);
                
                // Draw
                this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
            }
            
            checkWebGLError(label) {
                const err = this.gl.getError();
                if (err !== this.gl.NO_ERROR) {
                    console.error(`ComfyUI Magnifying Glass ERROR: WebGL Error (${label}):`, err);
                    return true;
                }
                return false;
            }
        }
        
        // Event Handler
        class EventHandler {
            constructor(magnifyGlass) {
                this.magnifyGlass = magnifyGlass;
            }
            
            attachListeners() {
                // Keydown event
                document.addEventListener("keydown", this.handleKeyDown.bind(this));
                
                // Keyup event
                document.addEventListener("keyup", this.handleKeyUp.bind(this));
                
                // Mousemove event
                document.addEventListener("mousemove", this.handleMouseMove.bind(this));
            }
            
            handleKeyDown(e) {
                const config = this.magnifyGlass.config;
                const state = this.magnifyGlass.state;
                
                // Magnifier activation
                if (e.key.toLowerCase() === config.activationKey && 
                    (!config.altRequired || e.altKey)) {
                    if (!state.active) {
                        state.active = true;
                        this.magnifyGlass.ui.show();
                        
                        // On activation, immediately update cursor position from current mouse position
                        this.updateInitialPosition();
                    }
                }
                
                // Manual offset adjustment keys (only when magnifier is active)
                if (state.active) {
                    let offsetChanged = false;
                    
                    // Use larger steps when shift is pressed
                    const stepSize = e.shiftKey ? config.offsetStep * 5 : config.offsetStep;
                    
                    // Arrow keys to adjust offset
                    if (e.key === "ArrowUp") {
                        config.offsetY -= stepSize;
                        offsetChanged = true;
                        e.preventDefault();
                    } else if (e.key === "ArrowDown") {
                        config.offsetY += stepSize;
                        offsetChanged = true;
                        e.preventDefault();
                    } else if (e.key === "ArrowLeft") {
                        config.offsetX -= stepSize;
                        offsetChanged = true;
                        e.preventDefault();
                    } else if (e.key === "ArrowRight") {
                        config.offsetX += stepSize;
                        offsetChanged = true;
                        e.preventDefault();
                    } else if (e.key.toLowerCase() === config.resetKey.toLowerCase() && 
                               (!config.resetAltRequired || e.altKey)) { // Use configured reset key & check Alt
                        // Reset offsets to zero
                        config.offsetX = 0;
                        config.offsetY = 0;
                        offsetChanged = true;
                        e.preventDefault();
                    }
                    
                    // If offset was changed, update the view
                    if (offsetChanged) {
                        // Save the changes to localStorage
                        config.saveOffsets();
                        this.magnifyGlass.updateMagnifiedView();
                    }
                }
            }
            
            handleKeyUp(e) {
                const config = this.magnifyGlass.config;
                const state = this.magnifyGlass.state;
                
                // Check if the released key is the activation key OR if Alt was required and Alt was released.
                if (e.key.toLowerCase() === config.activationKey || 
                    (config.altRequired && e.key === "Alt")) {
                    
                    // Only deactivate if the *other* key required for activation is NOT still pressed.
                    // This handles cases like: Alt+X, release X (deactivate), or Alt+X, release Alt (deactivate).
                    // But if Alt+X, release X, but Alt is still held for another purpose, it shouldn't deactivate if activationKey is still held (though less common).
                    // The primary goal is to ensure releasing *either* key (if both were used) deactivates.
                    
                    let shouldDeactivate = false;
                    if (config.altRequired) {
                        // If Alt is required, releasing either Alt or the activation key deactivates.
                        if (e.key === "Alt" || e.key.toLowerCase() === config.activationKey) {
                            shouldDeactivate = true;
                        }
                    } else {
                        // If Alt is not required, only releasing the activation key deactivates.
                        if (e.key.toLowerCase() === config.activationKey) {
                            shouldDeactivate = true;
                        }
                    }

                    if (state.active && shouldDeactivate) {
                        // Check if the *other* key is still pressed down. If so, don't deactivate yet.
                        // This is tricky because we don't have a perfect way to know key states globally
                        // without more complex tracking. The current logic might sometimes deactivate
                        // if Alt is released but X is still held (if altRequired = true).
                        // For simplicity, we assume releasing any part of the combo means deactivation.
                        state.active = false;
                        this.magnifyGlass.ui.hide(); // This will now also clear HTML overlays
                    }
                }
            }
            
            handleMouseMove(e) {
                // Always track mouse position, even when magnifier is inactive
                this.magnifyGlass.lastKnownMousePosition.x = e.clientX;
                this.magnifyGlass.lastKnownMousePosition.y = e.clientY;
                
                if (!this.magnifyGlass.state.active || !this.magnifyGlass.litegraphCanvas) return;

                const rect = this.magnifyGlass.litegraphCanvas.getBoundingClientRect();
                const cssMouseXOnCanvas = e.clientX - rect.left;
                const cssMouseYOnCanvas = e.clientY - rect.top;

                // Check if the cursor is over the canvas element (using CSS coordinates)
                if (cssMouseXOnCanvas >= 0 && cssMouseXOnCanvas <= rect.width &&
                    cssMouseYOnCanvas >= 0 && cssMouseYOnCanvas <= rect.height) {
                    
                    // Convert CSS coordinates on canvas to actual canvas pixel coordinates
                    const canvasElement = this.magnifyGlass.litegraphCanvas;
                    // Ensure rect.width and rect.height are not zero to prevent division by zero
                    const scaleX = rect.width > 0 ? canvasElement.width / rect.width : 1;
                    const scaleY = rect.height > 0 ? canvasElement.height / rect.height : 1;

                    const pixelX = cssMouseXOnCanvas * scaleX;
                    const pixelY = cssMouseYOnCanvas * scaleY;
                    
                    this.magnifyGlass.state.x = pixelX;
                    this.magnifyGlass.state.y = pixelY;
                    
                    this.magnifyGlass.ui.positionGlass(e.clientX, e.clientY);
                    this.magnifyGlass.updateMagnifiedView();
                }
            }
            
            updateInitialPosition() {
                if (!this.magnifyGlass.litegraphCanvas) return;
                
                const rect = this.magnifyGlass.litegraphCanvas.getBoundingClientRect();
                const clientX = this.magnifyGlass.lastKnownMousePosition.x;
                const clientY = this.magnifyGlass.lastKnownMousePosition.y;
                
                // Only use the position if it's over the canvas
                if (clientX >= rect.left && clientX <= rect.right && 
                    clientY >= rect.top && clientY <= rect.bottom) {
                    
                    const cssMouseXOnCanvas = clientX - rect.left;
                    const cssMouseYOnCanvas = clientY - rect.top;

                    // Convert CSS coordinates on canvas to actual canvas pixel coordinates
                    const canvasElement = this.magnifyGlass.litegraphCanvas;
                    // Ensure rect.width and rect.height are not zero to prevent division by zero
                    const scaleX = rect.width > 0 ? canvasElement.width / rect.width : 1;
                    const scaleY = rect.height > 0 ? canvasElement.height / rect.height : 1;

                    const pixelX = cssMouseXOnCanvas * scaleX;
                    const pixelY = cssMouseYOnCanvas * scaleY;

                    this.magnifyGlass.state.x = pixelX;
                    this.magnifyGlass.state.y = pixelY;
                    
                    // Position the glass immediately based on current cursor
                    this.magnifyGlass.ui.positionGlass(clientX, clientY);
                    this.magnifyGlass.updateMagnifiedView();
                }
            }
        }
        
        // Debug Manager
        class DebugManager {
            constructor(config, state, ui) {
                this.config = config;
                this.state = state;
                this.ui = ui;
            }
            
            log(...args) {
                if (this.config.debugMode) console.log("ComfyUI Magnifying Glass:", ...args);
            }
            
            error(...args) {
                console.error("ComfyUI Magnifying Glass ERROR:", ...args);
            }
            
            printCanvasInfo() {
                if (!this.config.debugMode) return;
            
            try {
                const canvas = app.canvas.graph_canvas;
                if (!canvas) {
                        this.log("Could not find graph canvas for detailed info");
                    return;
                }
                
                    this.log("---- Canvas Information ----");
                    this.log(`Canvas dimensions: ${canvas.width}x${canvas.height}`);
                    this.log(`Canvas display size: ${canvas.clientWidth}x${canvas.clientHeight}`);
                    this.log(`Canvas CSS transform: ${canvas.style.transform || 'none'}`);
                
                if (app.canvas.ds) {
                        this.log(`Canvas DS scale: ${app.canvas.ds.scale}`);
                    if (app.canvas.ds.offset) {
                            this.log(`Canvas DS offset: [${app.canvas.ds.offset[0]}, ${app.canvas.ds.offset[1]}]`);
                        } else {
                            this.log("Canvas DS offset not found");
                        }
                    } else {
                        this.log("Canvas DS object not found");
                }
                
                // Try to compute the expected offset based on resolution
                const screenWidth = window.innerWidth;
                const screenHeight = window.innerHeight;
                const canvasWidth = canvas.width;
                const canvasHeight = canvas.height;
                
                    this.log(`Window dimensions: ${screenWidth}x${screenHeight}`);
                    this.log(`Resolution scale factor: X=${canvasWidth/screenWidth}, Y=${canvasHeight/screenHeight}`);
                    this.log("---- End Canvas Information ----");
            } catch (e) {
                    this.log("Error in printCanvasInfo:", e);
                }
            }
            
            updateDebugView() {
                if (!this.config.debugMode || !this.ui || !this.ui.debugCanvas || !this.ui.debugCtx) return;

                const debugCtx = this.ui.debugCtx;
                const debugCanvas = this.ui.debugCanvas;

            debugCtx.clearRect(0, 0, debugCanvas.width, debugCanvas.height);
            
            // Draw background
            debugCtx.fillStyle = 'rgba(0,0,0,0.8)';
            debugCtx.fillRect(0, 0, debugCanvas.width, debugCanvas.height);
            
            // Header
            debugCtx.fillStyle = '#FFFFFF';
            debugCtx.font = '14px monospace';
            debugCtx.fillText('Magnify Glass Debug', 10, 20);
            
            // Position info
            debugCtx.font = '12px monospace';
                debugCtx.fillText(`Cursor: (${this.state.x.toFixed(1)}, ${this.state.y.toFixed(1)})`, 10, 50);
                debugCtx.fillText(`Source Rect: (${this.state.sourceX.toFixed(1)}, ${this.state.sourceY.toFixed(1)}, w:${this.state.sourceWidth.toFixed(1)}, h:${this.state.sourceHeight.toFixed(1)})`, 10, 70);
            
            // Canvas transform
                debugCtx.fillText(`Canvas Scale: ${this.state.canvasScale.toFixed(2)}`, 10, 90);
                debugCtx.fillText(`Canvas Offset: (${this.state.canvasOffsetX.toFixed(1)}, ${this.state.canvasOffsetY.toFixed(1)})`, 10, 110);
            
            // Offset information
            debugCtx.fillStyle = '#FFFF00'; // Yellow for emphasis
                debugCtx.fillText(`MANUAL OFFSETS: X=${this.config.offsetX}, Y=${this.config.offsetY} (Use arrow keys to adjust)`, 10, 130);
            debugCtx.fillStyle = '#FFFFFF';
            
            // Visualization of canvas and source rect
                this.drawCanvasVisualization(debugCtx, debugCanvas);
            }
            
            drawCanvasVisualization(debugCtx, debugCanvas) {
            const canvasScale = 0.1; // Scale factor for visualization
            const canvasVisX = 10;
                const canvasVisY = 170;
            const canvasVisWidth = 380;
                const canvasVisHeight = 150;
            
            // Draw canvas representation
            debugCtx.strokeStyle = '#AAAAAA';
            debugCtx.strokeRect(canvasVisX, canvasVisY, canvasVisWidth, canvasVisHeight);
            debugCtx.fillStyle = '#444444';
            debugCtx.fillRect(canvasVisX, canvasVisY, canvasVisWidth, canvasVisHeight);
            
            // Calculate cursor position in visualization
                const cursorVisX = canvasVisX + (this.state.x * canvasScale);
                const cursorVisY = canvasVisY + (this.state.y * canvasScale);
            
            // Calculate source rect in visualization
                const sourceRectVisX = canvasVisX + (this.state.sourceX * canvasScale);
                const sourceRectVisY = canvasVisY + (this.state.sourceY * canvasScale);
                const sourceRectVisWidth = this.state.sourceWidth * canvasScale;
                const sourceRectVisHeight = this.state.sourceHeight * canvasScale;
            
            // Draw source rect
            debugCtx.strokeStyle = '#FF0000';
            debugCtx.strokeRect(sourceRectVisX, sourceRectVisY, sourceRectVisWidth, sourceRectVisHeight);
            
            // Draw cursor position
            debugCtx.fillStyle = '#FFFF00';
            debugCtx.beginPath();
            debugCtx.arc(cursorVisX, cursorVisY, 3, 0, Math.PI * 2);
            debugCtx.fill();
            
            // Draw line from cursor to source rect center
            debugCtx.strokeStyle = '#00FF00';
            debugCtx.beginPath();
            debugCtx.moveTo(cursorVisX, cursorVisY);
            debugCtx.lineTo(sourceRectVisX + sourceRectVisWidth/2, sourceRectVisY + sourceRectVisHeight/2);
            debugCtx.stroke();
            
            // Label for visualization
            debugCtx.fillStyle = '#FFFFFF';
            debugCtx.fillText('Canvas Visualization (scaled)', canvasVisX, canvasVisY - 5);
            
            // Offset values
                const offsetX = this.state.sourceX - this.state.x + (this.state.sourceWidth / 2);
                const offsetY = this.state.sourceY - this.state.y + (this.state.sourceHeight / 2);
            debugCtx.fillText(`Alignment Offset: (${offsetX.toFixed(1)}, ${offsetY.toFixed(1)})`, 10, canvasVisY + canvasVisHeight + 20);
            }
        }

        // Instantiate the main class
        const magnifyGlass = new MagnifyGlass();

        // Add settings to the ComfyUI settings dialog
        app.ui.settings.addSetting({
            id: "🔍MagnifyGlass.ZoomFactor",
            name: "🔍 Magnify Glass: Zoom Factor",
            type: "slider",
            defaultValue: DEFAULT_SETTINGS["🔍MagnifyGlass.ZoomFactor"],
            min: 1.0,
            max: 10.0,
            step: 0.1,
            tooltip: "Magnification level (e.g., 2.5 means 2.5x zoom).",
            onChange: (value) => {
                if (magnifyGlass && magnifyGlass.config) {
                    magnifyGlass.config.zoomFactor = parseFloat(value);
                    if (magnifyGlass.state.active) {
                        magnifyGlass.updateMagnifiedView();
                    }
                }
            }
        });

        app.ui.settings.addSetting({
            id: "🔍MagnifyGlass.GlassSize",
            name: "🔍 Magnify Glass: Size (px)",
            type: "slider",
            defaultValue: DEFAULT_SETTINGS["🔍MagnifyGlass.GlassSize"],
            min: 50,
            max: 100,
            step: 10,
            tooltip: "Diameter of the magnifying glass circle in pixels. Slider max is 100, but larger values can be manually set if needed.",
            onChange: (value) => {
                if (magnifyGlass && magnifyGlass.config) {
                    magnifyGlass.config.glassSize = parseInt(value, 10);
                    magnifyGlass.applyUiChanges(); // Update div/canvas size
                    if (magnifyGlass.state.active) {
                        magnifyGlass.updateMagnifiedView(); // Recalculate source based on new size
                    }
                }
            }
        });

        app.ui.settings.addSetting({
            id: "🔍MagnifyGlass.BorderWidth",
            name: "🔍 Magnify Glass: Border Width (px)",
            type: "slider",
            defaultValue: DEFAULT_SETTINGS["🔍MagnifyGlass.BorderWidth"],
            min: 0,
            max: 10,
            step: 1,
            tooltip: "Width of the border around the magnifying glass.",
            onChange: (value) => {
                if (magnifyGlass && magnifyGlass.config) {
                    magnifyGlass.config.borderWidth = parseInt(value, 10);
                    magnifyGlass.applyUiChanges(); // Update border style
                }
            }
        });
        
        app.ui.settings.addSetting({
            id: "🔍MagnifyGlass.BorderColor",
            name: "🎨 Magnify Glass: Border Color",
            type: "color",
            defaultValue: DEFAULT_SETTINGS["🔍MagnifyGlass.BorderColor"],
            tooltip: "Color of the border around the magnifying glass.",
            onChange: (value) => {
                if (magnifyGlass && magnifyGlass.config) {
                    magnifyGlass.config.borderColor = value;
                    magnifyGlass.applyUiChanges(); // Update border style
                }
            }
        });

        app.ui.settings.addSetting({
            id: "🔍MagnifyGlass.ActivationKey",
            name: "⌨️ Magnify Glass: Activation Key",
            type: "combo",
            options: ["x", "z", "m", "q", "v", "c"], // Limited selection for simplicity
            defaultValue: DEFAULT_SETTINGS["🔍MagnifyGlass.ActivationKey"],
            tooltip: "The key (case-insensitive) to hold down to activate the magnifier. Works with Alt/Option if 'Require Alt/Option Key' is Yes.",
            onChange: (value) => {
                if (magnifyGlass && magnifyGlass.config) {
                    magnifyGlass.config.activationKey = value.toLowerCase();
                    magnifyGlass.debugger.log(`Activation key set to ${magnifyGlass.config.altRequired ? 'Alt/Option+' : ''}${magnifyGlass.config.activationKey.toUpperCase()}`);
                }
            }
        });

        app.ui.settings.addSetting({
            id: "🔍MagnifyGlass.AltRequired",
            name: "⌨️ Magnify Glass: Require Alt/Option Key",
            type: "combo",
            options: [ { value: true, text: "Yes" }, { value: false, text: "No" } ],
            defaultValue: DEFAULT_SETTINGS["🔍MagnifyGlass.AltRequired"],
            tooltip: "If Yes, Alt (Windows/Linux) or Option (Mac) must be held along with the activation key.",
            onChange: (value) => {
                if (magnifyGlass && magnifyGlass.config) {
                    magnifyGlass.config.altRequired = value;
                    magnifyGlass.debugger.log(`Activation key set to ${magnifyGlass.config.altRequired ? 'Alt/Option+' : ''}${magnifyGlass.config.activationKey.toUpperCase()}`);
                }
            }
        });
        
        app.ui.settings.addSetting({
            id: "🔍MagnifyGlass.FollowCursor",
            name: "🖱️ Magnify Glass: Follow Cursor Position",
            type: "combo",
            options: [ { value: true, text: "Yes" }, { value: false, text: "No" } ],
            defaultValue: DEFAULT_SETTINGS["🔍MagnifyGlass.FollowCursor"],
            tooltip: "If Yes, the magnifier window moves with the cursor. If No, it stays where activated.",
            onChange: (value) => {
                if (magnifyGlass && magnifyGlass.config) {
                    magnifyGlass.config.followCursor = value;
                }
            }
        });

        app.ui.settings.addSetting({
            id: "🔍MagnifyGlass.OffsetStep",
            name: "⌨️ Magnify Glass: Offset Adjust Step (Graph Units)",
            type: "slider",
            defaultValue: DEFAULT_SETTINGS["🔍MagnifyGlass.OffsetStep"],
            min: 1,
            max: 50, // Increased max
            step: 1,
            tooltip: "How many graph units the view shifts when pressing arrow keys (Shift+Arrow = 5x).",
            onChange: (value) => {
                if (magnifyGlass && magnifyGlass.config) {
                    magnifyGlass.config.offsetStep = parseInt(value, 10);
                }
            }
        });
        
        app.ui.settings.addSetting({
            id: "🔍MagnifyGlass.ResetKey",
            name: "⌨️ Magnify Glass: Reset Offset Key",
            type: "combo",
            options: ["r", "o", "p", "k", "l"], // Example keys, can be expanded
            defaultValue: DEFAULT_SETTINGS["🔍MagnifyGlass.ResetKey"],
            tooltip: "The key (case-insensitive) to press to reset the view offset while the magnifier is active. Works with Alt/Option if 'Require Alt for Reset' is Yes.",
            onChange: (value) => {
                if (magnifyGlass && magnifyGlass.config) {
                    magnifyGlass.config.resetKey = value.toLowerCase();
                    magnifyGlass.debugger.log(`Reset offset key set to ${magnifyGlass.config.resetAltRequired ? 'Alt/Option+' : ''}${magnifyGlass.config.resetKey.toUpperCase()}`);
                }
            }
        });

        app.ui.settings.addSetting({
            id: "🔍MagnifyGlass.ResetAltRequired",
            name: "⌨️ Magnify Glass: Require Alt/Option for Reset",
            type: "combo",
            options: [ { value: true, text: "Yes" }, { value: false, text: "No" } ],
            defaultValue: DEFAULT_SETTINGS["🔍MagnifyGlass.ResetAltRequired"],
            tooltip: "If Yes, Alt (Windows/Linux) or Option (Mac) must be held along with the reset key.",
            onChange: (value) => {
                if (magnifyGlass && magnifyGlass.config) {
                    magnifyGlass.config.resetAltRequired = value;
                    magnifyGlass.debugger.log(`Require Alt/Option for Reset set to ${value}. Reset key combination is now ${magnifyGlass.config.resetAltRequired ? 'Alt/Option+' : ''}${magnifyGlass.config.resetKey.toUpperCase()}`);
                }
            }
        });

        app.ui.settings.addSetting({
            id: "🔍MagnifyGlass.DebugMode",
            name: "🐞 Magnify Glass: Debug Mode",
            type: "combo",
            options: [ { value: true, text: "Enabled" }, { value: false, text: "Disabled" } ],
            defaultValue: DEFAULT_SETTINGS["🔍MagnifyGlass.DebugMode"],
            tooltip: "Show detailed logging and the debug visualization overlay.",
            onChange: (value) => {
                if (magnifyGlass && magnifyGlass.config) {
                    magnifyGlass.config.debugMode = value;
                    magnifyGlass.applyUiChanges(); // Show/hide debug canvas
                }
            }
        });
        
        app.ui.settings.addSetting({
            id: "🔍MagnifyGlass.GlassPosition",
            name: "🖱️ Magnify Glass: Glass Position",
            type: "combo",
            options: [
                { value: "Bottom", text: "Bottom (Default)" },
                { value: "Top", text: "Top" },
                { value: "Left", text: "Left" },
                { value: "Right", text: "Right" },
                { value: "Top-Left", text: "Top-Left" },
                { value: "Top-Right", text: "Top-Right" },
                { value: "Bottom-Left", text: "Bottom-Left" },
                { value: "Bottom-Right", text: "Bottom-Right" }
            ],
            defaultValue: DEFAULT_SETTINGS["🔍MagnifyGlass.GlassPosition"],
            tooltip: "Position of the magnifying glass relative to the cursor.",
            onChange: (value) => {
                if (magnifyGlass && magnifyGlass.config) {
                    magnifyGlass.config.glassPosition = value;
                    // If glass is active and not following cursor, might need to reposition
                    if (magnifyGlass.state.active && !magnifyGlass.config.followCursor) {
                        // To reposition, we need the last known cursor position.
                        // This assumes lastKnownMousePosition is up-to-date.
                        // A more robust solution might involve storing the activation point.
                        const { x, y } = magnifyGlass.lastKnownMousePosition;
                        magnifyGlass.ui.positionGlass(x, y);
                    }
                }
            }
        });
        
        app.ui.settings.addSetting({
            id: "🔍MagnifyGlass.GlassShape",
            name: "🖼️ Magnify Glass: Shape",
            type: "combo",
            options: [
                { value: "Circle", text: "Circle" },
                { value: "Square", text: "Square" },
                { value: "Rounded Square", text: "Rounded Square" }
            ],
            defaultValue: DEFAULT_SETTINGS["🔍MagnifyGlass.GlassShape"],
            tooltip: "Shape of the magnifying glass (e.g., Circle, Square).",
            onChange: (value) => {
                if (magnifyGlass && magnifyGlass.config) {
                    magnifyGlass.config.glassShape = value;
                    magnifyGlass.applyUiChanges(); // Update border-radius
                }
            }
        });

        app.ui.settings.addSetting({
            id: "🔍MagnifyGlass.BorderEnabled",
            name: "🖼️ Magnify Glass: Show Border",
            type: "combo",
            options: [ 
                { value: true, text: "Yes" }, 
                { value: false, text: "No" } 
            ],
            defaultValue: DEFAULT_SETTINGS["🔍MagnifyGlass.BorderEnabled"],
            tooltip: "Enable or disable the border around the magnifying glass.",
            onChange: (value) => {
                if (magnifyGlass && magnifyGlass.config) {
                    magnifyGlass.config.borderEnabled = value;
                    magnifyGlass.applyUiChanges(); // Update border visibility
                }
            }
        });
        
        app.ui.settings.addSetting({
            id: "🔍MagnifyGlass.TextureFiltering",
            name: "🖼️ Magnify Glass: Texture Filtering",
            type: "combo",
            options: [
                { value: "Linear", text: "Linear (Smooth)" },
                { value: "Nearest", text: "Nearest (Pixelated)" }
            ],
            defaultValue: DEFAULT_SETTINGS["🔍MagnifyGlass.TextureFiltering"],
            tooltip: "Controls how the magnified image is scaled. Linear is smoother, Nearest is sharper/pixelated.",
            onChange: (value) => {
                if (magnifyGlass && magnifyGlass.config && magnifyGlass.renderer) {
                    magnifyGlass.config.textureFiltering = value;
                    magnifyGlass.renderer.updateTextureFiltering(value);
                    if (magnifyGlass.state.active) {
                        magnifyGlass.updateMagnifiedView(); // Re-render if active
                    }
                }
            }
        });
        
        // --- Initialization ---
        
        // Load settings into the config object *after* settings are registered
        magnifyGlass.config.loadSettings();
        
        // Initialize the magnifier (reads config, creates UI, attaches listeners)
        magnifyGlass.init();

        // Optional: Apply default settings if any are missing (similar to link_animations)
        // This ensures that if new settings are added later, they get a default value
        // without needing a full reset from the user.
        // You might want a more sophisticated version check later.
        // Object.entries(DEFAULT_SETTINGS).forEach(([key, value]) => {
        //     const fullKey = `MagnifyGlass.${key.split('.')[1]}`; // Construct full ID
        //     const setting = app.ui.settings.items.find(s => s.id === fullKey);
        //     if (setting && app.ui.settings.getSettingValue(fullKey) === undefined) {
        //         app.ui.settings.setSettingValue(fullKey, value);
        //         // Manually update the config if a default was just applied
        //         const configKey = key.split('.')[1].charAt(0).toLowerCase() + key.split('.')[1].slice(1); // e.g., ZoomFactor -> zoomFactor
        //         if (magnifyGlass.config.hasOwnProperty(configKey)) {
        //              magnifyGlass.config[configKey] = value;
        //              console.log(`Applied default for ${fullKey}`);
        //         }
        //         // Apply immediate UI changes if needed for the defaulted setting
        //         if(setting.onChange) {
        //             setting.onChange(value);
        //         } else {
        //             magnifyGlass.applyUiChanges();
        //         }
        //     }
        // });
        magnifyGlass.applyUiChanges(); // Ensure UI reflects loaded/default settings initially


        // --- Diagnostic Info (moved inside setup) ---
        console.log("---- Magnifier Diagnostic Info ----");
        // Browser Info
        console.log("User Agent:", navigator.userAgent);
        console.log("Device Pixel Ratio:", window.devicePixelRatio);
        // ComfyUI Canvas State
        if (typeof app !== 'undefined' && app.canvas && app.canvas.ds) {
            console.log("ComfyUI Canvas Scale:", app.canvas.ds.scale);
            console.log("ComfyUI Canvas Offset:", app.canvas.ds.offset);
        } else {
            console.log("ComfyUI Canvas State: Could not access app.canvas.ds");
        }
        // Stored Manual Offsets
        try {
            const offsetX = localStorage.getItem('comfyui_magnify_offset_x') || 'Not Set (Will be 0)';
            const offsetY = localStorage.getItem('comfyui_magnify_offset_y') || 'Not Set (Will be 0)';
            console.log("Stored Manual Offset X:", offsetX);
            console.log("Stored Manual Offset Y:", offsetY);
        } catch (e) {
            console.error("Error reading offsets from localStorage:", e);
        }
        console.log("---- End Diagnostic Info ----");
        console.log("REMINDER: Please also copy the 'ComfyUI Magnifying Glass:' log lines that appeared *before* this diagnostic block.");
        console.log("REMINDER: Please provide Browser Name/Version, Browser Zoom %, and a Screenshot if reporting issues.");
    } // End setup()
}); // End app.registerExtension