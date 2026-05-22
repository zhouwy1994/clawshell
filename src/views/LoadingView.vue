<template>
  <div class="loading-view">
    <div class="loading-content">
      <div class="loading-logo"><img src="@assets/images/logo/clawshell_logo_vector.svg" alt="ClawShell" /></div>
      <div class="loading-bar-track">
        <div class="loading-bar-fill" :style="{ width: progress + '%' }"></div>
      </div>
      <p class="loading-status">{{ statusText }}</p>
    </div>
    <AppBottomBar @repair="$emit('repair')" @contact="$emit('contact')" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import AppBottomBar from '@/components/AppBottomBar.vue'
import { currentLocale } from '@/i18n'

defineEmits(['repair', 'contact'])

const progress = ref(0)

const statusMessages = {
  'zh-CN': [
    '正在启动 AI 引擎...',
    '检查配置文件...',
    '启动OpenClaw内核...',
    '加载模型配置...',
    '加载渠道插件...',
  ],
  en: [
    'Starting AI Engine...',
    'Checking Config...',
    'Starting OpenClaw Kernel...',
    'Loading Model Config...',
    'Loading Channel Plugins...',
  ],
}

const messages = computed(() => statusMessages[currentLocale.value] || statusMessages['zh-CN'])
const statusText = ref(messages.value[0])

let timer = null
let messageIndex = 0

onMounted(() => {
  timer = setInterval(() => {
    if (progress.value < 90) {
      progress.value += Math.random() * 8 + 2
      if (progress.value > 90) progress.value = 90
    }

    messageIndex = (messageIndex + 1) % messages.value.length
    statusText.value = messages.value[messageIndex]
  }, 800)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<style scoped>
.loading-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.loading-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xl);
}

.loading-logo {
  width: 400px;
  height: 400px;
  animation: float 2s ease-in-out infinite;
}

.loading-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.loading-bar-track {
  width: 240px;
  height: 4px;
  background: var(--color-bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.loading-bar-fill {
  height: 100%;
  background: var(--color-primary);
  border-radius: 2px;
  transition: width 0.5s ease;
}

.loading-status {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}
</style>
