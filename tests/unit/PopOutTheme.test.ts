import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PopOutManager } from '../../src/magnify-glass/PopOutManager';

describe('Pop-out theme', () => {
    let manager: PopOutManager;
    let posted: any[];

    beforeEach(() => {
        vi.useFakeTimers();
        posted = [];
        vi.stubGlobal('BroadcastChannel', class {
            onmessage: ((e: MessageEvent) => void) | null = null;
            postMessage(message: unknown) { posted.push(message); }
            close() { }
        });
        manager = new PopOutManager(() => ({ glass: 'on', inspector: true }), () => { });
    });

    afterEach(() => {
        manager.cleanup();
        document.body.classList.remove('dark-theme');
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    const pong = () => (manager as any).handleMessage({ type: 'pong' });
    const themes = () => posted.filter(m => m.type === 'config').map(m => m.data.theme);

    it('follows body.dark-theme and resends only when it changes', () => {
        document.body.classList.add('dark-theme');
        pong();
        pong();
        expect(themes()).toEqual(['dark']);

        document.body.classList.remove('dark-theme');
        pong();
        expect(themes()).toEqual(['dark', 'light']);
    });

    it('sends the theme again when the viewer reconnects', () => {
        pong();
        (manager as any).handleMessage({ type: 'close' });
        pong();
        expect(themes()).toEqual(['light', 'light']);
    });
});
