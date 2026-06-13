<template>
  <div class="immersive-voice" @dblclick="exit">
    <div class="ambient-backdrop"></div>
    <div class="ambient-grid"></div>
    <div class="ambient-vignette"></div>
    <div class="ambient-scanlines"></div>

    <header class="top-hud">
      <div class="hud-brand">
        <div class="brand-mark">{{ assistantInitial }}</div>
        <div class="brand-copy">
          <span class="brand-kicker">{{ assistantName || '助手' }}</span>
          <strong class="brand-title">IMMERSIVE SESSION</strong>
        </div>
      </div>

      <div class="hud-chip">
        <span class="chip-label">MODEL</span>
        <span class="chip-value">{{ modelName || '未指定模型' }}</span>
      </div>
    </header>

    <aside class="telemetry-panel telemetry-left">
      <div class="panel-header">
        <span class="panel-kicker">VOICE LINK</span>
        <span class="panel-code">{{ stateCode }}</span>
      </div>

      <div class="metric-block primary">
        <span class="metric-label">状态</span>
        <strong class="metric-value">{{ statusText }}</strong>
        <p class="metric-note">{{ statusDescription }}</p>
        <div class="metric-tags">
          <span class="metric-tag">{{ recognitionLabel }}</span>
          <span class="metric-tag">{{ ttsLabel }}</span>
          <span class="metric-tag">{{ gatewayLabel }}</span>
        </div>
      </div>
    </aside>

    <main class="orbital-stage">
      <div class="orbital-shell">
        <div class="sphere-glow"></div>
        <div class="orbit orbit-a"></div>
        <div class="orbit orbit-b"></div>
        <div class="orbit orbit-c"></div>
        <div class="targeting-ring targeting-ring-a"></div>
        <div class="targeting-ring targeting-ring-b"></div>
        <canvas ref="canvasRef" class="star-canvas" width="600" height="600"></canvas>
      </div>
    </main>

    <aside v-if="showText" class="telemetry-panel telemetry-right">
      <div class="panel-header">
        <span class="panel-kicker">CONVERSATION FLOW</span>
        <span class="panel-code">{{ transcriptItems.length + (partialText ? 1 : 0) }}</span>
      </div>

      <div class="transcript-stream">
        <div v-if="partialText" class="transcript-item user partial">
          <span class="role">用户输入</span>
          <p>{{ partialText }}</p>
        </div>
        <div v-for="(item, i) in transcriptItems" :key="i" class="transcript-item" :class="item.role">
          <span class="role">{{ item.role === 'user' ? '用户' : (assistantName || '助手') }}</span>
          <p>{{ item.text }}</p>
        </div>
      </div>
    </aside>

    <footer class="bottom-hud">
      <div class="caption-deck" v-if="activeTranscript || latestAssistantText">
        <div class="caption-card active" v-if="activeTranscript">
          <span class="caption-label">INPUT</span>
          <p class="caption-text">{{ activeTranscript }}</p>
        </div>
        <div class="caption-card" v-if="latestAssistantText">
          <span class="caption-label">OUTPUT</span>
          <p class="caption-text">{{ latestAssistantText }}</p>
        </div>
      </div>

      <div class="status-bar">
        <div class="status-pill" :class="voiceState">
          <span class="status-dot"></span>
          <span>{{ statusText }}</span>
        </div>
        <div class="status-line">{{ assistantName || '助手' }}</div>
      </div>
    </footer>

    <div v-if="error" class="immersive-error">{{ error }}</div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { currentLocale } from '@/i18n'
import { ipc } from '@/lib/ipc'
import { useChatStore } from '@/stores/chat'
import { useGatewayStore } from '@/stores/gateway'

const props = defineProps({
  assistantName: { type: String, default: '' },
  modelName: { type: String, default: '' },
})

const emit = defineEmits(['exit'])
const chatStore = useChatStore()
const gatewayStore = useGatewayStore()

const canvasRef = ref(null)
const showText = ref(true)
const partialText = ref('')
const transcriptItems = ref([])
const voiceState = ref('idle')
const error = ref('')

let removeVoiceListener = null
let asrSessionId = ''
let ttsSessionId = ''
let audioContext = null
let mediaStream = null
let sourceNode = null
let processorNode = null
let animationFrame = 0
let particles = []
let rotationX = 0
let rotationY = 0
let dragging = false
let lastPointerX = 0
let lastPointerY = 0
let started = false
let lastAssistantCount = 0
let ttsChunks = []
let ttsAudio = null
let ttsMediaSource = null
let ttsSourceBuffer = null
let ttsObjectUrl = ''
let ttsQueue = []
let ttsStreamReady = false
let ttsStreamFailed = false
let cleaning = false
let audioFrameCount = 0
let recognitionPaused = false
let ttsAudioReceived = false
let ttsPlaybackStarted = false
let ttsChunkIdleTimer = 0

const PARTICLE_COUNT = 1200
const SPHERE_RADIUS = 180
const SPHERE_CANVAS_SIZE = 600

class SphereParticle {
  constructor() {
    const u = Math.random()
    const v = Math.random()
    const theta = 2 * Math.PI * u
    const phi = Math.acos(2 * v - 1)
    const radius = Math.pow(Math.random(), 1 / 3) * SPHERE_RADIUS
    this.bx = radius * Math.sin(phi) * Math.cos(theta)
    this.by = radius * Math.sin(phi) * Math.sin(theta)
    this.bz = radius * Math.cos(phi)
    this.x = this.bx
    this.y = this.by
    this.z = this.bz
    const randomType = Math.random()
    if (randomType < 0.4) {
      this.type = 0
      this.color = '#ff5a36'
    } else if (randomType < 0.8) {
      this.type = 1
      this.color = '#f5fbff'
    } else {
      this.type = 2
      this.color = '#08111d'
    }
    this.size = Math.random() * 1.5 + 0.5
  }

  update(time, rx, ry, voicePulse) {
    if (this.type === 0) {
      const hue = Math.sin(time * 0.0005 + this.bx * 0.03) * 20 + 192
      this.color = `hsl(${hue}, 92%, 64%)`
    }
    const speechWave = voiceState.value === 'thinking' || voiceState.value === 'speaking' ? voicePulse * 20 : 0
    const wave = Math.sin(time * 0.002 + (this.bx + this.by + this.bz) * 0.01) * (12 + speechWave)
    const radius = Math.sqrt(this.bx ** 2 + this.by ** 2 + this.bz ** 2) + 0.001
    const ratio = (radius + wave) / radius
    let tx = this.bx * ratio
    let ty = this.by * ratio
    let tz = this.bz * ratio

    const cosX = Math.cos(rx)
    const sinX = Math.sin(rx)
    const y1 = ty * cosX - tz * sinX
    const z1 = ty * sinX + tz * cosX
    ty = y1
    tz = z1

    const cosY = Math.cos(ry)
    const sinY = Math.sin(ry)
    const x2 = tx * cosY + tz * sinY
    const z2 = -tx * sinY + tz * cosY
    this.x = x2
    this.y = ty
    this.z = z2
  }

  project(cx, cy) {
    const pz = Math.max(-300, Math.min(this.z, 590))
    const projection = SPHERE_CANVAS_SIZE / (SPHERE_CANVAS_SIZE - pz)
    return {
      x: this.x * projection + cx,
      y: this.y * projection + cy,
      size: this.size * projection,
      alpha: Math.max(0.1, projection - 0.4),
    }
  }

  draw(ctx, cx, cy) {
    const projected = this.project(cx, cy)
    if (this.type === 2) {
      ctx.globalAlpha = 1
      ctx.strokeStyle = 'rgba(255,255,255,0.12)'
      ctx.lineWidth = 0.5
      ctx.beginPath()
      ctx.arc(projected.x, projected.y, Math.max(0.1, projected.size), 0, Math.PI * 2)
      ctx.stroke()
    } else {
      ctx.fillStyle = this.color
      ctx.globalAlpha = projected.alpha
      ctx.beginPath()
      ctx.arc(projected.x, projected.y, Math.max(0.1, projected.size), 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function log(...args) {
  console.log('[immersive-voice]', ...args)
}

function warn(...args) {
  console.warn('[immersive-voice]', ...args)
}

const statusText = computed(() => {
  if (voiceState.value === 'listening') return '正在聆听'
  if (voiceState.value === 'thinking') return '正在思考'
  if (voiceState.value === 'speaking') return '正在回答'
  if (voiceState.value === 'connecting') return '正在连接语音服务'
  return props.modelName || '待机中'
})

const activeTranscript = computed(() => {
  if (partialText.value) return partialText.value
  const latest = transcriptItems.value[transcriptItems.value.length - 1]
  return latest?.role === 'user' ? latest.text : ''
})

const assistantInitial = computed(() => (props.assistantName || '助手').slice(0, 1).toUpperCase())

const stateCode = computed(() => {
  if (voiceState.value === 'listening') return 'LISTEN'
  if (voiceState.value === 'thinking') return 'THINK'
  if (voiceState.value === 'speaking') return 'SPEAK'
  if (voiceState.value === 'connecting') return 'LINK'
  return 'IDLE'
})

const statusDescription = computed(() => {
  if (voiceState.value === 'listening') return '实时捕捉你的语音，等待下一句输入完成。'
  if (voiceState.value === 'thinking') return '语音已封存，正在等待模型生成当前轮回复。'
  if (voiceState.value === 'speaking') return '回复内容正在通过语音通道播报。'
  if (voiceState.value === 'connecting') return '正在建立识别与播报链路。'
  return '沉浸模式待命中。'
})

const recognitionLabel = computed(() => (recognitionPaused ? '已封存' : '在线'))
const ttsLabel = computed(() => (voiceState.value === 'speaking' ? '播报中' : '待机'))
const gatewayLabel = computed(() => (gatewayStore.mode === 'remote' ? '远程' : '本地'))

const ASR_EMOTION_LABELS = {
  surprised: { zh: '惊讶', en: 'surprised' },
  neutral: { zh: '平静', en: 'neutral' },
  happy: { zh: '愉快', en: 'happy' },
  sad: { zh: '悲伤', en: 'sad' },
  disgusted: { zh: '厌恶', en: 'disgusted' },
  angry: { zh: '愤怒', en: 'angry' },
  fearful: { zh: '恐惧', en: 'fearful' },
}

const latestAssistantText = computed(() => {
  const latest = [...transcriptItems.value].reverse().find(item => item.role === 'assistant')
  return latest?.text || ''
})

function appendTranscript(role, text) {
  const clean = String(text || '').trim()
  if (!clean) return
  transcriptItems.value = [...transcriptItems.value.slice(-12), { role, text: clean }]
}

function pauseRecognition(reason) {
  recognitionPaused = true
  log('recognition paused', { reason, voiceState: voiceState.value })
}

function resumeRecognition(reason) {
  if (!started || cleaning || !asrSessionId) return
  recognitionPaused = false
  error.value = ''
  if (!chatStore.isStreaming) {
    voiceState.value = 'listening'
  }
  log('recognition resumed', { reason, voiceState: voiceState.value })
}

function buildBackendSpeechText(text, emotion) {
  const emotionInfo = ASR_EMOTION_LABELS[String(emotion || '').trim().toLowerCase()]
  if (!emotionInfo) return text
  const isEnglish = currentLocale.value === 'en'
  const label = isEnglish ? emotionInfo.en : emotionInfo.zh
  const prefix = isEnglish ? '[tone and emotion]' : '语气情绪'
  return isEnglish ? `[${prefix} ${label}]:${text}` : `【${prefix}${label}】:${text}`
}

async function commitPendingSpeech(source, value = partialText.value, emotion = '') {
  const text = String(value || '').trim()
  if (!text) return
  const backendText = buildBackendSpeechText(text, emotion)
  if (!gatewayStore.ready) {
    try {
      await gatewayStore.refresh()
      log('gateway refreshed before commit', { ready: gatewayStore.ready, status: gatewayStore.status, mode: gatewayStore.mode, port: gatewayStore.port })
    } catch (err) {
      warn('gateway refresh before commit failed', err)
    }
  }
  if (!gatewayStore.ready) {
    error.value = '网关未连接，语音内容未发送'
    warn('gateway not ready, drop speech', { source, text })
    voiceState.value = 'idle'
    return
  }
  appendTranscript('user', text)
  partialText.value = ''
  voiceState.value = 'thinking'
  log('forward speech to backend', { source, textLength: backendText.length, text: backendText, emotion })
  try {
    await chatStore.sendMessage(backendText, [])
    log('backend send completed', { source, textLength: backendText.length })
  } catch (err) {
    warn('backend send failed', err)
    error.value = err?.message || String(err)
    voiceState.value = 'idle'
  }
}

function withTimeout(promise, timeout = 1200) {
  return Promise.race([
    promise,
    new Promise(resolve => window.setTimeout(resolve, timeout)),
  ])
}

function downsampleTo16k(input, inputRate) {
  if (inputRate === 16000) return input
  const ratio = inputRate / 16000
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

async function startMicrophone() {
  log('request microphone permission')
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('当前环境不支持麦克风访问 navigator.mediaDevices.getUserMedia')
  }
  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  })
  log('microphone stream acquired', mediaStream.getAudioTracks().map(track => ({
    label: track.label,
    enabled: track.enabled,
    muted: track.muted,
    readyState: track.readyState,
  })))
  audioContext = new AudioContext()
  log('audio context created', { sampleRate: audioContext.sampleRate, state: audioContext.state })
  if (audioContext.state === 'suspended') {
    log('audio context suspended, resume')
    await audioContext.resume()
    log('audio context resumed', { state: audioContext.state })
  }
  sourceNode = audioContext.createMediaStreamSource(mediaStream)
  processorNode = audioContext.createScriptProcessor(4096, 1, 1)
  processorNode.onaudioprocess = async (event) => {
    if (!asrSessionId || recognitionPaused || voiceState.value !== 'listening') return
    const input = event.inputBuffer.getChannelData(0)
    const pcm = floatToPcm16(downsampleTo16k(input, audioContext.sampleRate))
    audioFrameCount += 1
    if (audioFrameCount <= 5 || audioFrameCount % 100 === 0) {
      log('audio frame', { frame: audioFrameCount, inputSamples: input.length, pcmBytes: pcm.byteLength, audioState: audioContext.state })
    }
    try {
      const res = await ipc.immersiveVoiceSendAudio(asrSessionId, pcm)
      if (res?.ok === false && (audioFrameCount <= 5 || audioFrameCount % 100 === 0)) warn('send audio failed', res.error)
    } catch (err) {
      warn('send audio exception', err)
    }
  }
  sourceNode.connect(processorNode)
  processorNode.connect(audioContext.destination)
  log('microphone audio graph connected')
}

async function startAsr() {
  log('start ASR')
  voiceState.value = 'connecting'
  const settings = await ipc.getSettings()
  log('settings loaded', {
    hasVoiceSettings: !!settings?.voice,
    hasApiKey: !!settings?.voice?.dashscopeApiKey,
    showImmersiveText: settings?.voice?.showImmersiveText,
  })
  showText.value = settings?.voice?.showImmersiveText !== false
  const apiKey = settings?.voice?.dashscopeApiKey || ''
  if (!apiKey) throw new Error('请先在设置 > 语音设置中填写百炼 DashScope API KEY')
  await startMicrophone()
  log('request ASR websocket session')
  const res = await ipc.immersiveVoiceStartAsr({
    apiKey,
    model: 'qwen3-asr-flash-realtime',
    sampleRate: 16000,
  })
  log('ASR start result', { ok: res?.ok, sessionId: res?.sessionId, error: res?.error })
  if (!res.ok) throw new Error(res.error || '语音识别连接失败')
  asrSessionId = res.sessionId
}

function handleVoiceEvent(data) {
  if (!data) return
  log('voice event', { event: data.event, rawEvent: data.rawEvent, sessionId: data.sessionId, text: data.text, emotion: data.emotion, error: data.error, audio: !!data.audioBase64 })
  if (data.sessionId !== asrSessionId && data.sessionId !== ttsSessionId) return
  if (data.event === 'asr:ready') {
    if (!recognitionPaused) voiceState.value = 'listening'
    return
  }
  if (data.event === 'asr:speech-started') {
    if (recognitionPaused) return
    error.value = ''
    return
  }
  if (data.event === 'asr:speech-stopped') {
    return
  }
  if (data.event === 'asr:transcript') {
    if (recognitionPaused) return
    partialText.value = data.text || ''
    return
  }
  if (data.event === 'asr:sentence-end') {
    if (recognitionPaused) return
    const transcript = String(data.text || data.transcript || partialText.value || '').trim()
    partialText.value = transcript
    pauseRecognition('sentence-end')
    voiceState.value = 'thinking'
    void commitPendingSpeech('completed', transcript, data.emotion)
    return
  }
  if (data.event === 'asr:noise-filtered') {
    partialText.value = ''
    if (!recognitionPaused) voiceState.value = 'listening'
    return
  }
  if (data.event === 'tts:audio' && data.audioBase64) {
    appendTtsAudio(data.audioBase64)
    return
  }
  if (data.event === 'tts:ready') {
    return
  }
  if (data.event === 'tts:done' || data.event === 'tts:closed') {
    finishTtsAudio()
    return
  }
  if (data.event?.endsWith(':error')) {
    warn('voice service error', data)
    error.value = data.error || '语音服务异常'
    resetTtsStream()
    if (data.event.startsWith('tts:')) {
      resumeRecognition('tts-error')
      return
    }
    voiceState.value = 'idle'
  }
}

function base64ToBytes(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function resetTtsStream() {
  if (ttsChunkIdleTimer) {
    window.clearTimeout(ttsChunkIdleTimer)
    ttsChunkIdleTimer = 0
  }
  if (ttsAudio) {
    ttsAudio.pause()
    ttsAudio.removeAttribute('src')
    ttsAudio.load()
  }
  if (ttsObjectUrl) URL.revokeObjectURL(ttsObjectUrl)
  ttsAudio = null
  ttsMediaSource = null
  ttsSourceBuffer = null
  ttsObjectUrl = ''
  ttsQueue = []
  ttsStreamReady = false
  ttsStreamFailed = false
  ttsAudioReceived = false
  ttsPlaybackStarted = false
}

function drainTtsQueue() {
  if (!ttsSourceBuffer || ttsSourceBuffer.updating || ttsQueue.length === 0) return
  try {
    const chunk = ttsQueue.shift()
    ttsSourceBuffer.appendBuffer(chunk)
    if (ttsAudio?.paused) {
      ttsAudio.play().then(() => {
        ttsPlaybackStarted = true
      }).catch(err => {
        warn('tts replay after append rejected', err)
      })
    }
  } catch (err) {
    warn('append tts chunk failed', err)
    ttsStreamFailed = true
  }
}

function startTtsStream() {
  if (ttsAudio || ttsStreamFailed) return
  if (!window.MediaSource || !MediaSource.isTypeSupported('audio/mpeg')) {
    ttsStreamFailed = true
    warn('tts stream unsupported')
    return
  }
  ttsMediaSource = new MediaSource()
  ttsObjectUrl = URL.createObjectURL(ttsMediaSource)
  ttsAudio = new Audio(ttsObjectUrl)
  ttsAudio.onplay = () => {
    ttsPlaybackStarted = true
  }
  ttsAudio.onended = () => {
    resetTtsStream()
    resumeRecognition('tts-ended')
  }
  ttsAudio.onerror = () => {
    warn('tts audio element error', ttsAudio?.error?.message || ttsAudio?.error?.code)
    ttsStreamFailed = true
    playTtsChunks()
  }
  ttsMediaSource.addEventListener('sourceopen', () => {
    try {
      ttsSourceBuffer = ttsMediaSource.addSourceBuffer('audio/mpeg')
      ttsSourceBuffer.mode = 'sequence'
      ttsSourceBuffer.addEventListener('updateend', drainTtsQueue)
      ttsSourceBuffer.addEventListener('error', (event) => {
        warn('tts source buffer error', event)
      })
      ttsStreamReady = true
      drainTtsQueue()
    } catch (err) {
      warn('tts source buffer setup failed', err)
      ttsStreamFailed = true
    }
  }, { once: true })
  voiceState.value = 'speaking'
  ttsAudio.play().then(() => {
    ttsPlaybackStarted = true
  }).catch(err => {
    if (err?.name !== 'AbortError') warn('tts stream play rejected', err)
    if (!cleaning) ttsStreamFailed = true
  })
}

function appendTtsAudio(base64) {
  ttsAudioReceived = true
  const chunk = base64ToBytes(base64)
  ttsChunks.push(base64)
  if (!ttsAudio && !ttsStreamFailed) startTtsStream()
  if (ttsStreamFailed) return
  ttsQueue.push(chunk)
  if (ttsStreamReady) drainTtsQueue()
  if (ttsAudio?.paused) {
    ttsAudio.play().then(() => {
      ttsPlaybackStarted = true
    }).catch(err => {
      if (err?.name !== 'AbortError') warn('tts replay on chunk rejected', err)
    })
  }
  if (ttsChunkIdleTimer) window.clearTimeout(ttsChunkIdleTimer)
  ttsChunkIdleTimer = window.setTimeout(() => {
    ttsChunkIdleTimer = 0
    if (cleaning || ttsPlaybackStarted || !ttsAudioReceived || ttsChunks.length === 0) return
    warn('tts chunk idle fallback to blob playback')
    ttsStreamFailed = true
    playTtsChunks()
  }, 1500)
}

function finishTtsAudio() {
  if (!ttsAudioReceived) {
    resetTtsStream()
    resumeRecognition('tts-done-without-audio')
    return
  }
  if (ttsStreamFailed || !ttsAudio || !ttsPlaybackStarted) {
    playTtsChunks()
    return
  }
  const endStream = () => {
    try {
      if (ttsMediaSource?.readyState === 'open') ttsMediaSource.endOfStream()
    } catch {}
  }
  if (ttsSourceBuffer?.updating || ttsQueue.length > 0) {
    const timer = window.setInterval(() => {
      if (ttsSourceBuffer?.updating || ttsQueue.length > 0) return
      window.clearInterval(timer)
      endStream()
    }, 50)
  } else {
    endStream()
  }
}

function playTtsChunks() {
  if (ttsChunks.length === 0) {
    resetTtsStream()
    resumeRecognition('tts-empty')
    return
  }
  const bytes = ttsChunks.map(base64ToBytes)
  const total = bytes.reduce((sum, item) => sum + item.length, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const item of bytes) {
    merged.set(item, offset)
    offset += item.length
  }
  ttsChunks = []
  resetTtsStream()
  const blob = new Blob([merged], { type: 'audio/mpeg' })
  const audio = new Audio(URL.createObjectURL(blob))
  voiceState.value = 'speaking'
  audio.onended = () => {
    URL.revokeObjectURL(audio.src)
    resumeRecognition('tts-fallback-ended')
  }
  audio.onerror = () => {
    warn('tts blob error', audio?.error?.message || audio?.error?.code)
    URL.revokeObjectURL(audio.src)
    resumeRecognition('tts-fallback-error')
  }
  audio.play().catch(err => {
    warn('tts blob play rejected', err)
    resumeRecognition('tts-fallback-play-error')
  })
}

function resolveTtsModel(voice, savedModel) {
  if (String(voice || '').endsWith('_v3')) return 'cosyvoice-v3-flash'
  return savedModel || 'cosyvoice-v3-flash'
}

async function speakAssistant(text) {
  const clean = String(text || '').trim()
  if (!clean) return false
  appendTranscript('assistant', clean)
  const settings = await ipc.getSettings()
  const apiKey = settings?.voice?.dashscopeApiKey || ''
  if (!apiKey) return false
  const voice = settings?.voice?.voice || 'longanhuan_v3'
  const model = resolveTtsModel(voice, settings?.voice?.ttsModel)
  resetTtsStream()
  ttsChunks = []
  const res = await ipc.immersiveVoiceStartTts({
    apiKey,
    text: clean,
    model,
    voice,
    format: 'mp3',
    sampleRate: 24000,
  })
  if (res.ok) {
    ttsSessionId = res.sessionId
    voiceState.value = 'speaking'
    return true
  }
  return false
}

watch(
  () => [chatStore.isStreaming, chatStore.messages.length],
  async () => {
    if (!started) return
    if (chatStore.isStreaming) {
      voiceState.value = 'thinking'
      return
    }
    const assistantMessages = chatStore.messages.filter(m => m.role === 'assistant')
    if (assistantMessages.length <= lastAssistantCount) return
    lastAssistantCount = assistantMessages.length
    const latest = assistantMessages[assistantMessages.length - 1]
    const text = typeof latest.content === 'string'
      ? latest.content
      : Array.isArray(latest.content)
        ? latest.content.filter(b => b?.type === 'text').map(b => b.text).join('')
        : ''
    const startedTts = await speakAssistant(text)
    if (!startedTts) resumeRecognition('assistant-response-complete')
  },
)

function buildParticles() {
  particles = Array.from({ length: PARTICLE_COUNT }, () => new SphereParticle())
}

function resizeSphere() {
  const canvas = canvasRef.value
  if (!canvas) return
  const size = window.innerWidth < 768 ? 320 : 560
  canvas.style.width = `${size}px`
  canvas.style.height = `${size}px`
}

function handlePointerDown(event) {
  dragging = true
  lastPointerX = event.clientX
  lastPointerY = event.clientY
}

function handlePointerMove(event) {
  if (!dragging) return
  rotationY += (event.clientX - lastPointerX) * 0.008
  rotationX -= (event.clientY - lastPointerY) * 0.008
  lastPointerX = event.clientX
  lastPointerY = event.clientY
}

function handlePointerUp() {
  dragging = false
}

function bindSphereEvents() {
  const canvas = canvasRef.value
  if (!canvas) return
  canvas.addEventListener('pointerdown', handlePointerDown)
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('resize', resizeSphere)
  resizeSphere()
}

function unbindSphereEvents() {
  const canvas = canvasRef.value
  canvas?.removeEventListener('pointerdown', handlePointerDown)
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
  window.removeEventListener('resize', resizeSphere)
}

function drawParticles() {
  animationFrame = requestAnimationFrame(drawParticles)
  try {
    const canvas = canvasRef.value
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const time = performance.now()
    if (!dragging) {
      rotationY += 0.005
      rotationX += 0.002
    }

    ctx.clearRect(0, 0, SPHERE_CANVAS_SIZE, SPHERE_CANVAS_SIZE)
    const cx = SPHERE_CANVAS_SIZE / 2
    const cy = SPHERE_CANVAS_SIZE / 2

    const speechPulse = voiceState.value === 'thinking' || voiceState.value === 'speaking'
      ? Math.max(0, Math.sin(time * 0.006)) * 0.8
      : 0
    const pulse = 0.06 + Math.sin(time * 0.003) * 0.02 + speechPulse * 0.04
    const glow = ctx.createRadialGradient(cx, cy, 80, cx, cy, 260)
    glow.addColorStop(0, `rgba(255,200,100,${pulse.toFixed(3)})`)
    glow.addColorStop(0.5, `rgba(255,180,60,${(pulse * 0.4).toFixed(3)})`)
    glow.addColorStop(1, 'rgba(255,150,30,0)')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, SPHERE_CANVAS_SIZE, SPHERE_CANVAS_SIZE)

    for (const particle of particles) particle.update(time, rotationX, rotationY, speechPulse)
    particles.sort((a, b) => a.z - b.z)

    const projected = particles.map(particle => particle.project(cx, cy))
    const connectRange = Math.min(12, particles.length - 1)
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j <= i + connectRange && j < particles.length; j++) {
        const distance = Math.hypot(projected[i].x - projected[j].x, projected[i].y - projected[j].y)
        if (distance < 55) {
          ctx.strokeStyle = `rgba(0,200,255,${((1 - distance / 55) * 0.2).toFixed(3)})`
          ctx.lineWidth = 0.4
          ctx.beginPath()
          ctx.moveTo(projected[i].x, projected[i].y)
          ctx.lineTo(projected[j].x, projected[j].y)
          ctx.stroke()
        }
      }
    }

    for (const particle of particles) particle.draw(ctx, cx, cy)
    ctx.globalAlpha = 1
  } catch (err) {
    warn('particle draw failed', err)
  }
}

async function exit() {
  log('exit requested')
  emit('exit')
  cleanup()
}

async function cleanup() {
  if (cleaning) return
  cleaning = true
  log('cleanup start')
  started = false
  cancelAnimationFrame(animationFrame)
  await withTimeout(ipc.setImmersiveFullscreen(false), 800)
  if (asrSessionId) await withTimeout(ipc.immersiveVoiceStopAsr(asrSessionId))
  if (ttsSessionId) await withTimeout(ipc.immersiveVoiceStopTts(ttsSessionId))
  asrSessionId = ''
  ttsSessionId = ''
  resetTtsStream()
  ttsChunks = []
  try { processorNode?.disconnect() } catch {}
  try { sourceNode?.disconnect() } catch {}
  try { await audioContext?.close() } catch {}
  mediaStream?.getTracks?.().forEach(track => track.stop())
  removeVoiceListener?.()
  window.removeEventListener('keydown', handleKeydown)
  unbindSphereEvents()
  log('cleanup done')
}

function handleKeydown(event) {
  if (event.key === 'Escape') exit()
}

onMounted(async () => {
  log('mounted', { assistantName: props.assistantName, modelName: props.modelName })
  started = true
  lastAssistantCount = chatStore.messages.filter(m => m.role === 'assistant').length
  removeVoiceListener = ipc.onImmersiveVoiceEvent(handleVoiceEvent)
  window.addEventListener('keydown', handleKeydown)
  try {
    await gatewayStore.refresh()
    log('gateway refreshed', { ready: gatewayStore.ready, status: gatewayStore.status, mode: gatewayStore.mode, port: gatewayStore.port })
  } catch (err) {
    warn('gateway refresh failed', err)
  }
  buildParticles()
  await nextTick()
  bindSphereEvents()
  drawParticles()
  try {
    log('enter fullscreen')
    await ipc.setImmersiveFullscreen(true)
    log('fullscreen set, start voice')
    await startAsr()
  } catch (err) {
    warn('startup failed', err)
    error.value = err.message || String(err)
    voiceState.value = 'idle'
  }
})

onUnmounted(() => {
  log('unmounted')
  cleanup()
})
</script>

<style scoped>
.immersive-voice {
  position: fixed;
  inset: 0;
  z-index: 9999;
  overflow: hidden;
  color: #f8fbff;
  background:
    radial-gradient(circle at 50% 50%, rgba(18, 37, 76, 0.42), transparent 34%),
    radial-gradient(circle at 18% 22%, rgba(0, 194, 255, 0.12), transparent 26%),
    radial-gradient(circle at 82% 18%, rgba(125, 92, 255, 0.12), transparent 24%),
    linear-gradient(180deg, #04101d 0%, #02060e 46%, #010205 100%);
  user-select: none;
}

.ambient-backdrop,
.ambient-grid,
.ambient-vignette,
.ambient-scanlines {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ambient-backdrop {
  background:
    radial-gradient(circle at 50% 56%, rgba(255, 110, 46, 0.08), transparent 20%),
    radial-gradient(circle at 50% 50%, rgba(42, 225, 255, 0.05), transparent 34%);
  filter: blur(18px);
}

.ambient-grid {
  opacity: 0.28;
  background-image:
    linear-gradient(rgba(89, 164, 255, 0.07) 1px, transparent 1px),
    linear-gradient(90deg, rgba(89, 164, 255, 0.07) 1px, transparent 1px);
  background-size: 72px 72px;
  mask-image: radial-gradient(circle at center, rgba(0, 0, 0, 0.92), transparent 86%);
}

.ambient-vignette {
  background: radial-gradient(circle at center, transparent 54%, rgba(0, 0, 0, 0.48) 100%);
}

.ambient-scanlines {
  opacity: 0.08;
  background: repeating-linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.15) 0,
    rgba(255, 255, 255, 0.15) 1px,
    transparent 1px,
    transparent 4px
  );
}

.top-hud {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 14;
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 18px;
  align-items: center;
  padding: 24px 28px 0;
}

.hud-brand {
  display: flex;
  align-items: center;
  gap: 14px;
}

.brand-mark {
  display: grid;
  place-items: center;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  border: 1px solid rgba(116, 201, 255, 0.28);
  background: linear-gradient(180deg, rgba(22, 46, 86, 0.88), rgba(7, 14, 24, 0.9));
  box-shadow:
    inset 0 0 22px rgba(62, 190, 255, 0.15),
    0 0 30px rgba(0, 147, 255, 0.14);
  font-size: 18px;
  font-weight: 700;
  color: #d9f7ff;
}

.brand-copy {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.brand-kicker,
.chip-label,
.panel-kicker,
.metric-label,
.caption-label,
.core-kicker {
  font-size: 11px;
  letter-spacing: 0.14em;
  color: rgba(177, 214, 255, 0.58);
}

.brand-title,
.chip-value {
  font-size: 15px;
  color: #f4fbff;
}

.brand-title {
  font-size: 12px;
  letter-spacing: 0.16em;
  color: rgba(177, 214, 255, 0.5);
}

.brand-kicker {
  font-size: 16px;
  letter-spacing: 0.02em;
  color: #f4fbff;
}

.hud-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 42px;
  padding: 0 14px;
  border: 1px solid rgba(104, 182, 255, 0.18);
  border-radius: 12px;
  background: rgba(7, 14, 24, 0.7);
  box-shadow: inset 0 0 28px rgba(32, 96, 180, 0.14);
  backdrop-filter: blur(20px);
}

.telemetry-panel {
  position: absolute;
  z-index: 12;
  top: 108px;
  width: min(320px, calc(100vw - 48px));
  padding: 18px;
  border: 1px solid rgba(97, 161, 228, 0.18);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(8, 18, 34, 0.84), rgba(4, 9, 18, 0.7));
  box-shadow:
    inset 0 0 32px rgba(31, 94, 180, 0.12),
    0 16px 50px rgba(0, 0, 0, 0.28);
  backdrop-filter: blur(22px);
}

.telemetry-left {
  left: 28px;
}

.telemetry-right {
  right: 28px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.panel-code {
  font-size: 12px;
  font-weight: 700;
  color: #68d7ff;
}

.metric-block.primary {
  padding: 16px;
  border-radius: 16px;
  background: rgba(12, 23, 43, 0.72);
  border: 1px solid rgba(104, 182, 255, 0.14);
}

.metric-value {
  display: block;
  margin-top: 6px;
  font-size: 24px;
  font-weight: 700;
  color: #f7fbff;
}

.metric-value.small {
  margin-top: 4px;
  font-size: 14px;
}

.metric-note {
  margin: 10px 0 0;
  color: rgba(212, 232, 255, 0.72);
  line-height: 1.65;
  font-size: 13px;
}

.metric-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.metric-tag {
  display: inline-flex;
  align-items: center;
  min-height: 30px;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(7, 15, 28, 0.8);
  color: rgba(236, 246, 255, 0.82);
  font-size: 12px;
}

.orbital-stage {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: grid;
  place-items: center;
  padding: 120px 340px 180px;
}

.orbital-shell {
  position: relative;
  width: min(68vh, 760px);
  aspect-ratio: 1 / 1;
  display: grid;
  place-items: center;
}

.sphere-glow,
.orbit,
.targeting-ring,
.star-canvas {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
}

.sphere-glow {
  z-index: 4;
  width: 68%;
  height: 68%;
  border-radius: 50%;
  background:
    radial-gradient(circle, rgba(255, 101, 38, 0.28) 0%, rgba(255, 132, 76, 0.1) 36%, transparent 70%);
  filter: blur(70px);
  animation: glowPulse 6s ease-in-out infinite;
  pointer-events: none;
}

.orbit,
.targeting-ring {
  border-radius: 50%;
  pointer-events: none;
}

.orbit-a,
.orbit-b,
.orbit-c {
  z-index: 3;
  border: 1px solid rgba(98, 202, 255, 0.14);
  box-shadow: inset 0 0 30px rgba(52, 170, 255, 0.06);
}

.orbit-a {
  width: 88%;
  height: 88%;
  animation: orbitRotate 28s linear infinite;
}

.orbit-b {
  width: 102%;
  height: 72%;
  transform: translate(-50%, -50%) rotate(18deg);
  animation: orbitRotateReverse 36s linear infinite;
}

.orbit-c {
  width: 72%;
  height: 102%;
  transform: translate(-50%, -50%) rotate(-22deg);
  animation: orbitRotate 24s linear infinite;
}

.targeting-ring-a,
.targeting-ring-b {
  z-index: 6;
  border: 1px dashed rgba(255, 255, 255, 0.08);
}

.targeting-ring-a {
  width: 118%;
  height: 118%;
}

.targeting-ring-b {
  width: 42%;
  height: 42%;
}

.star-canvas {
  z-index: 5;
  width: min(58vh, 560px);
  height: min(58vh, 560px);
  cursor: grab;
  touch-action: none;
}

.star-canvas:active {
  cursor: grabbing;
}

.bottom-hud {
  position: absolute;
  left: 28px;
  right: 28px;
  bottom: 26px;
  z-index: 14;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.caption-deck {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.caption-card {
  min-height: 86px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(9, 18, 34, 0.84), rgba(5, 10, 18, 0.72));
  backdrop-filter: blur(18px);
}

.caption-card.active {
  border-color: rgba(104, 214, 255, 0.18);
}

.caption-text {
  margin: 8px 0 0;
  color: rgba(245, 250, 255, 0.94);
  line-height: 1.65;
  word-break: break-word;
}

.status-bar {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 14px;
  align-items: center;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid rgba(104, 182, 255, 0.18);
  background: rgba(7, 14, 24, 0.74);
  backdrop-filter: blur(16px);
}

.status-line {
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 0 16px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(5, 11, 20, 0.7);
  color: rgba(221, 236, 255, 0.78);
  font-weight: 600;
}

.status-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #29e0c2;
  box-shadow: 0 0 16px #29e0c2;
}

.status-pill.thinking .status-dot,
.status-pill.speaking .status-dot {
  background: #ff8a2a;
  box-shadow: 0 0 18px #ff8a2a;
  animation: statusPulse 0.8s infinite alternate;
}

.transcript-stream {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: calc(100vh - 260px);
  overflow: auto;
  padding-right: 2px;
}

.transcript-stream::-webkit-scrollbar {
  width: 8px;
}

.transcript-stream::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(111, 173, 255, 0.18);
}

.transcript-item {
  padding: 12px 14px;
  border-radius: 14px;
  background: rgba(10, 19, 35, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.transcript-item.user {
  border-color: rgba(41, 224, 194, 0.2);
}

.transcript-item.assistant {
  border-color: rgba(255, 138, 42, 0.2);
}

.transcript-item.partial {
  opacity: 0.84;
}

.transcript-item .role {
  display: block;
  margin-bottom: 6px;
  font-size: 11px;
  letter-spacing: 0.12em;
  color: rgba(175, 210, 255, 0.54);
}

.transcript-item p {
  margin: 0;
  color: rgba(243, 249, 255, 0.92);
  line-height: 1.62;
}

.immersive-error {
  position: absolute;
  z-index: 20;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  max-width: min(560px, calc(100vw - 48px));
  padding: 14px 18px;
  border-radius: 14px;
  background: rgba(103, 22, 27, 0.82);
  border: 1px solid rgba(248, 113, 113, 0.34);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.28);
}

@keyframes glowPulse {
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.58;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.14);
    opacity: 1;
  }
}

@keyframes orbitRotate {
  from {
    transform: translate(-50%, -50%) rotate(0deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(360deg);
  }
}

@keyframes orbitRotateReverse {
  from {
    transform: translate(-50%, -50%) rotate(18deg);
  }
  to {
    transform: translate(-50%, -50%) rotate(-342deg);
  }
}

@keyframes statusPulse {
  from {
    transform: scale(0.82);
    opacity: 0.68;
  }
  to {
    transform: scale(1.34);
    opacity: 1;
  }
}

@media (max-width: 1180px) {
  .orbital-stage {
    padding-left: 24px;
    padding-right: 24px;
  }

  .telemetry-panel {
    width: min(280px, calc(100vw - 40px));
  }
}

@media (max-width: 980px) {
  .top-hud {
    grid-template-columns: 1fr;
  }

  .telemetry-left,
  .telemetry-right {
    position: static;
    width: auto;
  }

  .immersive-voice {
    overflow: auto;
  }

  .orbital-stage {
    position: relative;
    inset: auto;
    padding: 24px 20px 12px;
    min-height: 560px;
  }

  .bottom-hud {
    position: relative;
    left: auto;
    right: auto;
    bottom: auto;
    padding: 0 20px 24px;
  }

  .caption-deck,
  .status-bar {
    grid-template-columns: 1fr;
  }

  .telemetry-panel {
    margin: 18px 20px 0;
  }
}

@media (max-width: 768px) {
  .top-hud {
    padding: 18px 20px 0;
  }

  .orbital-shell {
    width: min(92vw, 420px);
  }

  .star-canvas {
    width: min(78vw, 320px);
    height: min(78vw, 320px);
  }

  .sphere-glow {
    width: 74%;
    height: 74%;
  }

}
</style>
