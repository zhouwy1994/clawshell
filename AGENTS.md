# AGENTS.md

## Project

ClawShell is an Electron desktop AI assistant client built on OpenClaw. Its goal is to expose the common OpenClaw user workflows through a simple GUI: chat, model config, assistant config, channel config, and skill store.

Do not expand the app into OpenClaw agent development/debug tooling or a standalone gateway service. ClawShell owns and manages the Gateway child process when running in local mode.

## Tech Stack

- Electron 35+
- Vue 3 SFC with Composition API and Vite 6
- Vue Router 4 in hash mode
- Pinia stores
- Native CSS with CSS variables for theming
- Electron IPC through `contextBridge`
- Renderer-direct WebSocket communication with the OpenClaw Gateway
- Plain JavaScript, no TypeScript

## Important Architecture Rules

- Main process owns all file I/O and most network requests.
- Renderer code calls IPC only through `src/lib/ipc.js`; do not call `window.clawshell` directly from components.
- Chat traffic goes directly from the renderer to the Gateway via `src/composables/gateway-client.js`, not through IPC relay.
- Gateway supports local mode and remote mode.
- Local Gateway ports are auto-detected in the `18789` to `18799` range.
- Gateway config must include `allowInsecureAuth: true` under `gateway.controlUi`, otherwise the WebSocket handshake can fail with `missing scope`.
- The bottom bar actions, including repair/support, should remain available regardless of Gateway state.

## Key Files

- `electron/main.js`: Electron main process, Gateway lifecycle, IPC handlers, config I/O, core management, skills, channels, diagnostics, window/tray behavior.
- `electron/preload.js`: `contextBridge` API exposure.
- `src/lib/ipc.js`: Renderer IPC wrapper and non-Electron fallbacks.
- `src/composables/gateway-client.js`: Direct WebSocket client for Gateway protocol.
- `src/stores/gateway.js`: Gateway state.
- `src/stores/config.js`: OpenClaw config cache.
- `src/stores/chat.js`: Sessions, messages, streaming state, agents, models, tool messages.
- `src/stores/ui.js`: Theme, language, sidebar, route preferences.
- `src/views/ChatView.vue`: Main chat view.
- `src/views/ModelsView.vue`: Model configuration.
- `src/views/ChannelsView.vue`: Channel configuration.
- `src/views/AssistantsView.vue`: Assistant configuration.
- `src/views/SkillsView.vue`: Skill store.
- `src/views/SettingsView.vue`: Settings.

## Config And Data

- OpenClaw config: `~/.clawshell/.openclaw/openclaw.json`
- ClawShell settings: `~/.clawshell/clawshell-settings.json`
- `CLAWSHELL_HOME` can override the default data root.
- Agent workspace files live under `.openclaw/workspace` or `.openclaw/workspace-{agentId}`.
- Installed skills live under `.openclaw/skills/{slug}`.
- OpenClaw core versions live under `~/.clawshell/core`.

Keep ClawShell-specific state in `clawshell-settings.json`. Avoid polluting the OpenClaw config namespace.

## Coding Conventions

- Vue SFC order: `<template>`, then `<script setup>`, then `<style scoped>`.
- Use Composition API exclusively.
- Use native CSS and existing CSS variables. Do not add a preprocessor.
- Use Pinia for shared state; use local `ref` or `reactive` for component-local state.
- Keep one component per file and use PascalCase component names.
- Be careful with `v-model` on reactive objects. Prefer explicit sync and exposed validation state where the existing code uses that pattern.
- Keep edits scoped to the requested behavior and existing module boundaries.
- Read and write UTF-8 explicitly when using PowerShell for project files.

## Development Commands

Use the scripts in `package.json` as the source of truth. Electron development must pass the app's dev flag where required, otherwise Electron can load stale `dist` output.

Typical workflow:

```powershell
pnpm install
pnpm dev
```

Before finalizing substantial changes, run the relevant build, lint, or test command available in `package.json`.

## UI Notes

- Product name: `虾壳 ClawShell`
- Logo concept: lobster icon
- Brand color: `#FF6B35`
- Light primary: `#6C5CE7`
- Dark primary: `#8B7CFF`
- Accent: `#00C2A8` / `#29E0C2`
- Terminology: Agent = 助手, Skill = 技能, Channel = 渠道

Preserve the existing visual language unless the task explicitly asks for redesign work.
