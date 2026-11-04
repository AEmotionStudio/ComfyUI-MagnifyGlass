import { setSettingValue } from "../utils.js";
import { DEFAULT_SETTINGS } from "./defaults.js";
function resetAllSettings() {
  var _a;
  for (const [id, value] of Object.entries(DEFAULT_SETTINGS)) {
    setSettingValue(id, value);
  }
  (_a = window.comfyUIMagnifyGlass) == null ? void 0 : _a.resetOffsets();
}
export {
  resetAllSettings
};
