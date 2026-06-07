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
        <div v-if="mediaAttachments.length > 0" class="attachment-list">
          <div
            v-for="(attachment, index) in mediaAttachments"
            :key="`media-${index}`"
            class="attachment-card"
            :class="attachment.kind"
          >
            <template v-if="attachment.kind === 'audio'">
              <button
                class="voice-chip"
                :class="[message.role, { playing: isAudioPlaying(attachment.url) }]"
                type="button"
                @click="toggleAudio(attachment.url)"
              >
                <span class="voice-icon" v-html="getIcon(isAudioPlaying(attachment.url) ? 'pause' : 'volume-2', 16)"></span>
                <span class="voice-waves" aria-hidden="true">
                  <span class="voice-wave wave-1"></span>
                  <span class="voice-wave wave-2"></span>
                  <span class="voice-wave wave-3"></span>
                </span>
                <span class="voice-duration">{{ formatAudioDuration(attachment) }}</span>
                <audio
                  :ref="el => setAudioRef(attachment.url, el)"
                  class="audio-player sr-only-audio"
                  :src="attachment.url"
                  preload="metadata"
                  @loadedmetadata="handleAudioMetadata(attachment, $event)"
                  @durationchange="handleAudioDurationChange(attachment, $event)"
                  @canplay="logAudioEvent('canplay', attachment, $event)"
                  @timeupdate="handleAudioTimeUpdate(attachment.url, $event)"
                  @play="handleAudioPlay(attachment.url)"
                  @pause="handleAudioPause(attachment.url)"
                  @ended="handleAudioEnded(attachment.url)"
                  @error="logAudioEvent('error', attachment, $event)"
                ></audio>
              </button>
            </template>
            <template v-else-if="attachment.kind === 'image'">
              <img class="attachment-image" :src="attachment.url" :alt="attachment.label" />
              <div class="attachment-label">{{ attachment.label }}</div>
            </template>
            <template v-else>
              <div class="attachment-header">
                <span class="attachment-icon" v-html="getIcon('file', 16)"></span>
                <span class="attachment-label">{{ attachment.label }}</span>
              </div>
            </template>
          </div>
        </div>
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
import { computed, ref, onMounted, nextTick, watch, onBeforeUnmount } from 'vue'
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
      try { return `<span class="code-lang">${escapeHtml(lang)}</span>${hljs.highlight(str, { language: lang }).value}` } catch {}
    }
    try {
      return hljs.highlightAuto(str).value
    } catch {
      return escapeHtml(str)
    }
  },
})

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

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

function getDataUrlMime(url) {
  if (typeof url !== 'string') return ''
  const match = url.match(/^data:([^;,]+)[;,]/i)
  return match?.[1]?.toLowerCase() || ''
}

function asDataUrl(data, mimeType = 'application/octet-stream') {
  if (typeof data !== 'string' || !data) return ''
  if (data.startsWith('data:') || data.startsWith('blob:') || /^https?:\/\//i.test(data)) return data
  return `data:${mimeType || 'application/octet-stream'};base64,${data}`
}

function inferAttachmentKind(block) {
  if (!block || typeof block !== 'object') return 'file'
  if (block.type === 'image' && block.source?.data) return 'image'
  const url = block.attachment?.playbackUrl || block.attachment?.url || ''
  const mime = getDataUrlMime(url)
  if (url.startsWith('blob:')) return 'audio'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime.startsWith('image/')) return 'image'
  return 'file'
}

const mediaAttachments = computed(() => {
  const content = props.message.content
  if (!Array.isArray(content)) return []

  return content.flatMap((block) => {
    if (!block || typeof block !== 'object') return []

    if (block.type === 'image' && block.source?.data) {
      return [{
        kind: 'image',
        label: block.source.media_type || block.source.mimeType || 'image',
        url: asDataUrl(block.source.data, block.source.media_type || block.source.mimeType || 'image/png'),
      }]
    }

    if (block.type === 'image' && block.source?.url) {
      return [{
        kind: 'image',
        label: block.source.media_type || block.source.mimeType || 'image',
        url: block.source.url,
      }]
    }

    if (block.type !== 'attachment' || !block.attachment?.url) return []

    const mimeType = block.attachment.mimeType || block.attachment.media_type || ''
    return [{
      kind: inferAttachmentKind(block),
      label: block.attachment.label || 'attachment',
      durationSeconds: block.attachment.durationSeconds || 0,
      url: asDataUrl(block.attachment.playbackUrl || block.attachment.url, mimeType || 'application/octet-stream'),
    }]
  })
})

const audioRefs = new Map()
const audioDurationMap = ref({})
const audioPlayingMap = ref({})

function setAudioRef(url, el) {
  if (!url) return
  if (el) audioRefs.set(url, el)
  else audioRefs.delete(url)
}

function updateAudioDuration(url, rawDuration) {
  if (!url || !Number.isFinite(rawDuration) || rawDuration <= 0) return
  const seconds = Math.max(1, Math.ceil(rawDuration))
  if (audioDurationMap.value[url] === seconds) return
  audioDurationMap.value = {
    ...audioDurationMap.value,
    [url]: seconds,
  }
}

function handleAudioMetadata(attachment, event) {
  logAudioEvent('loadedmetadata', attachment, event)
  const el = event?.target
  updateAudioDuration(attachment.url, el?.duration)
}

function handleAudioDurationChange(attachment, event) {
  logAudioEvent('durationchange', attachment, event)
  const el = event?.target
  updateAudioDuration(attachment.url, el?.duration)
}

function handleAudioPlay(url) {
  const nextState = {}
  for (const key of Object.keys(audioPlayingMap.value)) nextState[key] = false
  nextState[url] = true
  audioPlayingMap.value = nextState
}

function handleAudioPause(url) {
  audioPlayingMap.value = {
    ...audioPlayingMap.value,
    [url]: false,
  }
}

function handleAudioEnded(url) {
  const el = audioRefs.get(url)
  if (el) updateAudioDuration(url, Math.max(el.duration || 0, el.currentTime || 0))
  if (el) el.currentTime = 0
  handleAudioPause(url)
}

function handleAudioTimeUpdate(url, event) {
  const el = event?.target
  updateAudioDuration(url, Math.max(el?.duration || 0, el?.currentTime || 0))
}

function isAudioPlaying(url) {
  return !!audioPlayingMap.value[url]
}

function toggleAudio(url) {
  const target = audioRefs.get(url)
  if (!target) return

  for (const [key, el] of audioRefs.entries()) {
    if (key !== url && el && !el.paused) el.pause()
  }

  if (target.paused) target.play().catch((error) => {
    console.debug('[chat-message] audio.play.error', { url, error: error?.message || String(error) })
  })
  else target.pause()
}

function formatAudioDuration(attachment) {
  const seconds = audioDurationMap.value[attachment.url] || attachment.durationSeconds || 0
  if (!seconds) return '--'
  if (seconds < 60) return `${seconds}"`
  const mins = Math.floor(seconds / 60)
  const secs = String(seconds % 60).padStart(2, '0')
  return `${mins}:${secs}`
}

function logAudioEvent(stage, attachment, event) {
  const el = event?.target
  console.debug(`[chat-message] audio.${stage}`, {
    url: attachment?.url,
    currentSrc: el?.currentSrc,
    duration: Number.isFinite(el?.duration) ? el.duration : null,
    readyState: el?.readyState,
    networkState: el?.networkState,
    error: el?.error ? {
      code: el.error.code,
      message: el.error.message,
    } : null,
  })
}

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

function getPathBasename(filePath) {
  return String(filePath || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop() || ''
}

function hasFileExtension(filePath) {
  const base = getPathBasename(filePath)
  const dot = base.lastIndexOf('.')
  if (dot <= 0 || dot === base.length - 1) return false
  return /^[A-Za-z0-9]{1,12}$/.test(base.slice(dot + 1))
}

function getFileExtension(filePath) {
  const clean = getPathBasename(filePath)
  const dot = clean.lastIndexOf('.')
  if (dot <= 0 || dot === clean.length - 1) return 'FILE'
  return clean.slice(dot + 1).toUpperCase().slice(0, 5)
}

function getFileIconMeta(filePath) {
  const ext = getFileExtension(filePath).toLowerCase()
  if (['pdf'].includes(ext)) return { label: 'PDF', color: '#dc2626', tone: '#fee2e2' }
  if (['doc', 'docx'].includes(ext)) return { label: ext.toUpperCase(), color: '#2563eb', tone: '#dbeafe' }
  if (['xls', 'xlsx', 'csv', 'tsv'].includes(ext)) return { label: ext.toUpperCase(), color: '#16a34a', tone: '#dcfce7' }
  if (['ppt', 'pptx'].includes(ext)) return { label: ext.toUpperCase(), color: '#ea580c', tone: '#ffedd5' }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return { label: ext.toUpperCase(), color: '#9333ea', tone: '#f3e8ff' }
  if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext)) return { label: ext.toUpperCase(), color: '#7c3aed', tone: '#ede9fe' }
  if (['mp4', 'mov', 'avi', 'mkv'].includes(ext)) return { label: ext.toUpperCase(), color: '#db2777', tone: '#fce7f3' }
  if (['sqlite', 'db'].includes(ext)) return { label: ext.toUpperCase(), color: '#0f766e', tone: '#ccfbf1' }
  if (['exe', 'dll', 'dmg', 'pkg', 'app'].includes(ext)) return { label: ext.toUpperCase(), color: '#334155', tone: '#e2e8f0' }
  return { label: getFileExtension(filePath), color: '#0891b2', tone: '#cffafe' }
}

function createFileIconSvg(filePath) {
  const meta = getFileIconMeta(filePath)
  return `
    <svg viewBox="0 0 40 40" width="32" height="32" aria-hidden="true" focusable="false">
      <path d="M10 3.5h13.5L31 11v25.5H10z" fill="${meta.tone}" stroke="${meta.color}" stroke-width="1.6" />
      <path d="M23.5 3.5V11H31" fill="none" stroke="${meta.color}" stroke-width="1.6" stroke-linejoin="round" />
      <rect x="6.5" y="19" width="27" height="12.5" rx="3" fill="${meta.color}" />
      <text x="20" y="27.8" text-anchor="middle" font-family="Arial, sans-serif" font-size="7.4" font-weight="700" fill="#fff">${escapeHtml(meta.label)}</text>
    </svg>
  `
}

function createFolderIconSvg() {
  return `
    <svg viewBox="0 0 40 40" width="32" height="32" aria-hidden="true" focusable="false">
      <path d="M5.5 12.5a4 4 0 0 1 4-4h8.2l3.6 4h9.2a4 4 0 0 1 4 4v1H5.5z" fill="#fde68a" stroke="#d97706" stroke-width="1.6" stroke-linejoin="round" />
      <path d="M5.5 16.5h29v10.8a4.2 4.2 0 0 1-4.2 4.2H9.7a4.2 4.2 0 0 1-4.2-4.2z" fill="#fbbf24" stroke="#d97706" stroke-width="1.6" stroke-linejoin="round" />
    </svg>
  `
}

const FILE_EXT_RE = /\.(?:png|jpe?g|gif|webp|svg|bmp|ico|txt|md|json|ya?ml|toml|ini|log|csv|tsv|pdf|docx?|xlsx?|pptx?|zip|rar|7z|tar|gz|js|jsx|ts|tsx|vue|css|scss|html?|xml|py|java|c|cc|cpp|h|hpp|cs|go|rs|php|rb|sh|bat|cmd|ps1|sql|sqlite|db|exe|dll|dmg|pkg|app|mp3|wav|ogg|m4a|mp4|mov|avi|mkv)\b/i
const TRAILING_PATH_PUNCT_RE = /[\s"'`.,;:!?)\]}>。，；：！？、）】}]+$/u
const PATH_STOP_CHARS = new Set(['\n', '\r', '\t', '<', '>', '"', '|', '*', '?'])
const CLOSING_TO_OPENING = { ')': '(', ']': '[', '}': '{', '）': '（', '】': '【' }

function isWindowsDriveStart(text, index) {
  return /[A-Za-z]/.test(text[index] || '') && text[index + 1] === ':' && /[\\/]/.test(text[index + 2] || '')
}

function isUncStart(text, index) {
  const a = text[index]
  const b = text[index + 1]
  const c = text[index + 2]
  return (a === '\\' || a === '/') && b === a && c && c !== a && !/\s/.test(c)
}

function isPosixStart(text, index) {
  if (text[index] !== '/') return false
  if (text[index + 1] === '/') return false
  const before = text[index - 1] || ''
  const rest = text.slice(index)
  return !/[A-Za-z0-9)]/.test(before) && /^\/(?:Users|home|tmp|var|etc|opt|Volumes|mnt|media|usr|workspace|root)\b/.test(rest)
}

function isFileUrlStart(text, index) {
  return text.slice(index, index + 7).toLowerCase() === 'file://'
}

function trimBalancedPath(raw) {
  let path = raw.replace(TRAILING_PATH_PUNCT_RE, '')
  let changed = true
  while (changed && path) {
    changed = false
    const last = path[path.length - 1]
    const opening = CLOSING_TO_OPENING[last]
    if (opening) {
      const opens = [...path].filter(ch => ch === opening).length
      const closes = [...path].filter(ch => ch === last).length
      if (closes > opens) {
        path = path.slice(0, -1).replace(TRAILING_PATH_PUNCT_RE, '')
        changed = true
      }
    }
  }
  return path
}

function trimAfterFileExtension(path) {
  const match = [...path.matchAll(new RegExp(FILE_EXT_RE.source, 'gi'))].pop()
  if (!match) return path
  const end = (match.index || 0) + match[0].length
  const tail = path.slice(end)
  if (!tail) return path
  if (/^[\s"'`.,;:!?)\]}>。，；：！？、）】}]+$/u.test(tail)) return path.slice(0, end)
  if (/^[\s"'`.,;:!?)\]}>。，；：！？、）】}]+[^\\/]+$/u.test(tail)) return path.slice(0, end)
  if (/^\s+[^\\/]+$/u.test(tail)) return path.slice(0, end)
  return path
}

function normalizePathForOpen(path) {
  let value = trimBalancedPath(path)
  if (value.toLowerCase().startsWith('file://')) {
    try { value = decodeURI(value) } catch {}
    value = value.replace(/^file:\/\/\/?/i, '')
    if (/^[A-Za-z]:\//.test(value)) value = value.replace(/\//g, '\\')
    else value = `/${value.replace(/^\/+/, '')}`
  }
  if (!/^[A-Za-z]:[\\/]/.test(value) || value.includes('/')) {
    value = value.replace(/\\([ "'()[\]{}])/g, '$1')
  }
  return value
}

function collectPathAt(text, start) {
  let quote = ''
  let pathStart = start
  const before = text[start - 1]
  if ((before === '"' || before === '\'' || before === '`') && text.indexOf(before, start) !== -1) {
    quote = before
  }

  let end = pathStart
  if (quote) {
    end = text.indexOf(quote, pathStart)
  } else {
    while (end < text.length && !PATH_STOP_CHARS.has(text[end])) end++
  }

  let raw = text.slice(pathStart, end)
  raw = trimAfterFileExtension(trimBalancedPath(raw))
  const normalized = normalizePathForOpen(raw)
  if (!normalized || normalized.length < 3) return null
  if (!/[\\/]/.test(normalized) && !normalized.toLowerCase().startsWith('file://')) return null
  return { start, end: start + raw.length, raw, path: normalized }
}

function findLocalPathMatches(text) {
  const matches = []
  let i = 0
  while (i < text.length) {
    const starts = isWindowsDriveStart(text, i) || isUncStart(text, i) || isPosixStart(text, i) || isFileUrlStart(text, i)
    if (!starts) {
      i++
      continue
    }
    const match = collectPathAt(text, i)
    if (match) {
      matches.push(match)
      i = match.end
    } else {
      i++
    }
  }
  return matches
}

function createPathChip(rawText, filePath) {
  const isDirectory = !hasFileExtension(filePath)
  const chip = document.createElement('span')
  chip.className = isDirectory ? 'file-chip directory' : 'file-chip'
  chip.dataset.open = filePath
  chip.title = filePath
  const icon = document.createElement('span')
  icon.className = 'file-chip-icon'
  icon.innerHTML = isDirectory ? createFolderIconSvg() : createFileIconSvg(filePath)
  const label = document.createElement('span')
  label.className = 'file-chip-label'
  label.textContent = getPathBasename(filePath) || rawText
  chip.append(icon, label)
  return chip
}

function createFileNode(rawText, filePath, codeContext = false) {
  if (isImageFile(filePath)) {
    const wrapper = document.createElement(codeContext ? 'span' : 'div')
    wrapper.className = 'inline-file-preview'
    wrapper.dataset.imgPath = filePath
    const loading = document.createElement(codeContext ? 'span' : 'div')
    loading.className = 'preview-loading'
    loading.textContent = t('chat.loading')
    wrapper.append(loading)
    return wrapper
  }
  return createPathChip(rawText, filePath)
}

function shouldSkipPathEnhance(node) {
  const parent = node.parentElement
  return !!parent?.closest('a, kbd, samp, textarea, .code-lang, .file-chip, .file-link, .inline-file-preview')
}

function enhanceTextNode(node) {
  if (shouldSkipPathEnhance(node)) return
  const text = node.nodeValue || ''
  const matches = findLocalPathMatches(text)
  if (matches.length === 0) return

  const fragment = document.createDocumentFragment()
  let offset = 0
  const codeContext = !!node.parentElement?.closest('pre, code')
  for (const match of matches) {
    if (match.start > offset) {
      const gap = text.slice(offset, match.start)
      fragment.append(document.createTextNode(/^\s+$/.test(gap) ? ' ' : gap))
    }
    fragment.append(createFileNode(match.raw, match.path, codeContext))
    offset = match.end
  }
  if (offset < text.length) fragment.append(document.createTextNode(text.slice(offset)))
  node.replaceWith(fragment)
}

function isPathTileNode(node) {
  return node?.nodeType === Node.ELEMENT_NODE && node.matches?.('.file-chip, .inline-file-preview')
}

function nearestContentSibling(node, direction) {
  let current = direction === 'previous' ? node.previousSibling : node.nextSibling
  while (current && current.nodeType === Node.TEXT_NODE && /^\s*$/.test(current.nodeValue || '')) {
    current = direction === 'previous' ? current.previousSibling : current.nextSibling
  }
  return current
}

function normalizePathTileBreaks(root) {
  for (const br of [...root.querySelectorAll('br')]) {
    const prev = nearestContentSibling(br, 'previous')
    const next = nearestContentSibling(br, 'next')
    if (!isPathTileNode(prev) || !isPathTileNode(next)) continue
    br.replaceWith(document.createTextNode(' '))
  }
}

function enhanceRemoteImageLinks(root) {
  for (const link of root.querySelectorAll('a[href^="http://"], a[href^="https://"]')) {
    const href = link.getAttribute('href') || ''
    if (!isImageFile(href)) continue
    const wrapper = document.createElement('div')
    wrapper.className = 'inline-file-preview'
    wrapper.dataset.imgUrl = href
    const loading = document.createElement('div')
    loading.className = 'preview-loading'
    loading.textContent = t('chat.loading')
    const label = document.createElement('span')
    label.className = 'preview-label'
    label.textContent = link.textContent || href
    wrapper.append(loading, label)
    link.replaceWith(wrapper)
  }
}

function processFilePaths(html) {
  if (typeof document === 'undefined') return html
  const template = document.createElement('template')
  template.innerHTML = html

  const walker = document.createTreeWalker(template.content, NodeFilter.SHOW_TEXT)
  const textNodes = []
  while (walker.nextNode()) textNodes.push(walker.currentNode)
  textNodes.forEach(enhanceTextNode)
  enhanceRemoteImageLinks(template.content)
  normalizePathTileBreaks(template.content)
  return template.innerHTML
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

onBeforeUnmount(() => {
  for (const el of audioRefs.values()) {
    if (el && !el.paused) el.pause()
  }
  audioRefs.clear()
})
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

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message-content + .attachment-list {
  margin-top: 10px;
}

.attachment-card {
  border-radius: 12px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.16);
  min-width: 220px;
  max-width: min(320px, 70vw);
}

.message-bubble.assistant .attachment-card {
  background: var(--color-bg-tertiary);
  border-color: var(--color-border);
}

.attachment-card.audio {
  padding: 0;
  background: transparent;
  border: 0;
  min-width: 0;
  max-width: none;
}

.attachment-header {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.compact-audio {
  gap: 10px;
}

.attachment-icon {
  display: flex;
  flex-shrink: 0;
  opacity: 0.8;
}

.attachment-icon :deep(svg) { display: block; }

.attachment-label {
  font-size: var(--font-size-xs);
  line-height: 1.4;
  word-break: break-all;
  opacity: 0.92;
  flex: 0 1 auto;
  min-width: 0;
}

.audio-player {
  display: block;
  width: 100%;
  height: 36px;
}

.sr-only-audio {
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
}

.attachment-image {
  display: block;
  width: 100%;
  max-height: 280px;
  object-fit: cover;
  border-radius: 10px;
  margin-bottom: 8px;
}

.voice-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-width: 136px;
  max-width: 220px;
  padding: 10px 14px;
  border-radius: 999px;
  border: 0;
  cursor: pointer;
  position: relative;
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.voice-chip.user {
  background: rgba(255, 255, 255, 0.18);
  color: inherit;
}

.voice-chip.assistant {
  background: var(--color-bg-tertiary);
  color: var(--color-text);
  border: 1px solid var(--color-border);
}

.voice-chip:hover {
  transform: translateY(-1px);
}

.voice-chip.playing .voice-wave {
  animation: voice-wave 1s ease-in-out infinite;
}

.voice-chip.playing .wave-2 {
  animation-delay: 0.12s;
}

.voice-chip.playing .wave-3 {
  animation-delay: 0.24s;
}

.voice-icon {
  display: flex;
  flex-shrink: 0;
}

.voice-icon :deep(svg) { display: block; }

.voice-waves {
  display: inline-flex;
  align-items: flex-end;
  gap: 3px;
  flex: 1;
  min-width: 42px;
}

.voice-wave {
  width: 3px;
  border-radius: 999px;
  background: currentColor;
  opacity: 0.72;
  transform-origin: bottom center;
}

.wave-1 { height: 8px; }
.wave-2 { height: 14px; }
.wave-3 { height: 10px; }

.voice-duration {
  font-size: var(--font-size-xs);
  line-height: 1;
  opacity: 0.82;
  flex-shrink: 0;
  min-width: 24px;
  text-align: right;
}

@keyframes voice-wave {
  0%, 100% { transform: scaleY(0.55); opacity: 0.55; }
  50% { transform: scaleY(1.15); opacity: 1; }
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
  color: var(--color-text);
}

.md-content :deep(pre) {
  background: #e5e7eb;
  padding: 36px 16px 14px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin: 12px 0;
  position: relative;
  color: #111827;
  border: 1px solid rgba(148, 163, 184, 0.55);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.62);
}

.md-content :deep(pre::before) {
  content: '';
  position: absolute;
  top: 12px;
  left: 14px;
  width: 9px;
  height: 9px;
  border-radius: 999px;
  background: #ef4444;
  box-shadow: 16px 0 0 #f59e0b, 32px 0 0 #22c55e;
  opacity: 0.9;
}

.md-content :deep(pre code) {
  background: none;
  padding: 0;
  font-size: var(--font-size-sm);
  line-height: 1.6;
  color: inherit;
  display: block;
  min-width: max-content;
  white-space: pre;
}

.md-content :deep(.code-lang) {
  position: absolute;
  top: 8px;
  right: 12px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #64748b;
  font-family: var(--font-family);
  font-size: 11px;
  line-height: 1;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  user-select: none;
}

.md-content :deep(.hljs-keyword),
.md-content :deep(.hljs-selector-tag),
.md-content :deep(.hljs-built_in),
.md-content :deep(.hljs-name),
.md-content :deep(.hljs-tag) {
  color: #1d4ed8;
}

.md-content :deep(.hljs-string),
.md-content :deep(.hljs-title),
.md-content :deep(.hljs-section),
.md-content :deep(.hljs-attribute),
.md-content :deep(.hljs-literal),
.md-content :deep(.hljs-template-tag),
.md-content :deep(.hljs-template-variable),
.md-content :deep(.hljs-type) {
  color: #15803d;
}

.md-content :deep(.hljs-number),
.md-content :deep(.hljs-symbol),
.md-content :deep(.hljs-bullet),
.md-content :deep(.hljs-variable) {
  color: #b45309;
}

.md-content :deep(.hljs-comment),
.md-content :deep(.hljs-quote),
.md-content :deep(.hljs-deletion),
.md-content :deep(.hljs-meta) {
  color: #64748b;
}

.md-content :deep(.hljs-regexp),
.md-content :deep(.hljs-link),
.md-content :deep(.hljs-addition) {
  color: #0891b2;
}

.md-content :deep(.hljs-emphasis) {
  font-style: italic;
}

.md-content :deep(.hljs-strong) {
  font-weight: 700;
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

.md-content :deep(pre .inline-file-preview),
.md-content :deep(code .inline-file-preview) {
  display: block;
  max-width: min(400px, 100%);
  white-space: normal;
  font-family: var(--font-family);
  color: var(--color-text);
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

.md-content :deep(.file-chip) {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  gap: 5px;
  width: 82px;
  min-height: 78px;
  margin: 4px 3px;
  padding: 8px 6px 7px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  cursor: pointer;
  vertical-align: top;
  transition: background 0.12s, border-color 0.12s, transform 0.12s;
}

.md-content :deep(.file-chip:hover) {
  background: var(--color-bg-hover);
  border-color: var(--color-primary);
  transform: translateY(-1px);
}

.md-content :deep(.file-chip-icon) {
  display: inline-flex;
  flex: 0 0 auto;
  width: 40px;
  height: 40px;
  align-items: center;
  justify-content: center;
}

.md-content :deep(.file-chip-icon svg) {
  display: block;
  width: 40px;
  height: 40px;
}

.md-content :deep(.file-chip-label) {
  width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  white-space: normal;
  font-size: var(--font-size-xs);
  line-height: 1.25;
  text-align: center;
  word-break: break-word;
}

.md-content :deep(pre .file-chip),
.md-content :deep(code .file-chip) {
  display: inline-flex;
  width: 82px;
  max-width: 82px;
  margin: 4px 3px;
  font-family: var(--font-family);
  white-space: normal;
}

.md-content :deep(pre .file-chip-label),
.md-content :deep(code .file-chip-label) {
  white-space: normal;
  word-break: break-all;
}

.md-content :deep(.file-link) {
  color: var(--color-primary);
  cursor: pointer;
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 2px;
  word-break: break-all;
}

.md-content :deep(.file-chip):hover,
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
