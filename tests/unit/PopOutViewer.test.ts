import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

// The viewer is hand-maintained HTML; run its script against its own markup
const html = readFileSync(path.resolve(__dirname, '../../web/popout-viewer.html'), 'utf8');
const bodyHtml = html.slice(html.indexOf('<body>') + 6, html.indexOf('<script>'));
const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));

describe('Pop-out viewer editing', () => {
    let channel: { name: string; onmessage: ((e: { data: unknown }) => void) | null; postMessage: ReturnType<typeof vi.fn> };
    let rows: any[];
    const posted = (type: string) => channel.postMessage.mock.calls.map(([m]) => m).filter((m: any) => m.type === type).map((m: any) => m.data);
    const edits = () => posted('widget-edit');
    const sidebar = () => document.getElementById('sidebar-content')!;
    const valueOf = (name: string) => [...sidebar().querySelectorAll('[data-kind="value"]')]
        .find(el => rows[Number((el as HTMLElement).dataset.widget)].widgetName === name) as HTMLElement;
    // A row as the Inspector builds it
    const row = (widgetName: string, widgetType: string, rawValue: unknown, extra: object = {}) => ({
        label: widgetName, widgetName, widgetType, value: String(rawValue), rawValue,
        isEditable: true, isLinked: false, isActionable: false, constraints: {}, ...extra
    });
    const node = (id: unknown = 5) => ({ id, title: 'Node', type: 'Node', mode: 'Always', graphPath: [], isSubgraph: false });
    const sendInfo = (list: any[], canEdit = true) => {
        rows = list;
        channel.onmessage!({ data: { type: 'info', data: { node: node(), nav: { source: 'locked', locked: true, canBack: false, canForward: false, canEdit }, rows } } });
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
            constructor(public name: string) { channel = this as any; }
        });
        history.replaceState(null, '', '/popout-viewer.html?v=1&session=abc123');
        vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ clearRect: vi.fn(), drawImage: vi.fn() } as any);
        vi.spyOn(window, 'close').mockImplementation(() => { });
        document.body.innerHTML = bodyHtml;
        new Function(script)();
    });

    afterEach(() => {
        history.replaceState(null, '', '/');
        document.body.innerHTML = '';
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('edits names with quotes, and text keeps its newlines in a textarea', () => {
        sendInfo([row(`it's "quoted"`, 'multiline', 'line one\nline two')]);

        valueOf(`it's "quoted"`).click();
        const textarea = sidebar().querySelector('textarea')!;
        expect(textarea.value).toBe('line one\nline two');

        key(textarea, 'Enter'); // a newline, not a commit
        expect(edits()).toEqual([]);
        textarea.value = 'line one\nline three';
        key(textarea, 'Enter', { ctrlKey: true });
        expect(edits()).toEqual([{ nodeId: 5, widgetName: `it's "quoted"`, value: 'line one\nline three' }]);
    });

    it('number inputs take min, max and step from the Inspector, and Escape cancels without closing', () => {
        sendInfo([row('denoise', 'FLOAT', 0.5, { constraints: { min: 0, max: 1, step: 0.01 } }), row('seed', 'INT', 3), row('cfg', 'FLOAT', 8)]);

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

        // INT steps by whole numbers without a step of its own; FLOAT takes any value
        valueOf('seed').click();
        expect((sidebar().querySelector('input[type="number"]') as HTMLInputElement).step).toBe('1');
        key(sidebar().querySelector('input[type="number"]')!, 'Escape');
        valueOf('cfg').click();
        expect((sidebar().querySelector('input[type="number"]') as HTMLInputElement).step).toBe('any');
    });

    it('a combo asks for its options, drops a reply for another widget, and a pick keeps the option type', () => {
        sendInfo([row('size', 'combo', 512)]);

        valueOf('size').click();
        expect(posted('request-options')).toEqual([{ nodeId: 5, widgetName: 'size' }]);
        let select = sidebar().querySelector('select')!;
        // An info push leaves the waiting editor open
        sendInfo(rows);
        expect(sidebar().querySelector('select')).toBe(select);
        channel.onmessage!({ data: { type: 'options', data: { nodeId: 5, widgetName: 'other', options: ['a'] } } });
        expect(select.options).toHaveLength(1);

        channel.onmessage!({ data: { type: 'options', data: { nodeId: 5, widgetName: 'size', options: [512, 768] } } });
        expect([...select.options].map(o => o.textContent)).toEqual(['Select...', '512', '768']);
        select.dispatchEvent(new Event('blur'));
        expect(edits()).toEqual([]);
        expect(sidebar().querySelector('select')).toBeNull();

        valueOf('size').click();
        select = sidebar().querySelector('select')!;
        channel.onmessage!({ data: { type: 'options', data: { nodeId: 5, widgetName: 'size', options: [512, 768] } } });
        select.selectedIndex = 2;
        select.dispatchEvent(new Event('change'));
        expect(edits()).toEqual([{ nodeId: 5, widgetName: 'size', value: 768 }]);
    });

    it('keeps an open editor while info arrives, and values without a primitive raw value are not editable', () => {
        sendInfo([row('seed', 'INT', 1), row('data', 'text', undefined, { value: '{"a": 1}' })]);
        expect(valueOf('data')).toBeUndefined();

        valueOf('seed').click();
        const input = sidebar().querySelector('input[type="number"]');
        sendInfo(rows);
        expect(sidebar().querySelector('input[type="number"]')).toBe(input);
    });

    it('edits only rows the Inspector allows, and shows an empty string as an editable empty value', () => {
        sendInfo([row('model', 'combo', 'a', { isLinked: true, isEditable: false }), row('prompt', 'text', '')]);
        expect(valueOf('model')).toBeUndefined();
        expect(sidebar().textContent).toContain('linked');
        const empty = valueOf('prompt');
        expect(empty.querySelector('.value-empty')!.textContent).toBe('empty');
        empty.click();
        expect((sidebar().querySelector('input[type="text"]') as HTMLInputElement).value).toBe('');
        key(sidebar().querySelector('input[type="text"]')!, 'Escape');

        // Without a lock, Sticky or the selection nothing is editable
        sendInfo(rows, false);
        expect(sidebar().querySelector('[data-kind="value"]')).toBeNull();
        expect(sidebar().querySelector('.value-empty')).not.toBeNull();
    });

    it('buttons send their widget name, booleans flip, and a button with a boolean value is still a button', () => {
        sendInfo([
            row(`o'clock`, 'button', false, { isActionable: true, isEditable: false }),
            row(`run "now"`, 'button', null, { isActionable: true, isEditable: false }),
            row('enabled', 'boolean', false)
        ]);

        expect(sidebar().querySelector('[data-kind="toggle"]')).toBeNull();
        for (const button of sidebar().querySelectorAll<HTMLElement>('[data-kind="action"]')) button.click();
        expect(posted('button-click')).toEqual([{ nodeId: 5, widgetName: `o'clock` }, { nodeId: 5, widgetName: `run "now"` }]);

        valueOf('enabled').click();
        expect(edits()).toEqual([{ nodeId: 5, widgetName: 'enabled', value: true }]);
    });

    it('a data:image value renders only the image, never its markup', () => {
        const png = 'data:image/png;base64,iVBORw0KGgo=';
        sendInfo([
            row('evil', 'text', `<img src=x onerror="window.__pwned=1"> data:image/png;base64,AAAA`),
            row('plot', 'text', `<img src="${png}" style="width:100%">`),
        ]);

        expect(sidebar().querySelector('[onerror]')).toBeNull();
        expect(sidebar().querySelector('img[src="x"]')).toBeNull();
        expect([...sidebar().querySelectorAll('img')].map(img => img.getAttribute('src'))).toEqual(['data:image/png;base64,AAAA', png]);
        expect((window as any).__pwned).toBeUndefined();
    });

    it('node ids stay text, and node actions post through delegated listeners', () => {
        const id = `1); window.__pwned = (1`;
        channel.onmessage!({ data: { type: 'info', data: { node: node(id), nav: { canEdit: false }, rows: [] } } });

        expect(sidebar().querySelector('[onclick]')).toBeNull();
        expect(sidebar().textContent).toContain(`(#${id})`);
        (sidebar().querySelector('[data-action="focus-node"]') as HTMLElement).click();
        (sidebar().querySelector('[data-action="node-dropdown"]') as HTMLElement).click();
        const sent = channel.postMessage.mock.calls.map(([m]) => m).filter((m: any) => m.type !== 'pong');
        expect(sent).toEqual([{ type: 'panel-action', data: { name: 'focus-node', nodeId: id } }, { type: 'request-nodes', data: 'title' }]);
        expect((window as any).__pwned).toBeUndefined();
    });

    it('shows the empty state for no node, with no Cursor section', () => {
        channel.onmessage!({ data: { type: 'info', data: { node: null, nav: { canEdit: false }, rows: [] } } });
        expect(sidebar().querySelector('.empty-state')).not.toBeNull();
        expect(sidebar().textContent).not.toContain('Cursor');
    });

    it('listens on the channel of the session in its URL, and announces itself until pinged', () => {
        const pongs = () => channel.postMessage.mock.calls.filter(([m]) => m.type === 'pong').length;
        expect(channel.name).toBe('comfyui-magnifyglass-popout:abc123');
        expect(pongs()).toBe(1);
        vi.advanceTimersByTime(2000);
        expect(pongs()).toBe(3);

        channel.onmessage!({ data: { type: 'ping' } });
        expect(pongs()).toBe(4);
        vi.advanceTimersByTime(2000);
        expect(pongs()).toBe(4);
    });

    it('status follows pings and config, and never wipes the sidebar or an open editor', () => {
        const label = () => document.querySelector('.status-label')!.textContent;
        const ping = () => channel.onmessage!({ data: { type: 'ping' } });
        const config = (glass: string) => channel.onmessage!({ data: { type: 'config', data: { theme: 'dark', glass, inspector: true } } });
        ping();
        config('off');
        sendInfo([row('seed', 'INT', 1)]);
        valueOf('seed').click();
        const input = sidebar().querySelector('input[type="number"]');
        expect(label()).toBe('Glass off');
        expect(document.getElementById('viewer-canvas')!.classList.contains('dimmed')).toBe(true);

        // No frames for a while is not a disconnect
        for (let i = 0; i < 5; i++) {
            vi.advanceTimersByTime(1000);
            ping();
        }
        expect(label()).toBe('Glass off');
        config('hidden');
        expect(label()).toBe('Glass hidden');

        vi.advanceTimersByTime(4000);
        expect(label()).toBe('ComfyUI tab inactive');
        channel.onmessage!({ data: { type: 'close' } });
        expect(label()).toBe('Disconnected from ComfyUI');
        expect(window.close).not.toHaveBeenCalled();
        expect(sidebar().querySelector('input[type="number"]')).toBe(input);
    });

    it('says when the Inspector is off in ComfyUI', () => {
        sendInfo([row('seed', 'INT', 1)]);
        channel.onmessage!({ data: { type: 'config', data: { theme: 'dark', glass: 'on', inspector: false } } });
        expect(sidebar().textContent).toContain('The Inspector is off in ComfyUI');
        channel.onmessage!({ data: { type: 'config', data: { theme: 'dark', glass: 'on', inspector: true } } });
        expect(valueOf('seed')).toBeDefined();
    });

    it('draws a Blob frame at its own size and closes its bitmap', async () => {
        const bitmap = { width: 400, height: 400, close: vi.fn() };
        const decode = vi.fn().mockResolvedValue(bitmap);
        vi.stubGlobal('createImageBitmap', decode);
        const canvas = document.getElementById('viewer-canvas') as HTMLCanvasElement;
        const ctx = canvas.getContext('2d') as any;
        const blob = new Blob(['png'], { type: 'image/png' });

        channel.onmessage!({ data: { type: 'frame', data: blob } });
        await vi.waitFor(() => expect(bitmap.close).toHaveBeenCalled());

        expect(decode).toHaveBeenCalledWith(blob);
        expect([canvas.width, canvas.height]).toEqual([400, 400]);
        expect(ctx.drawImage).toHaveBeenCalledWith(bitmap, 0, 0);
        expect(document.querySelector('.canvas-placeholder')!.classList.contains('hidden')).toBe(true);
    });

    it('never draws an older frame over a newer one', async () => {
        const older = { width: 400, height: 400, close: vi.fn() };
        const newer = { width: 400, height: 400, close: vi.fn() };
        let resolveOlder!: (bitmap: typeof older) => void;
        vi.stubGlobal('createImageBitmap', vi.fn()
            .mockReturnValueOnce(new Promise(resolve => { resolveOlder = resolve; }))
            .mockResolvedValueOnce(newer));
        const ctx = (document.getElementById('viewer-canvas') as HTMLCanvasElement).getContext('2d') as any;

        channel.onmessage!({ data: { type: 'frame', data: new Blob(['a']) } });
        channel.onmessage!({ data: { type: 'frame', data: new Blob(['b']) } });
        await vi.waitFor(() => expect(newer.close).toHaveBeenCalled());
        resolveOlder(older);
        await vi.waitFor(() => expect(older.close).toHaveBeenCalled());

        expect(ctx.drawImage).toHaveBeenCalledTimes(1);
        expect(ctx.drawImage).toHaveBeenCalledWith(newer, 0, 0);
    });

    it('Escape closes the node list, never the window', () => {
        sendInfo([]);
        (sidebar().querySelector('[data-action="node-dropdown"]') as HTMLElement).click();
        channel.onmessage!({ data: { type: 'nodes-list', data: { nodes: [{ id: 5, title: 'Node', type: 'Node' }], sortBy: 'title' } } });
        expect(document.getElementById('node-dropdown')).not.toBeNull();

        key(document.body, 'Escape');
        expect(document.getElementById('node-dropdown')).toBeNull();
        key(document.body, 'Escape');
        expect(window.close).not.toHaveBeenCalled();
        expect(channel.postMessage.mock.calls.map(([m]) => m.type)).not.toContain('close');
    });
});
