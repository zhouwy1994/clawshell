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

        <!-- Voice -->
        <div v-if="activeTab === 'voice'" class="settings-section voice-section">
          <div class="section-block">
            <label class="section-label">{{ t('settings.voice.apiKey') }}</label>
            <input
              v-model="voiceApiKey"
              type="password"
              :placeholder="maskedVoiceApiKey || t('settings.voice.apiKeyPlaceholder')"
              class="section-input"
              autocomplete="off"
            />
          </div>
          <div class="section-block">
            <label class="checkbox-label">
              <input v-model="voiceShowText" type="checkbox" />
              <span>{{ t('settings.voice.showText') }}</span>
            </label>
            <p class="voice-hint">{{ t('settings.voice.showTextHint') }}</p>
          </div>
          <div class="section-block">
            <label class="section-label">{{ t('settings.voice.voice') }}</label>
            <p class="voice-hint">{{ t('settings.voice.voiceHint') }}</p>
            <p v-if="voiceLoading" class="voice-hint">{{ t('settings.voice.loading') }}</p>
            <p v-else-if="voiceLoadError" class="voice-error">{{ voiceLoadError }}</p>
            <p v-if="voicePreviewError" class="voice-error">{{ voicePreviewError }}</p>
            <div class="voice-card-grid">
              <div
                v-for="voice in voiceOptions"
                :key="voice.id"
                class="voice-card"
                :class="{ selected: voiceId === voice.id }"
                @click="voiceId = voice.id"
              >
                <span class="voice-card-name">{{ voice.name }}</span>
                <span class="voice-card-id">{{ voice.id }}</span>
                <span class="voice-card-desc">{{ voice.desc }}</span>
                <span v-if="voice.language" class="voice-card-lang">{{ voice.language }}</span>
                <span class="voice-card-actions">
                  <button
                    type="button"
                    class="voice-preview-btn"
                    :disabled="!voice.sampleUrl || previewingVoiceId === voice.id"
                    @click.stop="playVoiceSample(voice)"
                  >
                    {{ previewingVoiceId === voice.id ? t('settings.voice.previewing') : t('settings.voice.preview') }}
                  </button>
                </span>
              </div>
            </div>
          </div>
          <button class="btn btn-primary section-btn" @click="saveVoice">{{ t('common.save') }}</button>
          <div v-if="toast.show && toast.key === 'voice'" class="toast toast-success">{{ toast.msg }}</div>
        </div>

        <!-- Registry -->
        <div v-if="activeTab === 'registry'" class="settings-section">
          <div class="section-block">
            <label class="section-label">{{ t('settings.registry.npm') }}</label>
            <div class="radio-group">
              <label
                v-for="preset in NPM_REGISTRY_PRESETS"
                :key="preset.url"
                class="radio-item"
                :class="{ active: registryMode === 'preset' && npmRegistry === preset.url }"
              >
                <input
                  type="radio"
                  :value="preset.url"
                  v-model="npmRegistry"
                  @change="registryMode = 'preset'"
                />
                {{ t(preset.label) }}
              </label>
              <label class="radio-item" :class="{ active: registryMode === 'custom' }">
                <input type="radio" value="custom" v-model="registryMode" />
                {{ t('settings.registry.custom') }}
              </label>
            </div>
          </div>
          <div v-if="registryMode === 'custom'" class="section-block">
            <input v-model="customRegistry" type="text" placeholder="https://registry.example.com" class="section-input" />
          </div>
          <div class="section-block">
            <p class="registry-active-hint">{{ t('settings.registry.currentActive') }}: {{ npmRegistry }}</p>
            <p class="registry-hint-sub">{{ t('settings.registry.npmHint') }}</p>
          </div>
          <button class="btn btn-primary section-btn" @click="saveRegistry">{{ t('common.save') }}</button>
          <div v-if="toast.show && toast.key === 'registry'" class="toast toast-success">{{ toast.msg }}</div>
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
              <div class="about-utils-label">
                <span class="version-icon" v-html="getIcon('file', 16)"></span>
                <span class="version-name">{{ t('settings.gateway.dataDir') }}</span>
              </div>
              <span class="version-value data-dir-text">{{ dataDirDisplay }}</span>
            </div>
          </div>
          <div class="section-block">
            <div class="about-update-actions">
              <button class="btn btn-primary about-action-btn" :disabled="updateState === 'checking'" @click="checkUpdate">
                <span class="btn-icon" v-html="getIcon('arrows-clockwise', 16)"></span>
                <span>{{ updateState === 'checking' ? t('settings.about.checking') : t('settings.about.checkUpdate') }}</span>
              </button>
              <button class="btn btn-secondary about-action-btn" :disabled="upgradeState === 'upgrading'" @click="showUpgradeDialog">
                <span class="btn-icon" v-html="getIcon('rocket-launch', 16)"></span>
                <span>{{ upgradeState === 'upgrading' ? t('settings.about.upgrading') : t('settings.about.upgradeCore') }}</span>
              </button>
              <button class="btn btn-secondary about-action-btn" @click="openContact">
                <span class="btn-icon" v-html="getIcon('info', 16)"></span>
                <span>{{ t('settings.about.docs') }}</span>
              </button>
            </div>
            <p v-if="updateMsg" class="about-status-msg" :class="updateState">{{ updateMsg }}</p>
            <p v-if="upgradeMsg" class="about-status-msg" :class="upgradeState">{{ upgradeMsg }}</p>
          </div>

          <!-- Upgrade Version Selection Dialog -->
          <div v-if="upgradeDialogVisible" class="upgrade-dialog-overlay" @click.self="upgradeDialogVisible = false">
            <div class="upgrade-dialog">
              <h3 class="upgrade-dialog-title">{{ t('settings.about.selectVersion') }}</h3>
              <p v-if="versionsLoading" class="upgrade-dialog-loading">{{ t('settings.about.loadingVersions') }}</p>
              <template v-else>
                <div v-if="availableVersions.length === 0" class="upgrade-dialog-empty">{{ t('settings.about.noVersions') }}</div>
                <div v-else class="upgrade-version-cards">
                  <div
                    v-for="v in availableVersions"
                    :key="v"
                    class="version-card"
                    :class="{ current: v === openclawVersion }"
                  >
                    <div class="version-card-info">
                      <span class="version-card-text">{{ v }}</span>
                      <span v-if="v === openclawVersion" class="version-current-tag">{{ t('settings.about.currentVersion') }}</span>
                      <span v-else-if="installedVersions.includes(v)" class="version-installed-tag">{{ t('settings.about.installed') }}</span>
                    </div>
                    <div class="version-card-action">
                      <template v-if="v === openclawVersion">
                        <span class="version-card-status current">{{ t('settings.about.currentVersion') }}</span>
                      </template>
                      <template v-else-if="installedVersions.includes(v)">
                        <button class="btn btn-secondary version-card-btn" @click="switchToVersion(v)">{{ t('settings.about.switchVersion') }}</button>
                      </template>
                      <template v-else-if="downloadingVersion === v">
                        <div class="version-card-spinner">
                          <div class="mini-spinner"></div>
                          <span class="downloading-text">{{ t('settings.about.downloading') }}</span>
                        </div>
                      </template>
                      <template v-else>
                        <button class="btn btn-primary version-card-btn" @click="downloadVersion(v)">{{ t('settings.about.download') }}</button>
                      </template>
                    </div>
                  </div>
                </div>
                <div class="upgrade-dialog-footer">
                  <button class="btn btn-secondary" @click="upgradeDialogVisible = false">{{ t('common.cancel') }}</button>
                </div>
              </template>
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

// Voice
const voiceApiKey = ref('')
const maskedVoiceApiKey = ref('')
const voiceId = ref('longanhuan_v3')
const voiceShowText = ref(true)
const voiceLoading = ref(false)
const voiceLoadError = ref('')
const voicePreviewError = ref('')
const previewingVoiceId = ref('')
let previewAudio = null
const fallbackVoiceOptions = [
  { id: 'longanhuan_v3', name: '龙安欢（V3）', trait: '欢脱元气女', age: '20~30岁', language: '中文（普通话、广东话、东北话、河南话、湖南话、陕西话、山东话、四川话、安徽话）、英文', desc: '欢脱元气女 · 20~30岁', sampleUrl: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20251117/lolnxw/%E9%BE%99%E5%AE%89%E6%AC%A2.mp3' },
  { id: 'longxiaochun_v3', name: '龙小淳', trait: '知性积极女', age: '25~30岁', language: '中文（普通话）、英文', desc: '知性积极女 · 25~30岁', sampleUrl: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260105/flmrpr/%E9%BE%99%E5%B0%8F%E6%B7%B3.mp3' },
  { id: 'longxiaoxia_v3', name: '龙小夏', trait: '沉稳权威女', age: '25~30岁', language: '中文（普通话）、英文', desc: '沉稳权威女 · 25~30岁', sampleUrl: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260105/bncrea/%E9%BE%99%E5%B0%8F%E5%A4%8F.mp3' },
  { id: 'longhua_v3', name: '龙华', trait: '元气甜美女', age: '20~25岁', language: '中文（普通话）、英文', desc: '元气甜美女 · 20~25岁', sampleUrl: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260128/bmmeqr/%E9%BE%99%E5%8D%8E.mp3' },
  { id: 'longcheng_v3', name: '龙橙', trait: '智慧青年男', age: '20~25岁', language: '中文（普通话）、英文', desc: '智慧青年男 · 20~25岁', sampleUrl: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260105/qagbzd/%E9%BE%99%E6%A9%99.mp3' },
  { id: 'longlaotie_v3', name: '龙老铁', trait: '东北直率男', age: '25~30岁', language: '中文（东北话）、英文', desc: '东北直率男 · 25~30岁', sampleUrl: 'https://help-static-aliyun-doc.aliyuncs.com/file-manage-files/zh-CN/20260105/yuxzau/%E9%BE%99%E8%80%81%E9%93%81.mp3' },
]
const voiceOptions = ref([...fallbackVoiceOptions])

// Gateway
const autoStart = ref(false)
const startupTimeout = ref(120)

// Registry
const NPM_REGISTRY_PRESETS = [
  { label: 'settings.registry.presets.official', url: 'https://registry.npmjs.org' },
  { label: 'settings.registry.presets.taobao', url: 'https://registry.npmmirror.com' },
  { label: 'settings.registry.presets.tencent', url: 'https://mirrors.tencent.com/npm/' },
  { label: 'settings.registry.presets.huawei', url: 'https://repo.huaweicloud.com/repository/npm/' },
]
const npmRegistry = ref('https://registry.npmmirror.com')
const customRegistry = ref('')
const registryMode = ref('preset')

// Data directory (read-only, from CLAWSHELL_HOME env)
const dataDirDisplay = ref('')

// Avatars
const AVATAR_URLS = import.meta.glob('../../assets/images/avatars/avatar*.png', { eager: true, query: '?url', import: 'default' })
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
  { key: 'voice', icon: '🎙️', label: 'settings.tab.voice' },
  { key: 'registry', icon: '📦', label: 'settings.tab.registry' },
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
    if (sysInfo.dataDir) dataDirDisplay.value = sysInfo.dataDir
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

  const voice = settings.voice || {}
  voiceApiKey.value = voice.dashscopeApiKey || ''
  maskedVoiceApiKey.value = voice.dashscopeApiKey ? `${voice.dashscopeApiKey.slice(0, 6)}****${voice.dashscopeApiKey.slice(-4)}` : ''
  voiceId.value = voice.voice || 'longanhuan_v3'
  voiceShowText.value = voice.showImmersiveText !== false

  const gw = settings.gateway || {}
  autoStart.value = gw.autoStart || false
  startupTimeout.value = gw.startupTimeout || 120

  const reg = settings.registry || {}
  npmRegistry.value = reg.npm || 'https://registry.npmmirror.com'
  const isPreset = NPM_REGISTRY_PRESETS.some(p => p.url === npmRegistry.value)
  registryMode.value = isPreset ? 'preset' : 'custom'
  if (!isPreset) customRegistry.value = npmRegistry.value

  // dataDir is now read-only from CLAWSHELL_HOME env, populated via getSystemInfo
}

async function loadCosyVoiceVoices() {
  voiceLoading.value = true
  voiceLoadError.value = ''
  try {
    const res = await ipc.getCosyVoiceVoices()
    if (!res?.ok || !Array.isArray(res.voices) || res.voices.length === 0) {
      throw new Error(res?.error || '音色列表加载失败，已使用内置兜底列表')
    }
    voiceOptions.value = res.voices.map(voice => ({
      ...voice,
      desc: voice.desc || [voice.trait, voice.age].filter(Boolean).join(' · '),
    }))
  } catch (err) {
    voiceOptions.value = [...fallbackVoiceOptions]
    voiceLoadError.value = err.message || '音色列表加载失败，已使用内置兜底列表'
  } finally {
    if (voiceId.value && !voiceOptions.value.some(voice => voice.id === voiceId.value)) {
      voiceOptions.value = [
        { id: voiceId.value, name: voiceId.value, desc: '当前已保存音色', sampleUrl: '' },
        ...voiceOptions.value,
      ]
    }
    voiceLoading.value = false
  }
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

async function saveVoice() {
  await saveSettingsPatch({
    voice: {
      dashscopeApiKey: voiceApiKey.value.trim(),
      voice: voiceId.value,
      showImmersiveText: voiceShowText.value,
      asrModel: 'qwen3-asr-flash-realtime',
      ttsModel: voiceId.value.endsWith('_v3') ? 'cosyvoice-v3.5-flash' : 'cosyvoice-v3.5-plus',
    },
  })
  maskedVoiceApiKey.value = voiceApiKey.value ? `${voiceApiKey.value.slice(0, 6)}****${voiceApiKey.value.slice(-4)}` : ''
  showToast(t('common.saveSuccess'), 'voice')
}

async function playVoiceSample(voice) {
  if (!voice?.sampleUrl) return
  voicePreviewError.value = ''
  previewingVoiceId.value = voice.id
  try {
    if (previewAudio) {
      previewAudio.pause()
      previewAudio.removeAttribute('src')
      previewAudio.load()
    }
    const res = await ipc.getVoiceSampleDataUrl(voice.sampleUrl)
    const src = res?.ok && res.dataUrl ? res.dataUrl : voice.sampleUrl
    previewAudio = new Audio(src)
    previewAudio.onended = () => { previewingVoiceId.value = '' }
    previewAudio.onerror = () => {
      voicePreviewError.value = `试听失败：${voice.name || voice.id}`
      previewingVoiceId.value = ''
    }
    await previewAudio.play()
  } catch (err) {
    voicePreviewError.value = `试听失败：${err.message || err}`
    previewingVoiceId.value = ''
  }
}

async function saveRegistry() {
  const url = registryMode.value === 'custom' ? customRegistry.value : npmRegistry.value
  await saveSettingsPatch({
    registry: { npm: url },
  })
  npmRegistry.value = url
  showToast(t('common.saveSuccess'), 'registry')
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
const upgradeDialogVisible = ref(false)
const availableVersions = ref([])
const installedVersions = ref([])
const versionsLoading = ref(false)
const downloadingVersion = ref('')

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

async function showUpgradeDialog() {
  upgradeDialogVisible.value = true
  downloadingVersion.value = ''
  versionsLoading.value = true
  availableVersions.value = []
  try {
    const [availResult, installedList] = await Promise.all([
      ipc.getOpenClawAvailableVersions(),
      ipc.listOpenClawVersions(),
    ])
    console.log('[SettingsView] getOpenClawAvailableVersions result:', JSON.stringify(availResult))
    console.log('[SettingsView] listOpenClawVersions result:', JSON.stringify(installedList))
    installedVersions.value = (installedList || []).map(v => typeof v === 'string' ? v : v.version || v.dir)
    if (availResult.ok && availResult.versions) {
      const dateRe = /^[0-9]{4}\.[0-9]{1,2}\.[0-9]{1,2}$/
      availableVersions.value = [...availResult.versions]
      .filter(v => typeof v === 'string' && dateRe.test(v))
      .reverse()
      .slice(0, 50)
    } else {
      console.error('[SettingsView] getOpenClawAvailableVersions failed:', availResult.error)
      availableVersions.value = []
    }
  } catch (err) {
    console.error('[SettingsView] showUpgradeDialog exception:', err)
  }
  versionsLoading.value = false
}

async function downloadVersion(version) {
  downloadingVersion.value = version
  try {
    const result = await ipc.installOpenClawCore(version)
    console.log('[SettingsView] installOpenClawCore result:', JSON.stringify(result))
    if (result.ok) {
      if (!installedVersions.value.includes(version)) {
        installedVersions.value.push(version)
      }
    } else {
      upgradeMsg.value = t('settings.about.upgradeFailed') + (result.error ? `: ${result.error}` : '')
    }
  } catch (err) {
    upgradeMsg.value = t('settings.about.upgradeFailed') + `: ${err.message || err}`
  }
  downloadingVersion.value = ''
}

async function switchToVersion(version) {
  upgradeDialogVisible.value = false
  gatewayStore.restarting = true
  try {
    const result = await ipc.switchOpenClawVersion(version)
    console.log('[SettingsView] switchOpenClawVersion result:', JSON.stringify(result))
    if (result.ok) {
      await loadSystemInfo()
      openclawVersion.value = version
    } else {
      gatewayStore.restarting = false
      upgradeMsg.value = t('settings.about.switchFailed') + (result.error ? `: ${result.error}` : '')
      upgradeState.value = 'failed'
    }
  } catch (err) {
    gatewayStore.restarting = false
    upgradeMsg.value = t('settings.about.switchFailed') + `: ${err.message || err}`
    upgradeState.value = 'failed'
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
      upgradeMsg.value = t('settings.about.upgradeFailed') + (result.error ? `: ${result.error}` : '')
    }
  } catch (err) {
    upgradeState.value = 'failed'
    upgradeMsg.value = t('settings.about.upgradeFailed') + `: ${err.message || err}`
  }
}

function openContact() {
  window.open('https://docs.openclaw.cn', '_blank')
}

onMounted(async () => {
  await loadSettings()
  await loadCosyVoiceVoices()
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

/* Voice */
.voice-section {
  max-width: 760px;
}

.voice-hint {
  margin: 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.voice-error {
  margin: 0;
  color: var(--color-warning);
  font-size: var(--font-size-sm);
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text);
  font-size: var(--font-size-md);
  cursor: pointer;
}

.checkbox-label input {
  accent-color: var(--color-primary);
}

.voice-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
  max-width: 760px;
}

.voice-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-height: 132px;
  padding: 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-secondary);
  color: var(--color-text);
  cursor: pointer;
  text-align: left;
  transition: border-color 0.15s, transform 0.15s, background 0.15s;
}

.voice-card:hover {
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.voice-card.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.voice-card-name {
  font-weight: 700;
}

.voice-card-id {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.voice-card-desc {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.45;
}

.voice-card-lang {
  flex: 1;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  line-height: 1.45;
}

.voice-card-actions {
  display: flex;
  justify-content: flex-end;
  width: 100%;
}

.voice-preview-btn {
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.voice-preview-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

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
  align-items: center;
  gap: 10px;
}
.about-utils-label {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 130px;
  flex-shrink: 0;
}
.data-dir-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Upgrade Dialog */
.upgrade-dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.upgrade-dialog {
  background: var(--color-bg-elevated, #fff);
  border-radius: 12px;
  padding: 24px;
  width: 520px;
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
}
.upgrade-dialog-title {
  margin: 0 0 16px;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}
.upgrade-dialog-loading,
.upgrade-dialog-empty {
  text-align: center;
  color: var(--color-text-tertiary);
  padding: 24px 0;
}
.upgrade-version-cards {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  padding: 4px 2px;
}
.version-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--color-border, rgba(0,0,0,0.08));
  background: var(--color-bg, #fff);
  transition: border-color 0.15s, box-shadow 0.15s;
  gap: 12px;
}
.version-card:hover {
  border-color: var(--color-primary-light, rgba(255,107,53,0.3));
  box-shadow: 0 1px 6px rgba(255,107,53,0.08);
}
.version-card.current {
  border-color: var(--color-primary);
  background: var(--color-primary-light, rgba(255,107,53,0.05));
}
.version-card-info {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.version-card-text {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text);
  font-family: monospace;
}
.version-current-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--color-primary);
  color: #fff;
  flex-shrink: 0;
}
.version-installed-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(34, 197, 94, 0.12);
  color: var(--color-success);
  flex-shrink: 0;
}
.version-card-action {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}
.version-card-btn {
  padding: 5px 14px !important;
  font-size: 13px !important;
  border-radius: 6px !important;
}
.version-card-status {
  font-size: 12px;
  color: var(--color-primary);
  font-weight: 500;
}
.version-card-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 120px;
}
.version-card-spinner {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mini-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--color-border, rgba(0,0,0,0.12));
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.downloading-text {
  font-size: 13px;
  color: var(--color-text-tertiary);
}
.upgrade-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border, rgba(0,0,0,0.08));
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

/* Registry */
.registry-active-hint {
  font-size: 14px;
  color: var(--color-text);
  font-weight: 500;
}
.registry-hint-sub {
  font-size: 12px;
  color: var(--color-text-tertiary);
  margin-top: 4px;
}

</style>
