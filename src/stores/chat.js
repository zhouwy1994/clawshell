import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useGatewayClient } from '@/composables/gateway-client'
import { ipc } from '@/lib/ipc'

const SILENT_REPLY_PATTERN = /^\s*NO_REPLY\s*$/

function isSilentReply(text) {
  return SILENT_REPLY_PATTERN.test(text)
}

function resolveMessageText(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter(b => b && typeof b === 'object' && b.type === 'text' && typeof b.text === 'string')
    .map(b => b.text)
    .join('')
}

function isAssistantSilentReply(message) {
  if (!message || typeof message !== 'object') return false
  const role = (message.role || '').toLowerCase()
  if (role !== 'assistant') return false
  if (typeof message.text === 'string') return isSilentReply(message.text)
  const text = resolveMessageText(message.content)
  return typeof text === 'string' && isSilentReply(text)
}

function extractText(message) {
  if (!message) return null
  if (typeof message.content === 'string') return message.content
  if (typeof message.text === 'string') return message.text
  if (Array.isArray(message.content)) {
    return message.content
      .filter(b => b.type === 'text' && typeof b.text === 'string')
      .map(b => b.text)
      .join('')
  }
  return null
}

function normalizeMessage(msg) {
  const role = (msg.role || '').toLowerCase()
  if (role === 'toolresult' || role === 'tool_result') {
    const content = msg.content
    const resultText = Array.isArray(content)
      ? content.filter(b => b.type === 'text').map(b => b.text).join('')
      : (typeof content === 'string' ? content : null)
    return {
      role: 'assistant',
      content: [{ type: 'toolResult', toolUseId: msg.toolCallId, name: msg.toolName, result: resultText, isError: msg.isError }],
      timestamp: msg.timestamp || Date.now(),
    }
  }
  if (role === 'toolcall' || role === 'tool_call' || role === 'tooluse' || role === 'tool_use') {
    return {
      role: 'assistant',
      content: [{ type: 'toolCall', toolUseId: msg.id || msg.toolCallId, name: msg.toolName || msg.name, arguments: msg.arguments || msg.input }],
      timestamp: msg.timestamp || Date.now(),
    }
  }
  return msg
}

function collectAttachmentPlaybackSources(message) {
  if (!message || !Array.isArray(message.content)) return []
  return message.content
    .filter(block => block?.type === 'attachment' && block.attachment?.playbackUrl)
    .map(block => ({
      label: block.attachment.label || '',
      playbackUrl: block.attachment.playbackUrl,
      durationSeconds: block.attachment.durationSeconds || 0,
      url: block.attachment.url || '',
    }))
}

function collectLocalImageSources(message) {
  if (!message || !Array.isArray(message.content)) return []
  return message.content
    .map((block) => {
      if (block?.type === 'image' && block.source?.data) {
        return {
          kind: 'image',
          source: {
            ...block.source,
            data: block.source.data,
          },
        }
      }
      if (block?.type === 'attachment' && block.attachment?.url) {
        const mimeType = block.attachment.mimeType || block.attachment.media_type || ''
        const url = block.attachment.playbackUrl || block.attachment.url || ''
        if (!mimeType.startsWith('image/') && !String(url).startsWith('data:image/')) return null
        return {
          kind: 'attachment',
          attachment: {
            ...block.attachment,
            url: block.attachment.url,
            playbackUrl: block.attachment.playbackUrl,
          },
        }
      }
      return null
    })
    .filter(Boolean)
}

function countImageBlocks(content) {
  if (!Array.isArray(content)) return 0
  return content.filter(block =>
    block?.type === 'image' ||
    String(block?.attachment?.mimeType || block?.attachment?.media_type || '').startsWith('image/') ||
    String(block?.attachment?.url || block?.attachment?.playbackUrl || '').startsWith('data:image/')
  ).length
}

function buildAttachmentSignature(message) {
  if (!message || !Array.isArray(message.content)) return ''
  const text = resolveMessageText(message.content)
  const attachments = message.content
    .filter(block => block?.type === 'attachment' && block.attachment)
    .map(block => `${block.attachment.label || ''}|${block.attachment.kind || ''}`)
    .join('||')
  const imageCount = countImageBlocks(message.content)
  return `${(message.role || '').toLowerCase()}::${text}::${attachments}::images=${imageCount}`
}

function takeQueueItem(map, key) {
  const queue = key ? map.get(key) : null
  return queue?.length ? queue.shift() : null
}

function mergeLocalPlaybackSources(history, currentMessages) {
  const sourceMap = new Map()
  const imageSourceMap = new Map()
  const imageFallbackMap = new Map()

  for (const message of currentMessages || []) {
    const sources = collectAttachmentPlaybackSources(message)
    const key = buildAttachmentSignature(message)
    if (sources.length > 0) {
      const existing = sourceMap.get(key) || []
      existing.push(sources)
      sourceMap.set(key, existing)
    }

    const imageSources = collectLocalImageSources(message)
    if (imageSources.length > 0) {
      const existingImages = imageSourceMap.get(key) || []
      existingImages.push(imageSources)
      imageSourceMap.set(key, existingImages)

      const roleKey = (message.role || '').toLowerCase()
      const fallbackImages = imageFallbackMap.get(roleKey) || []
      fallbackImages.push(imageSources)
      imageFallbackMap.set(roleKey, fallbackImages)
    }
  }

  return (history || []).map((message) => {
    const key = buildAttachmentSignature(message)
    const matched = takeQueueItem(sourceMap, key)
    const roleKey = (message.role || '').toLowerCase()
    const historyImageCount = countImageBlocks(message.content)
    const exactImages = takeQueueItem(imageSourceMap, key)
    if (exactImages) takeQueueItem(imageFallbackMap, roleKey)
    const matchedImages = exactImages || takeQueueItem(imageFallbackMap, roleKey)
    if ((!matched && !matchedImages) || !Array.isArray(message.content)) return message

    let playbackIndex = 0
    let imageIndex = 0
    const nextContent = message.content.map((block) => {
      if (block?.type === 'image') {
        const image = matchedImages?.[imageIndex++]
        if (!image?.source?.data) return block
        return {
          ...block,
          source: {
            ...block.source,
            ...image.source,
          },
        }
      }
      if (block?.type === 'attachment' && block.attachment) {
        const isImageAttachment = String(block.attachment.mimeType || block.attachment.media_type || '').startsWith('image/') || String(block.attachment.url || '').startsWith('data:image/')
        const image = isImageAttachment ? matchedImages?.[imageIndex++] : null
        const playback = matched?.[playbackIndex++]
        return {
          ...block,
          attachment: {
            ...block.attachment,
            ...(image?.attachment || {}),
            ...(playback?.playbackUrl ? {
              playbackUrl: playback.playbackUrl,
              durationSeconds: playback.durationSeconds || block.attachment.durationSeconds,
            } : {}),
          },
        }
      }
      return block
    })

    while (matchedImages && imageIndex < matchedImages.length && historyImageCount === 0) {
      const image = matchedImages[imageIndex++]
      if (image?.source?.data) {
        nextContent.push({ type: 'image', source: { ...image.source } })
      } else if (image?.attachment?.url || image?.attachment?.playbackUrl) {
        nextContent.push({ type: 'attachment', attachment: { ...image.attachment } })
      }
    }

    return { ...message, content: nextContent }
  })
}

function formatToolOutput(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (typeof value === 'string') {
    return value.length > 10000 ? value.slice(0, 10000) + '...' : value
  }
  if (value && typeof value === 'object') {
    if (typeof value.text === 'string') return value.text
    if (Array.isArray(value.content)) {
      const parts = value.content
        .filter(b => b && b.type === 'text' && typeof b.text === 'string')
        .map(b => b.text)
      if (parts.length > 0) return parts.join('\n')
    }
  }
  try { return JSON.stringify(value, null, 2) } catch { return String(value) }
}

export const useChatStore = defineStore('chat', () => {
  const gw = useGatewayClient()
  let eventUnsubscribers = []

  // Sessions
  const sessions = ref([])
  const sessionsLoading = ref(false)
  const sessionsFilter = ref('')

  // Current session
  const currentSessionKey = ref('')
  const messages = ref([])
  const historyLoading = ref(false)

  // Streaming
  const streamText = ref('')
  const isStreaming = ref(false)
  const runId = ref(null)

  // Tool stream — separate from messages, shown inline during streaming
  const toolMessages = ref([])

  // Input
  const inputText = ref('')
  const attachments = ref([])

  // Agents & Models
  const agents = ref([])
  const agentsLoading = ref(false)
  const selectedAgentId = ref('')
  const models = ref([])
  const modelsLoading = ref(false)
  const selectedModelId = ref(null)

  // UI state
  const error = ref(null)
  const sessionPanelCollapsed = ref(false)
  const showThinking = ref(false)
  const showToolCalls = ref(true)
  const thinkingLevel = ref('off')

  // Computed
  const filteredSessions = computed(() => {
    const keyword = sessionsFilter.value.trim().toLowerCase()
    if (!keyword) return sessions.value
    return sessions.value.filter(s =>
      (s.label || s.key || '').toLowerCase().includes(keyword)
    )
  })

  function resolveMainKey() {
    const snapshot = gw.hello.value?.snapshot
    return snapshot?.sessionDefaults?.mainKey || 'main'
  }

  function buildSessionKey(agentId) {
    return `agent:${agentId}:${resolveMainKey()}`
  }

  // Actions
  async function connectToGateway() {
    try {
      const status = await ipc.getGatewayStatus()
      if (status.ready && (status.port || status.remoteUrl)) {
        gw.connect(status.port, status.token || 'clawshell', status.remoteUrl || '')
      }
    } catch (e) {
      console.error('[chat] connect failed:', e)
    }
  }

  async function loadAgents() {
    if (!gw.connected.value) return
    agentsLoading.value = true
    try {
      const res = await gw.request('agents.list', {})
      agents.value = res?.agents || []
      const id = res?.defaultId || res?.agents?.[0]?.id || 'main'
      if (!selectedAgentId.value || !res?.agents?.some(a => a.id === selectedAgentId.value)) {
        selectedAgentId.value = id
      }
    } catch (e) {
      console.error('[chat] load agents failed:', e)
    } finally {
      agentsLoading.value = false
    }
  }

  async function loadModels() {
    if (!gw.connected.value) return
    modelsLoading.value = true
    try {
      const res = await gw.request('models.list', {})
      models.value = res?.models || []
    } catch (e) {
      console.error('[chat] load models failed:', e)
    } finally {
      modelsLoading.value = false
    }
  }

  async function loadSessions() {
    if (!gw.connected.value) return
    sessionsLoading.value = true
    try {
      const res = await gw.request('sessions.list', {
        includeGlobal: false,
        includeUnknown: false,
      })
      sessions.value = res?.sessions || []
      await gw.request('sessions.subscribe', {})
    } catch (e) {
      console.error('[chat] load sessions failed:', e)
    } finally {
      sessionsLoading.value = false
    }
  }

  async function createSession(agentId, label) {
    const aid = agentId || selectedAgentId.value || 'main'
    const key = buildSessionKey(aid)
    selectedAgentId.value = aid
    currentSessionKey.value = key
    messages.value = []
    streamText.value = ''
    isStreaming.value = false
    runId.value = null
    error.value = null
    inputText.value = ''
    toolMessages.value = []
    thinkingLevel.value = 'off'
    if (gw.connected.value) {
      try {
        if (label) {
          await gw.request('sessions.patch', { key, label })
        }
        await loadSessions()
      } catch (e) {
        console.error('[chat] failed to set session label:', e)
      }
    }
  }

  async function switchSession(key) {
    if (key === currentSessionKey.value) return
    const parts = key?.split(':')
    if (parts?.length >= 2 && parts[0] === 'agent') {
      selectedAgentId.value = parts[1]
    }
    currentSessionKey.value = key
    messages.value = []
    streamText.value = ''
    isStreaming.value = false
    runId.value = null
    toolMessages.value = []
    historyLoading.value = true
    try {
      const res = await gw.request('chat.history', {
        sessionKey: key,
        limit: 200,
      })
      const history = Array.isArray(res?.messages) ? res.messages : []
      messages.value = mergeLocalPlaybackSources(
        history
        .map(normalizeMessage)
        .filter(msg => !isAssistantSilentReply(msg)),
        messages.value,
      )
      thinkingLevel.value = res?.thinkingLevel || 'off'
    } catch (e) {
      error.value = '加载历史消息失败: ' + (e.message || e)
    } finally {
      historyLoading.value = false
    }
  }

  let historyLoadingPromise = null

  async function loadHistory() {
    if (!gw.connected.value || !currentSessionKey.value) return
    // Deduplicate: if a loadHistory is already in-flight, wait for it instead of firing another
    if (historyLoadingPromise) return historyLoadingPromise
    historyLoadingPromise = (async () => {
      try {
        const res = await gw.request('chat.history', {
          sessionKey: currentSessionKey.value,
          limit: 200,
        })
        const history = Array.isArray(res?.messages) ? res.messages : []
        messages.value = mergeLocalPlaybackSources(
          history
          .map(normalizeMessage)
          .filter(msg => !isAssistantSilentReply(msg)),
          messages.value,
        )
      } catch (e) {
        console.error('[chat] reload history failed:', e)
      } finally {
        historyLoadingPromise = null
      }
    })()
    return historyLoadingPromise
  }

  async function deleteSession(key) {
    if (!gw.connected.value) return
    try {
      await gw.request('sessions.delete', { key, deleteTranscript: true })
      sessions.value = sessions.value.filter(s => s.key !== key)
      if (currentSessionKey.value === key) {
        await createSession()
      }
    } catch (e) {
      error.value = '删除对话失败: ' + (e.message || e)
    }
  }

  async function renameSession(key, label) {
    if (!gw.connected.value) return
    try {
      await gw.request('sessions.patch', { key, label })
      const session = sessions.value.find(s => s.key === key)
      if (session) session.label = label
    } catch (e) {
      error.value = '重命名失败: ' + (e.message || e)
    }
  }

  async function sendMessage(text, atts) {
    if (!gw.connected.value) return
    const msg = text.trim()
    if (!msg && (!atts || atts.length === 0)) return
    const transcriptText = (atts || []).find(att => att?.transcriptText)?.transcriptText?.trim() || ''

    const userContent = []
    if (msg) userContent.push({ type: 'text', text: msg })
    if (atts && atts.length > 0) {
      for (const att of atts) {
        if (att.mimeType && att.mimeType.startsWith('image/')) {
          userContent.push({ type: 'image', source: { type: 'base64', media_type: att.mimeType, data: att.dataUrl } })
        } else {
          userContent.push({
            type: 'attachment',
            attachment: {
              url: att.dataUrl,
              playbackUrl: att.playbackUrl,
              durationSeconds: att.durationSeconds,
              kind: 'document',
              label: att.fileName || 'file',
            },
          })
        }
      }
    }

    messages.value = [...messages.value, {
      role: 'user',
      content: userContent,
      timestamp: Date.now(),
    }]

    const apiAttachments = atts && atts.length > 0
      ? atts.filter(att => !att.localOnly).map(att => {
          const base64Idx = att.dataUrl?.indexOf(';base64,')
          if (base64Idx == null || base64Idx < 5) return null
          const mime = att.dataUrl.slice(5, base64Idx) // skip "data:"
          const content = att.dataUrl.slice(base64Idx + 8) // skip ";base64,"
          const type = mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'file' : 'file'
          return { type, mimeType: mime, fileName: att.fileName, content }
        }).filter(Boolean)
      : undefined

    if (apiAttachments?.length) {
      console.debug('[chat-store] sending attachments', apiAttachments.map(att => ({
        type: att.type,
        mimeType: att.mimeType,
        fileName: att.fileName,
        contentLength: att.content?.length || 0,
      })))
    }

    const newRunId = crypto.randomUUID()
    runId.value = newRunId
    isStreaming.value = true
    streamText.value = ''
    toolMessages.value = []
    error.value = null

    try {
      const sendParams = {
        sessionKey: currentSessionKey.value,
        message: msg || transcriptText || (apiAttachments?.length ? '[voice message]' : ''),
        deliver: false,
        idempotencyKey: newRunId,
      }
      if (apiAttachments && apiAttachments.length > 0) {
        sendParams.attachments = apiAttachments
      }
      await gw.request('chat.send', sendParams)
    } catch (e) {
      isStreaming.value = false
      runId.value = null
      streamText.value = ''
      error.value = '发送失败: ' + (e.message || e)
      messages.value = [...messages.value, {
        role: 'assistant',
        content: [{ type: 'text', text: '发送失败: ' + (e.message || e) }],
        timestamp: Date.now(),
      }]
    }

    inputText.value = ''
    attachments.value = []
  }

  async function abortGeneration() {
    if (!gw.connected.value || !runId.value) return
    try {
      await gw.request('chat.abort', {
        sessionKey: currentSessionKey.value,
        runId: runId.value,
      })
    } catch (e) {
      console.error('[chat] abort failed:', e)
    }
    if (streamText.value.trim() && !isSilentReply(streamText.value)) {
      messages.value = [...messages.value, {
        role: 'assistant',
        content: [{ type: 'text', text: streamText.value }],
        timestamp: Date.now(),
      }]
    }
    streamText.value = ''
    isStreaming.value = false
    runId.value = null
    toolMessages.value = []
  }

  function toggleSessionPanel() {
    sessionPanelCollapsed.value = !sessionPanelCollapsed.value
  }

  function deleteMessage(index) {
    if (index >= 0 && index < messages.value.length) {
      messages.value.splice(index, 1)
    }
  }

  async function selectAgent(agentId) {
    if (agentId === selectedAgentId.value) return
    selectedAgentId.value = agentId
    const key = buildSessionKey(agentId)
    const existing = sessions.value.find(s => s.key === key)
    if (existing) {
      await switchSession(key)
    } else {
      await createSession()
    }
  }

  async function selectModel(modelId) {
    const id = modelId || null
    if (id === selectedModelId.value) return
    selectedModelId.value = id

    try {
      const config = await ipc.getConfig()
      const list = config.agents?.list
      if (!Array.isArray(list)) return
      const agent = list.find(a => a.id === selectedAgentId.value)
      if (!agent) return
      if (!agent.model) agent.model = {}
      agent.model.primary = id || undefined
      await ipc.saveConfig(config)
    } catch (e) {
      console.error('[chat] failed to save model config:', e)
    }
  }

  async function setThinkingLevel(level) {
    if (!gw.connected.value || !currentSessionKey.value) return
    const normalized = (level || 'off').trim().toLowerCase()
    if (normalized === thinkingLevel.value) return
    const previous = thinkingLevel.value
    thinkingLevel.value = normalized
    error.value = null
    try {
      await gw.request('sessions.patch', {
        key: currentSessionKey.value,
        thinkingLevel: normalized,
      })
    } catch (e) {
      thinkingLevel.value = previous
      error.value = e.message || String(e)
      console.error('[chat] failed to set thinking level:', e)
    }
  }

  function initEventListeners() {
    if (eventUnsubscribers.length > 0) {
      return disposeEventListeners
    }

    // ── chat events: the ONLY source for message display ──
    // Matches official UI's handleChatEvent in controllers/chat.ts
    eventUnsubscribers.push(gw.onEvent('chat', (payload) => {
      if (!payload || payload.sessionKey !== currentSessionKey.value) return

      // Final from another run (e.g. sub-agent): reload history
      if (payload.runId && runId.value && payload.runId !== runId.value) {
        if (payload.state === 'final') {
          loadHistory()
        }
        return
      }

      if (payload.state === 'delta') {
        const text = extractText(payload.message)
        if (typeof text === 'string' && !isSilentReply(text)) {
          streamText.value = text
        }
      } else if (payload.state === 'final') {
        streamText.value = ''
        isStreaming.value = false
        runId.value = null
        toolMessages.value = []
        // Reload history from gateway to get canonical message order
        loadHistory()
      } else if (payload.state === 'aborted') {
        if (streamText.value.trim() && !isSilentReply(streamText.value)) {
          messages.value = [...messages.value, {
            role: 'assistant',
            content: [{ type: 'text', text: streamText.value }],
            timestamp: Date.now(),
          }]
        }
        streamText.value = ''
        isStreaming.value = false
        runId.value = null
        toolMessages.value = []
      } else if (payload.state === 'error') {
        streamText.value = ''
        isStreaming.value = false
        runId.value = null
        toolMessages.value = []
        error.value = payload.errorMessage || 'chat error'
      }
    }))

    // ── agent events: real-time tool stream ──
    // Matches official UI's handleAgentEvent in app-tool-stream.ts
    eventUnsubscribers.push(gw.onEvent('agent', (payload) => {
      if (!payload) return
      if (payload.stream !== 'tool') return

      const sk = payload.sessionKey
      if (sk && sk !== currentSessionKey.value) return

      const data = payload.data || {}
      const toolCallId = data.toolCallId
      if (!toolCallId) return

      const name = data.name || 'tool'
      const phase = data.phase || ''

      const existingIdx = toolMessages.value.findIndex(t => t.toolCallId === toolCallId)

      if (existingIdx >= 0) {
        const existing = { ...toolMessages.value[existingIdx] }
        existing.name = name
        if (phase === 'start' && data.args !== undefined) {
          existing.args = data.args
        }
        if (phase === 'update' && data.partialResult !== undefined) {
          existing.partialResult = formatToolOutput(data.partialResult)
        }
        if (phase === 'result' && data.result !== undefined) {
          existing.result = formatToolOutput(data.result)
        }
        toolMessages.value = toolMessages.value.map((t, i) => i === existingIdx ? existing : t)
      } else {
        // New tool call — commit current streaming text first
        if (isStreaming.value && streamText.value.trim()) {
          messages.value = [...messages.value, {
            role: 'assistant',
            content: [{ type: 'text', text: streamText.value }],
            timestamp: Date.now(),
          }]
          streamText.value = ''
        }

        toolMessages.value = [...toolMessages.value, {
          toolCallId,
          name,
          args: phase === 'start' ? data.args : undefined,
          partialResult: phase === 'update' ? formatToolOutput(data.partialResult) : undefined,
          result: phase === 'result' ? formatToolOutput(data.result) : undefined,
          startedAt: typeof payload.ts === 'number' ? payload.ts : Date.now(),
        }]
      }
    }))

    // ── session list updates ──
    eventUnsubscribers.push(gw.onEvent('sessions.changed', (payload) => {
      if (!payload) return
      const key = payload.session?.key || payload.sessionKey || payload.key || ''
      if (!key) return
      const existing = sessions.value.findIndex(s => s.key === key)
      if (existing >= 0) {
        const updated = { ...sessions.value[existing], ...payload.session }
        sessions.value = sessions.value.map((s, i) => i === existing ? updated : s)
      } else {
        sessions.value = [{ key, ...payload.session }, ...sessions.value]
      }
    }))

    return disposeEventListeners
  }

  function disposeEventListeners() {
    for (const unsubscribe of eventUnsubscribers) {
      try { unsubscribe() } catch (e) { console.error('[chat] failed to remove listener:', e) }
    }
    eventUnsubscribers = []
  }

  return {
    sessions, sessionsLoading, sessionsFilter,
    currentSessionKey, messages, historyLoading,
    streamText, isStreaming, runId,
    toolMessages,
    inputText, attachments,
    agents, agentsLoading, selectedAgentId,
    models, modelsLoading, selectedModelId,
    error, sessionPanelCollapsed, showThinking, showToolCalls, thinkingLevel,
    filteredSessions,
    connectToGateway, loadSessions, loadAgents, loadModels,
    createSession, switchSession, deleteSession, renameSession, deleteMessage,
    sendMessage, abortGeneration,
    selectAgent, selectModel, setThinkingLevel,
    toggleSessionPanel,
    initEventListeners, disposeEventListeners,
  }
})
