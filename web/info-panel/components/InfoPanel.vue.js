import _sfc_main from "./InfoPanel.vue2.js";
import "../../node_modules/.pnpm/vue@3.5.26_typescript@5.9.3/node_modules/vue/dist/vue.runtime.esm-bundler.js";
/* empty css               */
import _export_sfc from "../../_virtual/_plugin-vue_export-helper.js";
import { createElementBlock, createCommentVNode, createElementVNode as createBaseVNode, openBlock } from "../../node_modules/.pnpm/@vue_runtime-core@3.5.26/node_modules/@vue/runtime-core/dist/runtime-core.esm-bundler.js";
import { normalizeClass, toDisplayString, normalizeStyle } from "../../node_modules/.pnpm/@vue_shared@3.5.26/node_modules/@vue/shared/dist/shared.esm-bundler.js";
const _hoisted_1 = { class: "mag-panel-header" };
const _hoisted_2 = { class: "mag-panel-controls" };
const _hoisted_3 = { class: "mag-panel-content" };
const _hoisted_4 = {
  key: 0,
  class: "mag-node-info"
};
const _hoisted_5 = { class: "mag-property-grid" };
const _hoisted_6 = { class: "mag-prop-row" };
const _hoisted_7 = { class: "mag-prop-value" };
const _hoisted_8 = {
  key: 1,
  class: "mag-empty-state"
};
function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
  return _ctx.isVisible ? (openBlock(), createElementBlock("div", {
    key: 0,
    class: normalizeClass(["mag-info-panel", _ctx.themeClass]),
    style: normalizeStyle(_ctx.panelStyle)
  }, [
    createBaseVNode("div", _hoisted_1, [
      _cache[2] || (_cache[2] = createBaseVNode("div", { class: "mag-panel-title" }, "Magnify Info", -1)),
      createBaseVNode("div", _hoisted_2, [
        createBaseVNode("button", {
          onClick: _cache[0] || (_cache[0] = (...args) => _ctx.togglePin && _ctx.togglePin(...args)),
          class: normalizeClass({ active: _ctx.isPinned })
        }, "📌", 2),
        createBaseVNode("button", {
          onClick: _cache[1] || (_cache[1] = (...args) => _ctx.close && _ctx.close(...args))
        }, "✕")
      ])
    ]),
    createBaseVNode("div", _hoisted_3, [
      _ctx.nodeInfo ? (openBlock(), createElementBlock("div", _hoisted_4, [
        createBaseVNode("h3", null, toDisplayString(_ctx.nodeInfo.title || _ctx.nodeInfo.type), 1),
        createBaseVNode("div", _hoisted_5, [
          createBaseVNode("div", _hoisted_6, [
            _cache[3] || (_cache[3] = createBaseVNode("span", { class: "mag-prop-label" }, "ID:", -1)),
            createBaseVNode("span", _hoisted_7, toDisplayString(_ctx.nodeInfo.id), 1)
          ])
        ])
      ])) : (openBlock(), createElementBlock("div", _hoisted_8, " Hover over a node to see details "))
    ])
  ], 6)) : createCommentVNode("", true);
}
const InfoPanelComponent = /* @__PURE__ */ _export_sfc(_sfc_main, [["render", _sfc_render], ["__scopeId", "data-v-687c6e82"]]);
export {
  InfoPanelComponent as default
};
//# sourceMappingURL=InfoPanel.vue.js.map
