<template>
  <div class="models-view">
    <div class="models-container">
      <!-- Steps indicator -->
      <div class="steps">
        <div class="step" :class="{ active: step === 1, done: step > 1 }">
          <span class="num">{{ step > 1 ? '✓' : '1' }}</span>{{ t('models.step1') }}
        </div>
        <div class="step" :class="{ active: step === 2, done: step > 2 }">
          <span class="num">{{ step > 2 ? '✓' : '2' }}</span>{{ t('models.step2') }}
        </div>
        <div class="step" :class="{ active: step === 3 }">
          <span class="num">3</span>{{ t('models.step3') }}
        </div>
      </div>

      <!-- Step 1: Select Model -->
      <div v-if="step === 1" class="section">
        <h2>{{ t('models.selectModel') }}</h2>
        <p class="desc">{{ t('models.selectModelDesc') }}</p>
        <div class="model-grid">
          <div
            v-for="p in PRESETS"
            :key="p.id"
            class="model-card"
            :class="{
              selected: selected === p.id,
              current: currentProvider === p.id,
            }"
            @click="selected = p.id"
          >
            <span class="check" v-if="selected === p.id">✓</span>
            <span class="model-logo" v-html="getModelIcon(p.id, 20)"></span>
            <h4>
              {{ p.name }}
              <span v-for="t in p.tags" :key="t" class="tag" :class="tagClass(t)">{{ t }}</span>
            </h4>
            <p v-if="p.isCustom">{{ t('models.customDesc') }}</p>
            <a v-else-if="p.link" class="buy-link" :href="p.link" target="_blank" @click.stop>{{ t('models.getApiKey') }}</a>
            <span v-if="currentProvider === p.id" class="current-badge">{{ t('models.current') }}</span>
          </div>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" :disabled="!selected" @click="step = 2">{{ t('models.nextStep') }}</button>
        </div>
      </div>

      <!-- Step 2: API Key -->
      <div v-if="step === 2" class="section">
        <h2>{{ t('models.fillApiKey') }}</h2>
        <p class="desc">{{ t('models.fillApiKeyDesc').replace('{name}', activePreset?.name || '') }}</p>

        <div v-if="activePreset?.link" class="api-info">
          <h4>{{ t('models.howToGetKey') }}</h4>
          <a :href="activePreset.link" target="_blank">{{ t('models.goGetKey').replace('{name}', activePreset.name) }}</a>
        </div>

        <template v-if="activePreset?.isCustom">
          <div class="form-group">
            <label>{{ t('models.apiBaseUrl') }}</label>
            <input v-model="customBase" type="text" placeholder="https://api.example.com/v1" />
          </div>
          <div class="form-group">
            <label>{{ t('models.modelName') }}</label>
            <input v-model="customModel" type="text" placeholder="gpt-4o" />
          </div>
        </template>

        <div class="form-group">
          <label>API Key</label>
          <div class="input-wrap">
            <input v-model="apiKey" :type="showKey ? 'text' : 'password'" placeholder="sk-..." />
            <button class="toggle-pw" @click="showKey = !showKey">{{ showKey ? '🙈' : '👁' }}</button>
          </div>
          <p class="hint">{{ t('models.keyLocalOnly') }}</p>
        </div>

        <div v-if="hasExistingPrimary" class="form-group">
          <label class="checkbox-label">
            <input type="checkbox" v-model="setAsPrimary" />
            {{ t('models.setPrimary').replace('{name}', existingPrimaryLabel) }}
          </label>
        </div>

        <div class="btn-row">
          <button class="btn btn-secondary" @click="step = 1">{{ t('models.goBack') }}</button>
          <button class="btn btn-primary" :disabled="!canSave || saving" @click="handleSave">
            {{ saving ? t('models.saving') : t('models.saveConfig') }}
          </button>
        </div>
      </div>

      <!-- Step 3: Done -->
      <div v-if="step === 3" class="section result">
        <div class="result-icon">✅</div>
        <h2>{{ t('models.configDone') }}</h2>
        <p>{{ t('models.configDoneDesc') }}</p>
        <div class="result-model">{{ saveLabel }}</div>
        <div class="btn-row" style="justify-content: center; margin-top: 24px;">
          <button v-if="!restartDone" class="btn btn-primary" @click="handleRestart">{{ t('models.restartGateway') }}</button>
          <template v-if="restartDone && gatewayStore.ready">
            <button class="btn btn-primary" @click="goChat">{{ t('models.startChat') }}</button>
            <span class="restart-ok">{{ t('models.gatewayReady') }}</span>
          </template>
          <button class="btn btn-secondary" @click="handleTest" :disabled="testing">
            {{ testing ? t('models.testing') : t('models.testConnection') }}
          </button>
          <button class="btn btn-secondary" @click="step = 1">{{ t('models.reconfig') }}</button>
        </div>
        <div v-if="testResult" class="test-result" :class="testResult.ok ? 'test-ok' : 'test-fail'">
          <div v-if="testResult.ok">
            <div class="test-title">{{ t('models.testSuccess') }}</div>
            <div v-for="m in testResult.models" :key="m" class="test-model-tag">{{ m }}</div>
          </div>
          <div v-else class="test-title">{{ testResult.error }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useConfigStore } from '@/stores/config'
import { useGatewayStore } from '@/stores/gateway'
import { t } from '@/i18n'
import { getModelIcon } from '@/lib/icons'

const router = useRouter()
const configStore = useConfigStore()
const gatewayStore = useGatewayStore()

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
  [t('models.tagRecommend')]: 'hot', [t('models.tagDomestic')]: 'cn', [t('models.tagFree')]: 'free',
  [t('models.tagFast')]: 'fast', [t('models.tagVeryFast')]: 'fast', [t('models.tagCheap')]: 'cheap', [t('models.tagPowerful')]: 'hot',
}))

const step = ref(1)
const selected = ref('')
const apiKey = ref('')
const showKey = ref(false)
const customBase = ref('')
const customModel = ref('')
const currentProvider = ref('')
const setAsPrimary = ref(false)
const saving = ref(false)
const restartDone = ref(false)
const testing = ref(false)
const testResult = ref(null)
const savedProvider = ref('')
const savedBaseUrl = ref('')
const savedApiKey = ref('')
const saveLabel = ref('')

function tagClass(tag) { return TAG_MAP.value[tag] || '' }

const activePreset = computed(() => PRESETS.value.find(p => p.id === selected.value))

const existingPrimary = computed(() => {
  return configStore.config?.agents?.defaults?.model?.primary || ''
})

const hasExistingPrimary = computed(() => !!existingPrimary.value)

const existingPrimaryLabel = computed(() => {
  const p = existingPrimary.value
  if (!p) return ''
  const idx = p.indexOf('/')
  const provId = idx > 0 ? p.substring(0, idx) : ''
  const modelId = idx > 0 ? p.substring(idx + 1) : p
  const preset = PRESETS.value.find(pr => pr.id === provId)
  return preset ? `${preset.name} / ${modelId}` : p
})

const canSave = computed(() => {
  if (!apiKey.value.trim()) return false
  if (activePreset.value?.isCustom) {
    return customBase.value.trim() && customModel.value.trim()
  }
  return true
})

async function handleSave() {
  const p = activePreset.value
  if (!p) return

  let baseUrl = p.baseUrl
  let modelId = p.model
  if (p.isCustom) {
    baseUrl = customBase.value.trim()
    modelId = customModel.value.trim()
  }

  saving.value = true
  saveLabel.value = `${p.name} · ${modelId}`

  // Fetch model list from provider (skip for zai)
  let providerModels = null
  if (!p.isZai && baseUrl) {
    try {
      const res = await window.clawshell.fetchProviderModels(baseUrl, apiKey.value.trim())
      if (res?.data && Array.isArray(res.data)) {
        providerModels = res.data
          .map(m => m.id)
          .filter(Boolean)
          .slice(0, 50)
          .map(id => ({
            id,
            name: id,
            reasoning: false,
            input: ['text'],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 128000,
            maxTokens: 8192,
          }))
      }
    } catch {}
  }

  const result = await configStore.saveModelConfig(p.id, baseUrl, modelId, apiKey.value.trim(), providerModels)
  saving.value = false

  if (result.ok) {
    // If user checked "set as primary", update it
    if (setAsPrimary.value && hasExistingPrimary.value) {
      const primary = p.isZai ? 'zai/' + modelId : p.id + '/' + modelId
      await configStore.setPrimaryModel(primary)
    }

    savedProvider.value = p.id
    savedBaseUrl.value = baseUrl
    savedApiKey.value = apiKey.value.trim()
    testResult.value = null
    step.value = 3
  }
}

function goChat() {
  router.push({ name: 'chat' })
}

async function handleRestart() {
  gatewayStore.restarting = true
  restartDone.value = true
  try {
    await window.clawshell.restartGateway()
  } catch {
    gatewayStore.restarting = false
  }
}

async function handleTest() {
  const p = PRESETS.value.find(pr => pr.id === savedProvider.value)
  if (!p) return

  const baseUrl = savedBaseUrl.value
  const apiKeyVal = savedApiKey.value

  if (p.isZai || !baseUrl) {
    testResult.value = { ok: true, models: [p.model || 'zai model'], error: '' }
    return
  }

  testing.value = true
  testResult.value = null
  try {
    const res = await window.clawshell.fetchProviderModels(baseUrl, apiKeyVal)
    if (res?.error) {
      testResult.value = { ok: false, models: [], error: t('models.connectFailed').replace('{error}', res.error) }
    } else if (res?.data && Array.isArray(res.data)) {
      const names = res.data.map(m => m.id).filter(Boolean)
      testResult.value = { ok: true, models: names.slice(0, 20), error: '' }
    } else {
      testResult.value = { ok: false, models: [], error: t('models.modelUnavailable') }
    }
  } catch (e) {
    testResult.value = { ok: false, models: [], error: t('models.connectFailed').replace('{error}', e.message || e) }
  } finally {
    testing.value = false
  }
}

function detectCurrent() {
  const primary = configStore.config?.agents?.defaults?.model?.primary
  if (!primary) {
    setAsPrimary.value = true
    return
  }
  const slashIdx = primary.indexOf('/')
  const provId = slashIdx > 0 ? primary.substring(0, slashIdx) : ''
  const match = PRESETS.value.find(p => p.id === provId)
  if (match) {
    currentProvider.value = match.id
    selected.value = match.id
  }
}

function detectApiKey() {
  const cfg = configStore.config
  if (!cfg) return
  const p = activePreset.value
  if (!p) return
  if (p.isZai) {
    apiKey.value = cfg.env?.ZAI_API_KEY || ''
  } else {
    apiKey.value = cfg.models?.providers?.[p.id]?.apiKey || ''
  }
}

onMounted(async () => {
  await configStore.load()
  detectCurrent()
  detectApiKey()
})
</script>

<style scoped>
.models-view {
  height: 100%;
  overflow-y: auto;
  padding: 24px;
}

.models-container {
  max-width: 680px;
  margin: 0 auto;
}

.steps {
  display: flex;
  background: var(--color-bg-secondary);
  border-radius: var(--radius-lg);
  overflow: hidden;
  border: 1px solid var(--color-border);
  margin-bottom: 20px;
}

.step {
  flex: 1;
  text-align: center;
  padding: 12px 8px;
  font-size: var(--font-size-sm);
  color: var(--color-text-tertiary);
  transition: all 0.2s;
}

.step.active {
  color: var(--color-primary);
  background: rgba(255, 107, 53, 0.08);
  font-weight: 600;
}

.step.done { color: var(--color-success); }

.num {
  display: inline-block;
  width: 20px;
  height: 20px;
  line-height: 20px;
  border-radius: 50%;
  background: var(--color-bg-tertiary);
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  margin-right: 4px;
}

.step.active .num { background: var(--color-primary); color: #fff; }
.step.done .num { background: var(--color-success); color: #fff; }

.section {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 24px;
}

.section h2 {
  color: var(--color-primary);
  font-size: var(--font-size-lg);
  margin-bottom: 4px;
}

.desc {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  margin-bottom: 16px;
}

.model-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 16px;
}

.model-card {
  background: var(--color-bg-tertiary);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 14px;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.model-logo {
  display: flex;
  align-items: center;
  margin-bottom: 4px;
}

.model-card:hover {
  border-color: var(--color-border-light);
  transform: translateY(-1px);
}

.model-card.selected {
  border-color: var(--color-primary);
  background: rgba(255, 107, 53, 0.06);
}

.model-card h4 {
  color: var(--color-text);
  font-size: var(--font-size-md);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.model-card p {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  line-height: 1.4;
}

.buy-link {
  display: inline-flex;
  align-items: center;
  color: var(--color-primary);
  text-decoration: none;
  font-size: var(--font-size-xs);
  margin-top: 2px;
}

.buy-link:hover { text-decoration: underline; }

.check {
  position: absolute;
  top: 8px;
  right: 10px;
  color: var(--color-primary);
  font-size: 1.2em;
}

.tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  font-weight: 500;
}

.tag.hot { background: rgba(255, 107, 53, 0.2); color: #ff6b35; }
.tag.free { background: rgba(34, 197, 94, 0.2); color: #22c55e; }
.tag.cn { background: rgba(59, 130, 246, 0.2); color: #3b82f6; }
.tag.fast { background: rgba(156, 39, 176, 0.2); color: #ce93d8; }
.tag.cheap { background: rgba(255, 193, 7, 0.2); color: #ffd54f; }

.current-badge {
  position: absolute;
  bottom: 8px;
  right: 10px;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  background: rgba(34, 197, 94, 0.2);
  color: var(--color-success);
  font-weight: 500;
}

.form-group { margin-bottom: 16px; }

label {
  display: block;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
  font-size: var(--font-size-sm);
}

input[type="text"],
input[type="password"] {
  width: 100%;
  padding: 10px 14px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: var(--font-size-md);
  outline: none;
  transition: border-color 0.2s;
}

input:focus { border-color: var(--color-primary); }

.input-wrap { position: relative; }
.input-wrap input { padding-right: 44px; }

.toggle-pw {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  font-size: var(--font-size-md);
}

.hint {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  margin-top: 6px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.checkbox-label input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-primary);
}

.api-info {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 14px;
  margin-bottom: 16px;
}

.api-info h4 { color: var(--color-primary); font-size: var(--font-size-sm); margin-bottom: 8px; }
.api-info a { color: #82aaff; text-decoration: none; font-size: var(--font-size-sm); }
.api-info a:hover { color: var(--color-primary); }

.btn {
  display: inline-block;
  padding: 10px 24px;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-md);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.15s;
}

.btn-primary { background: var(--color-primary); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--color-primary-hover); }
.btn-primary:disabled { background: var(--color-bg-tertiary); color: var(--color-text-tertiary); cursor: not-allowed; }
.btn-secondary { background: var(--color-bg-tertiary); color: var(--color-text-secondary); }
.btn-secondary:hover { background: var(--color-bg-hover); }

.btn-row {
  display: flex;
  gap: 10px;
  margin-top: 20px;
  justify-content: flex-end;
}

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

.test-result {
  margin-top: 20px;
  padding: 16px;
  border-radius: var(--radius-md);
  text-align: left;
}

.test-result.test-ok {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.test-result.test-fail {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.test-title {
  font-size: var(--font-size-sm);
  margin-bottom: 8px;
}

.test-ok .test-title { color: var(--color-success); }
.test-fail .test-title { color: var(--color-error); }

.test-model-tag {
  display: inline-block;
  font-size: var(--font-size-xs);
  padding: 2px 8px;
  margin: 2px 4px;
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
}
</style>
