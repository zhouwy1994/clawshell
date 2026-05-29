/**
 * Voice recording via MediaRecorder API.
 * Captures audio and returns it as a base64 blob for sending to the gateway.
 * Also includes TTS via SpeechSynthesis for read-aloud.
 */

// ─── Voice Recording (MediaRecorder) ───

let mediaRecorder = null
let audioChunks = []
let recordingStartedAt = 0

function logSpeechDebug(stage, payload = {}) {
  console.debug(`[speech] ${stage}`, payload)
}

function pickRecordingMimeType() {
  const audio = typeof document !== 'undefined' ? document.createElement('audio') : null
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]

  for (const candidate of candidates) {
    if (!MediaRecorder.isTypeSupported(candidate)) continue
    if (!audio) return candidate
    const playable = audio.canPlayType(candidate)
    if (playable === 'probably' || playable === 'maybe') return candidate
  }

  for (const candidate of candidates) {
    if (MediaRecorder.isTypeSupported(candidate)) return candidate
  }

  return ''
}

export function isRecordingSupported() {
  return !!(navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined')
}

export function startRecording(callbacks) {
  if (mediaRecorder) return false

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      const mimeType = pickRecordingMimeType()
      logSpeechDebug('getUserMedia.success', {
        requestedMimeType: mimeType || '(browser default)',
        trackCount: stream.getTracks().length,
        trackSettings: stream.getAudioTracks().map(track => track.getSettings?.() || {}),
      })

      mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      const recorder = mediaRecorder
      audioChunks = []
      logSpeechDebug('recorder.created', {
        mimeType: recorder.mimeType || mimeType || '(unknown)',
        state: recorder.state,
      })

      recorder.onstart = () => {
        recordingStartedAt = Date.now()
        logSpeechDebug('recorder.start', {
          mimeType: recorder.mimeType || mimeType || '(unknown)',
          state: recorder.state,
        })
        callbacks.onStart?.()
      }
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data)
        logSpeechDebug('recorder.chunk', {
          chunkSize: e.data?.size || 0,
          chunkType: e.data?.type || '(unknown)',
          chunkCount: audioChunks.length,
        })
      }
      recorder.onstop = () => {
        const actualMimeType = audioChunks[0]?.type || recorder.mimeType || mimeType || 'audio/webm'
        const blob = new Blob(audioChunks, { type: actualMimeType })
        const durationSeconds = Math.max(1, Math.ceil((Date.now() - recordingStartedAt) / 1000))
        logSpeechDebug('recorder.stop', {
          actualMimeType,
          chunkCount: audioChunks.length,
          chunkSizes: audioChunks.map(chunk => chunk.size),
          blobSize: blob.size,
          durationSeconds,
        })
        if (blob.size === 0) {
          callbacks.onError?.('Recording is empty')
          stream.getTracks().forEach(t => t.stop())
          mediaRecorder = null
          audioChunks = []
          recordingStartedAt = 0
          callbacks.onEnd?.()
          return
        }
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result
          logSpeechDebug('reader.complete', {
            actualMimeType,
            dataUrlLength: typeof dataUrl === 'string' ? dataUrl.length : 0,
          })
          callbacks.onComplete?.({
            blob,
            dataUrl,
            mimeType: actualMimeType,
            playbackUrl: URL.createObjectURL(blob),
            durationSeconds,
          })
        }
        reader.readAsDataURL(blob)
        // Release microphone
        stream.getTracks().forEach(t => t.stop())
        mediaRecorder = null
        audioChunks = []
        recordingStartedAt = 0
        callbacks.onEnd?.()
      }
      recorder.onerror = () => {
        logSpeechDebug('recorder.error', {
          state: recorder.state,
        })
        callbacks.onError?.('Recording failed')
        stream.getTracks().forEach(t => t.stop())
        mediaRecorder = null
        audioChunks = []
        recordingStartedAt = 0
        callbacks.onEnd?.()
      }
      // Request periodic chunks so quick stop actions still produce audio data.
      recorder.start(250)
    })
    .catch(err => {
      logSpeechDebug('getUserMedia.error', {
        name: err?.name,
        message: err?.message,
      })
      callbacks.onError?.(err.name === 'NotAllowedError' ? 'Microphone permission denied' : 'Could not access microphone')
    })
  return true
}

export function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    logSpeechDebug('recorder.stop.requested', {
      state: mediaRecorder.state,
      mimeType: mediaRecorder.mimeType || '(unknown)',
    })
    try { mediaRecorder.requestData() } catch {}
    mediaRecorder.stop()
  }
}

export function isRecordingActive() {
  return mediaRecorder !== null && mediaRecorder.state === 'recording'
}

// ─── TTS (Text-to-Speech) ───

export function isTtsSupported() {
  return 'speechSynthesis' in window
}

let currentUtterance = null

export function speakText(text, opts = {}) {
  if (!isTtsSupported()) {
    opts.onError?.('Speech synthesis is not supported')
    return false
  }

  stopTts()

  const cleaned = stripMarkdown(text)
  if (!cleaned.trim()) return false

  const utterance = new SpeechSynthesisUtterance(cleaned)
  utterance.rate = 1.0
  utterance.pitch = 1.0

  utterance.onstart = () => opts.onStart?.()
  utterance.onend = () => {
    if (currentUtterance === utterance) currentUtterance = null
    opts.onEnd?.()
  }
  utterance.onerror = (e) => {
    if (currentUtterance === utterance) currentUtterance = null
    if (e.error === 'canceled' || e.error === 'interrupted') return
    opts.onError?.(e.error)
  }

  currentUtterance = utterance
  speechSynthesis.speak(utterance)
  return true
}

export function stopTts() {
  if (currentUtterance) currentUtterance = null
  if (isTtsSupported()) speechSynthesis.cancel()
}

export function isTtsSpeaking() {
  return isTtsSupported() && speechSynthesis.speaking
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
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
