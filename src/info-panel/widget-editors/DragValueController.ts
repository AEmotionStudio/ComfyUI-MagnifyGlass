/**
 * ComfyUI MagnifyGlass - Drag Value Controller
 * 
 * Handles horizontal drag gestures on inspector rows for quick value changes.
 * Allows users to drag left/right to adjust numbers or cycle through options.
 */

import { WidgetSyncManager, WidgetConstraints } from './WidgetSyncManager';
import { Logger } from '../../shared/logger';

/**
 * Configuration for drag behavior
 */
export interface DragConfig {
    nodeId: number;
    widgetName: string;
    widgetType: string;
    currentValue: unknown;
    constraints?: WidgetConstraints;
    onChange?: (value: unknown) => void;
}

/**
 * Default sensitivity settings
 */
const DRAG_SENSITIVITY = {
    // Pixels to drag for one step change (applies to all numeric types)
    pixelsPerStep: 10,
    // Minimum pixels to trigger option cycle for combos (increased to prevent accidental cycling)
    comboThreshold: 60,
};

/**
 * Drag Value Controller
 * Manages drag interactions for inline value editing
 */
export class DragValueController {
    private element: HTMLElement;
    private config: DragConfig;
    private isDragging: boolean = false;
    private startX: number = 0;
    private startValue: number = 0;
    private startOptionIndex: number = 0;
    private accumulatedDelta: number = 0;

    // Bound event handlers for cleanup
    private boundPointerMove: (e: PointerEvent) => void;
    private boundPointerUp: (e: PointerEvent) => void;
    private boundPointerCancel: (e: PointerEvent) => void;
    private boundLostCapture: (e: PointerEvent) => void;

    constructor(element: HTMLElement, config: DragConfig) {
        this.element = element;
        this.config = config;

        this.boundPointerMove = this.onPointerMove.bind(this);
        this.boundPointerUp = this.onPointerUp.bind(this);
        this.boundPointerCancel = this.onPointerCancel.bind(this);
        this.boundLostCapture = this.onLostCapture.bind(this);

        this.init();
    }

    /**
     * Initialize drag handling
     */
    private init(): void {
        this.element.classList.add('draggable');

        this.element.addEventListener('pointerdown', this.onPointerDown.bind(this));

        // Add visual indicator
        // this.addDragIndicator();
    }

    /**
     * Add visual drag indicator to the row
     */
    private addDragIndicator(): void {
        // Check if already has indicator
        if (this.element.querySelector('.drag-indicator')) return;

        const indicator = document.createElement('span');
        indicator.className = 'drag-indicator';
        indicator.innerHTML = '⟷'; // Left-right arrow
        indicator.setAttribute('aria-hidden', 'true');
        this.element.appendChild(indicator);
    }

    /**
     * Handle pointer down - start drag tracking
     */
    private onPointerDown(e: PointerEvent): void {
        // Only handle left mouse button or touch
        if (e.button !== 0) return;

        // Don't start drag if clicking on interactive elements or value/editor areas
        // Only the label area should initiate drag - all controls should be clickable
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' ||
            target.tagName === 'SELECT' ||
            target.tagName === 'BUTTON' ||
            target.closest('.inline-control') ||
            target.closest('.inline-control-container') ||
            target.closest('.info-value') ||
            target.closest('.widget-editor') ||
            target.closest('.widget-editor-container') ||
            target.closest('.widget-editor-stepper') ||
            target.closest('.widget-editor-number') ||
            target.closest('.widget-editor-input')) {
            return;
        }

        this.isDragging = true;
        this.startX = e.clientX;
        this.accumulatedDelta = 0;

        // Capture current value
        const type = this.config.widgetType.toLowerCase();
        if (type === 'number' || type === 'int' || type === 'float' || type === 'slider') {
            this.startValue = Number(this.config.currentValue) || 0;
        } else if (type === 'combo') {
            const options = this.config.constraints?.options ?? [];
            const currentStr = String(this.config.currentValue);
            this.startOptionIndex = options.findIndex(opt => String(opt) === currentStr);
            if (this.startOptionIndex === -1) this.startOptionIndex = 0;
        }

        // Add dragging class
        this.element.classList.add('dragging');

        // Capture pointer for reliable tracking
        this.element.setPointerCapture(e.pointerId);

        // Add document-level listeners with capture phase for reliability
        document.addEventListener('pointermove', this.boundPointerMove, true);
        document.addEventListener('pointerup', this.boundPointerUp, true);
        document.addEventListener('pointercancel', this.boundPointerCancel, true);
        this.element.addEventListener('lostpointercapture', this.boundLostCapture);

        e.preventDefault();
        e.stopPropagation();
        Logger.debug(`[DragValue] Started drag on ${this.config.widgetName}`);
    }

    /**
     * Handle pointer move - update value based on drag distance
     */
    private onPointerMove(e: PointerEvent): void {
        if (!this.isDragging) return;

        // Prevent browser from interpreting as text selection or native drag
        e.preventDefault();
        e.stopPropagation();

        const deltaX = e.clientX - this.startX;
        const type = this.config.widgetType.toLowerCase();

        if (type === 'number' || type === 'int' || type === 'float' || type === 'slider') {
            this.handleNumberDrag(deltaX);
        } else if (type === 'combo') {
            this.handleComboDrag(deltaX);
        }
    }

    /**
     * Handle number value drag
     * Uses discrete stepping: every N pixels = exactly 1 step change
     */
    private handleNumberDrag(deltaX: number): void {
        const constraints = this.config.constraints;
        const isInt = this.config.widgetType.toLowerCase() === 'int';

        // Determine the step size (1 for integers, 0.1 or widget step for floats)
        const step = constraints?.step ?? (isInt ? 1 : 0.1);

        // Calculate discrete number of steps (truncate, don't round)
        const steps = Math.trunc(deltaX / DRAG_SENSITIVITY.pixelsPerStep);

        // Calculate new value
        let newValue = this.startValue + (steps * step);

        // Apply constraints
        if (constraints?.min !== undefined) {
            newValue = Math.max(constraints.min, newValue);
        }
        if (constraints?.max !== undefined) {
            newValue = Math.min(constraints.max, newValue);
        }

        // Round for display precision
        if (isInt) {
            newValue = Math.round(newValue);
        } else {
            const precision = constraints?.precision ?? 2;
            newValue = Number(newValue.toFixed(precision));
        }

        // Sync the value
        WidgetSyncManager.syncWidgetValue(this.config.nodeId, this.config.widgetName, newValue);
        this.config.currentValue = newValue;
        this.config.onChange?.(newValue);
    }

    /**
     * Handle combo value drag - cycle through options
     */
    private handleComboDrag(deltaX: number): void {
        const options = this.config.constraints?.options ?? [];
        if (options.length === 0) return;

        this.accumulatedDelta = deltaX;

        // Calculate how many options to move
        const optionDelta = Math.floor(Math.abs(this.accumulatedDelta) / DRAG_SENSITIVITY.comboThreshold);

        if (optionDelta > 0) {
            const direction = deltaX > 0 ? 1 : -1;
            let newIndex = this.startOptionIndex + (optionDelta * direction);

            // Wrap around
            newIndex = ((newIndex % options.length) + options.length) % options.length;

            const newValue = options[newIndex];
            WidgetSyncManager.syncWidgetValue(this.config.nodeId, this.config.widgetName, newValue);
            this.config.currentValue = newValue;
            this.config.onChange?.(newValue);
        }
    }

    /**
     * Handle pointer up - end drag
     */
    private onPointerUp(e: PointerEvent): void {
        if (!this.isDragging) return;
        this.endDrag(e.pointerId);
        Logger.debug(`[DragValue] Ended drag on ${this.config.widgetName}`);
    }

    /**
     * Handle pointer cancel - browser cancelled the pointer (e.g., touch scroll)
     */
    private onPointerCancel(e: PointerEvent): void {
        if (!this.isDragging) return;
        this.endDrag(e.pointerId);
        Logger.debug(`[DragValue] Drag cancelled on ${this.config.widgetName}`);
    }

    /**
     * Handle lost pointer capture - capture was taken by another element
     */
    private onLostCapture(_e: PointerEvent): void {
        if (!this.isDragging) return;
        this.endDrag();
        Logger.debug(`[DragValue] Lost capture on ${this.config.widgetName}`);
    }

    /**
     * Common cleanup for ending drag
     */
    private endDrag(pointerId?: number): void {
        this.isDragging = false;
        this.element.classList.remove('dragging');

        // Release pointer capture if we have a pointer ID
        if (pointerId !== undefined) {
            try {
                this.element.releasePointerCapture(pointerId);
            } catch {
                // Ignore if already released
            }
        }

        // Remove all listeners
        document.removeEventListener('pointermove', this.boundPointerMove, true);
        document.removeEventListener('pointerup', this.boundPointerUp, true);
        document.removeEventListener('pointercancel', this.boundPointerCancel, true);
        this.element.removeEventListener('lostpointercapture', this.boundLostCapture);
    }

    /**
     * Update the current value (call when value changes externally)
     */
    updateValue(value: unknown): void {
        this.config.currentValue = value;
    }

    /**
     * Cleanup and remove drag handling
     */
    destroy(): void {
        this.element.classList.remove('draggable', 'dragging');

        // Remove indicator
        const indicator = this.element.querySelector('.drag-indicator');
        if (indicator) {
            indicator.remove();
        }

        // Remove document listeners if still attached (with capture flag)
        document.removeEventListener('pointermove', this.boundPointerMove, true);
        document.removeEventListener('pointerup', this.boundPointerUp, true);
        document.removeEventListener('pointercancel', this.boundPointerCancel, true);
        this.element.removeEventListener('lostpointercapture', this.boundLostCapture);
    }

    /**
     * Check if a widget type supports drag editing
     */
    static isTypeSupported(widgetType: string): boolean {
        const type = widgetType.toLowerCase();
        return [
            'number', 'int', 'float', 'slider', 'combo'
        ].includes(type);
    }
}
