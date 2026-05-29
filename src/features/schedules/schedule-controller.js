const DEFAULT_LIMIT = 100

export function normalizeCronJobsResult(result) {
  const jobs = Array.isArray(result?.jobs) ? result.jobs : []
  return {
    jobs,
    total: Number.isFinite(result?.total) ? result.total : jobs.length,
    hasMore: Boolean(result?.hasMore),
    nextOffset: Number.isFinite(result?.nextOffset) ? result.nextOffset : null,
  }
}

export function normalizeCronRunsResult(result) {
  const entries = Array.isArray(result?.entries) ? result.entries : []
  return {
    entries,
    total: Number.isFinite(result?.total) ? result.total : entries.length,
  }
}

export async function loadCronOverview(client) {
  const [status, jobsResult] = await Promise.all([
    client.request('cron.status', {}),
    client.request('cron.list', {
      includeDisabled: true,
      limit: DEFAULT_LIMIT,
      offset: 0,
      sortBy: 'nextRunAtMs',
      sortDir: 'asc',
    }),
  ])

  return {
    status,
    ...normalizeCronJobsResult(jobsResult),
  }
}

export async function loadCronRuns(client, jobId = null) {
  const result = await client.request('cron.runs', {
    scope: jobId ? 'job' : 'all',
    id: jobId || undefined,
    limit: 20,
    offset: 0,
    sortDir: 'desc',
  })
  return normalizeCronRunsResult(result)
}

export function buildCronJobFromForm(form) {
  const name = form.name.trim()
  const message = form.message.trim()
  if (!name) throw new Error('请输入任务名称')
  if (!message) throw new Error('请输入任务内容')

  return {
    name,
    description: form.description.trim() || undefined,
    agentId: form.agentId.trim() || undefined,
    enabled: form.enabled,
    schedule: buildSchedule(form),
    sessionTarget: form.sessionTarget,
    wakeMode: 'now',
    payload: {
      kind: 'agentTurn',
      message,
    },
    delivery: { mode: 'none' },
  }
}

function buildSchedule(form) {
  if (form.scheduleKind === 'at') {
    const ms = Date.parse(form.runAt)
    if (!Number.isFinite(ms)) throw new Error('请输入有效的运行时间')
    return { kind: 'at', at: new Date(ms).toISOString() }
  }

  if (form.scheduleKind === 'every') {
    const amount = Number(form.everyAmount)
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('间隔必须大于 0')
    const unitMs = form.everyUnit === 'hours' ? 3600000 : form.everyUnit === 'days' ? 86400000 : 60000
    return { kind: 'every', everyMs: Math.floor(amount * unitMs) }
  }

  return { kind: 'cron', expr: buildCronExpression(form) }
}

function buildCronExpression(form) {
  const hour = parseCronNumber(form.cronHour, 0, 23, '小时必须在 0 到 23 之间')
  const minute = parseCronNumber(form.cronMinute, 0, 59, '分钟必须在 0 到 59 之间')
  if (form.cronFrequency === 'weekdays') return `${minute} ${hour} * * 1-5`
  if (form.cronFrequency === 'weekly') {
    const weekday = String(form.cronWeekday ?? '1')
    if (!/^[0-6]$/.test(weekday)) throw new Error('请选择有效的星期')
    return `${minute} ${hour} * * ${weekday}`
  }
  if (form.cronFrequency === 'monthly') {
    const day = Number(form.cronMonthDay)
    if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error('日期必须在 1 到 31 之间')
    return `${minute} ${hour} ${day} * *`
  }
  return `${minute} ${hour} * * *`
}

function parseCronNumber(value, min, max, message) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < min || number > max) throw new Error(message)
  return number
}

export async function addCronJob(client, form) {
  return client.request('cron.add', buildCronJobFromForm(form))
}

export async function updateCronEnabled(client, job, enabled) {
  return client.request('cron.update', {
    id: job.id,
    patch: { enabled },
  })
}

export async function runCronJob(client, job) {
  return client.request('cron.run', {
    id: job.id,
    mode: 'force',
  })
}

export async function removeCronJob(client, job) {
  return client.request('cron.remove', { id: job.id })
}
