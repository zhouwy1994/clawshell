<template>
  <div class="app-layout" :class="{ 'sidebar-expanded': uiStore.sidebarExpanded }">
    <AppTitleBar />
    <div class="app-body">
    <AppSidebar
      v-if="showLayout"
      :expanded="uiStore.sidebarExpanded"
      :current-route="currentRoute"
      @navigate="handleNavigate"
      @toggle="uiStore.toggleSidebar"
    />
    <div class="app-main">
      <AppStatusBar
        v-if="showLayout"
        :gateway-status="gatewayStore.status"
        :gateway-ready="gatewayStore.ready"
        :has-model="gatewayStore.hasModel"
        :is-dark="uiStore.isDark"
        @toggle-theme="uiStore.toggleTheme"
      />
      <main class="app-content">
        <router-view />
      </main>
      <AppBottomBar
        v-if="showLayout"
        @repair="handleRepair"
        @contact="handleContact"
      />
    </div>
    </div>
    <!-- Restart overlay -->
    <Transition name="overlay">
      <div v-if="gatewayStore.restarting" class="restart-overlay">
        <div class="restart-card">
          <div class="restart-spinner"></div>
          <div class="restart-text">{{ t('overlay.restarting') }}</div>
          <div class="restart-sub">{{ t('overlay.restartingSub') }}</div>
        </div>
      </div>
    </Transition>
    <!-- Repair overlay -->
    <Transition name="overlay">
      <div v-if="repairState !== 'idle'" class="restart-overlay">
        <div class="restart-card">
          <template v-if="repairState === 'repairing'">
            <div class="restart-spinner"></div>
            <div class="restart-text">{{ t('overlay.repairing') }}</div>
            <div class="restart-sub">{{ t('overlay.repairingSub') }}</div>
          </template>
          <template v-else-if="repairState === 'success'">
            <div class="restart-icon success-icon">✓</div>
            <div class="restart-text">{{ t('overlay.repairSuccess') }}</div>
          </template>
          <template v-else-if="repairState === 'failed'">
            <div class="restart-icon fail-icon">✗</div>
            <div class="restart-text">{{ t('overlay.repairFailed') }}</div>
          </template>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGatewayStore } from '@/stores/gateway'
import { useConfigStore } from '@/stores/config'
import { useUiStore } from '@/stores/ui'
import { ipc } from '@/lib/ipc'
import { t, setLocale } from '@/i18n'
import AppSidebar from '@/components/AppSidebar.vue'
import AppStatusBar from '@/components/AppStatusBar.vue'
import AppBottomBar from '@/components/AppBottomBar.vue'
import AppTitleBar from '@/components/AppTitleBar.vue'

const router = useRouter()
const route = useRoute()
const gatewayStore = useGatewayStore()
const configStore = useConfigStore()
const uiStore = useUiStore()

const currentRoute = computed(() => route.name)
const showLayout = computed(() => {
  return !['loading', 'setup'].includes(route.name)
})

function handleNavigate(routeName) {
  router.push({ name: routeName })
}

const repairState = ref('idle') // idle | repairing | success | failed

async function handleRepair() {
  repairState.value = 'repairing'
  try {
    const result = await ipc.doctorFix()
    if (result.ok) {
      repairState.value = 'success'
      await gatewayStore.refresh()
      setTimeout(() => { repairState.value = 'idle' }, 2000)
    } else {
      repairState.value = 'failed'
      setTimeout(() => { repairState.value = 'idle' }, 3000)
    }
  } catch {
    repairState.value = 'failed'
    setTimeout(() => { repairState.value = 'idle' }, 3000)
  }
}

function handleContact() {
  window.open('https://docs.openclaw.cn', '_blank')
}

let pollingTimer = null

onMounted(async () => {
  uiStore.init()

  // Listen for gateway events from main process
  ipc.onGatewayStatusChanged((data) => {
    gatewayStore.ready = data.ready
    if (data.ready) {
      gatewayStore.status = 'ready'
      gatewayStore.port = data.port || 0
      gatewayStore.mode = data.mode || 'local'
      gatewayStore.remoteUrl = data.remoteUrl || ''
      gatewayStore.restarting = false
    } else {
      gatewayStore.status = 'disconnected'
    }
  })

  ipc.onGatewayRestarted((data) => {
    gatewayStore.ready = data.ready
    gatewayStore.port = data.port || 0
    gatewayStore.mode = data.mode || 'local'
    gatewayStore.remoteUrl = data.remoteUrl || ''
    gatewayStore.status = 'ready'
    gatewayStore.restarting = false
  })

  ipc.onGatewayError((data) => {
    gatewayStore.status = 'error'
    gatewayStore.restarting = false
  })

  // Poll gateway status
  await gatewayStore.refresh()
  await configStore.load()

  // Apply saved language preference
  const settings = await ipc.getSettings()
  if (settings?.ui?.language) setLocale(settings.ui.language)
  // Apply theme
  if (settings?.ui?.theme) uiStore.setTheme(settings.ui.theme)

  // Route based on state
  if (!gatewayStore.setupDone) {
    router.replace({ name: 'setup' })
    return
  }

  if (gatewayStore.ready) {
    if (!gatewayStore.hasModel) {
      router.replace({ name: 'setup' })
    } else {
      router.replace({ name: 'chat' })
    }
  }

  // Poll only when setup is done but gateway isn't ready yet
  pollingTimer = setInterval(async () => {
    if (gatewayStore.ready) return
    await gatewayStore.refresh()
    if (gatewayStore.ready) {
      await configStore.load()
      if (!gatewayStore.hasModel) {
        router.replace({ name: 'setup' })
      } else {
        router.replace({ name: 'chat' })
      }
    }
  }, 3000)
})

onUnmounted(() => {
  if (pollingTimer) clearInterval(pollingTimer)
})
</script>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.app-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.app-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.app-content {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* ── Restart overlay ── */
.restart-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(4px);
}

.restart-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 48px;
  border-radius: 16px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
}

.restart-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.restart-text {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
}

.restart-sub {
  font-size: 13px;
  color: var(--color-text-tertiary);
}

.restart-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
}
.success-icon {
  background: rgba(34, 197, 94, 0.15);
  color: var(--color-success);
}
.fail-icon {
  background: rgba(239, 68, 68, 0.15);
  color: var(--color-error);
}

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.25s ease;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}
</style>
