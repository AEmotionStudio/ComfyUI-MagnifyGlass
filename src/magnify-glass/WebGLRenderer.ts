/**
 * ComfyUI MagnifyGlass - WebGLRenderer (TypeScript)
 * 
 * Handles WebGL-based rendering of the magnified view.
 */

import type { ConfigManager } from './ConfigManager';
import type { MagnifierState } from './MagnifierState';
import type { UiManager } from './UiManager';

interface UniformLocations {
    sourceTexture: WebGLUniformLocation | null;
    textureOffset: WebGLUniformLocation | null;
    textureRepeat: WebGLUniformLocation | null;
    glassSize: WebGLUniformLocation | null;
}

interface AttributeLocations {
    position: number;
    texCoord: number;
}

/**
 * WebGL Renderer class.
 * Provides efficient WebGL-based magnification rendering.
 */
export class WebGLRenderer {
    config: ConfigManager;
    state: MagnifierState;
    ui: UiManager;

    gl: WebGLRenderingContext | null;
    program: WebGLProgram | null;
    texture: WebGLTexture | null;
    positionBuffer: WebGLBuffer | null;
    texCoordBuffer: WebGLBuffer | null;
    uniformLocations: UniformLocations | null;
    attributeLocations: AttributeLocations | null;
    currentFilteringMode: number | null;

    // Dirty flag optimization
    lastCanvasVersion: number;
    lastSourceX: number;
    lastSourceY: number;
    lastSourceWidth: number;
    lastSourceHeight: number;
    textureUploadSkipCount: number;

    vertexShaderSource: string;
    fragmentShaderSource: string;

    constructor(config: ConfigManager, state: MagnifierState, ui: UiManager) {
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
        this.currentFilteringMode = null;

        // Initialize dirty flag tracking
        this.lastCanvasVersion = -1;
        this.lastSourceX = -1;
        this.lastSourceY = -1;
        this.lastSourceWidth = -1;
        this.lastSourceHeight = -1;
        this.textureUploadSkipCount = 0;

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

    /**
     * Initialize WebGL context and resources.
     */
    initialize(): void {
        // Get WebGL context
        if (!this.ui.glassCanvas) return;

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
        this.updateTextureFiltering(this.config.textureFiltering);

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

    /**
     * Update texture filtering mode.
     * @param filteringModeString - "Linear" or "Nearest"
     */
    updateTextureFiltering(filteringModeString: string): void {
        if (!this.gl || !this.texture) return;

        let glFilterMode: number;
        if (filteringModeString === "Nearest") {
            glFilterMode = this.gl.NEAREST;
        } else {
            glFilterMode = this.gl.LINEAR;
        }

        if (this.currentFilteringMode === glFilterMode) return;

        this.currentFilteringMode = glFilterMode;

        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, glFilterMode);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, glFilterMode);
        this.gl.bindTexture(this.gl.TEXTURE_2D, null);
    }

    /**
     * Check if renderer is valid and ready.
     * @returns Boolean indicating if WebGL context and program are ready
     */
    isValid(): boolean {
        return this.gl !== null && this.program !== null;
    }

    /**
     * Create a WebGL shader program.
     * @param gl - WebGL context
     * @param vsSource - Vertex shader source
     * @param fsSource - Fragment shader source
     * @returns WebGL program or null on failure
     */
    createShaderProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string): WebGLProgram | null {
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        if (!vertexShader) return null;

        gl.shaderSource(vertexShader, vsSource);
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            console.error('ComfyUI Magnifying Glass ERROR: Vertex shader compilation error:', gl.getShaderInfoLog(vertexShader));
            gl.deleteShader(vertexShader);
            return null;
        }

        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        if (!fragmentShader) {
            gl.deleteShader(vertexShader);
            return null;
        }

        gl.shaderSource(fragmentShader, fsSource);
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            console.error('ComfyUI Magnifying Glass ERROR: Fragment shader compilation error:', gl.getShaderInfoLog(fragmentShader));
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            return null;
        }

        const program = gl.createProgram();
        if (!program) {
            gl.deleteShader(vertexShader);
            gl.deleteShader(fragmentShader);
            return null;
        }

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

    /**
     * Render the magnified view.
     * @param sourceCanvas - The source canvas to sample from
     */
    render(sourceCanvas: HTMLCanvasElement): void {
        if (!this.gl || !this.program || !this.texture || !this.uniformLocations || !this.attributeLocations) return;

        // Check if we need to update the texture
        // We track: canvas version (via LiteGraph's change counter), source coordinates, and source dimensions
        const app = (window as any).app;
        const currentCanvasVersion = app?.graph?.change_counter ?? -1;

        const sourceChanged =
            this.lastSourceX !== this.state.sourceX ||
            this.lastSourceY !== this.state.sourceY ||
            this.lastSourceWidth !== this.state.sourceWidth ||
            this.lastSourceHeight !== this.state.sourceHeight;

        const canvasChanged = currentCanvasVersion !== this.lastCanvasVersion;

        // Only upload texture if something changed
        const needsTextureUpdate = canvasChanged || sourceChanged || this.lastCanvasVersion === -1;

        // Bind texture
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);

        if (needsTextureUpdate) {
            try {
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, sourceCanvas);

                // Update tracking variables
                this.lastCanvasVersion = currentCanvasVersion;
                this.lastSourceX = this.state.sourceX;
                this.lastSourceY = this.state.sourceY;
                this.lastSourceWidth = this.state.sourceWidth;
                this.lastSourceHeight = this.state.sourceHeight;

                // Reset skip counter and log if debug mode
                if (this.config.debugMode && this.textureUploadSkipCount > 0) {
                    console.log(`[MagnifyGlass] Texture uploaded after skipping ${this.textureUploadSkipCount} frames`);
                }
                this.textureUploadSkipCount = 0;
            } catch (e) {
                console.error("ComfyUI Magnifying Glass ERROR: Error in texImage2D:", e);
                return;
            }
        } else {
            // Skip texture upload - just increment counter
            this.textureUploadSkipCount++;

            // Periodic debug logging
            if (this.config.debugMode && this.textureUploadSkipCount % 60 === 0) {
                console.log(`[MagnifyGlass] Texture upload skipped (${this.textureUploadSkipCount} frames cached)`);
            }
        }

        // Calculate normalized texture coordinates (UV space: 0-1)
        const uvX = this.state.sourceX / sourceCanvas.width;
        const uvY = this.state.sourceY / sourceCanvas.height;
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

    /**
     * Check for WebGL errors.
     * @param label - Debug label
     * @returns True if error occurred
     */
    checkWebGLError(label: string): boolean {
        if (!this.gl) return false;

        const err = this.gl.getError();
        if (err !== this.gl.NO_ERROR) {
            console.error(`ComfyUI Magnifying Glass ERROR: WebGL Error (${label}):`, err);
            return true;
        }
        return false;
    }

    /**
     * Update viewport when glass size changes.
     */
    updateViewport(): void {
        if (this.gl) {
            this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
        }
    }
}
