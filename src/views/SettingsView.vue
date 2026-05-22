<template>
  <div class="settings-view">
    <div class="settings-header">
      <h2>{{ t('settings.title') }}</h2>
    </div>
    <div class="settings-body">
      <div class="settings-sidebar">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="settings-nav-item"
          :class="{ active: activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          <span class="nav-icon">{{ tab.icon }}</span>
          <span class="nav-label">{{ t(tab.label) }}</span>
        </button>
      </div>
      <div class="settings-content">
        <!-- Profile -->
        <div v-if="activeTab === 'profile'" class="settings-section">
          <div class="section-block">
            <label class="section-label">{{ t('settings.profile.avatar') }}</label>
            <div class="profile-avatar-row">
              <div class="profile-avatar-preview">
                <img v-if="userAvatar" :src="userAvatar" class="avatar-img" />
                <span v-else class="avatar-letter">{{ userName?.charAt(0) || '?' }}</span>
              </div>
              <div class="avatar-grid">
                <img
                  v-for="url in avatars"
                  :key="url"
                  :src="url"
                  class="avatar-pick"
                  :class="{ selected: userAvatar === url }"
                  @click="userAvatar = userAvatar === url ? '' : url"
                />
                <button class="avatar-pick avatar-upload-btn" @click="uploadAvatar" :title="t('settings.profile.uploadAvatar')">
                  <span v-html="getIcon('plus', 16)"></span>
                </button>
              </div>
            </div>
          </div>
          <div class="section-block">
            <label class="section-label">{{ t('settings.profile.nickname') }}</label>
            <input v-model="userName" type="text" :placeholder="t('settings.profile.nicknamePlaceholder')" class="section-input" />
          </div>
          <div class="section-block">
            <label class="section-label">{{ t('settings.profile.bio') }}</label>
            <input v-model="userBio" type="text" :placeholder="t('settings.profile.bioPlaceholder')" class="section-input" />
          </div>
          <button class="btn btn-primary section-btn" @click="saveProfile">{{ t('common.save') }}</button>
          <div v-if="toast.show && toast.key === 'profile'" class="toast toast-success">{{ toast.msg }}</div>
        </div>

        <!-- Appearance -->
        <div v-if="activeTab === 'appearance'" class="settings-section">
          <div class="section-block">
            <label class="section-label">{{ t('settings.appearance.theme') }}</label>
            <div class="theme-cards">
              <div class="theme-card" :class="{ selected: uiStore.theme === 'dark' }" @click="uiStore.setTheme('dark')">
                <div class="theme-preview dark-preview">
                  <div class="preview-bar"></div>
                  <div class="preview-lines">
                    <div class="preview-line" style="width:80%"></div>
                    <div class="preview-line" style="width:60%"></div>
                  </div>
                </div>
                <span>{{ t('settings.appearance.themeDark') }}</span>
              </div>
              <div class="theme-card" :class="{ selected: uiStore.theme === 'light' }" @click="uiStore.setTheme('light')">
                <div class="theme-preview light-preview">
                  <div class="preview-bar"></div>
                  <div class="preview-lines">
                    <div class="preview-line" style="width:80%"></div>
                    <div class="preview-line" style="width:60%"></div>
                  </div>
                </div>
                <span>{{ t('settings.appearance.themeLight') }}</span>
              </div>
            </div>
          </div>
          <div class="section-block">
            <label class="section-label">{{ t('settings.appearance.fontSize') }}</label>
            <div class="radio-group">
              <label v-for="opt in fontSizeOpts" :key="opt.value" class="radio-item" :class="{ active: fontSize === opt.value }">
                <input type="radio" :value="opt.value" v-model="fontSize" />
                {{ t(opt.label) }}
              </label>
            </div>
          </div>
          <div class="section-block">
            <label class="section-label">{{ t('settings.appearance.fontFamily') }}</label>
            <select v-model="fontFamily" class="section-select">
              <option v-for="f in fontList" :key="f.value" :value="f.value">{{ f.label }}</option>
            </select>
          </div>
          <div class="section-block">
            <label class="section-label">{{ t('settings.appearance.language') }}</label>
            <div class="radio-group">
              <label class="radio-item" :class="{ active: locale === 'zh-CN' }">
                <input type="radio" value="zh-CN" v-model="langModel" />
                <svg class="lang-flag" width="20" height="14" viewBox="0 0 22 16"><rect width="22" height="16" rx="2" fill="#DE2910"/><polygon points="4,3 4.9,5.8 8,5.8 5.5,7.5 6.5,10.3 4,8.5 1.5,10.3 2.5,7.5 0,5.8 3.1,5.8" fill="#FFDE00"/><polygon points="8.5,2 8.8,2.9 9.7,2.9 9,3.4 9.2,4.3 8.5,3.8 7.8,4.3 8,3.4 7.3,2.9 8.2,2.9" fill="#FFDE00"/></svg>
                中文
              </label>
              <label class="radio-item" :class="{ active: locale === 'en' }">
                <input type="radio" value="en" v-model="langModel" />
                <svg class="lang-flag" width="20" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                English
              </label>
            </div>
          </div>
        </div>

        <!-- Chat -->
        <div v-if="activeTab === 'chat'" class="settings-section">
          <div class="section-block">
            <label class="section-label">{{ t('settings.chat.sendKey') }}</label>
            <div class="radio-group">
              <label class="radio-item" :class="{ active: sendKey === 'enter' }">
                <input type="radio" value="enter" v-model="sendKey" />
                {{ t('settings.chat.sendKeyEnter') }}
              </label>
              <label class="radio-item" :class="{ active: sendKey === 'ctrl+enter' }">
                <input type="radio" value="ctrl+enter" v-model="sendKey" />
                {{ t('settings.chat.sendKeyCtrlEnter') }}
              </label>
            </div>
          </div>
          <div class="section-block">
            <label class="section-label">{{ t('settings.chat.defaultAssistant') }}</label>
            <select v-model="defaultAssistant" class="section-select">
              <option value="">{{ t('common.default') }}</option>
              <option v-for="a in agentList" :key="a.id" :value="a.id">{{ a.name || a.id }}</option>
            </select>
          </div>
          <button class="btn btn-primary section-btn" @click="saveChat">{{ t('common.save') }}</button>
          <div v-if="toast.show && toast.key === 'chat'" class="toast toast-success">{{ toast.msg }}</div>
        </div>

        <!-- Gateway -->
        <div v-if="activeTab === 'gateway'" class="settings-section">
          <div class="section-block">
            <label class="section-label">{{ t('settings.gateway.status') }}</label>
            <div class="gateway-status-row">
              <span class="status-dot" :class="gatewayStatusClass"></span>
              <span class="status-text">{{ gatewayStatusText }}</span>
              <span v-if="gatewayStore.ready" class="status-port">:{{ gatewayStore.port }}</span>
            </div>
          </div>
          <div class="section-block">
            <label class="section-label">{{ t('settings.gateway.autoStart') }}</label>
            <label class="toggle-wrap">
              <input type="checkbox" v-model="autoStart" class="toggle-input" />
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="section-block">
            <label class="section-label">{{ t('settings.gateway.timeout') }}</label>
            <div class="timeout-row">
              <input v-model.number="startupTimeout" type="number" min="30" max="300" step="10" class="section-input timeout-input" />
              <span class="timeout-unit">{{ t('settings.gateway.timeoutUnit') }}</span>
            </div>
          </div>
          <div class="section-block">
            <div class="gateway-actions">
              <button class="btn btn-primary" :disabled="gatewayStore.restarting" @click="handleRestart">
                {{ gatewayStore.restarting ? t('settings.gateway.restarting') : t('settings.gateway.restart') }}
              </button>
                  <button class="btn btn-secondary" @click="openLogsDir">{{ t('settings.gateway.viewLogs') }}</button>
            </div>
          </div>
        </div>

        <!-- About -->
        <div v-if="activeTab === 'about'" class="settings-section">
          <div class="about-logo-area">
            <img src="@assets/images/logo/clawshell_logo_vector.svg" alt="ClawShell" class="about-logo-img" />
          </div>
          <div class="section-block">
            <label class="section-label">{{ t('settings.about.version') }}</label>
            <div class="about-version-list">
              <div class="about-version-row">
                <span class="version-icon" v-html="getIcon('package', 16)"></span>
                <span class="version-name">{{ t('settings.about.appVersion') }}</span>
                <span class="version-value">{{ appVersion }}</span>
              </div>
              <div class="about-version-row">
                <span class="version-icon" v-html="getIcon('brain', 16)"></span>
                <span class="version-name">{{ t('settings.about.openclawVersion') }}</span>
                <span class="version-value">{{ openclawVersion }}</span>
              </div>
              <div class="about-version-row">
                <span class="version-icon" v-html="getIcon('zap', 16)"></span>
                <span class="version-name">{{ t('settings.about.electronVersion') }}</span>
                <span class="version-value">{{ electronVersion }}</span>
              </div>
              <div class="about-version-row">
                <span class="version-icon" v-html="getIcon('settings', 16)"></span>
                <span class="version-name">{{ t('settings.about.nodeVersion') }}</span>
                <span class="version-value">{{ nodeVersion }}</span>
              </div>
              <div class="about-version-row">
                <span class="version-icon" v-html="getIcon('desktop', 16)"></span>
                <span class="version-name">{{ t('settings.about.osInfo') }}</span>
                <span class="version-value">{{ osInfo }}</span>
              </div>
            </div>
          </div>
      
          <div class="section-block about-utils">
            <div class="about-utils-row">
              <button class="btn btn-secondary about-action-btn" @click="openDataDir">
                <span class="btn-icon" v-html="getIcon('file', 16)"></span>
                <span>{{ t('settings.about.openDataDir') }}</span>
              </button>
              <button class="btn btn-secondary about-action-btn" @click="exportOpenclawJson">
                <span class="btn-icon" v-html="getIcon('arrow-square-up', 16)"></span>
                <span>{{ t('settings.about.exportConfig') }}</span>
              </button>
            </div>
            <div class="about-utils-row">
              <button class="btn btn-secondary about-action-btn" @click="importOpenclawJson">
                <span class="btn-icon" v-html="getIcon('package', 16)"></span>
                <span>{{ t('settings.about.importConfig') }}</span>
              </button>
              <button class="btn btn-secondary about-action-btn" @click="openContact">
                <span class="btn-icon" v-html="getIcon('info', 16)"></span>
                <span>{{ t('settings.about.docs') }}</span>
              </button>
            </div>
                <div class="section-block">
            <div class="about-update-actions">
              <button class="btn btn-primary about-action-btn" :disabled="updateState === 'checking'" @click="checkUpdate">
                <span class="btn-icon" v-html="getIcon('arrows-clockwise', 16)"></span>
                <span>{{ updateState === 'checking' ? t('settings.about.checking') : t('settings.about.checkUpdate') }}</span>
              </button>
              <button class="btn btn-secondary about-action-btn" :disabled="upgradeState === 'upgrading'" @click="upgradeCore">
                <span class="btn-icon" v-html="getIcon('rocket-launch', 16)"></span>
                <span>{{ upgradeState === 'upgrading' ? t('settings.about.upgrading') : t('settings.about.upgradeCore') }}</span>
              </button>
            </div>
            <p v-if="updateMsg" class="about-status-msg" :class="updateState">{{ updateMsg }}</p>
            <p v-if="upgradeMsg" class="about-status-msg" :class="upgradeState">{{ upgradeMsg }}</p>
          </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, reactive } from 'vue'
import { useUiStore } from '@/stores/ui'
import { useConfigStore } from '@/stores/config'
import { useGatewayStore } from '@/stores/gateway'
import { t, setLocale, currentLocale } from '@/i18n'
import { ipc } from '@/lib/ipc'
import { getIcon } from '@/lib/icons'

const uiStore = useUiStore()
const configStore = useConfigStore()
const gatewayStore = useGatewayStore()

const activeTab = ref('profile')
const locale = currentLocale

// Profile

// Profile
const userName = ref('')
const userAvatar = ref('')
const userBio = ref('')

// Appearance
const fontSize = ref('medium')
const fontFamily = ref('system')
const fontList = ref([
  { value: 'system', label: '系统默认' },
])

async function loadSystemFonts() {
  try {
    if (typeof queryLocalFonts !== 'function') return
    const fontDataList = await queryLocalFonts()
    const seen = new Set()
    const knownCN = {
      'LXGW WenKai': '霞鹜文楷',
      'Source Han Sans SC': '思源黑体',
      'Source Han Serif SC': '思源宋体',
      'Source Han Sans CN': '思源黑体 CN',
      'Source Han Serif CN': '思源宋体 CN',
      'Microsoft YaHei': '微软雅黑',
      'SimSun': '宋体',
      'SimHei': '黑体',
      'KaiTi': '楷体',
      'FangSong': '仿宋',
      'PingFang SC': '苹方',
      'PingFang HK': '苹方 HK',
      'PingFang TC': '苹方 TC',
      'Noto Sans SC': 'Noto Sans SC',
      'Noto Serif SC': 'Noto Serif SC',
      'LXGW WenKai TC': '霞鹜文楷 TC',
      'LXGW WenKai HK': '霞鹜文楷 HK',
      'ZCOOL XiaoWei': '站酷小薇',
      'ZCOOL QingKe HuangYou': '站酷庆科黄油',
      'Ma Shan Zheng': '马善政楷体',
      'Zhi Mang Xing': '志莽行书',
      'WenQuanYi Micro Hei': '文泉驿微米黑',
      'WenQuanYi Zen Hei': '文泉驿正黑',
      'Noto Sans CJK SC': 'Noto Sans CJK SC',
      'HarmonyOS Sans SC': 'HarmonyOS Sans',
      'Sarasa UI SC': '更纱黑体 UI SC',
      'Sarasa Gothic SC': '更纱黑体 SC',
    }
    for (const font of fontDataList) {
      if (seen.has(font.family)) continue
      seen.add(font.family)
      const label = knownCN[font.family] || font.family
      fontList.value.push({ value: font.family, label })
    }
  } catch {
    // API not available or permission denied, keep defaults
  }
}
const langModel = computed({
  get: () => locale.value,
  set: (v) => { setLocale(v); saveUiSettings() }
})

// Chat
const sendKey = ref('ctrl+enter')
const defaultAssistant = ref('')

// Gateway
const autoStart = ref(false)
const startupTimeout = ref(120)

// Avatars
const AVATAR_URLS = import.meta.glob('/assets/images/avatars/avatar*.png', { eager: true, query: '?url', import: 'default' })
const AVATAR_SRC_LIST = Object.entries(AVATAR_URLS)
  .sort(([a], [b]) => {
    const na = parseInt(a.match(/avatar(\d+)\.png/)?.[1] || '0')
    const nb = parseInt(b.match(/avatar(\d+)\.png/)?.[1] || '0')
    return na - nb
  })
  .map(([, url]) => url)

const avatars = ref([])
;(async () => {
  const results = await Promise.all(AVATAR_SRC_LIST.map(src => new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = 96; c.height = 96
      c.getContext('2d').drawImage(img, 0, 0, 96, 96)
      resolve(c.toDataURL('image/png'))
    }
    img.onerror = () => resolve('')
    img.src = src
  })))
  avatars.value = results.filter(Boolean)
})()

const fontSizeOpts = [
  { value: 'small', label: 'settings.appearance.fontSizeSmall' },
  { value: 'medium', label: 'settings.appearance.fontSizeMedium' },
  { value: 'large', label: 'settings.appearance.fontSizeLarge' },
]

const tabs = [
  { key: 'profile', icon: '👤', label: 'settings.tab.profile' },
  { key: 'appearance', icon: '🎨', label: 'settings.tab.appearance' },
  { key: 'chat', icon: '💬', label: 'settings.tab.chat' },
  { key: 'gateway', icon: '⚡', label: 'settings.tab.gateway' },
  { key: 'about', icon: 'ℹ️', label: 'settings.tab.about' },
]

const agentList = computed(() => configStore.config?.agents?.list || [])
const appVersion = ref('1.0.0')
const electronVersion = ref(navigator.userAgent.match(/Chrome\/(\d+\.\d+\.\d+)/)?.[1] || '-')
const nodeVersion = ref('-')
const openclawVersion = ref('-')
const osInfo = ref(navigator.platform || '-')

const gatewayStatusClass = computed(() => {
  if (gatewayStore.ready) return 'ready'
  if (gatewayStore.restarting) return 'starting'
  return 'stopped'
})

const gatewayStatusText = computed(() => {
  if (gatewayStore.restarting) return t('settings.gateway.starting')
  if (gatewayStore.ready) return t('settings.gateway.ready')
  return t('settings.gateway.stopped')
})

// Toast
const toast = reactive({ show: false, msg: '', key: '' })
let toastTimer = null
function showToast(msg, key) {
  clearTimeout(toastTimer)
  toast.show = true
  toast.msg = msg
  toast.key = key
  toastTimer = setTimeout(() => { toast.show = false }, 2000)
}

// System info from IPC
let sysInfo = {}
async function loadSystemInfo() {
  try {
    sysInfo = await ipc.getSystemInfo?.() || {}
    if (sysInfo.nodeVersion) nodeVersion.value = sysInfo.nodeVersion
    if (sysInfo.openclawVersion) openclawVersion.value = sysInfo.openclawVersion
    if (sysInfo.osInfo) osInfo.value = sysInfo.osInfo
    if (sysInfo.electronVersion) electronVersion.value = sysInfo.electronVersion
  } catch {}
}

// Load settings from clawshell-settings.json
let settings = {}

async function loadSettings() {
  settings = await ipc.getSettings()
  const user = settings.user || {}
  userName.value = user.name || ''
  userAvatar.value = user.avatar || ''
  userBio.value = user.bio || ''

  const ui = settings.ui || {}
  fontSize.value = ui.fontSize || 'medium'
  fontFamily.value = ui.fontFamily || 'system'
  if (ui.language) setLocale(ui.language)
  // Apply font size
  const sizeMap = { small: '12px', medium: '14px', large: '16px' }
  document.documentElement.style.setProperty('--font-size-md', sizeMap[fontSize.value] || '14px')
  // Apply font family
  applyFontFamily(fontFamily.value)

  const chat = settings.chat || {}
  sendKey.value = chat.sendKey || 'ctrl+enter'
  defaultAssistant.value = chat.defaultAssistant || ''

  const gw = settings.gateway || {}
  autoStart.value = gw.autoStart || false
  startupTimeout.value = gw.startupTimeout || 120
}

async function saveSettingsPatch(patch) {
  settings = { ...settings, ...patch }
  await ipc.saveSettings(settings)
}

async function saveUiSettings() {
  await saveSettingsPatch({
    ui: { theme: uiStore.theme, fontSize: fontSize.value, fontFamily: fontFamily.value, language: locale.value },
  })
}

async function saveProfile() {
  await saveSettingsPatch({
    user: { name: userName.value, avatar: userAvatar.value, bio: userBio.value },
  })
  showToast(t('common.saveSuccess'), 'profile')
}

async function uploadAvatar() {
  try {
    const result = await ipc.pickAvatarImage()
    if (result.ok && result.dataUrl) {
      userAvatar.value = result.dataUrl
      await saveSettingsPatch({
        user: { name: userName.value, avatar: result.dataUrl, bio: userBio.value },
      })
      showToast(t('common.saveSuccess'), 'profile')
    }
  } catch {}
}

async function saveChat() {
  await saveSettingsPatch({
    chat: { sendKey: sendKey.value, defaultAssistant: defaultAssistant.value },
  })
  showToast(t('common.saveSuccess'), 'chat')
}

async function handleRestart() {
  gatewayStore.restarting = true
  await saveSettingsPatch({
    gateway: { autoStart: autoStart.value, startupTimeout: startupTimeout.value },
  })
  try { await ipc.restartGateway() } catch {
    gatewayStore.restarting = false
  }
}

async function openDataDir() {
  try { await ipc.openDataDir() } catch {}
}

async function openLogsDir() {
  try { await ipc.openLogsDir() } catch {}
}

async function exportOpenclawJson() {
  try {
    const result = await ipc.exportConfig()
    if (result.ok) showToast(t('settings.about.exportSuccess'), 'about')
  } catch {}
}

async function importOpenclawJson() {
  try {
    const result = await ipc.importConfig()
    if (result.ok) {
      showToast(t('settings.about.importSuccess'), 'about')
      await configStore.load()
      loadSettings()
      gatewayStore.restarting = true
      try { await ipc.restartGateway() } catch {}
    }
  } catch {}
}

// Update & Upgrade
const updateState = ref('idle')
const updateMsg = ref('')
const upgradeState = ref('idle')
const upgradeMsg = ref('')

async function checkUpdate() {
  updateState.value = 'checking'
  updateMsg.value = ''
  try {
    const result = await ipc.checkUpdate()
    if (result.hasUpdate) {
      updateState.value = 'available'
      updateMsg.value = t('settings.about.updateAvailable').replace('{version}', result.version)
    } else {
      updateState.value = 'latest'
      updateMsg.value = t('settings.about.upToDate')
    }
  } catch {
    updateState.value = 'failed'
    updateMsg.value = t('settings.about.updateFailed')
  }
}

async function upgradeCore() {
  upgradeState.value = 'upgrading'
  upgradeMsg.value = ''
  try {
    const result = await ipc.upgradeOpenClaw()
    if (result.ok) {
      upgradeState.value = 'success'
      upgradeMsg.value = t('settings.about.upgradeSuccess')
      await loadSystemInfo()
    } else {
      upgradeState.value = 'failed'
      upgradeMsg.value = t('settings.about.upgradeFailed')
    }
  } catch {
    upgradeState.value = 'failed'
    upgradeMsg.value = t('settings.about.upgradeFailed')
  }
}

function openContact() {
  window.open('https://docs.openclaw.cn', '_blank')
}

onMounted(async () => {
  await loadSettings()
  await loadSystemInfo()
  await loadSystemFonts()
})

watch(fontSize, (val) => {
  const sizeMap = { small: '12px', medium: '14px', large: '16px' }
  document.documentElement.style.setProperty('--font-size-md', sizeMap[val] || '14px')
  saveSettingsPatch({ ui: { theme: uiStore.theme, fontSize: val, fontFamily: fontFamily.value, language: locale.value } })
})

function applyFontFamily(val) {
  if (val === 'system' || !val) {
    document.documentElement.style.removeProperty('--font-family')
  } else {
    document.documentElement.style.setProperty('--font-family', `${val}, -apple-system, BlinkMacSystemFont, sans-serif`)
  }
}

watch(fontFamily, (val) => {
  applyFontFamily(val)
  saveSettingsPatch({ ui: { theme: uiStore.theme, fontSize: fontSize.value, fontFamily: val, language: locale.value } })
})

watch(autoStart, () => {
  saveSettingsPatch({
    gateway: { autoStart: autoStart.value, startupTimeout: startupTimeout.value },
  })
})
</script>

<style scoped>
.settings-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px 12px;
  border-bottom: 1px solid var(--color-border);
}

.settings-header h2 {
  font-size: 20px;
  font-weight: 600;
  color: var(--color-text);
}

.settings-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* Left sidebar */
.settings-sidebar {
  width: 160px;
  flex-shrink: 0;
  padding: 12px 8px;
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  color: var(--color-text-secondary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
  width: 100%;
}
.settings-nav-item:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text);
}
.settings-nav-item.active {
  background: var(--color-primary-light);
  color: var(--color-primary);
  font-weight: 600;
}
.nav-icon { font-size: 16px; width: 20px; text-align: center; }
.nav-label { white-space: nowrap; }

/* Content area */
.settings-content {
  flex: 1;
  padding: 24px 32px;
  overflow-y: auto;
}

.settings-section {
  display: flex;
  flex-direction: column;
  gap: 24px;
  max-width: 560px;
}

.section-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text);
}

.section-input {
  width: 100%;
  max-width: 360px;
}

.section-select {
  width: 100%;
  max-width: 360px;
}

.section-btn {
  align-self: flex-start;
  margin-top: 8px;
}

/* Avatar */
.profile-avatar-row {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.profile-avatar-preview {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--color-bg-tertiary);
  border: 2px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}
.profile-avatar-preview .avatar-img { width: 100%; height: 100%; object-fit: cover; }
.profile-avatar-preview .avatar-letter { font-size: 20px; font-weight: 600; color: var(--color-text-secondary); }

.avatar-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.avatar-pick {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  object-fit: cover;
  transition: border-color 0.15s, transform 0.15s;
}
.avatar-pick:hover { transform: scale(1.15); }
.avatar-pick.selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.avatar-upload-btn {
  background: var(--color-bg-tertiary);
  border: 2px dashed var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--color-text-tertiary);
  padding: 0;
}
.avatar-upload-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-light);
}
.avatar-upload-btn :deep(svg) {
  display: block;
}

/* Theme cards */
.theme-cards {
  display: flex;
  gap: 12px;
}
.theme-card {
  border: 2px solid var(--color-border);
  border-radius: 10px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s;
  text-align: center;
  font-size: 13px;
  color: var(--color-text-secondary);
}
.theme-card:hover { border-color: var(--color-text-tertiary); }
.theme-card.selected {
  border-color: var(--color-primary);
  color: var(--color-primary);
}
.theme-preview {
  width: 120px;
  height: 80px;
  border-radius: 6px;
  margin-bottom: 6px;
  overflow: hidden;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.dark-preview { background: #0a0a0a; }
.light-preview { background: #f5f5f5; }
.preview-bar {
  height: 6px;
  width: 50%;
  border-radius: 3px;
}
.dark-preview .preview-bar { background: #333; }
.light-preview .preview-bar { background: #ddd; }
.preview-lines { display: flex; flex-direction: column; gap: 4px; }
.preview-line {
  height: 4px;
  border-radius: 2px;
}
.dark-preview .preview-line { background: #2a2a2a; }
.light-preview .preview-line { background: #e0e0e0; }

/* Radio group */
.radio-group {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.radio-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: var(--color-text-secondary);
  transition: all 0.15s;
}
.radio-item:hover { border-color: var(--color-text-tertiary); }
.radio-item.active {
  border-color: var(--color-primary);
  color: var(--color-primary);
  background: var(--color-primary-light);
}
.radio-item input { display: none; }

/* Gateway */
.gateway-status-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.status-dot.ready { background: var(--color-success); box-shadow: 0 0 6px var(--color-success); }
.status-dot.starting { background: var(--color-warning); animation: pulse 1s infinite; }
.status-dot.stopped { background: var(--color-text-tertiary); }
@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
.status-text { font-size: 14px; color: var(--color-text); font-weight: 500; }
.status-port { font-size: 13px; color: var(--color-text-tertiary); }

.gateway-actions {
  display: flex;
  gap: 8px;
}

/* Toggle switch */
.toggle-wrap {
  display: inline-flex;
  align-items: center;
  cursor: pointer;
}
.toggle-input { display: none; }
.toggle-slider {
  width: 44px;
  height: 24px;
  border-radius: 12px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  position: relative;
  transition: all 0.25s;
}
.toggle-slider::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--color-text-secondary);
  top: 2px;
  left: 2px;
  transition: all 0.25s;
}
.toggle-input:checked + .toggle-slider {
  background: var(--color-primary);
  border-color: var(--color-primary);
}
.toggle-input:checked + .toggle-slider::after {
  transform: translateX(20px);
  background: #fff;
}

/* Timeout row */
.timeout-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.timeout-input { width: 100px; }
.timeout-unit { font-size: 13px; color: var(--color-text-tertiary); }

/* About */
.about-logo-area {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
}
.about-logo-img {
  width: 120px;
  height: 120px;
  object-fit: contain;
}
.about-version-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.about-version-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 0;
}
.version-icon {
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-primary);
  flex-shrink: 0;
}
.version-icon :deep(svg) {
  display: block;
}
.version-name {
  color: var(--color-text-tertiary);
  font-size: 14px;
  min-width: 100px;
}
.version-value {
  color: var(--color-text);
  font-size: 14px;
  font-weight: 500;
}
.about-update-actions {
  display: flex;
  gap: 10px;
}
.about-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.about-action-btn .btn-icon {
  display: flex;
  align-items: center;
}
.about-action-btn .btn-icon :deep(svg) {
  display: block;
}
.about-status-msg {
  margin-top: 6px;
  font-size: 13px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 6px;
}
.about-status-msg.latest, .about-status-msg.success {
  background: rgba(34, 197, 94, 0.1);
  color: var(--color-success);
}
.about-status-msg.available {
  background: var(--color-primary-light);
  color: var(--color-primary);
}
.about-status-msg.failed {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}
.about-utils {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.about-utils-row {
  display: flex;
  gap: 10px;
}

/* Buttons */
.btn {
  display: inline-block;
  padding: 10px 24px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-primary {
  background: var(--color-primary);
  color: #fff;
}
.btn-primary:hover {
  background: #e55a25;
}
.btn-primary:disabled {
  background: var(--color-border);
  color: var(--color-text-tertiary);
  cursor: not-allowed;
}
.btn-secondary {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}
.btn-secondary:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

/* Toast */
.toast {
  margin-top: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  animation: toastIn 0.25s ease;
}
.toast-success {
  background: rgba(34, 197, 94, 0.1);
  color: var(--color-success);
  border: 1px solid rgba(34, 197, 94, 0.2);
}
@keyframes toastIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Lang flag */
.lang-flag {
  vertical-align: middle;
  flex-shrink: 0;
}

</style>
