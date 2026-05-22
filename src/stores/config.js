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
      await ipc.saveConfig(partial)
      await load()
      return { ok: true }
    } catch (err) {
      console.error('Failed to save config:', err)
      return { ok: false, error: err.message }
    }
  }

  function hasPrimaryModel(cfg) {
    return !!cfg.agents?.defaults?.model?.primary
  }

  async function saveModelConfig(provider, baseUrl, modelId, apiKey, providerModels) {
    try {
      const cfg = await ipc.getConfig()

      if (provider === 'zai') {
        if (!cfg.env) cfg.env = {}
        cfg.env.ZAI_API_KEY = apiKey
        if (!hasPrimaryModel(cfg)) {
          if (!cfg.agents) cfg.agents = {}
          if (!cfg.agents.defaults) cfg.agents.defaults = {}
          if (!cfg.agents.defaults.model) cfg.agents.defaults.model = {}
          cfg.agents.defaults.model.primary = 'zai/' + modelId
        }
      } else {
        if (!cfg.models) cfg.models = {}
        cfg.models.mode = 'merge'
        if (!cfg.models.providers) cfg.models.providers = {}
        const modelsArray = (Array.isArray(providerModels) && providerModels.length > 0)
          ? providerModels
          : [{ id: modelId, name: modelId, reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8192 }]
        cfg.models.providers[provider] = {
          baseUrl,
          apiKey,
          api: 'openai-completions',
          models: modelsArray,
        }
        if (!hasPrimaryModel(cfg)) {
          if (!cfg.agents) cfg.agents = {}
          if (!cfg.agents.defaults) cfg.agents.defaults = {}
          if (!cfg.agents.defaults.model) cfg.agents.defaults.model = {}
          cfg.agents.defaults.model.primary = provider + '/' + modelId
        }
      }

      await ipc.saveConfig(cfg)
      await load()
      return { ok: true }
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
      await ipc.saveConfig(cfg)
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
      await ipc.saveConfig(cfg)
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
      await ipc.saveConfig(cfg)
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
      await ipc.saveConfig(cfg)
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
      await ipc.saveConfig(cfg)
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
      await ipc.saveConfig(cfg)
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
      await ipc.saveConfig(cfg)
      await load()
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  }

  return { config, providers, agents, channels, clawshell, load, save, saveModelConfig, setPrimaryModel, saveAgentConfig, deleteAgentConfig, saveChannelConfig, deleteChannelConfig, saveBindings, saveSkillEntry }
})
