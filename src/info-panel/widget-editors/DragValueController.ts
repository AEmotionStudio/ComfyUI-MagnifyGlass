/**
 * ComfyUI MagnifyGlass - Drag Value Controller
 * 
 * Handles horizontal drag gestures on inspector rows for quick value changes.
 * Allows users to drag left/right to adjust numbers.
 */

import { WidgetSyncManager, WidgetConstraints } from './WidgetSyncManager';
import { Logger } from '../../shared/logger';

/**
 * Configuration for drag behavior
 */
export interface DragConfig {
    nodeId: number;
    widgetName: string;
    constraints?: WidgetConstraints;
    onChange?: (value: unknown) => void;
}

// Pixels to drag for one step change
const PIXELS_PER_STEP = 10;

/**
 * Drag Value Controller
 * Manages drag interactions for inline value editing
 */
export class DragValueController {
    private element: HTMLElement;
    private config: DragConfig;
    isDragging: boolean = false;
    private value: unknown = null;
    private startX: number = 0;
    private startValue: number = 0;
    private startStep: number = 0;

    // Bound event handlers for cleanup
    private boundPointerDown: (e: PointerEvent) => void;
    private boundPointerMove: (e: PointerEvent) => void;
    private boundPointerUp: (e: PointerEvent) => void;
    private boundPointerCancel: (e: PointerEvent) => void;
    private boundLostCapture: (e: PointerEvent) => void;

    constructor(element: HTMLElement, config: DragConfig) {
        this.element = element;
        this.config = config;

        this.boundPointerDown = this.onPointerDown.bind(this);
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

        this.element.addEventListener('pointerdown', this.boundPointerDown);
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
        // From the widget, which the editor, an undo or the canvas may have changed since the row was drawn
        this.value = WidgetSyncManager.getWidgetValue(this.config.nodeId, this.config.widgetName);
        this.startValue = Number(this.value) || 0;
        this.startStep = WidgetSyncManager.getStep(this.config.constraints, e);

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

        // Holding or releasing Shift/Alt mid-drag continues from the current value at the new step
        const step = WidgetSyncManager.getStep(this.config.constraints, e);
        if (step !== this.startStep) {
            this.startX = e.clientX;
            this.startValue = Number(this.value) || 0;
            this.startStep = step;
        }
        this.handleNumberDrag(e.clientX - this.startX);
    }

    /**
     * Handle number value drag
     * Uses discrete stepping: every N pixels = exactly 1 step change
     */
    private handleNumberDrag(deltaX: number): void {
        // Calculate discrete number of steps (truncate, don't round)
        const steps = Math.trunc(deltaX / PIXELS_PER_STEP);
        const target = this.startValue + steps * this.startStep;
        if (target === this.value) return;

        // Clamping, rounding and precision happen in the sync; undo is recorded once on release
        const result = WidgetSyncManager.syncWidgetValue(this.config.nodeId, this.config.widgetName, target, false);
        if (!result.success) return;
        this.value = result.newValue;
        this.config.onChange?.(result.newValue);
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
        WidgetSyncManager.recordUndo();

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
     * Cleanup and remove drag handling
     */
    destroy(): void {
        this.element.classList.remove('draggable', 'dragging');

        // Remove the pointerdown listener from the element
        this.element.removeEventListener('pointerdown', this.boundPointerDown);

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
        return ['int', 'float', 'slider'].includes(type);
    }
}
