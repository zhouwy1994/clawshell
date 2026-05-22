<template>
  <div class="setup-view">
    <div class="setup-card">
      <div class="setup-logo"><img src="@assets/images/logo/clawshell_logo.png" alt="ClawShell" /></div>
      <h1 class="setup-title">欢迎使用虾壳</h1>
      <p class="setup-subtitle">3 步完成配置，开始使用 AI 助手</p>

      <div class="setup-steps">
        <div class="step" :class="{ active: step === 1, done: step > 1 }">
          <span class="step-num">1</span>
          <span class="step-label">选择模型</span>
        </div>
        <div class="step-line" :class="{ done: step > 1 }"></div>
        <div class="step" :class="{ active: step === 2, done: step > 2 }">
          <span class="step-num">2</span>
          <span class="step-label">配置密钥</span>
        </div>
        <div class="step-line" :class="{ done: step > 2 }"></div>
        <div class="step" :class="{ active: step === 3, done: step > 3 }">
          <span class="step-num">3</span>
          <span class="step-label">完成</span>
        </div>
      </div>

      <div class="setup-content">
        <!-- Step 1: Select Model -->
        <div v-if="step === 1" class="step-content">
          <p>请选择你要使用的 AI 模型（后续可在模型配置中修改）</p>
          <div class="model-grid">
            <button
              v-for="model in models"
              :key="model.id"
              class="model-option"
              :class="{ selected: selectedModel === model.id }"
              @click="selectedModel = model.id"
            >
              <span class="model-icon">{{ model.icon }}</span>
              <span class="model-name">{{ model.name }}</span>
              <span v-if="model.tag" class="model-tag">{{ model.tag }}</span>
            </button>
          </div>
        </div>

        <!-- Step 2: API Key -->
        <div v-if="step === 2" class="step-content">
          <p>请输入 {{ currentModelName }} 的 API Key</p>
          <input
            v-model="apiKey"
            type="password"
            class="key-input"
            :placeholder="'sk-...'"
          />
          <p class="key-hint">
            还没有 API Key？
            <a :href="currentModelApplyUrl" target="_blank">点击申请</a>
          </p>
        </div>

        <!-- Step 3: Done -->
        <div v-if="step === 3" class="step-content">
          <div class="done-icon">✅</div>
          <p>配置完成！点击下方按钮开始使用虾壳。</p>
        </div>
      </div>

      <div class="setup-actions">
        <button v-if="step > 1" class="btn-secondary" @click="step--">上一步</button>
        <button v-if="step < 3" class="btn-primary" @click="nextStep" :disabled="!canNext">
          下一步
        </button>
        <button v-if="step === 3" class="btn-primary" @click="finish">
          开始使用
        </button>
      </div>
    </div>
    <AppBottomBar @repair="() => {}" @contact="() => {}" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useConfigStore } from '@/stores/config'
import { useGatewayStore } from '@/stores/gateway'
import { ipc } from '@/lib/ipc'
import AppBottomBar from '@/components/AppBottomBar.vue'

const router = useRouter()
const configStore = useConfigStore()
const gatewayStore = useGatewayStore()

const step = ref(1)
const selectedModel = ref('deepseek')
const apiKey = ref('')

const models = [
  { id: 'deepseek', name: 'DeepSeek', icon: '🔍', tag: '推荐' },
  { id: 'kimi', name: 'Kimi', icon: '🌙', tag: '国内' },
  { id: 'minimax', name: 'MiniMax', icon: '💎', tag: '免费' },
  { id: 'glm', name: '智谱 GLM', icon: '🌟', tag: '国内' },
  { id: 'qwen', name: '通义千问', icon: '☁️', tag: '国内' },
  { id: 'doubao', name: '豆包', icon: '🫘', tag: '便宜' },
  { id: 'openai', name: 'OpenAI', icon: '🟢', tag: '' },
  { id: 'claude', name: 'Claude', icon: '🟣', tag: '' },
]

const currentModelName = computed(() => {
  return models.find(m => m.id === selectedModel.value)?.name || ''
})

const currentModelApplyUrl = computed(() => {
  const urls = {
    deepseek: 'https://platform.deepseek.com/api_keys',
    kimi: 'https://platform.moonshot.cn/console/api-keys',
    minimax: 'https://www.minimaxi.com/',
    glm: 'https://open.bigmodel.cn/',
    qwen: 'https://dashscope.console.aliyun.com/',
    doubao: 'https://console.volcengine.com/ark',
    openai: 'https://platform.openai.com/api-keys',
    claude: 'https://console.anthropic.com/',
  }
  return urls[selectedModel.value] || '#'
})

const canNext = computed(() => {
  if (step.value === 1) return !!selectedModel.value
  if (step.value === 2) return !!apiKey.value
  return true
})

function nextStep() {
  if (canNext.value) step.value++
}

async function finish() {
  const providerConfig = buildProviderConfig(selectedModel.value, apiKey.value)
  await configStore.save(providerConfig)
  await gatewayStore.refresh()
  router.replace({ name: 'chat' })
}

function buildProviderConfig(modelId, key) {
  const configs = {
    deepseek: {
      models: {
        mode: 'merge',
        providers: {
          deepseek: {
            baseUrl: 'https://api.deepseek.com/v1',
            apiKey: key,
            api: 'openai-completions',
            models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }],
          },
        },
      },
      agents: { defaults: { model: { primary: 'deepseek/deepseek-chat' } } },
    },
    kimi: {
      models: {
        mode: 'merge',
        providers: {
          kimi: {
            baseUrl: 'https://api.moonshot.cn/v1',
            apiKey: key,
            api: 'openai-completions',
            models: [{ id: 'moonshot-v1-8k', name: 'Moonshot v1' }],
          },
        },
      },
      agents: { defaults: { model: { primary: 'kimi/moonshot-v1-8k' } } },
    },
    openai: {
      models: {
        mode: 'merge',
        providers: {
          openai: {
            baseUrl: 'https://api.openai.com/v1',
            apiKey: key,
            api: 'openai-completions',
            models: [{ id: 'gpt-4o', name: 'GPT-4o' }],
          },
        },
      },
      agents: { defaults: { model: { primary: 'openai/gpt-4o' } } },
    },
    claude: {
      models: {
        mode: 'merge',
        providers: {
          claude: {
            baseUrl: 'https://api.anthropic.com/v1',
            apiKey: key,
            api: 'anthropic',
            models: [{ id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet' }],
          },
        },
      },
      agents: { defaults: { model: { primary: 'claude/claude-sonnet-4-20250514' } } },
    },
  }

  return configs[modelId] || {
    models: {
      mode: 'merge',
      providers: {
        [modelId]: {
          baseUrl: '',
          apiKey: key,
          api: 'openai-completions',
          models: [{ id: modelId, name: modelId }],
        },
      },
    },
    agents: { defaults: { model: { primary: `${modelId}/${modelId}` } } },
  }
}
</script>

<style scoped>
.setup-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.setup-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: var(--spacing-2xl);
  gap: var(--spacing-xl);
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
  width: 100%;
  max-width: 480px;
  min-height: 200px;
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

.model-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
  width: 100%;
}

.model-option {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-card);
  border: 2px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all var(--transition-fast);
}

.model-option:hover {
  border-color: var(--color-primary);
  background: var(--color-bg-hover);
}

.model-option.selected {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.model-icon {
  font-size: 20px;
}

.model-name {
  flex: 1;
  text-align: left;
}

.model-tag {
  font-size: var(--font-size-xs);
  padding: 2px 6px;
  background: var(--color-primary-light);
  color: var(--color-primary);
  border-radius: 4px;
}

.key-input {
  width: 100%;
  max-width: 360px;
  padding: var(--spacing-md);
  font-size: var(--font-size-md);
  text-align: center;
}

.key-hint {
  font-size: var(--font-size-sm);
}

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
</style>
