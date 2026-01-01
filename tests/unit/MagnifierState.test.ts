/**
 * MagnifierState Unit Tests
 * 
 * Tests for the MagnifierState class which manages magnifier state.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MagnifierState } from '../../src/magnify-glass/MagnifierState';

describe('MagnifierState', () => {
    let state: MagnifierState;

    beforeEach(() => {
        state = new MagnifierState();
    });

    describe('constructor', () => {
        it('should initialize as inactive', () => {
            expect(state.active).toBe(false);
        });

        it('should initialize cursor at origin', () => {
            expect(state.x).toBe(0);
            expect(state.y).toBe(0);
        });

        it('should initialize source dimensions to zero', () => {
            expect(state.sourceX).toBe(0);
            expect(state.sourceY).toBe(0);
            expect(state.sourceWidth).toBe(0);
            expect(state.sourceHeight).toBe(0);
        });

        it('should initialize canvas scale to 1', () => {
            expect(state.canvasScale).toBe(1.0);
        });

        it('should initialize canvas offsets to zero', () => {
            expect(state.canvasOffsetX).toBe(0);
            expect(state.canvasOffsetY).toBe(0);
        });

        it('should not be scheduled for render initially', () => {
            expect(state.isRenderScheduled).toBe(false);
        });
    });

    describe('reset', () => {
        it('should reset all state values to defaults', () => {
            // Modify state
            state.active = true;
            state.x = 100;
            state.y = 200;
            state.sourceX = 50;
            state.sourceY = 75;
            state.canvasScale = 2.5;

            // Reset
            state.reset();

            // Verify defaults
            expect(state.active).toBe(false);
            expect(state.x).toBe(0);
            expect(state.y).toBe(0);
            expect(state.sourceX).toBe(0);
            expect(state.sourceY).toBe(0);
            expect(state.canvasScale).toBe(1.0);
        });

        it('should reset wasActivatedBefore flag', () => {
            state.wasActivatedBefore = true;

            state.reset();

            expect(state.wasActivatedBefore).toBe(false);
        });
    });

    describe('state mutations', () => {
        it('should allow setting active state', () => {
            state.active = true;
            expect(state.active).toBe(true);
        });

        it('should allow setting cursor position', () => {
            state.x = 150;
            state.y = 250;

            expect(state.x).toBe(150);
            expect(state.y).toBe(250);
        });

        it('should allow setting canvas transform values', () => {
            state.canvasScale = 3.0;
            state.canvasOffsetX = -100;
            state.canvasOffsetY = -200;

            expect(state.canvasScale).toBe(3.0);
            expect(state.canvasOffsetX).toBe(-100);
            expect(state.canvasOffsetY).toBe(-200);
        });
    });
});
