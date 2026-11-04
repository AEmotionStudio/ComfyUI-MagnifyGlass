import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PopOutManager, type PopOutStatus } from '../../src/magnify-glass/PopOutManager';

describe('Pop-out connection', () => {
    let manager: PopOutManager;
    let channels: { name: string; posted: any[] }[];
    let status: PopOutStatus;
    let connects: number;
    const posted = () => channels[0].posted;
    const pings = () => posted().filter(m => m.type === 'ping').length;
    const receive = (message: unknown) => (manager as any).handleMessage(message);

    beforeEach(() => {
        vi.useFakeTimers();
        sessionStorage.clear();
        channels = [];
        status = { glass: 'on', inspector: true, reduceMotion: false };
        connects = 0;
        vi.stubGlobal('BroadcastChannel', class {
            onmessage: ((e: MessageEvent) => void) | null = null;
            posted: any[] = [];
            constructor(public name: string) { channels.push(this); }
            postMessage(message: unknown) { this.posted.push(message); }
            close() { }
        });
        manager = new PopOutManager(() => status, () => connects++);
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

        const reloaded = new PopOutManager(() => status, () => { });
        expect(channels[1].name).toBe(channels[0].name);
        reloaded.cleanup();
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
        status = { glass: 'hidden', inspector: true, reduceMotion: false };
        receive({ type: 'pong' });
        status = { glass: 'off', inspector: false, reduceMotion: false };
        receive({ type: 'pong' });
        expect(configs()).toEqual([['on', true], ['hidden', true], ['off', false]]);
    });

    it('sends frames as Blobs, one encode at a time, and none while the viewer is hidden', () => {
        const blob = new Blob(['png'], { type: 'image/png' });
        let encode: BlobCallback | null = null;
        const canvas = { toBlob: (callback: BlobCallback) => { encode = callback; } } as unknown as HTMLCanvasElement;
        const frames = () => posted().filter(m => m.type === 'frame').map(m => m.data);
        receive({ type: 'pong' });

        receive({ type: 'visibility', data: true });
        manager.sendFrame(canvas);
        expect(encode).toBeNull();

        receive({ type: 'visibility', data: false });
        manager.sendFrame(canvas);
        const first = encode!;
        encode = null;
        // The first frame is still encoding
        vi.advanceTimersByTime(100);
        manager.sendFrame(canvas);
        expect(encode).toBeNull();

        first(blob);
        expect(frames()).toEqual([blob]);
        manager.sendFrame(canvas);
        expect(encode).not.toBeNull();
    });

    it('hands viewer requests to the Inspector and sends its info as it is', () => {
        const calls: unknown[][] = [];
        manager.onWidgetEdit = (data) => calls.push(['edit', data]);
        manager.onButtonClick = (data) => calls.push(['click', data]);
        manager.onPanelAction = (name, nodeId) => calls.push(['action', name, nodeId]);
        manager.onRequestOptions = (data) => data.widgetName === 'size' ? [512, 768] : [];
        const info = { node: null, nav: { source: 'hover', locked: false, canBack: false, canForward: false, canEdit: false }, rows: [] } as const;

        manager.sendInfo(info);
        expect(posted()).toEqual([]);
        receive({ type: 'pong' });

        receive({ type: 'widget-edit', data: { nodeId: 5, widgetName: 'seed', value: 1 } });
        receive({ type: 'button-click', data: { nodeId: 5, widgetName: 'run' } });
        receive({ type: 'panel-action', data: { name: 'focus-node', nodeId: 5 } });
        receive({ type: 'request-options', data: { nodeId: 5, widgetName: 'size' } });
        manager.sendInfo(info);

        expect(calls).toEqual([
            ['edit', { nodeId: 5, widgetName: 'seed', value: 1 }],
            ['click', { nodeId: 5, widgetName: 'run' }],
            ['action', 'focus-node', 5]
        ]);
        expect(posted().filter(m => m.type === 'options')).toEqual([{ type: 'options', data: { nodeId: 5, widgetName: 'size', options: [512, 768] } }]);
        expect(posted().at(-1)).toEqual({ type: 'info', data: info });
    });
});
