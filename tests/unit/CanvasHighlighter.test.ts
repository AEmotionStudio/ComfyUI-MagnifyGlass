import { describe, it, expect, afterEach, vi } from 'vitest';
import { CanvasHighlighter } from '../../src/info-panel/CanvasHighlighter';

describe('CanvasHighlighter', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    it('survives the frontend wrapping its hook again, as on a Nodes 2.0 toggle', () => {
        const frontendDraw = vi.fn();
        const canvas: any = { onDrawForeground: frontendDraw, setDirty: vi.fn(), graph: null };
        vi.stubGlobal('app', { canvas });
        const highlighter = new CanvasHighlighter({ '🔍MagnifyGlass.NodeHighlightEnabled': true });
        highlighter.setHighlightedNode(1);

        // The frontend's DOM widgets mount again and chain onto the hook they find, which is ours
        const updateWidgets = vi.fn();
        const ours = canvas.onDrawForeground;
        canvas.onDrawForeground = function (ctx: unknown, area: unknown) { ours.call(this, ctx, area); updateWidgets(); };
        highlighter.setHighlightedNode(2);

        // Every hook in the chain runs once
        canvas.onDrawForeground({}, []);
        expect(updateWidgets).toHaveBeenCalledTimes(1);
        expect(frontendDraw).toHaveBeenCalledTimes(1);

        // Removed, it leaves the frontend's wrapper on top, still reaching the hook below
        highlighter.cleanup();
        canvas.onDrawForeground({}, []);
        expect(updateWidgets).toHaveBeenCalledTimes(2);
        expect(frontendDraw).toHaveBeenCalledTimes(2);
    });
});
