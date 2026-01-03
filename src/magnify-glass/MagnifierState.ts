/**
 * ComfyUI MagnifyGlass - MagnifierState (TypeScript)
 * 
 * Manages the state of the magnifying glass.
 */

/**
 * Magnifier state class.
 * Tracks activation state, cursor position, and canvas transforms.
 */
export class MagnifierState {
    /** Whether the magnifier is currently active */
    active: boolean;

    /** Track if the glass has been activated before */
    wasActivatedBefore: boolean;

    /** Cursor X relative to litegraphCanvas */
    x: number;

    /** Cursor Y relative to litegraphCanvas */
    y: number;

    /** Calculated source area X */
    sourceX: number;

    /** Calculated source area Y */
    sourceY: number;

    /** Calculated source area width */
    sourceWidth: number;

    /** Calculated source area height */
    sourceHeight: number;

    /** Current canvas scale/zoom */
    canvasScale: number;

    /** Canvas translation X */
    canvasOffsetX: number;

    /** Canvas translation Y */
    canvasOffsetY: number;

    /** Flag to manage requestAnimationFrame */
    isRenderScheduled: boolean;

    /** Whether glass drag mode is enabled (move icon on hover controls) */
    isDragModeEnabled: boolean;

    constructor() {
        this.active = false;
        this.wasActivatedBefore = false;
        this.x = 0;
        this.y = 0;
        this.sourceX = 0;
        this.sourceY = 0;
        this.sourceWidth = 0;
        this.sourceHeight = 0;
        this.canvasScale = 1.0;
        this.canvasOffsetX = 0;
        this.canvasOffsetY = 0;
        this.isRenderScheduled = false;
        this.isDragModeEnabled = false;
    }

    /**
     * Reset state to initial values.
     */
    reset(): void {
        this.active = false;
        this.wasActivatedBefore = false;
        this.x = 0;
        this.y = 0;
        this.sourceX = 0;
        this.sourceY = 0;
        this.sourceWidth = 0;
        this.sourceHeight = 0;
        this.canvasScale = 1.0;
        this.canvasOffsetX = 0;
        this.canvasOffsetY = 0;
        this.isRenderScheduled = false;
    }
}
