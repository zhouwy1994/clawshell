<template>
  <div class="skills-view">
    <div class="skills-layout">
      <!-- Left sidebar: categories -->
      <div class="cat-sidebar">
        <div class="cat-sidebar-header">{{ t('skills.catTitle') }}</div>
        <div v-if="loadingCats" class="cat-loading">{{ t('skills.loading') }}</div>
        <div v-for="cat in categories" :key="cat.l1_id" class="cat-group">
          <div
            class="cat-l1"
            :class="{ active: selectedL1 === cat.l1_id }"
            @click="selectL1(cat.l1_id)"
          >
            <span class="cat-l1-name">{{ catName(cat) }}</span>
            <span class="cat-l1-arrow" :class="{ expanded: selectedL1 === cat.l1_id }">›</span>
          </div>
          <div v-if="selectedL1 === cat.l1_id && subcategories.length" class="cat-l2-list">
            <div
              v-for="sub in subcategories"
              :key="sub.l2_id"
              class="cat-l2"
              :class="{ active: selectedL2 === sub.l2_id }"
              @click="selectL2(sub.l2_id)"
            >
              {{ subName(sub) }}
              <span class="cat-l2-count">{{ sub.skill_count }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Right: skills grid -->
      <div class="skills-content">
        <!-- Search bar (always visible) -->
        <div class="search-bar">
          <input
            v-model="searchKeyword"
            type="text"
            class="search-input"
            :placeholder="t('skills.searchPlaceholder')"
            @keyup.enter="doSearch"
          />
          <button v-if="searchKeyword" class="btn btn-sm search-btn" @click="doSearch">{{ t('skills.search') }}</button>
          <button v-if="isSearchMode" class="btn btn-sm search-clear" @click="clearSearch">{{ t('skills.clearSearch') }}</button>
        </div>

        <div class="install-target-bar">
          <div class="target-title">
            <span class="target-title-icon" v-html="getIcon('zap', 14)"></span>
            <span>{{ t('skills.installTarget') }}</span>
          </div>
          <div class="target-scope-toggle" role="radiogroup" :aria-label="t('skills.installTarget')">
            <button
              type="button"
              class="target-toggle"
              :class="{ active: installScope === 'global' }"
              role="radio"
              :aria-checked="installScope === 'global'"
              @click="installScope = 'global'"
            >
              {{ t('skills.targetGlobal') }}
            </button>
            <button
              type="button"
              class="target-toggle"
              :class="{ active: installScope === 'agent' }"
              role="radio"
              :aria-checked="installScope === 'agent'"
              @click="installScope = 'agent'"
            >
              {{ t('skills.targetAssistant') }}
            </button>
          </div>
          <label v-if="installScope === 'agent'" class="target-agent-picker">
            <span class="target-agent-label">{{ t('skills.targetAssistantLabel') }}</span>
            <span class="target-select-wrap">
              <select v-model="selectedAgentId" class="target-select">
                <option v-for="agent in agentOptions" :key="agent.id" :value="agent.id">
                  {{ agent.name || agent.id }}
                </option>
              </select>
              <span class="target-select-chevron" v-html="getIcon('chevron-down', 12)"></span>
            </span>
          </label>
          <span class="target-hint">
            <span class="target-hint-dot"></span>
            {{ activeSkillTargetLabel }}
          </span>
        </div>

        <div v-if="!selectedL1 && !isSearchMode" class="skills-empty">
          <div class="empty-icon">⚡</div>
          <p>{{ t('skills.loading') }}</p>
        </div>

        <template v-else-if="selectedL1 || isSearchMode">
          <div class="skills-header">
            <h2 v-if="isSearchMode">{{ t('skills.searchResult').replace('{keyword}', searchKeyword) }}</h2>
            <h2 v-else>{{ currentL1Name }}{{ currentL2Name ? ' / ' + currentL2Name : '' }}</h2>
            <span class="skills-total">{{ t('skills.total').replace('{n}', total) }}</span>
            <span class="skills-copyright">{{ t('skills.from') }} <a href="https://skillhub.cn/" target="_blank">SkillHub</a></span>
          </div>

          <div v-if="loadingSkills" class="skills-loading">{{ t('skills.loading') }}</div>

          <div v-else-if="skills.length === 0" class="skills-empty">
            <p v-if="isSearchMode">{{ t('skills.noResults') }}</p>
            <p v-else>{{ t('skills.empty') }}</p>
          </div>

          <div v-else class="skills-grid">
            <div v-for="skill in skills" :key="skill.slug" class="skill-card model-card">
              <div class="skill-card-top">
                <h4 class="skill-name">{{ skill.name || skill.slug }}</h4>
                <span v-if="needsApiKey(skill)" class="skill-badge api-key-badge">{{ t('skills.needsApiKey') }}</span>
              </div>
              <p
                class="skill-desc"
                :title="skillDesc(skill)"
              >{{ skillDesc(skill) }}</p>
              <div class="skill-meta">
                <span v-if="skill.ownerName" class="skill-owner">{{ skill.ownerName }}</span>
                <span v-if="skill.version" class="skill-version">v{{ skill.version }}</span>
                <span v-if="skill.installs" class="skill-installs">{{ t('skills.installs').replace('{n}', formatNum(skill.installs)) }}</span>
                <span v-if="isInstalled(skill.slug)" class="skill-scope">{{ activeSkillTargetLabel }}</span>
              </div>
              <div class="skill-actions">
                <template v-if="isInstalling(skill.slug)">
                  <span class="skill-status installing">{{ t('skills.installing') }}</span>
                </template>
                <template v-else-if="isUninstalling(skill.slug)">
                  <span class="skill-status uninstalling">{{ t('skills.uninstalling') }}</span>
                </template>
                <template v-else-if="isInstalled(skill.slug)">
                  <button class="btn btn-sm btn-readme" @click="openReadme(skill.slug)">{{ t('skills.viewReadme') }}</button>
                  <span class="skill-status installed">{{ t('skills.installed') }}</span>
                  <button
                    v-if="installScope === 'global' && isEnabled(skill.slug)"
                    class="btn btn-sm btn-enabled"
                    @click="toggleEnable(skill.slug, false)"
                  >{{ t('skills.enabling') }}</button>
                  <button
                    v-else-if="installScope === 'global'"
                    class="btn btn-sm btn-enable"
                    @click="toggleEnable(skill.slug, true)"
                  >{{ t('skills.enable') }}</button>
                  <button class="btn btn-sm btn-uninstall" @click="handleUninstall(skill.slug)">{{ t('skills.uninstall') }}</button>
                </template>
                <template v-else>
                  <button class="btn btn-sm btn-install-skill" @click="handleInstall(skill.slug)">{{ t('skills.install') }}</button>
                </template>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div v-if="totalPage > 1" class="pagination">
            <button class="btn btn-sm" :disabled="page <= 1" @click="goPage(page - 1)">{{ t('skills.prevPage') }}</button>
            <span class="page-info">{{ page }} / {{ totalPage }}</span>
            <button class="btn btn-sm" :disabled="page >= totalPage" @click="goPage(page + 1)">{{ t('skills.nextPage') }}</button>
          </div>
        </template>
      </div>
    </div>

    <!-- Readme modal -->
    <div v-if="readmeOpen" class="readme-overlay" @click.self="readmeOpen = false">
      <div class="readme-modal">
        <div class="readme-header">
          <span>{{ t('skills.readmeTitle').replace('{slug}', readmeSlug) }}</span>
          <button class="readme-close" @click="readmeOpen = false">✕</button>
        </div>
        <pre class="readme-body">{{ readmeContent }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import { ipc } from '@/lib/ipc'
import { useConfigStore } from '@/stores/config'
import { t, locale } from '@/i18n'
import { getIcon } from '@/lib/icons'

const configStore = useConfigStore()

const categories = ref([])
const subcategories = ref([])
const selectedL1 = ref(null)
const selectedL2 = ref(null)
const skills = ref([])
const page = ref(1)
const totalPage = ref(0)
const total = ref(0)
const loadingCats = ref(false)
const loadingSkills = ref(false)
const installedSlugs = ref([])
const installingSet = reactive({})
const uninstallingSet = reactive({})
const readmeSlug = ref('')
const readmeContent = ref('')
const readmeOpen = ref(false)
const searchKeyword = ref('')
const isSearchMode = ref(false)
const installScope = ref('global')
const selectedAgentId = ref('main')

const currentL1Name = computed(() => {
  const cat = categories.value.find(c => c.l1_id === selectedL1.value)
  return catName(cat) || ''
})

const currentL2Name = computed(() => {
  const sub = subcategories.value.find(s => s.l2_id === selectedL2.value)
  return subName(sub) || ''
})

const skillEntries = computed(() => {
  return configStore.config?.skills?.entries || {}
})

const agentOptions = computed(() => {
  const list = configStore.config?.agents?.list
  if (Array.isArray(list) && list.length > 0) {
    return list.map(agent => ({
      id: agent.id || 'main',
      name: agent.name || agent.identity?.name || agent.id || 'main',
    }))
  }
  return [{ id: 'main', name: 'main' }]
})

const activeSkillTarget = computed(() => {
  if (installScope.value === 'agent') {
    return { scope: 'agent', agentId: selectedAgentId.value || 'main' }
  }
  return { scope: 'global' }
})

const activeSkillTargetLabel = computed(() => {
  if (installScope.value === 'agent') {
    const agent = agentOptions.value.find(item => item.id === selectedAgentId.value)
    return t('skills.targetAssistantScope').replace('{name}', agent?.name || selectedAgentId.value || 'main')
  }
  return t('skills.targetGlobal')
})

function catName(cat) {
  if (!cat) return ''
  return locale.value === 'en' && cat.l1_name_en ? cat.l1_name_en : cat.l1_name
}

function subName(sub) {
  if (!sub) return ''
  return locale.value === 'en' && sub.l2_name_en ? sub.l2_name_en : sub.l2_name
}

function skillDesc(skill) {
  if (!skill) return ''
  return locale.value === 'en' ? (skill.description || '') : (skill.description_zh || skill.description || '')
}

function isInstalled(slug) {
  return installedSlugs.value.includes(slug)
}

function isEnabled(slug) {
  return skillEntries.value[slug]?.enabled === true
}

function isInstalling(slug) {
  return !!installingSet[slug]
}

function isUninstalling(slug) {
  return !!uninstallingSet[slug]
}

function needsApiKey(skill) {
  const val = skill?.labels?.requires_api_key
  return val === 'true' || val === true
}

function formatNum(n) {
  if (n >= 10000) return (n / 10000).toFixed(1) + (locale.value === 'en' ? 'w' : '万')
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

async function loadCategories() {
  loadingCats.value = true
  try {
    categories.value = await ipc.fetchSkillCategories()
  } catch (err) {
    console.error('Failed to load categories:', err)
  }
  loadingCats.value = false
}

async function loadSubcategories(l1Id) {
  try {
    const data = await ipc.fetchSkillSubcategories(l1Id)
    subcategories.value = data.children || []
  } catch (err) {
    console.error('Failed to load subcategories:', err)
    subcategories.value = []
  }
}

async function loadInstalled() {
  try {
    installedSlugs.value = await ipc.listInstalledSkills(activeSkillTarget.value)
  } catch (err) {
    console.error('Failed to load installed skills:', err)
    installedSlugs.value = []
  }
}

async function loadSkills() {
  if (!selectedL1.value || !selectedL2.value) return
  loadingSkills.value = true
  try {
    const data = await ipc.fetchSkills({
      l1Id: selectedL1.value,
      l2Id: selectedL2.value,
      page: page.value,
      pageSize: 20,
    })
    skills.value = data.items || []
    total.value = data.total || 0
    totalPage.value = data.totalPage || 0
  } catch (err) {
    console.error('Failed to load skills:', err)
    skills.value = []
  }
  loadingSkills.value = false
}

async function selectL1(l1Id) {
  if (selectedL1.value === l1Id) {
    selectedL1.value = null
    selectedL2.value = null
    subcategories.value = []
    skills.value = []
    return
  }
  selectedL1.value = l1Id
  selectedL2.value = null
  page.value = 1
  await loadSubcategories(l1Id)
  if (subcategories.value.length > 0) {
    selectedL2.value = subcategories.value[0].l2_id
    await loadSkills()
  } else {
    skills.value = []
  }
}

async function selectL2(l2Id) {
  selectedL2.value = l2Id
  page.value = 1
  await loadSkills()
}

async function goPage(p) {
  page.value = p
  if (isSearchMode.value) {
    loadingSkills.value = true
    try {
      const data = await ipc.searchSkills({ keyword: searchKeyword.value.trim(), page: p, pageSize: 20 })
      skills.value = data.items || []
      total.value = data.total || 0
      totalPage.value = data.totalPage || 0
    } catch { skills.value = [] }
    loadingSkills.value = false
  } else {
    await loadSkills()
  }
}

async function handleInstall(slug) {
  installingSet[slug] = true
  try {
    await ipc.installSkill(slug, activeSkillTarget.value)
    await loadInstalled()
    if (installScope.value === 'global') {
      await configStore.saveSkillEntry(slug, true)
    }
  } catch (err) {
    console.error('Install failed:', err)
  }
  installingSet[slug] = false
}

async function handleUninstall(slug) {
  uninstallingSet[slug] = true
  try {
    await ipc.uninstallSkill(slug, activeSkillTarget.value)
    await loadInstalled()
  } catch (err) {
    console.error('Uninstall failed:', err)
  }
  uninstallingSet[slug] = false
}

async function toggleEnable(slug, enabled) {
  await configStore.saveSkillEntry(slug, enabled)
}

async function openReadme(slug) {
  readmeSlug.value = slug
  readmeOpen.value = true
  readmeContent.value = t('skills.readmeLoading')
  try {
    let content = await ipc.readSkillFile(slug, 'SKILL.md', activeSkillTarget.value)
    if (!content) content = await ipc.readSkillFile(slug, 'README.md', activeSkillTarget.value)
    readmeContent.value = content || t('skills.readmeNotFound')
  } catch {
    readmeContent.value = t('skills.readmeError')
  }
}

async function doSearch() {
  const kw = searchKeyword.value.trim()
  if (!kw) return
  isSearchMode.value = true
  page.value = 1
  loadingSkills.value = true
  try {
    const data = await ipc.searchSkills({ keyword: kw, page: 1, pageSize: 20 })
    skills.value = data.items || []
    total.value = data.total || 0
    totalPage.value = data.totalPage || 0
  } catch (err) {
    console.error('Search failed:', err)
    skills.value = []
  }
  loadingSkills.value = false
}

function clearSearch() {
  searchKeyword.value = ''
  isSearchMode.value = false
  skills.value = []
  total.value = 0
  totalPage.value = 0
  if (selectedL1.value && selectedL2.value) {
    loadSkills()
  }
}

onMounted(async () => {
  await configStore.load()
  selectedAgentId.value = agentOptions.value[0]?.id || 'main'
  await loadCategories()
  await loadInstalled()
  // Auto-select first category on mount
  if (categories.value.length > 0) {
    const first = categories.value[0]
    selectedL1.value = first.l1_id
    await loadSubcategories(first.l1_id)
    if (subcategories.value.length > 0) {
      selectedL2.value = subcategories.value[0].l2_id
    }
  }
})

watch(selectedL2, () => {
  if (selectedL2.value) loadSkills()
})

watch([installScope, selectedAgentId], () => {
  loadInstalled()
})
</script>

<style scoped>
.skills-view {
  height: 100%;
  overflow: hidden;
  background: var(--color-bg);
}

.skills-layout {
  display: flex;
  height: 100%;
}

/* ── Category sidebar ── */
.cat-sidebar {
  width: 210px;
  min-width: 210px;
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  overflow-y: auto;
  padding: 16px 12px;
}

.cat-sidebar-header {
  padding: 0 8px 14px;
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--color-text);
  letter-spacing: 0.5px;
}

.cat-loading {
  padding: 20px;
  text-align: center;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
}

.cat-group {
  margin-bottom: 4px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--color-bg-card);
}

.cat-l1 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  transition: all 0.2s;
}

.cat-l1:hover {
  background: rgba(255, 107, 53, 0.08);
  color: var(--color-text);
}

.cat-l1.active {
  color: var(--color-primary);
  background: var(--color-primary-light);
  font-weight: 600;
}

.cat-l1-arrow {
  font-size: 16px;
  transition: transform 0.25s ease;
  color: var(--color-text-tertiary);
  font-weight: 300;
}

.cat-l1-arrow.expanded {
  transform: rotate(90deg);
  color: var(--color-primary);
}

.cat-l2-list {
  padding: 4px 6px 8px;
  border-top: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
}

.cat-l2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 12px;
  margin: 2px 0;
  cursor: pointer;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  border-radius: var(--radius-sm);
  transition: all 0.15s;
}

.cat-l2:hover {
  color: var(--color-text);
  background: rgba(255, 107, 53, 0.08);
}

.cat-l2.active {
  color: var(--color-primary);
  font-weight: 600;
  background: var(--color-primary-light);
}

.cat-l2-count {
  font-size: 10px;
  background: var(--color-bg-secondary);
  padding: 1px 7px;
  border-radius: 10px;
  color: var(--color-text-tertiary);
  border: 1px solid var(--color-border);
}

/* ── Skills content ── */
.skills-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 28px;
}

/* ── Search bar ── */
.search-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.search-input {
  flex: 1;
  padding: 10px 16px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  outline: none;
  transition: border-color 0.2s;
}

.search-input::placeholder {
  color: var(--color-text-tertiary);
}

.search-input:focus {
  border-color: var(--color-primary);
}

.install-target-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
  padding: 8px 10px;
  background: linear-gradient(180deg, var(--color-bg-secondary), var(--color-bg-card));
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.04) inset;
}

.target-title {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-secondary);
}

.target-title-icon {
  display: inline-flex;
  color: var(--color-primary);
}

.target-title-icon :deep(svg),
.target-select-chevron :deep(svg) {
  display: block;
}

.target-scope-toggle {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 2px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
}

.target-toggle {
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: calc(var(--radius-sm) - 2px);
  background: transparent;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-xs);
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s, box-shadow 0.15s;
}

.target-toggle:hover {
  color: var(--color-text);
}

.target-toggle.active {
  background: var(--color-bg-card);
  color: var(--color-primary);
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
}

.target-agent-picker {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.target-agent-label {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.target-select-wrap {
  position: relative;
  display: inline-flex;
  align-items: center;
  min-width: 150px;
  max-width: 240px;
}

.target-select {
  width: 100%;
  height: 34px;
  padding: 0 32px 0 12px;
  appearance: none;
  outline: none;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  background: var(--color-bg-card);
  font-size: var(--font-size-xs);
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
}

.target-select:hover {
  border-color: var(--color-primary);
}

.target-select:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}

.target-select-chevron {
  position: absolute;
  right: 10px;
  display: inline-flex;
  pointer-events: none;
  color: var(--color-text-tertiary);
}

.target-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
  min-width: 0;
  padding: 5px 9px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  font-size: var(--font-size-xs);
  white-space: nowrap;
}

.target-hint-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
  flex-shrink: 0;
}

.search-btn {
  background: var(--color-primary);
  color: #fff;
  border: 1px solid transparent;
  font-size: var(--font-size-xs);
  padding: 5px 18px;
}

.search-btn:hover {
  background: var(--color-primary-hover);
}

.search-clear {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  font-size: var(--font-size-xs);
  padding: 5px 14px;
}

.search-clear:hover {
  background: var(--color-bg-hover);
  color: var(--color-text);
}

.skills-header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--color-border);
}

.skills-header h2 {
  color: var(--color-primary);
  font-size: var(--font-size-lg);
  font-weight: 700;
}

.skills-total {
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
  background: var(--color-bg-tertiary);
  padding: 3px 10px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
}

.skills-copyright {
  margin-left: auto;
  font-size: var(--font-size-xs);
  color: var(--color-text-tertiary);
}

.skills-copyright a {
  color: var(--color-primary);
  text-decoration: none;
  font-weight: 500;
}

.skills-copyright a:hover {
  text-decoration: underline;
}

.skills-loading {
  text-align: center;
  padding: 60px 0;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
}

.skills-empty {
  text-align: center;
  padding: 80px 0;
  color: var(--color-text-tertiary);
}

.empty-icon {
  font-size: 56px;
  opacity: 0.2;
  margin-bottom: 16px;
}

/* ── Skills grid ── */
.skills-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 14px;
}

@media (max-width: 1100px) {
  .skills-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 850px) {
  .skills-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.skill-card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  transition: all 0.2s;
  position: relative;
  overflow: hidden;
}

.skill-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--color-primary), transparent);
  opacity: 0;
  transition: opacity 0.2s;
}

.skill-card:hover {
  border-color: var(--color-border-light);
  background: var(--color-bg-hover);
  transform: translateY(-1px);
  box-shadow: var(--shadow-sm);
}

.skill-card:hover::before {
  opacity: 1;
}

.skill-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.skill-name {
  font-size: var(--font-size-md);
  color: var(--color-text);
  font-weight: 600;
  line-height: 1.4;
  word-break: break-word;
}

.skill-badge {
  flex-shrink: 0;
  font-size: 10px;
  padding: 3px 8px;
  border-radius: 8px;
  font-weight: 600;
  white-space: nowrap;
  letter-spacing: 0.3px;
}

.api-key-badge {
  background: rgba(245, 158, 11, 0.12);
  color: #e6850a;
  border: 1px solid rgba(245, 158, 11, 0.25);
}

.skill-desc {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  min-height: 34px;
  cursor: default;
}

.skill-meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--color-text-tertiary);
  flex-wrap: wrap;
  padding-top: 2px;
}

.skill-owner {
  opacity: 0.8;
  background: var(--color-bg-tertiary);
  padding: 1px 6px;
  border-radius: 4px;
}

.skill-version {
  opacity: 0.6;
}

.skill-installs {
  opacity: 0.8;
}

.skill-scope {
  color: var(--color-primary);
  background: var(--color-primary-light);
  padding: 1px 6px;
  border-radius: 4px;
}

.skill-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
  justify-content: center;
  margin-top: auto;
  padding-top: 8px;
  border-top: 1px solid var(--color-border);
}

.skill-status {
  font-size: 10px;
  padding: 3px 8px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  white-space: nowrap;
  text-align: center;
}

.skill-status.installed {
  background: rgba(34, 197, 94, 0.1);
  color: var(--color-success);
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.skill-status.installing,
.skill-status.uninstalling {
  color: var(--color-primary);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* ── Buttons ── */
.btn {
  display: inline-block;
  padding: 12px 28px;
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all 0.15s;
  font-weight: 500;
}

.btn-sm {
  padding: 3px 10px;
  font-size: 10px;
  border-radius: var(--radius-sm);
  font-weight: 600;
  white-space: nowrap;
  text-align: center;
  line-height: 1.4;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-install-skill {
  background: var(--color-primary);
  color: #fff;
  border: 1px solid transparent;
}

.btn-install-skill:hover {
  background: var(--color-primary-hover);
  box-shadow: 0 2px 8px rgba(255, 107, 53, 0.3);
}

.btn-enable {
  background: rgba(34, 197, 94, 0.1);
  color: var(--color-success);
  border: 1px solid rgba(34, 197, 94, 0.25);
}

.btn-enable:hover {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.4);
}

.btn-enabled {
  background: rgba(34, 197, 94, 0.08);
  color: var(--color-success);
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.btn-enabled:hover {
  background: rgba(34, 197, 94, 0.04);
  border-color: rgba(34, 197, 94, 0.1);
  color: var(--color-text-tertiary);
}

.btn-uninstall {
  background: transparent;
  color: var(--color-text-tertiary);
  border: 1px solid var(--color-border);
}

.btn-uninstall:hover {
  color: var(--color-error);
  border-color: rgba(239, 68, 68, 0.4);
  background: rgba(239, 68, 68, 0.06);
}

/* ── Pagination ── */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  margin-top: 24px;
  padding: 16px 0;
  border-top: 1px solid var(--color-border);
}

.pagination .btn {
  background: var(--color-bg-card);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
}

.pagination .btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
  border-color: var(--color-border-light);
  color: var(--color-text);
}

.page-info {
  font-size: var(--font-size-xs);
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  padding: 4px 14px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  font-weight: 500;
}

/* ── Readme button ── */
.btn-readme {
  background: rgba(59, 130, 246, 0.1);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.25);
  margin-right: auto;
}

.btn-readme:hover {
  background: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
}

/* ── Readme modal ── */
.readme-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(2px);
}

.readme-modal {
  width: 680px;
  max-width: 90vw;
  max-height: 80vh;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.readme-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  font-size: var(--font-size-sm);
  font-weight: 600;
  color: var(--color-text);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.readme-close {
  background: none;
  border: none;
  color: var(--color-text-tertiary);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: all 0.15s;
}

.readme-close:hover {
  color: var(--color-text);
  background: var(--color-bg-hover);
}

.readme-body {
  padding: 20px;
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.7;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
  flex: 1;
  user-select: text;
  cursor: text;
  font-family: var(--font-family);
}
</style>
