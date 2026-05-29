import LoadingView from '@/views/LoadingView.vue'

export const routes = [
  {
    path: '/',
    name: 'loading',
    component: LoadingView,
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('@/views/LoginView.vue'),
  },
  {
    path: '/setup',
    name: 'setup',
    component: () => import('@/views/SetupWizard.vue'),
  },
  {
    path: '/chat',
    name: 'chat',
    component: () => import('@/views/ChatView.vue'),
    meta: { requiresGateway: true },
  },
  {
    path: '/assistants',
    name: 'assistants',
    component: () => import('@/views/AssistantsView.vue'),
    meta: { requiresGateway: true },
  },
  {
    path: '/channels',
    name: 'channels',
    component: () => import('@/views/ChannelsView.vue'),
    meta: { requiresGateway: true },
  },
  {
    path: '/models',
    name: 'models',
    component: () => import('@/views/ModelsView.vue'),
    meta: { requiresGateway: true },
  },
  {
    path: '/skills',
    name: 'skills',
    component: () => import('@/views/SkillsView.vue'),
    meta: { requiresGateway: true },
  },
  {
    path: '/schedules',
    name: 'schedules',
    component: () => import('@/views/SchedulesView.vue'),
    meta: { requiresGateway: true },
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
  },
]
