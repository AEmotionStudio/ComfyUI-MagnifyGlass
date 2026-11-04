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
    const node = (id: unknown = 5) => ({ id, title: 'Node', type: 'Node', mode: 'Always', executionId: String(id), graphPath: [], isSubgraph: false });
    const nav = (canEdit = true) => ({ source: 'locked', locked: canEdit, canBack: false, canForward: false, canEdit });
    const links = { inputs: [], outputs: [] };
    const sendInfo = (list: any[], canEdit = true) => {
        rows = list;
        channel.onmessage!({ data: { type: 'info', data: { node: node(), nav: nav(canEdit), rows, links } } });
    };
    const receive = (type: string, data?: unknown) => channel.onmessage!({ data: { type, data } });
    const navButton = (action: string) => document.querySelector(`.node-nav [data-action="${action}"]`) as HTMLButtonElement;
    const palette = { scheme: 'dark', fontFamily: 'Inter, Arial, sans-serif', fontSize: '16px', properties: { '--fg-color': '#dddddd' } };
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
        document.documentElement.removeAttribute('style');
        document.documentElement.className = '';
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

    it('numbers step with the arrows and steppers, Shift x10 and Alt x0.1, at their precision; INT stays whole', () => {
        sendInfo([
            row('cfg', 'FLOAT', 8, { constraints: { min: 0, max: 30, step: 0.5, precision: 2 } }),
            row('steps', 'INT', 20, { constraints: { min: 1, max: 100, step: 1, precision: 0 } })
        ]);
        const input = () => sidebar().querySelector('input[type="number"]') as HTMLInputElement;

        valueOf('cfg').click();
        expect(input().value).toBe('8.00');
        key(input(), 'ArrowUp');
        key(input(), 'ArrowUp', { shiftKey: true });
        key(input(), 'ArrowDown', { altKey: true });
        (sidebar().querySelector('.widget-editor-stepper[aria-label="Decrease"]') as HTMLElement).click();
        expect(input().value).toBe('12.95');
        // Each step is sent at once, as in the Inspector
        expect(edits().map(e => e.value)).toEqual([8.5, 13.5, 13.45, 12.95]);
        // Leaving without another change sends nothing more
        input().dispatchEvent(new Event('blur'));
        expect(edits()).toHaveLength(4);

        valueOf('steps').click();
        key(input(), 'ArrowDown', { altKey: true });
        expect(input().value).toBe('19');
        input().value = '100.4';
        key(input(), 'ArrowUp', { shiftKey: true });
        expect(input().value).toBe('100');
        input().value = '42.6';
        key(input(), 'Enter');
        expect(edits().slice(4).map(e => e.value)).toEqual([19, 100, 43]);
    });

    it('a value is sent only when it changed', () => {
        sendInfo([row('denoise', 'FLOAT', 0.5), row('prompt', 'text', 'cat')]);

        valueOf('denoise').click();
        key(sidebar().querySelector('input')!, 'Enter');
        valueOf('prompt').click();
        sidebar().querySelector('input')!.dispatchEvent(new Event('blur'));
        expect(edits()).toEqual([]);
        // Unchanged, the rows are back as they were
        expect(valueOf('prompt').textContent).toBe('cat');

        valueOf('prompt').click();
        (sidebar().querySelector('input') as HTMLInputElement).value = 'dog';
        key(sidebar().querySelector('input')!, 'Enter');
        expect(edits()).toEqual([{ nodeId: 5, widgetName: 'prompt', value: 'dog' }]);
        // Shown until ComfyUI answers, and its answer renders even when it kept the old value
        expect(valueOf('prompt').textContent).toBe('dog');
        sendInfo(rows);
        expect(valueOf('prompt').textContent).toBe('cat');
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
        expect([...select.options].map(o => o.textContent)).toEqual(['512', '768']);
        // It opens on the current value, and leaving it unchanged sends nothing
        expect(select.selectedIndex).toBe(0);
        select.dispatchEvent(new Event('blur'));
        expect(edits()).toEqual([]);
        expect(sidebar().querySelector('select')).toBeNull();

        valueOf('size').click();
        select = sidebar().querySelector('select')!;
        channel.onmessage!({ data: { type: 'options', data: { nodeId: 5, widgetName: 'size', options: [512, 768] } } });
        select.selectedIndex = 1;
        select.dispatchEvent(new Event('change'));
        expect(edits()).toEqual([{ nodeId: 5, widgetName: 'size', value: 768 }]);
    });

    it('a combo whose list can no longer open itself still fills', () => {
        // The click's user activation ran out while the options were on their way
        HTMLSelectElement.prototype.showPicker = () => { throw new DOMException('No user activation', 'NotAllowedError'); };
        sendInfo([row('size', 'combo', 512)]);
        valueOf('size').click();
        receive('options', { nodeId: 5, widgetName: 'size', options: [512, 768] });
        delete (HTMLSelectElement.prototype as any).showPicker;
        const select = sidebar().querySelector('select')!;
        expect([...select.options].map(o => o.textContent)).toEqual(['512', '768']);
        select.selectedIndex = 1;
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

        // A boolean is a switch, disabled until the node can be edited
        const toggle = valueOf('enabled');
        expect([toggle.getAttribute('role'), toggle.getAttribute('aria-checked')]).toEqual(['switch', 'false']);
        toggle.click();
        expect(edits()).toEqual([{ nodeId: 5, widgetName: 'enabled', value: true }]);
        expect(toggle.getAttribute('aria-checked')).toBe('true');
        sendInfo(rows, false);
        expect((sidebar().querySelector('[role="switch"]') as HTMLButtonElement).disabled).toBe(true);
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

    it('node ids stay text, and navigation posts the shown node through delegated listeners', () => {
        const id = `1); window.__pwned = (1`;
        channel.onmessage!({ data: { type: 'info', data: { node: node(id), nav: nav(false), rows: [], links } } });

        expect(document.querySelector('[onclick]')).toBeNull();
        expect(document.querySelector('.node-id')!.textContent).toBe(`#${id}`);
        for (const action of ['back', 'forward', 'prev-node', 'next-node', 'focus-node', 'lock-node']) navButton(action).click();
        const sent = channel.postMessage.mock.calls.map(([m]) => m).filter((m: any) => m.type === 'panel-action');
        // Back and Forward have nowhere to go
        expect(sent).toEqual(['prev-node', 'next-node', 'focus-node', 'lock-node'].map(name => ({ type: 'panel-action', data: { name, nodeId: id } })));
        expect((window as any).__pwned).toBeUndefined();
    });

    it('the header mirrors the Inspector: identity, navigation state, lock and breadcrumb', () => {
        const title = () => document.querySelector('.node-name')!.textContent;
        expect(title()).toBe('Inspector');
        expect(navButton('prev-node').disabled).toBe(true);

        channel.onmessage!({ data: { type: 'info', data: {
            node: { ...node(), title: 'Sampler', type: 'KSampler', graphPath: ['<b>Refine</b>'], group: 'Sampling', isSubgraph: true },
            nav: { source: 'hover', locked: false, canBack: true, canForward: false, canEdit: false }, rows: [row('seed', 'INT', 1)], links
        } } });
        expect([title(), document.querySelector('.node-id')!.textContent, document.querySelector('.node-badge')!.textContent]).toEqual(['Sampler', '#5', 'KSampler']);
        expect([navButton('back').disabled, navButton('forward').disabled, navButton('lock-node').getAttribute('aria-pressed')]).toEqual([false, true, 'false']);
        const breadcrumb = document.querySelector('.node-breadcrumb') as HTMLElement;
        expect([...breadcrumb.querySelectorAll('.crumb')].map(c => c.textContent)).toEqual(['Root', '<b>Refine</b>']);
        expect(breadcrumb.querySelector('b')).toBeNull();
        expect(breadcrumb.querySelector('.crumb-group')!.textContent).toBe('Sampling');

        // Unlocked, the rows offer the lock; Enter subgraph and the hint post like the buttons
        (breadcrumb.querySelector('[data-action="enter-subgraph"]') as HTMLElement).click();
        (sidebar().querySelector('.edit-hint') as HTMLElement).click();
        expect(posted('panel-action').map((d: any) => d.name)).toEqual(['enter-subgraph', 'lock-node']);

        sendInfo(rows);
        expect(navButton('lock-node').getAttribute('aria-pressed')).toBe('true');
        expect(sidebar().querySelector('.edit-hint')).toBeNull();
        expect(breadcrumb.hidden).toBe(true);
    });

    it('re-renders only when the info changed, so hover, focus and selection stay', () => {
        sendInfo([row('seed', 'INT', 1)]);
        const copy = sidebar().querySelector('.copy-btn') as HTMLButtonElement;
        copy.focus();

        sendInfo([row('seed', 'INT', 1)]);
        expect(sidebar().querySelector('.copy-btn')).toBe(copy);
        expect(document.activeElement).toBe(copy);

        sendInfo([row('seed', 'INT', 2)]);
        expect(sidebar().querySelector('.copy-btn')).not.toBe(copy);
        expect(valueOf('seed').textContent).toBe('2');
    });

    it('copies values and the title, and long values show more or less across renders', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        const long = 'word '.repeat(60);
        sendInfo([row('seed', 'INT', 7), row('prompt', 'text', long)]);

        const copies = sidebar().querySelectorAll<HTMLButtonElement>('.copy-btn');
        expect(copies[0].getAttribute('aria-label')).toBe('Copy Mode');
        copies[copies.length - 1].click();
        (document.querySelector('.node-identity') as HTMLButtonElement).click();
        await vi.waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
        expect(writeText.mock.calls).toEqual([[long], ['Node #5']]);
        await vi.waitFor(() => expect(copies[copies.length - 1].classList.contains('copied')).toBe(true));

        const expand = sidebar().querySelector('.value-expand') as HTMLButtonElement;
        expect(valueOf('prompt').classList.contains('is-clamped')).toBe(true);
        expand.click();
        expect([expand.textContent, expand.getAttribute('aria-expanded')]).toEqual(['Show less', 'true']);
        sendInfo([row('seed', 'INT', 8), row('prompt', 'text', long)]);
        expect(sidebar().querySelector('.info-row.is-expanded')).not.toBeNull();
        expect(sidebar().querySelector('.value-expand')!.textContent).toBe('Show less');
    });

    it('sections collapse from a button that says whether it is expanded', () => {
        sendInfo([row('seed', 'INT', 1)]);
        const header = () => sidebar().querySelector('.section-header') as HTMLButtonElement;
        expect(header().tagName).toBe('BUTTON');
        header().click();
        expect(header().getAttribute('aria-expanded')).toBe('false');
        sendInfo([row('seed', 'INT', 2)]);
        expect(header().getAttribute('aria-expanded')).toBe('false');
        expect(sidebar().querySelector('.info-section.collapsed')).not.toBeNull();
    });

    it('the picker searches in ComfyUI, drops stale replies, and picks with the keyboard', () => {
        sendInfo([]);
        const picker = document.querySelector('.node-picker') as HTMLElement;
        const filter = document.querySelector('.node-picker-filter') as HTMLInputElement;
        const items = () => [...picker.querySelectorAll('[role="option"]')];
        const nodes = [{ id: 3, title: 'Loader', type: 'Checkpoint', order: 0 }, { id: 5, title: 'Node', type: 'Node', order: 1 }];

        navButton('go-to-node').click();
        expect(picker.hidden).toBe(false);
        expect(document.activeElement).toBe(filter);
        expect(posted('search-nodes')).toEqual(['']);
        receive('nodes-list', { query: '', nodes });
        // Unfiltered, it opens on the shown node
        expect(items().map(i => [i.getAttribute('aria-selected'), i.classList.contains('active')])).toEqual([['false', false], ['true', true]]);

        filter.value = 'lo';
        filter.dispatchEvent(new Event('input'));
        expect(posted('search-nodes')).toEqual(['', 'lo']);
        // A reply to an earlier query is dropped
        receive('nodes-list', { query: 'l', nodes: [] });
        expect(items()).toHaveLength(2);
        receive('nodes-list', { query: 'lo', nodes: nodes.slice(0, 1) });
        expect(items().map(i => i.querySelector('.dropdown-item-title')!.textContent)).toEqual(['Loader']);

        key(filter, 'Enter');
        expect(posted('node-select')).toEqual([3]);
        expect(picker.hidden).toBe(true);
        expect(document.activeElement).toBe(navButton('go-to-node'));
    });

    it('←/→, L and Ctrl+K act outside typing fields only, and Escape closes the picker, never the window', () => {
        sendInfo([row('prompt', 'text', 'cat')]);
        const picker = document.querySelector('.node-picker') as HTMLElement;

        key(document.body, 'ArrowRight');
        key(document.body, 'ArrowLeft');
        key(document.body, 'l');
        key(document.body, 'ArrowLeft', { ctrlKey: true });
        expect(posted('panel-action').map((d: any) => d.name)).toEqual(['next-node', 'prev-node', 'lock-node']);

        valueOf('prompt').click();
        key(sidebar().querySelector('input')!, 'ArrowRight');
        key(sidebar().querySelector('input')!, 'l');
        expect(posted('panel-action')).toHaveLength(3);
        key(sidebar().querySelector('input')!, 'Escape');

        key(document.body, 'k', { ctrlKey: true });
        expect(picker.hidden).toBe(false);
        key(document.querySelector('.node-picker-filter')!, 'Escape');
        expect(picker.hidden).toBe(true);
        navButton('go-to-node').click();
        key(document.body, 'Escape');
        expect(picker.hidden).toBe(true);
        key(document.body, 'Escape');
        expect(window.close).not.toHaveBeenCalled();
        expect(channel.postMessage.mock.calls.map(([m]) => m.type)).not.toContain('close');

        // Nothing to navigate while the Inspector is off
        channel.onmessage!({ data: { type: 'config', data: { palette, reduceMotion: false, zoom: 300, glass: 'on', inspector: false } } });
        key(document.body, 'ArrowRight');
        key(document.body, 'k', { ctrlKey: true });
        expect(posted('panel-action')).toHaveLength(3);
        expect(picker.hidden).toBe(true);
    });

    it('the run bar shows the running node, its progress and the queue, and the shown node its state', () => {
        const run = (data: object) => receive('run', { queue: 0, nodeId: null, title: '', value: 0, max: 0, cached: [], done: [], error: null, ...data });
        const bar = () => [...document.querySelectorAll('.run-bar > span')].map(el => el.textContent);
        const fill = () => (document.querySelector('.run-progress-fill') as HTMLElement).style.width;
        const badge = () => document.querySelector('.run-badge') as HTMLElement;
        expect(bar()).toEqual(['Idle', 'Queue 0']);

        sendInfo([row('seed', 'INT', 1)]);
        valueOf('seed').click();
        const input = sidebar().querySelector('input[type="number"]');
        expect(badge().hidden).toBe(true);

        run({ queue: 2, nodeId: '<b>9</b>', title: '<i>Loader</i>', value: 1, max: 4 });
        expect(bar()).toEqual(['<i>Loader</i> #<b>9</b>', 'Queue 2']);
        expect(document.querySelector('.run-bar b, .run-bar i')).toBeNull();
        expect(fill()).toBe('25%');
        expect(badge().hidden).toBe(true);

        run({ queue: 2, nodeId: '5', title: 'Node', value: 3, max: 20, cached: ['1'], done: ['9'] });
        expect([badge().hidden, badge().textContent, badge().dataset.state]).toEqual([false, 'Running 3/20', 'running']);
        // The badge updates without rendering the rows, so an open editor stays
        expect(sidebar().querySelector('input[type="number"]')).toBe(input);

        run({ queue: 1, cached: ['5'] });
        expect([badge().textContent, bar()[0], fill()]).toEqual(['Cached', 'Queued', '0%']);
        run({ done: ['5'] });
        expect([badge().textContent, bar()[0]]).toEqual(['Done', 'Idle']);
        // Another node shown takes its own state
        key(input!, 'Escape');
        receive('info', { node: node(9), nav: nav(), rows: [], links });
        expect(badge().hidden).toBe(true);
    });

    it('shows the last error with Go to node and Copy traceback, and marks the inputs that failed validation', async () => {
        const writeText = vi.fn().mockResolvedValue(undefined);
        vi.stubGlobal('navigator', { clipboard: { writeText } });
        const banner = document.querySelector('.error-banner') as HTMLElement;
        const error = { nodeId: '7:5', title: '', type: 'KSampler', message: '<img src=x onerror="window.__pwned=1">', traceback: 'Traceback:\n  line 1\n' };
        expect(banner.hidden).toBe(true);

        receive('info', { node: { ...node(5), executionId: '7:5' }, nav: nav(), rows: [], links });
        receive('run', { queue: 0, nodeId: null, title: '', value: 0, max: 0, cached: [], done: ['7:5'], error });
        expect(banner.hidden).toBe(false);
        expect(banner.querySelector('.error-text')!.textContent).toBe(`KSampler #7:5 ${error.message}`);
        expect(banner.querySelector('img')).toBeNull();
        expect(document.querySelector('.run-badge')!.textContent).toBe('Error');

        (banner.querySelector('[data-action="go-to-error"]') as HTMLElement).click();
        expect(posted('run-node-select')).toEqual(['7:5']);
        (banner.querySelector('[data-action="copy-traceback"]') as HTMLElement).click();
        await vi.waitFor(() => expect(writeText).toHaveBeenCalledWith(`Traceback:\n  line 1\n${error.message}`));

        receive('run', { queue: 0, nodeId: null, title: '', value: 0, max: 0, cached: [], done: [], error: null });
        expect(banner.hidden).toBe(true);

        sendInfo([row('ckpt_name', 'combo', 'x'), row('steps', 'INT', 20, { error: 'Value not in list: <b>x</b>' })]);
        const marked = [...sidebar().querySelectorAll('.info-row.has-error')];
        expect(marked.map(el => el.querySelector('.row-error')!.textContent)).toEqual(['Value not in list: <b>x</b>']);
        expect(marked[0].querySelector('b')).toBeNull();
        expect((window as any).__pwned).toBeUndefined();
    });

    it('shows the node outputs as thumbnails, one large in Output, and Escape returns to the glass', () => {
        const main = document.querySelector('.main-container') as HTMLElement;
        const strip = document.querySelector('.node-outputs') as HTMLElement;
        const thumbs = () => [...strip.querySelectorAll('.output-thumb')] as HTMLButtonElement[];
        const large = document.querySelector('.output-image') as HTMLImageElement;
        const outputs = (id: number, urls: string[]) => receive('info', { node: node(id), nav: nav(), rows: [], outputs: urls, links });
        receive('ping');
        (document.querySelector('[data-view="glass"]') as HTMLElement).click();

        outputs(5, []);
        expect(strip.hidden).toBe(true);
        outputs(5, ['/api/view?filename=a.png&type=output', '/api/view?filename=b"><img onerror=x>.png&type=output']);
        expect(strip.hidden).toBe(false);
        expect(thumbs().map(thumb => thumb.querySelector('img')!.getAttribute('src'))).toEqual(['/api/view?filename=a.png&type=output', '/api/view?filename=b"><img onerror=x>.png&type=output']);
        expect(strip.querySelectorAll('img')).toHaveLength(2);

        thumbs()[1].click();
        expect(main.dataset.view).toBe('output');
        expect(large.getAttribute('src')).toBe('/api/view?filename=b"><img onerror=x>.png&type=output');
        expect(thumbs().map(thumb => thumb.getAttribute('aria-pressed'))).toEqual(['false', 'true']);
        // No glass frame is shown
        expect(posted('visibility').at(-1)).toBe(true);

        // A live preview replaces the results in place
        const first = thumbs()[0];
        outputs(5, ['blob:http://127.0.0.1/preview']);
        expect(thumbs()).toEqual([first]);
        expect(large.getAttribute('src')).toBe('blob:http://127.0.0.1/preview');

        // New previews leave the rows as they are
        receive('info', { node: node(5), nav: nav(), rows: [row('seed', 'INT', 1)], outputs: ['blob:http://127.0.0.1/a'], links });
        const rows = sidebar().innerHTML;
        const seed = valueOf('seed');
        receive('info', { node: node(5), nav: nav(), rows: [row('seed', 'INT', 1)], outputs: ['blob:http://127.0.0.1/b'], links });
        expect(valueOf('seed')).toBe(seed);
        expect(sidebar().innerHTML).toBe(rows);
        expect(large.getAttribute('src')).toBe('blob:http://127.0.0.1/b');

        // Another node without outputs
        outputs(6, []);
        expect([strip.hidden, large.hidden]).toEqual([true, true]);
        expect((document.querySelector('.output-empty') as HTMLElement).hidden).toBe(false);

        // An editor's Escape stays in Output; Escape then returns to the view with the glass
        sendInfo([row('seed', 'INT', 1)]);
        valueOf('seed').click();
        key(sidebar().querySelector('input')!, 'Escape');
        expect(main.dataset.view).toBe('output');
        key(document.body, 'Escape');
        expect(main.dataset.view).toBe('glass');
        expect(posted('visibility').at(-1)).toBe(false);
        expect(JSON.parse(localStorage.getItem('magnifyglass-viewer-layout')!).view).toBe('glass');

        (document.querySelector('[data-view="output"]') as HTMLElement).click();
        expect(main.dataset.view).toBe('output');
    });

    it('lists the inputs and outputs with a chip for each linked node, which jumps to it, and flags required inputs left unconnected', () => {
        const section = (id: string) => sidebar().querySelector(`[data-section-id="${id}"]`);
        const chips = (id: string) => [...section(id)!.querySelectorAll('.link-chip')] as HTMLButtonElement[];
        receive('info', { node: node(5), nav: nav(), rows: [], outputs: [], links: {
            inputs: [
                { name: 'model', type: 'MODEL', linked: [{ id: 1, title: '<img src=x onerror="window.__pwned = 1">', slot: 'MODEL' }], missing: false },
                { name: 'latent_image', type: 'LATENT', linked: [], missing: true },
                { name: 'mask', type: 'MASK', linked: [], missing: false }
            ],
            outputs: [{ name: 'LATENT', type: 'LATENT', linked: [{ id: 8, title: 'Decode', slot: 'samples' }, { id: 9, title: 'Preview', slot: 'images' }, { title: 'Subgraph output', slot: 'latent' }] }]
        } });

        expect(chips('inputs').map(chip => chip.textContent)).toEqual(['<img src=x onerror="window.__pwned = 1"> #1 · MODEL']);
        expect(sidebar().querySelector('img')).toBeNull();
        expect(chips('outputs').map(chip => chip.textContent)).toEqual(['Decode #8 · samples', 'Preview #9 · images', 'Subgraph output · latent']);
        expect(chips('outputs').map(chip => chip.tagName)).toEqual(['BUTTON', 'BUTTON', 'SPAN']);
        const inputs = [...section('inputs')!.querySelectorAll('.info-row')];
        expect(inputs.map(row => row.classList.contains('has-error'))).toEqual([false, true, false]);
        expect(inputs[1].querySelector('.row-error')!.textContent).toBe('Required, but nothing is connected');
        expect(inputs[2].querySelector('.value-empty')!.textContent).toBe('not connected');

        // node-select locks and centres the node in ComfyUI
        chips('outputs')[2].click();
        chips('outputs')[1].click();
        chips('inputs')[0].click();
        expect(posted('node-select')).toEqual([9, 1]);
        expect((window as any).__pwned).toBeUndefined();

        (section('outputs')!.querySelector('.section-header') as HTMLElement).click();
        expect(JSON.parse(localStorage.getItem('magnifyglass-viewer-layout')!).collapsed).toEqual(['outputs']);

        // A node without slots has neither section
        receive('info', { node: node(6), nav: nav(), rows: [], outputs: [], links });
        expect([section('node'), section('inputs'), section('outputs')].map(Boolean)).toEqual([true, false, false]);
    });

    it('shows the empty state for no node, with no Cursor section', () => {
        channel.onmessage!({ data: { type: 'info', data: { node: null, nav: nav(false), rows: [] } } });
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
        const config = (glass: string) => channel.onmessage!({ data: { type: 'config', data: { palette, reduceMotion: false, zoom: 300, glass, inspector: true } } });
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
        channel.onmessage!({ data: { type: 'config', data: { palette, reduceMotion: false, zoom: 300, glass: 'on', inspector: false } } });
        expect(sidebar().textContent).toContain('The Inspector is off in ComfyUI');
        channel.onmessage!({ data: { type: 'config', data: { palette, reduceMotion: false, zoom: 300, glass: 'on', inspector: true } } });
        expect(valueOf('seed')).toBeDefined();
    });

    it('applies the palette ComfyUI sends, drops an override that went away, and follows Reduce Motion', () => {
        const root = document.documentElement;
        const config = (properties: Record<string, string>, scheme: string, reduceMotion: boolean) =>
            channel.onmessage!({ data: { type: 'config', data: { glass: 'on', inspector: true, reduceMotion, zoom: 300, palette: { ...palette, scheme, properties } } } });

        config({ '--fg-color': '#222222', '--mg-panel-accent': '#ff8800' }, 'light', true);
        expect(root.style.getPropertyValue('--fg-color')).toBe('#222222');
        expect(root.style.getPropertyValue('--mg-panel-accent')).toBe('#ff8800');
        expect(root.style.colorScheme).toBe('light');
        expect(root.style.fontFamily).toBe('Inter, Arial, sans-serif');
        expect(root.style.fontSize).toBe('16px');
        expect(root.classList.contains('reduce-motion')).toBe(true);

        config({ '--fg-color': '#dddddd', '--mg-panel-accent': '' }, 'dark', false);
        expect(root.style.getPropertyValue('--fg-color')).toBe('#dddddd');
        expect(root.style.getPropertyValue('--mg-panel-accent')).toBe('');
        expect(root.style.colorScheme).toBe('dark');
        expect(root.classList.contains('reduce-motion')).toBe(false);
    });

    it('zoom buttons and the wheel write the zoom once they rest for 250 ms, within 100-1000%', () => {
        const zoomIn = document.getElementById('zoom-in') as HTMLButtonElement;
        const zoomOut = document.getElementById('zoom-out') as HTMLButtonElement;
        const shown = () => document.querySelector('.zoom-value')!.textContent;
        const config = (zoom: number) => receive('config', { palette, reduceMotion: false, zoom, glass: 'on', inspector: true });
        const wheel = (deltaY: number) => document.querySelector('.canvas-section')!.dispatchEvent(new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true }));
        expect(zoomIn.disabled).toBe(true);
        receive('ping');
        config(300);
        expect(shown()).toBe('300%');

        zoomIn.click();
        zoomIn.click();
        wheel(-100);
        expect(shown()).toBe('375%');
        vi.advanceTimersByTime(249);
        // ComfyUI's older zoom does not replace one still waiting to be written
        config(300);
        expect(shown()).toBe('375%');
        expect(posted('zoom')).toEqual([]);
        vi.advanceTimersByTime(1);
        expect(posted('zoom')).toEqual([375]);

        // A touchpad's small deltas add up to a step
        wheel(40);
        wheel(40);
        expect(shown()).toBe('375%');
        wheel(40);
        expect(shown()).toBe('350%');
        zoomOut.click();
        vi.advanceTimersByTime(250);
        expect(posted('zoom')).toEqual([375, 325]);

        config(1000);
        expect(zoomIn.disabled).toBe(true);
        wheel(-100);
        vi.advanceTimersByTime(250);
        expect(posted('zoom')).toHaveLength(2);
        config(110);
        zoomOut.click();
        vi.advanceTimersByTime(250);
        expect(posted('zoom')).toEqual([375, 325, 100]);
    });

    it('keeps the view mode, the Inspector width and the collapsed sections across reloads', () => {
        const main = document.querySelector('.main-container') as HTMLElement;
        const viewButton = (view: string) => document.querySelector(`[data-view="${view}"]`) as HTMLButtonElement;
        const divider = document.querySelector('.inspector-divider') as HTMLElement;
        vi.spyOn(main, 'getBoundingClientRect').mockReturnValue({ right: 1000, width: 1000 } as DOMRect);
        divider.setPointerCapture = vi.fn();
        receive('ping');
        sendInfo([row('seed', 'INT', 1)]);

        viewButton('info').click();
        expect(main.dataset.view).toBe('info');
        expect(viewButton('info').getAttribute('aria-pressed')).toBe('true');
        expect(viewButton('split').getAttribute('aria-pressed')).toBe('false');
        expect(main.hasAttribute('aria-pressed')).toBe(false);
        // Info shows no frame, so ComfyUI need not send any
        expect(posted('visibility').at(-1)).toBe(true);
        viewButton('glass').click();
        expect(posted('visibility').at(-1)).toBe(false);

        divider.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: 1 }));
        divider.dispatchEvent(new PointerEvent('pointermove', { clientX: 600 }));
        expect(main.style.getPropertyValue('--inspector-w')).toBe('400px');
        // The frame keeps its minimum, the Inspector its own
        divider.dispatchEvent(new PointerEvent('pointermove', { clientX: 0 }));
        expect(main.style.getPropertyValue('--inspector-w')).toBe('808px');
        divider.dispatchEvent(new PointerEvent('pointermove', { clientX: 990 }));
        expect(main.style.getPropertyValue('--inspector-w')).toBe('240px');
        divider.dispatchEvent(new PointerEvent('pointermove', { clientX: 650 }));
        divider.dispatchEvent(new Event('lostpointercapture'));
        const visibilityPosts = posted('visibility').length;
        (sidebar().querySelector('.section-header') as HTMLElement).click();
        expect(posted('visibility').length).toBe(visibilityPosts);

        document.body.innerHTML = bodyHtml;
        new Function(script)();
        sendInfo([row('seed', 'INT', 1)]);
        const reloaded = document.querySelector('.main-container') as HTMLElement;
        expect(reloaded.dataset.view).toBe('glass');
        expect(document.querySelector('[data-view="glass"]')!.getAttribute('aria-pressed')).toBe('true');
        expect(reloaded.style.getPropertyValue('--inspector-w')).toBe('350px');
        expect(sidebar().querySelector('.info-section.collapsed')).not.toBeNull();

        // Double-click resets the width
        document.querySelector('.inspector-divider')!.dispatchEvent(new Event('dblclick'));
        expect(reloaded.style.getPropertyValue('--inspector-w')).toBe('');
        expect(JSON.parse(localStorage.getItem('magnifyglass-viewer-layout')!).inspectorWidth).toBeNull();
    });

    it('the divider resizes with the arrow keys, not Prev/Next', () => {
        const main = document.querySelector('.main-container') as HTMLElement;
        const divider = document.querySelector('.inspector-divider') as HTMLElement;
        vi.spyOn(main, 'getBoundingClientRect').mockReturnValue({ right: 1000, width: 1000 } as DOMRect);
        vi.spyOn(document.getElementById('inspector')!, 'getBoundingClientRect').mockReturnValue({ width: 320 } as DOMRect);
        sendInfo([]);

        key(divider, 'ArrowLeft');
        expect(main.style.getPropertyValue('--inspector-w')).toBe('336px');
        key(divider, 'ArrowRight');
        expect(main.style.getPropertyValue('--inspector-w')).toBe('304px');
        expect(posted('panel-action')).toEqual([]);
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

    it('skips a frame that cannot be decoded', async () => {
        const decode = vi.fn().mockRejectedValue(new DOMException('Truncated', 'InvalidStateError'));
        vi.stubGlobal('createImageBitmap', decode);
        const ctx = (document.getElementById('viewer-canvas') as HTMLCanvasElement).getContext('2d') as any;

        channel.onmessage!({ data: { type: 'frame', data: new Blob(['a']) } });
        await vi.waitFor(() => expect(decode).toHaveBeenCalled());
        await Promise.resolve();
        expect(ctx.drawImage).not.toHaveBeenCalled();
    });

    it('starts from its defaults when storage is blocked', () => {
        vi.stubGlobal('localStorage', { getItem() { throw new DOMException('Blocked', 'SecurityError'); } });
        document.body.innerHTML = bodyHtml;
        new Function(script)();
        expect((document.querySelector('.main-container') as HTMLElement).dataset.view).toBe('split');
        expect(document.getElementById('fit-btn')!.getAttribute('aria-pressed')).toBe('false');
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
});
