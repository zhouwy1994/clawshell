/**
 * ClawShell (虾壳) — Electron 主进程
 *
 * 职责：
 *   1. 管理 OpenClaw Gateway 子进程的生命周期（启动 / 停止 / 重启 / 崩溃恢复）
 *   2. 读写 ~/.clawshell/.openclaw/openclaw.json 配置文件
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
const os = require('os');
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
let settingsCache = null;

// ═══════════════════════════════════════════
// 动态路径计算
// ═══════════════════════════════════════════

const isDev = process.argv.includes('--dev');

function resolveDataDir() {
  const envDir = process.env.CLAWSHELL_HOME;
  if (envDir && envDir.trim()) {
    const resolved = envDir.startsWith('~')
      ? path.join(os.homedir(), envDir.slice(1))
      : envDir;
    try {
      if (path.isAbsolute(resolved)) return resolved;
    } catch {}
  }
  return path.join(os.homedir(), '.clawshell');
}

function resolvePaths() {
  const dataDir = resolveDataDir();
  return {
    dataDir,
    configDir: path.join(dataDir, '.openclaw'),
    configPath: path.join(dataDir, '.openclaw', 'openclaw.json'),
    settingsPath: path.join(dataDir, 'clawshell-settings.json'),
  };
}

function getOpenClawPath() {
  const dataDir = resolveDataDir();
  const settings = getSettings();
  const activeVersion = settings.core?.version;
  if (activeVersion) {
    const versionDir = path.join(dataDir, 'core', activeVersion);
    const openclawDir = path.join(versionDir, 'node_modules', 'openclaw');
    if (fs.existsSync(openclawDir)) return openclawDir;
  }
  const currentLink = path.join(dataDir, 'core', 'current');
  if (fs.existsSync(currentLink)) {
    return path.join(currentLink, 'node_modules', 'openclaw');
  }
  return null;
}

function getOpenClawEntry() {
  const openclawPath = getOpenClawPath();
  if (!openclawPath) return null;
  return path.join(openclawPath, 'openclaw.mjs');
}

function getOpenClawVersion() {
  const openclawPath = getOpenClawPath();
  if (!openclawPath) return '';
  try {
    const pkgPath = path.join(openclawPath, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    return typeof pkg.version === 'string' ? pkg.version : '';
  } catch {
    return '';
  }
}

function getOpenClawEnv() {
  const { dataDir, configDir, configPath } = resolvePaths();
  const settings = getSettings();
  const env = {
    ...process.env,
    OPENCLAW_HOME: dataDir,
    OPENCLAW_STATE_DIR: configDir,
    OPENCLAW_CONFIG_PATH: configPath,
    OPENCLAW_EMBEDDED_IN: APP_NAME,
  };
  if (settings.registry?.npm) {
    env.NPM_CONFIG_REGISTRY = settings.registry.npm;
  }
  return env;
}

function parseVersionTuple(version) {
  const match = String(version || '').trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prerelease: match[4] || '',
    raw: String(version).trim(),
  };
}

function compareVersionTuples(a, b) {
  const left = parseVersionTuple(a);
  const right = parseVersionTuple(b);
  if (!left || !right) return 0;
  for (const key of ['major', 'minor', 'patch']) {
    if (left[key] !== right[key]) return left[key] - right[key];
  }
  if (left.prerelease === right.prerelease) return 0;
  if (!left.prerelease) return 1;
  if (!right.prerelease) return -1;
  return left.prerelease.localeCompare(right.prerelease, undefined, { numeric: true });
}

function extractOfficialOpenClawPluginPackage(spec) {
  let raw = String(spec || '').trim();
  if (raw.startsWith('clawhub:')) raw = raw.slice('clawhub:'.length);
  if (raw.startsWith('npm:')) raw = raw.slice('npm:'.length);
  if (!raw.startsWith('@openclaw/')) return null;
  const slash = raw.indexOf('/');
  const versionAt = raw.indexOf('@', slash + 1);
  const pkg = versionAt >= 0 ? raw.slice(0, versionAt) : raw;
  return /^@openclaw\/[a-z0-9][a-z0-9._-]*$/i.test(pkg) ? pkg : null;
}

function resolveNpmPackageVersionAtOrBelow(pkg, maxVersion, env, cwd) {
  const npmBin = getNpmBin();
  return new Promise((resolve) => {
    let settled = false;
    const finish = (version) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(version);
    };
    const timeoutId = setTimeout(() => {
      proc.kill();
      finish('');
    }, 30000);
    const proc = spawn(npmBin, ['view', pkg, 'versions', '--json'], {
      env,
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });
    let stdout = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.on('error', () => finish(''));
    proc.on('exit', (code) => {
      if (code !== 0) return finish('');
      try {
        const parsed = JSON.parse(stdout.trim());
        const versions = (Array.isArray(parsed) ? parsed : [parsed])
          .filter(v => typeof v === 'string' && parseVersionTuple(v))
          .filter(v => compareVersionTuples(v, maxVersion) <= 0)
          .sort(compareVersionTuples);
        finish(versions.at(-1) || '');
      } catch {
        finish('');
      }
    });
  });
}

async function resolveChannelPluginInstallSpec(installCmd, env, cwd) {
  const originalSpec = installCmd?.spec || '';
  const pkg = extractOfficialOpenClawPluginPackage(originalSpec);
  if (!pkg) return originalSpec;

  const coreVersion = getOpenClawVersion();
  if (!parseVersionTuple(coreVersion)) return originalSpec;

  const compatibleVersion = await resolveNpmPackageVersionAtOrBelow(pkg, coreVersion, env, cwd);
  const selectedVersion = compatibleVersion || coreVersion;
  const selectedSpec = `npm:${pkg}@${selectedVersion}`;
  mainWindow?.webContents.send('plugin-install-output', {
    stream: 'stdout',
    text: `Using OpenClaw-compatible plugin package ${selectedSpec} for runtime ${coreVersion}\n`,
  });
  return selectedSpec;
}

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

function getNpmBin() {
  const platform = process.platform;
  const arch = process.arch;
  const nodeDir = isDev
    ? path.join(__dirname, '..', 'resources', 'runtime', `node-${platform}-${arch}`)
    : path.join(process.resourcesPath, 'resources', 'runtime', `node-${platform}-${arch}`);
  if (platform === 'win32') {
    const npmCmd = path.join(nodeDir, 'npm.cmd');
    if (fs.existsSync(npmCmd)) return npmCmd;
  } else {
    const npmBin = path.join(nodeDir, 'bin', 'npm');
    if (fs.existsSync(npmBin)) return npmBin;
  }
  return platform === 'win32' ? 'npm.cmd' : 'npm';
}

// ═══════════════════════════════════════════════════════════════
// 2. openclaw.json 配置文件读写
// ═══════════════════════════════════════════════════════════════

function ensureConfig() {
  const { dataDir, configDir, configPath } = resolvePaths();
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(configDir, { recursive: true });
  // fs.mkdirSync(path.join(configDir, 'memory'), { recursive: true });
  // fs.mkdirSync(path.join(configDir, 'backups'), { recursive: true });
  // fs.mkdirSync(path.join(configDir, 'skills'), { recursive: true });
  // fs.mkdirSync(path.join(configDir, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(dataDir, 'core'), { recursive: true });
  if (!fs.existsSync(configPath)) {
    const defaultConfig = {
      gateway: { mode: 'local', auth: { token: 'clawshell' } },
      tools: {
        profile: 'full'
      }
    };
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
    console.log(`[${APP_NAME}] Created default config at ${configPath}`);
  }
}

function getConfig() {
  const { configPath } = resolvePaths();
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch {
    return { gateway: { mode: 'local', auth: { token: 'clawshell' } }, tools: { profile: 'full' } };
  }
}

function saveConfig(config) {
  const { configPath } = resolvePaths();
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function getSettings() {
  if (settingsCache) return settingsCache;
  const defaults = {
    connection: { mode: 'local', remote: { url: '', token: '', password: '' } },
    core: { version: '', autoUpdate: false },
    registry: { npm: 'https://registry.npmmirror.com' },
    setupDone: false,
  };
  // Temporarily set cache to defaults to break circular dependency:
  // resolveDataDir() -> getSettings() -> resolvePaths()
  settingsCache = defaults;
  try {
    const { settingsPath } = resolvePaths();
    if (fs.existsSync(settingsPath)) {
      settingsCache = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      return settingsCache;
    }
  } catch {}
  return settingsCache;
}

function saveSettings(settings) {
  settingsCache = settings;
  const { settingsPath } = resolvePaths();
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
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
    const openclawEntry = getOpenClawEntry();
    const openclawPath = getOpenClawPath();
    if (!openclawEntry || !openclawPath) {
      return reject(new Error('OpenClaw core not found. Please install it first.'));
    }
    console.log(`[${APP_NAME}] Using Node.js: ${nodeBin}`);
    console.log(`[${APP_NAME}] Using OpenClaw: ${openclawPath}`);

    const env = getOpenClawEnv();

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
    const settings = getSettings();
    const mode = settings.connection?.mode || 'local';

    if (mode === 'remote') {
      gatewayReady = false;
      console.log(`[${APP_NAME}] Disconnected from remote gateway`);
      resolve();
      return;
    }

    // Local mode
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
    const settings = getSettings();
    const mode = settings.connection?.mode || 'local';

    if (mode === 'remote') {
      stopHealthCheck();
      gatewayReady = false;
      await connectRemoteGateway(settings);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('gateway-restarted', { ready: gatewayReady, mode: 'remote' });
      }
      return { ok: gatewayReady };
    }

    // Local mode
    console.log(`[${APP_NAME}] Restarting gateway...`);
    await stopGateway();
    gatewayReady = false;
    await new Promise(r => setTimeout(r, 500));
    const port = await findAvailablePort();
    await startGateway(port);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('gateway-restarted', { port, ready: true, mode: 'local' });
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
  const settings = getSettings();
  const mode = settings.connection?.mode || 'local';

  healthCheckTimer = setInterval(async () => {
    if (isRestarting) return;

    if (mode === 'remote') {
      try {
        const result = await probeRemoteGateway(settings);
        if (result.ok) {
          if (!gatewayReady) {
            gatewayReady = true;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('gateway-status-changed', { ready: true, mode: 'remote' });
            }
          }
        } else {
          if (gatewayReady) {
            gatewayReady = false;
            console.log(`[${APP_NAME}] Remote gateway health check failed`);
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('gateway-status-changed', { ready: false, mode: 'remote' });
            }
          }
        }
      } catch {
        if (gatewayReady) {
          gatewayReady = false;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('gateway-status-changed', { ready: false, mode: 'remote' });
          }
        }
      }
      return;
    }

    // Local mode health check
    if (!gatewayProcess) return;
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(`http://127.0.0.1:${gatewayPort}/`, (res) => {
          if (!gatewayReady) {
            gatewayReady = true;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('gateway-status-changed', { ready: true, port: gatewayPort, mode: 'local' });
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
          mainWindow.webContents.send('gateway-status-changed', { ready: false, mode: 'local' });
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
// Remote Gateway 连接
// ═══════════════════════════════════════════════════════════════

function getRemoteUrl(settings) {
  const url = settings.connection?.remote?.url || '';
  return url.replace(/\/+$/, '');
}

function probeRemoteGateway(settings) {
  return new Promise((resolve) => {
    const url = getRemoteUrl(settings);
    if (!url) {
      resolve({ ok: false, error: 'No remote URL configured' });
      return;
    }
    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;
    const req = client.get(url, (res) => {
      resolve({ ok: true, statusCode: res.statusCode });
    });
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ ok: false, error: 'Connection timeout' });
    });
    req.on('error', (err) => {
      resolve({ ok: false, error: err.message });
    });
  });
}

async function connectRemoteGateway(settings) {
  console.log(`[${APP_NAME}] Connecting to remote gateway: ${getRemoteUrl(settings)}`);
  const result = await probeRemoteGateway(settings);
  if (result.ok) {
    gatewayReady = true;
    console.log(`[${APP_NAME}] Remote gateway connected`);
    startHealthCheck();
  } else {
    gatewayReady = false;
    console.error(`[${APP_NAME}] Remote gateway connection failed: ${result.error}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('gateway-error', {
        message: `远端网关连接失败: ${result.error}`,
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// OpenClaw 核心版本管理
// ═══════════════════════════════════════════════════════════════

function getCoreDir() {
  const dataDir = resolveDataDir();
  return path.join(dataDir, 'core');
}

function getCurrentCoreLink() {
  return path.join(getCoreDir(), 'current');
}

function setCurrentCoreLink(version, versionDir) {
  // Primary: write active version to settings (works on all platforms)
  const settings = getSettings();
  settings.core = settings.core || {};
  settings.core.version = version;
  saveSettings(settings);

  // Secondary: also create symlink for compatibility
  const linkPath = getCurrentCoreLink();
  try {
    if (fs.existsSync(linkPath)) {
      fs.rmSync(linkPath, { recursive: true, force: true });
    }
  } catch {}
  try {
    fs.symlinkSync(versionDir, linkPath, 'junction');
  } catch {}
}

function listInstalledCoreVersions() {
  const coreDir = getCoreDir();
  if (!fs.existsSync(coreDir)) return [];
  return fs.readdirSync(coreDir)
    .filter(d => {
      if (d === 'current') return false;
      const full = path.join(coreDir, d);
      if (!fs.statSync(full).isDirectory()) return false;
      const pkg = path.join(full, 'node_modules', 'openclaw', 'package.json');
      return fs.existsSync(pkg);
    })
    .map(d => {
      const pkgPath = path.join(coreDir, d, 'node_modules', 'openclaw', 'package.json');
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        return { version: pkg.version || d, dir: d };
      } catch {
        return { version: d, dir: d };
      }
    });
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

    // 必须同时设置 allowInsecureAuth，否则 gateway 会在握手时清空 scopes
    // (device=null + token auth 且非 insecure 模式 → clearUnboundScopes)
    if (config.gateway?.controlUi?.allowInsecureAuth !== true) {
      if (!config.gateway) config.gateway = {};
      if (!config.gateway.controlUi) config.gateway.controlUi = {};
      config.gateway.controlUi.allowInsecureAuth = true;
      dirty = true;
      console.log(`[${APP_NAME}] Set gateway.controlUi.allowInsecureAuth = true`);
    }

    // 允许渲染进程的 origin 直连 gateway
    // 开发模式: http://localhost:5173
    // 生产模式: Electron file:// 页面的 origin 是 "null"，gateway parseOrigin
    //   会返回 null 导致 origin check 失败；此时需要 host-header fallback
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

    // 生产环境下 file:// 的 origin 为 "null"，gateway 无法解析，
    // 必须启用 Host-header fallback 才能通过 origin 检查
    if (config.gateway?.controlUi?.dangerouslyAllowHostHeaderOriginFallback !== true) {
      if (!config.gateway) config.gateway = {};
      if (!config.gateway.controlUi) config.gateway.controlUi = {};
      config.gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback = true;
      dirty = true;
      console.log(`[${APP_NAME}] Set gateway.controlUi.dangerouslyAllowHostHeaderOriginFallback = true`);
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
  ipcMain.handle('get-gateway-status', () => {
    const settings = getSettings();
    const mode = settings.connection?.mode || 'local';
    const setupDone = settings.setupDone || false;
    return {
      ready: setupDone && gatewayReady,
      port: mode === 'remote' ? 0 : gatewayPort,
      token: mode === 'remote' ? (settings.connection?.remote?.token || '') : getToken(),
      hasModel: setupDone && hasModelConfigured(),
      mode,
      remoteUrl: mode === 'remote' ? getRemoteUrl(settings) : '',
      setupDone,
    };
  });

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
    const settings = getSettings();
    const mode = settings.connection?.mode || 'local';
    const { configPath } = resolvePaths();
    const issues = [];

    if (mode === 'remote') {
      const url = getRemoteUrl(settings);
      if (!url) {
        issues.push({ id: 'no-remote-url', severity: 'error', message: '未配置远端网关地址' });
      }
    } else {
      const nodeBin = getNodeBin();
      if (nodeBin === 'node') {
        issues.push({ id: 'node-runtime', severity: 'warn', message: '使用系统 Node，未找到打包运行时' });
      }
      const openclawEntry = getOpenClawEntry();
      if (!openclawEntry) {
        issues.push({ id: 'no-openclaw-core', severity: 'error', message: 'OpenClaw 核心未安装' });
      }
    }

    try {
      JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch {
      issues.push({ id: 'config-invalid', severity: 'error', message: 'openclaw.json 格式错误' });
    }
    if (!hasModelConfigured()) {
      issues.push({ id: 'no-model', severity: 'warn', message: '未配置模型' });
    }
    if (mode === 'local' && !gatewayProcess) {
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
    const env = getOpenClawEnv();

    return new Promise((resolve) => {
      const openclawEntry = getOpenClawEntry();
      const openclawPath = getOpenClawPath();
      if (!openclawEntry || !openclawPath) {
        return resolve({ ok: false, error: 'OpenClaw core not found', stdout: '', stderr: '' });
      }
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

  function getSkillBaseDir(target = {}) {
    const { configDir } = resolvePaths();
    if (target?.scope === 'agent' && target.agentId) {
      return path.join(getAgentWorkspaceDir(target.agentId), 'skills');
    }
    return path.join(configDir, 'skills');
  }

  function resolveSkillPath(baseDir, slug) {
    const resolvedBase = path.resolve(baseDir);
    const resolved = path.resolve(resolvedBase, slug);
    if (resolved !== resolvedBase && resolved.startsWith(resolvedBase + path.sep)) {
      return resolved;
    }
    throw new Error('Invalid skill path');
  }

  function getSkillZipPath(skillsDir, slug) {
    const safeName = encodeURIComponent(slug).replace(/%/g, '_');
    return path.join(skillsDir, `${safeName}.zip`);
  }

  ipcMain.handle('install-skill', async (_, slug, target = {}) => {
    const skillsDir = getSkillBaseDir(target);
    const skillDir = resolveSkillPath(skillsDir, slug);
    const zipPath = getSkillZipPath(skillsDir, slug);
    fs.mkdirSync(skillsDir, { recursive: true });
    const downloadUrl = `https://api.skillhub.cn/api/v1/download?slug=${slug}`;
    await downloadToFile(downloadUrl, zipPath);
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(skillDir, true);
    fs.unlinkSync(zipPath);
    return { ok: true };
  });

  ipcMain.handle('uninstall-skill', async (_, slug, target = {}) => {
    const skillsDir = getSkillBaseDir(target);
    const skillDir = resolveSkillPath(skillsDir, slug);
    fs.rmSync(skillDir, { recursive: true, force: true });
    return { ok: true };
  });

  ipcMain.handle('list-installed-skills', async (_, target = {}) => {
    const skillsDir = getSkillBaseDir(target);
    if (!fs.existsSync(skillsDir)) return [];
    return fs.readdirSync(skillsDir).filter(d =>
      fs.statSync(path.join(skillsDir, d)).isDirectory()
    );
  });

  ipcMain.handle('read-skill-file', async (_, slug, filename, target = {}) => {
    const skillsDir = getSkillBaseDir(target);
    const skillDir = resolveSkillPath(skillsDir, slug);
    const filePath = path.resolve(skillDir, filename);
    try {
      if (!filePath.startsWith(skillDir + path.sep)) return '';
      if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf8');
      return '';
    } catch { return ''; }
  });

  ipcMain.handle('install-channel-plugin', async (_, installCmd) => {
    // installCmd: { type: 'openclaw', spec: '...' } | { type: 'npx', args: ['...'] }
    const nodeBin = getNodeBin();
    const env = getOpenClawEnv();

    const openclawEntry = getOpenClawEntry();
    const openclawPath = getOpenClawPath();
    let cmd, args, cwd;
    if (installCmd.type === 'npx') {
      cmd = 'npx';
      args = installCmd.args;
      cwd = openclawPath || undefined;
    } else {
      const installSpec = await resolveChannelPluginInstallSpec(installCmd, env, openclawPath || undefined);
      cmd = nodeBin;
      args = [openclawEntry || 'openclaw', 'plugins', 'install', installSpec, '--force'];
      cwd = openclawPath || undefined;
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
  // Agent workspace files live in ~/.clawshell/.openclaw/workspace-<agentId>/
  // Default agent (main) uses ~/.clawshell/.openclaw/workspace/workspace/

  function getAgentWorkspaceDir(agentId) {
    const { configDir } = resolvePaths();
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
      const { configPath } = resolvePaths();
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
        tools: { profile: 'full' },
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
      const { configDir } = resolvePaths();
      await shell.openPath(configDir);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('open-logs-dir', async () => {
    try {
      const { configDir } = resolvePaths();
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
      dataDir: resolveDataDir(),
    };
    try {
      const _openclawPath = getOpenClawPath();
      const pkgPath = _openclawPath ? path.join(_openclawPath, 'package.json') : '';
      if (pkgPath && fs.existsSync(pkgPath)) {
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

  ipcMain.handle('get-settings', () => {
    settingsCache = null; // Bust cache so renderer always gets latest from disk
    return getSettings();
  });
  ipcMain.handle('save-settings', (_, settings) => {
    saveSettings(settings);
    return { ok: true };
  });
  ipcMain.handle('save-connection', (_, connection) => {
    const settings = getSettings();
    settings.connection = connection;
    saveSettings(settings);
    return { ok: true };
  });

  ipcMain.handle('setup-complete', async () => {
    const settings = getSettings();
    settings.setupDone = true;
    saveSettings(settings);

    const connectionMode = settings.connection?.mode || 'local';
    if (connectionMode === 'remote') {
      await connectRemoteGateway(settings);
    } else {
      const openclawEntry = getOpenClawEntry();
      if (!openclawEntry) {
        console.log(`[${APP_NAME}] OpenClaw core not found, user needs to install`);
      } else {
        try {
          const port = await findAvailablePort();
          await startGateway(port);
        } catch (err) {
          console.error(`[${APP_NAME}] Failed to start gateway after setup:`, err);
        }
      }
    }
    return { ok: true };
  });

  ipcMain.handle('save-agent-workspace', async (_, agentData) => {
    const dataDir = resolveDataDir();
    const workspaceDir = path.join(dataDir, '.openclaw', 'workspace');
    try {
      fs.mkdirSync(workspaceDir, { recursive: true });

      // Write SOUL.md
      const soulMd = `
# 身份信息
我叫${agentData.name}，我今年${agentData.age}岁，性别${agentData.gender}，目前担任${agentData.role}，隶属于${agentData.dept}。我的核心职责是${agentData.duty}

# 擅长技能
${agentData.skills}

# 性格特质
我性格${agentData.charm}，说话风格${agentData.style}，平时常说的口头禅是"${agentData.motto}"

# 工作态度与原则
我的工作态度是${agentData.attitude}，处事原则是${agentData.principle}

# 喜好与短板
我个人喜欢${agentData.hobby}，最反感${agentData.dislike}；我的工作短板是${agentData.weakness}，但我会发挥优势，专注执行，弥补不足。

# 专属信念
我的座右铭是"${agentData.credo}"，汇报工作时会遵循${agentData.report}的原则
`;
      fs.writeFileSync(path.join(workspaceDir, 'SOUL.md'), soulMd, 'utf8');

      // Write IDENTITY.md
      const identityMd = `
# 基础信息
+ 姓名:${agentData.name}
+ 性别:${agentData.gender}
+ 年龄:${agentData.age}
+ 角色:${agentData.role}
+ 工作职责:${agentData.duty}
+ 所属部门:${agentData.dept}

# 性格特征
+ 性格:${agentData.charm}
+ 说话风格:${agentData.style}
+ 口头禅:${agentData.motto}

# 工作特征
+ 擅长技能:${agentData.skills}
+ 工作短板:${agentData.weakness}
+ 工作态度:${agentData.attitude}

# 三观特征
+ 处事原则:${agentData.principle}
+ 个人喜好:${agentData.hobby}
+ 反感事物:${agentData.dislike}
+ 座右铭:${agentData.credo}

# 人物关系
+ 与其他人的关系:${agentData.othersRelation}
`;
      fs.writeFileSync(path.join(workspaceDir, 'IDENTITY.md'), identityMd, 'utf8');

      // Write USER.md
      const userMd = `
# 用户档案 
+ 用户姓名:未知
+ 用户年龄:未知
+ 用户性别:未知
+ 我与用户的关系:我是他(她)的${agentData.myRelation}
+ 我对用户的称呼:${agentData.callMe}
+ 我对用户的汇报方式:${agentData.report}
`;
      fs.writeFileSync(path.join(workspaceDir, 'USER.md'), userMd, 'utf8');

      // Write agent_info.json for structured data reuse
      const agentInfo = {
        name: agentData.name,
        gender: agentData.gender,
        age: agentData.age,
        id: agentData.id,
        role: agentData.role,
        duty: agentData.duty,
        dept: agentData.dept,
        callMe: agentData.callMe,
        myRelation: agentData.myRelation,
        othersRelation: agentData.othersRelation,
        charm: agentData.charm,
        style: agentData.style,
        motto: agentData.motto,
        skills: agentData.skills,
        weakness: agentData.weakness,
        attitude: agentData.attitude,
        principle: agentData.principle,
        hobby: agentData.hobby,
        dislike: agentData.dislike,
        credo: agentData.credo,
        report: agentData.report,
        avatar: agentData.avatar,
      };
      fs.writeFileSync(path.join(workspaceDir, 'agent_info.json'), JSON.stringify(agentInfo, null, 2), 'utf8');

      // Update agents.list[0] in openclaw.json
      const config = getConfig();
      if (!config.agents) config.agents = { list: [] };
      if (!config.agents.list) config.agents.list = [];
      if (config.agents.list.length > 0) {
        config.agents.list[0].name = agentData.name;
        if (!config.agents.list[0].identity) config.agents.list[0].identity = {};
        config.agents.list[0].identity.avatar = agentData.avatar || '';
      } else {
        config.agents.list.push({
          id: 'main',
          name: agentData.name,
          identity: { avatar: agentData.avatar || '' },
        });
      }
      saveConfig(config);

      return { ok: true };
    } catch (e) {
      console.error(`[${APP_NAME}] Failed to save agent workspace:`, e);
      return { ok: false, error: e.message };
    }
  });

  // ── OpenClaw 核心版本管理 ──

  ipcMain.handle('install-openclaw-core', async (_, version) => {
    const coreDir = getCoreDir();
    const env = getOpenClawEnv();
    const npmBin = getNpmBin();

    fs.mkdirSync(coreDir, { recursive: true });
    console.log(`[${APP_NAME}] install-openclaw-core: npmBin=${npmBin}, coreDir=${coreDir}, version=${version}`);

    // Resolve 'latest' to actual version number
    let resolvedVersion = version;
    if (version === 'latest') {
      console.log(`[${APP_NAME}] Resolving 'latest' version via npm view...`);
      resolvedVersion = await new Promise((resolve) => {
        const viewEnv = { ...env };
        const proc = spawn(npmBin, ['view', 'openclaw', 'version'], {
          env: viewEnv, cwd: coreDir, stdio: ['pipe', 'pipe', 'pipe'], shell: true,
        });
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.stderr.on('data', (d) => { stderr += d.toString(); });
        proc.on('exit', (code) => {
          console.log(`[${APP_NAME}] npm view exit: code=${code}, stdout="${stdout.trim()}", stderr="${stderr.trim()}"`);
          resolve(code === 0 ? stdout.trim() : null);
        });
        proc.on('error', (err) => {
          console.error(`[${APP_NAME}] npm view spawn error:`, err.message);
          resolve(null);
        });
        setTimeout(() => { proc.kill(); resolve(null); }, 30000);
      });
      if (!resolvedVersion) {
        console.error(`[${APP_NAME}] Failed to resolve latest version`);
        return { ok: false, error: '无法查询最新版本，请检查网络和npm源设置' };
      }
    }

    console.log(`[${APP_NAME}] Installing openclaw@${resolvedVersion}`);
    const versionDir = path.join(coreDir, resolvedVersion);
    fs.mkdirSync(versionDir, { recursive: true });

    // Write package.json with openclaw as dependency
    const pkgJson = {
      name: 'openclaw-core',
      version: '1.0.0',
      private: true,
      dependencies: { openclaw: resolvedVersion },
    };
    fs.writeFileSync(path.join(versionDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

    // Build npm install args with registry if configured
    const installArgs = ['install'];
    if (env.NPM_CONFIG_REGISTRY) {
      installArgs.push('--registry', env.NPM_CONFIG_REGISTRY);
      console.log(`[${APP_NAME}] Using registry: ${env.NPM_CONFIG_REGISTRY}`);
    }
    console.log(`[${APP_NAME}] Running: ${npmBin} ${installArgs.join(' ')} in ${versionDir}`);

    // Send progress events to renderer
    const sendProgress = (percent, phase) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('core-install-progress', {
          version: resolvedVersion,
          percent,
          phase,
        });
      }
    };

    sendProgress(10, 'resolving');

    return new Promise((resolve) => {
      const proc = spawn(npmBin, installArgs, {
        env,
        cwd: versionDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });

      let stdout = '';
      let stderr = '';
      let lastProgress = 10;

      proc.stdout.on('data', (d) => {
        const chunk = d.toString();
        stdout += chunk;
        // Parse npm install output for progress hints
        if (chunk.includes('reify:') || chunk.includes('fetching') || chunk.includes('http fetch')) {
          lastProgress = Math.min(lastProgress + 3, 85);
          sendProgress(lastProgress, 'downloading');
        }
      });
      proc.stderr.on('data', (d) => {
        const chunk = d.toString();
        stderr += chunk;
        // npm warn/http progress also in stderr
        if (chunk.includes('reify:') || chunk.includes('http') || chunk.includes('fetch')) {
          lastProgress = Math.min(lastProgress + 3, 85);
          sendProgress(lastProgress, 'downloading');
        }
      });

      sendProgress(15, 'downloading');

      proc.on('error', (err) => {
        console.error(`[${APP_NAME}] npm install spawn error:`, err.message);
        sendProgress(0, 'failed');
        resolve({ ok: false, error: err.message, stdout, stderr });
      });

      proc.on('exit', (code) => {
        if (code === 0) {
          console.log(`[${APP_NAME}] openclaw@${resolvedVersion} installed successfully`);
          sendProgress(100, 'done');
          setCurrentCoreLink(resolvedVersion, versionDir);
          resolve({ ok: true, version: resolvedVersion, stdout, stderr });
        } else {
          console.error(`[${APP_NAME}] npm install failed: code=${code}, stderr="${stderr.slice(0, 500)}"`);
          sendProgress(0, 'failed');
          resolve({ ok: false, error: `npm install failed with code ${code}`, stdout, stderr });
        }
      });

      setTimeout(() => {
        proc.kill();
        sendProgress(0, 'failed');
        resolve({ ok: false, error: '安装超时', stdout, stderr });
      }, 300000);
    });
  });

  ipcMain.handle('has-openclaw-core', () => {
    return getOpenClawEntry() !== null;
  });

  ipcMain.handle('list-openclaw-versions', () => {
    return listInstalledCoreVersions();
  });

  ipcMain.handle('switch-openclaw-version', async (_, version) => {
    const coreDir = getCoreDir();
    const versionDir = path.join(coreDir, version);
    if (!fs.existsSync(versionDir)) {
      return { ok: false, error: `Version directory not found: ${versionDir}` };
    }
    setCurrentCoreLink(version, versionDir);
    return restartGateway();
  });

  ipcMain.handle('delete-openclaw-version', (_, version) => {
    const coreDir = getCoreDir();
    const versionDir = path.join(coreDir, version);
    try {
      if (fs.existsSync(versionDir)) {
        fs.rmSync(versionDir, { recursive: true, force: true });
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  });

  ipcMain.handle('get-openclaw-available-versions', async () => {
    const env = getOpenClawEnv();
    const npmBin = getNpmBin();
    const coreDir = getCoreDir();
    fs.mkdirSync(coreDir, { recursive: true });

    console.log(`[${APP_NAME}] get-openclaw-available-versions: npmBin=${npmBin}, coreDir=${coreDir}, registry=${env.NPM_CONFIG_REGISTRY || 'default'}`);

    const versions = await new Promise((resolve) => {
      const proc = spawn(npmBin, ['view', 'openclaw', 'versions', '--json'], {
        env,
        cwd: coreDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('exit', (code) => {
        console.log(`[${APP_NAME}] npm view versions exit: code=${code}, stdout.length=${stdout.length}, stderr="${stderr.trim().substring(0, 200)}"`);
        if (code !== 0) {
          console.error(`[${APP_NAME}] npm view versions failed: code=${code}, stderr="${stderr.trim()}"`);
          resolve(null);
          return;
        }
        try {
          const parsed = JSON.parse(stdout.trim());
          const list = Array.isArray(parsed) ? parsed : [parsed];
          console.log(`[${APP_NAME}] npm view versions: got ${list.length} versions`);
          resolve(list);
        } catch (e) {
          console.error(`[${APP_NAME}] npm view versions JSON parse error: ${e.message}, raw="${stdout.trim().substring(0, 200)}"`);
          resolve(null);
        }
      });
      proc.on('error', (err) => {
        console.error(`[${APP_NAME}] npm view versions spawn error: ${err.message}`);
        resolve(null);
      });
      setTimeout(() => {
        console.error(`[${APP_NAME}] npm view versions timed out after 30s`);
        proc.kill();
        resolve(null);
      }, 30000);
    });

    if (!versions) return { ok: false, error: 'Failed to fetch versions' };
    return { ok: true, versions };
  });

  ipcMain.handle('upgrade-openclaw', async (_, version) => {
    const env = getOpenClawEnv();
    const npmBin = getNpmBin();
    const coreDir = getCoreDir();
    fs.mkdirSync(coreDir, { recursive: true });

    // Step 1: Get target version (use provided version or resolve latest)
    let targetVersion = version;
    if (!targetVersion) {
      const latestVersion = await new Promise((resolve) => {
        const proc = spawn(npmBin, ['view', 'openclaw', 'version'], {
          env,
          cwd: coreDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
        });
        let stdout = '';
        proc.stdout.on('data', (d) => { stdout += d.toString(); });
        proc.on('exit', (code) => {
          resolve(code === 0 ? stdout.trim() : null);
        });
        proc.on('error', () => { resolve(null); });
        setTimeout(() => { proc.kill(); resolve(null); }, 30000);
      });

      if (!latestVersion) {
        return { ok: false, error: 'Failed to get latest version' };
      }
      targetVersion = latestVersion;
    }

    const settings = getSettings();
    if (targetVersion === settings.core?.version) {
      return { ok: true, version: targetVersion, alreadyLatest: true };
    }

    // Step 2: Install target version
    const versionDir = path.join(coreDir, targetVersion);
    fs.mkdirSync(versionDir, { recursive: true });

    const pkgJson = {
      name: 'openclaw-core',
      version: '1.0.0',
      private: true,
      dependencies: { openclaw: targetVersion },
    };
    fs.writeFileSync(path.join(versionDir, 'package.json'), JSON.stringify(pkgJson, null, 2));

    const installArgs = ['install'];
    if (env.NPM_CONFIG_REGISTRY) {
      installArgs.push('--registry', env.NPM_CONFIG_REGISTRY);
    }

    const installResult = await new Promise((resolve) => {
      const proc = spawn(npmBin, installArgs, {
        env,
        cwd: versionDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true,
      });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (d) => { stdout += d.toString(); });
      proc.stderr.on('data', (d) => { stderr += d.toString(); });
      proc.on('exit', (code) => {
        resolve({ ok: code === 0, stdout, stderr });
      });
      proc.on('error', (err) => {
        resolve({ ok: false, error: err.message });
      });
      setTimeout(() => { proc.kill(); resolve({ ok: false, error: '安装超时' }); }, 300000);
    });

    if (!installResult.ok) {
      return { ok: false, error: installResult.error || 'npm install failed' };
    }

    // Step 3: Switch to new version
    setCurrentCoreLink(targetVersion, versionDir);

    // Step 4: Restart gateway
    await restartGateway();
    return { ok: true, version: targetVersion };
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
    if (permission === 'font-access' || permission === 'media') return callback(true);
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

  const settings = getSettings();

  // First-run: don't start gateway until user completes setup wizard
  if (!settings.setupDone) {
    console.log(`[${APP_NAME}] First run, waiting for setup wizard`);
    return;
  }

  const connectionMode = settings.connection?.mode || 'local';

  if (connectionMode === 'remote') {
    await connectRemoteGateway(settings);
  } else {
    const openclawEntry = getOpenClawEntry();
    if (!openclawEntry) {
      console.log(`[${APP_NAME}] OpenClaw core not found, waiting for user to install`);
    } else {
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
    }
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
