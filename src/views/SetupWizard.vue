<template>
  <div class="setup-view">
    <!-- Starting overlay -->
    <Transition name="overlay">
      <div v-if="startingGateway" class="restart-overlay">
        <div class="restart-card">
          <div class="restart-spinner"></div>
          <div class="restart-text">{{ t('setup.starting') }}</div>
          <div class="restart-sub">{{ t('setup.startingSub') }}</div>
        </div>
      </div>
    </Transition>

    <div class="setup-toolbar">
      <button class="toolbar-btn lang-toggle" @click="toggleLang" :title="locale === 'zh-CN' ? 'English' : '中文'">
        🌐 {{ locale === 'zh-CN' ? 'EN' : '中' }}
      </button>
      <button class="toolbar-btn theme-toggle" @click="toggleTheme" :title="isDark ? t('statusbar.toggleLight') : t('statusbar.toggleDark')">
        {{ isDark ? '☀️' : '🌙' }}
      </button>
    </div>
    <div class="setup-card">
      <div class="setup-logo"><img src="@assets/images/logo/clawshell_logo.png" alt="ClawShell" /></div>
      <h1 class="setup-title">{{ t('setup.title') }}</h1>
      <p class="setup-subtitle">{{ stepSubtitle }}</p>

      <div class="setup-steps">
        <div class="step" :class="{ active: step === 0, done: step > 0 }">
          <span class="step-num">{{ step > 0 ? '✓' : '1' }}</span>
          <span class="step-label">{{ t('setup.step0.title') }}</span>
        </div>
        <div class="step-line" :class="{ done: step > 0 }"></div>
        <div class="step" :class="{ active: step === 1, done: step > 1 }">
          <span class="step-num">{{ step > 1 ? '✓' : '2' }}</span>
          <span class="step-label">{{ t('setup.stepModel.title') }}</span>
        </div>
        <div class="step-line" :class="{ done: step > 1 }"></div>
        <div class="step" :class="{ active: step === 2, done: step > 2 }">
          <span class="step-num">{{ step > 2 ? '✓' : '3' }}</span>
          <span class="step-label">{{ t('setup.stepEmployee.title') }}</span>
        </div>
        <div class="step-line" :class="{ done: step > 2 }"></div>
        <div class="step" :class="{ active: step === 3 }">
          <span class="step-num">4</span>
          <span class="step-label">{{ t('setup.step3.title') }}</span>
        </div>
      </div>

      <div class="setup-content">
        <!-- Step 0: Choose connection mode -->
        <div v-if="step === 0" class="step-content">
          <p>{{ t('setup.step0.subtitle') }}</p>
          <div class="mode-grid">
            <button class="mode-option" :class="{ selected: connectionMode === 'local' }" @click="connectionMode = 'local'">
              <span class="mode-icon">🖥️</span>
              <span class="mode-name">{{ t('setup.step0.local') }}</span>
              <span class="mode-desc">{{ t('setup.step0.localDesc') }}</span>
            </button>
            <button class="mode-option" :class="{ selected: connectionMode === 'remote' }" @click="connectionMode = 'remote'">
              <span class="mode-icon">🌐</span>
              <span class="mode-name">{{ t('setup.step0.remote') }}</span>
              <span class="mode-desc">{{ t('setup.step0.remoteDesc') }}</span>
            </button>
          </div>
          <!-- Local mode: core status -->
          <div v-if="connectionMode === 'local'" class="core-status">
            <div v-if="coreChecking" class="core-checking">...</div>
            <div v-else-if="coreInstalled" class="core-ok">
              <span class="core-icon">✅</span>
              <span>{{ t('setup.step0.coreInstalled') }}</span>
            </div>
            <div v-else class="core-missing">
              <p>{{ t('setup.step0.coreNotInstalled') }}</p>
              <button
                v-if="!coreInstalling"
                class="btn-download"
                @click="downloadCore"
              >{{ t('setup.step0.downloadCore') }}</button>
              <div v-else class="download-progress">
                <div class="progress-bar"><div class="progress-fill"></div></div>
                <span>{{ t('setup.step0.downloading') }}</span>
              </div>
              <p v-if="coreInstallError" class="core-error">{{ coreInstallError }}</p>
            </div>
          </div>
          <!-- Remote mode: connection fields -->
          <div v-if="connectionMode === 'remote'" class="remote-fields">
            <input v-model="remoteUrl" type="text" class="key-input" :placeholder="t('setup.step0.remoteUrlPlaceholder')" />
            <input v-model="remoteToken" type="text" class="key-input" :placeholder="t('setup.step0.remoteTokenPlaceholder')" />
            <input v-model="remotePassword" type="password" class="key-input" :placeholder="t('setup.step0.remotePasswordPlaceholder')" />
          </div>
        </div>

        <!-- Step 1: Configure Model (API key expands inside card) -->
        <div v-if="step === 1" class="step-content">
          <p>{{ t('setup.stepModel.subtitle') }}</p>
          <div class="model-grid">
            <div
              v-for="model in PRESETS"
              :key="model.id"
              class="model-card"
              :class="{ selected: selectedModel === model.id }"
              @click="toggleModel(model.id)"
            >
              <div class="model-card-header">
                <span class="model-logo" v-html="getModelIcon(model.id, 20)"></span>
                <span class="model-name">{{ model.name }}</span>
                <span v-for="tag in model.tags" :key="tag" class="model-tag" :class="tagClass(tag)">{{ tag }}</span>
              </div>
              <!-- Expand key input inside selected card -->
              <div v-if="selectedModel === model.id" class="model-card-expand" @click.stop>
                <template v-if="model.isCustom">
                  <div class="form-group">
                    <label>{{ t('setup.stepModel.apiBaseUrl') }}</label>
                    <input v-model="customBase" type="text" placeholder="https://api.example.com/v1" />
                  </div>
                  <div class="form-group">
                    <label>{{ t('setup.stepModel.modelName') }}</label>
                    <input v-model="customModel" type="text" placeholder="gpt-4o" />
                  </div>
                </template>
                <div class="form-group">
                  <label>{{ t('setup.stepModel.apiKey') }}</label>
                  <input
                    v-model="apiKey"
                    type="password"
                    :placeholder="t('setup.stepModel.enterKey').replace('{name}', model.name)"
                  />
                </div>
                <p class="key-hint" v-if="!model.isCustom">
                  {{ t('setup.stepModel.noKey') }}
                  <a v-if="model.link" :href="model.link" target="_blank">{{ t('setup.stepModel.apply') }}</a>
                </p>
                <p class="custom-hint" v-else>{{ t('setup.customDesc') }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 2: Employee #1 -->
        <div v-if="step === 2" class="step-content employee-step">
          <p>{{ t('setup.stepEmployee.subtitle') }}</p>
          <AgentPersonaForm
            ref="personaFormRef"
            v-model="emp"
            :avatar-list="AVATARS"
            i18n-prefix="setup.employee"
            @request-avatar-upload="triggerAvatarUpload"
          />
        </div>

        <!-- Step 3: Done -->
        <div v-if="step === 3" class="step-content">
          <div class="done-icon">✅</div>
          <p v-if="connectionMode === 'local'">{{ t('setup.step3.localDone') }}</p>
          <p v-else>{{ t('setup.step3.remoteDone') }}</p>
        </div>
      </div>

      <div class="setup-actions">
        <button v-if="step > 0" class="btn-secondary" @click="step--">{{ t('setup.prevStep') }}</button>
        <button v-if="step < 3" class="btn-primary" @click="nextStep" :disabled="!canNext">
          {{ t('setup.nextStep') }}
        </button>
        <button v-if="step === 3" class="btn-primary" @click="finish" :disabled="startingGateway">
          {{ t('setup.start') }}
        </button>
      </div>
    </div>
    <!-- Hidden file input for avatar upload -->
    <input ref="avatarFileRef" type="file" accept="image/*" class="sr-only" @change="onAvatarFileChange" />
  </div>
</template>

<script setup>
import { ref, computed, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConfigStore } from '@/stores/config'
import { useGatewayStore } from '@/stores/gateway'
import { ipc } from '@/lib/ipc'
import { t, setLocale, currentLocale } from '@/i18n'
import { getModelIcon } from '@/lib/icons'
import { useUiStore } from '@/stores/ui'
import AgentPersonaForm from '@/components/AgentPersonaForm.vue'
import { loadAvatarDataUrls } from '@/lib/avatars'
import { processAvatarFile } from '@/lib/avatar-upload'

const locale = currentLocale
const uiStore = useUiStore()
const isDark = computed(() => uiStore.isDark)

async function toggleLang() {
  const newLang = locale.value === 'zh-CN' ? 'en' : 'zh-CN'
  setLocale(newLang)
  const settings = await ipc.getSettings()
  settings.ui = { ...settings.ui, language: newLang }
  await ipc.saveSettings(settings)
}

function toggleTheme() {
  uiStore.toggleTheme()
}

const router = useRouter()
const configStore = useConfigStore()
const gatewayStore = useGatewayStore()

const step = ref(0)
const connectionMode = ref('local')
const remoteUrl = ref('')
const remoteToken = ref('')
const remotePassword = ref('')
const selectedModel = ref('')
const apiKey = ref('')
const customBase = ref('')
const customModel = ref('')
const startingGateway = ref(false)
const personaFormRef = ref(null)

const coreChecking = ref(true)
const coreInstalled = ref(false)
const coreInstalling = ref(false)
const coreInstallError = ref('')

// Built-in avatars (shared utility)
const AVATARS = ref([])
onMounted(async () => {
  AVATARS.value = await loadAvatarDataUrls()
})

// Employee data — all empty, placeholders serve as examples
let emp = reactive({
  name: '',
  gender: '',
  age: '',
  id: 'main',
  role: '',
  duty: '',
  dept: '',
  callMe: '',
  myRelation: '',
  othersRelation: '',
  charm: '',
  style: '',
  motto: '',
  skills: '',
  weakness: '',
  attitude: '',
  principle: '',
  hobby: '',
  dislike: '',
  credo: '',
  report: '',
  avatar: '',
})

const avatarFileRef = ref(null)

function triggerAvatarUpload() {
  avatarFileRef.value?.click()
}

async function onAvatarFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const dataUrl = await processAvatarFile(file)
  personaFormRef.value?.setAvatar(dataUrl)
  event.target.value = ''
}

async function checkCore() {
  coreChecking.value = true
  try {
    coreInstalled.value = await ipc.hasOpenClawCore()
  } catch {
    coreInstalled.value = false
  }
  coreChecking.value = false
}

async function downloadCore() {
  coreInstalling.value = true
  coreInstallError.value = ''
  try {
    const result = await ipc.installOpenClawCore('latest')
    if (result.ok) {
      coreInstalled.value = true
    } else {
      coreInstallError.value = result.error || t('setup.step0.downloadFailed')
    }
  } catch (e) {
    coreInstallError.value = e.message || t('setup.step0.downloadFailed')
  }
  coreInstalling.value = false
}

checkCore()

const stepSubtitle = computed(() => {
  if (step.value === 0) return t('setup.step0.subtitle')
  return t('setup.stepSubtitle')
})

const PRESETS = computed(() => [
  { id: 'minimax', name: 'MiniMax', baseUrl: 'https://api.minimax.chat/v1', model: 'MiniMax-Text-01', tags: [t('models.tagRecommend'), t('models.tagDomestic')], link: 'https://platform.minimaxi.com/' },
  { id: 'kimi', name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-auto', tags: [t('models.tagDomestic'), t('models.tagFast')], link: 'https://platform.moonshot.cn/' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', tags: [t('models.tagDomestic'), t('models.tagCheap')], link: 'https://platform.deepseek.com/' },
  { id: 'zai', name: 'GLM', baseUrl: '', model: 'glm-5', tags: [t('models.tagDomestic'), t('models.tagFree')], link: 'https://open.bigmodel.cn/', isZai: true },
  { id: 'qwen', name: 'Qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo', tags: [t('models.tagDomestic'), t('models.tagFree')], link: 'https://dashscope.console.aliyun.com/' },
  { id: 'doubao', name: 'Doubao', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-1.5-pro-32k', tags: [t('models.tagDomestic'), t('models.tagFast')], link: 'https://console.volcengine.com/ark' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', tags: [t('models.tagPowerful')], link: 'https://platform.openai.com/' },
  { id: 'anthropic', name: 'Claude', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-20250514', tags: [t('models.tagPowerful')], link: 'https://console.anthropic.com/' },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', tags: [t('models.tagVeryFast'), t('models.tagFree')], link: 'https://console.groq.com/' },
  { id: 'siliconflow', name: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-72B-Instruct', tags: [t('models.tagDomestic'), t('models.tagCheap')], link: 'https://cloud.siliconflow.cn/' },
  { id: 'custom', name: t('models.custom'), baseUrl: '', model: '', tags: [t('models.tagCompatible')], link: '', isCustom: true },
])

const TAG_MAP = computed(() => ({
  [t('models.tagRecommend')]: 'hot',
  [t('models.tagDomestic')]: 'cn',
  [t('models.tagFree')]: 'free',
  [t('models.tagFast')]: 'fast',
  [t('models.tagVeryFast')]: 'fast',
  [t('models.tagCheap')]: 'cheap',
  [t('models.tagPowerful')]: 'hot',
}))

function tagClass(tag) { return TAG_MAP.value[tag] || '' }

function toggleModel(id) {
  selectedModel.value = selectedModel.value === id ? '' : id
}

const isCustomSelected = computed(() => selectedModel.value === 'custom')

const activePreset = computed(() => PRESETS.value.find(p => p.id === selectedModel.value))

const canNext = computed(() => {
  if (step.value === 0) {
    if (connectionMode.value === 'remote') return !!remoteUrl.value
    return coreInstalled.value
  }
  if (step.value === 1) {
    if (isCustomSelected.value) return !!(customBase.value.trim() && customModel.value.trim() && apiKey.value.trim())
    return !!selectedModel.value && !!apiKey.value.trim()
  }
  if (step.value === 2) {
    if (!personaFormRef.value) return false
    return personaFormRef.value.isValid
  }
  return true
})

function nextStep() {
  if (!canNext.value) {
    if (step.value === 2) personaFormRef.value?.validate()
    return
  }
  if (step.value === 0) {
    ipc.saveConnection({
      mode: connectionMode.value,
      remote: {
        url: remoteUrl.value,
        token: remoteToken.value,
        password: remotePassword.value,
      },
    })
  }
  step.value++
}

async function finish() {
  const p = activePreset.value
  if (!p) return

  let baseUrl = p.baseUrl
  let modelId = p.model
  if (p.isCustom) {
    baseUrl = customBase.value.trim()
    modelId = customModel.value.trim()
  }

  const providerId = p.isCustom ? 'custom' : p.id
  const apiType = p.id === 'anthropic' ? 'anthropic' : 'openai-completions'
  await configStore.saveModelConfig(providerId, baseUrl, modelId, apiKey.value.trim(), null, apiType)

  // Save agent workspace files
  await ipc.saveAgentWorkspace({
    name: emp.name,
    gender: emp.gender,
    age: emp.age,
    id: emp.id,
    role: emp.role,
    duty: emp.duty,
    dept: emp.dept,
    callMe: emp.callMe,
    myRelation: emp.myRelation,
    othersRelation: emp.othersRelation,
    charm: emp.charm,
    style: emp.style,
    motto: emp.motto,
    skills: emp.skills,
    weakness: emp.weakness,
    attitude: emp.attitude,
    principle: emp.principle,
    hobby: emp.hobby,
    dislike: emp.dislike,
    credo: emp.credo,
    report: emp.report,
    avatar: emp.avatar,
  })

  // Show gateway starting overlay
  startingGateway.value = true

  await ipc.setupComplete()

  // Wait for gateway to be ready (poll up to 60s)
  const start = Date.now()
  while (Date.now() - start < 60000) {
    await new Promise(r => setTimeout(r, 1000))
    await gatewayStore.refresh()
    if (gatewayStore.ready) break
  }

  startingGateway.value = false
  router.replace({ name: 'chat' })
}
</script>

<style scoped>
.setup-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.setup-toolbar {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  -webkit-app-region: no-drag;
}

.toolbar-btn {
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
.toolbar-btn:hover {
  color: var(--color-primary);
  background: var(--color-bg-hover);
}

.theme-toggle {
  width: 32px;
  height: 32px;
  justify-content: center;
  font-size: 16px;
  padding: 0;
}

.setup-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-2xl);
  gap: var(--spacing-xl);
  overflow: hidden;
}

.setup-logo {
  width: 72px;
  height: 72px;
}

.setup-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.setup-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-primary);
}

.setup-subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.setup-steps {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.step {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-text-tertiary);
}

.step.active {
  color: var(--color-primary);
}

.step.done {
  color: var(--color-success);
}

.step-num {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid currentColor;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: 600;
}

.step.active .step-num {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.step.done .step-num {
  background: var(--color-success);
  border-color: var(--color-success);
  color: white;
}

.step-label {
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.step-line {
  width: 40px;
  height: 2px;
  background: var(--color-border);
}

.step-line.done {
  background: var(--color-success);
}

.setup-content {
  flex: 1;
  width: 100%;
  max-width: 560px;
  min-height: 0;
  overflow-y: auto;
}

.step-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-lg);
}

.step-content p {
  color: var(--color-text-secondary);
  text-align: center;
}

/* Step 0: Connection mode */
.mode-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
  width: 100%;
}

.mode-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xl) var(--spacing-lg);
  background: var(--color-bg-card);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
  cursor: pointer;
}

.mode-option:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-hover);
}

.mode-option.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.mode-icon {
  font-size: 32px;
}

.mode-name {
  font-weight: 600;
  font-size: var(--font-size-md);
}

.mode-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  text-align: center;
}

.remote-fields {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  width: 100%;
  max-width: 360px;
}

/* Core status (Step 0 local mode) */
.core-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  max-width: 360px;
}

.core-checking {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.core-ok {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  color: var(--color-success);
  font-size: var(--font-size-sm);
}

.core-missing {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  width: 100%;
}

.core-missing p {
  color: var(--color-error);
  font-size: var(--font-size-sm);
  text-align: center;
}

.btn-download {
  padding: var(--spacing-sm) var(--spacing-xl);
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-sm);
  font-weight: 600;
  font-size: var(--font-size-sm);
  transition: background var(--transition-fast);
}

.btn-download:hover {
  background: var(--color-primary-hover);
}

.download-progress {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.progress-bar {
  width: 100%;
  max-width: 280px;
  height: 6px;
  background: var(--color-bg-tertiary);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  width: 100%;
  height: 100%;
  background: var(--color-primary);
  border-radius: 3px;
  animation: progress-pulse 1.5s ease-in-out infinite;
}

@keyframes progress-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}

.core-error {
  color: var(--color-error);
  font-size: var(--font-size-xs);
}

/* Model grid (Step 1) — two-column, selected card spans full width */
.model-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-sm);
  width: 100%;
}

.model-card {
  background: var(--color-bg-card);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 10px var(--spacing-md);
  cursor: pointer;
  transition: all var(--transition-fast);
}

/* Selected card spans full row so expand area has room */
.model-card.selected {
  grid-column: 1 / -1;
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.model-card:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-hover);
}

.model-card-header {
  display: flex;
  align-items: center;
  gap: 6px;
}

.model-logo {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.model-name {
  flex: 1;
  text-align: left;
  font-size: var(--font-size-sm);
  font-weight: 500;
}

.model-tag {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
}

.model-tag.hot { background: rgba(255, 107, 53, 0.2); color: #ff6b35; }
.model-tag.free { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
.model-tag.cn { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
.model-tag.fast { background: rgba(156, 39, 176, 0.2); color: #ce93d8; }
.model-tag.cheap { background: rgba(255, 193, 7, 0.2); color: #ffd54f; }

/* Expandable area inside selected card */
.model-card-expand {
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-md);
  border-top: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.model-card-expand .form-group label {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.model-card-expand input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  outline: none;
}

.model-card-expand input:focus {
  border-color: var(--color-primary);
}

.key-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.key-hint a {
  color: var(--color-primary);
  text-decoration: none;
}

.key-hint a:hover {
  text-decoration: underline;
}

.custom-hint {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  text-align: left;
}

/* Employee step (Step 2) — tabbed */
.employee-step {
  align-items: stretch !important;
  max-width: 520px;
  width: 100%;
  margin: 0 auto;
}

/* Done */
.done-icon {
  font-size: 48px;
}

.setup-actions {
  display: flex;
  gap: var(--spacing-md);
}

.btn-primary {
  padding: var(--spacing-md) var(--spacing-2xl);
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-sm);
  font-weight: 600;
  transition: background var(--transition-fast);
}

.btn-primary:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  padding: var(--spacing-md) var(--spacing-2xl);
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
  font-weight: 600;
  transition: background var(--transition-fast);
}

.btn-secondary:hover {
  background: var(--color-bg-hover);
}

/* Starting overlay */
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

.overlay-enter-active,
.overlay-leave-active {
  transition: opacity 0.25s ease;
}
.overlay-enter-from,
.overlay-leave-to {
  opacity: 0;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

.key-input {
  width: 100%;
  max-width: 360px;
  padding: var(--spacing-md);
  font-size: var(--font-size-md);
  text-align: center;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  outline: none;
}

.key-input:focus {
  border-color: var(--color-primary);
}
</style>
