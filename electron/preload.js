/**
 * ClawShell (虾壳) — Electron 预加载脚本（Preload）
 *
 * 安全说明：
 *   - contextIsolation: true → 渲染进程无法直接访问 Node.js / Electron API
 *   - nodeIntegration: false → 渲染进程无法 require() 任何模块
 *   - 所有跨进程通信只能通过此文件暴露的 window.clawshell 方法进行
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('clawshell', {

  // ── Gateway 网关管理 ──

  getGatewayStatus: () => ipcRenderer.invoke('get-gateway-status'),
  restartGateway: () => ipcRenderer.invoke('restart-gateway'),
  stopGateway: () => ipcRenderer.invoke('stop-gateway'),

  // ── 配置文件读写 ──

  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (cfg) => ipcRenderer.invoke('save-config', cfg),

  // ── 诊断与修复 ──

  diagnose: () => ipcRenderer.invoke('diagnose'),
  repair: (id) => ipcRenderer.invoke('repair', id),
  doctorFix: () => ipcRenderer.invoke('doctor-fix'),

  // ── SkillHub 技能商店 ──

  fetchSkillCategories: () => ipcRenderer.invoke('fetch-skill-categories'),
  fetchSkillSubcategories: (l1Id) => ipcRenderer.invoke('fetch-skill-subcategories', l1Id),
  fetchSkills: (params) => ipcRenderer.invoke('fetch-skills', params),
  searchSkills: (params) => ipcRenderer.invoke('search-skills', params),
  installSkill: (slug, target) => ipcRenderer.invoke('install-skill', slug, target),
  uninstallSkill: (slug, target) => ipcRenderer.invoke('uninstall-skill', slug, target),
  listInstalledSkills: (target) => ipcRenderer.invoke('list-installed-skills', target),
  readSkillFile: (slug, filename, target) => ipcRenderer.invoke('read-skill-file', slug, filename, target),

  // ── 模型供应商 API ──
  fetchProviderModels: (baseUrl, apiKey) => ipcRenderer.invoke('fetch-provider-models', baseUrl, apiKey),

  // ── 本地文件打开 ──

  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),
  readFileAsDataUrl: (filePath) => ipcRenderer.invoke('read-file-as-data-url', filePath),

  // ── Agent 文件读写 ──
  readAgentFile: (agentId, filename) => ipcRenderer.invoke('read-agent-file', agentId, filename),
  writeAgentFile: (agentId, filename, content) => ipcRenderer.invoke('write-agent-file', agentId, filename, content),
  deleteAgent: (agentId) => ipcRenderer.invoke('delete-agent', agentId),

  // ── 渠道插件安装 ──
  installChannelPlugin: (spec) => ipcRenderer.invoke('install-channel-plugin', spec),

  // ── 头像上传 ──
  pickAvatarImage: () => ipcRenderer.invoke('pick-avatar-image'),

  // ── 设置相关 ──
  exportConfig: () => ipcRenderer.invoke('export-config'),
  importConfig: () => ipcRenderer.invoke('import-config'),
  resetConfig: () => ipcRenderer.invoke('reset-config'),
  openDataDir: () => ipcRenderer.invoke('open-data-dir'),
  openLogsDir: () => ipcRenderer.invoke('open-logs-dir'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // ── OpenClaw 核心版本管理 ──
  hasOpenClawCore: () => ipcRenderer.invoke('has-openclaw-core'),
  installOpenClawCore: (version) => ipcRenderer.invoke('install-openclaw-core', version),
  listOpenClawVersions: () => ipcRenderer.invoke('list-openclaw-versions'),
  switchOpenClawVersion: (version) => ipcRenderer.invoke('switch-openclaw-version', version),
  deleteOpenClawVersion: (version) => ipcRenderer.invoke('delete-openclaw-version', version),
  upgradeOpenClaw: (version) => ipcRenderer.invoke('upgrade-openclaw', version),
  getOpenClawAvailableVersions: () => ipcRenderer.invoke('get-openclaw-available-versions'),

  onCoreInstallProgress: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('core-install-progress', handler);
    return () => ipcRenderer.removeListener('core-install-progress', handler);
  },

  // ── 连接模式 ──
  saveConnection: (connection) => ipcRenderer.invoke('save-connection', connection),
  setupComplete: () => ipcRenderer.invoke('setup-complete'),
  saveAgentWorkspace: (agentData) => ipcRenderer.invoke('save-agent-workspace', agentData),

  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),

  // ── 窗口控制 ──
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),

  // ── 事件监听（主进程 → 渲染进程推送） ──

  onGatewayStatusChanged: (callback) => {
    ipcRenderer.on('gateway-status-changed', (_, data) => callback(data));
  },
  onGatewayRestarted: (callback) => {
    ipcRenderer.on('gateway-restarted', (_, data) => callback(data));
  },
  onGatewayRestarting: (callback) => {
    ipcRenderer.on('gateway-restarting', (_, data) => callback(data));
  },
  onGatewayError: (callback) => {
    ipcRenderer.on('gateway-error', (_, data) => callback(data));
  },
  onPluginInstallOutput: (callback) => {
    const handler = (_, data) => callback(data);
    ipcRenderer.on('plugin-install-output', handler);
    return () => ipcRenderer.removeListener('plugin-install-output', handler);
  },
});
