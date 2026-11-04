import { describe, it, expect, vi } from 'vitest';
import { ABOUT_BADGES, renderAbout } from '../../src/sidebar/SidebarAbout';
import { registerSidebar } from '../../src/sidebar/sidebar';
import { version } from '../../package.json';
// @ts-ignore
import { app } from '/scripts/app.js';

vi.mock('/scripts/app.js', () => ({
    app: {
        ui: {
            settings: {
                getSettingValue: vi.fn(),
                setSettingValue: vi.fn()
            }
        },
        extensionManager: {
            registerSidebarTab: vi.fn()
        }
    }
}));

const ALLOWED_HOSTS = ['github.com', 'discord.gg', 'www.youtube.com', 'ko-fi.com', 'aemotionstudio.org'];
const REPO = 'https://github.com/AEmotionStudio/ComfyUI-MagnifyGlass';

describe('Sidebar About', () => {
    it('links only to the studio over https, each in a new tab with a name', () => {
        const links = Array.from(renderAbout().querySelectorAll('a'));
        expect(links.length).toBeGreaterThan(6);

        for (const a of links) {
            const url = new URL(a.getAttribute('href')!);
            expect(url.protocol).toBe('https:');
            expect(ALLOWED_HOSTS).toContain(url.hostname);
            if (url.hostname === 'github.com') {
                expect(url.pathname).toMatch(/^\/(AEmotionStudio|aemotion-studio)\/ComfyUI-/);
            }
            expect(a.target).toBe('_blank');
            expect(a.rel).toBe('noopener noreferrer');
            expect(a.textContent!.trim()).not.toBe('');
        }
    });

    it('names the version in the heading', () => {
        const heading = renderAbout().querySelector('.magnify-brand h3')!;
        expect(heading.textContent).toBe(`MagnifyGlass ${version}`);
    });

    it('gives the About page the repo badge only', () => {
        expect(ABOUT_BADGES).toEqual([{ label: `MagnifyGlass ${version}`, url: REPO, icon: 'pi pi-github' }]);
    });

    it('keeps About in place when Reset All re-renders the settings', () => {
        // An existing stylesheet link keeps the sidebar from loading the real one
        const style = document.createElement('link');
        style.id = 'magnify-sidebar-styles';
        document.head.appendChild(style);
        vi.stubGlobal('confirm', vi.fn(() => true));

        registerSidebar();
        const tab = vi.mocked(app.extensionManager.registerSidebarTab).mock.calls[0][0];
        const el = document.createElement('div');
        tab.render(el);

        const about = el.querySelector('.magnify-about')!;
        const content = el.querySelector('.magnify-sidebar-content')!;
        expect(about.parentElement).toBe(content);

        const resetAll = Array.from(el.querySelectorAll('button')).find(b => b.textContent?.includes('Reset All Settings'))!;
        resetAll.click();

        expect(el.contains(resetAll)).toBe(false);
        expect(el.querySelector('.magnify-about')).toBe(about);
        expect(about.parentElement).toBe(content);
        expect(el.querySelectorAll('.magnify-about')).toHaveLength(1);
        vi.unstubAllGlobals();
    });

    it('makes the tab wrapper fill the panel so the content does not collapse', () => {
        registerSidebar();
        const tab = vi.mocked(app.extensionManager.registerSidebarTab).mock.calls[0][0];
        const el = document.createElement('div');
        tab.render(el);

        expect(el.style.height).toBe('100%');
    });
});
