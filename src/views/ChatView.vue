<template>
  <div class="chat-view">
    <SessionPanel
      :sessions="chatStore.filteredSessions"
      :current-key="chatStore.currentSessionKey"
      :collapsed="chatStore.sessionPanelCollapsed"
      :loading="chatStore.sessionsLoading"
      :filter="chatStore.sessionsFilter"
      @create="showNewSessionDialog = true"
      @switch="chatStore.switchSession"
      @toggle="chatStore.toggleSessionPanel"
      @update:filter="chatStore.sessionsFilter = $event"
      @rename="chatStore.renameSession"
      @delete="chatStore.deleteSession"
    />
    <div class="chat-main">
      <div class="chat-header">
        <div class="chat-header-left">
          <button
            v-if="!chatStore.sessionPanelCollapsed"
            class="icon-btn"
            @click="chatStore.toggleSessionPanel"
            v-html="getIcon('panel-left-close', 18)"
          ></button>
          <span v-if="currentAgentName" class="header-agent">
            {{ t('chat.assistant') }}<b>{{ currentAgentName }}</b>
          </span>
          <span v-if="currentModelName" class="header-model">{{ t('chat.model') }}<b>{{ currentModelName }}</b></span>
        </div>
        <div class="chat-header-right">
          <label class="thinking-select-wrap" :title="t('chat.thinkingDepth')">
            <select
              class="thinking-select"
              :value="chatStore.thinkingLevel"
              @change="chatStore.setThinkingLevel($event.target.value)"
            >
              <option value="off">{{ t('chat.thinkingOff') }}</option>
              <option value="low">{{ t('chat.thinkingLow') }}</option>
              <option value="medium">{{ t('chat.thinkingMedium') }}</option>
              <option value="high">{{ t('chat.thinkingHigh') }}</option>
            </select>
          </label>
          <button
            class="toggle-btn"
            :class="{ active: chatStore.showThinking }"
            :title="t('chat.showThinking')"
            @click="chatStore.showThinking = !chatStore.showThinking"
            v-html="getIcon('brain', 16)"
          ></button>
          <button
            class="toggle-btn"
            :class="{ active: chatStore.showToolCalls }"
            :title="t('chat.toolOutput')"
            @click="chatStore.showToolCalls = !chatStore.showToolCalls"
            v-html="getIcon('wrench', 16)"
          ></button>
          <button
            class="toggle-btn immersive-btn"
            :title="t('chat.immersiveMode')"
            @click="immersiveVisible = true"
            v-html="getIcon('radio', 16)"
          ></button>
        </div>
      </div>

      <div class="chat-messages" ref="messagesRef">
        <div v-if="chatStore.historyLoading" class="chat-loading">{{ t('chat.loadingHistory') }}</div>
        <div v-else-if="chatStore.messages.length === 0 && !chatStore.isStreaming" class="chat-empty">
          <span class="empty-icon" v-html="getIcon('message-square', 48, 'var(--color-text-tertiary)')"></span>
          <p>{{ t('chat.startNew') }}</p>
        </div>
        <template v-for="(msg, i) in chatStore.messages" :key="'msg-' + i">
          <ChatMessage
            :message="msg"
            :agent-avatar="currentAgentAvatar"
            :user-avatar="userAvatar"
            :context-window="currentModelContextWindow"
            :show-thinking="chatStore.showThinking"
            :show-tool-calls="chatStore.showToolCalls"
            @delete="chatStore.deleteMessage(i)"
          />
        </template>
        <!-- Real-time tool cards during streaming -->
        <template v-if="chatStore.isStreaming && chatStore.showToolCalls">
          <ToolCallCard
            v-for="(tool, ti) in chatStore.toolMessages"
            :key="'tool-' + tool.toolCallId"
            :tool-name="tool.name"
            :tool-input="tool.args"
            :tool-result="tool.result || tool.partialResult"
          />
        </template>
        <div v-if="chatStore.isStreaming && chatStore.streamText" class="chat-streaming">
          <ChatMessage
            :message="{ role: 'assistant', content: chatStore.streamText, timestamp: Date.now() }"
            :agent-avatar="currentAgentAvatar"
            :user-avatar="userAvatar"
            :streaming="true"
          />
        </div>
        <div v-if="chatStore.error" class="chat-error">
          <span v-html="getIcon('alert-circle', 16, 'var(--color-error)')"></span>
          {{ chatStore.error }}
        </div>
      </div>

      <ChatInput
        v-model="chatStore.inputText"
        :disabled="!gatewayReady"
        :is-streaming="chatStore.isStreaming"
        @send="handleSend"
        @abort="chatStore.abortGeneration"
      />
    </div>
    <NewSessionDialog
      :agents="chatStore.agents"
      :sessions="chatStore.sessions"
      :default-agent-id="chatStore.selectedAgentId"
      :visible="showNewSessionDialog"
      @close="showNewSessionDialog = false"
      @create="handleNewSession"
    />
    <ImmersiveVoiceMode
      v-if="immersiveVisible"
      :assistant-name="currentAgentName"
      :model-name="currentModelName"
      @exit="immersiveVisible = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useChatStore } from '@/stores/chat'
import { useConfigStore } from '@/stores/config'
import { useGatewayStore } from '@/stores/gateway'
import { useGatewayClient } from '@/composables/gateway-client'
import { getIcon } from '@/lib/icons'
import { t } from '@/i18n'
import SessionPanel from '@/components/SessionPanel.vue'
import ChatMessage from '@/components/ChatMessage.vue'
import ChatInput from '@/components/ChatInput.vue'
import ToolCallCard from '@/components/ToolCallCard.vue'
import NewSessionDialog from '@/components/NewSessionDialog.vue'
import ImmersiveVoiceMode from '@/components/ImmersiveVoiceMode.vue'
import { ipc } from '@/lib/ipc'

const chatStore = useChatStore()
const configStore = useConfigStore()
const gatewayStore = useGatewayStore()
const gw = useGatewayClient()
const messagesRef = ref(null)
const showNewSessionDialog = ref(false)
const immersiveVisible = ref(false)

const gatewayReady = computed(() => gatewayStore.ready)

const currentAgentName = computed(() => {
  const agent = chatStore.agents.find(a => a.id === chatStore.selectedAgentId)
  return agent?.identity?.name || agent?.name || agent?.id || ''
})

const currentAgentAvatar = computed(() => {
  const agent = chatStore.agents.find(a => a.id === chatStore.selectedAgentId)
  if (agent?.identity?.avatar) return agent.identity.avatar
  const cfg = configStore.config?.agents?.list?.find(a => a.id === chatStore.selectedAgentId)
  return cfg?.identity?.avatar || ''
})

const userAvatar = ref('')

const currentModelName = computed(() => {
  // 1. From explicit selection
  let modelId = chatStore.selectedModelId
  // 2. From agent config
  if (!modelId) {
    const agent = chatStore.agents.find(a => a.id === chatStore.selectedAgentId)
    modelId = agent?.model?.primary
  }
  // 3. From last assistant message
  if (!modelId) {
    const msgs = chatStore.messages
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]
      if (m.role === 'assistant' && m.model && m.model !== 'gateway-injected') {
        modelId = m.model
        break
      }
    }
  }
  if (!modelId) return null
  const model = chatStore.models.find(m => m.id === modelId)
  return model?.name || (modelId.includes('/') ? modelId.split('/').pop() : modelId)
})

const currentModelContextWindow = computed(() => {
  const modelId = chatStore.selectedModelId
  if (!modelId) return null
  const model = chatStore.models.find(m => m.id === modelId)
  return model?.contextWindow || null
})

async function handleSend(text, attachments) {
  await chatStore.sendMessage(text, attachments)
  scrollToBottom()
}

async function handleNewSession(agentId, label) {
  showNewSessionDialog.value = false
  await chatStore.createSession(agentId, label)
}

function scrollToBottom() {
  nextTick(() => {
    const el = messagesRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

watch(
  () => [chatStore.messages.length, chatStore.streamText, chatStore.toolMessages.length],
  () => scrollToBottom(),
)

let listenersInitialized = false
let stopConnectedWatch = null
let cleanupChatListeners = null

async function initChat() {
  if (!gatewayStore.ready) return

  configStore.load()
  cleanupChatListeners = chatStore.initEventListeners()
  listenersInitialized = true

  // Only connect if not already connected (same gateway params)
  if (!gw.connected.value) {
    await chatStore.connectToGateway()
  }

  // Load data once connected
  const loadData = async () => {
    await chatStore.loadAgents()
    await chatStore.loadModels()
    await chatStore.loadSessions()
    if (chatStore.sessions.length > 0) {
      await chatStore.switchSession(chatStore.sessions[0].key)
    } else {
      await chatStore.createSession()
    }
  }

  if (gw.connected.value) {
    await loadData()
  } else {
    stopConnectedWatch = watch(() => gw.connected.value, async (isConnected) => {
      if (isConnected) {
        await loadData()
        stopConnectedWatch?.()
        stopConnectedWatch = null
      }
    })
  }
}

onMounted(async () => {
  initChat()
  const settings = await ipc.getSettings()
  if (settings?.user?.avatar) userAvatar.value = settings.user.avatar
})

watch(() => gatewayStore.ready, (ready) => {
  if (ready && !listenersInitialized) {
    initChat()
  }
})

onUnmounted(() => {
  stopConnectedWatch?.()
  stopConnectedWatch = null
  cleanupChatListeners?.()
  cleanupChatListeners = null
  listenersInitialized = false
})
</script>

<style scoped>
.chat-view {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.chat-header {
  padding: 12px 20px;
  border-bottom: 1px solid var(--color-border);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.chat-header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-agent {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  padding: 3px 8px;
  border-radius: var(--radius-md);
  white-space: nowrap;
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-agent b {
  color: var(--color-text);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.header-model {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  padding: 3px 8px;
  border-radius: var(--radius-md);
  white-space: nowrap;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-model b {
  color: var(--color-text);
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

.chat-header-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  color: var(--color-text-tertiary);
  transition: background 0.15s, color 0.15s;
}

.toggle-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.toggle-btn.active {
  color: var(--color-primary);
  background: rgba(255, 107, 53, 0.1);
}

.toggle-btn :deep(svg) { display: block; }

.thinking-select-wrap {
  display: flex;
  align-items: center;
}

.thinking-select {
  appearance: none;
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 4px 24px 4px 10px;
  font-size: var(--font-size-xs);
  cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23999' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  background-size: 12px;
  line-height: 1.4;
}

.thinking-select:hover {
  border-color: var(--color-text-tertiary);
}

.thinking-select:focus {
  outline: none;
  border-color: var(--color-primary);
}

.icon-btn {
  color: var(--color-text-secondary);
  padding: 4px;
  border-radius: var(--radius-sm);
}

.icon-btn:hover { background: var(--color-bg-hover); }
.icon-btn :deep(svg) { display: block; }

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px 48px;
}

.chat-loading, .chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-tertiary);
  gap: 12px;
}

.empty-icon { opacity: 0.3; }
.empty-icon :deep(svg) { display: block; }

.chat-streaming {
  margin-bottom: 20px;
}

.chat-error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(239, 68, 68, 0.1);
  border-radius: var(--radius-sm);
  color: var(--color-error);
  font-size: var(--font-size-sm);
  margin: 8px 0;
}

.chat-error :deep(svg) { display: block; flex-shrink: 0; }
</style>
