import "../../node_modules/.pnpm/vue@3.5.26_typescript@5.9.3/node_modules/vue/dist/vue.runtime.esm-bundler.js";
import { defineComponent, computed } from "../../node_modules/.pnpm/@vue_runtime-core@3.5.26/node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js";
import { toRefs } from "../../node_modules/.pnpm/@vue_reactivity@3.5.26/node_modules/@vue/reactivity/dist/reactivity.esm-bundler.js";
const _sfc_main = defineComponent({
  name: "InfoPanel",
  props: {
    state: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    const { state } = toRefs(props);
    const isVisible = computed(() => {
      var _a;
      return ((_a = state.value) == null ? void 0 : _a.visible) ?? false;
    });
    const isPinned = computed(() => {
      var _a;
      return ((_a = state.value) == null ? void 0 : _a.pinned) ?? false;
    });
    const nodeInfo = computed(() => {
      var _a;
      return ((_a = state.value) == null ? void 0 : _a.hoveredNode) ?? null;
    });
    const theme = computed(() => {
      var _a;
      return ((_a = state.value) == null ? void 0 : _a.theme) ?? "dark";
    });
    const themeClass = computed(() => `theme-${theme.value}`);
    const panelStyle = computed(() => ({
      width: "300px",
      opacity: 1
    }));
    const togglePin = () => {
      if (state.value) {
        state.value.pinned = !state.value.pinned;
      }
    };
    const close = () => {
      if (state.value) {
        state.value.visible = false;
      }
    };
    return {
      isVisible,
      isPinned,
      nodeInfo,
      themeClass,
      panelStyle,
      togglePin,
      close
    };
  }
});
export {
  _sfc_main as default
};
//# sourceMappingURL=InfoPanel.vue2.js.map
