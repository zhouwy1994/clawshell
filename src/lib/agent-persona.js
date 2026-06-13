export const PERSONA_DEFAULTS = {
  roleType: 'employee',
  name: '',
  gender: '',
  age: '',
  id: '',
  role: '',
  duty: '',
  dept: '',
  callMe: '',
  myRelation: '',
  othersRelation: '',
  charm: '',
  style: '',
  motto: '',
  skills: '',
  weakness: '',
  attitude: '',
  principle: '',
  hobby: '',
  dislike: '',
  credo: '',
  report: '',
  extraInfo: '',
  avatar: '',
}

export function createPersona(overrides = {}) {
  return {
    ...PERSONA_DEFAULTS,
    ...overrides,
  }
}

export function resetPersona(target, overrides = {}) {
  const next = createPersona(overrides)
  Object.keys(PERSONA_DEFAULTS).forEach(key => {
    target[key] = next[key]
  })
  return target
}

export function normalizePersona(source = {}, overrides = {}) {
  const persona = createPersona(overrides)
  Object.keys(PERSONA_DEFAULTS).forEach(key => {
    if (source[key] !== undefined) persona[key] = source[key]
  })
  return persona
}
