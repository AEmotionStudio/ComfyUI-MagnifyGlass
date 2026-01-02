/**
 * ComfyUI MagnifyGlass - Sidebar Settings Panel
 * 
 * All settings controls for the sidebar.
 */

// @ts-ignore
import { app } from "/scripts/app.js";
import {
    GLASS_POSITIONS,
    GLASS_SHAPES,
    ACTIVATION_KEYS,
    RESET_KEYS,
    TOGGLE_FOLLOW_KEYS,
    PANEL_POSITIONS
} from '../shared/constants';

/**
 * Icons for the settings panel
 */
const Icons = {
    chevronDown: `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`,
    reset: `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path></svg>`,
};

/**
 * Create a slider control with tooltip
 */
/**
 * Create a slider control with tooltip
 */
function createSlider(
    label: string,
    value: number,
    min: number,
    max: number,
    step: number,
    unit: string,
    onChange: (value: number) => void,
    tooltip?: string,
    onInput?: (value: number) => void
): HTMLElement {
    const row = document.createElement('div');
    row.className = 'magnify-control-row';
    if (tooltip) row.title = tooltip;

    const labelRow = document.createElement('div');
    labelRow.className = 'magnify-control-label-row';

    const labelEl = document.createElement('label');
    labelEl.textContent = label;

    const valueEl = document.createElement('span');
    valueEl.className = 'control-value';
    valueEl.textContent = `${value}${unit}`;

    labelRow.appendChild(labelEl);
    labelRow.appendChild(valueEl);

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'magnify-slider';
    slider.min = String(min);
    slider.max = String(max);
    slider.step = String(step);
    slider.value = String(value);

    // Prevent ComfyUI from capturing mouse events during drag
    slider.addEventListener('mousedown', (e) => e.stopPropagation());
    slider.addEventListener('touchstart', (e) => e.stopPropagation());
    slider.addEventListener('pointerdown', (e) => e.stopPropagation());

    slider.addEventListener('input', (e) => {
        e.stopPropagation();
        const newValue = parseFloat(slider.value);
        valueEl.textContent = `${newValue}${unit}`;
        if (onInput) onInput(newValue);
    });

    slider.addEventListener('change', (e) => {
        e.stopPropagation();
        const newValue = parseFloat(slider.value);
        onChange(newValue);
    });

    row.appendChild(labelRow);
    row.appendChild(slider);

    return row;
}

/**
 * Create a toggle control with tooltip
 */
function createToggle(
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
    tooltip?: string
): HTMLElement {
    const row = document.createElement('div');
    row.className = 'magnify-toggle-row';
    if (tooltip) row.title = tooltip;

    const labelEl = document.createElement('label');
    labelEl.textContent = label;

    const toggle = document.createElement('div');
    toggle.className = `magnify-toggle${checked ? ' active' : ''}`;

    toggle.addEventListener('click', () => {
        const isActive = toggle.classList.toggle('active');
        onChange(isActive);
    });

    row.appendChild(labelEl);
    row.appendChild(toggle);

    return row;
}

/**
 * Create a select dropdown control with tooltip
 */
function createSelect(
    label: string,
    value: string,
    options: readonly string[] | string[],
    onChange: (value: string) => void,
    tooltip?: string,
    onInput?: (value: string) => void
): HTMLElement {
    const row = document.createElement('div');
    row.className = 'magnify-control-row';
    if (tooltip) row.title = tooltip;

    const labelEl = document.createElement('label');
    labelEl.textContent = label;

    const select = document.createElement('select');
    select.className = 'magnify-select';

    options.forEach(opt => {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (opt === value) option.selected = true;
        select.appendChild(option);
    });

    select.addEventListener('change', () => {
        // Call onInput first for live preview
        if (onInput) {
            onInput(select.value);
        }
        // Then persist the setting
        onChange(select.value);
    });

    row.appendChild(labelEl);
    row.appendChild(select);

    return row;
}

/**
 * Create a color picker control with tooltip
 */
/**
 * Create a color picker control with tooltip
 */
function createColorPicker(
    label: string,
    value: string,
    onChange: (value: string) => void,
    tooltip?: string,
    onInput?: (value: string) => void
): HTMLElement {
    const row = document.createElement('div');
    row.className = 'magnify-control-row magnify-color-row';
    if (tooltip) row.title = tooltip;

    const labelEl = document.createElement('label');
    labelEl.textContent = label;

    const colorWrapper = document.createElement('div');
    colorWrapper.className = 'magnify-color-wrapper';

    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.className = 'magnify-color-input';
    colorInput.value = value;

    const colorPreview = document.createElement('span');
    colorPreview.className = 'magnify-color-preview';
    colorPreview.textContent = value;

    colorInput.addEventListener('input', () => {
        colorPreview.textContent = colorInput.value;
        if (onInput) onInput(colorInput.value);
    });

    colorInput.addEventListener('change', () => {
        onChange(colorInput.value);
    });

    colorWrapper.appendChild(colorInput);
    colorWrapper.appendChild(colorPreview);

    row.appendChild(labelEl);
    row.appendChild(colorWrapper);

    return row;
}

/**
 * Get current MagnifyGlass settings from app.ui.settings
 */
function getSettingValue(id: string, defaultValue: any): any {
    try {
        const value = app.ui.settings.getSettingValue(id);
        return value !== undefined ? value : defaultValue;
    } catch {
        return defaultValue;
    }
}

/**
 * Set a MagnifyGlass setting via app.ui.settings
 */
function setSettingValue(id: string, value: any): void {
    try {
        app.ui.settings.setSettingValue(id, value);
    } catch (e) {
        console.warn(`Failed to set setting ${id}:`, e);
    }
}

/** Storage key for section states */
const SECTION_STATE_KEY = 'magnifyglass-sidebar-sections';

/**
 * Get saved section states from localStorage
 */
function getSectionStates(): Record<string, boolean> {
    try {
        const saved = localStorage.getItem(SECTION_STATE_KEY);
        return saved ? JSON.parse(saved) : {};
    } catch {
        return {};
    }
}

/**
 * Save section state to localStorage
 */
function saveSectionState(title: string, collapsed: boolean): void {
    try {
        const states = getSectionStates();
        states[title] = collapsed;
        localStorage.setItem(SECTION_STATE_KEY, JSON.stringify(states));
    } catch {
        // Ignore storage errors
    }
}

/**
 * Create a collapsible section with persistent state
 */
function createSection(title: string, defaultCollapsed: boolean = false): { section: HTMLElement; body: HTMLElement } {
    const section = document.createElement('div');
    section.className = 'magnify-sidebar-section';

    // Check if we have a saved state for this section
    const savedStates = getSectionStates();
    const collapsed = savedStates[title] !== undefined ? savedStates[title] : defaultCollapsed;

    const header = document.createElement('div');
    header.className = `magnify-sidebar-section-header${collapsed ? ' collapsed' : ''}`;
    header.innerHTML = `${Icons.chevronDown}<span>${title}</span>`;

    const body = document.createElement('div');
    body.className = `magnify-sidebar-section-body${collapsed ? ' collapsed' : ''}`;

    header.addEventListener('click', () => {
        const isCollapsed = header.classList.toggle('collapsed');
        body.classList.toggle('collapsed');
        // Save the new state
        saveSectionState(title, isCollapsed);
    });

    section.appendChild(header);
    section.appendChild(body);

    return { section, body };
}

/**
 * Render the settings panel into the container
 */
export function renderSettingsPanel(container: HTMLElement): void {
    // Get current hotkey values for tooltips
    const activationKey = getSettingValue('🔍MagnifyGlass.ActivationKey', 'x').toUpperCase();
    const resetKey = getSettingValue('🔍MagnifyGlass.ResetKey', 'o').toUpperCase();
    const toggleFollowKey = getSettingValue('🔍MagnifyGlass.ToggleFollowCursorKey', 'h').toUpperCase();

    // ===== Glass Settings Section =====
    const glassSection = createSection('Glass Settings');

    glassSection.body.appendChild(createSlider('Zoom Factor',
        getSettingValue('🔍MagnifyGlass.ZoomFactor', 300), 100, 1000, 25, '%',
        (value) => setSettingValue('🔍MagnifyGlass.ZoomFactor', value),
        'Magnification level of the glass (100-1000%)',
        (value) => {
            const mg = (window as any).comfyUIMagnifyGlass;
            if (mg?.config) {
                mg.config.zoomFactor = value / 100;
                if (mg.state.active) mg.updateMagnifiedView();
            }
        }
    ));

    glassSection.body.appendChild(createSlider('Glass Size',
        getSettingValue('🔍MagnifyGlass.GlassSize', 250), 50, 500, 10, 'px',
        (value) => setSettingValue('🔍MagnifyGlass.GlassSize', value),
        'Size of the magnifying glass in pixels',
        (value) => {
            const mg = (window as any).comfyUIMagnifyGlass;
            if (mg?.config) {
                mg.config.glassSize = value;
                mg.applyUiChanges();
                if (mg.state.active) mg.updateMagnifiedView();
            }
        }
    ));

    glassSection.body.appendChild(createSelect('Shape',
        getSettingValue('🔍MagnifyGlass.GlassShape', 'Rounded Square'), GLASS_SHAPES,
        (value) => setSettingValue('🔍MagnifyGlass.GlassShape', value),
        'Shape of the magnifying glass'
    ));

    glassSection.body.appendChild(createSelect('Position',
        getSettingValue('🔍MagnifyGlass.GlassPosition', 'Top-Right'), GLASS_POSITIONS,
        (value) => setSettingValue('🔍MagnifyGlass.GlassPosition', value),
        `Default position of the glass. Press ${resetKey} to reset.`
    ));

    glassSection.body.appendChild(createSelect('Filtering',
        getSettingValue('🔍MagnifyGlass.TextureFiltering', 'Linear'), ['Linear', 'Nearest'],
        (value) => setSettingValue('🔍MagnifyGlass.TextureFiltering', value),
        'Texture filtering: Linear (smooth) or Nearest (pixelated)'
    ));

    glassSection.body.appendChild(createSlider('Border Width',
        getSettingValue('🔍MagnifyGlass.BorderWidth', 2), 0, 10, 0.5, 'px',
        (value) => setSettingValue('🔍MagnifyGlass.BorderWidth', value),
        'Width of the glass border in pixels',
        (value) => {
            const mg = (window as any).comfyUIMagnifyGlass;
            if (mg?.config) {
                mg.config.borderWidth = value;
                mg.applyUiChanges();
            }
        }
    ));

    glassSection.body.appendChild(createColorPicker('Border Color',
        getSettingValue('🔍MagnifyGlass.BorderColor', '#ffffff'),
        (value) => setSettingValue('🔍MagnifyGlass.BorderColor', value),
        'Color of the glass border',
        (value) => {
            const mg = (window as any).comfyUIMagnifyGlass;
            if (mg?.config) {
                mg.config.borderColor = value;
                mg.applyUiChanges();
            }
        }
    ));

    glassSection.body.appendChild(createToggle('Show Border',
        getSettingValue('🔍MagnifyGlass.BorderEnabled', true),
        (checked) => setSettingValue('🔍MagnifyGlass.BorderEnabled', checked),
        'Show or hide the glass border'
    ));

    glassSection.body.appendChild(createToggle('Follow Cursor',
        getSettingValue('🔍MagnifyGlass.FollowCursor', false),
        (checked) => setSettingValue('🔍MagnifyGlass.FollowCursor', checked),
        `Glass follows the cursor. Hotkey: ${toggleFollowKey}`
    ));

    glassSection.body.appendChild(createToggle('Always Active Mode',
        getSettingValue('🔍MagnifyGlass.AlwaysActiveMode', true),
        (checked) => setSettingValue('🔍MagnifyGlass.AlwaysActiveMode', checked),
        `When enabled, glass stays visible. Toggle with ${activationKey}`
    ));

    container.appendChild(glassSection.section);

    // ===== Hotkeys Section =====
    const hotkeySection = createSection('Hotkeys', true);

    hotkeySection.body.appendChild(createSelect('Activation Key',
        getSettingValue('🔍MagnifyGlass.ActivationKey', 'x'), ACTIVATION_KEYS,
        (value) => setSettingValue('🔍MagnifyGlass.ActivationKey', value),
        'Key to toggle or hold to activate the magnifying glass'
    ));

    hotkeySection.body.appendChild(createSelect('Reset Key',
        getSettingValue('🔍MagnifyGlass.ResetKey', 'o'), RESET_KEYS,
        (value) => setSettingValue('🔍MagnifyGlass.ResetKey', value),
        'Key to reset glass position and disable follow cursor'
    ));

    hotkeySection.body.appendChild(createSelect('Toggle Follow Key',
        getSettingValue('🔍MagnifyGlass.ToggleFollowCursorKey', 'h'), TOGGLE_FOLLOW_KEYS,
        (value) => setSettingValue('🔍MagnifyGlass.ToggleFollowCursorKey', value),
        'Key to toggle follow cursor mode'
    ));

    hotkeySection.body.appendChild(createToggle('Require Alt Key',
        getSettingValue('🔍MagnifyGlass.AltRequired', false),
        (checked) => setSettingValue('🔍MagnifyGlass.AltRequired', checked),
        'Require Alt key to be held with activation key'
    ));

    hotkeySection.body.appendChild(createSlider('Offset Step',
        getSettingValue('🔍MagnifyGlass.OffsetStep', 10), 1, 50, 1, 'px',
        (value) => setSettingValue('🔍MagnifyGlass.OffsetStep', value),
        'Amount to move glass per arrow key press (pixels)'
    ));

    container.appendChild(hotkeySection.section);

    // ===== Info Panel Section =====
    const panelSection = createSection('Info Panel', true);

    const toggleHotkey = getSettingValue('🔍MagnifyGlass.ToggleHotkey', 'i').toUpperCase();
    const glassToggleKey = getSettingValue('🔍MagnifyGlass.GlassPreviewToggleHotkey', 'g').toUpperCase();
    const pinHotkeyVal = getSettingValue('🔍MagnifyGlass.PinPanelHotkey', 'u').toUpperCase();

    panelSection.body.appendChild(createToggle('Enable Panel',
        getSettingValue('🔍MagnifyGlass.InfoPanelEnabled', true),
        (checked) => setSettingValue('🔍MagnifyGlass.InfoPanelEnabled', checked),
        `Show info panel with node details. Toggle: ${toggleHotkey}`
    ));

    panelSection.body.appendChild(createSelect('Position',
        getSettingValue('🔍MagnifyGlass.InfoPanelPosition', 'Bottom'), PANEL_POSITIONS,
        (value) => setSettingValue('🔍MagnifyGlass.InfoPanelPosition', value),
        'Position of the info panel relative to the glass'
    ));

    panelSection.body.appendChild(createSlider('Width',
        getSettingValue('🔍MagnifyGlass.InfoPanelWidth', 300), 200, 600, 20, 'px',
        (value) => setSettingValue('🔍MagnifyGlass.InfoPanelWidth', value),
        'Width of the info panel',
        (value) => {
            const infoPanel = (window as any).infoPanelManager;
            if (infoPanel?.stateManager?.state?.settings) {
                infoPanel.stateManager.state.settings['🔍MagnifyGlass.InfoPanelWidth'] = value;
                infoPanel.uiManager.applyStyles();

                // Ensure visible and reflow if active
                if (infoPanel.magnifyGlass.state.active) {
                    infoPanel.uiManager.show();
                    infoPanel.positionManager.positionPanel();
                }
            }
        }
    ));

    panelSection.body.appendChild(createSlider('Max Height',
        getSettingValue('🔍MagnifyGlass.InfoPanelMaxHeight', 300), 200, 1500, 50, 'px',
        (value) => setSettingValue('🔍MagnifyGlass.InfoPanelMaxHeight', value),
        'Maximum height of the info panel',
        (value) => {
            console.log('[MaxHeight] Handler called with value:', value);
            const infoPanel = (window as any).infoPanelManager;
            console.log('[MaxHeight] infoPanelManager:', infoPanel ? 'found' : 'NOT FOUND');
            if (infoPanel?.stateManager?.state?.settings) {
                console.log('[MaxHeight] Updating setting and calling applyStyles');
                infoPanel.stateManager.state.settings['🔍MagnifyGlass.InfoPanelMaxHeight'] = value;
                infoPanel.uiManager.applyStyles();

                // Ensure visible and reflow if active
                if (infoPanel.magnifyGlass.state.active) {
                    console.log('[MaxHeight] Glass is active, calling show() and positionPanel()');
                    infoPanel.uiManager.show();
                    infoPanel.positionManager.positionPanel();
                } else {
                    console.log('[MaxHeight] Glass is NOT active, skipping show()');
                }
            } else {
                console.warn('[MaxHeight] Check failed - stateManager/state/settings missing');
            }
        }
    ));

    panelSection.body.appendChild(createSlider('Font Size',
        getSettingValue('🔍MagnifyGlass.InfoPanelFontSize', 14), 8, 24, 1, 'px',
        (value) => setSettingValue('🔍MagnifyGlass.InfoPanelFontSize', value),
        'Font size of text in the info panel',
        (value) => {
            const infoPanel = (window as any).infoPanelManager;
            if (infoPanel?.stateManager?.state?.settings) {
                infoPanel.stateManager.state.settings['🔍MagnifyGlass.InfoPanelFontSize'] = value;
                infoPanel.uiManager.applyStyles();
            }
        }
    ));

    panelSection.body.appendChild(createSlider('Opacity',
        getSettingValue('🔍MagnifyGlass.InfoPanelOpacity', 95), 10, 100, 5, '%',
        (value) => setSettingValue('🔍MagnifyGlass.InfoPanelOpacity', value),
        'Background opacity of the info panel',
        (value) => {
            const infoPanel = (window as any).infoPanelManager;
            if (infoPanel?.stateManager?.state?.settings) {
                infoPanel.stateManager.state.settings['🔍MagnifyGlass.InfoPanelOpacity'] = value;
                infoPanel.uiManager.applyStyles();
            }
        }
    ));

    panelSection.body.appendChild(createColorPicker('Text Color',
        getSettingValue('🔍MagnifyGlass.InfoPanelTextColor', '#6b7280'),
        (value) => setSettingValue('🔍MagnifyGlass.InfoPanelTextColor', value),
        'Text color in the info panel',
        (value) => {
            const infoPanel = (window as any).infoPanelManager;
            if (infoPanel?.stateManager?.state?.settings) {
                infoPanel.stateManager.state.settings['🔍MagnifyGlass.InfoPanelTextColor'] = value;
                infoPanel.uiManager.applyStyles();
            }
        }
    ));

    panelSection.body.appendChild(createColorPicker('Accent Color',
        getSettingValue('🔍MagnifyGlass.InfoPanelAccentColor', '#3b82f6'),
        (value) => setSettingValue('🔍MagnifyGlass.InfoPanelAccentColor', value),
        'Accent color for highlights',
        (value) => {
            const infoPanel = (window as any).infoPanelManager;
            if (infoPanel?.stateManager?.state?.settings) {
                infoPanel.stateManager.state.settings['🔍MagnifyGlass.InfoPanelAccentColor'] = value;
                infoPanel.uiManager.applyStyles();
            }
        }
    ));

    panelSection.body.appendChild(createToggle('Animations',
        getSettingValue('🔍MagnifyGlass.InfoPanelAnimations', false),
        (checked) => setSettingValue('🔍MagnifyGlass.InfoPanelAnimations', checked),
        'Enable smooth animations for panel updates'
    ));

    panelSection.body.appendChild(createToggle('Hover Controls',
        getSettingValue('🔍MagnifyGlass.ShowHoveringControls', true),
        (checked) => setSettingValue('🔍MagnifyGlass.ShowHoveringControls', checked),
        'Show floating control buttons near the panel'
    ));

    panelSection.body.appendChild(createSelect('Controls Position',
        getSettingValue('🔍MagnifyGlass.ControlsPosition', 'left'),
        ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'],
        (value) => setSettingValue('🔍MagnifyGlass.ControlsPosition', value),
        'Position of floating control buttons',
        (value) => {
            // Live update controls position
            const infoPanel = (window as any).infoPanelManager;
            if (infoPanel?.stateManager?.state?.settings) {
                infoPanel.stateManager.state.settings['🔍MagnifyGlass.ControlsPosition'] = value;
                infoPanel.uiManager.updateControlsLayout(value);
                if (infoPanel.magnifyGlass.state.active) {
                    infoPanel.positionManager.positionFloatingControls();
                }
            }
        }
    ));

    container.appendChild(panelSection.section);

    // ===== Panel Hotkeys Section =====
    const panelHotkeySection = createSection('Panel Hotkeys', true);

    panelHotkeySection.body.appendChild(createSelect('Toggle Key',
        getSettingValue('🔍MagnifyGlass.ToggleHotkey', 'i'), ['i', 'j', 'k', 'l', 'n', 'm'],
        (value) => setSettingValue('🔍MagnifyGlass.ToggleHotkey', value),
        'Key to toggle info panel visibility'
    ));

    panelHotkeySection.body.appendChild(createSelect('Glass Toggle Key',
        getSettingValue('🔍MagnifyGlass.GlassPreviewToggleHotkey', 'g'), ['g', 'f', 'v', 'b'],
        (value) => setSettingValue('🔍MagnifyGlass.GlassPreviewToggleHotkey', value),
        'Key to toggle glass preview in panel'
    ));

    panelHotkeySection.body.appendChild(createSelect('Pin Key',
        getSettingValue('🔍MagnifyGlass.PinPanelHotkey', 'u'), ['u', 'p', 'y', 't'],
        (value) => setSettingValue('🔍MagnifyGlass.PinPanelHotkey', value),
        'Key to pin/unpin the info panel position'
    ));

    container.appendChild(panelHotkeySection.section);

    // ===== Debug Section =====
    const debugSection = createSection('Debug', true);

    debugSection.body.appendChild(createToggle('Debug Mode',
        getSettingValue('🔍MagnifyGlass.DebugMode', false),
        (checked) => setSettingValue('🔍MagnifyGlass.DebugMode', checked),
        'Enable debug logging and visual indicators'
    ));

    container.appendChild(debugSection.section);

    // ===== Button Row =====
    const buttonRow = document.createElement('div');
    buttonRow.style.padding = '16px';
    buttonRow.style.borderTop = '1px solid var(--border-color, #333)';
    buttonRow.style.display = 'flex';
    buttonRow.style.flexDirection = 'column';
    buttonRow.style.gap = '8px';

    // Reset Position Button
    const resetBtn = document.createElement('button');
    resetBtn.className = 'magnify-btn';
    resetBtn.style.width = '100%';
    resetBtn.innerHTML = `${Icons.reset} Reset Position`;
    resetBtn.title = `Reset glass position and disable follow cursor. Hotkey: ${resetKey}`;

    resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const magnifyGlass = window.comfyUIMagnifyGlass;
        if (magnifyGlass && magnifyGlass.resetOffsets) {
            magnifyGlass.resetOffsets();
            // Update follow cursor toggle in UI
            const followToggles = container.querySelectorAll('.magnify-toggle-row');
            followToggles.forEach(row => {
                const label = row.querySelector('label');
                if (label && label.textContent === 'Follow Cursor') {
                    const toggle = row.querySelector('.magnify-toggle');
                    if (toggle) toggle.classList.remove('active');
                }
            });
        }
    });

    buttonRow.appendChild(resetBtn);

    // Reset All Settings Button
    const resetAllBtn = document.createElement('button');
    resetAllBtn.className = 'magnify-btn magnify-btn-secondary';
    resetAllBtn.style.width = '100%';
    resetAllBtn.innerHTML = `${Icons.reset} Reset All Settings`;
    resetAllBtn.title = 'Reset all settings to their default values';

    resetAllBtn.addEventListener('click', (e) => {
        e.stopPropagation();

        // Confirm with user
        if (!confirm('Reset all MagnifyGlass settings to defaults?')) {
            return;
        }

        // Default glass settings
        setSettingValue('🔍MagnifyGlass.ZoomFactor', 300);
        setSettingValue('🔍MagnifyGlass.GlassSize', 300);
        setSettingValue('🔍MagnifyGlass.GlassShape', 'Rounded Square');
        setSettingValue('🔍MagnifyGlass.GlassPosition', 'Top-Right');
        setSettingValue('🔍MagnifyGlass.TextureFiltering', 'Linear');
        setSettingValue('🔍MagnifyGlass.BorderWidth', 1);
        setSettingValue('🔍MagnifyGlass.BorderColor', '#6b7280');
        setSettingValue('🔍MagnifyGlass.BorderEnabled', true);
        setSettingValue('🔍MagnifyGlass.FollowCursor', false);
        setSettingValue('🔍MagnifyGlass.AlwaysActiveMode', true);
        setSettingValue('🔍MagnifyGlass.ActivationKey', 'x');
        setSettingValue('🔍MagnifyGlass.ResetKey', 'o');
        setSettingValue('🔍MagnifyGlass.ToggleFollowCursorKey', 'h');
        setSettingValue('🔍MagnifyGlass.AltRequired', false);
        setSettingValue('🔍MagnifyGlass.OffsetStep', 5);
        setSettingValue('🔍MagnifyGlass.DebugMode', false);

        // Default panel settings
        setSettingValue('🔍MagnifyGlass.InfoPanelEnabled', true);
        setSettingValue('🔍MagnifyGlass.InfoPanelPosition', 'Bottom');
        setSettingValue('🔍MagnifyGlass.InfoPanelWidth', 300);
        setSettingValue('🔍MagnifyGlass.InfoPanelMaxHeight', 300);
        setSettingValue('🔍MagnifyGlass.InfoPanelOpacity', 100);
        setSettingValue('🔍MagnifyGlass.InfoPanelFontSize', 14);
        setSettingValue('🔍MagnifyGlass.InfoPanelTextColor', '#6b7280');
        setSettingValue('🔍MagnifyGlass.InfoPanelAccentColor', '#3b82f6');
        setSettingValue('🔍MagnifyGlass.InfoPanelAnimations', false);
        setSettingValue('🔍MagnifyGlass.ShowHoveringControls', true);
        setSettingValue('🔍MagnifyGlass.ControlsPosition', 'left');
        setSettingValue('🔍MagnifyGlass.ToggleHotkey', 'i');
        setSettingValue('🔍MagnifyGlass.GlassPreviewToggleHotkey', 'g');
        setSettingValue('🔍MagnifyGlass.PinPanelHotkey', 'u');

        // Also reset position
        const magnifyGlass = window.comfyUIMagnifyGlass;
        if (magnifyGlass && magnifyGlass.resetOffsets) {
            magnifyGlass.resetOffsets();
        }
    });

    buttonRow.appendChild(resetAllBtn);
    container.appendChild(buttonRow);
}
