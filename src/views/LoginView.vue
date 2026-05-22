<template>
  <div class="login-view">
    <div class="login-card">
      <div class="login-logo"><img src="@assets/images/logo/clawshell_logo.png" alt="ClawShell" /></div>
      <h1 class="login-title">虾壳 ClawShell</h1>
      <p class="login-subtitle">请输入密码登录</p>
      <div class="login-form">
        <input
          v-model="password"
          type="password"
          class="login-input"
          placeholder="输入访问密码"
          @keyup.enter="handleLogin"
        />
        <button class="login-btn" @click="handleLogin" :disabled="loading">
          {{ loading ? '验证中...' : '登录' }}
        </button>
      </div>
      <p v-if="error" class="login-error">{{ error }}</p>
    </div>
    <AppBottomBar @repair="() => {}" @contact="() => {}" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useGatewayStore } from '@/stores/gateway'
import AppBottomBar from '@/components/AppBottomBar.vue'

const router = useRouter()
const gatewayStore = useGatewayStore()

const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  if (!password.value) return
  loading.value = true
  error.value = ''

  if (password.value === gatewayStore.token) {
    router.replace({ name: 'chat' })
  } else {
    error.value = '密码错误'
  }
  loading.value = false
}
</script>

<style scoped>
.login-view {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg);
}

.login-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-lg);
}

.login-logo {
  width: 72px;
  height: 72px;
}

.login-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.login-title {
  font-size: var(--font-size-2xl);
  font-weight: 700;
  color: var(--color-primary);
}

.login-subtitle {
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  width: 280px;
}

.login-input {
  width: 100%;
  padding: var(--spacing-md);
  font-size: var(--font-size-md);
  text-align: center;
}

.login-btn {
  width: 100%;
  padding: var(--spacing-md);
  background: var(--color-primary);
  color: white;
  border-radius: var(--radius-sm);
  font-size: var(--font-size-md);
  font-weight: 600;
  transition: background var(--transition-fast);
}

.login-btn:hover:not(:disabled) {
  background: var(--color-primary-hover);
}

.login-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.login-error {
  color: var(--color-error);
  font-size: var(--font-size-sm);
}
</style>
