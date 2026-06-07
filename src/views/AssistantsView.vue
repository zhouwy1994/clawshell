<template>
  <div class="assistants-view">
    <div class="assistants-container">
      <!-- Steps indicator -->
      <div class="steps">
        <div class="step" :class="{ active: step === 1, done: step > 1 }">
          <span class="num">{{ step > 1 ? '✓' : '1' }}</span>{{ t('assistants.step1') }}
        </div>
        <div class="step" :class="{ active: step === 2, done: step > 2 }">
          <span class="num">{{ step > 2 ? '✓' : '2' }}</span>{{ t('assistants.step2') }}
        </div>
        <div class="step" :class="{ active: step === 3, done: step > 3 }">
          <span class="num">{{ step > 3 ? '✓' : '3' }}</span>{{ t('assistants.step3') }}
        </div>
        <div class="step" :class="{ active: step === 4 }">
          <span class="num">4</span>{{ t('assistants.step4') }}
        </div>
      </div>

      <!-- Step 1: Basic Info — card list + expandable form -->
      <div v-if="step === 1" class="section">
        <h2>{{ t('assistants.manage') }}</h2>
        <p class="desc">{{ t('assistants.manageDesc') }}</p>

        <div class="model-grid">
          <!-- Existing agent cards -->
          <div
            v-for="agent in agentList"
            :key="agent.id"
            class="model-card assistant-card"
            :class="{ selected: expandedId === agent.id }"
            @click="toggleExpand(agent)"
          >
            <span class="check" v-if="expandedId === agent.id" v-html="getIcon('check', 15)"></span>
            <span class="assistant-card-sheen"></span>
            <div class="card-header">
              <div class="avatar-frame" :class="{ 'has-img': isCardImgAvatar(agent) }">
                <img v-if="isCardImgAvatar(agent)" :src="getCardAvatar(agent)" class="avatar-img" />
                <span v-else class="avatar-letter">{{ getCardAvatarText(agent) }}</span>
              </div>
              <div class="card-title-area">
                <h4>{{ expandedId === agent.id ? editName : agent.name }}</h4>
                <div class="assistant-meta">
                  <span class="assistant-chip">
                    <span class="chip-icon" v-html="getIcon('user', 12)"></span>
                    {{ agent.id }}
                  </span>
                  <span class="assistant-chip">
                    <span class="chip-icon" v-html="getIcon('brain', 12)"></span>
                    {{ agent.model || t('assistants.defaultModel') }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Expanded form -->
            <div class="channel-form" :class="{ open: expandedId === agent.id }" @click.stop>
              <div class="form-group">
                <label>{{ t('assistants.assistantName') }}</label>
                <input v-model="editName" type="text" :placeholder="t('assistants.assistantNamePlaceholder')" />
              </div>
              <div class="form-group">
                <label>{{ t('assistants.avatar') }}</label>
                <div class="avatar-editor">
                  <div class="avatar-grid">
                    <img
                      v-for="url in AVATARS"
                      :key="url"
                      :src="url"
                      class="avatar-pick"
                      :class="{ selected: editAvatar === url }"
                      @click="editAvatar = editAvatar === url ? '' : url"
                    />
                  </div>
                  <div class="upload-row">
                    <button type="button" class="upload-btn" @click="triggerUpload('edit')">{{ t('assistants.uploadImage') }}</button>
                    <button v-if="editAvatar" type="button" class="upload-btn" @click="editAvatar = ''">{{ t('assistants.remove') }}</button>
                  </div>
                </div>
              </div>
              <div class="btn-row" style="margin-top: 12px;">
                <button class="btn btn-secondary btn-sm" @click="handleDelete(agent)">{{ t('assistants.delete') }}</button>
                <button class="btn btn-primary btn-sm" @click="startEditFull(agent)">{{ t('assistants.editAll') }}</button>
                <button class="btn btn-primary btn-sm" @click="saveEdit(agent)">{{ t('assistants.save') }}</button>
              </div>
            </div>
          </div>

          <!-- New agent card -->
          <div
            class="model-card assistant-card assistant-create-card"
            :class="{ selected: expandedId === '__new__' }"
            @click="toggleExpand({ id: '__new__' })"
          >
            <span class="check" v-if="expandedId === '__new__'" v-html="getIcon('check', 15)"></span>
            <span class="assistant-card-sheen"></span>
            <div class="card-header">
              <div class="avatar-frame create-avatar" :class="{ 'has-img': isImgDataUrl(newAvatar) }">
                <img v-if="isImgDataUrl(newAvatar)" :src="newAvatar" class="avatar-img" />
                <span v-else-if="newAvatar || newName" class="avatar-letter">{{ newAvatar || newName?.charAt(0) || '?' }}</span>
                <span v-else v-html="getIcon('plus', 22)"></span>
              </div>
              <div class="card-title-area">
                <h4>{{ t('assistants.newAssistant') }}</h4>
                <p>{{ t('assistants.newAssistantDesc') }}</p>
              </div>
            </div>

            <div class="channel-form" :class="{ open: expandedId === '__new__' }" @click.stop>
              <div class="form-group">
                <label>{{ t('assistants.nameRequired') }}</label>
                <input v-model="newName" type="text" :placeholder="t('assistants.namePlaceholder')" @input="autoId" />
              </div>
              <div class="form-group">
                <label>{{ t('assistants.avatar') }}</label>
                <div class="avatar-editor">
                  <div class="avatar-grid">
                    <img
                      v-for="url in AVATARS"
                      :key="url"
                      :src="url"
                      class="avatar-pick"
                      :class="{ selected: newAvatar === url }"
                      @click="newAvatar = newAvatar === url ? '' : url"
                    />
                  </div>
                  <div class="upload-row">
                    <button type="button" class="upload-btn" @click="triggerUpload('new')">{{ t('assistants.uploadImage') }}</button>
                    <button v-if="newAvatar" type="button" class="upload-btn" @click="newAvatar = ''">{{ t('assistants.remove') }}</button>
                  </div>
                </div>
              </div>
              <div class="form-group">
                <label>{{ t('assistants.assistantId') }}</label>
                <input v-model="newId" type="text" :placeholder="t('assistants.idPlaceholder')" @input="newId = newId.replace(/[^a-zA-Z0-9]/g, '')" />
                <p class="hint">{{ t('assistants.idHint') }}</p>
              </div>
              <div class="btn-row" style="margin-top: 12px;">
                <button class="btn btn-primary btn-sm" :disabled="!canStep2" @click="goStep2">{{ t('channels.nextStep') }}</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Step 2: Select Model -->
      <div v-if="step === 2" class="section">
        <h2>{{ t('assistants.selectModel') }}</h2>
        <p class="desc">{{ t('assistants.selectModelDesc').replace('{name}', editingId || newName) }}</p>

        <div v-if="availableModels.length === 0" class="empty-models">
          <p>{{ t('assistants.noModels') }}<a class="link" @click="$router.push('/models')">{{ t('assistants.configureModels') }}</a></p>
        </div>

        <div v-else class="model-grid">
          <div
            class="model-card"
            :class="{ selected: !selectedModel }"
            @click="selectedModel = ''"
          >
            <span class="check" v-if="!selectedModel">✓</span>
            <h4>{{ t('assistants.useDefaultModel') }}</h4>
            <p>{{ t('assistants.followDefault') }}</p>
          </div>
          <div
            v-for="m in availableModels"
            :key="m.value"
            class="model-card"
            :class="{ selected: selectedModel === m.value }"
            @click="selectedModel = m.value"
          >
            <span class="check" v-if="selectedModel === m.value">✓</span>
            <h4>{{ m.label }}</h4>
            <p>{{ m.provider }}</p>
          </div>
        </div>

        <div class="btn-row">
          <button class="btn btn-secondary" @click="step = 1">{{ t('channels.goBack') }}</button>
          <button class="btn btn-primary" @click="goStep3">{{ t('channels.nextStep') }}</button>
        </div>
      </div>

      <!-- Step 3: Soul Files -->
      <div v-if="step === 3" class="section">
        <div class="section-header">
          <div>
            <h2>{{ t('assistants.injectSoul') }}</h2>
            <p class="desc">{{ t('assistants.injectSoulDesc') }}</p>
          </div>
          <div class="edit-mode-tabs">
            <button class="edit-mode-tab" :class="{ active: editMode === 'structured' }" @click="editMode = 'structured'">
              {{ t('assistants.editModeStructured') }}
            </button>
            <button class="edit-mode-tab" :class="{ active: editMode === 'markdown' }" @click="editMode = 'markdown'">
              {{ t('assistants.editModeMarkdown') }}
            </button>
          </div>
        </div>

        <!-- Guided edit: structured form -->
        <div v-if="editMode === 'structured'" class="edit-mode-panel">
          <AgentPersonaForm
            ref="personaFormRef"
            v-model="empData"
            :avatar-list="AVATARS"
            i18n-prefix="assistants.assistants"
            :show-id-field="false"
            :show-avatar="false"
            @request-avatar-upload="triggerStructuredUpload"
          />
        </div>

        <!-- Expert edit: markdown editor -->
        <div v-if="editMode === 'markdown'" class="edit-mode-panel">
          <div class="soul-tabs">
                <button
                  v-for="tab in SOUL_TABS"
                  :key="tab.key"
                  class="soul-tab"
                  :class="{ active: activeTab === tab.key }"
                  @click="activeTab = tab.key"
                >
                  {{ tab.label }}
                </button>
              </div>

              <template v-for="tab in SOUL_TABS" :key="tab.key">
                <div v-if="activeTab === tab.key" class="soul-panel">
                  <div class="soul-desc">
                    <strong>{{ tab.descTitle }}</strong>
                    <p>{{ tab.desc }}</p>
                  </div>
                  <div class="soul-toolbar">
                    <button class="btn btn-secondary btn-sm" @click="useTemplate(tab.key)">{{ t('assistants.useTemplate') }}</button>
                    <button class="btn btn-secondary btn-sm" @click="clearTemplate(tab.key)">{{ t('assistants.clear') }}</button>
                  </div>
                  <textarea
                    v-model="soulData[tab.key]"
                    class="soul-editor"
                    :placeholder="tab.placeholder"
                  ></textarea>
                </div>
              </template>
            </div>

        <div class="btn-row">
          <button class="btn btn-secondary" @click="step = 2">{{ t('channels.goBack') }}</button>
          <button class="btn btn-primary" :disabled="saving" @click="handleSave">
            {{ saving ? t('channels.saving') : t('assistants.finishSave') }}
          </button>
        </div>
      </div>

      <!-- Done -->
      <div v-if="step === 4" class="section result">
        <div class="result-icon">{{ gatewayStore.ready ? '✅' : '⏳' }}</div>
        <h2>{{ t('assistants.configDone') }}</h2>
        <p>{{ t('assistants.saved').replace('{name}', editingName || newName) }}</p>
        <div class="result-model">
          <span class="result-avatar">
            <img v-if="isImgDataUrl(editingAvatar || newAvatar)" :src="editingAvatar || newAvatar" class="avatar-img" />
            <span v-else>{{ editingAvatar || newAvatar || '?' }}</span>
          </span>
          {{ editingName || newName }} · {{ selectedModel || t('assistants.defaultModel') }}
        </div>
        <div class="btn-row" style="justify-content: center; margin-top: 24px;">
          <button class="btn btn-secondary" @click="resetAndNew">{{ t('assistants.continueCreate') }}</button>
          <button v-if="!restartDone" class="btn btn-primary" @click="handleRestart">{{ t('assistants.activate') }}</button>
          <template v-if="restartDone && gatewayStore.ready">
            <button class="btn btn-primary" @click="goChat">{{ t('assistants.startChat') }}</button>
            <span class="restart-ok">{{ t('assistants.activated') }}</span>
          </template>
        </div>
      </div>
    </div>
    <!-- Hidden file input for avatar upload -->
    <input ref="fileInputRef" type="file" accept="image/*" class="sr-only" @change="onFileChange" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, reactive } from 'vue'
import { useRouter } from 'vue-router'
import { useConfigStore } from '@/stores/config'
import { useGatewayStore } from '@/stores/gateway'
import { t } from '@/i18n'
import { getIcon } from '@/lib/icons'
import AgentPersonaForm from '@/components/AgentPersonaForm.vue'
import { loadAvatarDataUrls } from '@/lib/avatars'
import { processAvatarFile } from '@/lib/avatar-upload'
import { createPersona, normalizePersona, resetPersona } from '@/lib/agent-persona'
import { generateSoulMd, generateIdentityMd, generateUserMd } from '@/lib/agent-md-generator'

const router = useRouter()
const configStore = useConfigStore()
const gatewayStore = useGatewayStore()

const AVATARS = ref([])
onMounted(async () => {
  AVATARS.value = await loadAvatarDataUrls()
})

const SOUL_TABS = computed(() => [
  {
    key: 'SOUL',
    label: 'SOUL.md',
    descTitle: t('assistants.soulDesc'),
    desc: t('assistants.soulDescDetail'),
    placeholder: t('assistants.soulPlaceholder'),
  },
  {
    key: 'IDENTITY',
    label: 'IDENTITY.md',
    descTitle: t('assistants.identityDesc'),
    desc: t('assistants.identityDescDetail'),
    placeholder: t('assistants.identityPlaceholder'),
  },
  {
    key: 'USER',
    label: 'USER.md',
    descTitle: t('assistants.userDesc'),
    desc: t('assistants.userDescDetail'),
    placeholder: t('assistants.userPlaceholder'),
  },
])

const TEMPLATES = {
  SOUL: `# 产品老炮的灵魂契约
## 身份认知
- **我是谁**：20年产品老兵，做过7个日活百万级产品，经历过3次完整创业周期
- **我的优势**：擅长从0到1的产品冷启动，精通"如何用最少资源快速试错"
- **我的信条**："能赚钱的产品才是好产品，能活下去的团队才是好团队"

## 双重性格
- **平常状态**：幽默风趣，喜欢用段子和网络梗
- **工作状态**：极度专注，言简意赅，只用数据和事实说话
- **切换信号**：当用户说"开始工作"或讨论具体方案时，立即切换到工作模式

## 红线与底线
- **绝不碰的**：传销模式、灰色产业、损害用户长期价值的产品
- **必须坚持的**：用户数据隐私保护、商业道德
- **工作纪律**：不浪费时间争论"对错"，只验证"行不行"`,

  IDENTITY: `# 产品老兵名片

- **职称**：高级产品合伙人
- **花名**：老枪（来自"老将出马，一枪命中"）
- **形象符号**：🎯（代表目标明确，一击必中）
- **口头禅**：
  - 轻松时："Boss，这个idea有点意思"
  - 工作时："三个重点：痛点、方案、变现"
- **年龄设定**：45岁（经验丰富但思维不守旧）`,

  USER: `# Boss档案

## 背景画像
- **称呼**：Boss（必须用这个称呼）
- **职场履历**：互联网行业20年老兵，做过产品、开发、测试、项目管理
- **当前状态**：创业中
- **性格特点**：务实、直接、厌恶形式主义

## 现状与诉求
- **公司阶段**：初创期，需要快速验证商业模式
- **团队情况**：合伙人制，人少而精
- **核心目标**：快速找到可变现的方向

## 沟通偏好
- **说话方式**：喜欢直击要害，反感长篇大论
- **决策风格**：数据驱动，但相信"直觉+数据"双验证
- **时间观念**：极强，讨厌拖延`,
}

const step = ref(1)
const expandedId = ref('')
const editName = ref('')
const editAvatar = ref('')
const newName = ref('')
const newAvatar = ref('')
const newId = ref('')
const selectedModel = ref('')
const activeTab = ref('SOUL')
const soulData = reactive({ SOUL: '', IDENTITY: '', USER: '' })
const saving = ref(false)
const restartDone = ref(false)
const fileInputRef = ref(null)
const uploadTarget = ref('new')

// Dual-mode editing state
const editMode = ref('structured')
const personaFormRef = ref(null)
const empData = reactive(createPersona())

// Editing existing agent state
const editingId = ref('')
const editingName = ref('')
const editingAvatar = ref('')

const agentList = computed(() => {
  return configStore.config?.agents?.list || []
})

const availableModels = computed(() => {
  const providers = configStore.config?.models?.providers || {}
  const models = []
  for (const [provId, prov] of Object.entries(providers)) {
    if (!prov.models) continue
    for (const m of prov.models) {
      models.push({
        value: `${provId}/${m.id}`,
        label: m.name || m.id,
        provider: provId,
      })
    }
  }
  return models
})

const canStep2 = computed(() => newName.value.trim() && newId.value.trim())

function isImgDataUrl(str) {
  return (str || '').startsWith('data:image')
}

function getCardAvatar(agent) {
  return expandedId.value === agent.id ? editAvatar.value : (agent.identity?.avatar || '')
}

function getCardName(agent) {
  return expandedId.value === agent.id ? editName.value : (agent.name || '')
}

function isCardImgAvatar(agent) {
  return isImgDataUrl(getCardAvatar(agent))
}

function getCardAvatarText(agent) {
  return getCardAvatar(agent) || getCardName(agent)?.charAt(0) || '?'
}

function triggerUpload(target) {
  uploadTarget.value = target
  fileInputRef.value?.click()
}

function triggerStructuredUpload() {
  uploadTarget.value = 'structured'
  fileInputRef.value?.click()
}

async function onFileChange(event) {
  const file = event.target.files?.[0]
  if (!file) return
  const dataUrl = await processAvatarFile(file)
  if (uploadTarget.value === 'edit') editAvatar.value = dataUrl
  else if (uploadTarget.value === 'structured') personaFormRef.value?.setAvatar(dataUrl)
  else newAvatar.value = dataUrl
  event.target.value = ''
}

function toggleExpand(agent) {
  if (expandedId.value === agent.id) {
    expandedId.value = ''
    return
  }
  expandedId.value = agent.id
  if (agent.id !== '__new__') {
    editName.value = agent.name || ''
    editAvatar.value = agent.identity?.avatar || ''
  }
}

function autoId() {
  const n = newName.value.trim()
  if (!n) { newId.value = ''; return }
  newId.value = 'agent_' + Date.now().toString(36)
}

async function saveEdit(agent) {
  await configStore.saveAgentConfig(agent.id, editName.value.trim(), null, editAvatar.value.trim())
  expandedId.value = ''
}

async function startEditFull(agent) {
  editingId.value = agent.id
  editingName.value = agent.name || ''
  editingAvatar.value = agent.identity?.avatar || ''
  editName.value = agent.name || ''
  editAvatar.value = agent.identity?.avatar || ''
  selectedModel.value = agent.model || ''

  // Load soul files for this agent
  try {
    soulData.SOUL = await window.clawshell.readAgentFile(agent.id, 'SOUL.md') || ''
    soulData.IDENTITY = await window.clawshell.readAgentFile(agent.id, 'IDENTITY.md') || ''
    soulData.USER = await window.clawshell.readAgentFile(agent.id, 'USER.md') || ''
  } catch {}

  // Load structured persona data from agent_info.json
  await loadAgentPersona(agent.id)

  expandedId.value = ''
  step.value = 2
}

async function loadAgentPersona(agentId) {
  try {
    const raw = await window.clawshell.readAgentFile(agentId, 'agent_info.json')
    if (raw) {
      resetPersona(empData, normalizePersona(JSON.parse(raw)))
      return
    }
  } catch {}
  // No agent_info.json — reset to empty
  resetPersona(empData)
  // Seed name/avatar from agent data
  const agent = agentList.value.find(a => a.id === agentId)
  if (agent) {
    empData.name = agent.name || ''
    empData.avatar = agent.identity?.avatar || ''
  }
}

async function handleDelete(agent) {
  await configStore.deleteAgentConfig(agent.id)
  try { await window.clawshell.deleteAgent(agent.id) } catch {}
  expandedId.value = ''
}

function goStep2() {
  if (!canStep2.value) return
  step.value = 2
}

function goStep3() {
  // Reset empData for new agents; existing agents already loaded in startEditFull
  if (!editingId.value) {
    resetPersona(empData, {
      name: newName.value,
      avatar: newAvatar.value,
    })
  }
  editMode.value = 'structured'
  step.value = 3
}

function useTemplate(key) {
  soulData[key] = TEMPLATES[key]
}

function clearTemplate(key) {
  soulData[key] = ''
}

async function handleSave() {
  saving.value = true

  const isEditing = !!editingId.value
  const id = isEditing ? editingId.value : newId.value.trim()
  const name = isEditing ? editingName.value : newName.value.trim()
  const avatar = isEditing ? editingAvatar.value : newAvatar.value.trim()

  const result = await configStore.saveAgentConfig(id, name, selectedModel.value, avatar.trim())
  if (!result.ok) {
    saving.value = false
    return
  }

  if (editMode.value === 'structured') {
    // Save agent_info.json
    try {
      await window.clawshell.writeAgentFile(id, 'agent_info.json', JSON.stringify(normalizePersona(empData), null, 2))
    } catch {}
    // Generate and write .md files from structured data
    try {
      await window.clawshell.writeAgentFile(id, 'SOUL.md', generateSoulMd(empData))
      await window.clawshell.writeAgentFile(id, 'IDENTITY.md', generateIdentityMd(empData))
      await window.clawshell.writeAgentFile(id, 'USER.md', generateUserMd(empData))
    } catch {}
  } else {
    // Expert mode: write .md files directly
    for (const key of ['SOUL', 'IDENTITY', 'USER']) {
      try {
        await window.clawshell.writeAgentFile(id, `${key}.md`, soulData[key])
      } catch {}
    }
  }

  saving.value = false
  step.value = 4
}

async function handleRestart() {
  gatewayStore.restarting = true
  restartDone.value = true
  try { await window.clawshell.restartGateway() } catch {
    gatewayStore.restarting = false
  }
}

function goChat() {
  router.push({ name: 'chat' })
}

function resetAndNew() {
  editingId.value = ''
  editingName.value = ''
  editingAvatar.value = ''
  newName.value = ''
  newAvatar.value = ''
  newId.value = ''
  selectedModel.value = ''
  restartDone.value = false
  soulData.SOUL = ''
  soulData.IDENTITY = ''
  soulData.USER = ''
  editMode.value = 'structured'
  resetPersona(empData)
  expandedId.value = ''
  step.value = 1
}

onMounted(async () => {
  await configStore.load()
})
</script>

<style scoped>
.assistants-view {
  height: 100%;
  overflow-y: auto;
  padding: 24px;
}

.assistants-container {
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

/* Card grid */
.model-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 16px;
}

.model-card {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.055), rgba(255, 255, 255, 0)),
    var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 16px;
  cursor: pointer;
  transition: border-color 0.18s, box-shadow 0.18s, transform 0.18s, background 0.18s;
  position: relative;
  overflow: hidden;
  box-shadow: var(--shadow-sm);
}

.model-card:hover {
  border-color: rgba(139, 124, 255, 0.44);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}

.model-card.selected {
  border-color: var(--color-primary);
  background:
    linear-gradient(135deg, rgba(139, 124, 255, 0.16), rgba(41, 224, 194, 0.08)),
    var(--color-bg-card);
  box-shadow: var(--shadow-primary);
}

.model-card h4 {
  color: var(--color-text);
  font-size: var(--font-size-md);
  margin-bottom: 4px;
}

.model-card p {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  line-height: 1.4;
}

.check {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  color: #fff;
  background: var(--color-primary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 18px rgba(139, 124, 255, 0.34);
  z-index: 2;
}

.check :deep(svg) {
  display: block;
}

.assistant-card {
  min-height: 112px;
}

.assistant-card-sheen {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at top left, rgba(139, 124, 255, 0.18), transparent 38%),
    radial-gradient(circle at bottom right, rgba(41, 224, 194, 0.12), transparent 34%);
  opacity: 0;
  transition: opacity 0.18s;
}

.assistant-card:hover .assistant-card-sheen,
.assistant-card.selected .assistant-card-sheen {
  opacity: 1;
}

.assistant-create-card {
  border-style: dashed;
}

.assistant-create-card:hover,
.assistant-create-card.selected {
  border-style: solid;
}

/* Avatar frame in card header */
.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 1;
}

.avatar-frame {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background:
    linear-gradient(135deg, var(--color-primary), var(--color-accent));
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 12px 26px rgba(0, 0, 0, 0.16);
}

.avatar-frame .avatar-letter {
  color: #fff;
  font-size: 21px;
  font-weight: 700;
  line-height: 1;
}

.avatar-frame.has-img {
  background: var(--color-bg-hover);
}

.avatar-frame .avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.create-avatar {
  color: #fff;
}

.create-avatar :deep(svg) {
  display: block;
}

.card-title-area {
  flex: 1;
  min-width: 0;
}

.card-title-area h4 {
  color: var(--color-text);
  font-size: var(--font-size-md);
  margin-bottom: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-title-area p {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  line-height: 1.5;
}

.assistant-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.assistant-chip {
  min-width: 0;
  max-width: 100%;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 7px;
  border-radius: 999px;
  background: rgba(139, 124, 255, 0.10);
  border: 1px solid rgba(139, 124, 255, 0.18);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.assistant-chip .chip-icon {
  display: inline-flex;
  flex: 0 0 auto;
  color: var(--color-primary);
}

.assistant-chip .chip-icon :deep(svg) {
  display: block;
}

/* Expandable form */
.channel-form {
  position: relative;
  z-index: 1;
  padding-top: 0;
  margin-top: 0;
  border-top: 1px solid var(--color-border);
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease, padding 0.3s ease, margin 0.3s ease;
}

.channel-form.open {
  max-height: 600px;
  padding-top: 12px;
  margin-top: 16px;
}

.channel-form .form-group { margin-bottom: 10px; }

/* Form elements */
.form-group { margin-bottom: 16px; }

label {
  display: block;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
  font-size: var(--font-size-sm);
}

.required { color: var(--color-error); }

input[type="text"] {
  width: 100%;
  padding: 10px 14px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: var(--font-size-md);
  outline: none;
  transition: border-color 0.2s;
}

input:focus { border-color: var(--color-primary); }

/* Avatar editor */
.avatar-editor {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.avatar-controls {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.emoji-input {
  width: 60px !important;
  text-align: center;
  font-size: 1.4em;
  padding: 6px !important;
}

.emoji-picks { display: flex; flex-wrap: wrap; gap: 4px; }
.emoji-btn {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 16px;
  padding: 4px 6px;
  transition: all 0.1s;
}
.emoji-btn:hover { border-color: var(--color-primary); transform: scale(1.15); }

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

.upload-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: all 0.15s;
  width: fit-content;
}

.upload-btn:hover { border-color: var(--color-primary); color: var(--color-primary); }

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

.upload-row {
  display: flex;
  gap: 6px;
}

.hint {
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  margin-top: 6px;
}

/* Empty models */
.empty-models {
  text-align: center;
  padding: 24px;
  color: var(--color-text-tertiary);
}

.link {
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: underline;
}

/* Soul tabs */
.soul-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--color-border);
  margin-bottom: 16px;
}

.soul-tab {
  padding: 10px 18px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
}

.soul-tab:hover { color: var(--color-text); }
.soul-tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.soul-panel {
  animation: fadeIn 0.2s;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.soul-desc {
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 12px 14px;
  margin-bottom: 12px;
}

.soul-desc strong {
  display: block;
  color: var(--color-primary);
  font-size: var(--font-size-sm);
  margin-bottom: 4px;
}

.soul-desc p {
  color: var(--color-text-secondary);
  font-size: var(--font-size-xs);
  line-height: 1.5;
  margin: 0;
}

.soul-toolbar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.soul-editor {
  width: 100%;
  min-height: 280px;
  padding: 14px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  font-family: 'Consolas', 'Monaco', monospace;
  line-height: 1.6;
  outline: none;
  resize: vertical;
  transition: border-color 0.2s;
}

.soul-editor:focus { border-color: var(--color-primary); }

/* Buttons */
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

.btn-sm { padding: 8px 18px; font-size: var(--font-size-sm); }

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
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.result-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: linear-gradient(135deg, var(--color-primary), #ff9966);
  font-size: 14px;
}

.result-avatar .avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.restart-ok {
  color: var(--color-success);
  font-size: var(--font-size-sm);
  font-weight: 500;
  padding: 10px 18px;
}

/* Section header with right-aligned mode tabs */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.section-header h2 {
  margin-bottom: 4px;
}

.edit-mode-tabs {
  display: flex;
  gap: 0;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  flex-shrink: 0;
}

.edit-mode-tab {
  padding: 6px 14px;
  background: var(--color-bg-tertiary);
  border: none;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.edit-mode-tab + .edit-mode-tab {
  border-left: 1px solid var(--color-border);
}

.edit-mode-tab:hover { color: var(--color-text); }
.edit-mode-tab.active {
  background: var(--color-primary);
  color: #fff;
}

.edit-mode-panel {
  animation: fadeIn 0.2s;
}
</style>
