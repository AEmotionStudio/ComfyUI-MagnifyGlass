/**
 * Widget editing: constraints, the commit path and the number/text editors.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WidgetSyncManager } from '../../src/info-panel/widget-editors/WidgetSyncManager';
import { WidgetEditorFactory } from '../../src/info-panel/widget-editors/WidgetEditorFactory';
import { DragValueController } from '../../src/info-panel/widget-editors/DragValueController';
import { getImportantNodeParameters } from '../../src/info-panel/NodeDataExtractor';

// Widget options as frontend 1.39.5 builds them: step is 10x the input step, step2 is the real one
const intWidget = (value = 20) => ({
    name: 'steps', type: 'number', value,
    options: { min: 1, max: 10000, step: 10, step2: 1, precision: 0 }
});
const floatWidget = (value = 1) => ({
    name: 'denoise', type: 'number', value,
    options: { min: 0, max: 1, step: 0.1, step2: 0.01, round: 0.01, precision: 2 }
});

let checkState: ReturnType<typeof vi.fn>;
let setDirtyCanvas: ReturnType<typeof vi.fn>;
let node: any;

function setup(widgets: any[]) {
    checkState = vi.fn();
    setDirtyCanvas = vi.fn();
    node = { id: 5, widgets, graph: { setDirtyCanvas } };
    const subgraph = { _nodes: [node], getNodeById: (id: number) => (id === 5 ? node : null) };
    (globalThis as any).app = {
        // app.graph is the root graph; an open subgraph only lives on the canvas
        graph: { _nodes: [], getNodeById: () => null },
        canvas: { graph: subgraph, graph_mouse: [0, 0] },
        extensionManager: { workflow: { activeWorkflow: { changeTracker: { checkState } } } }
    };
}

function key(el: HTMLElement, k: string, init: KeyboardEventInit = {}) {
    el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
}

describe('WidgetSyncManager', () => {
    it('uses step2 and keeps INT and FLOAT apart', () => {
        expect(WidgetSyncManager.extractConstraints(intWidget()).step).toBe(1);
        expect(WidgetSyncManager.extractConstraints(floatWidget()).step).toBe(0.01);
        expect(WidgetSyncManager.extractConstraints({ type: 'number', options: { step: 5 } }).step).toBe(0.5);
        expect(WidgetSyncManager.getWidgetType(intWidget())).toBe('INT');
        expect(WidgetSyncManager.getWidgetType(floatWidget())).toBe('FLOAT');
        expect(WidgetSyncManager.getWidgetType({ type: 'knob', options: { precision: 0 } })).toBe('INT');
    });

    it('scales the step with Shift and Alt, never below what the widget stores', () => {
        const c = WidgetSyncManager.extractConstraints(intWidget());
        expect(WidgetSyncManager.getStep(c, { shiftKey: true, altKey: false })).toBe(10);
        expect(WidgetSyncManager.getStep(c, { shiftKey: false, altKey: true })).toBe(1);
        const f = WidgetSyncManager.extractConstraints({ type: 'number', options: { step2: 0.1, precision: 3 } });
        expect(WidgetSyncManager.getStep(f, { shiftKey: false, altKey: true })).toBeCloseTo(0.01);
    });

    it('reads combo values given as a function', () => {
        const widget = { type: 'combo', value: 'a', options: { values: () => ['a', 'b'] } };
        expect(WidgetSyncManager.extractConstraints(widget).options).toEqual(['a', 'b']);
    });

    it('treats multiline text as editable and object or DOM widgets as read-only', () => {
        expect(WidgetSyncManager.getWidgetType({ type: 'customtext', element: {} })).toBe('multiline');
        expect(WidgetSyncManager.isWidgetEditable({ type: 'customtext', value: 'x', element: {} })).toBe(true);
        expect(WidgetSyncManager.isWidgetEditable({ type: 'text', value: { a: 1 } })).toBe(false);
        expect(WidgetSyncManager.isWidgetEditable({ type: 'preview', value: '', element: {} })).toBe(false);
    });

    it('commits through widget.setValue on the graph on screen and records an undo step', () => {
        const widget: any = { ...intWidget(), setValue: vi.fn(function (this: any, v: unknown) { this.value = v; }) };
        setup([widget]);

        const result = WidgetSyncManager.syncWidgetValue(5, 'steps', '30.4');

        expect(result).toMatchObject({ success: true, previousValue: 20, newValue: 30 });
        expect(widget.setValue).toHaveBeenCalledWith(30, { node, canvas: (globalThis as any).app.canvas });
        expect(setDirtyCanvas).toHaveBeenCalledWith(true, true);
        expect(checkState).toHaveBeenCalledTimes(1);
    });

    it('falls back to assigning and calling the callback, and can skip the undo step', () => {
        const callback = vi.fn();
        const widget: any = { ...floatWidget(), callback };
        setup([widget]);

        WidgetSyncManager.syncWidgetValue(5, 'denoise', 0.456, false);

        expect(widget.value).toBe(0.46);
        expect(callback).toHaveBeenCalledWith(0.46, expect.anything(), node, [0, 0]);
        expect(checkState).not.toHaveBeenCalled();
    });
});

describe('number editor', () => {
    let widget: any;
    let input: HTMLInputElement;
    let editor: ReturnType<typeof WidgetEditorFactory.createEditor>;

    beforeEach(() => {
        widget = intWidget(20);
        setup([widget]);
        editor = WidgetEditorFactory.createEditor({
            nodeId: 5, widgetName: 'steps', widgetType: 'INT', currentValue: '20',
            constraints: WidgetSyncManager.extractConstraints(widget)
        });
        document.body.appendChild(editor.element);
        input = editor.element.querySelector('input')!;
    });

    it('does not write while typing and commits on Enter', () => {
        input.value = '102';
        input.dispatchEvent(new Event('input'));
        expect(widget.value).toBe(20);

        input.focus();
        key(input, 'Enter');
        expect(widget.value).toBe(102);
        expect(checkState).toHaveBeenCalledTimes(1);
    });

    it('drops the typing on Escape and keeps the steps', () => {
        editor.element.querySelector<HTMLButtonElement>('.increment')!.click();
        expect(widget.value).toBe(21);

        input.value = '99';
        key(input, 'Escape');
        expect(widget.value).toBe(21);
        expect(input.value).toBe('21');
        expect(checkState).toHaveBeenCalledTimes(1);
    });

    it('keeps focus in the input on a stepper press and closes when focus leaves a stepper', () => {
        const onBlur = vi.fn();
        const other = WidgetEditorFactory.createEditor({
            nodeId: 5, widgetName: 'steps', widgetType: 'INT', currentValue: '20',
            constraints: WidgetSyncManager.extractConstraints(widget), onBlur
        });
        document.body.appendChild(other.element);
        const stepper = other.element.querySelector<HTMLButtonElement>('.increment')!;

        const press = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
        stepper.dispatchEvent(press);
        expect(press.defaultPrevented).toBe(true);

        stepper.focus();
        stepper.blur();
        expect(onBlur).toHaveBeenCalledTimes(1);
        other.destroy();
    });

    it('shows a float at its precision', () => {
        const denoise = floatWidget(1);
        setup([denoise]);
        const floatEditor = WidgetEditorFactory.createEditor({
            nodeId: 5, widgetName: 'denoise', widgetType: 'FLOAT', currentValue: '1',
            constraints: WidgetSyncManager.extractConstraints(denoise)
        });
        const floatInput = floatEditor.element.querySelector('input')!;
        expect(floatInput.value).toBe('1.00');

        floatEditor.element.querySelector<HTMLButtonElement>('.decrement')!.click();
        expect(denoise.value).toBe(0.99);
        expect(floatInput.value).toBe('0.99');
    });

    it('steps by step2 with the buttons and arrow keys', () => {
        editor.element.querySelector<HTMLButtonElement>('.decrement')!.click();
        expect(widget.value).toBe(19);
        key(input, 'ArrowUp', { shiftKey: true });
        expect(widget.value).toBe(29);
    });
});

describe('text editor', () => {
    it('commits a single line on Enter and reverts on Escape', () => {
        const widget: any = { name: 'filename_prefix', type: 'text', value: 'ComfyUI' };
        setup([widget]);
        const editor = WidgetEditorFactory.createEditor({ nodeId: 5, widgetName: 'filename_prefix', widgetType: 'text', currentValue: 'ComfyUI' });
        document.body.appendChild(editor.element);
        const input = editor.element.querySelector('input')!;
        input.focus();

        input.value = 'fennec';
        input.dispatchEvent(new Event('input'));
        expect(widget.value).toBe('ComfyUI');
        key(input, 'Enter');
        expect(widget.value).toBe('fennec');

        input.focus();
        input.value = 'oops';
        key(input, 'Escape');
        expect(widget.value).toBe('ComfyUI');
    });

    it('uses a textarea for multiline, commits on Ctrl+Enter and flushes on destroy', () => {
        const widget: any = { name: 'text', type: 'customtext', value: 'a fox' };
        setup([widget]);
        const editor = WidgetEditorFactory.createEditor({ nodeId: 5, widgetName: 'text', widgetType: 'multiline', currentValue: 'a fox' });
        document.body.appendChild(editor.element);
        const textarea = editor.element.querySelector('textarea')!;
        textarea.focus();

        textarea.value = 'a fox\nwith big ears';
        key(textarea, 'Enter');
        expect(widget.value).toBe('a fox');
        key(textarea, 'Enter', { ctrlKey: true });
        expect(widget.value).toBe('a fox\nwith big ears');

        textarea.focus();
        textarea.value = 'a fluffy tail';
        editor.destroy();
        expect(widget.value).toBe('a fluffy tail');
    });
});

describe('drag', () => {
    it('moves an INT by step2 per 10px and records one undo step on release', () => {
        const widget = intWidget(20);
        setup([widget]);
        const row = document.createElement('div');
        document.body.appendChild(row);
        row.setPointerCapture = vi.fn();
        row.releasePointerCapture = vi.fn();
        new DragValueController(row, {
            nodeId: 5, widgetName: 'steps',
            constraints: WidgetSyncManager.extractConstraints(widget)
        });

        row.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 100, bubbles: true }));
        document.dispatchEvent(new PointerEvent('pointermove', { clientX: 135 }));
        expect(widget.value).toBe(23);
        expect(checkState).not.toHaveBeenCalled();

        document.dispatchEvent(new PointerEvent('pointerup', { clientX: 135 }));
        expect(checkState).toHaveBeenCalledTimes(1);

        // A later drag starts from the widget, whatever changed it in between
        widget.value = 30;
        row.dispatchEvent(new PointerEvent('pointerdown', { button: 0, clientX: 100, bubbles: true }));
        document.dispatchEvent(new PointerEvent('pointermove', { clientX: 110 }));
        expect(widget.value).toBe(31);
        document.dispatchEvent(new PointerEvent('pointerup', { clientX: 110 }));
    });
});

describe('getImportantNodeParameters', () => {
    it('shows a real widget named type and marks linked widgets read-only', () => {
        const items = getImportantNodeParameters({
            id: 5, type: 'CLIPLoader',
            widgets: [
                { name: 'clip_name', type: 'combo', value: 'clip.safetensors', options: { values: ['clip.safetensors'] } },
                { name: 'type', type: 'combo', value: 'stable_diffusion', options: { values: ['stable_diffusion'] } },
                { name: 'mode', type: 'text', value: 'not a real widget' },
                { ...intWidget(1), name: 'seed' }
            ],
            inputs: [
                { name: 'clip_name', widget: { name: 'clip_name' } },
                { name: 'type', widget: { name: 'type' } },
                { name: 'seed', widget: { name: 'seed' }, link: 7 }
            ]
        } as any);

        expect(items.map(i => i.label)).toEqual(['clip_name', 'type', 'seed']);
        const seed = items[2];
        expect(seed.isLinked).toBe(true);
        expect(seed.isEditable).toBe(false);
    });
});
