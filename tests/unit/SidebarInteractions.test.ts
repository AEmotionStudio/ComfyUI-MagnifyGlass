import { describe, it, expect, vi } from 'vitest';
import { renderSettingsPanel } from '../../src/sidebar/SidebarSettings';

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
});
