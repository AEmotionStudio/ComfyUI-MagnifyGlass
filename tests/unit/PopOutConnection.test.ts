import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PopOutManager, type PopOutStatus } from '../../src/magnify-glass/PopOutManager';

describe('Pop-out connection', () => {
    let manager: PopOutManager;
    let channels: { name: string; posted: any[] }[];
    let status: PopOutStatus;
    let connects: number;
    let zooms: number[];
    let api: EventTarget;
    const posted = () => channels[0].posted;
    const pings = () => posted().filter(m => m.type === 'ping').length;
    const receive = (message: unknown) => (manager as any).handleMessage(message);

    beforeEach(() => {
        vi.useFakeTimers();
        sessionStorage.clear();
        channels = [];
        status = { glass: 'on', inspector: true, reduceMotion: false, zoom: 300 };
        connects = 0;
        zooms = [];
        api = new EventTarget();
        vi.stubGlobal('app', { api, ui: { lastQueueSize: 2 }, graph: null, canvas: null, extensionManager: { workflow: { activeWorkflow: {} } } });
        vi.stubGlobal('BroadcastChannel', class {
            onmessage: ((e: MessageEvent) => void) | null = null;
            posted: any[] = [];
            constructor(public name: string) { channels.push(this); }
            postMessage(message: unknown) { this.posted.push(message); }
            close() { }
        });
        manager = new PopOutManager(() => status, () => connects++, (zoom) => zooms.push(zoom));
        manager.listen();
        channels[0].posted = [];
    });

    afterEach(() => {
        manager.cleanup();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('uses a channel and viewer URL of its own session, which survives a reload', () => {
        const session = sessionStorage.getItem('magnifyglass-popout-session')!;
        expect(session).toBeTruthy();
        expect(channels[0].name).toBe(`comfyui-magnifyglass-popout:${session}`);
        expect(new URL((manager as any).viewerUrl).searchParams.get('session')).toBe(session);

        manager.cleanup();
        const reloaded = new PopOutManager(() => status, () => { }, () => { });
        // A viewer's announce waits until ComfyUI is set up
        expect(channels).toHaveLength(1);
        reloaded.listen();
        expect(channels[1].name).toBe(channels[0].name);
        expect(channels[1].posted).toEqual([{ type: 'claim', data: expect.any(String) }]);
        reloaded.cleanup();
    });

    it('a duplicated tab starts a session of its own, and the viewer stays with the first tab', () => {
        const edits: unknown[] = [];
        manager.onWidgetEdit = (data) => edits.push(data);
        receive({ type: 'pong' });

        // The duplicate starts from a copy of this tab's sessionStorage
        const duplicate = new PopOutManager(() => status, () => { }, () => { });
        duplicate.listen();
        const [claim] = channels[1].posted;
        receive(claim);
        expect(posted().at(-1)).toEqual({ type: 'claimed', data: claim.data });
        // Another tab's claim is not this one's
        receive({ type: 'claimed', data: 'other' });
        expect(manager.isPopOutOpen()).toBe(true);

        (duplicate as any).handleMessage(posted().at(-1));
        expect(channels[2].name).not.toBe(channels[0].name);
        expect(sessionStorage.getItem('magnifyglass-popout-session')).toBe(channels[2].name.split(':')[1]);
        expect(new URL((duplicate as any).viewerUrl).searchParams.get('session')).toBe(channels[2].name.split(':')[1]);
        expect(manager.isPopOutOpen()).toBe(true);
        duplicate.cleanup();
    });

    it('pings only while a viewer is connected', () => {
        vi.advanceTimersByTime(3000);
        expect(pings()).toBe(0);

        receive({ type: 'pong' });
        expect(manager.isPopOutOpen()).toBe(true);
        expect(connects).toBe(1);
        vi.advanceTimersByTime(3000);
        expect(pings()).toBe(4);
        expect(connects).toBe(1);
    });

    it('times out on unanswered pings, not on a late one, and reconnects when the viewer announces itself', () => {
        receive({ type: 'pong' });
        // A throttled tab: each ping is answered, however late
        for (let i = 0; i < 10; i++) {
            vi.advanceTimersByTime(1000);
            receive({ type: 'pong' });
        }
        expect(manager.isPopOutOpen()).toBe(true);

        vi.advanceTimersByTime(6000);
        expect(manager.isPopOutOpen()).toBe(false);
        const count = pings();
        vi.advanceTimersByTime(3000);
        expect(pings()).toBe(count);

        receive({ type: 'pong' });
        expect(manager.isPopOutOpen()).toBe(true);
    });

    it('a viewer that closed or reloaded reconnects; one closed from here waits for open()', () => {
        vi.spyOn(window, 'open').mockReturnValue({ closed: false, focus() { }, close() { } } as unknown as Window);
        receive({ type: 'pong' });
        receive({ type: 'close' });
        expect(manager.isPopOutOpen()).toBe(false);
        receive({ type: 'pong' });
        expect(manager.isPopOutOpen()).toBe(true);

        manager.close();
        expect(posted().at(-1)).toEqual({ type: 'close' });
        receive({ type: 'pong' });
        expect(manager.isPopOutOpen()).toBe(false);

        manager.open();
        receive({ type: 'pong' });
        expect(manager.isPopOutOpen()).toBe(true);
    });

    it('focuses only a connected viewer; a disconnected window is opened again and never closed from here', () => {
        const viewer = { closed: false, focus: vi.fn(), close: vi.fn() };
        const open = vi.spyOn(window, 'open').mockReturnValue(viewer as unknown as Window);
        manager.open();
        // Another tab took the named window over before this one connected
        manager.open();
        expect(open).toHaveBeenCalledTimes(2);
        manager.close();
        expect(viewer.close).not.toHaveBeenCalled();

        receive({ type: 'pong' });
        manager.open();
        expect(open).toHaveBeenCalledTimes(2);
        expect(viewer.focus).toHaveBeenCalled();
        manager.close();
        expect(viewer.close).toHaveBeenCalled();
    });

    it('tells the viewer when ComfyUI goes away', () => {
        window.dispatchEvent(new Event('pagehide'));
        expect(posted()).toEqual([]);

        receive({ type: 'pong' });
        window.dispatchEvent(new Event('pagehide'));
        expect(posted().at(-1)).toEqual({ type: 'close' });
    });

    it('sends the glass and Inspector state when they change', () => {
        const configs = () => posted().filter(m => m.type === 'config').map(m => [m.data.glass, m.data.inspector]);
        receive({ type: 'pong' });
        receive({ type: 'pong' });
        status = { glass: 'hidden', inspector: true, reduceMotion: false, zoom: 300 };
        receive({ type: 'pong' });
        status = { glass: 'off', inspector: false, reduceMotion: false, zoom: 300 };
        receive({ type: 'pong' });
        expect(configs()).toEqual([['on', true], ['hidden', true], ['off', false]]);
    });

    it('hands a zoom to the glass and sends the config it made at once', () => {
        const configZooms = () => posted().filter(m => m.type === 'config').map(m => m.data.zoom);
        receive({ type: 'pong' });

        status = { ...status, zoom: 350 };
        receive({ type: 'zoom', data: 350 });
        expect(zooms).toEqual([350]);
        expect(configZooms()).toEqual([300, 350]);
    });

    it('draws frames into the viewer window, none while it is hidden, and gets the window back after a reload', () => {
        const canvas = {} as HTMLCanvasElement;
        const viewer = { drawFrame: vi.fn(), close() { } };
        const announce = (data: unknown, origin = location.origin) =>
            window.dispatchEvent(new MessageEvent('message', { data, origin, source: viewer as any }));
        const session = sessionStorage.getItem('magnifyglass-popout-session');
        receive({ type: 'pong' });

        // Another origin, or another tab's viewer, is not this tab's
        announce({ type: 'magnifyglass-viewer-window', session }, 'http://elsewhere');
        announce({ type: 'magnifyglass-viewer-window', session: 'other' });
        manager.sendFrame(canvas);
        expect(viewer.drawFrame).not.toHaveBeenCalled();

        announce({ type: 'magnifyglass-viewer-window', session });
        manager.sendFrame(canvas);
        expect(viewer.drawFrame).toHaveBeenCalledWith(canvas);

        receive({ type: 'visibility', data: true });
        expect(manager.wantsFrames()).toBe(false);
        manager.sendFrame(canvas);
        expect(viewer.drawFrame).toHaveBeenCalledTimes(1);

        // Shown again: the glass's render loop starts again
        receive({ type: 'visibility', data: false });
        expect(manager.wantsFrames()).toBe(true);
        expect(connects).toBe(2);
        manager.sendFrame(canvas);
        expect(viewer.drawFrame).toHaveBeenCalledTimes(2);
    });

    it('acts on no request from a viewer that is not connected', () => {
        const calls: unknown[] = [];
        manager.onWidgetEdit = (data) => calls.push(data);
        manager.onNodeSelect = (id) => calls.push(id);
        receive({ type: 'widget-edit', data: { nodeId: 5, widgetName: 'seed', value: 1 } });
        receive({ type: 'node-select', data: 5 });
        receive({ type: 'zoom', data: 350 });

        receive({ type: 'pong' });
        manager.close();
        receive({ type: 'widget-edit', data: { nodeId: 5, widgetName: 'seed', value: 1 } });
        receive({ type: 'zoom', data: 350 });
        expect(calls).toEqual([]);
        expect(zooms).toEqual([]);
    });

    it('hands viewer requests to the Inspector and sends its info as it is', () => {
        const calls: unknown[][] = [];
        manager.onWidgetEdit = (data) => calls.push(['edit', data]);
        manager.onButtonClick = (data) => calls.push(['click', data]);
        manager.onPanelAction = (name, nodeId) => calls.push(['action', name, nodeId]);
        manager.onRequestOptions = (data) => data.widgetName === 'size' ? [512, 768] : [];
        manager.onSearchNodes = (query) => [{ id: 5, title: query, type: 'Node', order: 0 }];
        const info = { node: null, nav: { source: 'hover', locked: false, canBack: false, canForward: false, canEdit: false }, rows: [] } as const;

        manager.sendInfo(info);
        expect(posted()).toEqual([]);
        receive({ type: 'pong' });

        receive({ type: 'widget-edit', data: { nodeId: 5, widgetName: 'seed', value: 1 } });
        receive({ type: 'button-click', data: { nodeId: 5, widgetName: 'run' } });
        receive({ type: 'panel-action', data: { name: 'focus-node', nodeId: 5 } });
        receive({ type: 'request-options', data: { nodeId: 5, widgetName: 'size' } });
        receive({ type: 'search-nodes', data: 'ks' });
        manager.sendInfo(info);

        expect(calls).toEqual([
            ['edit', { nodeId: 5, widgetName: 'seed', value: 1 }],
            ['click', { nodeId: 5, widgetName: 'run' }],
            ['action', 'focus-node', 5]
        ]);
        expect(posted().filter(m => m.type === 'options')).toEqual([{ type: 'options', data: { nodeId: 5, widgetName: 'size', options: [512, 768] } }]);
        // The reply names its query, so the viewer can drop one for an earlier keystroke
        expect(posted().filter(m => m.type === 'nodes-list')).toEqual([{ type: 'nodes-list', data: { query: 'ks', nodes: [{ id: 5, title: 'ks', type: 'Node', order: 0 }] } }]);
        expect(posted().at(-1)).toEqual({ type: 'info', data: info });
    });
    describe('run', () => {
        const emit = (type: string, detail?: unknown) => api.dispatchEvent(new CustomEvent(type, { detail }));
        const runs = () => posted().filter(m => m.type === 'run').map(m => structuredClone(m.data));
        let subgraph: any;
        let root: any;

        beforeEach(() => {
            // Node 7 is a subgraph node; its node 3 runs as '7:3'
            const inner = { id: 3, title: 'Inner Sampler', graph: null as unknown };
            subgraph = { getNodeById: (id: number) => id === 3 ? inner : null };
            inner.graph = subgraph;
            const nodes: Record<number, unknown> = { 4: { id: 4, title: 'Loader' }, 7: { id: 7, title: 'Group', subgraph } };
            root = { getNodeById: (id: number) => nodes[id] ?? null };
            (nodes[4] as any).graph = root;
            Object.assign((globalThis as any).app, { graph: root, canvas: { graph: root } });
        });

        it('starts from the queue ComfyUI knows, and sends what the events add up to at most every 100 ms', () => {
            receive({ type: 'pong' });
            expect(runs()).toEqual([{ queue: 2, nodeId: null, title: '', value: 0, max: 0, cached: [], done: [], error: null, here: true }]);

            emit('execution_start', { prompt_id: 'p' });
            emit('execution_cached', { nodes: ['1', 4] });
            emit('executing', '5');
            emit('progress', { value: 3, max: 20, node: '5' });
            expect(runs()).toHaveLength(1);
            vi.advanceTimersByTime(100);
            expect(runs().at(-1)).toMatchObject({ queue: 2, nodeId: '5', value: 3, max: 20, cached: ['1', '4'], done: [] });

            // A node inside a subgraph is named by its execution id, and its title found through the subgraph node
            emit('executing', '7:3');
            emit('progress_state', { prompt_id: 'p', nodes: { '7:3': { state: 'running', value: 8, max: 10, node_id: '7:3' } } });
            emit('status', { exec_info: { queue_remaining: 1 } });
            for (let i = 1; i <= 30; i++) emit('progress', { value: i, max: 30, node: '7:3' });
            vi.advanceTimersByTime(100);
            expect(runs()).toHaveLength(3);
            expect(runs().at(-1)).toMatchObject({ queue: 1, nodeId: '7:3', title: 'Inner Sampler', value: 30, max: 30, done: ['5'] });

            emit('executed', { node: '9', display_node: '9', output: {} });
            emit('executing', null);
            emit('execution_success', { prompt_id: 'p' });
            vi.advanceTimersByTime(100);
            expect(runs().at(-1)).toMatchObject({ nodeId: null, title: '', done: ['5', '9', '7:3'] });
        });

        it('keeps the error until the next prompt, and finds the running node again after a reconnect', () => {
            receive({ type: 'pong' });
            emit('executing', '4');
            emit('execution_error', {
                prompt_id: 'p', node_id: '4', node_type: 'CheckpointLoader', exception_message: 'No such file',
                traceback: ['Traceback:\n', '  line 1\n']
            });
            vi.advanceTimersByTime(100);
            expect(runs().at(-1)).toMatchObject({
                nodeId: null,
                done: ['4'],
                error: { nodeId: '4', title: 'Loader', type: 'CheckpointLoader', message: 'No such file', traceback: 'Traceback:\n  line 1\n' }
            });

            emit('execution_start', { prompt_id: 'q' });
            vi.advanceTimersByTime(100);
            expect(runs().at(-1)).toEqual({ queue: 2, nodeId: null, title: '', value: 0, max: 0, cached: [], done: [], error: null, here: true });

            // Connected mid-run: the next progress state names the running node
            emit('progress_state', { prompt_id: 'q', nodes: { '4': { state: 'finished', value: 1, max: 1, node_id: '4' }, '5': { state: 'running', value: 2, max: 9, node_id: '5' } } });
            vi.advanceTimersByTime(100);
            expect(runs().at(-1)).toMatchObject({ nodeId: '5', value: 2, max: 9 });
        });

        it('listens only while connected, and stops on a timeout, a close and cleanup', () => {
            const add = vi.spyOn(api, 'addEventListener');
            const remove = vi.spyOn(api, 'removeEventListener');
            emit('executing', '4');
            vi.advanceTimersByTime(100);
            expect(runs()).toEqual([]);

            receive({ type: 'pong' });
            expect(add).toHaveBeenCalledTimes(10);
            // Unanswered pings time the viewer out; a pending send is dropped with the listeners
            vi.advanceTimersByTime(4950);
            emit('executing', '4');
            vi.advanceTimersByTime(100);
            emit('executing', '5');
            vi.advanceTimersByTime(200);
            expect(manager.isPopOutOpen()).toBe(false);
            expect(remove).toHaveBeenCalledTimes(10);
            expect(runs()).toHaveLength(1);
            expect(vi.getTimerCount()).toBe(0);

            receive({ type: 'pong' });
            receive({ type: 'close' });
            receive({ type: 'pong' });
            manager.cleanup();
            expect(add).toHaveBeenCalledTimes(30);
            expect(remove).toHaveBeenCalledTimes(30);
            const count = runs().length;
            emit('executing', '4');
            vi.advanceTimersByTime(100);
            expect(runs()).toHaveLength(count);
        });

        it('does not mark an interrupted node done', () => {
            receive({ type: 'pong' });
            emit('executing', '4');
            emit('executing', '5');
            emit('execution_interrupted', { prompt_id: 'p', node_id: '5' });
            vi.advanceTimersByTime(100);
            expect(runs().at(-1)).toMatchObject({ nodeId: null, done: ['4'] });
        });

        it('goes to a run node only in the graph and the workflow tab on screen', () => {
            const selected: number[] = [];
            manager.onNodeSelect = (id) => selected.push(id);
            receive({ type: 'pong' });
            receive({ type: 'run-node-select', data: '4' });
            receive({ type: 'run-node-select', data: '7:3' });
            (globalThis as any).app.canvas.graph = subgraph;
            receive({ type: 'run-node-select', data: '7:3' });
            receive({ type: 'run-node-select', data: '4' });
            expect(selected).toEqual([4, 3]);

            // Another tab's node 4 is not the run's
            emit('execution_start', { prompt_id: 'p' });
            (globalThis as any).app.canvas.graph = root;
            (globalThis as any).app.extensionManager.workflow.activeWorkflow = {};
            receive({ type: 'run-node-select', data: '4' });
            expect(selected).toEqual([4, 3]);
        });

        it('tells the viewer when the run belongs to another workflow tab, with the info that switch changed', () => {
            const workflow = (globalThis as any).app.extensionManager.workflow;
            const info = { node: null, nav: {}, rows: [], outputs: [], links: { inputs: [], outputs: [] } } as any;
            receive({ type: 'pong' });
            emit('execution_start', { prompt_id: 'p' });
            vi.advanceTimersByTime(100);
            expect(runs().at(-1).here).toBe(true);

            const ran = workflow.activeWorkflow;
            workflow.activeWorkflow = {};
            manager.sendInfo(info);
            expect(posted().slice(-2).map(m => m.type)).toEqual(['run', 'info']);
            expect(runs().at(-1).here).toBe(false);
            // Unchanged, only the info goes
            const sent = runs().length;
            manager.sendInfo(info);
            expect(runs()).toHaveLength(sent);

            workflow.activeWorkflow = ran;
            manager.sendInfo(info);
            expect(runs().at(-1).here).toBe(true);
        });
    });
});
