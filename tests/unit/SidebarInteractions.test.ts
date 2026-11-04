import { describe, it, expect, vi } from 'vitest';
import { renderSettingsPanel } from '../../src/sidebar/SidebarSettings';
// @ts-ignore
import { app } from '/scripts/app.js';

// Mock the app module imported by utils.ts
vi.mock('/scripts/app.js', () => ({
    app: {
        ui: {
            settings: {
                getSettingValue: vi.fn(),
                setSettingValue: vi.fn()
            }
        }
    }
}));

// Mock window globals
(global as any).comfyUIMagnifyGlass = {
    config: {},
    state: { active: false },
    updateMagnifiedView: vi.fn(),
    applyUiChanges: vi.fn(),
    resetOffsets: vi.fn()
};

(global as any).infoPanelManager = {
    stateManager: { state: { settings: {} } },
    uiManager: {
        updateControlStates: vi.fn(),
        applyStyles: vi.fn(),
        updateControlsLayout: vi.fn(),
        show: vi.fn()
    },
    positionManager: {
        positionPanel: vi.fn(),
        positionFloatingControls: vi.fn()
    }
};

const sectionByTitle = (container: HTMLElement, title: string) =>
    Array.from(container.querySelectorAll<HTMLElement>('.magnify-sidebar-section'))
        .find(section => section.firstElementChild?.textContent?.trim() === title)!;

const toggleByLabel = (root: HTMLElement, label: string) =>
    Array.from(root.querySelectorAll('.magnify-toggle-row'))
        .find(row => row.querySelector('label')?.textContent === label)
        ?.querySelector('.magnify-toggle') as HTMLElement | undefined;

describe('Sidebar Interactions', () => {
    it('should sync aria-checked when Require Alt Key is toggled', () => {
        const container = document.createElement('div');
        renderSettingsPanel(container);

        // Find all "Require Alt Key" toggles
        const altToggles = Array.from(container.querySelectorAll('.magnify-alt-toggle .magnify-toggle'));
        expect(altToggles.length).toBeGreaterThan(1); // Should have at least 2 instances

        const firstToggle = altToggles[0] as HTMLElement;
        const secondToggle = altToggles[1] as HTMLElement;

        // Click the first toggle
        firstToggle.click();

        // Check if both toggles updated their aria-checked attribute
        expect(firstToggle.classList.contains('active')).toBe(true);
        expect(firstToggle.getAttribute('aria-checked')).toBe('true');

        expect(secondToggle.classList.contains('active')).toBe(true);
        expect(secondToggle.getAttribute('aria-checked')).toBe('true');

        // Toggle back off
        firstToggle.click();

        expect(firstToggle.classList.contains('active')).toBe(false);
        expect(firstToggle.getAttribute('aria-checked')).toBe('false');

        expect(secondToggle.classList.contains('active')).toBe(false);
        expect(secondToggle.getAttribute('aria-checked')).toBe('false');
    });

    it('should update aria-checked for Follow Cursor when Reset Position is clicked', () => {
        const container = document.createElement('div');
        renderSettingsPanel(container);

        // Find Follow Cursor toggle
        let followToggle: HTMLElement | null = null;
        const toggleRows = container.querySelectorAll('.magnify-toggle-row');
        toggleRows.forEach(row => {
            const label = row.querySelector('label');
            if (label && label.textContent === 'Follow Cursor') {
                followToggle = row.querySelector('.magnify-toggle') as HTMLElement;
            }
        });

        expect(followToggle).toBeTruthy();
        if (!followToggle) return;

        // Manually activate it first
        followToggle.click();
        expect(followToggle.classList.contains('active')).toBe(true);
        expect(followToggle.getAttribute('aria-checked')).toBe('true');

        // Find Reset Position button
        const resetBtn = Array.from(container.querySelectorAll('button')).find(
            btn => btn.textContent?.includes('Reset Position')
        ) as HTMLButtonElement;

        expect(resetBtn).toBeTruthy();

        // Click reset
        resetBtn.click();

        // Verify Follow Cursor toggle is deactivated and aria-checked is false
        expect(followToggle.classList.contains('active')).toBe(false);
        expect(followToggle.getAttribute('aria-checked')).toBe('false');
    });

    describe('Inspector panel toggle', () => {
        it('sits at the top and switches the panel setting and sections', () => {
            vi.mocked(app.ui.settings.setSettingValue).mockClear();
            const container = document.createElement('div');
            renderSettingsPanel(container);

            const toggle = container.firstElementChild!.querySelector('.magnify-toggle') as HTMLElement;
            expect(container.firstElementChild!.querySelector('label')!.textContent).toBe('Inspector panel');
            expect(toggle.getAttribute('aria-checked')).toBe('true');

            const panelSection = sectionByTitle(container, 'Info Panel');
            const panelHotkeys = sectionByTitle(container, 'Panel Hotkeys');
            expect(panelSection.hidden).toBe(false);
            expect(panelHotkeys.hidden).toBe(false);

            toggle.click();
            expect(app.ui.settings.setSettingValue).toHaveBeenLastCalledWith('🔍MagnifyGlass.InfoPanelEnabled', false);
            expect(panelSection.hidden).toBe(true);
            expect(panelHotkeys.hidden).toBe(true);
            expect(sectionByTitle(container, 'Glass Hotkeys').hidden).toBe(false);

            toggle.click();
            expect(app.ui.settings.setSettingValue).toHaveBeenLastCalledWith('🔍MagnifyGlass.InfoPanelEnabled', true);
            expect(panelSection.hidden).toBe(false);
            expect(panelHotkeys.hidden).toBe(false);
        });

        it('hides the panel sections when the panel is off', () => {
            vi.mocked(app.ui.settings.getSettingValue).mockImplementation(
                (key: string) => key === '🔍MagnifyGlass.InfoPanelEnabled' ? false : undefined
            );
            const container = document.createElement('div');
            renderSettingsPanel(container);
            vi.mocked(app.ui.settings.getSettingValue).mockReset();

            const toggle = container.firstElementChild!.querySelector('.magnify-toggle') as HTMLElement;
            expect(toggle.getAttribute('aria-checked')).toBe('false');
            expect(sectionByTitle(container, 'Info Panel').hidden).toBe(true);
            expect(sectionByTitle(container, 'Panel Hotkeys').hidden).toBe(true);
        });

        it('replaces the old Enable Panel toggle and keeps Glass Toggle Key with the glass hotkeys', () => {
            const container = document.createElement('div');
            renderSettingsPanel(container);

            expect(toggleByLabel(container, 'Enable Panel')).toBeUndefined();
            const labels = (title: string) =>
                Array.from(sectionByTitle(container, title).querySelectorAll('label')).map(l => l.textContent);
            expect(labels('Glass Hotkeys')).toContain('Glass Toggle Key');
            expect(labels('Panel Hotkeys')).not.toContain('Glass Toggle Key');
        });
    });
});
