import { ref, readonly } from 'vue'

const connected = ref(false)
const connecting = ref(false)
const hello = ref(null)

let ws = null
let pending = new Map()
let eventListeners = new Map()
let closed = false
let backoffMs = 800
let reconnectTimer = null
let connectSent = false
let currentPort = 0
let currentToken = ''

function generateId() {
  return crypto.randomUUID()
}

function wsRequest(method, params) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return Promise.reject(new Error('Gateway not connected'))
  }
  const id = generateId()
  ws.send(JSON.stringify({ type: 'req', id, method, params }))
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
  })
}

function sendConnect() {
  if (connectSent) return
  connectSent = true
  console.log('[gw] sending connect frame...')

  wsRequest('connect', {
    minProtocol: 3,
    maxProtocol: 3,
    client: {
      id: 'openclaw-control-ui',
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
    const entry = pending.get(frame.id)
    if (entry) {
      pending.delete(frame.id)
      if (frame.ok) {
        entry.resolve(frame.payload)
      } else {
        entry.reject(new Error(frame.error?.message || 'Request failed'))
      }
    }
  }
}

function flushPending(err) {
  for (const [, p] of pending) p.reject(err)
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

  const url = `ws://127.0.0.1:${currentPort}/`
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

function connect(port, token) {
  disconnect()
  closed = false
  currentPort = port
  currentToken = token || ''
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

function request(method, params) {
  return wsRequest(method, params)
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
