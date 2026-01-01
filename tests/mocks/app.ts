/**
 * Mock for ComfyUI app object
 * Used in tests to avoid importing actual ComfyUI modules
 */

export const app = {
    ui: {
        settings: {
            getSettingValue: (key: string) => undefined,
            addSetting: () => { }
        }
    },
    canvas: null,
    graph: null
};
