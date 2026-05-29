<template>
  <div class="schedules-view">
    <div class="schedules-shell">
      <header class="page-header">
        <div class="title-block">
          <span class="kicker">{{ t('schedules.kicker') }}</span>
          <h1>{{ t('schedules.title') }}</h1>
          <p>{{ t('schedules.subtitle') }}</p>
        </div>

        <button class="primary-btn" :disabled="loading || !isConnected" @click="loadAll">
          {{ t('schedules.refresh') }}
        </button>
      </header>

      <section v-if="error" class="notice">
        <strong>{{ t('schedules.unavailable') }}</strong>
        <span>{{ error }}</span>
      </section>

      <section class="summary-strip">
        <div class="summary-item">
          <span>{{ t('schedules.summaryTasks') }}</span>
          <b>{{ jobs.length }}</b>
        </div>
        <div class="summary-item">
          <span>{{ t('schedules.summaryNextWake') }}</span>
          <b>{{ formatMs(status?.nextWakeAtMs) }}</b>
        </div>
        <div class="summary-item">
          <span>{{ t('schedules.summaryFiltered') }}</span>
          <b>{{ filteredJobs.length }}</b>
        </div>
      </section>

      <main class="workspace">
        <section class="form-card">
          <div class="panel-title-row compact">
            <div>
              <h2>{{ t('schedules.newJob') }}</h2>
              <p>{{ t('schedules.newJobDesc') }}</p>
            </div>
          </div>

          <div class="form-grid">
            <label class="field span-2">
              <span>{{ t('schedules.jobName') }}</span>
              <input v-model="form.name" :placeholder="t('schedules.jobNamePlaceholder')" />
            </label>

            <label class="field span-2">
              <span>{{ t('schedules.jobContent') }}</span>
              <textarea v-model="form.message" rows="5" :placeholder="t('schedules.jobContentPlaceholder')" />
            </label>

            <label class="field">
              <span>{{ t('schedules.selectAssistant') }}</span>
              <select v-model="form.agentId">
                <option value="">{{ t('schedules.defaultAssistant') }}</option>
                <option v-for="assistant in assistantOptions" :key="assistant.id" :value="assistant.id">
                  {{ assistant.name }}
                </option>
              </select>
            </label>

            <label class="field">
              <span>{{ t('schedules.session') }}</span>
              <select v-model="form.sessionTarget">
                <option value="isolated">{{ t('schedules.sessionIsolated') }}</option>
                <option value="main">{{ t('schedules.sessionMain') }}</option>
              </select>
            </label>

            <label class="field">
              <span>{{ t('schedules.scheduleType') }}</span>
              <select v-model="form.scheduleKind">
                <option value="cron">{{ t('schedules.scheduleCron') }}</option>
                <option value="every">{{ t('schedules.scheduleEvery') }}</option>
                <option value="at">{{ t('schedules.scheduleAt') }}</option>
              </select>
            </label>

            <label class="field">
              <span>{{ t('schedules.description') }}</span>
              <input v-model="form.description" :placeholder="t('schedules.optional')" />
            </label>

            <template v-if="form.scheduleKind === 'cron'">
              <div class="cron-visual span-2">
                <div class="cron-visual-head">
                  <span>{{ t('schedules.cronEditor') }}</span>
                  <small>{{ cronPreviewText }}</small>
                </div>

                <div class="cron-frequency-grid">
                  <button
                    v-for="item in cronFrequencyOptions"
                    :key="item.value"
                    type="button"
                    class="cron-option-card"
                    :class="{ active: form.cronFrequency === item.value }"
                    @click="form.cronFrequency = item.value"
                  >
                    <strong>{{ item.label }}</strong>
                    <span>{{ item.description }}</span>
                  </button>
                </div>

                <div class="cron-editor-grid">
                  <label class="field">
                    <span>{{ t('schedules.hour') }}</span>
                    <select v-model="form.cronHour">
                      <option v-for="hour in hourOptions" :key="hour.value" :value="hour.value">
                        {{ hour.label }}
                      </option>
                    </select>
                  </label>

                  <label class="field">
                    <span>{{ t('schedules.minute') }}</span>
                    <select v-model="form.cronMinute">
                      <option v-for="minute in minuteOptions" :key="minute.value" :value="minute.value">
                        {{ minute.label }}
                      </option>
                    </select>
                  </label>

                  <label v-if="form.cronFrequency === 'weekly'" class="field">
                    <span>{{ t('schedules.weekday') }}</span>
                    <select v-model="form.cronWeekday">
                      <option v-for="day in weekdayOptions" :key="day.value" :value="day.value">
                        {{ day.label }}
                      </option>
                    </select>
                  </label>

                  <label v-if="form.cronFrequency === 'monthly'" class="field">
                    <span>{{ t('schedules.monthDay') }}</span>
                    <select v-model="form.cronMonthDay">
                      <option v-for="day in monthDayOptions" :key="day" :value="day">
                        {{ tr('schedules.monthDayOption', { day }) }}
                      </option>
                    </select>
                  </label>
                </div>
              </div>
            </template>

            <template v-else-if="form.scheduleKind === 'every'">
              <label class="field">
                <span>{{ t('schedules.everyAmount') }}</span>
                <input v-model="form.everyAmount" type="number" min="1" />
              </label>
              <label class="field">
                <span>{{ t('schedules.everyUnit') }}</span>
                <select v-model="form.everyUnit">
                  <option value="minutes">{{ t('schedules.unitMinutes') }}</option>
                  <option value="hours">{{ t('schedules.unitHours') }}</option>
                  <option value="days">{{ t('schedules.unitDays') }}</option>
                </select>
              </label>
            </template>

            <label v-else class="field span-2">
              <span>{{ t('schedules.runAt') }}</span>
              <input v-model="form.runAt" type="datetime-local" />
            </label>
          </div>

          <div class="form-footer">
            <label class="check-row">
              <input v-model="form.enabled" type="checkbox" />
              <span>{{ t('schedules.enableAfterCreate') }}</span>
            </label>
            <button class="primary-btn" :disabled="busy || !isConnected" @click="createJob">
              {{ busy ? t('schedules.processing') : t('schedules.createJob') }}
            </button>
          </div>
        </section>

        <section class="right-stack">
          <section class="jobs-panel">
            <div class="panel-title-row">
              <div>
                <h2>{{ t('schedules.jobList') }}</h2>
                <p>{{ tr('schedules.jobsSubtitle', { total }) }}</p>
              </div>
              <input v-model="query" class="search-input" :placeholder="t('schedules.searchPlaceholder')" />
            </div>

            <div class="job-list">
              <div v-if="loading" class="empty-state">{{ t('schedules.loadingJobs') }}</div>
              <div v-else-if="filteredJobs.length === 0" class="empty-state">{{ t('schedules.noJobs') }}</div>
              <button
                v-for="job in filteredJobs"
                v-else
                :key="job.id"
                class="job-row"
                :class="{ selected: selectedJob?.id === job.id, disabled: !job.enabled }"
                @click="selectJob(job)"
              >
                <span class="status-dot" :class="{ off: !job.enabled }"></span>
                <span class="job-content">
                  <span class="job-title-line">
                    <strong>{{ job.name || t('schedules.unnamedJob') }}</strong>
                    <span class="state-pill" :class="{ off: !job.enabled }">
                      {{ job.enabled ? t('schedules.enabled') : t('schedules.disabled') }}
                    </span>
                  </span>
                  <span class="job-desc">{{ job.description || getPayloadText(job) || t('schedules.noDescription') }}</span>
                  <span class="job-meta">
                    <span>{{ formatSchedule(job.schedule) }}</span>
                    <span v-if="job.agentId">{{ tr('schedules.assistantMeta', { name: getAssistantName(job.agentId) }) }}</span>
                    <span>{{ tr('schedules.nextRunMeta', { time: formatMs(job.nextRunAtMs) }) }}</span>
                  </span>
                </span>
                <span class="job-actions" @click.stop>
                  <button class="text-btn" :disabled="busy" @click="toggleJob(job)">
                    {{ job.enabled ? t('schedules.disable') : t('schedules.enable') }}
                  </button>
                  <button class="text-btn" :disabled="busy" @click="runJob(job)">{{ t('schedules.run') }}</button>
                  <button class="text-btn danger" :disabled="busy" @click="deleteJob(job)">{{ t('schedules.delete') }}</button>
                </span>
              </button>
            </div>
          </section>

          <section class="runs-card">
            <div class="panel-title-row compact">
              <div>
                <h2>{{ t('schedules.runHistory') }}</h2>
                <p>{{ selectedJob ? selectedJob.name : t('schedules.allJobs') }}</p>
              </div>
              <button class="text-btn" :disabled="busy || !isConnected" @click="loadRunsForSelected">
                {{ t('schedules.refresh') }}
              </button>
            </div>

            <div v-if="runs.length === 0" class="empty-state small">{{ t('schedules.noRuns') }}</div>
            <div v-for="entry in runs" :key="entry.id || `${entry.jobId}-${entry.runAtMs}`" class="run-row">
              <span class="run-status" :class="entry.status">{{ entry.status || t('schedules.unknown') }}</span>
              <span class="run-content">
                <strong>{{ entry.jobName || entry.name || entry.jobId || t('schedules.jobRun') }}</strong>
                <span>{{ entry.summary || entry.error || t('schedules.noSummary') }}</span>
                <small>{{ formatMs(entry.runAtMs || entry.startedAtMs) }}</small>
              </span>
            </div>
          </section>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useGatewayClient } from '@/composables/gateway-client'
import { useGatewayStore } from '@/stores/gateway'
import { t, locale } from '@/i18n'
import {
  addCronJob,
  loadCronOverview,
  loadCronRuns,
  removeCronJob,
  runCronJob,
  updateCronEnabled,
} from '@/features/schedules/schedule-controller'

const gw = useGatewayClient()
const gatewayStore = useGatewayStore()

const loading = ref(false)
const busy = ref(false)
const error = ref('')
const status = ref(null)
const jobs = ref([])
const total = ref(0)
const runs = ref([])
const assistants = ref([])
const selectedJob = ref(null)
const query = ref('')
const isConnected = computed(() => gw.connected.value)

const form = ref({
  name: '',
  description: '',
  agentId: '',
  message: '',
  scheduleKind: 'cron',
  cronFrequency: 'daily',
  cronHour: '8',
  cronMinute: '0',
  cronWeekday: '1',
  cronMonthDay: 1,
  everyAmount: 1,
  everyUnit: 'days',
  runAt: formatDateTimeInput(Date.now() + 3600000),
  sessionTarget: 'isolated',
  enabled: true,
})

const cronFrequencyOptions = computed(() => [
  { value: 'daily', label: t('schedules.freqDaily'), description: t('schedules.freqDailyDesc') },
  { value: 'weekdays', label: t('schedules.freqWeekdays'), description: t('schedules.freqWeekdaysDesc') },
  { value: 'weekly', label: t('schedules.freqWeekly'), description: t('schedules.freqWeeklyDesc') },
  { value: 'monthly', label: t('schedules.freqMonthly'), description: t('schedules.freqMonthlyDesc') },
])

const hourOptions = computed(() => Array.from({ length: 24 }, (_, hour) => ({
  value: String(hour),
  label: tr('schedules.hourOption', { hour: String(hour).padStart(2, '0') }),
})))

const minuteOptions = computed(() => Array.from({ length: 12 }, (_, index) => {
  const minute = index * 5
  return {
    value: String(minute),
    label: tr('schedules.minuteOption', { minute: String(minute).padStart(2, '0') }),
  }
}))

const monthDayOptions = Array.from({ length: 31 }, (_, index) => index + 1)
const weekdayOptions = computed(() => [
  { value: '1', label: t('schedules.weekdayMon') },
  { value: '2', label: t('schedules.weekdayTue') },
  { value: '3', label: t('schedules.weekdayWed') },
  { value: '4', label: t('schedules.weekdayThu') },
  { value: '5', label: t('schedules.weekdayFri') },
  { value: '6', label: t('schedules.weekdaySat') },
  { value: '0', label: t('schedules.weekdaySun') },
])

const cronPreviewText = computed(() => {
  const time = `${String(form.value.cronHour).padStart(2, '0')}:${String(form.value.cronMinute).padStart(2, '0')}`
  if (form.value.cronFrequency === 'weekdays') return tr('schedules.previewWeekdays', { time })
  if (form.value.cronFrequency === 'weekly') return tr('schedules.previewWeekly', { weekday: formatWeekday(form.value.cronWeekday), time })
  if (form.value.cronFrequency === 'monthly') return tr('schedules.previewMonthly', { day: form.value.cronMonthDay, time })
  return tr('schedules.previewDaily', { time })
})

const assistantOptions = computed(() => {
  return assistants.value.map((assistant) => ({
    id: assistant.id,
    name: assistant.identity?.name || assistant.name || assistant.id,
  })).filter(assistant => assistant.id)
})

const filteredJobs = computed(() => {
  const keyword = query.value.trim().toLowerCase()
  if (!keyword) return jobs.value
  return jobs.value.filter((job) => {
    const haystack = [
      job.name,
      job.description,
      job.agentId,
      getAssistantName(job.agentId),
      getPayloadText(job),
      formatSchedule(job.schedule),
    ].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(keyword)
  })
})

async function ensureConnected() {
  if (gw.connected.value) return true
  await gatewayStore.refresh()
  if (!gatewayStore.ready) {
    error.value = t('schedules.gatewayNotReady')
    return false
  }
  gw.connect(gatewayStore.port, gatewayStore.token || 'clawshell', gatewayStore.remoteUrl || '')
  return false
}

async function loadAssistants() {
  if (!gw.connected.value) return
  try {
    const result = await gw.request('agents.list', {})
    assistants.value = Array.isArray(result?.agents) ? result.agents : []
  } catch (e) {
    console.error('[schedules] load assistants failed:', e)
  }
}

async function loadAll() {
  error.value = ''
  if (!gw.connected.value) {
    const alreadyConnected = await ensureConnected()
    if (!alreadyConnected) return
  }
  loading.value = true
  try {
    await loadAssistants()
    const data = await loadCronOverview(gw)
    status.value = data.status
    jobs.value = data.jobs
    total.value = data.total
    if (selectedJob.value) {
      selectedJob.value = jobs.value.find(job => job.id === selectedJob.value.id) || null
    }
    await loadRunsForSelected()
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    loading.value = false
  }
}

async function loadRunsForSelected() {
  if (!gw.connected.value) return
  try {
    const data = await loadCronRuns(gw, selectedJob.value?.id || null)
    runs.value = data.entries
  } catch (e) {
    error.value = e?.message || String(e)
  }
}

function selectJob(job) {
  selectedJob.value = selectedJob.value?.id === job.id ? null : job
  loadRunsForSelected()
}

async function createJob() {
  await runBusy(async () => {
    await addCronJob(gw, form.value)
    form.value.name = ''
    form.value.description = ''
    form.value.message = ''
    await loadAll()
  })
}

async function toggleJob(job) {
  await runBusy(async () => {
    await updateCronEnabled(gw, job, !job.enabled)
    await loadAll()
  })
}

async function runJob(job) {
  await runBusy(async () => {
    await runCronJob(gw, job)
    selectedJob.value = job
    await loadRunsForSelected()
  })
}

async function deleteJob(job) {
  if (!window.confirm(tr('schedules.deleteConfirm', { name: job.name || job.id }))) return
  await runBusy(async () => {
    await removeCronJob(gw, job)
    if (selectedJob.value?.id === job.id) selectedJob.value = null
    await loadAll()
  })
}

async function runBusy(task) {
  if (!gw.connected.value) {
    await ensureConnected()
    if (!gw.connected.value) return
  }
  busy.value = true
  error.value = ''
  try {
    await task()
  } catch (e) {
    error.value = e?.message || String(e)
  } finally {
    busy.value = false
  }
}

function getAssistantName(agentId) {
  if (!agentId) return t('schedules.defaultAssistant')
  return assistantOptions.value.find(assistant => assistant.id === agentId)?.name || agentId
}

function getPayloadText(job) {
  const payload = job?.payload
  if (!payload || typeof payload !== 'object') return ''
  return payload.message || payload.text || ''
}

function formatSchedule(schedule) {
  if (!schedule) return t('schedules.noSchedule')
  if (schedule.kind === 'at') return tr('schedules.formatAt', { time: formatMs(Date.parse(schedule.at)) })
  if (schedule.kind === 'every') return tr('schedules.formatEvery', { duration: formatDuration(schedule.everyMs) })
  if (schedule.kind === 'cron') return formatCronExpression(schedule.expr)
  return schedule.kind || t('schedules.unknownSchedule')
}

function formatCronExpression(expr) {
  const parts = String(expr || '').trim().split(/\s+/)
  if (parts.length < 5) return `Cron ${expr || ''}`
  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '*') return tr('schedules.formatDaily', { time })
  if (dayOfMonth === '*' && month === '*' && dayOfWeek === '1-5') return tr('schedules.formatWeekdays', { time })
  if (dayOfMonth === '*' && month === '*') return tr('schedules.formatWeekly', { weekday: formatWeekday(dayOfWeek), time })
  if (month === '*' && dayOfWeek === '*') return tr('schedules.formatMonthly', { day: dayOfMonth, time })
  return `Cron ${expr}`
}

function formatWeekday(value) {
  return ({
    0: t('schedules.weekdayShortSun'),
    1: t('schedules.weekdayShortMon'),
    2: t('schedules.weekdayShortTue'),
    3: t('schedules.weekdayShortWed'),
    4: t('schedules.weekdayShortThu'),
    5: t('schedules.weekdayShortFri'),
    6: t('schedules.weekdayShortSat'),
  })[value] || value
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return '--'
  if (ms % 86400000 === 0) return tr('schedules.durationDays', { n: ms / 86400000 })
  if (ms % 3600000 === 0) return tr('schedules.durationHours', { n: ms / 3600000 })
  if (ms % 60000 === 0) return tr('schedules.durationMinutes', { n: ms / 60000 })
  return tr('schedules.durationSeconds', { n: Math.round(ms / 1000) })
}

function formatMs(ms) {
  if (!Number.isFinite(ms)) return '--'
  return new Date(ms).toLocaleString(locale.value, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateTimeInput(ms) {
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function tr(key, params = {}) {
  return Object.entries(params).reduce((text, [name, value]) => {
    return text.replaceAll(`{${name}}`, value)
  }, t(key))
}

onMounted(() => {
  loadAll()
})

watch(() => gw.connected.value, (connected) => {
  if (connected) loadAll()
})
</script>

<style scoped>
.schedules-view {
  height: 100%;
  overflow: auto;
  background: var(--color-bg);
}

.schedules-shell {
  max-width: 1280px;
  margin: 0 auto;
  padding: 20px 22px 28px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  margin-bottom: 14px;
}

.title-block {
  display: grid;
  gap: 5px;
}

.kicker {
  color: var(--color-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

h1,
h2,
p {
  margin: 0;
}

h1 {
  font-size: 26px;
  line-height: 1.15;
}

h2 {
  font-size: 15px;
  line-height: 1.2;
}

.title-block p,
.panel-title-row p,
.job-desc,
.job-meta,
.empty-state,
.run-content span,
small {
  color: var(--color-text-tertiary);
}

.notice {
  display: flex;
  gap: 10px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid rgba(239, 68, 68, 0.22);
  border-radius: 10px;
  background: rgba(239, 68, 68, 0.08);
  color: var(--color-error);
}

.summary-strip {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
  overflow: hidden;
  margin-bottom: 14px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-border);
}

.summary-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 48px;
  padding: 0 14px;
  background: var(--color-bg-secondary);
}

.summary-item span {
  color: var(--color-text-tertiary);
  font-size: 12px;
}

.summary-item b {
  font-size: 16px;
  font-variant-numeric: tabular-nums;
}

.workspace {
  display: grid;
  grid-template-columns: 420px minmax(0, 1fr);
  gap: 14px;
  align-items: stretch;
}

.form-card,
.jobs-panel,
.runs-card {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-bg-secondary);
  overflow: hidden;
}

.right-stack {
  display: grid;
  grid-template-rows: minmax(300px, 1fr) 260px;
  gap: 14px;
  min-height: 640px;
}

.form-card {
  min-height: 640px;
}

.panel-title-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  padding: 14px;
  border-bottom: 1px solid var(--color-border);
}

.panel-title-row.compact {
  align-items: center;
}

.search-input {
  width: 260px;
  height: 34px;
}

.job-list {
  padding: 8px;
  max-height: 100%;
  overflow: auto;
}

.job-row {
  width: 100%;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px;
  align-items: start;
  padding: 12px;
  border-radius: 10px;
  text-align: left;
  transition: background var(--transition-fast), box-shadow var(--transition-fast);
}

.job-row:hover {
  background: var(--color-bg-hover);
}

.job-row.selected {
  background: var(--color-primary-light);
  box-shadow: inset 3px 0 0 var(--color-primary);
}

.job-row.disabled {
  opacity: 0.62;
}

.status-dot {
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--color-success);
  box-shadow: 0 0 0 4px rgba(34, 197, 94, 0.1);
}

.status-dot.off {
  background: var(--color-text-tertiary);
  box-shadow: none;
}

.job-content {
  min-width: 0;
  display: grid;
  gap: 5px;
}

.job-title-line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.job-title-line strong,
.job-desc {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.state-pill,
.run-status {
  flex: none;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(34, 197, 94, 0.1);
  color: var(--color-success);
  font-size: 11px;
  font-weight: 700;
}

.state-pill.off,
.run-status.error {
  background: rgba(239, 68, 68, 0.1);
  color: var(--color-error);
}

.job-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
}

.job-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 14px;
}

.field {
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

.field.span-2 {
  grid-column: span 2;
}

.cron-visual {
  display: grid;
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg-tertiary);
}

.cron-visual.span-2 {
  grid-column: 1 / -1;
}

.cron-visual-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: center;
}

.cron-visual-head span {
  font-size: 12px;
  font-weight: 700;
  color: var(--color-text);
}

.cron-visual-head small {
  color: var(--color-primary);
  font-weight: 700;
}

.cron-frequency-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.cron-option-card {
  display: grid;
  gap: 3px;
  padding: 10px;
  border: 1px solid var(--color-border);
  border-radius: 9px;
  background: var(--color-bg-secondary);
  text-align: left;
}

.cron-option-card strong {
  font-size: 13px;
}

.cron-option-card span {
  color: var(--color-text-tertiary);
  font-size: 11px;
}

.cron-option-card.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  box-shadow: inset 3px 0 0 var(--color-primary);
}

.cron-editor-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

textarea {
  min-height: 120px;
  resize: vertical;
}

.form-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  border-top: 1px solid var(--color-border);
}

.check-row {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--color-text-secondary);
  font-size: 12px;
}

.check-row input {
  width: auto;
}

.primary-btn,
.text-btn {
  min-height: 32px;
  border-radius: 8px;
  padding: 0 12px;
  font-weight: 700;
}

.primary-btn {
  background: var(--color-primary);
  color: #fff;
}

.text-btn {
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  font-size: 12px;
}

.text-btn:hover:not(:disabled) {
  color: var(--color-text);
  background: var(--color-bg-hover);
}

.text-btn.danger {
  color: var(--color-error);
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.runs-card {
  overflow: auto;
}

.run-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 10px;
  padding: 11px 14px;
  border-top: 1px solid var(--color-border);
}

.run-row:first-of-type {
  border-top: 0;
}

.run-status {
  align-self: start;
}

.run-status.skipped {
  background: rgba(245, 158, 11, 0.12);
  color: var(--color-warning);
}

.run-content {
  min-width: 0;
  display: grid;
  gap: 4px;
}

.run-content strong,
.run-content span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-state {
  padding: 28px 14px;
  text-align: center;
}

.empty-state.small {
  padding: 18px 14px;
}

@media (max-width: 1120px) {
  .workspace {
    grid-template-columns: 1fr;
  }

  .form-card,
  .right-stack {
    min-height: 0;
  }
}

@media (max-width: 760px) {
  .schedules-shell {
    padding: 14px;
  }

  .page-header,
  .panel-title-row,
  .form-footer {
    flex-direction: column;
    align-items: stretch;
  }

  .summary-strip,
  .form-grid,
  .cron-frequency-grid,
  .cron-editor-grid {
    grid-template-columns: 1fr;
  }

  .right-stack {
    grid-template-rows: auto auto;
  }

  .field.span-2 {
    grid-column: auto;
  }

  .search-input {
    width: 100%;
  }

  .job-row {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .job-actions {
    grid-column: 2;
    justify-content: flex-start;
  }
}
</style>
