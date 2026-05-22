<template>
  <div class="session-panel" :class="{ collapsed }">
    <template v-if="!collapsed">
      <div class="session-header">
        <span class="session-title">{{ t('session.title') }}</span>
        <button class="btn-new" @click="$emit('create')" v-html="getIcon('plus', 16)"></button>
      </div>
      <div class="session-search">
        <span class="search-icon" v-html="getIcon('search', 16, '#888')"></span>
        <input
          class="search-input"
          :value="filter"
          @input="$emit('update:filter', $event.target.value)"
          :placeholder="t('session.search')"
        />
      </div>
      <div class="session-list">
        <div v-if="loading" class="session-empty">{{ t('session.loading') }}</div>
        <div v-else-if="sessions.length === 0" class="session-empty">{{ t('session.empty') }}</div>
        <div
          v-for="session in sessions"
          :key="session.key"
          class="session-item"
          :class="{ active: session.key === currentKey }"
          @click="handleSwitch(session.key)"
        >
          <div class="session-info">
            <template v-if="editingKey === session.key">
              <input
                class="rename-input"
                :value="session.label || ''"
                @keydown.enter.prevent="finishRename($event, session)"
                @keydown.escape.prevent="editingKey = ''"
                @blur="finishRename($event, session)"
                @click.stop
              />
            </template>
            <template v-else>
              <div class="session-label">{{ session.label || session.key }}</div>
              <div class="session-meta">{{ formatTime(session.updatedAt) }}</div>
            </template>
          </div>
          <div v-if="editingKey !== session.key" class="session-actions">
            <button
              class="action-btn"
              :title="t('session.rename')"
              @click.stop="startRename(session)"
              v-html="getIcon('pencil', 13)"
            ></button>
            <button
              class="action-btn action-delete"
              :title="t('session.delete')"
              @click.stop="handleDelete(session)"
              v-html="getIcon('trash-2', 13)"
            ></button>
          </div>
        </div>
      </div>
    </template>
    <button v-else class="expand-btn" @click="$emit('toggle')" v-html="getIcon('panel-left-open', 20)"></button>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'
import { getIcon } from '@/lib/icons'
import { t } from '@/i18n'

defineProps({
  sessions: { type: Array, default: () => [] },
  currentKey: { type: String, default: '' },
  collapsed: { type: Boolean, default: false },
  loading: { type: Boolean, default: false },
  filter: { type: String, default: '' },
})

const emit = defineEmits(['create', 'switch', 'toggle', 'update:filter', 'rename', 'delete'])

const editingKey = ref('')

function formatTime(ts) {
  if (!ts) return ''
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return t('session.justNow')
  if (diffMin < 60) return t('session.minutesAgo').replace('{n}', diffMin)
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return t('session.hoursAgo').replace('{n}', diffHour)
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return t('session.daysAgo').replace('{n}', diffDay)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

function handleSwitch(key) {
  if (editingKey.value) return
  emit('switch', key)
}

function startRename(session) {
  editingKey.value = session.key
  nextTick(() => {
    const input = document.querySelector('.rename-input')
    if (input) {
      input.focus()
      input.select()
    }
  })
}

function finishRename(e, session) {
  if (editingKey.value !== session.key) return
  const val = e.target.value.trim()
  editingKey.value = ''
  if (val && val !== (session.label || '')) {
    emit('rename', session.key, val)
  }
}

function handleDelete(session) {
  emit('delete', session.key)
}
</script>

<style scoped>
.session-panel {
  width: var(--chat-session-width);
  background: var(--chat-session-bg);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: width var(--transition-normal);
  overflow: hidden;
}

.session-panel.collapsed {
  width: 48px;
  align-items: center;
  padding-top: 12px;
}

.session-header {
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.session-title {
  font-weight: 600;
  font-size: var(--font-size-md);
}

.btn-new {
  background: var(--color-primary);
  border-radius: var(--radius-sm);
  padding: 4px 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-new :deep(svg) { color: #fff; }

.session-search {
  padding: 8px 12px;
  position: relative;
}

.search-icon {
  position: absolute;
  left: 22px;
  top: 50%;
  transform: translateY(-50%);
  margin-top: 4px;
}

.search-input {
  width: 100%;
  padding-left: 32px;
  font-size: var(--font-size-sm);
}

.session-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 8px;
}

.session-item {
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  margin-bottom: 2px;
  transition: background var(--transition-fast);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.session-item:hover {
  background: var(--color-bg-hover);
}

.session-item.active {
  background: var(--color-primary-light);
  border-left: 3px solid var(--color-primary);
}

.session-info {
  min-width: 0;
  flex: 1;
}

.session-label {
  font-size: var(--font-size-sm);
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.session-item.active .session-label {
  color: var(--color-primary);
}

.session-meta {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  margin-top: 2px;
}

.rename-input {
  width: 100%;
  padding: 2px 6px;
  background: var(--color-bg-tertiary);
  color: var(--color-text);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  outline: none;
}

.session-actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.session-item:hover .session-actions {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: var(--color-text-tertiary);
  transition: background 0.1s, color 0.1s;
}

.action-btn:hover {
  background: var(--color-bg-active);
  color: var(--color-text-secondary);
}

.action-btn.action-delete:hover {
  color: var(--color-error);
}

.action-btn :deep(svg) { display: block; }

.session-empty {
  text-align: center;
  color: var(--color-text-tertiary);
  padding: 24px;
  font-size: var(--font-size-sm);
}

.expand-btn {
  padding: 8px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
}

.expand-btn:hover {
  background: var(--color-bg-hover);
}
</style>
