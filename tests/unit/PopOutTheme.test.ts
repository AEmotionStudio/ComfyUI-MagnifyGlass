import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PopOutManager } from '../../src/magnify-glass/PopOutManager';

describe('Pop-out palette', () => {
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
        manager = new PopOutManager(() => ({ glass: 'on', inspector: true, reduceMotion: false }), () => { });
    });

    afterEach(() => {
        manager.cleanup();
        document.body.classList.remove('dark-theme');
        document.body.removeAttribute('style');
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    const pong = () => (manager as any).handleMessage({ type: 'pong' });
    const palettes = () => posted.filter(m => m.type === 'config').map(m => m.data.palette);

    it('sends the computed allowlisted properties, the scheme and the font, and resends only when they change', () => {
        document.body.classList.add('dark-theme');
        document.body.style.setProperty('--fg-color', '#dddddd');
        document.body.style.setProperty('--comfy-menu-bg', '#202020');
        document.body.style.setProperty('--not-allowlisted', 'red');
        document.body.style.fontFamily = 'Inter, Arial, sans-serif';
        pong();
        pong();
        expect(palettes()).toHaveLength(1);
        const [palette] = palettes();
        expect(palette.scheme).toBe('dark');
        expect(palette.fontFamily).toBe('Inter, Arial, sans-serif');
        expect(palette.properties['--fg-color']).toBe('#dddddd');
        expect(palette.properties['--comfy-menu-bg']).toBe('#202020');
        // Unset properties are sent empty, so the viewer drops an override that went away
        expect(palette.properties['--mg-panel-accent']).toBe('');
        expect(palette.properties).not.toHaveProperty('--not-allowlisted');

        document.body.classList.remove('dark-theme');
        document.body.style.setProperty('--mg-panel-accent', '#ff8800');
        pong();
        expect(palettes()).toHaveLength(2);
        expect(palettes()[1].scheme).toBe('light');
        expect(palettes()[1].properties['--mg-panel-accent']).toBe('#ff8800');
    });

    it('sends the palette again when the viewer reconnects', () => {
        pong();
        (manager as any).handleMessage({ type: 'close' });
        pong();
        expect(palettes()).toHaveLength(2);
        expect(palettes()[1]).toEqual(palettes()[0]);
    });
});
