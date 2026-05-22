<template>
  <aside class="sidebar" :class="{ expanded }">
    <div class="sidebar-logo" @click="$emit('toggle')">
      <span class="logo-icon"><img src="@assets/images/logo/clawshell_logo.png" alt="ClawShell" /></span>
      <span v-if="expanded" class="logo-text">虾壳</span>
    </div>

    <nav class="sidebar-nav">
      <button
        v-for="item in menuItems"
        :key="item.route"
        class="nav-item"
        :class="{ active: currentRoute === item.route }"
        :title="t(item.labelKey)"
        @click="$emit('navigate', item.route)"
      >
        <span class="nav-icon" v-html="getIcon(item.icon, 20)"></span>
        <span v-if="expanded" class="nav-label">{{ t(item.labelKey) }}</span>
      </button>
    </nav>

    <div class="sidebar-footer">
      <button class="nav-item collapse-btn" @click="$emit('toggle')">
        <span class="nav-icon" v-html="expanded ? getIcon('chevron-left', 20) : getIcon('chevron-right', 20)"></span>
        <span v-if="expanded" class="nav-label">{{ t('sidebar.collapse') }}</span>
      </button>
    </div>
  </aside>
</template>

<script setup>
import { getIcon } from '@/lib/icons'
import { t } from '@/i18n'

defineProps({
  expanded: Boolean,
  currentRoute: String,
})

defineEmits(['navigate', 'toggle'])

const menuItems = [
  { icon: 'message-square', labelKey: 'sidebar.chat', route: 'chat' },
  { icon: 'bot', labelKey: 'sidebar.assistants', route: 'assistants' },
  { icon: 'radio', labelKey: 'sidebar.channels', route: 'channels' },
  { icon: 'brain', labelKey: 'sidebar.models', route: 'models' },
  { icon: 'zap', labelKey: 'sidebar.skills', route: 'skills' },
  { icon: 'settings', labelKey: 'sidebar.settings', route: 'settings' },
]
</script>

<style scoped>
.sidebar {
  width: var(--sidebar-width);
  height: 100%;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  transition: width var(--transition-normal);
  overflow: hidden;
  flex-shrink: 0;
}

.sidebar.expanded {
  width: var(--sidebar-width-expanded);
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-lg);
  cursor: pointer;
  height: var(--statusbar-height);
  border-bottom: 1px solid var(--color-border);
}

.logo-icon {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-icon img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.logo-text {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: var(--color-primary);
  white-space: nowrap;
}

.sidebar-nav {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: var(--spacing-sm);
  gap: var(--spacing-xs);
}

.nav-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  padding: var(--spacing-md) var(--spacing-lg);
  border-radius: var(--radius-sm);
  transition: background var(--transition-fast);
  white-space: nowrap;
  min-height: 44px;
}

.nav-item:hover {
  background: var(--color-bg-hover);
}

.nav-item.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.nav-icon {
  font-size: 18px;
  flex-shrink: 0;
  width: 24px;
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
}

.nav-icon :deep(svg) {
  display: block;
}

.nav-label {
  font-size: var(--font-size-md);
}

.sidebar-footer {
  padding: var(--spacing-sm);
  border-top: 1px solid var(--color-border);
}

.collapse-btn {
  justify-content: center;
}
</style>
