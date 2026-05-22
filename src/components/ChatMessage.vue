<template>
  <div v-if="visible" class="chat-message" :class="[`role-${message.role}`, { streaming }]">
    <div class="message-avatar" :class="message.role">
      <template v-if="message.role === 'assistant' && agentAvatar">
        <img v-if="agentAvatar.startsWith('data:')" :src="agentAvatar" class="avatar-img" />
        <span v-else class="avatar-emoji">{{ agentAvatar }}</span>
      </template>
      <template v-else-if="message.role === 'user' && userAvatar">
        <img :src="userAvatar" class="avatar-img" />
      </template>
      <span v-else v-html="getIcon(message.role === 'user' ? 'user' : 'bot', 18)"></span>
    </div>
    <div class="message-body">
      <div class="message-bubble" :class="message.role">
        <div v-if="thinkingText && showThinking" class="thinking-block">
          <div class="thinking-header" @click="thinkingExpanded = !thinkingExpanded">
            <span class="thinking-icon" v-html="getIcon('brain', 14)"></span>
            <span>{{ t('chat.thinkingProcess') }}</span>
            <span class="thinking-toggle" v-html="getIcon(thinkingExpanded ? 'chevron-down' : 'chevron-right', 12)"></span>
          </div>
          <div v-if="thinkingExpanded" class="thinking-content" v-html="renderedThinking"></div>
        </div>
        <div v-if="hasToolCalls && showToolCalls" class="tool-calls">
          <ToolCallCard
            v-for="(tc, i) in toolCalls"
            :key="i"
            :tool-name="tc.name || tc.toolName || ''"
            :tool-input="tc.arguments || tc.input || tc.toolInput"
            :tool-result="tc.result || tc.output || tc.toolResult"
          />
        </div>
        <div
          v-if="displayText"
          ref="contentRef"
          class="message-content"
          :class="{ 'md-content': message.role === 'assistant' }"
          v-html="renderedContent"
        ></div>
        <span v-if="streaming" class="typing-cursor"></span>
      </div>
      <div v-if="!streaming" class="message-footer">
        <span class="footer-left">
          <span class="msg-time">{{ formatTime(message.timestamp) }}</span>
          <template v-if="message.role === 'assistant' && hasMeta">
            <span v-if="usage.input" class="msg-meta-tag">↑{{ fmtTokens(usage.input) }}</span>
            <span v-if="usage.output" class="msg-meta-tag">↓{{ fmtTokens(usage.output) }}</span>
            <span v-if="usage.cacheRead" class="msg-meta-tag meta-cache">R{{ fmtTokens(usage.cacheRead) }}</span>
            <span v-if="usage.cacheWrite" class="msg-meta-tag meta-cache">W{{ fmtTokens(usage.cacheWrite) }}</span>
            <span v-if="contextPercent !== null" class="msg-meta-tag" :class="ctxClass">{{ contextPercent }}% ctx</span>
            <span v-if="shortModel" class="msg-meta-tag meta-model">{{ shortModel }}</span>
          </template>
        </span>
        <span v-if="message.role === 'assistant'" class="footer-actions">
          <button
            v-if="ttsSupported"
            class="action-btn"
            :class="{ active: ttsPlaying }"
            :title="ttsPlaying ? t('chat.stopReading') : t('chat.readAloud')"
            @click="toggleTts"
            v-html="getIcon(ttsPlaying ? 'square' : 'volume-2', 14)"
          ></button>
          <button
            class="action-btn action-delete"
            :title="t('chat.deleteMessage')"
            @click="handleDelete"
            v-html="getIcon('trash-2', 14)"
          ></button>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, nextTick, watch } from 'vue'
import MarkdownIt from 'markdown-it'
import { ipc } from '@/lib/ipc'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import json from 'highlight.js/lib/languages/json'
import bash from 'highlight.js/lib/languages/bash'
import css from 'highlight.js/lib/languages/css'
import xml from 'highlight.js/lib/languages/xml'
import markdown from 'highlight.js/lib/languages/markdown'
import { getIcon } from '@/lib/icons'
import { t } from '@/i18n'
import ToolCallCard from '@/components/ToolCallCard.vue'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('js', javascript)
hljs.registerLanguage('python', python)
hljs.registerLanguage('py', python)
hljs.registerLanguage('json', json)
hljs.registerLanguage('bash', bash)
hljs.registerLanguage('sh', bash)
hljs.registerLanguage('css', css)
hljs.registerLanguage('html', xml)
hljs.registerLanguage('xml', xml)
hljs.registerLanguage('markdown', markdown)

const props = defineProps({
  message: { type: Object, required: true },
  streaming: { type: Boolean, default: false },
  contextWindow: { type: Number, default: null },
  showThinking: { type: Boolean, default: false },
  showToolCalls: { type: Boolean, default: true },
  agentAvatar: { type: String, default: '' },
  userAvatar: { type: String, default: '' },
})

const emit = defineEmits(['delete'])

const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: true,
  highlight(str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try { return hljs.highlight(str, { language: lang }).value } catch {}
    }
    return ''
  },
})

const displayText = computed(() => {
  const content = props.message.content
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .filter(b => b.type === 'text' && typeof b.text === 'string')
      .map(b => b.text)
      .join('')
  }
  return ''
})

const thinkingText = computed(() => {
  const content = props.message.content
  if (!Array.isArray(content)) return null
  const parts = content
    .filter(b => b.type === 'thinking' && typeof b.thinking === 'string')
    .map(b => b.thinking.trim())
    .filter(Boolean)
  if (parts.length > 0) return parts.join('\n')
  // Back-compat: <think/> tags in text blocks
  const raw = displayText.value || ''
  const matches = [...raw.matchAll(/<\s*think(?:ing)?\s*>([\s\S]*?)<\s*\/\s*think(?:ing)?\s*>/gi)]
  const extracted = matches.map(m => (m[1] || '').trim()).filter(Boolean)
  return extracted.length > 0 ? extracted.join('\n') : null
})

const renderedThinking = computed(() => {
  return thinkingText.value ? md.render(thinkingText.value) : ''
})

const thinkingExpanded = ref(true)

function isToolCallType(t) {
  const s = (t || '').toLowerCase()
  return s === 'toolcall' || s === 'tool_call' || s === 'tooluse' || s === 'tool_use'
}

function isToolResultType(t) {
  const s = (t || '').toLowerCase()
  return s === 'toolresult' || s === 'tool_result'
}

function isToolRelatedType(t) {
  return isToolCallType(t) || isToolResultType(t)
}

const hasToolCalls = computed(() => {
  const content = props.message.content
  if (!Array.isArray(content)) return false
  return content.some(b => isToolRelatedType(b.type))
})

const toolCalls = computed(() => {
  const content = props.message.content
  if (!Array.isArray(content)) return []
  return content.filter(b => isToolRelatedType(b.type))
})

const visible = computed(() => {
  if (props.streaming) return true
  // Hide entire message when tool calls are off and there's no text
  if (hasToolCalls.value && !props.showToolCalls && !displayText.value) return false
  return true
})

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'])

function isImageFile(filePath) {
  const dot = filePath.lastIndexOf('.')
  if (dot < 0) return false
  const ext = filePath.slice(dot).toLowerCase()
  return IMAGE_EXTS.has(ext)
}

// Match Windows paths (C:\...\ext) and UNC paths (\\server\...\ext)
const LOCAL_PATH_RE = /(?:[A-Za-z]:[\\\/][^\s"'|*?#<>]+\.[A-Za-z0-9]{1,10})(?=<\/|$|\s|<)|(?:\\\\[^\s"'|*?#<>]+\.[A-Za-z0-9]{1,10})(?=<\/|$|\s|<)/g

function escAttr(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

function processFilePaths(html) {
  // 1. Replace local file paths (not inside HTML tags)
  let result = html.replace(LOCAL_PATH_RE, (match) => {
    const cleanPath = match.replace(/[.,;:!?)\]}>。，；：！？、）】}]+$/, '')
    const escaped = escAttr(cleanPath)
    if (isImageFile(cleanPath)) {
      return `<div class="inline-file-preview" data-img-path="${escaped}"><div class="preview-loading">${t('chat.loading')}</div><span class="preview-label" data-open="${escaped}">${match}</span></div>`
    }
    return `<span class="file-link" data-open="${escaped}">${match}</span>`
  })
  // 2. Enhance existing <a> tags that link to images
  result = result.replace(/<a href="(https?:\/\/[^"]+)">([^<]*)<\/a>/g, (full, href, text) => {
    if (isImageFile(href)) {
      const escaped = escAttr(href)
      return `<div class="inline-file-preview" data-img-url="${escaped}"><div class="preview-loading">${t('chat.loading')}</div><span class="preview-label">${text}</span></div>`
    }
    return full
  })
  return result
}

// ── Post-render: load images via IPC, bind clicks ──
const contentRef = ref(null)
let clickBound = false

async function loadInlineImages(root) {
  if (!root) return
  // Local image files via IPC data URL
  const locals = root.querySelectorAll('.inline-file-preview[data-img-path]')
  for (const el of locals) {
    const raw = el.getAttribute('data-img-path')
    if (!raw) continue
    const filePath = raw.replace(/\\\\/g, '\\')
    const res = await ipc.readFileAsDataUrl(filePath)
    const loading = el.querySelector('.preview-loading')
    if (res.ok) {
      const img = document.createElement('img')
      img.src = res.dataUrl
      img.className = 'preview-image'
      img.addEventListener('click', () => ipc.openPath(filePath))
      if (loading) loading.remove()
      el.insertBefore(img, el.firstChild)
    } else {
      if (loading) loading.textContent = t('chat.imageLoadFailed')
    }
    el.removeAttribute('data-img-path')
  }
  // Remote image URLs — directly use <img>
  const remotes = root.querySelectorAll('.inline-file-preview[data-img-url]')
  for (const el of remotes) {
    const url = el.getAttribute('data-img-url')
    if (!url) continue
    const img = document.createElement('img')
    img.src = url
    img.className = 'preview-image'
    img.addEventListener('error', () => { img.remove(); const ld = el.querySelector('.preview-loading'); if (ld) ld.textContent = t('chat.imageLoadFailed') })
    const loading = el.querySelector('.preview-loading')
    if (loading) loading.remove()
    el.insertBefore(img, el.firstChild)
    el.removeAttribute('data-img-url')
  }
}

function processContent() {
  const root = contentRef.value
  if (!root) return
  loadInlineImages(root)
  if (!clickBound) {
    root.addEventListener('click', (e) => {
      const target = e.target.closest('[data-open]')
      if (!target) return
      const raw = target.getAttribute('data-open')
      if (raw) ipc.openPath(raw.replace(/\\\\/g, '\\'))
    })
    clickBound = true
  }
}

const renderedContent = computed(() => {
  const raw = md.render(displayText.value || '')
  return processFilePaths(raw)
})

watch(renderedContent, () => nextTick(processContent))

onMounted(() => nextTick(processContent))

// ── Token usage from message.usage ──
const usage = computed(() => {
  const u = props.message.usage || {}
  return {
    input: u.input ?? u.inputTokens ?? 0,
    output: u.output ?? u.outputTokens ?? 0,
    cacheRead: u.cacheRead ?? u.cache_read_input_tokens ?? 0,
    cacheWrite: u.cacheWrite ?? u.cache_creation_input_tokens ?? 0,
  }
})

const shortModel = computed(() => {
  const m = props.message.model
  if (!m || m === 'gateway-injected') return null
  return m.includes('/') ? m.split('/').pop() : m
})

const contextPercent = computed(() => {
  const cw = props.contextWindow
  if (!cw) return null
  const promptTokens = usage.value.input + usage.value.cacheRead + usage.value.cacheWrite
  if (promptTokens <= 0) return null
  return Math.min(Math.round((promptTokens / cw) * 100), 100)
})

const ctxClass = computed(() => {
  const pct = contextPercent.value
  if (pct === null) return ''
  if (pct >= 90) return 'meta-ctx-danger'
  if (pct >= 75) return 'meta-ctx-warn'
  return 'meta-ctx'
})

const hasMeta = computed(() => {
  const u = usage.value
  return u.input > 0 || u.output > 0 || u.cacheRead > 0 || u.cacheWrite > 0 || shortModel.value
})

function fmtTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}k`
  return String(n)
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}

// ── TTS ──
const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
const ttsPlaying = ref(false)

function toggleTts() {
  if (!ttsSupported) return
  if (ttsPlaying.value) {
    speechSynthesis.cancel()
    ttsPlaying.value = false
    return
  }
  const text = stripMarkdown(displayText.value || '')
  if (!text.trim()) return
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1.0
  utterance.addEventListener('end', () => { ttsPlaying.value = false })
  utterance.addEventListener('error', () => { ttsPlaying.value = false })
  speechSynthesis.speak(utterance)
  ttsPlaying.value = true
}

function stripMarkdown(text) {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
    .replace(/_{1,3}(.*?)_{1,3}/g, '$1')
    .replace(/^>\s?/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function handleDelete() {
  emit('delete', props.message)
}
</script>

<style scoped>
.chat-message {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
  max-width: 85%;
  user-select: text;
}

.chat-message.role-user {
  flex-direction: row-reverse;
  margin-left: auto;
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.message-avatar.user {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
}

.message-avatar.assistant {
  background: var(--color-primary);
  color: #fff;
}

.avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.avatar-emoji {
  font-size: 18px;
  line-height: 1;
}

.message-avatar :deep(svg) { display: block; }

.message-body {
  min-width: 0;
}

.message-bubble {
  padding: 12px 16px;
  line-height: 1.7;
  word-break: break-word;
}

/* ── Thinking block ── */
.thinking-block {
  margin-bottom: 12px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  cursor: pointer;
  background: var(--color-bg-tertiary);
  user-select: none;
}

.thinking-header:hover {
  background: var(--color-bg-hover);
}

.thinking-icon {
  display: flex;
  opacity: 0.6;
}

.thinking-icon :deep(svg) { display: block; }

.thinking-toggle {
  display: flex;
  margin-left: auto;
  opacity: 0.5;
}

.thinking-toggle :deep(svg) { display: block; }

.thinking-content {
  padding: 10px 12px;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  line-height: 1.6;
  background: var(--color-bg-secondary);
  max-height: 300px;
  overflow-y: auto;
}

.thinking-content :deep(p) { margin-bottom: 6px; }
.thinking-content :deep(p:last-child) { margin-bottom: 0; }

.message-bubble.user {
  background: var(--chat-bubble-user-bg);
  color: var(--chat-bubble-user-text);
  border-radius: 16px 4px 16px 16px;
}

.message-bubble.assistant {
  background: var(--chat-bubble-ai-bg);
  color: var(--chat-bubble-ai-text);
  border-radius: 4px 16px 16px 16px;
}

.message-content {
  overflow-wrap: break-word;
}

.md-content :deep(p) { margin-bottom: 8px; }
.md-content :deep(p:last-child) { margin-bottom: 0; }
.md-content :deep(ul), .md-content :deep(ol) { padding-left: 20px; margin-bottom: 8px; }
.md-content :deep(code) {
  background: var(--chat-code-bg);
  padding: 2px 6px;
  border-radius: 3px;
  font-family: 'Cascadia Code', 'Fira Code', monospace;
  font-size: var(--font-size-sm);
}

.md-content :deep(pre) {
  background: var(--chat-code-bg);
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  overflow-x: auto;
  margin: 8px 0;
  position: relative;
}

.md-content :deep(pre code) {
  background: none;
  padding: 0;
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.md-content :deep(blockquote) {
  border-left: 3px solid var(--color-primary);
  padding-left: 12px;
  color: var(--color-text-secondary);
  margin: 8px 0;
}

.md-content :deep(a) { color: var(--color-primary); }
.md-content :deep(table) { border-collapse: collapse; margin: 8px 0; }
.md-content :deep(th), .md-content :deep(td) {
  border: 1px solid var(--color-border);
  padding: 6px 12px;
  text-align: left;
}

/* ── Footer ── */
.message-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  margin-top: 4px;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.chat-message.role-user .message-footer {
  flex-direction: row-reverse;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.msg-time {
  flex-shrink: 0;
}

.msg-meta-tag {
  font-size: 10px;
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  padding: 1px 5px;
  border-radius: 3px;
  white-space: nowrap;
}

.meta-cache {
  color: var(--color-text-tertiary);
}

.meta-model {
  color: var(--color-text-tertiary);
}

.meta-ctx { color: var(--color-text-tertiary); }
.meta-ctx-warn { color: #f59e0b; }
.meta-ctx-danger { color: var(--color-error); }

/* ── Action buttons ── */
.footer-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  opacity: 0;
  transition: opacity 0.15s;
}

.chat-message:hover .footer-actions {
  opacity: 1;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
  color: var(--color-text-tertiary);
  transition: background 0.1s, color 0.1s;
}

.action-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.action-btn.active {
  color: var(--color-primary);
}

.action-delete:hover {
  color: var(--color-error);
}

.action-btn :deep(svg) { display: block; }

/* ── Inline file preview ── */
.md-content :deep(.inline-file-preview) {
  margin: 8px 0;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  max-width: 400px;
}

.md-content :deep(.preview-image) {
  display: block;
  max-width: 100%;
  max-height: 300px;
  object-fit: contain;
  cursor: pointer;
}

.md-content :deep(.preview-label) {
  display: block;
  padding: 4px 10px;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  word-break: break-all;
  cursor: pointer;
}

.md-content :deep(.preview-label):hover {
  color: var(--color-primary);
}

.md-content :deep(.preview-loading) {
  padding: 8px 10px;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.md-content :deep(.file-link) {
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
  word-break: break-all;
}

.md-content :deep(.file-link):hover {
  opacity: 0.8;
}

/* ── Typing cursor ── */
.typing-cursor {
  display: inline-block;
  width: 2px;
  height: 16px;
  background: var(--chat-typing-cursor);
  animation: blink 1s step-end infinite;
  vertical-align: text-bottom;
  margin-left: 2px;
}

@keyframes blink {
  50% { opacity: 0; }
}
</style>
