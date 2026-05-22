/**
 * ClawShell (虾壳) — Electron 主进程
 *
 * 职责：
 *   1. 管理 OpenClaw Gateway 子进程的生命周期（启动 / 停止 / 重启 / 崩溃恢复）
 *   2. 读写 ~/.openclaw/openclaw.json 配置文件
 *   3. 提供 IPC 接口，供渲染进程（Vue 前端）调用
 *   4. 代理 SkillHub API 请求（技能商店）
 *   5. 创建并管理应用主窗口
 *
 * 注意：WebSocket 连接由渲染进程直接建立，不走主进程中转
 */

const { app, BrowserWindow, Tray, shell, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const net = require('net');
const AdmZip = require('adm-zip');

// ═══════════════════════════════════════════
// 常量定义
// ═══════════════════════════════════════════

const APP_NAME = 'ClawShell';
const DEFAULT_PORT = 18789;
const MAX_PORT = 18799;
const STARTUP_TIMEOUT = 120000;
const RESTART_DELAY = 3000;
const MAX_CRASH_COUNT = 3;

// ═══════════════════════════════════════════
// 全局状态变量
// ═══════════════════════════════════════════

let mainWindow = null;
let gatewayProcess = null;
let gatewayPort = DEFAULT_PORT;
let gatewayReady = false;
let isRestarting = false;
let crashCount = 0;
let healthCheckTimer = null;

// ═══════════════════════════════════════════
// 路径计算
// ═══════════════════════════════════════════

const isDev = process.argv.includes('--dev');
const userDataPath = app.getPath('userData');
const configDir = path.join(userDataPath, '.openclaw');
const configPath = path.join(configDir, 'openclaw.json');
const settingsPath = path.join(configDir, 'clawshell-settings.json');
console.log("__dirname", __dirname);
const openclawPath = 'E:\\temp\\cpp\\mclaw\\node_modules\\openclaw';
const openclawEntry = path.join(openclawPath, 'openclaw.mjs');
console.log("openclawEntry", openclawEntry);

// ═══════════════════════════════════════════════════════════════
// 1. 独立 Node.js 运行时
// ═══════════════════════════════════════════════════════════════
function getNodeBin() {
  const platform = process.platform;
  const arch = process.arch;
  const nodeDir = isDev
    ? path.join(__dirname, '..', 'resources', 'runtime', `node-${platform}-${arch}`)
    : path.join(process.resourcesPath, 'resources', 'runtime', `node-${platform}-${arch}`);
  const nodeBin = platform === 'win32'
    ? path.join(nodeDir, 'node.exe')
    : path.join(nodeDir, 'bin', 'node');
  if (fs.existsSync(nodeBin)) return nodeBin;
  return 'node';
}

// ═══════════════════════════════════════════════════════════════
// 2. openclaw.json 配置文件读写
// ═══════════════════════════════════════════════════════════════

function ensureConfig() {
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(path.join(userDataPath, 'memory'), { recursive: true });
  fs.mkdirSync(path.join(userDataPath, 'backups'), { recursive: true });
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      gateway: { mode: 'local', auth: { token: 'clawshell' } },
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(`[${APP_NAME}] Created default config at ${configPath}`);
  }
}

function getConfig() {
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return { gateway: { mode: 'local', auth: { token: 'clawshell' } } };
  }
}

function saveConfig(config) {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getSettings() {
  try {
    return JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  } catch {
    return {};
  }
}

function saveSettings(settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
}

function hasModelConfigured() {
  const config = getConfig();
  if (config.agents?.defaults?.model?.primary) return true;
  if (config.env && Object.keys(config.env).some(k => k.includes('API_KEY'))) return true;
  if (config.models?.providers && Object.keys(config.models.providers).length > 0) return true;
  if (config.agent?.model) return true;
  return false;
}

function getToken() {
  const config = getConfig();
  return config?.gateway?.auth?.token || 'clawshell';
}

// ═══════════════════════════════════════════════════════════════
// 3. 端口检测
// ═══════════════════════════════════════════════════════════════

function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort() {
  for (let port = DEFAULT_PORT; port <= MAX_PORT; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port in range ${DEFAULT_PORT}-${MAX_PORT}`);
}

// ═══════════════════════════════════════════════════════════════
// 4. 启动 Gateway 子进程
// ═══════════════════════════════════════════════════════════════

function startGateway(port) {
  return new Promise((resolve, reject) => {
    console.log(`[${APP_NAME}] Starting OpenClaw gateway on port ${port}...`);
    const nodeBin = getNodeBin();
    console.log(`[${APP_NAME}] Using Node.js: ${nodeBin}`);

    const env = {
      ...process.env,
      OPENCLAW_HOME: userDataPath,
      OPENCLAW_STATE_DIR: configDir,
      OPENCLAW_CONFIG_PATH: configPath,
      OPENCLAW_EMBEDDED_IN: APP_NAME,
    };

    gatewayProcess = spawn(nodeBin, [
      openclawEntry,
      'gateway', 'run',
      '--allow-unconfigured',
      '--force',
      '--port', String(port),
    ], {
      env,
      cwd: openclawPath,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    gatewayProcess.stdout.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.log(`[OpenClaw] ${msg}`);
    });

    gatewayProcess.stderr.on('data', (data) => {
      const msg = data.toString().trim();
      if (msg) console.error(`[OpenClaw:err] ${msg}`);
    });

    gatewayProcess.on('error', (err) => {
      console.error(`[${APP_NAME}] Gateway process error:`, err);
      reject(err);
    });

    gatewayProcess.on('exit', (code) => {
      console.log(`[${APP_NAME}] Gateway exited with code ${code}`);
      gatewayProcess = null;
      gatewayReady = false;
      if (!isRestarting && code !== 0) {
        handleGatewayCrash();
      }
    });

    let resolved = false;
    let checkTimer = null;
    const startTime = Date.now();
    const checkReady = () => {
      if (resolved) return;
      if (Date.now() - startTime > STARTUP_TIMEOUT) {
        resolved = true;
        reject(new Error('Gateway startup timeout'));
        return;
      }
      const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
        if (resolved) return;
        resolved = true;
        gatewayReady = true;
        gatewayPort = port;
        crashCount = 0;
        console.log(`[${APP_NAME}] Gateway ready on port ${port}`);
        startHealthCheck();
        resolve(port);
      });
      req.on('error', () => {
        if (resolved) return;
        req.destroy();
        checkTimer = setTimeout(checkReady, 1000);
      });
      req.setTimeout(3000, () => {
        if (resolved) return;
        req.destroy();
      });
    };
    setTimeout(checkReady, 1000);
  });
}

// ═══════════════════════════════════════════════════════════════
// 5. 停止 Gateway
// ═══════════════════════════════════════════════════════════════
function stopGateway() {
  return new Promise((resolve) => {
    stopHealthCheck();
    if (!gatewayProcess) { resolve(); return; }

    console.log(`[${APP_NAME}] Stopping gateway...`);
    const proc = gatewayProcess;
    let exited = false;

    const onExit = () => {
      if (exited) return;
      exited = true;
      resolve();
    };

    proc.on('exit', onExit);
    proc.kill('SIGTERM');

    setTimeout(() => {
      if (!exited && proc) {
        console.log(`[${APP_NAME}] Force killing gateway...`);
        proc.kill('SIGKILL');
      }
      // Resolve anyway after SIGKILL grace period
      setTimeout(onExit, 1000);
    }, 5000);
  });
}

// ═══════════════════════════════════════════════════════════════
// 6. 重启 Gateway
// ═══════════════════════════════════════════════════════════════

async function restartGateway() {
  if (isRestarting) return { ok: false, error: 'already restarting' };
  isRestarting = true;
  try {
    console.log(`[${APP_NAME}] Restarting gateway...`);
    await stopGateway();
    gatewayReady = false;
    await new Promise(r => setTimeout(r, 500));
    const port = await findAvailablePort();
    await startGateway(port);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('gateway-restarted', { port, ready: true });
    }
    return { ok: true, port };
  } catch (err) {
    console.error(`[${APP_NAME}] Restart failed:`, err);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('gateway-error', { message: err.message });
    }
    return { ok: false, error: err.message };
  } finally {
    isRestarting = false;
  }
}

// ═══════════════════════════════════════════════════════════════
// 7. 崩溃自动重启
// ═══════════════════════════════════════════════════════════════
async function handleGatewayCrash() {
  crashCount++;
  console.log(`[${APP_NAME}] Gateway crashed (count: ${crashCount}/${MAX_CRASH_COUNT})`);
  if (crashCount >= MAX_CRASH_COUNT) {
    console.error(`[${APP_NAME}] Gateway crashed ${crashCount} times, stopping auto-restart`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('gateway-error', {
        message: `网关连续崩溃 ${crashCount} 次，已停止自动重启，请使用「一键修复」排查问题`,
      });
    }
    return;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('gateway-restarting', { attempt: crashCount });
  }
  await new Promise(r => setTimeout(r, RESTART_DELAY));
  try {
    const port = await findAvailablePort();
    await startGateway(port);
    console.log(`[${APP_NAME}] Gateway auto-restarted on port ${port}`);
  } catch (err) {
    console.error(`[${APP_NAME}] Auto-restart failed:`, err);
  }
}

// ═══════════════════════════════════════════════════════════════
// 8. 健康检查
// ═══════════════════════════════════════════════════════════════
function startHealthCheck() {
  stopHealthCheck();
  healthCheckTimer = setInterval(async () => {
    if (!gatewayProcess || isRestarting) return;
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${gatewayPort}/`, (res) => {
          if (!gatewayReady) {
            gatewayReady = true;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('gateway-status-changed', { ready: true, port: gatewayPort });
            }
          }
          resolve();
        });
        req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')); });
        req.on('error', reject);
      });
    } catch {
      if (gatewayReady) {
        gatewayReady = false;
        console.log(`[${APP_NAME}] Gateway health check failed`);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('gateway-status-changed', { ready: false });
        }
      }
    }
  }, 30000);
}

function stopHealthCheck() {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 9. SkillHub API 代理
// ═══════════════════════════════════════════════════════════════

function fetchFromSkillHub(apiPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(apiPath, 'https://api.skillhub.cn');
    const req = https.get(url.toString(), (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON from SkillHub')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('SkillHub request timeout')); });
  });
}

// const SKILL_API_HOST = 'http://localhost:8001';
const SKILL_API_HOST = 'http://124.221.154.36';
// SKILL_API_URL = ""
SKILL_API_URL = "/api/clawshell"

function fetchFromSkillApi(apiPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(SKILL_API_URL + apiPath, SKILL_API_HOST);
    const client = url.protocol === 'https:' ? https : http;
    const req = client.get(url.toString(), (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 400) {
          return reject(new Error(`Skill API ${res.statusCode}: ${data.slice(0, 200)}`));
        }
        try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON from Skill API')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Skill API request timeout')); });
  });
}

function downloadToFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close();
        fs.unlinkSync(destPath);
        return downloadToFile(res.headers.location, destPath).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        fs.unlinkSync(destPath);
        return reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (err) => {
      file.close();
      fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

// ═══════════════════════════════════════════════════════════════
// 10. Gateway 配置保障
//     确保 control-ui 客户端免设备认证、允许渲染进程直连
// ═══════════════════════════════════════════════════════════════

function ensureDeviceAuthDisabled() {
  try {
    const config = getConfig();
    let dirty = false;

    if (config.gateway?.controlUi?.dangerouslyDisableDeviceAuth !== true) {
      if (!config.gateway) config.gateway = {};
      if (!config.gateway.controlUi) config.gateway.controlUi = {};
      config.gateway.controlUi.dangerouslyDisableDeviceAuth = true;
      dirty = true;
      console.log(`[${APP_NAME}] Set gateway.controlUi.dangerouslyDisableDeviceAuth = true`);
    }

    // 允许渲染进程的 origin 直连 gateway
    const devOrigin = 'http://localhost:5173';
    const origins = config.gateway?.controlUi?.allowedOrigins || [];
    if (!origins.includes(devOrigin)) {
      if (!config.gateway) config.gateway = {};
      if (!config.gateway.controlUi) config.gateway.controlUi = {};
      if (!config.gateway.controlUi.allowedOrigins) config.gateway.controlUi.allowedOrigins = [];
      config.gateway.controlUi.allowedOrigins.push(devOrigin);
      dirty = true;
      console.log(`[${APP_NAME}] Added ${devOrigin} to gateway.controlUi.allowedOrigins`);
    }

    if (dirty) saveConfig(config);
  } catch (err) {
    console.warn(`[${APP_NAME}] Failed to ensure gateway config:`, err.message);
  }
}

// ═══════════════════════════════════════════════════════════════
// 11. IPC 处理器
// ═══════════════════════════════════════════════════════════════
function setupIPC() {
  ipcMain.handle('get-gateway-status', () => ({
    ready: gatewayReady,
    port: gatewayPort,
    token: getToken(),
    hasModel: hasModelConfigured(),
  }));

  ipcMain.handle('get-config', () => getConfig());

  ipcMain.handle('save-config', (_, newConfig) => {
    const existing = getConfig();
    const merged = Object.assign(existing, newConfig);
    saveConfig(merged);
    console.log(`[${APP_NAME}] Config saved`);
    return { ok: true };
  });

  ipcMain.handle('restart-gateway', () => restartGateway());

  ipcMain.handle('stop-gateway', () => {
    stopGateway();
    return { ok: true };
  });

  ipcMain.handle('diagnose', () => {
    const issues = [];
    const nodeBin = getNodeBin();
    if (nodeBin === 'node') {
      issues.push({ id: 'node-runtime', severity: 'warn', message: '使用系统 Node，未找到打包运行时' });
    }
    try {
      JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      issues.push({ id: 'config-invalid', severity: 'error', message: 'openclaw.json 格式错误' });
    }
    if (!hasModelConfigured()) {
      issues.push({ id: 'no-model', severity: 'warn', message: '未配置模型' });
    }
    if (!gatewayProcess) {
      issues.push({ id: 'gateway-dead', severity: 'error', message: 'Gateway 进程不存在' });
    }
    return { issues };
  });

  ipcMain.handle('repair', async (_, issueId) => {
    switch (issueId) {
      case 'gateway-dead': return restartGateway();
      case 'config-invalid': ensureConfig(); return { ok: true };
      default: return { ok: false, error: 'Unknown issue' };
    }
  });

  ipcMain.handle('doctor-fix', async () => {
    const nodeBin = getNodeBin();
    const env = {
      ...process.env,
      OPENCLAW_HOME: userDataPath,
      OPENCLAW_STATE_DIR: configDir,
      OPENCLAW_CONFIG_PATH: configPath,
    };

    return new Promise((resolve) => {
      const proc = spawn(nodeBin, [openclawEntry, 'doctor', '--fix'], {
        env,
        cwd: openclawPath,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('error', (err) => {
        resolve({ ok: false, error: err.message, stdout, stderr });
      });

      proc.on('exit', (code) => {
        resolve({ ok: code === 0, code, stdout, stderr });
      });

      setTimeout(() => {
        proc.kill();
        resolve({ ok: false, error: '修复超时', stdout, stderr });
      }, 120000);
    });
  });

  ipcMain.handle('fetch-skill-categories', async () => {
    return fetchFromSkillApi('/skills/categories');
  });

  ipcMain.handle('fetch-skill-subcategories', async (_, l1Id) => {
    return fetchFromSkillApi(`/skills/categories/${l1Id}`);
  });

  ipcMain.handle('fetch-skills', async (_, { l1Id, l2Id, page = 1, pageSize = 20 } = {}) => {
    return fetchFromSkillApi(`/skills/categories/${l1Id}/${l2Id}/skills?page=${page}&pageSize=${pageSize}`);
  });

  ipcMain.handle('search-skills', async (_, { keyword, page = 1, pageSize = 20 }) => {
    const q = encodeURIComponent(keyword);
    return fetchFromSkillApi(`/skills/search?keyword=${q}&page=${page}&pageSize=${pageSize}`);
  });

  ipcMain.handle('install-skill', async (_, slug) => {
    const skillsDir = path.join(configDir, 'skills');
    const skillDir = path.join(skillsDir, slug);
    const zipPath = path.join(skillsDir, `${slug}.zip`);
    fs.mkdirSync(skillsDir, { recursive: true });
    const downloadUrl = `https://api.skillhub.cn/api/v1/download?slug=${slug}`;
    await downloadToFile(downloadUrl, zipPath);
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(skillDir, true);
    fs.unlinkSync(zipPath);
    return { ok: true };
  });

  ipcMain.handle('uninstall-skill', async (_, slug) => {
    const skillDir = path.join(configDir, 'skills', slug);
    fs.rmSync(skillDir, { recursive: true, force: true });
    return { ok: true };
  });

  ipcMain.handle('list-installed-skills', async () => {
    const skillsDir = path.join(configDir, 'skills');
    if (!fs.existsSync(skillsDir)) return [];
    return fs.readdirSync(skillsDir).filter(d =>
      fs.statSync(path.join(skillsDir, d)).isDirectory()
    );
  });

  ipcMain.handle('read-skill-file', async (_, slug, filename) => {
    const filePath = path.join(configDir, 'skills', slug, filename);
    try {
      if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8');
      return '';
    } catch { return ''; }
  });

  ipcMain.handle('install-channel-plugin', async (_, installCmd) => {
    // installCmd: { type: 'openclaw', spec: '...' } | { type: 'npx', args: ['...'] }
    const nodeBin = getNodeBin();
    const env = {
      ...process.env,
      OPENCLAW_HOME: userDataPath,
      OPENCLAW_STATE_DIR: configDir,
      OPENCLAW_CONFIG_PATH: configPath,
    };

    let cmd, args, cwd;
    if (installCmd.type === 'npx') {
      cmd = 'npx';
      args = installCmd.args;
      cwd = openclawPath;
    } else {
      cmd = nodeBin;
      args = [openclawEntry, 'plugins', 'install', installCmd.spec];
      cwd = openclawPath;
    }

    const proc = spawn(cmd, args, {
      env,
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true,
    });

    proc.stdout.on('data', (d) => {
      const text = d.toString();
      if (text.trim()) {
        mainWindow?.webContents.send('plugin-install-output', { stream: 'stdout', text });
      }
    });
    proc.stderr.on('data', (d) => {
      const text = d.toString();
      if (text.trim()) {
        mainWindow?.webContents.send('plugin-install-output', { stream: 'stderr', text });
      }
    });

    return new Promise((resolve) => {
      proc.on('error', (err) => {
        clearTimeout(timer);
        mainWindow?.webContents.send('plugin-install-output', { stream: 'exit', code: -1, error: err.message });
        resolve({ ok: false, error: err.message });
      });
      proc.on('exit', (code) => {
        clearTimeout(timer);
        mainWindow?.webContents.send('plugin-install-output', { stream: 'exit', code });
        resolve({ ok: code === 0 });
      });
      const timer = setTimeout(() => {
        proc.kill();
        mainWindow?.webContents.send('plugin-install-output', { stream: 'exit', code: -1, error: '安装超时' });
        resolve({ ok: false, error: '安装超时' });
      }, 180000);
    });
  });

  ipcMain.handle('fetch-provider-models', async (_, baseUrl, apiKey) => {
    try {
      const url = baseUrl.replace(/\/+$/, '') + '/models';
      return await new Promise((resolve, reject) => {
        const parsed = new URL(url);
        const options = {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + (parsed.search || ''),
          method: 'GET',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          timeout: 10000,
        };
        const mod = parsed.protocol === 'https:' ? https : http;
        const req = mod.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try { resolve(JSON.parse(data)); } catch { reject(new Error('Invalid JSON')); }
          });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
        req.end();
      });
    } catch (e) {
      return { error: e.message || String(e) };
    }
  });
}

  // ── Agent 文件读写 ──
  // Agent workspace files live in ~/.openclaw/workspace-<agentId>/
  // Default agent (main) uses ~/.openclaw/workspace/

  function getAgentWorkspaceDir(agentId) {
    if (!agentId || agentId === 'main') {
      return path.join(configDir, 'workspace');
    }
    return path.join(configDir, `workspace-${agentId}`);
  }

  ipcMain.handle('read-agent-file', (_, agentId, filename) => {
    const wsDir = getAgentWorkspaceDir(agentId);
    const filePath = path.join(wsDir, filename);
    try {
      if (fs.existsSync(filePath)) {
        return fs.readFileSync(filePath, 'utf8');
      }
      return '';
    } catch (e) {
      return '';
    }
  });

  ipcMain.handle('write-agent-file', (_, agentId, filename, content) => {
    const wsDir = getAgentWorkspaceDir(agentId);
    const filePath = path.join(wsDir, filename);
    try {
      if (!content || !content.trim()) {
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        return { ok: true };
      }
      fs.mkdirSync(wsDir, { recursive: true });
      fs.writeFileSync(filePath, content, 'utf8');
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('open-path', async (_, filePath) => {
    try {
      await shell.openPath(filePath);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('read-file-as-data-url', async (_, filePath) => {
    try {
      if (!fs.existsSync(filePath)) return { ok: false, error: 'File not found' }
      const ext = path.extname(filePath).toLowerCase()
      const mimeMap = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
        '.bmp': 'image/bmp', '.ico': 'image/x-icon',
      }
      const mime = mimeMap[ext]
      if (!mime) return { ok: false, error: 'Unsupported image type' }
      const stat = fs.statSync(filePath)
      if (stat.size > 10 * 1024 * 1024) return { ok: false, error: 'File too large (>10MB)' }
      const data = fs.readFileSync(filePath)
      const base64 = data.toString('base64')
      return { ok: true, dataUrl: `data:${mime};base64,${base64}` }
    } catch (e) {
      return { ok: false, error: e.message }
    }
  });

  ipcMain.handle('delete-agent', (_, agentId) => {
    try {
      const wsDir = getAgentWorkspaceDir(agentId);
      if (fs.existsSync(wsDir)) {
        fs.rmSync(wsDir, { recursive: true, force: true });
      }
      const cfg = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      if (cfg.agents?.list) {
        cfg.agents.list = cfg.agents.list.filter(a => a.id !== agentId);
        fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2));
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('export-config', async () => {
    try {
      const { dialog } = require('electron');
      const result = await dialog.showSaveDialog(mainWindow, {
        title: '导出配置',
        defaultPath: 'openclaw-config.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (result.canceled) return { ok: false };
      const config = getConfig();
      fs.writeFileSync(result.filePath, JSON.stringify(config, null, 2));
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('import-config', async () => {
    try {
      const { dialog } = require('electron');
      const result = await dialog.showOpenDialog(mainWindow, {
        title: '导入配置',
        filters: [{ name: 'JSON', extensions: ['json'] }],
        properties: ['openFile'],
      });
      if (result.canceled || result.filePaths.length === 0) return { ok: false };
      const data = fs.readFileSync(result.filePaths[0], 'utf8');
      const imported = JSON.parse(data);
      saveConfig(imported);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('reset-config', async () => {
    try {
      const defaultConfig = {
        gateway: { mode: 'local', auth: { token: 'clawshell' } },
      };
      saveConfig(defaultConfig);
      ensureConfig();
      ensureDeviceAuthDisabled();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('open-data-dir', async () => {
    try {
      await shell.openPath(configDir);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('open-logs-dir', async () => {
    try {
      const logsDir = path.join(configDir, 'logs');
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      await shell.openPath(logsDir);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('get-system-info', async () => {
    const info = {
      electronVersion: process.versions.electron || '-',
      nodeVersion: process.version || '-',
      osInfo: `${process.platform} ${process.arch}`,
      openclawVersion: '-',
    };
    try {
      const pkgPath = path.join(openclawPath, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        info.openclawVersion = pkg.version || '-';
      }
    } catch {}
    return info;
  });

  ipcMain.handle('pick-avatar-image', async () => {
    try {
      const result = await dialog.showOpenDialog(mainWindow, {
        title: '选择头像图片',
        filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'] }],
        properties: ['openFile'],
      });
      if (result.canceled || result.filePaths.length === 0) return { ok: false };
      const filePath = result.filePaths[0];
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap = {
        '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.gif': 'image/gif', '.webp': 'image/webp', '.bmp': 'image/bmp',
      };
      const mime = mimeMap[ext];
      if (!mime) return { ok: false, error: 'Unsupported image type' };
      const stat = fs.statSync(filePath);
      if (stat.size > 5 * 1024 * 1024) return { ok: false, error: 'File too large (>5MB)' };
      const data = fs.readFileSync(filePath);
      const base64 = data.toString('base64');
      return { ok: true, dataUrl: `data:${mime};base64,${base64}` };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('get-settings', () => getSettings());
  ipcMain.handle('save-settings', (_, settings) => {
    saveSettings(settings);
    return { ok: true };
  });

  // ── 窗口控制 ──
  ipcMain.handle('window-minimize', () => mainWindow?.minimize());
  ipcMain.handle('window-maximize', () => {
    if (!mainWindow) return;
    mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });
  ipcMain.handle('window-close', () => mainWindow?.close());

// ═══════════════════════════════════════════════════════════════
// 12. 窗口管理
// ═══════════════════════════════════════════════════════════════
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    show: false,
    backgroundColor: '#0a0a0a',
    frame: false,
    icon: path.join(__dirname, '..', 'assets', 'icon.ico'),
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === 'font-access') return callback(true);
    callback(false);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });

  const devServerUrl = 'http://localhost:5173';
  if (isDev) {
    mainWindow.loadURL(devServerUrl);
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// ═══════════════════════════════════════════════════════════════
// 13. 应用生命周期
// ═══════════════════════════════════════════════════════════════

app.whenReady().then(async () => {
  console.log(`[${APP_NAME}] v${app.getVersion()} starting...`);

  ensureConfig();
  ensureDeviceAuthDisabled();
  setupIPC();
  createWindow();

  try {
    const port = await findAvailablePort();
    await startGateway(port);
    if (!hasModelConfigured()) {
      console.log(`[${APP_NAME}] No model configured, showing setup wizard`);
    }
  } catch (err) {
    console.error(`[${APP_NAME}] Failed to start gateway:`, err);
    dialog.showErrorBox(
      `${APP_NAME} - 启动错误`,
      `无法启动 OpenClaw 网关。\n\n${err.message}\n\n请检查 Node.js 是否可用后重试。`
    );
  }
});

app.on('window-all-closed', () => {
  stopGateway();
  app.quit();
});

app.on('before-quit', () => {
  stopGateway();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
