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
const recordError = ref('')

const canSend = computed(() => {
  return !props.disabled && (text.value.trim() || localAttachments.value.length > 0)
})

const previewAttachments = computed(() => localAttachments.value)

function toggleRecording() {
  recordError.value = ''
  if (isRecording.value) {
    stopRecording()
    return
  }
  startRecording({
    onStart: () => { isRecording.value = true },
    onEnd: () => { isRecording.value = false },
    onComplete: ({ dataUrl, mimeType, playbackUrl, durationSeconds }) => {
      console.debug('[chat-input] voice attachment ready', {
        mimeType,
        dataUrlLength: typeof dataUrl === 'string' ? dataUrl.length : 0,
        playbackUrl,
        durationSeconds,
      })
      // Send audio as attachment
      emit('send', '', [{ dataUrl, mimeType, playbackUrl, durationSeconds, fileName: 'voice-message.webm' }])
    },
    onError: (msg) => {
      isRecording.value = false
      recordError.value = msg
      setTimeout(() => { recordError.value = '' }, 3000)
    },
  })
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
