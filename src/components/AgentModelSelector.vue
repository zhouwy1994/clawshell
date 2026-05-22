<template>
  <div class="selector-group">
    <span class="selector-tag">助手</span>
    <div class="selector-wrap" ref="agentDropdownRef">
      <button class="selector-btn" @click="toggleAgentDropdown" :disabled="agents.length === 0">
        <span class="selector-label">{{ currentAgentLabel }}</span>
        <span class="selector-chevron" v-html="getIcon('chevron-down', 14)"></span>
      </button>
      <div v-if="agentOpen" class="selector-dropdown">
        <div
          v-for="agent in agents"
          :key="agent.id"
          class="dropdown-item"
          :class="{ active: agent.id === selectedAgentId }"
          @click="pickAgent(agent.id)"
        >
          <span class="agent-emoji">{{ agent.identity?.emoji || '🤖' }}</span>
          <span class="agent-name">{{ agent.name || agent.id }}</span>
        </div>
      </div>
    </div>

    <span class="selector-divider"></span>

    <span class="selector-tag">模型</span>
    <div class="selector-wrap" ref="modelDropdownRef">
      <button class="selector-btn" @click="toggleModelDropdown" :disabled="models.length === 0">
        <span class="selector-label">{{ currentModelLabel }}</span>
        <span class="selector-chevron" v-html="getIcon('chevron-down', 14)"></span>
      </button>
      <div v-if="modelOpen" class="selector-dropdown model-dropdown">
        <div
          class="dropdown-item"
          :class="{ active: !selectedModelId }"
          @click="pickModel(null)"
        >
          <span class="model-name">使用默认</span>
        </div>
        <div
          v-for="model in models"
          :key="model.id"
          class="dropdown-item"
          :class="{ active: model.id === selectedModelId }"
          @click="pickModel(model.id)"
        >
          <span class="model-name">{{ model.name || model.id }}</span>
          <span v-if="model.provider" class="model-provider">{{ model.provider }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { getIcon } from '@/lib/icons'

const props = defineProps({
  agents: { type: Array, default: () => [] },
  models: { type: Array, default: () => [] },
  selectedAgentId: { type: String, default: '' },
  selectedModelId: { type: String, default: null },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['select-agent', 'select-model'])

const agentOpen = ref(false)
const modelOpen = ref(false)
const agentDropdownRef = ref(null)
const modelDropdownRef = ref(null)

const currentAgentLabel = computed(() => {
  const agent = props.agents.find(a => a.id === props.selectedAgentId)
  return agent?.name || agent?.id || '助手'
})

const currentModelLabel = computed(() => {
  if (!props.selectedModelId) return '默认模型'
  const model = props.models.find(m => m.id === props.selectedModelId)
  return model?.name || props.selectedModelId
})

function toggleAgentDropdown() {
  modelOpen.value = false
  agentOpen.value = !agentOpen.value
}

function toggleModelDropdown() {
  agentOpen.value = false
  modelOpen.value = !modelOpen.value
}

function pickAgent(id) {
  agentOpen.value = false
  emit('select-agent', id)
}

function pickModel(id) {
  modelOpen.value = false
  emit('select-model', id)
}

function handleClickOutside(e) {
  if (agentDropdownRef.value && !agentDropdownRef.value.contains(e.target)) {
    agentOpen.value = false
  }
  if (modelDropdownRef.value && !modelDropdownRef.value.contains(e.target)) {
    modelOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onBeforeUnmount(() => document.removeEventListener('click', handleClickOutside))
</script>

<style scoped>
.selector-group {
  display: flex;
  align-items: center;
  gap: 6px;
}

.selector-tag {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}

.selector-wrap {
  position: relative;
}

.selector-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 14px;
  background: var(--color-bg-tertiary);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  transition: background 0.15s;
}

.selector-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
}

.selector-btn:disabled {
  opacity: 0.4;
}

.selector-label {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.selector-chevron {
  display: flex;
  opacity: 0.5;
}

.selector-chevron :deep(svg) { display: block; }

.selector-divider {
  width: 1px;
  height: 16px;
  background: var(--color-border);
  margin: 0 4px;
  flex-shrink: 0;
}

.selector-dropdown {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  min-width: 180px;
  max-height: 240px;
  overflow-y: auto;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  z-index: 100;
}

.model-dropdown {
  min-width: 220px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  cursor: pointer;
  transition: background 0.1s;
}

.dropdown-item:hover {
  background: var(--color-bg-hover);
}

.dropdown-item.active {
  color: var(--color-primary);
  font-weight: 600;
}

.agent-emoji {
  font-size: 14px;
}

.agent-name, .model-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.model-provider {
  font-size: 10px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
}
</style>
