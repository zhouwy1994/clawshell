<template>
  <div class="tool-call-card" @click="expanded = !expanded">
    <div class="tool-header">
      <span class="tool-icon" v-html="getIcon('wrench', 14)"></span>
      <span class="tool-name">{{ toolName }}</span>
      <span class="tool-chevron" v-html="expanded ? getIcon('chevron-down', 14) : getIcon('chevron-right', 14)"></span>
    </div>
    <div v-if="expanded" class="tool-body">
      <div v-if="toolInput" class="tool-section">
        <div class="tool-section-label">参数</div>
        <pre class="tool-code">{{ formatJson(toolInput) }}</pre>
      </div>
      <div v-if="toolResult" class="tool-section">
        <div class="tool-section-label">结果</div>
        <pre class="tool-code">{{ formatJson(toolResult) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { getIcon } from '@/lib/icons'

defineProps({
  toolName: { type: String, default: '' },
  toolInput: { default: null },
  toolResult: { default: null },
})

const expanded = ref(false)

function formatJson(data) {
  if (typeof data === 'string') return data
  try { return JSON.stringify(data, null, 2) } catch { return String(data) }
}
</script>

<style scoped>
.tool-call-card {
  background: var(--chat-tool-card-bg);
  border: 1px solid var(--chat-tool-card-border);
  border-radius: var(--radius-sm);
  margin: 8px 0;
  cursor: pointer;
  font-size: var(--font-size-sm);
  overflow: hidden;
}

.tool-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
}

.tool-icon { color: var(--color-text-tertiary); flex-shrink: 0; }
.tool-icon :deep(svg) { display: block; }

.tool-name {
  font-weight: 500;
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tool-chevron { color: var(--color-text-tertiary); flex-shrink: 0; }
.tool-chevron :deep(svg) { display: block; }

.tool-body {
  padding: 0 12px 12px;
}

.tool-section {
  margin-top: 8px;
}

.tool-section-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.tool-code {
  background: var(--chat-code-bg);
  color: var(--color-text);
  padding: 8px 12px;
  border-radius: var(--radius-sm);
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: var(--font-size-xs);
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
