import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const { settingsStore, addSetting } = vi.hoisted(() => {
    const settingsStore: Record<string, unknown> = {};
    // Like the ComfyUI frontend: onChange runs with the current value at registration
    const addSetting = vi.fn((setting: { id: string; defaultValue: unknown; onChange?: (v: unknown) => void }) => {
        setting.onChange?.(setting.id in settingsStore ? settingsStore[setting.id] : setting.defaultValue);
    });
    return { settingsStore, addSetting };
});

vi.mock('/scripts/app.js', () => ({
    app: {
        ui: {
            settings: {
                getSettingValue: (key: string) => settingsStore[key],
                setSettingValue: (key: string, value: unknown) => { settingsStore[key] = value; },
                addSetting
            }
        }
    }
}));

import { InfoPanel, mountInfoPanel, unmountInfoPanel } from '../../src/info-panel/InfoPanel';
import { UIManager } from '../../src/info-panel/UIManager';
import { registerPanelSettings } from '../../src/shared/settings';
import { INFO_PANEL_ID } from '../../src/shared/constants';
import { DEFAULT_SETTINGS } from '../../src/shared/settings/defaults';
import type { MagnifyGlassInstance } from '../../src/types/comfyui';

class FakeUi {
    glassDiv = document.createElement('div');
    show() { this.glassDiv.style.display = 'block'; }
    hide() { this.glassDiv.style.display = 'none'; }
    positionGlass() { }
}

class FakeGlass {
    state = { active: false };
    config = {};
    ui = new FakeUi();
    renderer = null;
    lastKnownMousePosition = { x: 0, y: 0 };
    popOutManager = {
        isPopOutOpen: () => false,
        sendInfo: vi.fn(),
        toggle: vi.fn(),
        onStateChange: null as unknown,
        onNodeSelect: null as unknown,
        onWidgetEdit: null as unknown
    };
    setGlassPreviewActive = vi.fn();
    updateMagnifiedView() { }
    applyUiChanges() { }
    toggle() { }
    resetOffsets() { }
}

const asInstance = (mg: FakeGlass) => mg as unknown as MagnifyGlassInstance;

const pressKey = (key: string, init: KeyboardEventInit = {}) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
    document.dispatchEvent(event);
    return event;
};

describe('Info Panel lifecycle', () => {
    let mg: FakeGlass;

    beforeEach(() => {
        vi.useFakeTimers();
        // Keep happy-dom from fetching the panel stylesheet
        document.head.innerHTML = '<style id="magnify-info-panel-styles-v2"></style>';
        for (const key of Object.keys(settingsStore)) delete settingsStore[key];
        // Node's own localStorage global hides happy-dom's
        vi.stubGlobal('localStorage', new Storage());
        addSetting.mockClear();
        (window as any).app = { canvas: { onDrawForeground: null, setDirty: vi.fn() }, graph: null };
        mg = new FakeGlass();
    });

    afterEach(() => {
        unmountInfoPanel(asInstance(mg));
        window.comfyUIMagnifyGlassExtensions = undefined;
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        vi.useRealTimers();
    });

    it('mount creates the DOM, the global and the hooks', () => {
        mountInfoPanel(asInstance(mg));

        expect(document.getElementById(INFO_PANEL_ID)).not.toBeNull();
        expect(document.getElementById('magnify-glass-node-highlight')).not.toBeNull();
        expect(window.infoPanelManager).toBeInstanceOf(InfoPanel);
        expect(window.comfyUIMagnifyGlassExtensions).toEqual([window.infoPanelManager]);
        expect(mg.updateMagnifiedView).not.toBe(FakeGlass.prototype.updateMagnifiedView);
        expect(mg.ui.show).not.toBe(FakeUi.prototype.show);
        expect(mg.ui.hide).not.toBe(FakeUi.prototype.hide);
        expect(mg.popOutManager.onNodeSelect).toBeTypeOf('function');
        expect(mg.setGlassPreviewActive).toHaveBeenCalledWith(true);
    });

    it('mount shows the floating controls when the glass is already active', () => {
        mg.state.active = true;
        mountInfoPanel(asInstance(mg));

        expect(window.infoPanelManager!.uiManager.elements.controls!.style.display).toBe('flex');
    });

    it('mounting twice keeps a single instance', () => {
        mountInfoPanel(asInstance(mg));
        const first = window.infoPanelManager;
        mountInfoPanel(asInstance(mg));

        expect(window.infoPanelManager).toBe(first);
        expect(window.comfyUIMagnifyGlassExtensions).toHaveLength(1);
        expect(document.querySelectorAll(`#${INFO_PANEL_ID}`)).toHaveLength(1);
    });

    it('unmount removes the panel and undoes everything mount set up', () => {
        const docAdd = vi.spyOn(document, 'addEventListener');
        const docRemove = vi.spyOn(document, 'removeEventListener');
        const winAdd = vi.spyOn(window, 'addEventListener');
        const winRemove = vi.spyOn(window, 'removeEventListener');

        mountInfoPanel(asInstance(mg));
        // No theme poll or other timers of its own
        expect(vi.getTimerCount()).toBe(0);
        mg.state.active = true;
        mg.updateMagnifiedView(); // schedules an info update frame
        expect(vi.getTimerCount()).toBe(1);
        const highlighter = window.infoPanelManager!.canvasHighlighter;
        highlighter.setHighlightedNode(1);
        expect((window as any).app.canvas.onDrawForeground).toBe((highlighter as any).boundOnDrawForeground);
        mg.setGlassPreviewActive.mockClear();

        unmountInfoPanel(asInstance(mg));

        expect(document.getElementById(INFO_PANEL_ID)).toBeNull();
        expect(document.getElementById('magnify-glass-node-highlight')).toBeNull();
        expect(document.querySelector('.floating-controls')).toBeNull();
        expect(window.infoPanelManager).toBeUndefined();
        expect(window.comfyUIMagnifyGlassExtensions).toEqual([]);

        expect(mg.updateMagnifiedView).toBe(FakeGlass.prototype.updateMagnifiedView);
        expect(mg.ui.show).toBe(FakeUi.prototype.show);
        expect(mg.ui.hide).toBe(FakeUi.prototype.hide);
        expect(mg.popOutManager.onStateChange).toBeNull();
        expect(mg.popOutManager.onNodeSelect).toBeNull();
        expect(mg.popOutManager.onWidgetEdit).toBeNull();
        expect(mg.setGlassPreviewActive).toHaveBeenCalledWith(true);

        for (const [type, handler, options] of docAdd.mock.calls) {
            expect(docRemove).toHaveBeenCalledWith(type, handler, ...(options === undefined ? [] : [options]));
        }
        for (const [type, handler, options] of winAdd.mock.calls) {
            expect(winRemove).toHaveBeenCalledWith(type, handler, ...(options === undefined ? [] : [options]));
        }
        // The pending info update frame is gone
        expect(vi.getTimerCount()).toBe(0);
        expect((window as any).app.canvas.onDrawForeground).toBeNull();
    });

    it('unmounted panel hotkeys do nothing', () => {
        mountInfoPanel(asInstance(mg));
        unmountInfoPanel(asInstance(mg));

        expect(pressKey('s').defaultPrevented).toBe(false);
        expect(pressKey('u').defaultPrevented).toBe(false);
        expect(pressKey('*').defaultPrevented).toBe(false);
        expect(settingsStore['🔍MagnifyGlass.InfoPanelPersist']).toBeUndefined();
    });

    it('re-mounting does not double-register hotkeys', () => {
        mountInfoPanel(asInstance(mg));
        unmountInfoPanel(asInstance(mg));
        const float = vi.spyOn(UIManager.prototype, 'toggleFloating');
        mountInfoPanel(asInstance(mg));
        mg.state.active = true;

        pressKey('u');

        expect(float).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll(`#${INFO_PANEL_ID}`)).toHaveLength(1);
    });

    describe('hotkeys', () => {
        const persist = '🔍MagnifyGlass.InfoPanelPersist';
        const panel = () => window.infoPanelManager!.uiManager.elements.panel!;

        beforeEach(() => {
            mountInfoPanel(asInstance(mg));
        });

        it('S, I and U do nothing while the glass is off', () => {
            const float = vi.spyOn(UIManager.prototype, 'toggleFloating');

            expect(pressKey('s').defaultPrevented).toBe(false);
            expect(pressKey('i').defaultPrevented).toBe(false);
            pressKey('u');

            expect(window.infoPanelManager!.stateManager.state.settings[persist]).toBe(false);
            expect(window.infoPanelManager!.stateManager.state.isPanelVisible).toBe(false);
            expect(float).not.toHaveBeenCalled();
        });

        it('ignore Ctrl, Meta, Shift and Alt combinations', () => {
            mg.state.active = true;

            expect(pressKey('s', { ctrlKey: true }).defaultPrevented).toBe(false);
            expect(pressKey('s', { metaKey: true }).defaultPrevented).toBe(false);
            expect(pressKey('i', { altKey: true }).defaultPrevented).toBe(false);
            expect(pressKey('S', { shiftKey: true }).defaultPrevented).toBe(false);
            expect(window.infoPanelManager!.stateManager.state.settings[persist]).toBe(false);
            expect(window.infoPanelManager!.stateManager.state.isPanelVisible).toBe(false);

            expect(pressKey('s').defaultPrevented).toBe(true);
            expect(window.infoPanelManager!.stateManager.state.settings[persist]).toBe(true);
        });

        it('need Alt when AltRequired is on', () => {
            mg.state.active = true;
            settingsStore['🔍MagnifyGlass.AltRequired'] = true;

            expect(pressKey('s').defaultPrevented).toBe(false);
            expect(pressKey('s', { altKey: true }).defaultPrevented).toBe(true);
            expect(window.infoPanelManager!.stateManager.state.settings[persist]).toBe(true);
        });

        it('read a key changed after mount on the next press', () => {
            mg.state.active = true;
            settingsStore['🔍MagnifyGlass.ToggleHotkey'] = 'j';

            pressKey('i');
            expect(window.infoPanelManager!.stateManager.state.isPanelVisible).toBe(false);
            pressKey('j');
            expect(window.infoPanelManager!.stateManager.state.isPanelVisible).toBe(true);
        });

        it('* and arrows act only while the panel is visible and hovered or focused', () => {
            const ui = window.infoPanelManager!.uiManager;
            const navigate = vi.spyOn(ui, 'navigateExecOrder').mockImplementation(() => { });
            const focus = vi.spyOn(ui, 'focusCurrentNode').mockImplementation(() => { });

            panel().dispatchEvent(new MouseEvent('mouseenter'));
            expect(pressKey('ArrowRight').defaultPrevented).toBe(false); // hidden

            ui.show();
            panel().dispatchEvent(new MouseEvent('mouseleave'));
            expect(pressKey('ArrowRight').defaultPrevented).toBe(false); // not hovered or focused
            expect(navigate).not.toHaveBeenCalled();

            panel().dispatchEvent(new MouseEvent('mouseenter'));
            expect(pressKey('ArrowRight').defaultPrevented).toBe(true);
            expect(pressKey('ArrowLeft').defaultPrevented).toBe(true);
            expect(pressKey('*', { shiftKey: true }).defaultPrevented).toBe(true);
            expect(pressKey('ArrowLeft', { ctrlKey: true }).defaultPrevented).toBe(false);
            expect(navigate.mock.calls).toEqual([[1], [-1]]);
            expect(focus).toHaveBeenCalledTimes(1);

            panel().dispatchEvent(new MouseEvent('mouseleave'));
            const button = document.createElement('button');
            panel().appendChild(button);
            button.focus();
            expect(pressKey('ArrowRight').defaultPrevented).toBe(true);

            // Focus left by a click is dropped when the pointer leaves, so ←/→ go back to the glass
            panel().dispatchEvent(new MouseEvent('mouseenter'));
            panel().dispatchEvent(new MouseEvent('mouseleave'));
            expect(document.activeElement).not.toBe(button);
            expect(pressKey('ArrowRight').defaultPrevented).toBe(false);
            button.focus();

            // Hiding clears the hover, which a hidden panel never gets a mouseleave for
            panel().dispatchEvent(new MouseEvent('mouseenter'));
            ui.hide();
            ui.show();
            button.blur();
            expect(pressKey('ArrowRight').defaultPrevented).toBe(false);
        });

        it('arrows reach other listeners', () => {
            const ui = window.infoPanelManager!.uiManager;
            vi.spyOn(ui, 'navigateExecOrder').mockImplementation(() => { });
            ui.show();
            panel().dispatchEvent(new MouseEvent('mouseenter'));
            const later = vi.fn();
            document.addEventListener('keydown', later);

            pressKey('ArrowRight');

            expect(later).toHaveBeenCalledTimes(1);
            document.removeEventListener('keydown', later);
        });

        it('hiding the panel closes the node picker', () => {
            const ui = window.infoPanelManager!.uiManager;
            ui.show();
            ui.showNodePicker(panel().querySelector('[data-action="go-to-node"]') as HTMLElement);
            expect(document.querySelector('.node-selector-dropdown')).not.toBeNull();

            ui.hide();

            expect(document.querySelector('.node-selector-dropdown')).toBeNull();
        });
    });

    describe('rendering', () => {
        let node: any;
        const panelManager = () => window.infoPanelManager!;
        const content = () => panelManager().uiManager.elements.content!;

        beforeEach(() => {
            node = {
                id: 7, title: 'KSampler', type: 'KSampler', mode: 0, pos: [0, 0], size: [200, 100],
                widgets: [
                    { name: 'steps', type: 'number', value: 20, options: { precision: 0 } },
                    { name: 'sampler_name', type: 'combo', value: 'euler', options: { values: ['euler', 'dpmpp_2m'] } }
                ],
                inputs: [], outputs: [], properties: {}
            };
            (window as any).app.canvas.graph = { _nodes: [node], getNodeById: () => node };
            (window as any).app.canvas.node_over = node;
            (mg as any).state = { active: true, x: 0, y: 0, canvasScale: 1 };
            window.comfyUIMagnifyGlass = mg as any;
            mountInfoPanel(asInstance(mg));
        });

        afterEach(() => {
            window.comfyUIMagnifyGlass = undefined;
        });

        it('renders only when something shown changes', () => {
            const render = vi.spyOn(panelManager().uiManager, 'renderContent');

            panelManager().updateInfo();
            const row = content().querySelector('.info-row');
            panelManager().updateInfo();
            panelManager().updateInfo();
            expect(render).toHaveBeenCalledTimes(1);
            expect(content().querySelector('.info-row')).toBe(row);

            node.widgets[0].value = 25; // edited on the canvas
            panelManager().updateInfo();
            expect(render).toHaveBeenCalledTimes(2);
            expect(content().textContent).toContain('25');

            node.mode = 4;
            panelManager().updateInfo();
            expect(render).toHaveBeenCalledTimes(3);

            node.inputs = [{ name: 'steps', type: 'INT', widget: { name: 'steps' }, link: 3 }];
            panelManager().updateInfo();
            expect(render).toHaveBeenCalledTimes(4);
            expect(content().querySelector('.linked-tag')).not.toBeNull();

            panelManager().stateManager.state.settings['🔍MagnifyGlass.InfoPanelPersist'] = true;
            panelManager().updateInfo();
            expect(render).toHaveBeenCalledTimes(5);
        });

        it('renders again after hide tears the controls down', () => {
            const render = vi.spyOn(panelManager().uiManager, 'renderContent');
            panelManager().updateInfo();

            panelManager().uiManager.hide();
            panelManager().updateInfo();

            expect(render).toHaveBeenCalledTimes(2);
        });

        it('shows each widget once, without guessed Model, Image or Text rows', () => {
            Object.assign(node, {
                title: 'Load VAE', type: 'VAELoader', mode: 4,
                widgets: [{ name: 'vae_name', type: 'combo', value: 'models/ae.safetensors', options: { values: ['models/ae.safetensors'] } }]
            });
            panelManager().updateInfo();

            const labels = [...content().querySelectorAll('.info-label')].map(label => label.textContent);
            expect(labels).toEqual(['vae_name']);
            expect(content().querySelector('.section-header')).toBeNull();
            expect(panelManager().informationGatherer.getDetailedNodeInfo(node).mode).toBe('Bypass');
        });

        it('keeps an open menu while values change', () => {
            panelManager().stateManager.state.settings['🔍MagnifyGlass.InfoPanelPersist'] = true;
            panelManager().updateInfo();
            const trigger = content().querySelector('.inline-dropdown-trigger') as HTMLElement;
            trigger.click();
            expect(document.querySelector('.custom-dropdown-menu')).not.toBeNull();

            node.widgets[0].value = 30;
            panelManager().updateInfo();
            expect(document.querySelector('.custom-dropdown-menu')).not.toBeNull();
            expect(content().querySelector('.inline-dropdown-trigger')).toBe(trigger);

            trigger.click(); // closes the menu
            panelManager().updateInfo();
            expect(content().textContent).toContain('30');
        });

        it('uses local fonts and never loads a web font', () => {
            const ui = panelManager().uiManager;
            const settings = panelManager().stateManager.state.settings;

            settings['🔍MagnifyGlass.InfoPanelFontFamily'] = 'Inter';
            ui.applyStyles();
            expect(ui.elements.panel!.style.fontFamily).toContain('Inter');

            settings['🔍MagnifyGlass.InfoPanelFontFamily'] = 'System Default';
            ui.applyStyles();
            expect(ui.elements.panel!.style.fontFamily).toBe('inherit');
            expect(document.querySelector('link[href*="fonts.googleapis"]')).toBeNull();
        });
    });

    describe('copy and formatting', () => {
        let node: any;
        let writeText: ReturnType<typeof vi.fn>;
        const panelManager = () => window.infoPanelManager!;
        const panel = () => panelManager().uiManager.elements.panel!;
        const row = (label: string) => [...panel().querySelectorAll('.info-row')].find(r => r.querySelector('.info-label')!.textContent === label) as HTMLElement;
        // The value text, without the Lock to edit hint
        const value = (label: string) => row(label).querySelector('.info-value')!.firstChild!.textContent;
        const flush = async () => { for (let i = 0; i < 3; i++) await Promise.resolve(); };

        beforeEach(() => {
            node = {
                id: 7, title: 'KSampler', type: 'KSampler', mode: 0, pos: [0, 0], size: [200, 100],
                widgets: [
                    { name: 'denoise', type: 'number', value: 0.0001, options: { precision: 4, step2: 0.0001 } },
                    { name: 'cfg', type: 'number', value: 8, options: { precision: 1 } },
                    { name: 'list', type: 'custom', value: [1, 2] },
                    { name: 'text', type: 'customtext', value: 'line\n'.repeat(6) }
                ],
                inputs: [], outputs: [], properties: {}
            };
            (window as any).app.canvas.graph = { _nodes: [node], getNodeById: () => node };
            (window as any).app.canvas.node_over = node;
            (window as any).app.extensionManager = { toast: { add: vi.fn() } };
            (mg as any).state = { active: true, x: 0, y: 0, canvasScale: 1 };
            window.comfyUIMagnifyGlass = mg as any;
            writeText = vi.fn(() => Promise.resolve());
            vi.stubGlobal('navigator', { clipboard: { writeText } });
            mountInfoPanel(asInstance(mg));
            panelManager().updateInfo();
        });

        afterEach(() => {
            window.comfyUIMagnifyGlass = undefined;
            delete (document as any).execCommand;
        });

        it('formats numbers with the widget precision and other values as JSON', () => {
            expect(value('denoise')).toBe('0.0001');
            expect(value('cfg')).toBe('8.0');
            expect(value('list')).toBe(JSON.stringify([1, 2], null, 2));
        });

        it('every value row and the title copy, with a check as feedback', async () => {
            const rows = panel().querySelectorAll('.info-row');
            expect(rows.length).toBeGreaterThan(0);
            rows.forEach(r => expect(r.querySelector('.copy-btn')).not.toBeNull());

            const titleCopy = panel().querySelector('.panel-header [data-action="copy"]') as HTMLButtonElement;
            titleCopy.click();
            await flush();
            expect(writeText).toHaveBeenLastCalledWith('KSampler #7');
            expect(titleCopy.classList.contains('copied')).toBe(true);
            vi.advanceTimersByTime(1500);
            expect(titleCopy.classList.contains('copied')).toBe(false);

            (row('denoise').querySelector('.copy-btn') as HTMLButtonElement).click();
            await flush();
            expect(writeText).toHaveBeenLastCalledWith('0.0001');
        });

        it('falls back to execCommand without the clipboard API, and says when copying fails', async () => {
            vi.stubGlobal('navigator', {});
            const execCommand = vi.fn(() => true);
            (document as any).execCommand = execCommand;
            const button = row('cfg').querySelector('.copy-btn') as HTMLButtonElement;

            button.click();
            await flush();
            expect(execCommand).toHaveBeenCalledWith('copy');
            expect(button.classList.contains('copied')).toBe(true);
            expect(document.querySelector('.copy-fallback')).toBeNull();
            expect((window as any).app.extensionManager.toast.add).not.toHaveBeenCalled();

            vi.advanceTimersByTime(1500);
            execCommand.mockReturnValue(false);
            button.click();
            await flush();
            expect(button.classList.contains('copied')).toBe(false);
            expect((window as any).app.extensionManager.toast.add).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }));
        });

        it('clamps long values with a toggle that a re-render keeps', () => {
            const text = row('text');
            expect(text.querySelector('.info-value')!.classList.contains('is-clamped')).toBe(true);
            expect(row('cfg').querySelector('.value-expand')).toBeNull();

            const toggle = text.querySelector('.value-expand') as HTMLButtonElement;
            toggle.click();
            expect(text.classList.contains('is-expanded')).toBe(true);
            expect(toggle.getAttribute('aria-expanded')).toBe('true');

            node.widgets[1].value = 9;
            panelManager().updateInfo();
            expect(value('cfg')).toBe('9.0');
            expect(row('text').classList.contains('is-expanded')).toBe(true);

            (row('text').querySelector('.value-expand') as HTMLButtonElement).click();
            expect(row('text').classList.contains('is-expanded')).toBe(false);
        });
    });

    describe('header and navigation', () => {
        let nodes: any[];
        let graph: any;
        const panelManager = () => window.infoPanelManager!;
        const panel = () => panelManager().uiManager.elements.panel!;
        const button = (action: string) => panel().querySelector(`[data-action="${action}"]`) as HTMLButtonElement;
        const shown = () => panel().querySelector('.header-title')!.textContent;
        const makeNode = (id: number, title: string, order?: number) => ({
            id, title, type: 'KSampler', order, mode: 0, pos: [0, 0], size: [200, 100],
            widgets: [], inputs: [], outputs: [], properties: {}
        });

        beforeEach(() => {
            nodes = [makeNode(1, 'Loader', 0), makeNode(2, 'Sampler', 1), makeNode(3, 'Decode', 2), makeNode(4, 'Note')];
            graph = { _nodes: nodes, getNodeById: (id: number) => nodes.find(n => n.id === id) ?? null };
            Object.assign((window as any).app.canvas, { graph, node_over: nodes[0], centerOnNode: vi.fn(), openSubgraph: vi.fn() });
            (mg as any).state = { active: true, x: 0, y: 0, canvasScale: 1 };
            window.comfyUIMagnifyGlass = mg as any;
            mountInfoPanel(asInstance(mg));
            panelManager().uiManager.show();
            panelManager().updateInfo();
        });

        afterEach(() => {
            window.comfyUIMagnifyGlass = undefined;
        });

        it('names the node in the header instead of Title and Location rows', () => {
            expect(panel().getAttribute('role')).toBe('region');
            expect(panel().getAttribute('aria-label')).toBeTruthy();
            expect(shown()).toBe('Loader');
            expect(panel().querySelector('.header-id')!.textContent).toBe('#1');
            const badge = panel().querySelector('.header-badge') as HTMLElement;
            expect(badge.textContent).toBe('KSampler');
            expect(badge.hidden).toBe(false);
            expect(panel().querySelector('.header-subtitle')).toBeNull();
            expect(panel().textContent).not.toContain('Focus Node');
            expect(panel().querySelector('[data-clickable]')).toBeNull();
            // The node section has no header to collapse it by
            expect(panel().querySelector('.section-header')).toBeNull();

            // A badge repeating the title is left out
            nodes[0].title = 'KSampler';
            panelManager().updateInfo();
            expect(badge.hidden).toBe(true);

            nodes[0].title = '<b>bold</b>';
            panelManager().updateInfo();
            expect(shown()).toBe('<b>bold</b>');
            expect(panel().querySelector('.header-title b')).toBeNull();
        });

        it('jumps centre the canvas and lock the node, which hovering does not clear', () => {
            button('next-node').click();

            expect((window as any).app.canvas.centerOnNode).toHaveBeenCalledWith(nodes[1]);
            expect(panelManager().stateManager.state.lockedNodeId).toBe(2);
            expect(shown()).toBe('Sampler');
            expect(button('lock-node').getAttribute('aria-pressed')).toBe('true');

            (window as any).app.canvas.node_over = nodes[2];
            panelManager().updateInfo();
            expect(shown()).toBe('Sampler');

            button('lock-node').click();
            expect(shown()).toBe('Decode');
            expect(button('lock-node').getAttribute('aria-pressed')).toBe('false');

            button('lock-node').click();
            (window as any).app.canvas.node_over = nodes[0];
            panelManager().updateInfo();
            expect(shown()).toBe('Decode');
        });

        it('Prev and Next follow execution order and wrap; Focus centres on the shown node', () => {
            button('prev-node').click();
            expect(shown()).toBe('Decode');
            button('next-node').click();
            expect(shown()).toBe('Loader');

            // A node without an order starts Next at the first node
            (window as any).app.canvas.node_over = nodes[3];
            button('lock-node').click();
            button('lock-node').click();
            expect(shown()).toBe('Note');
            button('next-node').click();
            expect(shown()).toBe('Loader');

            (window as any).app.canvas.centerOnNode.mockClear();
            button('focus-node').click();
            expect((window as any).app.canvas.centerOnNode).toHaveBeenCalledWith(nodes[0]);
        });

        it('Back and Forward walk the jumps', () => {
            expect(button('back').disabled).toBe(true);
            expect(button('forward').disabled).toBe(true);

            button('next-node').click();
            button('next-node').click();
            expect(shown()).toBe('Decode');

            button('back').click();
            expect(shown()).toBe('Sampler');
            button('back').click();
            expect(shown()).toBe('Loader');
            expect(button('back').disabled).toBe(true);

            button('forward').click();
            expect(shown()).toBe('Sampler');
            expect(button('forward').disabled).toBe(false);

            // A new jump drops what was ahead
            panelManager().uiManager.jumpToNode(4);
            expect(button('forward').disabled).toBe(true);
            button('back').click();
            expect(shown()).toBe('Sampler');

            // A new graph on screen releases the lock, whose id would be another node there, and starts over
            (window as any).app.canvas.graph = { ...graph };
            panelManager().updateInfo();
            expect(panelManager().stateManager.state.lockedNodeId).toBeNull();
            expect(shown()).toBe('Loader');
            expect(button('back').disabled).toBe(true);
        });

        it('a pick in the pop-out is a jump', () => {
            (mg.popOutManager.onNodeSelect as (id: number) => void)(3);

            expect((window as any).app.canvas.centerOnNode).toHaveBeenCalledWith(nodes[2]);
            expect(shown()).toBe('Decode');
            expect(button('back').disabled).toBe(false);
        });

        it('releases the lock when its node is deleted', () => {
            panelManager().uiManager.jumpToNode(3);
            nodes.splice(2, 1);

            panelManager().updateInfo();

            expect(panelManager().stateManager.state.lockedNodeId).toBeNull();
            expect(shown()).toBe('Loader');
        });

        it('shows the subgraph path and the group, and enters subgraph nodes', () => {
            const breadcrumb = panel().querySelector('.panel-breadcrumb') as HTMLElement;
            expect(breadcrumb.hidden).toBe(true);

            const root: any = { _nodes: [] };
            root.rootGraph = root;
            const inner: any = { name: '<i>Upscale</i>', rootGraph: root, _nodes: [] };
            const outer: any = { name: 'Refine', rootGraph: root, _nodes: [{ isSubgraphNode: () => true, subgraph: inner }] };
            root._nodes.push({ isSubgraphNode: () => false }, { isSubgraphNode: () => true, subgraph: outer });
            inner.getGroupOnPos = vi.fn(() => ({ title: 'Sampling' }));
            nodes[0].graph = inner;
            panelManager().updateInfo();

            expect(breadcrumb.hidden).toBe(false);
            expect([...breadcrumb.querySelectorAll('.crumb')].map(c => c.textContent)).toEqual(['Root', 'Refine', '<i>Upscale</i>']);
            expect(breadcrumb.querySelector('i')).toBeNull();
            expect(breadcrumb.querySelector('.crumb-group')!.textContent).toBe('Sampling');
            expect(breadcrumb.querySelector('.crumb[aria-current]')!.textContent).toBe('<i>Upscale</i>');
            // Looked up at the node centre
            expect(inner.getGroupOnPos).toHaveBeenCalledWith(100, 50);
            expect(button('enter-subgraph')).toBeNull();

            nodes[0].isSubgraphNode = () => true;
            nodes[0].subgraph = outer;
            panelManager().uiManager.jumpToNode(1);
            button('enter-subgraph').click();
            expect((window as any).app.canvas.openSubgraph).toHaveBeenCalledWith(outer, nodes[0]);
            expect(panelManager().stateManager.state.lockedNodeId).toBeNull();
        });

        it('double-clicking the header minimizes, but not on its buttons', () => {
            const header = panelManager().uiManager.elements.header!;
            header.querySelector('.header-title')!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            expect(panel().classList.contains('panel-minimized')).toBe(true);
            expect(button('minimize').getAttribute('aria-expanded')).toBe('false');
            expect(button('minimize').getAttribute('aria-label')).toBe('Expand Panel');

            button('lock-node').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
            expect(panel().classList.contains('panel-minimized')).toBe(true);
            button('minimize').click();
            expect(panel().classList.contains('panel-minimized')).toBe(false);
        });
    });

    describe('modes', () => {
        let nodes: any[];
        const panelManager = () => window.infoPanelManager!;
        const state = () => panelManager().stateManager.state;
        const panel = () => panelManager().uiManager.elements.panel!;
        const controls = () => panelManager().uiManager.elements.controls!;
        const tool = (action: string) => controls().querySelector(`[data-action="${action}"]`) as HTMLButtonElement;
        const shown = () => panel().querySelector('.header-title')!.textContent;
        const pointer = (target: Element, type: string, clientX: number, clientY: number) =>
            target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, clientX, clientY }));
        const makeNode = (id: number, title: string) => ({
            id, title, type: 'KSampler', order: id, mode: 0, pos: [0, 0], size: [200, 100],
            widgets: [{ name: 'steps', type: 'number', value: 20, options: { precision: 0, min: 1, max: 100, step: 10 } }],
            inputs: [], outputs: [], properties: {}
        });

        beforeEach(() => {
            nodes = [makeNode(1, 'Loader'), makeNode(2, 'Sampler')];
            const graph = { _nodes: nodes, getNodeById: (id: number) => nodes.find(n => n.id === id) ?? null };
            Object.assign((window as any).app.canvas, { graph, node_over: nodes[0], selected_nodes: {}, centerOnNode: vi.fn() });
            (mg as any).state = { active: true, x: 0, y: 0, canvasScale: 1 };
            (mg as any).config = { showCursorPreview: false };
            window.comfyUIMagnifyGlass = mg as any;
            mountInfoPanel(asInstance(mg));
            panelManager().uiManager.show();
            panelManager().updateInfo();
            vi.spyOn(panel(), 'getBoundingClientRect').mockReturnValue({ left: 50, top: 60, right: 350, bottom: 260, width: 300, height: 200 } as DOMRect);
        });

        afterEach(() => {
            window.comfyUIMagnifyGlass = undefined;
        });

        it('Sticky is saved from the button, the S key and the eye button', () => {
            const persist = '🔍MagnifyGlass.InfoPanelPersist';

            tool('persist').click();
            expect(settingsStore[persist]).toBe(true);
            expect(tool('persist').getAttribute('aria-pressed')).toBe('true');

            pressKey('s');
            expect(settingsStore[persist]).toBe(false);
            expect(tool('persist').getAttribute('aria-pressed')).toBe('false');

            pressKey('s');
            tool('toggle-panel').click(); // hiding the panel ends Sticky
            expect(state().isPanelVisible).toBe(false);
            expect(settingsStore[persist]).toBe(false);
            expect(state().settings[persist]).toBe(false);
        });

        it('Hold and its key are gone', () => {
            expect(pressKey('p').defaultPrevented).toBe(false);
            expect(DEFAULT_SETTINGS).not.toHaveProperty('🔍MagnifyGlass.HoldInfoHotkey');
            expect(tool('toggle-hold')).toBeNull();
            expect(state()).not.toHaveProperty('isInfoHeld');
        });

        it('editing needs Sticky, a lock or the selection; otherwise a row offers Lock to edit', () => {
            expect(panel().querySelector('.info-row.editable')).toBeNull();
            const hint = panel().querySelector('.edit-hint') as HTMLButtonElement;
            expect(hint.textContent).toBe('Lock to edit');

            hint.click();

            expect(state().lockedNodeId).toBe(1);
            expect(panel().querySelector('.info-row.editable')).not.toBeNull();
            expect(panel().querySelector('.edit-hint')).toBeNull();

            // The value opens its editor from the keyboard too
            const value = panel().querySelector('.info-row.editable .info-value') as HTMLElement;
            expect(value.tabIndex).toBe(0);
            expect(value.getAttribute('aria-label')).toBe('Edit steps');
            value.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
            expect(panel().querySelector('.info-row.editing input')!.getAttribute('aria-label')).toBe('steps');
        });

        it('Follow selection shows the first selected node, which a lock overrides and hover replaces when nothing is selected', () => {
            tool('follow-selection').click();
            expect(settingsStore['🔍MagnifyGlass.InfoPanelFollowSelection']).toBe(true);
            expect(shown()).toBe('Loader');

            // A click that selects without moving the mouse still updates the panel
            (window as any).app.canvas.selected_nodes = { 2: nodes[1] };
            document.dispatchEvent(new PointerEvent('pointerup'));
            vi.advanceTimersToNextFrame();
            expect(shown()).toBe('Sampler');
            expect(state().showsSelection).toBe(true);
            expect(panel().querySelector('.info-row.editable')).not.toBeNull();

            panelManager().uiManager.jumpToNode(1);
            expect(shown()).toBe('Loader');
            expect(state().showsSelection).toBe(false);
            panel().querySelector<HTMLButtonElement>('[data-action="lock-node"]')!.click();
            expect(shown()).toBe('Sampler');

            (window as any).app.canvas.selected_nodes = {};
            panelManager().updateInfo();
            expect(shown()).toBe('Loader');
            expect(panel().querySelector('.info-row.editable')).toBeNull();
        });

        it('dragging the header floats the panel 4px inside the window and saves it; a click leaves it', () => {
            const header = panelManager().uiManager.elements.header!;
            const title = header.querySelector('.header-title')!;
            const left = panel().style.left;

            pointer(title, 'pointerdown', 100, 100);
            pointer(document, 'pointerup', 100, 100);
            expect(state().isFloating).toBe(false);
            expect(panel().style.left).toBe(left);

            // Not from the header's buttons
            pointer(header.querySelector('[data-action="minimize"]')!, 'pointerdown', 100, 100);
            pointer(document, 'pointermove', 300, 300);
            expect(state().isFloating).toBe(false);
            pointer(document, 'pointerup', 300, 300);

            pointer(title, 'pointerdown', 100, 100);
            pointer(document, 'pointermove', 300, 200);
            expect(state().isFloating).toBe(true);
            expect(panel().style.left).toBe('250px');
            expect(panel().style.top).toBe('160px');
            expect(tool('float').getAttribute('aria-pressed')).toBe('true');

            pointer(document, 'pointermove', 5000, -500);
            expect(panel().style.left).toBe(`${window.innerWidth - 300 - 4}px`);
            expect(panel().style.top).toBe('4px');
            pointer(document, 'pointerup', 5000, -500);

            expect(JSON.parse(localStorage.getItem('comfyui_magnify_inspector_layout')!)).toMatchObject({ floating: true, y: 4 });
        });

        it('the corner handle resizes into the Width and Max Height settings', () => {
            const handle = panel().querySelector('.panel-resize')!;
            const content = panel().querySelector('.panel-content')!;
            // Content that reaches its cap
            Object.defineProperty(content, 'scrollHeight', { value: 500, configurable: true });

            pointer(handle, 'pointerdown', 400, 300);
            pointer(document, 'pointermove', 450, 600);
            expect(panel().style.width).toBe('350px');
            expect(panel().style.getPropertyValue('--panel-max-height')).toBe('300px');
            expect(settingsStore['🔍MagnifyGlass.InfoPanelWidth']).toBeUndefined();

            pointer(document, 'pointerup', 450, 600);
            expect(settingsStore['🔍MagnifyGlass.InfoPanelWidth']).toBe(350);
            expect(settingsStore['🔍MagnifyGlass.InfoPanelMaxHeight']).toBe(300);
            expect(state().isFloating).toBe(false);

            // A sideways drag leaves Max Height alone
            delete settingsStore['🔍MagnifyGlass.InfoPanelMaxHeight'];
            pointer(handle, 'pointerdown', 400, 300);
            pointer(document, 'pointermove', 500, 300);
            pointer(document, 'pointerup', 500, 300);
            expect(settingsStore['🔍MagnifyGlass.InfoPanelWidth']).toBe(400);
            expect(settingsStore['🔍MagnifyGlass.InfoPanelMaxHeight']).toBeUndefined();

            // Nor does a little vertical jitter
            pointer(handle, 'pointerdown', 400, 300);
            pointer(document, 'pointermove', 450, 301);
            pointer(document, 'pointerup', 450, 301);
            expect(settingsStore['🔍MagnifyGlass.InfoPanelMaxHeight']).toBeUndefined();

            // Content below its cap does not show Max Height, so a drag keeps it
            Object.defineProperty(content, 'scrollHeight', { value: 0 });
            pointer(handle, 'pointerdown', 400, 300);
            pointer(document, 'pointermove', 400, 200);
            pointer(document, 'pointerup', 400, 200);
            expect(settingsStore['🔍MagnifyGlass.InfoPanelMaxHeight']).toBeUndefined();
        });

        it('Float and Follow switch with the button and the U key; hiding the glass floats the panel where it is', () => {
            tool('float').click();
            expect(state().isFloating).toBe(true);
            pressKey('u');
            expect(state().isFloating).toBe(false);

            tool('toggle-glass').click();
            expect(mg.setGlassPreviewActive).toHaveBeenLastCalledWith(false);
            expect(state().isFloating).toBe(true);
            expect(state().floatPosition).toEqual({ x: 50, y: 60 });
            // A hidden glass cannot be followed
            expect(tool('float').disabled).toBe(true);
            pressKey('u');
            expect(state().isFloating).toBe(true);

            // Showing the glass again leaves the panel floating
            tool('toggle-glass').click();
            expect(state().isFloating).toBe(true);

            panelManager().resetPosition();
            expect(state().isFloating).toBe(false);
            expect(state().floatPosition).toBeNull();
            expect(tool('float').getAttribute('aria-pressed')).toBe('false');

            // A reset while the glass is hidden keeps the panel floating
            tool('toggle-glass').click();
            panelManager().resetPosition();
            expect(state().isFloating).toBe(true);
        });

        it('with the glass hidden the eye button keeps a shown panel, but can still show a hidden one', () => {
            tool('toggle-glass').click();
            expect(tool('toggle-panel').disabled).toBe(true);

            pressKey('i');
            expect(state().isPanelVisible).toBe(false);
            expect(tool('toggle-panel').disabled).toBe(false);
            expect(tool('toggle-panel').title).toBe('Show Panel (I)');
            tool('toggle-panel').click();
            expect(state().isPanelVisible).toBe(true);
        });

        it('Sticky looks its node up again, and drops it when another graph is on screen', () => {
            tool('persist').click();
            const canvas = (window as any).app.canvas;
            canvas.node_over = null;
            panelManager().updateInfo();
            expect(shown()).toBe('Loader');

            // An undo rebuilds the node objects
            nodes[0] = { ...nodes[0], title: 'Loader (undone)' };
            panelManager().updateInfo();
            expect(shown()).toBe('Loader (undone)');

            canvas.graph = { _nodes: [], getNodeById: () => nodes[0] };
            panelManager().updateInfo();
            expect(state().currentNodeId).toBeNull();
        });

        it('a reload keeps floating where it was and stays minimized', () => {
            localStorage.setItem('comfyui_magnify_inspector_layout', JSON.stringify({ floating: true, minimized: true, x: 200, y: 120 }));
            unmountInfoPanel(asInstance(mg));
            mountInfoPanel(asInstance(mg));
            panelManager().uiManager.show();
            panelManager().updateInfo();

            expect(panel().classList.contains('panel-minimized')).toBe(true);
            expect(panel().style.left).toBe('200px');
            expect(panel().style.top).toBe('120px');

            panel().querySelector<HTMLButtonElement>('[data-action="minimize"]')!.click();
            expect(JSON.parse(localStorage.getItem('comfyui_magnify_inspector_layout')!).minimized).toBe(false);
        });

        it('the toolbar keeps the same buttons, in groups, whatever the state', () => {
            const layout = () => [...controls().children].map(el => (el as HTMLElement).dataset.action ?? '|');
            const expected = ['float', 'persist', 'follow-selection', 'toggle-panel', '|', 'toggle-glass', 'toggle-cursor', 'drag-glass', 'reset-glass', '|', 'popout'];
            expect(layout()).toEqual(expected);

            tool('persist').click();
            tool('toggle-glass').click();
            panelManager().uiManager.hide();
            expect(layout()).toEqual(expected);
            expect([...controls().querySelectorAll('button')].every(b => b.style.display === '')).toBe(true);
            expect(tool('toggle-cursor').disabled).toBe(true);
            expect(tool('lock')).toBeNull();
        });

        it('toggle-cursor saves Show Cursor Preview', () => {
            tool('toggle-cursor').click();

            expect(settingsStore['🔍MagnifyGlass.ShowCursorPreview']).toBe(true);
            expect(tool('toggle-cursor').getAttribute('aria-pressed')).toBe('true');
        });

        it('places the toolbar for all 8 Controls Positions and flips a side without room', () => {
            const positionManager = panelManager().positionManager;
            Object.defineProperty(controls(), 'offsetWidth', { value: 40 });
            Object.defineProperty(controls(), 'offsetHeight', { value: 40 });
            const place = (position: string, x = 300) => {
                state().settings['🔍MagnifyGlass.ControlsPosition'] = position;
                panelManager().uiManager.updateControlsLayout(position);
                positionManager.cachedPanelPosition = { x, y: 300, width: 200, height: 100 };
                positionManager.positionFloatingControls(controls());
                return [controls().style.left, controls().style.top, controls().classList.contains('horizontal-layout')];
            };

            expect(place('left')).toEqual(['256px', '300px', false]);
            expect(place('right')).toEqual(['504px', '300px', false]);
            expect(place('top')).toEqual(['300px', '256px', true]);
            expect(place('top-left')).toEqual(['300px', '256px', true]);
            expect(place('top-right')).toEqual(['460px', '256px', true]);
            expect(place('bottom')).toEqual(['300px', '404px', true]);
            expect(place('bottom-left')).toEqual(['300px', '404px', true]);
            expect(place('bottom-right')).toEqual(['460px', '404px', true]);
            // No room on the left: beside the panel's right edge instead of over it
            expect(place('left', 10)).toEqual(['214px', '300px', false]);
        });
    });

    describe('styles', () => {
        const root = document.documentElement.style;

        it('carries no theme class and keeps the palette colours at the defaults', () => {
            mountInfoPanel(asInstance(mg));
            const { panel, controls } = window.infoPanelManager!.uiManager.elements;

            expect(panel!.className).toBe('magnify-info-panel');
            expect(controls!.className).toBe('floating-controls vertical-layout');
            expect(root.getPropertyValue('--mg-panel-fg')).toBe('');
            expect(root.getPropertyValue('--mg-panel-accent')).toBe('');
        });

        it('writes text and accent colours only when they differ from the defaults', () => {
            mountInfoPanel(asInstance(mg));
            const ui = window.infoPanelManager!.uiManager;
            const settings = window.infoPanelManager!.stateManager.state.settings;

            settings['🔍MagnifyGlass.InfoPanelAccentColor'] = '#ff0000';
            settings['🔍MagnifyGlass.InfoPanelTextColor'] = '#6B7280'; // the default, in another case
            ui.applyStyles();
            expect(root.getPropertyValue('--mg-panel-accent')).toBe('#ff0000');
            expect(root.getPropertyValue('--mg-panel-fg')).toBe('');

            settings['🔍MagnifyGlass.InfoPanelAccentColor'] = '#3b82f6';
            ui.applyStyles();
            expect(root.getPropertyValue('--mg-panel-accent')).toBe('');

            settings['🔍MagnifyGlass.InfoPanelAccentColor'] = '#ff0000';
            ui.applyStyles();
            unmountInfoPanel(asInstance(mg));
            expect(root.getPropertyValue('--mg-panel-accent')).toBe('');
        });

        it('applies opacity to the background only and max height to the content', () => {
            settingsStore['🔍MagnifyGlass.InfoPanelOpacity'] = 60;
            settingsStore['🔍MagnifyGlass.InfoPanelMaxHeight'] = 400;
            mountInfoPanel(asInstance(mg));
            const ui = window.infoPanelManager!.uiManager;
            ui.show();

            expect(ui.elements.panel!.style.getPropertyValue('--panel-opacity')).toBe('60%');
            expect(ui.elements.panel!.style.getPropertyValue('--panel-max-height')).toBe('400px');
            expect(ui.elements.panel!.style.opacity).toBe('');
        });

        it('loads High Contrast Text with the other panel settings', () => {
            settingsStore['🔍MagnifyGlass.HighContrastText'] = true;
            mountInfoPanel(asInstance(mg));

            expect(window.infoPanelManager!.uiManager.elements.panel!.classList.contains('high-contrast-text')).toBe(true);
        });

        it('starts hidden and takes no clicks before it is shown', () => {
            mountInfoPanel(asInstance(mg));
            const panel = window.infoPanelManager!.uiManager.elements.panel!;

            expect(panel.style.display).toBe('none');
            window.infoPanelManager!.uiManager.show();
            expect(panel.style.display).toBe('');
        });

        it('the highlight follows the cached setting and clips to the canvas', () => {
            // LiteGraph's bounds include the title bar above pos
            const node = { id: 3, getBounding: () => [0, -30, 100, 80] };
            const canvas = document.createElement('canvas');
            vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 } as DOMRect);
            Object.assign((window as any).app.canvas, { canvas, ds: { scale: 1, offset: [0, 0] }, graph: { getNodeById: () => node } });
            mountInfoPanel(asInstance(mg));
            const highlighter = window.infoPanelManager!.canvasHighlighter;
            const highlight = document.getElementById('magnify-glass-node-highlight')!;

            highlighter.setHighlightedNode(3);
            (window as any).app.canvas.onDrawForeground(null, []);
            expect(highlight.style.display).toBe('block');
            // The title bar sits above the canvas top here, so the top inset clips it
            expect(highlight.style.clipPath).toMatch(/^inset\(36px /);

            window.infoPanelManager!.stateManager.state.settings['🔍MagnifyGlass.NodeHighlightEnabled'] = false;
            (window as any).app.canvas.onDrawForeground(null, []);
            expect(highlight.style.display).toBe('none');
        });

        it('the highlight covers only the title of a collapsed node', () => {
            const node = { id: 3, pos: [100, 100], size: [300, 200], getBounding: () => [100, 70, 120, 30] };
            const canvas = document.createElement('canvas');
            vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 } as DOMRect);
            Object.assign((window as any).app.canvas, { canvas, ds: { scale: 2, offset: [0, 0] }, graph: { getNodeById: () => node } });
            mountInfoPanel(asInstance(mg));
            const highlight = document.getElementById('magnify-glass-node-highlight')!;

            window.infoPanelManager!.canvasHighlighter.setHighlightedNode(3);
            (window as any).app.canvas.onDrawForeground(null, []);

            expect([highlight.style.left, highlight.style.top, highlight.style.width, highlight.style.height]).toEqual(['194px', '134px', '252px', '72px']);
        });

        it('the highlight takes a collapsed Vue node from node.size, where Vue writes its DOM size', () => {
            (window as any).LiteGraph = { vueNodesMode: true, NODE_TITLE_HEIGHT: 30 };
            // LiteGraph's own pill is narrower than the collapsed Vue node
            const node = { id: 3, pos: [100, 100], size: [225, 8], getBounding: () => [100, 70, 120, 30] };
            const canvas = document.createElement('canvas');
            vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, right: 800, bottom: 600, width: 800, height: 600 } as DOMRect);
            Object.assign((window as any).app.canvas, { canvas, ds: { scale: 1, offset: [0, 0] }, graph: { getNodeById: () => node } });
            mountInfoPanel(asInstance(mg));
            const highlight = document.getElementById('magnify-glass-node-highlight')!;

            window.infoPanelManager!.canvasHighlighter.setHighlightedNode(3);
            (window as any).app.canvas.onDrawForeground(null, []);

            expect([highlight.style.left, highlight.style.top, highlight.style.width, highlight.style.height]).toEqual(['94px', '64px', '237px', '50px']);
            delete (window as any).LiteGraph;
        });
    });

    describe('registerPanelSettings', () => {
        const setEnabled = (on: boolean) => on ? mountInfoPanel(asInstance(mg)) : unmountInfoPanel(asInstance(mg));
        const registeredIds = () => addSetting.mock.calls.map(([setting]) => setting.id);

        it('registers every setting and builds nothing when disabled', () => {
            settingsStore['🔍MagnifyGlass.InfoPanelEnabled'] = false;
            registerPanelSettings(setEnabled);

            expect(registeredIds()).toEqual([
                '🔍MagnifyGlass.InfoPanelPosition',
                '🔍MagnifyGlass.InfoPanelPersist',
                '🔍MagnifyGlass.InfoPanelFollowSelection',
                '🔍MagnifyGlass.NodeHighlightEnabled',
                '🔍MagnifyGlass.ShowHoveringControls',
                '🔍MagnifyGlass.InfoPanelWidth',
                '🔍MagnifyGlass.InfoPanelMaxHeight',
                '🔍MagnifyGlass.InfoPanelOpacity',
                '🔍MagnifyGlass.InfoPanelFontSize',
                '🔍MagnifyGlass.InfoPanelFontFamily',
                '🔍MagnifyGlass.InfoPanelTextColor',
                '🔍MagnifyGlass.InfoPanelAccentColor',
                '🔍MagnifyGlass.HighContrastText',
                '🔍MagnifyGlass.InfoPanelEnabled'
            ]);
            expect(document.getElementById(INFO_PANEL_ID)).toBeNull();
            expect(window.infoPanelManager).toBeUndefined();
            expect(mg.updateMagnifiedView).toBe(FakeGlass.prototype.updateMagnifiedView);
            expect(vi.getTimerCount()).toBe(0);
        });

        it('mounts the panel when enabled', () => {
            registerPanelSettings(setEnabled);

            expect(window.infoPanelManager).toBeInstanceOf(InfoPanel);
            expect(document.getElementById(INFO_PANEL_ID)).not.toBeNull();
        });

        it('the Sticky and Follow selection settings update the toolbar', () => {
            registerPanelSettings(setEnabled);
            const onChange = (id: string) => addSetting.mock.calls.find(([s]) => s.id === id)![0].onChange!;
            const tool = (action: string) => window.infoPanelManager!.uiManager.elements.controls!.querySelector(`[data-action="${action}"]`)!;

            onChange('🔍MagnifyGlass.InfoPanelPersist')(true);
            onChange('🔍MagnifyGlass.InfoPanelFollowSelection')(true);

            expect(tool('persist').getAttribute('aria-pressed')).toBe('true');
            expect(tool('follow-selection').getAttribute('aria-pressed')).toBe('true');
            expect(window.infoPanelManager!.stateManager.state.settings['🔍MagnifyGlass.InfoPanelFollowSelection']).toBe(true);
        });

        it('setting handlers update the mounted panel', () => {
            registerPanelSettings(setEnabled);
            const width = addSetting.mock.calls.find(([s]) => s.id === '🔍MagnifyGlass.InfoPanelWidth')![0];

            width.onChange!(420);

            expect(window.infoPanelManager!.stateManager.state.settings['🔍MagnifyGlass.InfoPanelWidth']).toBe(420);
        });
    });
});
