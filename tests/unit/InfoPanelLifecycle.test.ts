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
import { StateManager } from '../../src/info-panel/StateManager';
import { registerPanelSettings } from '../../src/shared/settings';
import { INFO_PANEL_ID } from '../../src/shared/constants';
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
        updateTheme: vi.fn(),
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

const pressKey = (key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
    document.dispatchEvent(event);
    return event;
};

describe('Info Panel lifecycle', () => {
    let mg: FakeGlass;
    let mql: { addEventListener: ReturnType<typeof vi.fn>; removeEventListener: ReturnType<typeof vi.fn> };

    beforeEach(() => {
        vi.useFakeTimers();
        // Keep happy-dom from fetching the panel stylesheet
        document.head.innerHTML = '<style id="magnify-info-panel-styles-v2"></style>';
        for (const key of Object.keys(settingsStore)) delete settingsStore[key];
        addSetting.mockClear();
        (window as any).app = { canvas: { onDrawForeground: null, setDirty: vi.fn() }, graph: null };
        mql = { addEventListener: vi.fn(), removeEventListener: vi.fn() };
        vi.spyOn(window, 'matchMedia').mockReturnValue(mql as unknown as MediaQueryList);
        mg = new FakeGlass();
    });

    afterEach(() => {
        unmountInfoPanel(asInstance(mg));
        window.comfyUIMagnifyGlassExtensions = undefined;
        vi.restoreAllMocks();
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
        const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');

        mountInfoPanel(asInstance(mg));
        expect(vi.getTimerCount()).toBeGreaterThan(0);
        mg.state.active = true;
        mg.updateMagnifiedView(); // schedules an info update frame
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
        expect(mql.removeEventListener).toHaveBeenCalledWith('change', mql.addEventListener.mock.calls[0][1]);
        expect(disconnect).toHaveBeenCalled();
        // Theme interval, 1s theme check and the pending info update frame are all gone
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
        const pin = vi.spyOn(StateManager.prototype, 'togglePinning');
        mountInfoPanel(asInstance(mg));

        pressKey('u');

        expect(pin).toHaveBeenCalledTimes(1);
        expect(document.querySelectorAll(`#${INFO_PANEL_ID}`)).toHaveLength(1);
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
                '🔍MagnifyGlass.NodeHighlightEnabled',
                '🔍MagnifyGlass.ShowInspectorTab',
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

        it('setting handlers update the mounted panel', () => {
            registerPanelSettings(setEnabled);
            const width = addSetting.mock.calls.find(([s]) => s.id === '🔍MagnifyGlass.InfoPanelWidth')![0];

            width.onChange!(420);

            expect(window.infoPanelManager!.stateManager.state.settings['🔍MagnifyGlass.InfoPanelWidth']).toBe(420);
        });
    });
});
