<template>
  <div v-if="isVisible" class="mag-info-panel" :class="themeClass" :style="panelStyle">
    <div class="mag-panel-header">
      <div class="mag-panel-title">Magnify Info</div>
      <div class="mag-panel-controls">
        <button @click="togglePin" :class="{ active: isPinned }">📌</button>
        <button @click="close">✕</button>
      </div>
    </div>
    
    <div class="mag-panel-content">
      <div v-if="nodeInfo" class="mag-node-info">
        <h3>{{ nodeInfo.title || nodeInfo.type }}</h3>
        <div class="mag-property-grid">
           <div class="mag-prop-row">
             <span class="mag-prop-label">ID:</span>
             <span class="mag-prop-value">{{ nodeInfo.id }}</span>
           </div>
           <!-- More properties will go here -->
        </div>
      </div>
      <div v-else class="mag-empty-state">
        Hover over a node to see details
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, toRefs } from 'vue';

export default defineComponent({
  name: 'InfoPanel',
  props: {
    state: {
      type: Object,
      required: true
    }
  },
  setup(props) {
    // Use toRefs to maintain reactivity from the parent's reactive state
    const { state } = toRefs(props);
    
    const isVisible = computed(() => state.value?.visible ?? false);
    const isPinned = computed(() => state.value?.pinned ?? false);
    const nodeInfo = computed(() => state.value?.hoveredNode ?? null);
    const theme = computed(() => state.value?.theme ?? 'dark');

    const themeClass = computed(() => `theme-${theme.value}`);
    const panelStyle = computed(() => ({
      width: '300px',
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
</script>

<style scoped>
.mag-info-panel {
  position: fixed;
  bottom: 20px;
  left: 20px;
  background: var(--comfy-menu-bg, #222);
  color: var(--comfy-text-color, #fff);
  border: 1px solid var(--border-color, #444);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  overflow: hidden;
  font-family: sans-serif;
  z-index: 1000;
  pointer-events: auto;
}

.mag-panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: rgba(255,255,255,0.05);
  border-bottom: 1px solid rgba(255,255,255,0.1);
  cursor: grab;
}

.mag-panel-header:active {
  cursor: grabbing;
}

.mag-panel-title {
  font-weight: bold;
}

.mag-panel-controls {
  display: flex;
  gap: 4px;
}

.mag-panel-controls button {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.mag-panel-controls button:hover {
  background: rgba(255,255,255,0.1);
}

.mag-panel-controls button.active {
  background: rgba(59, 130, 246, 0.3);
}

.mag-panel-content {
  padding: 12px;
  max-height: 400px;
  overflow-y: auto;
}

.mag-node-info h3 {
  margin-top: 0;
  margin-bottom: 10px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
  padding-bottom: 5px;
}

.mag-property-grid {
  display: grid;
  gap: 4px;
}

.mag-prop-row {
  display: flex;
  justify-content: space-between;
}

.mag-prop-label {
  opacity: 0.7;
}

.mag-empty-state {
  opacity: 0.6;
  text-align: center;
  padding: 20px;
}

.theme-light {
  background: #fff;
  color: #333;
  border-color: #ccc;
}
</style>
