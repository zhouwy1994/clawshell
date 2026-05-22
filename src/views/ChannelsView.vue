<template>
  <div class="channels-view">
    <div class="channels-container">
      <!-- Steps indicator -->
      <div class="steps">
        <div class="step" :class="{ active: step === 1, done: step > 1 }">
          <span class="num">{{ step > 1 ? '✓' : '1' }}</span>{{ t('channels.step1') }}
        </div>
        <div class="step" :class="{ active: step === 2, done: step > 2 }">
          <span class="num">{{ step > 2 ? '✓' : '2' }}</span>{{ t('channels.step2') }}
        </div>
        <div class="step" :class="{ active: step === 3, done: step > 3 }">
          <span class="num">{{ step > 3 ? '✓' : '3' }}</span>{{ t('channels.step3') }}
        </div>
        <div class="step" :class="{ active: step === 4 }">
          <span class="num">4</span>{{ t('channels.step4') }}
        </div>
      </div>

      <!-- Step 1: Select Channels + Install Plugins -->
      <div v-if="step === 1" class="section">
        <div class="channel-tabs">
          <button class="channel-tab" :class="{ active: channelTab === 'cn' }" @click="channelTab = 'cn'">
            <svg class="tab-flag" width="22" height="16" viewBox="0 0 22 16"><rect width="22" height="16" rx="2" fill="#DE2910"/><polygon points="4,3 4.9,5.8 8,5.8 5.5,7.5 6.5,10.3 4,8.5 1.5,10.3 2.5,7.5 0,5.8 3.1,5.8" fill="#FFDE00"/><polygon points="8.5,2 8.8,2.9 9.7,2.9 9,3.4 9.2,4.3 8.5,3.8 7.8,4.3 8,3.4 7.3,2.9 8.2,2.9" fill="#FFDE00"/><polygon points="10.5,4 10.2,4.9 10.8,5.5 10,5.5 9.7,6.4 9.4,5.5 8.6,5.5 9.2,4.9 8.9,4 9.7,4.5" fill="#FFDE00"/><polygon points="10.5,7 10.2,7.9 10.8,8.5 10,8.5 9.7,9.4 9.4,8.5 8.6,8.5 9.2,7.9 8.9,7 9.7,7.5" fill="#FFDE00"/><polygon points="8.5,9 8.8,9.9 9.7,9.9 9,10.4 9.2,11.3 8.5,10.8 7.8,11.3 8,10.4 7.3,9.9 8.2,9.9" fill="#FFDE00"/></svg>
            <span class="tab-label">{{ t('channels.domestic') }}</span>
          </button>
          <button class="channel-tab" :class="{ active: channelTab === 'global' }" @click="channelTab = 'global'">
            <svg class="tab-flag" width="22" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            <span class="tab-label">{{ t('channels.international') }}</span>
          </button>
        </div>
        <div class="channel-grid">
          <div
            v-for="ch in filteredChannels"
            :key="ch.id"
            class="model-card channel-card"
            :class="{ selected: selectedChannel === ch.id, configured: isConfigured(ch.id) }"
            @click="toggleChannel(ch.id)"
          >
            <span class="check" v-if="selectedChannel === ch.id">✓</span>
            <h4><span class="ch-icon" v-html="getIcon(ch.icon, 18)"></span> {{ ch.name }}</h4>
            <p>{{ ch.desc }}</p>
            <span v-if="isConfigured(ch.id)" class="current-badge configured-badge">{{ t('channels.configured') }}</span>
            <!-- Plugin needed but not installed -->
            <div
              v-if="ch.pluginSpec && !isPluginInstalled(ch.id)"
              class="channel-form plugin-status"
              :class="{ open: selectedChannel === ch.id }"
              @click.stop
            >
              <template v-if="installingPlugins[ch.id]">
                <p class="hint installing-text" style="margin-top:8px;">{{ t('channels.installing') }}</p>
              </template>
              <template v-else>
                <p class="hint">{{ t('channels.needPlugin') }}</p>
                <p v-if="pluginInstallErrors[ch.id]" class="hint" style="color: var(--color-error);">{{ pluginInstallErrors[ch.id] }}</p>
                <button class="btn btn-primary btn-install" @click="installPlugin(ch.id)">{{ t('channels.installPlugin') }}</button>
              </template>
            </div>
            <!-- Plugin already installed or no plugin needed -->
            <div
              v-else-if="selectedChannel === ch.id"
              class="channel-form"
              :class="{ open: true }"
              @click.stop
            >
              <p class="hint" style="color: #4caf50;">{{ t('channels.pluginReady') }}</p>
            </div>
          </div>
        </div>
        <!-- Full-width terminal for active plugin install -->
        <div
          v-if="activeTerminalChannel"
          class="install-terminal-wrap"
          :ref="el => { if (el) terminalRefs[activeTerminalChannel] = el }"
        >
          <div class="terminal-header">
            <span class="ch-icon" v-html="getIcon(activeTerminalDef?.icon, 16)"></span> {{ activeTerminalDef?.name }} — {{ t('channels.installOutput') }}
            <span v-if="!installingPlugins[activeTerminalChannel]" class="terminal-done" :class="{ ok: !pluginInstallErrors[activeTerminalChannel] }">
              {{ pluginInstallErrors[activeTerminalChannel] ? t('channels.installFailed') : t('channels.installDone') }}
            </span>
            <button class="btn-copy" @click="copyTerminalLog(activeTerminalChannel)">{{ t('channels.copyLog') }}</button>
          </div>
          <pre class="terminal-output" @click.self="$event.target.select && $event.target.select()">{{ installLogs[activeTerminalChannel] || '' }}</pre>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" :disabled="!canGoStep2" @click="step = 2">
            {{ t('channels.nextStep') }}
          </button>
        </div>
      </div>

      <!-- Step 2: Fill credentials -->
      <div v-if="step === 2" class="section">
        <h2>{{ t('channels.fillConfig') }}</h2>
        <p class="desc" v-if="selectedChannelDef"><span class="ch-icon" v-html="getIcon(selectedChannelDef.icon, 18)"></span> {{ selectedChannelDef.name }}</p>

        <template v-if="selectedChannelDef">
          <!-- No credential fields (plugin-managed) -->
          <div v-if="!selectedChannelDef.fields || selectedChannelDef.fields.length === 0" class="config-summary">
            <div class="config-summary-header">
              <span><span class="ch-icon" v-html="getIcon(selectedChannelDef.icon, 16)"></span> {{ selectedChannelDef.name }}</span>
            </div>
            <div class="config-form">
              <p class="hint">{{ t('channels.pluginManaged') }}</p>
            </div>
          </div>

          <!-- Has credential fields — multi-bot list -->
          <template v-else>
            <div class="bot-list">
              <div
                v-for="(bot, idx) in formData[selectedChannelDef.id]"
                :key="bot.id"
                class="bot-card"
              >
                <div class="bot-header" @click="activeBotIndex = activeBotIndex === idx ? -1 : idx">
                  <div class="bot-info">
                    <span class="bot-badge">{{ idx + 1 }}</span>
                    <span class="bot-label">{{ bot._name || 'Bot ' + (idx + 1) }}</span>
                    <span class="bot-status" :class="{ filled: isBotFilled(bot) }">
                      {{ isBotFilled(bot) ? t('channels.filled') : t('channels.notFilled') }}
                    </span>
                  </div>
                  <div class="bot-actions" @click.stop>
                    <button class="btn-icon btn-delete" @click="removeBot(idx)" :title="t('channels.removeBot')">✕</button>
                    <span class="bot-expand-icon">{{ activeBotIndex === idx ? '▲' : '▼' }}</span>
                  </div>
                </div>
                <div v-if="activeBotIndex === idx" class="bot-form">
                  <div class="form-group">
                    <label>{{ t('channels.botName') }}</label>
                    <input v-model="bot._name" type="text" :placeholder="'Bot ' + (idx + 1)" />
                  </div>
                  <div v-for="f in selectedChannelDef.fields" :key="f.key" class="form-group">
                    <label>{{ f.label }} <span class="required">*</span></label>
                    <div class="input-wrap">
                      <input
                        v-model="bot[f.key]"
                        :type="f.secret && !showSecrets[selectedChannelDef.id + '.' + bot.id + '.' + f.key] ? 'password' : 'text'"
                        :placeholder="f.placeholder"
                      />
                      <button
                        v-if="f.secret"
                        class="toggle-pw"
                        @click="toggleSecret(selectedChannelDef.id, bot.id, f.key)"
                      >{{ showSecrets[selectedChannelDef.id + '.' + bot.id + '.' + f.key] ? '🙈' : '👁' }}</button>
                    </div>
                    <p v-if="f.hint" class="hint">
                      <a v-if="f.hintLink" :href="f.hintLink" target="_blank">{{ f.hint }}</a>
                      <span v-else>{{ f.hint }}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <button class="btn btn-secondary btn-add-bot" @click="addBot">
              {{ t('channels.addBot') }}
            </button>
          </template>
        </template>

        <div v-else class="empty-tip">
          {{ t('channels.selectChannelFirst') }}
        </div>

        <div class="btn-row">
          <button class="btn btn-secondary" @click="step = 1">{{ t('channels.goBack') }}</button>
          <button class="btn btn-primary" :disabled="!canGoStep3" @click="goStep3">{{ t('channels.nextStep') }}</button>
        </div>
      </div>

      <!-- Step 3: Bind assistants + Save -->
      <div v-if="step === 3" class="section">
        <h2>{{ t('channels.bindAssistant') }}</h2>
        <p class="desc">{{ t('channels.bindAssistantDesc') }}</p>

        <div v-for="row in bindingRows" :key="row.channelId + '-' + row.accountId" class="binding-row">
          <div class="binding-info">
            <span class="binding-channel"><span class="ch-icon" v-html="getIcon(row.icon, 16)"></span> {{ row.channelName }}</span>
            <span class="binding-account">{{ row.accountLabel }}</span>
          </div>
          <select v-model="row.agentId" class="binding-select">
            <option value="">{{ t('channels.defaultAgent') }}</option>
            <option v-for="a in agentList" :key="a.id" :value="a.id">{{ a.name || a.id }}</option>
          </select>
        </div>

        <div v-if="bindingRows.length === 0" class="empty-tip">
          {{ t('channels.noChannels') }}
        </div>

        <div class="btn-row">
          <button class="btn btn-secondary" @click="step = 2">{{ t('channels.goBack') }}</button>
          <button class="btn btn-primary" :disabled="saving" @click="handleSaveAll">
            {{ saving ? t('channels.saving') : t('channels.finishSave') }}
          </button>
        </div>
      </div>

      <!-- Step 4: Done -->
      <div v-if="step === 4" class="section result">
        <div class="result-icon">✅</div>
        <h2>{{ t('channels.configDone') }}</h2>
        <p>{{ t('channels.channelSaved').replace('{name}', selectedChannelDef?.name || '') }}</p>
        <div class="result-model"><span class="ch-icon" v-html="getIcon(selectedChannelDef?.icon, 20)"></span> {{ selectedChannelDef?.name }}</div>
        <div class="btn-row" style="justify-content: center; margin-top: 24px;">
          <button class="btn btn-secondary" @click="resetAndNew">{{ t('channels.continueConfig') }}</button>
          <button v-if="!restartDone" class="btn btn-primary" @click="handleRestart">{{ t('channels.activateChannel') }}</button>
          <template v-if="restartDone && gatewayStore.ready">
            <span class="restart-ok">{{ t('channels.channelActivated') }}</span>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import { useConfigStore } from '@/stores/config'
import { useGatewayStore } from '@/stores/gateway'
import { t, locale } from '@/i18n'
import { getIcon } from '@/lib/icons'

const router = useRouter()
const configStore = useConfigStore()
const gatewayStore = useGatewayStore()

const step = ref(1)
const selectedChannel = ref('')
const formData = reactive({})
const showSecrets = reactive({})
const saving = ref(false)
const restartDone = ref(false)
const activeInput = ref('')
const activeBotIndex = ref(-1)
const installingPlugins = reactive({})  // { channelId: true } while installing
const pluginInstallErrors = reactive({})  // { channelId: 'error msg' }
const installLogs = reactive({})  // { channelId: 'full output text' }
let currentInstallingChannel = ref('')
const terminalRefs = reactive({})
const channelTab = ref('cn')

const filteredChannels = computed(() => {
  return CHANNEL_DEFS.value.filter(ch => ch.region === channelTab.value)
})

watch(channelTab, () => {
  selectedChannel.value = ''
})

const CHANNEL_DEFS = computed(() => {
  const isEn = locale.value === 'en'
  const raw = [
    // ── 国内渠道 ──
    {
      id: 'qqbot',
      icon: 'qq',
      name: 'QQ Bot',
      nameEn: 'QQ Bot',
      region: 'cn',
      desc: '接入 QQ 群/私聊机器人',
      descEn: 'Connect QQ Group/Private Bot',
      pluginSpec: '@openclaw/qqbot',
      installCmd: { type: 'openclaw', spec: '@openclaw/qqbot' },
      fields: [
        { key: 'appId', label: 'App ID', placeholder: '应用 ID', placeholderEn: 'App ID', secret: false },
        { key: 'clientSecret', label: 'Client Secret', placeholder: '应用密钥', placeholderEn: 'App Secret', secret: true, hint: '→ 从 QQ 开放平台获取', hintEn: '→ Get from QQ Open Platform', hintLink: 'https://q.qq.com' },
      ],
    },
    {
      id: 'feishu',
      icon: 'feishu',
      name: '飞书',
      nameEn: 'Feishu (Lark)',
      region: 'cn',
      desc: '接入飞书机器人',
      descEn: 'Connect Feishu Bot',
      pluginSpec: '@openclaw/feishu',
      installCmd: { type: 'openclaw', spec: '@openclaw/feishu' },
      fields: [
        { key: 'appId', label: 'App ID', placeholder: 'cli_xxx...', secret: false },
        { key: 'appSecret', label: 'App Secret', placeholder: '应用密钥', placeholderEn: 'App Secret', secret: true, hint: '→ 从飞书开放平台获取', hintEn: '→ Get from Feishu Open Platform', hintLink: 'https://open.feishu.cn/app' },
      ],
    },
    {
      id: 'wecom',
      icon: 'wecom',
      name: '企业微信',
      nameEn: 'WeCom',
      region: 'cn',
      desc: '接入企业微信机器人',
      descEn: 'Connect WeCom Bot',
      pluginSpec: 'openclaw-wecom',
      installCmd: { type: 'openclaw', spec: 'openclaw-wecom' },
      fields: [
        { key: 'botId', label: 'Bot ID', placeholder: 'aib...', secret: false },
        { key: 'secret', label: 'Secret', placeholder: '密钥', placeholderEn: 'Secret', secret: true, hint: '→ 从企业微信管理后台获取', hintEn: '→ Get from WeCom Admin Console', hintLink: 'https://work.weixin.qq.com' },
      ],
    },
    {
      id: 'dingtalk',
      icon: 'dingtalk',
      name: '钉钉',
      nameEn: 'DingTalk',
      region: 'cn',
      desc: '接入钉钉机器人',
      descEn: 'Connect DingTalk Bot',
      pluginSpec: '@soimy/dingtalk',
      installCmd: { type: 'openclaw', spec: '@soimy/dingtalk' },
      fields: [
        { key: 'clientId', label: 'Client ID (AppKey)', placeholder: 'dingxxxxxx', secret: false },
        { key: 'clientSecret', label: 'Client Secret (AppSecret)', placeholder: '应用密钥', placeholderEn: 'App Secret', secret: true, hint: '→ 从钉钉开放平台获取', hintEn: '→ Get from DingTalk Open Platform', hintLink: 'https://open-dev.dingtalk.com' },
      ],
    },
    {
      id: 'openclaw-weixin',
      icon: 'wechat',
      name: '微信',
      nameEn: 'WeChat',
      region: 'cn',
      desc: '接入微信（插件管理）',
      descEn: 'Connect WeChat (plugin managed)',
      pluginSpec: '@tencent-weixin/openclaw-weixin',
      installCmd: { type: 'npx', args: ['-y', '@tencent-weixin/openclaw-weixin-cli@latest', 'install', '--registry=https://registry.npmmirror.com'] },
      fields: null,
    },
    // ── 国际渠道 ──
    {
      id: 'telegram',
      icon: 'telegram',
      name: 'Telegram',
      nameEn: 'Telegram',
      region: 'global',
      desc: '接入 Telegram Bot',
      descEn: 'Connect Telegram Bot',
      pluginSpec: 'openclaw-telegram',
      installCmd: { type: 'openclaw', spec: 'openclaw-telegram' },
      fields: [
        { key: 'token', label: 'Bot Token', placeholder: '123456:ABC-DEF...', secret: true, hint: '→ 从 @BotFather 获取', hintEn: '→ Get from @BotFather', hintLink: 'https://t.me/BotFather' },
      ],
    },
    {
      id: 'discord',
      icon: 'discord',
      name: 'Discord',
      nameEn: 'Discord',
      region: 'global',
      desc: '接入 Discord Bot',
      descEn: 'Connect Discord Bot',
      pluginSpec: 'openclaw-discord',
      installCmd: { type: 'openclaw', spec: 'openclaw-discord' },
      fields: [
        { key: 'token', label: 'Bot Token', placeholder: 'MTk4Nj...', secret: true, hint: '→ 从 Discord Developer Portal 获取', hintEn: '→ Get from Discord Developer Portal', hintLink: 'https://discord.com/developers/applications' },
        { key: 'applicationId', label: 'Application ID', placeholder: '1234567890...', secret: false, hint: '→ 从应用 General Information 页获取', hintEn: '→ Get from app General Information page' },
      ],
    },
    {
      id: 'slack',
      icon: 'slack',
      name: 'Slack',
      nameEn: 'Slack',
      region: 'global',
      desc: '接入 Slack Bot',
      descEn: 'Connect Slack Bot',
      pluginSpec: 'openclaw-slack',
      installCmd: { type: 'openclaw', spec: 'openclaw-slack' },
      fields: [
        { key: 'botToken', label: 'Bot Token (xoxb-)', placeholder: 'xoxb-xxxx-xxxx...', secret: true, hint: '→ 从 Slack API 获取', hintEn: '→ Get from Slack API', hintLink: 'https://api.slack.com/apps' },
        { key: 'appToken', label: 'App Token (xapp-)', placeholder: 'xapp-1-xxxx...', secret: true, hint: '→ Socket Mode 使用的 App-Level Token', hintEn: '→ App-Level Token for Socket Mode' },
      ],
    },
    {
      id: 'whatsapp',
      icon: 'whatsapp',
      name: 'WhatsApp',
      nameEn: 'WhatsApp',
      region: 'global',
      desc: '接入 WhatsApp Business',
      descEn: 'Connect WhatsApp Business',
      pluginSpec: 'openclaw-whatsapp',
      installCmd: { type: 'openclaw', spec: 'openclaw-whatsapp' },
      fields: [
        { key: 'phoneNumberId', label: 'Phone Number ID', placeholder: '123456789012345', secret: false, hint: '→ 从 Meta Business 设置获取', hintEn: '→ Get from Meta Business Settings', hintLink: 'https://business.facebook.com/wa/manage/phone-numbers' },
        { key: 'accessToken', label: 'Access Token', placeholder: 'EAAx...', secret: true, hint: '→ 从 Meta 应用面板生成永久 Token', hintEn: '→ Generate permanent token from Meta app panel' },
      ],
    },
    {
      id: 'line',
      icon: 'line',
      name: 'LINE',
      nameEn: 'LINE',
      region: 'global',
      desc: '接入 LINE Bot',
      descEn: 'Connect LINE Bot',
      pluginSpec: 'openclaw-line',
      installCmd: { type: 'openclaw', spec: 'openclaw-line' },
      fields: [
        { key: 'channelAccessToken', label: 'Channel Access Token', placeholder: '长期访问令牌', placeholderEn: 'Long-lived access token', secret: true, hint: '→ 从 LINE Developers Console 获取', hintEn: '→ Get from LINE Developers Console', hintLink: 'https://developers.line.biz/console' },
        { key: 'channelSecret', label: 'Channel Secret', placeholder: '通道密钥', placeholderEn: 'Channel secret', secret: true, hint: '→ Messaging API 设置页', hintEn: '→ Messaging API settings page' },
      ],
    },
  ]
  // Apply locale to fields
  return raw.map(ch => ({
    ...ch,
    name: isEn && ch.nameEn ? ch.nameEn : ch.name,
    desc: isEn && ch.descEn ? ch.descEn : ch.desc,
    fields: ch.fields?.map(f => ({
      ...f,
      placeholder: isEn && f.placeholderEn ? f.placeholderEn : f.placeholder,
      hint: isEn && f.hintEn ? f.hintEn : f.hint,
    })) || ch.fields,
  }))
})

const selectedChannelDef = computed(() => {
  return CHANNEL_DEFS.value.find(ch => ch.id === selectedChannel.value) || null
})

const activeTerminalChannel = computed(() => {
  const ids = Object.keys(installLogs).filter(id => installLogs[id])
  return ids.length > 0 ? ids[ids.length - 1] : ''
})

const activeTerminalDef = computed(() => {
  return CHANNEL_DEFS.value.find(c => c.id === activeTerminalChannel.value)
})

const agentList = computed(() => {
  return configStore.config?.agents?.list || []
})

const isWeixinInstalled = computed(() => {
  const installs = configStore.config?.plugins?.installs?.['openclaw-weixin']
  return !!installs
})

function isPluginInstalled(channelId) {
  const ch = CHANNEL_DEFS.value.find(c => c.id === channelId)
  if (!ch?.pluginSpec) return true  // no plugin needed
  const cfg = configStore.config
  // Check plugins.installs
  const installs = cfg?.plugins?.installs || {}
  if (installs[channelId]) return true
  // Check plugins.entries (enabled plugins)
  const entries = cfg?.plugins?.entries || {}
  if (entries[channelId]?.enabled) return true
  // Check plugins.allow list
  const allow = cfg?.plugins?.allow || []
  if (allow.includes(channelId)) return true
  // Match by spec/name in installs
  for (const key of Object.keys(installs)) {
    const entry = installs[key]
    if (entry?.resolvedSpec?.startsWith(ch.pluginSpec)) return true
    if (entry?.resolvedName === ch.pluginSpec) return true
    if (entry?.spec?.includes(ch.pluginSpec)) return true
  }
  // Match by spec in entries
  for (const key of Object.keys(entries)) {
    if (key === ch.pluginSpec && entries[key]?.enabled) return true
    if (key.includes(ch.pluginSpec) || ch.pluginSpec.includes(key)) {
      if (entries[key]?.enabled) return true
    }
  }
  return false
}

async function installPlugin(channelId) {
  const ch = CHANNEL_DEFS.value.find(c => c.id === channelId)
  if (!ch?.installCmd) return
  installingPlugins[channelId] = true
  pluginInstallErrors[channelId] = ''
  installLogs[channelId] = ''
  currentInstallingChannel.value = channelId

  // Listen for streaming output
  let removeListener = null
  if (window.clawshell?.onPluginInstallOutput) {
    removeListener = window.clawshell.onPluginInstallOutput((data) => {
      if (data.stream === 'stdout' || data.stream === 'stderr') {
        installLogs[channelId] = (installLogs[channelId] || '') + data.text
      } else if (data.stream === 'exit') {
        if (data.error) {
          installLogs[channelId] = (installLogs[channelId] || '') + '\n❌ ' + data.error
        }
      }
    })
  }

  try {
    const { ipc } = await import('@/lib/ipc')
    const result = await ipc.installChannelPlugin(ch.installCmd)
    if (result.ok) {
      installLogs[channelId] = (installLogs[channelId] || '') + '\n' + t('channels.installComplete')
      await configStore.load()
    } else {
      pluginInstallErrors[channelId] = result.error || t('channels.installFailedMsg')
      installLogs[channelId] = (installLogs[channelId] || '') + '\n❌ ' + (result.error || t('channels.installFailedMsg'))
    }
  } catch (err) {
    pluginInstallErrors[channelId] = err.message || t('channels.installFailedMsg')
  }
  installingPlugins[channelId] = false
  if (removeListener) removeListener()
}

const canGoStep2 = computed(() => {
  if (!selectedChannel.value) return false
  const ch = CHANNEL_DEFS.value.find(c => c.id === selectedChannel.value)
  if (!ch) return false
  if (ch.pluginSpec && !isPluginInstalled(selectedChannel.value)) return false
  if (installingPlugins[selectedChannel.value]) return false
  return true
})

function isConfigured(channelId) {
  const ch = configStore.config?.channels?.[channelId]
  if (!ch) return false
  if (channelId === 'openclaw-weixin') return !!ch.channelConfigUpdatedAt
  // New accounts structure
  if (ch.accounts && Object.keys(ch.accounts).length > 0) return true
  // Legacy flat config
  return !!(ch.appId || ch.token || ch.botId || ch.clientId)
}

function initFormData(channelId) {
  if (formData[channelId]) return
  const ch = CHANNEL_DEFS.value.find(c => c.id === channelId)
  if (!ch || !ch.fields || ch.fields.length === 0) {
    formData[channelId] = []
    return
  }

  const existing = configStore.config?.channels?.[channelId] || {}
  const accounts = existing.accounts
  if (accounts && Object.keys(accounts).length > 0) {
    formData[channelId] = Object.entries(accounts).map(([acctId, acctData]) => {
      const bot = { id: acctId, _name: acctData._name || acctId }
      for (const f of ch.fields) {
        bot[f.key] = acctData[f.key] || ''
      }
      return bot
    })
  } else {
    // Migrate old flat config to array
    formData[channelId] = [{
      id: 'default',
      _name: t('channels.defaultBot'),
      ...Object.fromEntries(ch.fields.map(f => [f.key, existing[f.key] || ''])),
    }]
  }
}

function setFormField(channelId, key, value) {
  if (!formData[channelId]) formData[channelId] = {}
  formData[channelId][key] = value
}

let botCounter = 0
function addBot() {
  const ch = selectedChannelDef.value
  if (!ch || !ch.fields) return
  const bots = formData[selectedChannel.value]
  botCounter++
  const bot = { id: 'bot_' + Date.now() + '_' + botCounter, _name: '' }
  for (const f of ch.fields) {
    bot[f.key] = ''
  }
  bots.push(bot)
  activeBotIndex.value = bots.length - 1
}

async function removeBot(idx) {
  const channelId = selectedChannel.value
  const chDef = CHANNEL_DEFS.value.find(c => c.id === channelId)
  const bots = formData[channelId]
  const removedId = bots[idx]?.id
  bots.splice(idx, 1)
  if (activeBotIndex.value >= bots.length) activeBotIndex.value = bots.length - 1

  // Save updated config
  if (chDef?.fields) {
    const accounts = {}
    for (const bot of bots) {
      const entry = { _name: bot._name }
      for (const f of chDef.fields) {
        entry[f.key] = bot[f.key] || ''
      }
      accounts[bot.id] = entry
    }
    const existing = configStore.config?.channels?.[channelId] || {}
    const merged = { ...existing, accounts, enabled: true }
    for (const f of chDef.fields) {
      delete merged[f.key]
    }
    await configStore.saveChannelConfig(channelId, merged)
  }

  // Remove bindings for deleted bot
  if (removedId) {
    const existingBindings = configStore.config?.bindings || []
    const filtered = existingBindings.filter(
      b => !(b.match?.channel === channelId && b.match?.accountId === removedId)
    )
    await configStore.saveBindings(filtered)
  }
}

function isBotFilled(bot) {
  const ch = selectedChannelDef.value
  if (!ch || !ch.fields) return true
  return ch.fields.every(f => (bot[f.key] || '').trim() !== '')
}

function toggleSecret(channelId, botId, key) {
  const k = channelId + '.' + botId + '.' + key
  showSecrets[k] = !showSecrets[k]
}

function toggleChannel(channelId) {
  if (selectedChannel.value === channelId) {
    selectedChannel.value = ''
  } else {
    selectedChannel.value = channelId
    initFormData(channelId)
    activeBotIndex.value = 0
  }
}

function removeChannel() {
  selectedChannel.value = ''
}

function maskValue(val) {
  if (!val) return t('channels.notFilled')
  if (val.length <= 8) return '****'
  return val.slice(0, 4) + '****' + val.slice(-4)
}

const bindingRows = ref([])

function buildBindingRows() {
  const rows = []
  const channelId = selectedChannel.value
  if (!channelId) { bindingRows.value = rows; return }

  const existingBindings = configStore.config?.bindings || []
  const chDef = CHANNEL_DEFS.value.find(c => c.id === channelId)
  const bots = formData[channelId] || []
  if (!chDef) { bindingRows.value = rows; return }

    for (const bot of bots) {
      const existing = existingBindings.find(
        b => b.match?.channel === channelId && b.match?.accountId === bot.id
      )
      rows.push({
        channelId,
        channelName: chDef.name,
        icon: chDef.icon,
        accountId: bot.id,
        accountLabel: bot._name || bot.id,
        agentId: existing?.agentId || '',
      })
    }
    if (rows.length === 0) {
      const existing = existingBindings.find(
        b => b.match?.channel === channelId && b.match?.accountId === 'default'
      )
      rows.push({
        channelId,
        channelName: chDef.name,
        icon: chDef.icon,
        accountId: 'default',
        accountLabel: t('channels.defaultAccount'),
        agentId: existing?.agentId || '',
      })
    }
  bindingRows.value = rows
}

const canGoStep3 = computed(() => {
  const ch = selectedChannelDef.value
  if (!ch) return false
  if (!ch.fields || ch.fields.length === 0) return true
  const bots = formData[selectedChannel.value] || []
  if (bots.length === 0) return false
  return bots.every(bot => ch.fields.every(f => (bot[f.key] || '').trim() !== ''))
})

function goStep3() {
  buildBindingRows()
  step.value = 3
}

async function handleSaveAll() {
  saving.value = true
  try {
    const channelId = selectedChannel.value
    if (!channelId) { saving.value = false; return }

    const chDef = CHANNEL_DEFS.value.find(c => c.id === channelId)
    if (chDef?.fields) {
      const bots = formData[channelId] || []
      const accounts = {}
      for (const bot of bots) {
        const entry = { _name: bot._name }
        for (const f of chDef.fields) {
          entry[f.key] = bot[f.key] || ''
        }
        accounts[bot.id] = entry
      }
      const existing = configStore.config?.channels?.[channelId] || {}
      const merged = { ...existing, accounts, enabled: true }
      // Remove old flat fields if migrating
      for (const f of chDef.fields) {
        delete merged[f.key]
      }
      await configStore.saveChannelConfig(channelId, merged)
    }

    const existingBindings = configStore.config?.bindings || []
    const otherBindings = existingBindings.filter(b => {
      return b.match?.channel !== channelId
    })
    const newBindings = bindingRows.value
      .filter(row => row.agentId)
      .map(row => ({
        type: 'route',
        agentId: row.agentId,
        match: {
          channel: row.channelId,
          accountId: row.accountId,
        },
      }))
    await configStore.saveBindings([...otherBindings, ...newBindings])

    restartDone.value = false
    step.value = 4
  } catch (err) {
    console.error('Failed to save:', err)
  }
  saving.value = false
}

function goChat() {
  router.push({ name: 'chat' })
}

async function handleRestart() {
  gatewayStore.restarting = true
  restartDone.value = true
  try { await window.clawshell.restartGateway() } catch {
    gatewayStore.restarting = false
  }
}

function resetAndNew() {
  step.value = 1
  selectedChannel.value = ''
  restartDone.value = false
  for (const key of Object.keys(installLogs)) {
    delete installLogs[key]
  }
}

function copyTerminalLog(channelId) {
  const text = installLogs[channelId] || ''
  navigator.clipboard.writeText(text).then(() => {
    const btn = document.querySelector('.btn-copy')
    if (btn) {
      btn.textContent = t('channels.copied')
      setTimeout(() => { btn.textContent = t('channels.copyLog') }, 1500)
    }
  })
}

onMounted(async () => {
  await configStore.load()
  for (const ch of CHANNEL_DEFS.value) {
    initFormData(ch.id)
  }
})

watch(step, (val) => {
  if (val === 3) {
    buildBindingRows()
  }
})

watch(installLogs, () => {
  nextTick(() => {
    for (const id of Object.keys(terminalRefs)) {
      const el = terminalRefs[id]
      if (el) el.scrollTop = el.scrollHeight
    }
  })
}, { deep: true })
</script>

<style scoped>
.channels-view {
  height: 100%;
  overflow-y: auto;
  padding: 20px;
}

.channels-container {
  max-width: 680px;
  margin: 0 auto;
}

/* Steps */
.steps {
  display: flex;
  gap: 0;
  margin-bottom: 24px;
  background: var(--color-bg-tertiary);
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid var(--color-border);
}

.step {
  flex: 1;
  text-align: center;
  padding: 12px 8px;
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  cursor: default;
  transition: all 0.2s;
}

.step.active {
  color: var(--color-primary);
  background: rgba(255, 107, 53, 0.08);
  font-weight: 600;
}

.step.done {
  color: #4caf50;
}

.num {
  display: inline-block;
  width: 22px;
  height: 22px;
  line-height: 22px;
  border-radius: 50%;
  background: var(--color-border);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  margin-right: 4px;
}

.step.active .num {
  background: var(--color-primary);
  color: #fff;
}

.step.done .num {
  background: #4caf50;
  color: #fff;
}

/* Section */
.section {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
}

.section h2 {
  color: var(--color-primary);
  font-size: var(--font-size-lg);
  margin-bottom: 6px;
}

.desc {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  margin-bottom: 16px;
}

/* Channel tabs */
.channel-tabs {
  display: flex;
  gap: 0;
  margin-bottom: 20px;
  border-bottom: 2px solid var(--color-border);
}
.channel-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 24px;
  border: none;
  border-bottom: 3px solid transparent;
  margin-bottom: -2px;
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: 15px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.25s ease;
  position: relative;
}
.channel-tab .tab-flag { width: 22px; height: 16px; flex-shrink: 0; }
.channel-tab .tab-label { letter-spacing: 0.5px; }
.channel-tab:hover {
  color: var(--color-text-secondary);
  background: var(--color-bg-secondary);
}
.channel-tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  background: var(--color-primary-light);
  font-weight: 600;
}

/* Channel grid */
.channel-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 16px;
}

.ch-icon {
  display: inline-flex;
  vertical-align: middle;
  position: relative;
  top: -1px;
  color: var(--color-primary);
}
.ch-icon :deep(svg) {
  display: block;
}

.channel-card {
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.channel-card:hover {
  border-color: var(--color-text-tertiary);
  transform: translateY(-1px);
}

.channel-card.selected {
  border-color: var(--color-primary);
  background: rgba(255, 107, 53, 0.06);
}

.channel-card h4 {
  color: var(--color-text);
  font-size: var(--font-size-base);
  margin-bottom: 4px;
}

.channel-card p {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.check {
  position: absolute;
  top: 8px;
  right: 10px;
  color: var(--color-primary);
  font-size: 1.2em;
}

.current-badge {
  position: absolute;
  top: 8px;
  right: 10px;
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  border-radius: 10px;
  font-weight: 500;
}

.configured-badge {
  background: rgba(76, 175, 80, 0.2);
  color: #4caf50;
}

.channel-card.selected .configured-badge {
  display: none;
}

/* Channel form (expandable) */
.channel-form {
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease, padding-top 0.3s ease;
  padding-top: 0;
  margin-top: 0;
  border-top: none;
}

.channel-form.open {
  max-height: 400px;
  padding-top: 12px;
  margin-top: 10px;
  border-top: 1px solid var(--color-border);
}

.channel-form .form-group {
  margin-bottom: 10px;
}

.channel-form label {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.channel-form input {
  font-size: var(--font-size-sm);
  padding: 9px 12px;
}

.weixin-status.open {
  max-height: 100px;
}

.plugin-status.open {
  max-height: none;
  overflow: visible;
}

.btn-install {
  padding: 8px 20px;
  font-size: var(--font-size-xs);
  margin-top: 8px;
}

.install-terminal-wrap {
  background: #0a0a0a;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-top: 12px;
  max-height: 420px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.terminal-header {
  padding: 8px 14px;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-copy {
  margin-left: auto;
  background: none;
  border: 1px solid #444;
  color: var(--color-text-tertiary);
  font-size: 11px;
  padding: 2px 10px;
  border-radius: 4px;
  cursor: pointer;
}

.btn-copy:hover {
  border-color: #666;
  color: #ccc;
}

.terminal-done {
  float: right;
  color: var(--color-error);
}

.terminal-done.ok {
  color: #4caf50;
}

.terminal-output {
  color: #ccc;
  font-family: 'Cascadia Code', 'Fira Code', 'Consolas', monospace;
  font-size: 12px;
  line-height: 1.5;
  padding: 14px 16px;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
  overflow-y: auto;
  max-height: 380px;
  flex: 1;
  user-select: text;
  cursor: text;
}

.installing-text {
  color: var(--color-primary);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* Forms */
.form-group {
  margin-bottom: 16px;
}

label {
  display: block;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
  font-size: var(--font-size-sm);
}

input[type="text"],
input[type="password"] {
  width: 100%;
  padding: 11px 14px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  color: var(--color-text);
  font-size: var(--font-size-sm);
  outline: none;
  transition: border-color 0.2s;
}

input:focus {
  border-color: var(--color-primary);
}

.input-wrap {
  position: relative;
}

.input-wrap input {
  padding-right: 44px;
}

.toggle-pw {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  cursor: pointer;
  font-size: var(--font-size-sm);
}

.toggle-pw:hover {
  color: var(--color-text-secondary);
}

.required { color: var(--color-error); }

.hint {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  margin-top: 4px;
}

.hint a {
  color: var(--color-primary);
  text-decoration: none;
}

.hint a:hover {
  text-decoration: underline;
}

/* Bot list (Step 2) */
.bot-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.bot-card {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--color-bg-primary);
}
.bot-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.15s;
}
.bot-header:hover { background: var(--color-bg-secondary); }
.bot-info {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bot-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}
.bot-label {
  font-weight: 500;
  color: var(--color-text);
}
.bot-status {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.bot-status.filled { color: var(--color-success); }
.bot-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.bot-expand-icon {
  font-size: 12px;
  color: var(--color-text-tertiary);
}
.btn-icon {
  background: none;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-tertiary);
  transition: all 0.15s;
}
.btn-delete:hover { border-color: var(--color-error); color: var(--color-error); }
.bot-form {
  padding: 0 14px 14px;
  border-top: 1px solid var(--color-border);
}
.btn-add-bot {
  display: block;
  width: 100%;
  padding: 8px;
  text-align: center;
  border: 1px dashed var(--color-border);
  background: transparent;
  color: var(--color-text-secondary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}
.btn-add-bot:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

/* Config summary (Step 2) */
.config-summary {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 14px 16px;
  margin-bottom: 10px;
}

.config-summary-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--color-text);
}

.config-summary-fields {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.config-form {
  padding-top: 8px;
}

.config-form .form-group {
  margin-bottom: 10px;
}

.config-field {
  display: flex;
  gap: 8px;
  font-size: var(--font-size-sm);
}

.field-label {
  color: var(--color-text-tertiary);
  min-width: 100px;
}

.field-value {
  color: var(--color-text-secondary);
}

/* Binding rows (Step 3) */
.binding-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-bottom: 8px;
}

.binding-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.binding-channel {
  font-weight: 600;
  color: var(--color-text);
}

.binding-account {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  background: var(--color-bg-tertiary);
  padding: 2px 8px;
  border-radius: 10px;
}

.binding-select {
  appearance: none;
  background: var(--color-bg-tertiary);
  color: var(--color-text);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 6px 28px 6px 10px;
  font-size: var(--font-size-sm);
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 8px center;
  background-size: 12px;
  min-width: 140px;
}

.binding-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

/* Buttons */
.btn {
  display: inline-block;
  padding: 12px 28px;
  border: none;
  border-radius: 8px;
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.15s;
  font-weight: 500;
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
}

.btn-secondary:hover {
  background: var(--color-border);
}

.btn-row {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  justify-content: flex-end;
}

.btn-text {
  background: none;
  border: none;
  cursor: pointer;
  font-size: var(--font-size-xs);
  padding: 2px 4px;
}

.text-danger {
  color: var(--color-error);
}

.text-danger:hover {
  text-decoration: underline;
}

.empty-tip {
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  padding: 20px 0;
}

.save-status {
  text-align: center;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  padding: 8px;
}

/* Result */
.result {
  text-align: center;
  padding: 40px 24px;
}

.result-icon { font-size: 48px; margin-bottom: 12px; }
.result h2 { color: var(--color-success); margin-bottom: 8px; }

.result-model {
  color: var(--color-primary);
  font-size: var(--font-size-lg);
  font-weight: 600;
  margin-top: 12px;
  padding: 8px 16px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-md);
  display: inline-block;
}

.restart-ok {
  color: var(--color-success);
  font-size: var(--font-size-sm);
  font-weight: 500;
  padding: 10px 18px;
}
</style>
