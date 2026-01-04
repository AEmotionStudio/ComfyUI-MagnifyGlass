var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class WebGLRenderer {
  constructor(config, state, ui) {
    __publicField(this, "config");
    __publicField(this, "state");
    __publicField(this, "ui");
    __publicField(this, "gl");
    __publicField(this, "program");
    __publicField(this, "texture");
    __publicField(this, "positionBuffer");
    __publicField(this, "texCoordBuffer");
    __publicField(this, "uniformLocations");
    __publicField(this, "attributeLocations");
    __publicField(this, "currentFilteringMode");
    // Dirty flag optimization
    __publicField(this, "lastCanvasVersion");
    __publicField(this, "lastSourceX");
    __publicField(this, "lastSourceY");
    __publicField(this, "lastSourceWidth");
    __publicField(this, "lastSourceHeight");
    __publicField(this, "textureUploadSkipCount");
    __publicField(this, "vertexShaderSource");
    __publicField(this, "fragmentShaderSource");
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
  initialize() {
    if (!this.ui.glassCanvas) return;
    this.gl = this.ui.glassCanvas.getContext("webgl", { preserveDrawingBuffer: true });
    if (!this.gl) {
      this.gl = this.ui.glassCanvas.getContext("webgl2", { preserveDrawingBuffer: true });
    }
    if (!this.gl) {
      const isFirefox = navigator.userAgent.toLowerCase().includes("firefox");
      const browserInstructions = isFirefox ? "Firefox: Go to about:config, search for 'webgl.disabled' and set it to 'false', then restart Firefox." : "Check your browser settings to ensure WebGL is enabled.";
      console.error("ComfyUI Magnifying Glass ERROR: WebGL not supported or context creation failed.");
      console.error(`To fix: ${browserInstructions}`);
      this.showWebGLError(browserInstructions);
      return;
    }
    this.program = this.createShaderProgram(this.gl, this.vertexShaderSource, this.fragmentShaderSource);
    if (!this.program) return;
    this.positionBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    const positions = [-1, -1, 1, -1, -1, 1, 1, 1];
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(positions), this.gl.STATIC_DRAW);
    this.texCoordBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    const texCoords = [0, 1, 1, 1, 0, 0, 1, 0];
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array(texCoords), this.gl.STATIC_DRAW);
    this.texture = this.gl.createTexture();
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.pixelStorei(this.gl.UNPACK_FLIP_Y_WEBGL, false);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
    this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    this.updateTextureFiltering(this.config.textureFiltering);
    this.uniformLocations = {
      sourceTexture: this.gl.getUniformLocation(this.program, "u_sourceTexture"),
      textureOffset: this.gl.getUniformLocation(this.program, "u_textureOffset"),
      textureRepeat: this.gl.getUniformLocation(this.program, "u_textureRepeat"),
      glassSize: this.gl.getUniformLocation(this.program, "u_glassSize")
    };
    this.attributeLocations = {
      position: this.gl.getAttribLocation(this.program, "a_position"),
      texCoord: this.gl.getAttribLocation(this.program, "a_texCoord")
    };
  }
  /**
   * Update texture filtering mode.
   * @param filteringModeString - "Linear" or "Nearest"
   */
  updateTextureFiltering(filteringModeString) {
    if (!this.gl || !this.texture) return;
    let glFilterMode;
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
  isValid() {
    return this.gl !== null && this.program !== null;
  }
  /**
   * Create a WebGL shader program.
   * @param gl - WebGL context
   * @param vsSource - Vertex shader source
   * @param fsSource - Fragment shader source
   * @returns WebGL program or null on failure
   */
  createShaderProgram(gl, vsSource, fsSource) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER);
    if (!vertexShader) return null;
    gl.shaderSource(vertexShader, vsSource);
    gl.compileShader(vertexShader);
    if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
      console.error("ComfyUI Magnifying Glass ERROR: Vertex shader compilation error:", gl.getShaderInfoLog(vertexShader));
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
      console.error("ComfyUI Magnifying Glass ERROR: Fragment shader compilation error:", gl.getShaderInfoLog(fragmentShader));
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
      console.error("ComfyUI Magnifying Glass ERROR: Shader program linking error:", gl.getProgramInfoLog(program));
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
  render(sourceCanvas) {
    var _a;
    if (!this.gl || !this.program || !this.texture || !this.uniformLocations || !this.attributeLocations) return;
    const app = window.app;
    const currentCanvasVersion = ((_a = app == null ? void 0 : app.graph) == null ? void 0 : _a.change_counter) ?? -1;
    const sourceChanged = this.lastSourceX !== this.state.sourceX || this.lastSourceY !== this.state.sourceY || this.lastSourceWidth !== this.state.sourceWidth || this.lastSourceHeight !== this.state.sourceHeight;
    const canvasChanged = currentCanvasVersion !== this.lastCanvasVersion;
    const needsTextureUpdate = canvasChanged || sourceChanged || this.lastCanvasVersion === -1;
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    if (needsTextureUpdate) {
      try {
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, sourceCanvas);
        this.lastCanvasVersion = currentCanvasVersion;
        this.lastSourceX = this.state.sourceX;
        this.lastSourceY = this.state.sourceY;
        this.lastSourceWidth = this.state.sourceWidth;
        this.lastSourceHeight = this.state.sourceHeight;
        this.textureUploadSkipCount = 0;
      } catch (e) {
        console.error("ComfyUI Magnifying Glass ERROR: Error in texImage2D:", e);
        return;
      }
    } else {
      this.textureUploadSkipCount++;
    }
    const isOffscreenCanvas = sourceCanvas.width === this.config.glassSize && sourceCanvas.height === this.config.glassSize;
    let uvX, uvY, uvWidth, uvHeight;
    if (isOffscreenCanvas) {
      uvX = 0;
      uvY = 0;
      uvWidth = 1;
      uvHeight = 1;
    } else {
      uvX = this.state.sourceX / sourceCanvas.width;
      uvY = this.state.sourceY / sourceCanvas.height;
      uvWidth = this.state.sourceWidth / sourceCanvas.width;
      uvHeight = this.state.sourceHeight / sourceCanvas.height;
    }
    this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    this.gl.clearColor(0, 0, 0, 0);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    this.gl.useProgram(this.program);
    this.gl.activeTexture(this.gl.TEXTURE0);
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
    this.gl.uniform1i(this.uniformLocations.sourceTexture, 0);
    this.gl.uniform2f(this.uniformLocations.textureOffset, uvX, uvY);
    this.gl.uniform2f(this.uniformLocations.textureRepeat, uvWidth, uvHeight);
    this.gl.uniform1f(this.uniformLocations.glassSize, this.config.glassSize);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
    this.gl.vertexAttribPointer(this.attributeLocations.position, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.attributeLocations.position);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.texCoordBuffer);
    this.gl.vertexAttribPointer(this.attributeLocations.texCoord, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.enableVertexAttribArray(this.attributeLocations.texCoord);
    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }
  /**
   * Check for WebGL errors.
   * @param label - Debug label
   * @returns True if error occurred
   */
  checkWebGLError(label) {
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
  updateViewport() {
    if (this.gl) {
      this.gl.viewport(0, 0, this.gl.canvas.width, this.gl.canvas.height);
    }
  }
  /**
   * Show WebGL error notification to user.
   * @param instructions - Browser-specific instructions to fix
   */
  showWebGLError(instructions) {
    const toast = document.createElement("div");
    toast.id = "magnifyglass-webgl-error";
    toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            max-width: 400px;
            padding: 16px 20px;
            background: linear-gradient(135deg, #ff4444 0%, #cc3333 100%);
            color: white;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            font-family: system-ui, -apple-system, sans-serif;
            font-size: 14px;
            line-height: 1.5;
            z-index: 100000;
            animation: slideIn 0.3s ease-out;
        `;
    toast.innerHTML = `
            <div style="display: flex; align-items: flex-start; gap: 12px;">
                <span style="font-size: 24px;">⚠️</span>
                <div>
                    <strong style="display: block; margin-bottom: 6px;">MagnifyGlass: WebGL Disabled</strong>
                    <span style="opacity: 0.9;">${instructions}</span>
                    <button onclick="this.parentElement.parentElement.parentElement.remove()" 
                            style="display: block; margin-top: 10px; padding: 6px 12px; background: rgba(255,255,255,0.2); 
                                   border: 1px solid rgba(255,255,255,0.3); border-radius: 4px; color: white; 
                                   cursor: pointer; font-size: 12px;">
                        Dismiss
                    </button>
                </div>
            </div>
        `;
    if (!document.getElementById("magnifyglass-toast-style")) {
      const style = document.createElement("style");
      style.id = "magnifyglass-toast-style";
      style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
      document.head.appendChild(style);
    }
    document.body.appendChild(toast);
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.animation = "slideIn 0.3s ease-out reverse";
        setTimeout(() => toast.remove(), 300);
      }
    }, 15e3);
  }
}
export {
  WebGLRenderer
};
//# sourceMappingURL=WebGLRenderer.js.map
