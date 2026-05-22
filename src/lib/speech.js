/**
 * Voice recording via MediaRecorder API.
 * Captures audio and returns it as a base64 blob for sending to the gateway.
 * Also includes TTS via SpeechSynthesis for read-aloud.
 */

// ─── Voice Recording (MediaRecorder) ───

let mediaRecorder = null
let audioChunks = []

export function isRecordingSupported() {
  return !!(navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined')
}

export function startRecording(callbacks) {
  if (mediaRecorder) return false

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      mediaRecorder = new MediaRecorder(stream, { mimeType })
      audioChunks = []

      mediaRecorder.onstart = () => callbacks.onStart?.()
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data)
      }
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunks, { type: mimeType })
        const reader = new FileReader()
        reader.onload = () => {
          const dataUrl = reader.result
          callbacks.onComplete?.(dataUrl, mimeType)
        }
        reader.readAsDataURL(blob)
        // Release microphone
        stream.getTracks().forEach(t => t.stop())
        mediaRecorder = null
        audioChunks = []
        callbacks.onEnd?.()
      }
      mediaRecorder.onerror = () => {
        callbacks.onError?.('Recording failed')
        stream.getTracks().forEach(t => t.stop())
        mediaRecorder = null
        audioChunks = []
        callbacks.onEnd?.()
      }
      mediaRecorder.start()
    })
    .catch(err => {
      callbacks.onError?.(err.name === 'NotAllowedError' ? 'Microphone permission denied' : 'Could not access microphone')
    })
  return true
}

export function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
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
