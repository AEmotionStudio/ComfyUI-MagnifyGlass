<template>
  <div class="comfy-vue-panel" :class="themeClass">
    <h1>{{ title }}</h1>
    <div class="content">
      <slot></slot>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue';

export default defineComponent({
  name: 'ComfyPanel',
  props: {
    title: {
      type: String,
      default: 'Panel'
    },
    theme: {
      type: String,
      default: 'dark'
    }
  },
  setup(props) {
    const themeClass = computed(() => `theme-${props.theme}`);
    
    return {
      themeClass
    };
  }
});
</script>

<style scoped>
.comfy-vue-panel {
  padding: 10px;
  background-color: var(--comfy-menu-bg, #222);
  color: var(--comfy-text-color, #fff);
  border: 1px solid var(--border-color, #444);
  border-radius: 4px;
}
.theme-light {
  background-color: #f0f0f0;
  color: #333;
}
</style>
