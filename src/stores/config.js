import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ipc } from '@/lib/ipc'

export const useConfigStore = defineStore('config', () => {
  const config = ref(null)
  const providers = ref({})
  const agents = ref({})
  const channels = ref({})
  const clawshell = ref({
    ui: { theme: 'dark', language: 'zh-CN' },
    auth: { requireLogin: false },
    chat: { defaultAssistant: '', sendKey: 'ctrl+enter' },
  })

  async function load() {
    try {
      const data = await ipc.getConfig()
      config.value = data
      providers.value = data.models?.providers || {}
      agents.value = data.agents || {}
      channels.value = data.channels || {}
      clawshell.value = data.clawshell || clawshell.value
    } catch (err) {
      console.error('Failed to load config:', err)
    }
  }

  async function save(partial) {
    try {
      await persistConfig(partial)
      await load()
      return { ok: true }
    } catch (err) {
      console.error('Failed to save config:', err)
      return { ok: false, error: err.message }
    }
  }

  async function persistConfig(nextConfig) {
    const result = await ipc.saveConfig(nextConfig)
    if (result?.ok === false) {
      throw new Error(result.error || 'Config save failed')
    }
    return result
  }

  const KNOWN_MODEL_METADATA = {
    deepseek: {
      'deepseek-v4-flash': {
        name: 'DeepSeek V4 Flash',
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 384000,
        cost: { input: 0.14, output: 0.28, cacheRead: 0.028, cacheWrite: 0 },
        compat: { supportsUsageInStreaming: true, supportsReasoningEffort: true, maxTokensField: 'max_tokens' },
      },
      'deepseek-v4-pro': {
        name: 'DeepSeek V4 Pro',
        reasoning: true,
        contextWindow: 1000000,
        maxTokens: 384000,
        cost: { input: 1.74, output: 3.48, cacheRead: 0.145, cacheWrite: 0 },
        compat: { supportsUsageInStreaming: true, supportsReasoningEffort: true, maxTokensField: 'max_tokens' },
      },
      'deepseek-reasoner': {
        name: 'DeepSeek Reasoner',
        reasoning: true,
        contextWindow: 131072,
        maxTokens: 65536,
        cost: { input: 0.28, output: 0.42, cacheRead: 0.028, cacheWrite: 0 },
        compat: { supportsUsageInStreaming: true, supportsReasoningEffort: false, maxTokensField: 'max_tokens' },
      },
    },
  }

  function applyKnownModelMetadata(provider, model) {
    const patch = KNOWN_MODEL_METADATA[provider]?.[model.id]
    return patch ? { ...model, ...patch, id: model.id } : model
  }

  function normalizeProviderModelList(response, provider) {
    const rawList = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response?.models)
        ? response.models
        : Array.isArray(response)
          ? response
          : []
    return rawList
      .map(item => {
        const id = typeof item === 'string' ? item : item?.id || item?.name
        if (!id) return null
        if (typeof item === 'string') {
          return applyKnownModelMetadata(provider, {
            id,
            name: id,
            reasoning: false,
            input: ['text'],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 128000,
            maxTokens: 8192,
          })
        }
        return applyKnownModelMetadata(provider, {
          id,
          name: item.name || id,
          reasoning: item.reasoning ?? false,
          input: Array.isArray(item.input) ? item.input : ['text'],
          cost: item.cost || { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
          contextWindow: item.contextWindow || item.context_window || item.context_length || 128000,
          maxTokens: item.maxTokens || item.max_tokens || 8192,
        })
      })
      .filter(Boolean)
      .slice(0, 100)
  }

  async function fetchProviderModelList(baseUrl, apiKey, apiType, provider = '') {
    const url = String(baseUrl || '').trim()
    if (!url) throw new Error('Model list base URL is required')
    const response = await ipc.fetchProviderModels(url, apiKey, apiType)
    if (response?.error) throw new Error(response.error)
    const models = normalizeProviderModelList(response, provider)
    if (models.length === 0) throw new Error('Model list API returned no models')
    return models
  }

  async function saveModelConfig(provider, baseUrl, modelId, apiKey, providerModels, apiType) {
    try {
      if (typeof ipc.saveModelConfig !== 'function') {
        throw new Error('Model config IPC is unavailable. Restart Electron to load the latest preload script.')
      }

      const result = await ipc.saveModelConfig({ provider, baseUrl, modelId, apiKey, providerModels, apiType })
      if (result?.ok === false) {
        throw new Error(result.error || 'Model config save failed')
      }
      await load()
      return { ok: true, configPath: result?.configPath }
    } catch (err) {
      console.error('Failed to save model config:', err)
      return { ok: false, error: err.message }
    }
  }

  async function setPrimaryModel(primary) {
    try {
      const cfg = await ipc.getConfig()
      if (!cfg.agents) cfg.agents = {}
      if (!cfg.agents.defaults) cfg.agents.defaults = {}
      if (!cfg.agents.defaults.model) cfg.agents.defaults.model = {}
      cfg.agents.defaults.model.primary = primary
      await persistConfig(cfg)
      await load()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  async function saveAgentConfig(agentId, name, model, avatar) {
    try {
      const cfg = await ipc.getConfig()
      if (!cfg.agents) cfg.agents = {}
      if (!cfg.agents.list) cfg.agents.list = []
      const existing = cfg.agents.list.find(a => a.id === agentId)
      if (existing) {
        existing.name = name
        if (model) existing.model = model
        if (avatar) {
          if (!existing.identity) existing.identity = {}
          existing.identity.avatar = avatar
        }
      } else {
        const entry = { id: agentId, name }
        if (model) entry.model = model
        if (avatar) entry.identity = { avatar }
        cfg.agents.list.push(entry)
      }
      await persistConfig(cfg)
      await load()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  async function deleteAgentConfig(agentId) {
    try {
      const cfg = await ipc.getConfig()
      if (cfg.agents?.list) {
        cfg.agents.list = cfg.agents.list.filter(a => a.id !== agentId)
      }
      await persistConfig(cfg)
      await load()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  async function saveChannelConfig(channelId, channelData) {
    try {
      const cfg = await ipc.getConfig()
      if (!cfg.channels) cfg.channels = {}
      cfg.channels[channelId] = channelData
      await persistConfig(cfg)
      await load()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  async function deleteChannelConfig(channelId) {
    try {
      const cfg = await ipc.getConfig()
      if (cfg.channels) {
        delete cfg.channels[channelId]
      }
      if (cfg.bindings) {
        cfg.bindings = cfg.bindings.filter(b => b.match?.channel !== channelId)
      }
      await persistConfig(cfg)
      await load()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  async function saveBindings(bindings) {
    try {
      const cfg = await ipc.getConfig()
      cfg.bindings = bindings
      await persistConfig(cfg)
      await load()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  async function saveSkillEntry(slug, enabled) {
    try {
      const cfg = await ipc.getConfig()
      if (!cfg.skills) cfg.skills = {}
      if (!cfg.skills.entries) cfg.skills.entries = {}
      cfg.skills.entries[slug] = { enabled }
      await persistConfig(cfg)
      await load()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  return { config, providers, agents, channels, clawshell, load, save, fetchProviderModelList, saveModelConfig, setPrimaryModel, saveAgentConfig, deleteAgentConfig, saveChannelConfig, deleteChannelConfig, saveBindings, saveSkillEntry }
})
