<template>
  <div class="chat-input-area">
    <div class="input-row">
      <button class="input-btn" @click="triggerFileInput" :title="t('chat.addAttachment')">
        <span v-html="getIcon('paperclip', 20)"></span>
      </button>
      <button
        v-if="recordingSupported && !isStreaming"
        class="input-btn"
        :class="{ recording: isRecording }"
        :disabled="isTranscribing"
        @click="toggleRecording"
        :title="isRecording ? t('chat.stopRecording') : t('chat.voiceInput')"
      >
        <span class="mic-icon" :class="{ active: isRecording }" v-html="getIcon('mic', 20)"></span>
      </button>
      <div class="input-wrapper">
        <textarea
          ref="textareaRef"
          class="chat-textarea"
          v-model="text"
          :placeholder="defaultPlaceholder"
          :disabled="disabled"
          rows="1"
          @input="autoResize"
          @keydown="handleKeydown"
        ></textarea>
      </div>
      <button
        v-if="isStreaming"
        class="send-btn stop-btn"
        @click="$emit('abort')"
        :title="t('chat.stopGenerate')"
      >
        <span v-html="getIcon('stop-circle', 20)"></span>
      </button>
      <button
        v-else
        class="send-btn"
        :disabled="!canSend"
        @click="handleSend"
        :title="t('chat.send')"
      >
        <span v-html="getIcon('send-horizontal', 20)"></span>
      </button>
    </div>
    <div v-if="previewAttachments.length > 0" class="attachment-preview">
      <div v-for="(att, i) in previewAttachments" :key="i" class="attachment-item">
        <img v-if="att.mimeType?.startsWith('image/')" :src="att.dataUrl" class="att-thumb" />
        <span v-else class="att-file" v-html="getIcon('file', 16)"></span>
        <span class="att-name">{{ att.fileName }}</span>
        <button class="att-remove" @click="removeAttachment(i)" v-html="getIcon('x', 14)"></button>
      </div>
    </div>
    <div v-if="recordError" class="record-error">{{ recordError }}</div>
    <input
      ref="fileInputRef"
      type="file"
      class="file-input-hidden"
      multiple
      @change="handleFiles"
    />
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { getIcon } from '@/lib/icons'
import { t } from '@/i18n'
import { ipc } from '@/lib/ipc'
import { isRecordingSupported, startRecording, stopRecording } from '@/lib/speech'

const props = defineProps({
  modelValue: { type: String, default: '' },
  disabled: { type: Boolean, default: false },
  isStreaming: { type: Boolean, default: false },
  placeholder: { type: String, default: '' },
})

const defaultPlaceholder = computed(() => props.placeholder || t('chat.inputPlaceholder'))

const emit = defineEmits(['update:modelValue', 'send', 'abort'])

const text = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const textareaRef = ref(null)
const fileInputRef = ref(null)
const localAttachments = ref([])
const recordingSupported = isRecordingSupported()
const isRecording = ref(false)
const isTranscribing = ref(false)
const recordError = ref('')

const canSend = computed(() => {
  return !props.disabled && !isTranscribing.value && (text.value.trim() || localAttachments.value.length > 0)
})

const previewAttachments = computed(() => localAttachments.value)

const ASR_SAMPLE_RATE = 16000
const ASR_CHUNK_BYTES = 3200
const ASR_TIMEOUT_MS = 30000

function toggleRecording() {
  if (isTranscribing.value) return
  recordError.value = ''
  if (isRecording.value) {
    stopRecording()
    return
  }
  startRecording({
    onStart: () => { isRecording.value = true },
    onEnd: () => { isRecording.value = false },
    onComplete: async ({ blob, dataUrl, mimeType, playbackUrl, durationSeconds }) => {
      console.debug('[chat-input] voice attachment ready', {
        mimeType,
        dataUrlLength: typeof dataUrl === 'string' ? dataUrl.length : 0,
        playbackUrl,
        durationSeconds,
      })
      isTranscribing.value = true
      try {
        const transcriptText = await transcribeVoiceBlob(blob)
        if (!transcriptText) throw new Error('未识别到语音内容')
        emit('send', '', [{
          dataUrl,
          mimeType,
          playbackUrl,
          durationSeconds,
          fileName: 'voice-message.webm',
          localOnly: true,
          transcriptText,
        }])
      } catch (err) {
        recordError.value = err?.message || String(err)
        setTimeout(() => { recordError.value = '' }, 3000)
      } finally {
        isTranscribing.value = false
      }
    },
    onError: (msg) => {
      isRecording.value = false
      recordError.value = msg
      setTimeout(() => { recordError.value = '' }, 3000)
    },
  })
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function downsampleTo16k(input, inputRate) {
  if (inputRate === ASR_SAMPLE_RATE) return input
  const ratio = inputRate / ASR_SAMPLE_RATE
  const length = Math.floor(input.length / ratio)
  const result = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const start = Math.floor(i * ratio)
    const end = Math.min(Math.floor((i + 1) * ratio), input.length)
    let sum = 0
    for (let j = start; j < end; j++) sum += input[j]
    result[i] = sum / Math.max(1, end - start)
  }
  return result
}

function floatToPcm16(float32) {
  const pcm = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return new Uint8Array(pcm.buffer)
}

async function decodeVoiceBlobToPcm(blob) {
  if (!blob) throw new Error('录音数据为空')
  const audioContext = new AudioContext()
  try {
    const audioBuffer = await audioContext.decodeAudioData(await blob.arrayBuffer())
    const mixed = new Float32Array(audioBuffer.length)
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const data = audioBuffer.getChannelData(channel)
      for (let i = 0; i < data.length; i++) mixed[i] += data[i] / audioBuffer.numberOfChannels
    }
    return floatToPcm16(downsampleTo16k(mixed, audioBuffer.sampleRate))
  } finally {
    try { await audioContext.close() } catch {}
  }
}

async function transcribeVoiceBlob(blob) {
  const settings = await ipc.getSettings()
  const apiKey = settings?.voice?.dashscopeApiKey || ''
  if (!apiKey) throw new Error('请先在设置 > 语音设置中填写百炼 DashScope API KEY')

  const pcm = await decodeVoiceBlobToPcm(blob)
  if (!pcm.byteLength) throw new Error('录音数据为空')

  const res = await ipc.immersiveVoiceStartAsr({
    apiKey,
    model: 'qwen3-asr-flash-realtime',
    sampleRate: ASR_SAMPLE_RATE,
    silenceDurationMs: 300,
  })
  if (!res?.ok) throw new Error(res?.error || '语音识别连接失败')

  const sessionId = res.sessionId
  let removeListener = null
  let settled = false
  let sentenceDone = false

  try {
    let readyResolve
    let readyReject
    const readyPromise = new Promise((resolve, reject) => {
      readyResolve = resolve
      readyReject = reject
    })
    const sentencePromise = new Promise((resolve, reject) => {
      removeListener = ipc.onImmersiveVoiceEvent((data) => {
        if (!data || data.sessionId !== sessionId || settled) return
        if (data.event === 'asr:ready') {
          readyResolve()
          return
        }
        if (data.event === 'asr:sentence-end') {
          sentenceDone = true
          resolve(String(data.text || data.transcript || '').trim())
          return
        }
        if (data.event === 'asr:noise-filtered') {
          sentenceDone = true
          resolve('')
          return
        }
        if (data.event === 'asr:error' || data.event === 'asr:closed') {
          const message = data.error || (data.event === 'asr:closed' ? '语音识别连接已关闭' : '语音识别失败')
          readyReject(new Error(message))
          reject(new Error(message))
        }
      })
    })
    sentencePromise.catch(() => {})

    await Promise.race([
      readyPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('语音识别连接超时')), 8000)),
    ])

    for (let offset = 0; offset < pcm.byteLength; offset += ASR_CHUNK_BYTES) {
      const chunk = pcm.slice(offset, Math.min(offset + ASR_CHUNK_BYTES, pcm.byteLength))
      const sendRes = await ipc.immersiveVoiceSendAudio(sessionId, chunk)
      if (sendRes?.ok === false) throw new Error(sendRes.error || '语音数据发送失败')
      if (sentenceDone) break
      await wait(20)
    }
    if (!sentenceDone) {
      const commitRes = await ipc.immersiveVoiceCommitAudio(sessionId)
      if (commitRes?.ok === false) throw new Error(commitRes.error || '语音提交失败')
    }

    return await Promise.race([
      sentencePromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('语音识别超时')), ASR_TIMEOUT_MS)),
    ])
  } finally {
    settled = true
    removeListener?.()
    await ipc.immersiveVoiceStopAsr(sessionId)
  }
}

function autoResize() {
  nextTick(() => {
    const el = textareaRef.value
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  })
}

function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}

function handleSend() {
  if (!canSend.value) return
  emit('send', text.value, localAttachments.value)
  localAttachments.value = []
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
    }
  })
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function handleFiles(e) {
  const files = Array.from(e.target.files || [])
  for (const file of files) {
    const reader = new FileReader()
    reader.onload = () => {
      localAttachments.value.push({
        fileName: file.name,
        mimeType: file.type,
        dataUrl: reader.result,
      })
    }
    reader.readAsDataURL(file)
  }
  e.target.value = ''
}

function removeAttachment(index) {
  localAttachments.value.splice(index, 1)
}
</script>

<style scoped>
.chat-input-area {
  padding: 12px 20px 16px;
  border-top: 1px solid var(--color-border);
}

.input-row {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.input-wrapper {
  flex: 1;
}

.chat-textarea {
  width: 100%;
  background: var(--chat-input-bg);
  border: 1px solid var(--chat-input-border);
  border-radius: 12px;
  padding: 10px 16px;
  resize: none;
  outline: none;
  line-height: 1.5;
  max-height: 160px;
  overflow-y: auto;
  font-size: var(--font-size-md);
}

.chat-textarea:focus {
  border-color: var(--chat-input-border-focus);
}

.chat-textarea::placeholder {
  color: var(--color-text-tertiary);
}

.input-btn {
  padding: 8px 10px;
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.input-btn:hover {
  background: var(--color-bg-hover);
}

.input-btn :deep(svg) { display: block; }

.input-btn.recording {
  color: var(--color-error);
}
.input-btn.recording .mic-icon {
  animation: pulse-rec 1.2s ease-in-out infinite;
}
@keyframes pulse-rec {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.mic-icon.active :deep(svg) {
  color: var(--color-error);
}

.send-btn {
  background: var(--color-primary);
  border-radius: var(--radius-sm);
  padding: 8px 12px;
  color: #fff;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-btn :deep(svg) { display: block; }

.stop-btn {
  background: var(--color-error);
}

.file-input-hidden {
  display: none;
}

.record-error {
  margin-top: 6px;
  font-size: var(--font-size-xs);
  color: var(--color-error);
  padding: 4px 8px;
}

.attachment-preview {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--color-bg-tertiary);
  padding: 4px 8px;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-xs);
}

.att-thumb {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  object-fit: cover;
}

.att-file { color: var(--color-text-tertiary); }
.att-file :deep(svg) { display: block; }

.att-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.att-remove {
  color: var(--color-text-tertiary);
  padding: 2px;
  display: flex;
}

.att-remove:hover { color: var(--color-error); }
.att-remove :deep(svg) { display: block; }
</style>
