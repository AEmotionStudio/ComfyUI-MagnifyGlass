/**
 * ComfyUI MagnifyGlass - DebugManager (TypeScript)
 * 
 * Handles debug visualization and logging.
 */

import type { ComfyApp } from '../types/comfyui';
import type { ConfigManager } from './ConfigManager';
import type { MagnifierState } from './MagnifierState';
import type { UiManager } from './UiManager';

declare const app: ComfyApp;

/**
 * Debug Manager class.
 * Provides debug logging and canvas visualization.
 */
export class DebugManager {
    config: ConfigManager;
    state: MagnifierState;
    ui: UiManager;

    constructor(config: ConfigManager, state: MagnifierState, ui: UiManager) {
        this.config = config;
        this.state = state;
        this.ui = ui;
    }

    /**
     * Log a message if debug mode is enabled.
     */
    log(...args: unknown[]): void {
        if (this.config.debugMode) {
            console.log("ComfyUI Magnifying Glass:", ...args);
        }
    }

    /**
     * Log an error message.
     */
    error(...args: unknown[]): void {
        console.error("ComfyUI Magnifying Glass ERROR:", ...args);
    }

    /**
     * Print detailed canvas information for debugging.
     */
    printCanvasInfo(): void {
        if (!this.config.debugMode) return;

        try {
            // Using any for deep property access on ComfyUI objects that might vary
            const canvasManager = (app as any).canvas;
            const canvas = canvasManager?.graph_canvas as HTMLCanvasElement;

            if (!canvas) {
                this.log("Could not find graph canvas for detailed info");
                return;
            }

            this.log("---- Canvas Information ----");
            this.log(`Canvas dimensions: ${canvas.width}x${canvas.height}`);
            this.log(`Canvas display size: ${canvas.clientWidth}x${canvas.clientHeight}`);
            this.log(`Canvas CSS transform: ${canvas.style.transform || 'none'}`);

            const ds = canvasManager.ds;
            if (ds) {
                this.log(`Canvas DS scale: ${ds.scale}`);
                if (ds.offset) {
                    this.log(`Canvas DS offset: [${ds.offset[0]}, ${ds.offset[1]}]`);
                } else {
                    this.log("Canvas DS offset not found");
                }
            } else {
                this.log("Canvas DS object not found");
            }

            const screenWidth = window.innerWidth;
            const screenHeight = window.innerHeight;
            const canvasWidth = canvas.width;
            const canvasHeight = canvas.height;

            this.log(`Window dimensions: ${screenWidth}x${screenHeight}`);
            this.log(`Resolution scale factor: X=${canvasWidth / screenWidth}, Y=${canvasHeight / screenHeight}`);
            this.log("---- End Canvas Information ----");
        } catch (e) {
            this.log("Error in printCanvasInfo:", e);
        }
    }

    /**
     * Update the debug visualization canvas.
     */
    updateDebugView(): void {
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
        debugCtx.fillStyle = '#FFFF00';
        debugCtx.fillText(`MANUAL OFFSETS: X=${this.config.offsetX}, Y=${this.config.offsetY} (Use arrow keys to adjust)`, 10, 130);
        debugCtx.fillStyle = '#FFFFFF';

        // Visualization
        this.drawCanvasVisualization(debugCtx, debugCanvas);
    }

    /**
     * Draw a scaled visualization of the canvas and source region.
     */
    drawCanvasVisualization(debugCtx: CanvasRenderingContext2D, debugCanvas: HTMLCanvasElement): void {
        const canvasScale = 0.1;
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
        debugCtx.lineTo(sourceRectVisX + sourceRectVisWidth / 2, sourceRectVisY + sourceRectVisHeight / 2);
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
