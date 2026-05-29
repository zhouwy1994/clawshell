import { ref, readonly } from 'vue'

const connected = ref(false)
const connecting = ref(false)
const hello = ref(null)

const DEFAULT_REQUEST_TIMEOUT_MS = 30000
const CONNECT_REQUEST_TIMEOUT_MS = 10000

let ws = null
let pending = new Map()
let eventListeners = new Map()
let closed = false
let backoffMs = 800
let reconnectTimer = null
let connectSent = false
let currentPort = 0
let currentToken = ''
let currentRemoteUrl = ''

function generateId() {
  return crypto.randomUUID()
}

class GatewayRequestError extends Error {
  constructor(message, details = {}) {
    super(message)
    this.name = 'GatewayRequestError'
    this.code = details.code || null
    this.method = details.method || null
    this.details = details.details || null
  }
}

function createGatewayError(method, error) {
  if (error instanceof Error) return error
  if (error && typeof error === 'object') {
    return new GatewayRequestError(error.message || 'Request failed', {
      method,
      code: error.code,
      details: error.details,
    })
  }
  return new GatewayRequestError(String(error || 'Request failed'), { method })
}

function cleanupPendingEntry(id) {
  const entry = pending.get(id)
  if (!entry) return null
  if (entry.timeoutId) clearTimeout(entry.timeoutId)
  pending.delete(id)
  return entry
}

function wsRequest(method, params, options = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error('Gateway not connected'))
  }
  const id = generateId()
  ws.send(JSON.stringify({ type: 'req', id, method, params }))
  return new Promise((resolve, reject) => {
    const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    const timeoutId = timeoutMs > 0
      ? setTimeout(() => {
          const entry = cleanupPendingEntry(id)
          if (!entry) return
          entry.reject(new GatewayRequestError(`Gateway request timed out: ${method}`, {
            method,
            code: 'REQUEST_TIMEOUT',
            details: { timeoutMs },
          }))
        }, timeoutMs)
      : null
    pending.set(id, { resolve, reject, method, timeoutId })
  })
}

function sendConnect() {
  if (connectSent) return
  connectSent = true
  console.log('[gw] sending connect frame...')

  wsRequest('connect', {
    minProtocol: 3,
    maxProtocol: 4,
    client: {
      id: 'openclaw-control-ui',
      displayName: 'ClawShell',
      version: '1.0.0',
      platform: navigator.platform || 'unknown',
      mode: 'webchat',
    },
    role: 'operator',
    scopes: ['operator.read', 'operator.write', 'operator.admin'],
    auth: currentToken ? { token: currentToken } : undefined,
    caps: ['tool-events'],
    userAgent: 'ClawShell/1.0.0',
    locale: navigator.language || 'zh-CN',
  }, {
    timeoutMs: CONNECT_REQUEST_TIMEOUT_MS,
  })
    .then((payload) => {
      console.log('[gw] connected ok')
      hello.value = payload
      connected.value = true
      connecting.value = false
      backoffMs = 800
    })
    .catch((err) => {
      console.error('[gw] connect failed:', err)
      ws?.close(4008, 'connect failed')
    })
}

function handleWsMessage(raw) {
  let frame
  try { frame = JSON.parse(raw) } catch { return }

  if (frame.type === 'event') {
    if (frame.event === 'connect.challenge') {
      console.log('[gw] got challenge, sending connect')
      setTimeout(() => sendConnect(), 100)
      return
    }
    if (frame.event === 'chat') {
      console.log('[gw] chat event:', frame.payload?.state, 'runId:', frame.payload?.runId?.substring(0, 8), 'sk:', frame.payload?.sessionKey)
    }
    const listeners = eventListeners.get(frame.event)
    if (!listeners) {
      console.log('[gw] no listeners for event:', frame.event)
    }
    if (listeners) {
      for (const cb of listeners) {
        try { cb(frame.payload) } catch (e) { console.error('[gw] event error:', e) }
      }
    }
    return
  }

  if (frame.type === 'res') {
    const entry = cleanupPendingEntry(frame.id)
    if (entry) {
      if (frame.ok) {
        entry.resolve(frame.payload)
      } else {
        entry.reject(createGatewayError(entry.method, frame.error))
      }
    }
  }
}

function flushPending(err) {
  for (const [id, p] of pending) {
    cleanupPendingEntry(id)
    p.reject(err)
  }
  pending.clear()
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function scheduleReconnect() {
  if (closed) return
  const delay = backoffMs
  backoffMs = Math.min(backoffMs * 1.7, 15000)
  clearReconnectTimer()
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    doConnect()
  }, delay)
}

function doConnect() {
  if (closed) return
  connecting.value = true
  connectSent = false

  const url = currentRemoteUrl
    ? currentRemoteUrl.replace(/^http/, 'ws') + '/'
    : `ws://127.0.0.1:${currentPort}/`
  console.log('[gw] connecting to', url)
  ws = new WebSocket(url)

  ws.addEventListener('open', () => {
    console.log('[gw] ws open, waiting for challenge...')
    setTimeout(() => {
      if (!connectSent) {
        console.log('[gw] no challenge, sending connect anyway')
        sendConnect()
      }
    }, 500)
  })

  ws.addEventListener('message', (ev) => {
    handleWsMessage(String(ev.data || ''))
  })

  ws.addEventListener('close', (ev) => {
    console.log('[gw] ws close:', ev.code, ev.reason)
    ws = null
    connected.value = false
    connecting.value = false
    flushPending(new Error('Gateway disconnected'))
    scheduleReconnect()
  })

  ws.addEventListener('error', (ev) => {
    console.error('[gw] ws error')
  })
}

function connect(port, token, remoteUrl) {
  // Idempotent: skip if already connected with same params
  if (connected.value && currentPort === port && currentToken === (token || '') && currentRemoteUrl === (remoteUrl || '')) {
    return
  }
  disconnect()
  closed = false
  currentPort = port
  currentToken = token || ''
  currentRemoteUrl = remoteUrl || ''
  backoffMs = 800
  doConnect()
}

function disconnect() {
  closed = true
  clearReconnectTimer()
  if (ws) { ws.close(); ws = null }
  flushPending(new Error('Client stopped'))
  connected.value = false
  connecting.value = false
}

function request(method, params, options) {
  return wsRequest(method, params, options)
}

function onEvent(eventName, callback) {
  if (!eventListeners.has(eventName)) {
    eventListeners.set(eventName, new Set())
  }
  eventListeners.get(eventName).add(callback)
  return () => {
    const listeners = eventListeners.get(eventName)
    if (listeners) {
      listeners.delete(callback)
      if (listeners.size === 0) eventListeners.delete(eventName)
    }
  }
}

export function useGatewayClient() {
  return {
    connected: readonly(connected),
    connecting: readonly(connecting),
    hello: readonly(hello),
    connect,
    disconnect,
    request,
    onEvent,
  }
}
