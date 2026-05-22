<template>
  <Teleport to="body">
    <div v-if="visible" class="dialog-overlay" @click.self="$emit('close')">
      <div class="dialog-card">
        <div class="dialog-title">{{ t('newSession.title') }}</div>
        <div class="dialog-field">
          <label class="dialog-label">{{ t('newSession.assistant') }}</label>
          <select v-model="agentId" class="dialog-select">
            <option v-for="a in agents" :key="a.id" :value="a.id">
              {{ a.identity?.name || a.name || a.id }}
            </option>
          </select>
        </div>
        <div v-if="duplicateWarning" class="dialog-warning">{{ duplicateWarning }}</div>
        <div class="dialog-field">
          <label class="dialog-label">{{ t('newSession.sessionName') }}</label>
          <input
            v-model="label"
            class="dialog-input"
            :placeholder="t('newSession.namePlaceholder')"
            @keydown.enter="handleCreate"
          />
        </div>
        <div class="dialog-actions">
          <button class="btn-cancel" @click="$emit('close')">{{ t('common.cancel') }}</button>
          <button class="btn-create" :disabled="!!duplicateWarning" @click="handleCreate">{{ t('newSession.create') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { t } from '@/i18n'

const props = defineProps({
  agents: { type: Array, default: () => [] },
  sessions: { type: Array, default: () => [] },
  defaultAgentId: { type: String, default: '' },
  visible: { type: Boolean, default: false },
})

const emit = defineEmits(['close', 'create'])

const agentId = ref('')
const label = ref('')

const duplicateWarning = computed(() => {
  if (!agentId.value) return ''
  const existing = props.sessions.find(s => {
    const parts = s.key?.split(':')
    return parts?.length >= 2 && parts[1] === agentId.value
  })
  if (existing) {
    const name = existing.label || existing.key
    return t('newSession.duplicateWarning').replace('{name}', name)
  }
  return ''
})

watch(() => props.visible, (v) => {
  if (v) {
    agentId.value = props.defaultAgentId || props.agents?.[0]?.id || ''
    label.value = ''
  }
})

function handleCreate() {
  if (duplicateWarning.value) return
  emit('create', agentId.value, label.value.trim())
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog-card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 24px;
  width: 380px;
  max-width: 90vw;
  box-shadow: var(--shadow-lg);
}

.dialog-title {
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-bottom: 20px;
}

.dialog-field {
  margin-bottom: 16px;
}

.dialog-label {
  display: block;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.dialog-select,
.dialog-input {
  width: 100%;
  padding: 8px 12px;
  background: var(--color-bg-tertiary);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  outline: none;
  transition: border-color 0.15s;
}

.dialog-select:focus,
.dialog-input:focus {
  border-color: var(--color-primary);
}

.dialog-select {
  appearance: none;
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 12px;
  padding-right: 28px;
}

.dialog-warning {
  background: rgba(245, 158, 11, 0.1);
  border: 1px solid rgba(245, 158, 11, 0.3);
  color: var(--color-warning);
  padding: 8px 12px;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  margin-bottom: 12px;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.btn-cancel {
  padding: 8px 16px;
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-md);
}

.btn-cancel:hover {
  background: var(--color-bg-hover);
}

.btn-create {
  padding: 8px 20px;
  border-radius: var(--radius-md);
  background: var(--color-primary);
  color: #fff;
  font-size: var(--font-size-md);
  font-weight: 500;
}

.btn-create:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-create:not(:disabled):hover {
  background: var(--color-primary-hover);
}
</style>
