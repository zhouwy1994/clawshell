<template>
  <footer class="bottom-bar">
    <button class="bottom-btn repair-btn" @click="$emit('repair')">
      <span class="btn-icon">🔧</span>
      <span class="btn-text">{{ t('bottombar.repair') }}</span>
    </button>
    <div class="bottom-spacer"></div>
    <button class="bottom-btn contact-btn" @click="$emit('contact')">
      <span class="btn-icon">💬</span>
      <span class="btn-text">{{ t('bottombar.contact') }}</span>
    </button>
  </footer>
</template>

<script setup>
import { t } from '@/i18n'
defineEmits(['repair', 'contact'])
</script>

<style scoped>
.bottom-bar {
  height: var(--bottombar-height);
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
  display: flex;
  align-items: center;
  padding: 0 var(--spacing-lg);
  flex-shrink: 0;
}

.bottom-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-md);
  border-radius: var(--radius-sm);
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  transition: all var(--transition-fast);
}

.bottom-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.btn-icon {
  font-size: 14px;
}

.btn-text {
  white-space: nowrap;
}

.bottom-spacer {
  flex: 1;
}
</style>
