import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ipc } from '@/lib/ipc'

export const useGatewayStore = defineStore('gateway', () => {
  const ready = ref(false)
  const port = ref(0)
  const token = ref('')
  const hasModel = ref(false)
  const status = ref('starting') // starting | ready | disconnected | error
  const restarting = ref(false)
  const mode = ref('local') // 'local' | 'remote'
  const remoteUrl = ref('')
  const setupDone = ref(false)

  async function refresh() {
    try {
      const data = await ipc.getGatewayStatus()
      ready.value = data.ready
      port.value = data.port
      token.value = data.token
      hasModel.value = data.hasModel
      mode.value = data.mode || 'local'
      remoteUrl.value = data.remoteUrl || ''
      setupDone.value = data.setupDone || false
      if (data.ready) {
        status.value = 'ready'
        restarting.value = false
      } else if (status.value === 'starting') {
        status.value = 'starting'
      } else {
        status.value = 'disconnected'
      }
    } catch {
      status.value = 'error'
    }
  }

  function setStatus(newStatus) {
    status.value = newStatus
  }

  return { ready, port, token, hasModel, status, restarting, mode, remoteUrl, setupDone, refresh, setStatus }
})
