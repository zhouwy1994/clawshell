<template>
  <div class="app-titlebar">
    <div class="titlebar-drag"></div>
    <div class="titlebar-controls">
      <button class="win-btn" @click="handleMinimize" :title="t('window.minimize')">
        <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor"/></svg>
      </button>
      <button class="win-btn" @click="handleMaximize" :title="isMaximized ? t('window.restore') : t('window.maximize')">
        <svg v-if="isMaximized" width="10" height="10" viewBox="0 0 10 10">
          <rect x="2" y="0" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/>
          <rect x="0" y="2" width="8" height="8" fill="none" stroke="currentColor" stroke-width="1"/>
        </svg>
        <svg v-else width="10" height="10" viewBox="0 0 10 10">
          <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1"/>
        </svg>
      </button>
      <button class="win-btn win-close" @click="handleClose" :title="t('window.close')">
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1.2"/>
          <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1.2"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { t } from '@/i18n'
import { ipc } from '@/lib/ipc'

const isMaximized = ref(false)

function handleMinimize() { ipc.windowMinimize() }
function handleMaximize() { ipc.windowMaximize() }
function handleClose() { ipc.windowClose() }

function checkMaximized() {
  isMaximized.value = window.outerWidth === screen.availWidth && window.outerHeight === screen.availHeight
}

onMounted(() => {
  window.addEventListener('resize', checkMaximized)
  checkMaximized()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkMaximized)
})
</script>

<style scoped>
.app-titlebar {
  display: flex;
  align-items: stretch;
  height: var(--titlebar-height, 32px);
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.titlebar-drag {
  flex: 1;
}

.titlebar-controls {
  display: flex;
  align-items: stretch;
  -webkit-app-region: no-drag;
}

.win-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 46px;
  height: 100%;
  color: var(--color-text-secondary);
  transition: background 0.1s, color 0.1s;
}

.win-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.win-close:hover {
  background: #e81123;
  color: #fff;
}

.win-btn svg {
  display: block;
}
</style>
