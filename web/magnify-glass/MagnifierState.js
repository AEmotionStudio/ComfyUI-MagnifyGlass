/**
 * ComfyUI MagnifyGlass - MagnifierState
 * 
 * Manages the state of the magnifying glass.
 */

/**
 * Magnifier state class.
 * Tracks activation state, cursor position, and canvas transforms.
 */
export class MagnifierState {
    constructor() {
        this.active = false;
        this.wasActivatedBefore = false; // Track if the glass has been activated before
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

    /**
     * Reset state to initial values.
     */
    reset() {
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
