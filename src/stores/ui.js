import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useUiStore = defineStore('ui', () => {
  const theme = ref('light')
  const language = ref('zh-CN')
  const sidebarExpanded = ref(false)
  const currentRoute = ref('chat')

  const isDark = computed(() => theme.value === 'dark')

  function setTheme(newTheme) {
    theme.value = newTheme
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  function toggleSidebar() {
    sidebarExpanded.value = !sidebarExpanded.value
  }

  // Initialize theme from document attribute
  function init() {
    const saved = document.documentElement.getAttribute('data-theme') || 'light'
    setTheme(saved)
  }

  return { theme, language, sidebarExpanded, currentRoute, isDark, setTheme, toggleTheme, toggleSidebar, init }
})
