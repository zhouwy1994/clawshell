import { ref, computed } from 'vue'
import zhCN from './zh-CN.js'
import en from './en.js'

const messages = { 'zh-CN': zhCN, en }
const locale = ref('zh-CN')

function t(key) {
  const dict = messages[locale.value] || zhCN
  return dict[key] || zhCN[key] || key
}

function setLocale(lang) {
  locale.value = lang
}

const currentLocale = computed(() => locale.value)

export { t, setLocale, currentLocale, locale }
