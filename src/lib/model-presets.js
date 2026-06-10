export function createModelPresets(t) {
  return [
    { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', tags: [t('models.tagRecommend'), t('models.tagDomestic'), t('models.tagCheap')], link: 'https://platform.deepseek.com/' },
    { id: 'xai', name: 'Grok', baseUrl: 'https://api.x.ai/v1', model: 'grok-4.3', tags: [t('models.tagRecommend'), t('models.tagPowerful')], link: 'https://console.x.ai/' },
    { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', tags: [t('models.tagPowerful')], link: 'https://platform.openai.com/' },
    { id: 'anthropic', name: 'Claude', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-sonnet-4-20250514', tags: [t('models.tagPowerful')], link: 'https://console.anthropic.com/' },
    { id: 'gemini', name: 'Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-3.5-flash', tags: [t('models.tagPowerful'), t('models.tagFast')], link: 'https://aistudio.google.com/apikey' },
    { id: 'qwen', name: 'Qwen', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-turbo', tags: [t('models.tagDomestic'), t('models.tagFree')], link: 'https://dashscope.console.aliyun.com/' },
    { id: 'kimi', name: 'Kimi', baseUrl: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-auto', tags: [t('models.tagDomestic'), t('models.tagFast')], link: 'https://platform.moonshot.cn/' },
    { id: 'zai', name: 'GLM', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-5', tags: [t('models.tagDomestic'), t('models.tagFree')], link: 'https://open.bigmodel.cn/', isZai: true },
    { id: 'doubao', name: 'Doubao', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-1.5-pro-32k', tags: [t('models.tagDomestic'), t('models.tagFast')], link: 'https://console.volcengine.com/ark' },
    { id: 'minimax', name: 'MiniMax', baseUrl: 'https://api.minimax.io/v1', model: 'MiniMax-M3', tags: [t('models.tagRecommend'), t('models.tagDomestic')], link: 'https://platform.minimaxi.com/' },
    { id: 'xiaomi', name: 'MiMo', baseUrl: 'https://api.xiaomimimo.com/v1', model: 'mimo-v2-flash', tags: [t('models.tagDomestic'), t('models.tagFast')], link: 'https://api.xiaomimimo.com/' },
    { id: 'mistral', name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-large-latest', tags: [t('models.tagPowerful')], link: 'https://console.mistral.ai/' },
    { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openrouter/auto', tags: [t('models.tagCompatible')], link: 'https://openrouter.ai/keys' },
    { id: 'together', name: 'Together AI', baseUrl: 'https://api.together.ai/v1', model: 'openai/gpt-oss-20b', tags: [t('models.tagCompatible'), t('models.tagFast')], link: 'https://api.together.ai/settings/api-keys' },
    { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', tags: [t('models.tagVeryFast'), t('models.tagFree')], link: 'https://console.groq.com/' },
    { id: 'siliconflow', name: 'SiliconFlow', baseUrl: 'https://api.siliconflow.cn/v1', model: 'Qwen/Qwen2.5-72B-Instruct', tags: [t('models.tagDomestic'), t('models.tagCheap')], link: 'https://cloud.siliconflow.cn/' },
    { id: 'qianfan', name: 'Qianfan', baseUrl: 'https://qianfan.baidubce.com/v2', model: 'deepseek-v3.2', tags: [t('models.tagDomestic'), t('models.tagPowerful')], link: 'https://console.bce.baidu.com/qianfan/ais/console/applicationConsole/application' },
    { id: 'stepfun', name: 'StepFun', baseUrl: 'https://api.stepfun.com/v1', model: 'step-3.5-flash', tags: [t('models.tagDomestic'), t('models.tagFast')], link: 'https://platform.stepfun.com/' },
    { id: 'custom', name: t('models.custom'), baseUrl: '', model: '', tags: [t('models.tagCompatible')], link: '', isCustom: true },
  ];
}

export function createModelTagMap(t) {
  return {
    [t('models.tagRecommend')]: 'hot',
    [t('models.tagDomestic')]: 'cn',
    [t('models.tagFree')]: 'free',
    [t('models.tagFast')]: 'fast',
    [t('models.tagVeryFast')]: 'fast',
    [t('models.tagCheap')]: 'cheap',
    [t('models.tagPowerful')]: 'hot',
    [t('models.tagCompatible')]: '',
  };
}
