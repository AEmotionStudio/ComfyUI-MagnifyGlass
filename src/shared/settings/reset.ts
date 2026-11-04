/**
 * ComfyUI MagnifyGlass - Reset All Settings
 *
 * Shared by the sidebar's Reset All button and the settings dialog's reset action.
 */

import { setSettingValue } from '../utils';
import { DEFAULT_SETTINGS } from './defaults';

/**
 * Put every setting back to its default and the glass back to its start position.
 */
export function resetAllSettings(): void {
    for (const [id, value] of Object.entries(DEFAULT_SETTINGS)) {
        setSettingValue(id, value);
    }
    window.comfyUIMagnifyGlass?.resetOffsets();
}
