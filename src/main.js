import { createApp } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import { createPinia } from 'pinia'
import App from './App.vue'
import { routes } from './router/index.js'
import './styles/variables.css'
import './styles/theme-dark.css'
import './styles/theme-light.css'

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

const pinia = createPinia()
const app = createApp(App)

app.use(pinia)
app.use(router)
app.mount('#app')
