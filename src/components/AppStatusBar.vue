<template>
  <header class="status-bar">
    <div class="status-left">
      <span class="status-item">
        <span class="status-dot" :class="gatewayDotClass"></span>
        <span class="status-text">{{ gatewayText }}</span>
      </span>
      <span v-if="gatewayReady" class="status-item">
        <span class="status-dot" :class="hasModel ? 'dot-success' : 'dot-error'"></span>
        <span class="status-text">{{ hasModel ? t('statusbar.modelReady') : t('statusbar.noModel') }}</span>
      </span>
    </div>
    <div class="status-right">
      <button class="status-btn lang-toggle" @click="toggleLang" :title="locale === 'zh-CN' ? 'English' : '中文'">
        🌐 {{ locale === 'zh-CN' ? 'EN' : '中' }}
      </button>
      <button class="status-btn theme-toggle" @click="$emit('toggle-theme')" :title="isDark ? t('statusbar.toggleLight') : t('statusbar.toggleDark')">
        {{ isDark ? '☀️' : '🌙' }}
      </button>
    </div>
  </header>
</template>

<script setup>
import { computed } from 'vue'
import { t, setLocale, currentLocale } from '@/i18n'
import { ipc } from '@/lib/ipc'

const locale = currentLocale

const props = defineProps({
  gatewayStatus: String,
  gatewayReady: Boolean,
  hasModel: Boolean,
  isDark: Boolean,
})

defineEmits(['toggle-theme'])

async function toggleLang() {
  const newLang = locale.value === 'zh-CN' ? 'en' : 'zh-CN'
  setLocale(newLang)
  const settings = await ipc.getSettings()
  settings.ui = { ...settings.ui, language: newLang }
  await ipc.saveSettings(settings)
}

const gatewayDotClass = computed(() => {
  switch (props.gatewayStatus) {
    case 'ready': return 'dot-success'
    case 'starting': return 'dot-warning'
    case 'disconnected': return 'dot-error'
    case 'error': return 'dot-error'
    default: return 'dot-warning'
  }
})

const gatewayText = computed(() => {
  switch (props.gatewayStatus) {
    case 'ready': return t('statusbar.gatewayReady')
    case 'starting': return t('statusbar.gatewayStarting')
    case 'disconnected': return t('statusbar.gatewayDisconnected')
    case 'error': return t('statusbar.gatewayError')
    default: return t('statusbar.gatewayStarting')
  }
})
</script>

<style scoped>
.status-bar {
  height: var(--statusbar-height);
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-lg);
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.status-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-xl);
}

.status-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.dot-success { background: var(--color-success); }
.dot-warning { background: var(--color-warning); animation: pulse 1.5s ease-in-out infinite; }
.dot-error { background: var(--color-error); }

.status-text {
  white-space: nowrap;
}

.status-right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  -webkit-app-region: no-drag;
}

.status-btn {
  -webkit-app-region: no-drag;
}

.lang-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-tertiary);
  transition: all var(--transition-fast);
}
.lang-toggle:hover {
  color: var(--color-primary);
  background: var(--color-bg-hover);
}

.theme-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
  font-size: 16px;
}
.theme-toggle:hover {
  background: var(--color-bg-hover);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
