import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

// The viewer is hand-maintained HTML; run its script against its own markup
const html = readFileSync(path.resolve(__dirname, '../../web/popout-viewer.html'), 'utf8');
const bodyHtml = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));

describe('Pop-out viewer editing', () => {
    let channel: { onmessage: ((e: { data: unknown }) => void) | null; postMessage: ReturnType<typeof vi.fn> };
    const edits = () => channel.postMessage.mock.calls.map(([m]) => m).filter((m: any) => m.type === 'widget-edit').map((m: any) => m.data);
    const sidebar = () => document.getElementById('sidebar-content')!;
    const valueOf = (name: string) => [...sidebar().querySelectorAll('[data-kind="value"]')]
        .find(el => (window as any).__widgets[Number((el as HTMLElement).dataset.widget)].name === name) as HTMLElement;
    const sendInfo = (widgets: any[]) => {
        (window as any).__widgets = widgets;
        channel.onmessage!({ data: { type: 'info', data: { hoveredNode: { id: 5, title: 'Node', type: 'Node', widgets, inputs: [], outputs: [] } } } });
    };
    const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
        el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));

    beforeEach(() => {
        vi.useFakeTimers();
        vi.stubGlobal('localStorage', new Storage());
        vi.stubGlobal('BroadcastChannel', class {
            onmessage = null;
            postMessage = vi.fn();
            close() { }
            constructor() { channel = this as any; }
        });
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
        vi.spyOn(window, 'close').mockImplementation(() => { });
        document.body.innerHTML = bodyHtml;
        new Function(script)();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('edits names with quotes, and text keeps its newlines in a textarea', () => {
        sendInfo([{ name: `it's "quoted"`, type: 'customtext', value: 'line one\nline two' }]);

        valueOf(`it's "quoted"`).click();
        const textarea = sidebar().querySelector('textarea')!;
        expect(textarea.value).toBe('line one\nline two');

        key(textarea, 'Enter'); // a newline, not a commit
        expect(edits()).toEqual([]);
        textarea.value = 'line one\nline three';
        key(textarea, 'Enter', { ctrlKey: true });
        expect(edits()).toEqual([{ nodeId: 5, widgetName: `it's "quoted"`, value: 'line one\nline three' }]);
    });

    it('number inputs carry min, max and the real step, and Escape cancels without closing', () => {
        sendInfo([{ name: 'denoise', type: 'number', value: 0.5, options: { min: 0, max: 1, step: 0.1, step2: 0.01 } }]);

        valueOf('denoise').click();
        const input = sidebar().querySelector('input[type="number"]') as HTMLInputElement;
        expect([input.min, input.max, input.step]).toEqual(['0', '1', '0.01']);

        input.value = '0.7';
        key(input, 'Escape');
        expect(edits()).toEqual([]);
        expect(window.close).not.toHaveBeenCalled();
        expect(sidebar().querySelector('input[type="number"]')).toBeNull();

        valueOf('denoise').click();
        const again = sidebar().querySelector('input[type="number"]') as HTMLInputElement;
        again.value = '0.7';
        key(again, 'Enter');
        expect(edits()).toEqual([{ nodeId: 5, widgetName: 'denoise', value: 0.7 }]);
    });

    it('a combo blurred without a pick cancels, and a pick keeps the option type', () => {
        sendInfo([{ name: 'size', type: 'combo', value: 512, options: [512, 768] }]);

        valueOf('size').click();
        let select = sidebar().querySelector('select')!;
        select.dispatchEvent(new Event('blur'));
        expect(edits()).toEqual([]);
        expect(sidebar().querySelector('select')).toBeNull();

        valueOf('size').click();
        select = sidebar().querySelector('select')!;
        select.selectedIndex = 2;
        select.dispatchEvent(new Event('change'));
        expect(edits()).toEqual([{ nodeId: 5, widgetName: 'size', value: 768 }]);
    });

    it('keeps an open editor while info arrives, and object values are not editable', () => {
        const widgets = [{ name: 'seed', type: 'number', value: 1 }, { name: 'data', type: 'custom', value: { a: 1 } }];
        sendInfo(widgets);
        expect(valueOf('data')).toBeUndefined();

        valueOf('seed').click();
        const input = sidebar().querySelector('input[type="number"]');
        sendInfo(widgets);
        expect(sidebar().querySelector('input[type="number"]')).toBe(input);
    });

    it('toggle and action buttons send their widget name', () => {
        sendInfo([{ name: `o'clock`, type: 'button', value: false }, { name: `run "now"`, type: 'button' }]);

        (sidebar().querySelector('[data-kind="toggle"]') as HTMLElement).click();
        expect(edits()).toEqual([{ nodeId: 5, widgetName: `o'clock`, value: true }]);

        (sidebar().querySelector('[data-kind="action"]') as HTMLElement).click();
        const clicks = channel.postMessage.mock.calls.map(([m]) => m).filter((m: any) => m.type === 'button-click');
        expect(clicks.map((m: any) => m.data)).toEqual([{ nodeId: 5, widgetName: `run "now"` }]);
    });

    it('a data:image value renders only the image, never its markup', () => {
        const png = 'data:image/png;base64,iVBORw0KGgo=';
        sendInfo([
            { name: 'evil', type: 'text', value: `<img src=x onerror="window.__pwned=1"> data:image/png;base64,AAAA` },
            { name: 'plot', type: 'text', value: `<img src="${png}" style="width:100%">` },
        ]);

        expect(sidebar().querySelector('[onerror]')).toBeNull();
        expect(sidebar().querySelector('img[src="x"]')).toBeNull();
        expect([...sidebar().querySelectorAll('img')].map(img => img.getAttribute('src'))).toEqual(['data:image/png;base64,AAAA', png]);
        expect((window as any).__pwned).toBeUndefined();
    });

    it('node ids stay text, and node actions post through delegated listeners', () => {
        const id = `1); window.__pwned = (1`;
        channel.onmessage!({ data: { type: 'info', data: { hoveredNode: { id, title: 'Node', type: 'Node', widgets: [], inputs: [], outputs: [] } } } });

        expect(sidebar().querySelector('[onclick]')).toBeNull();
        expect(sidebar().textContent).toContain(`(#${id})`);
        (sidebar().querySelector('[data-action="zoom-node"]') as HTMLElement).click();
        (sidebar().querySelector('[data-action="node-dropdown"]') as HTMLElement).click();
        const posted = channel.postMessage.mock.calls.map(([m]) => m).filter((m: any) => m.type !== 'pong');
        expect(posted).toEqual([{ type: 'zoom-node', data: id }, { type: 'request-nodes', data: 'title' }]);
        expect((window as any).__pwned).toBeUndefined();
    });
});
