<template>
  <div class="persona-form">
    <div class="role-tabs">
      <button
        v-for="role in ROLE_DEFS"
        :key="role.key"
        class="role-tab"
        :class="{ active: emp.roleType === role.key }"
        type="button"
        @click="selectRole(role.key)"
      >
        {{ role.label }}
      </button>
    </div>

    <div class="persona-panel">
      <div class="persona-basic-row">
        <div v-if="showAvatar" class="avatar-col">
          <label class="avatar-label">{{ pKey('avatar') }} <span class="required">*</span></label>
          <div class="avatar-preview" :class="{ 'has-error': tried && !emp.avatar }" @click="showAvatarPicker = !showAvatarPicker">
            <img v-if="emp.avatar" :src="emp.avatar" alt="avatar" />
            <span v-else class="avatar-placeholder">📷</span>
          </div>
          <span v-if="tried && !emp.avatar" class="field-error">{{ pKey('avatar') }}</span>
          <button class="avatar-btn" type="button" @click="$emit('request-avatar-upload')">{{ pKey('avatarUpload') }}</button>
          <div v-if="showAvatarPicker" class="avatar-picker">
            <div class="avatar-grid">
              <img
                v-for="url in avatarList"
                :key="url"
                :src="url"
                class="avatar-pick"
                :class="{ selected: emp.avatar === url }"
                @click="emp.avatar = emp.avatar === url ? '' : url; showAvatarPicker = false"
              />
            </div>
          </div>
        </div>

        <div class="persona-fields" :class="{ 'no-avatar': !showAvatar }">
          <div class="field-row">
            <div class="form-group" :class="{ 'has-error': tried && !emp.name.trim() }">
              <label>{{ pKey('name') }} <span class="required">*</span></label>
              <input v-model="emp.name" :placeholder="pKey('namePlaceholder')" maxlength="20" :disabled="disabled" />
              <span v-if="tried && !emp.name.trim()" class="field-error">{{ pKey('nameRequired') }}</span>
            </div>
            <div v-if="showIdField" class="form-group" :class="{ 'has-error': tried && !emp.id.trim() }">
              <label>{{ pKey('id') }} <span class="required">*</span></label>
              <input :value="emp.id" disabled />
              <span v-if="tried && !emp.id.trim()" class="field-error">{{ pKey('id') }}</span>
            </div>
          </div>

          <div class="field-row">
            <div class="form-group" :class="{ 'has-error': tried && !emp.gender }">
              <label>{{ pKey('gender') }} <span class="required">*</span></label>
              <div class="gender-group">
                <button class="gender-btn" type="button" :class="{ active: emp.gender === '女' }" @click="emp.gender = '女'" :disabled="disabled">{{ pKey('genderFemale') }}</button>
                <button class="gender-btn" type="button" :class="{ active: emp.gender === '男' }" @click="emp.gender = '男'" :disabled="disabled">{{ pKey('genderMale') }}</button>
              </div>
              <span v-if="tried && !emp.gender" class="field-error">{{ pKey('genderRequired') }}</span>
            </div>
            <div class="form-group" :class="{ 'has-error': tried && (!emp.age || Number(emp.age) < 1 || Number(emp.age) > 100) }">
              <label>{{ pKey('age') }} <span class="required">*</span></label>
              <input v-model="emp.age" type="number" min="1" max="100" :placeholder="pKey('agePlaceholder')" @input="clampAge" :disabled="disabled" />
              <span v-if="tried && !emp.age" class="field-error">{{ pKey('ageRequired') }}</span>
              <span v-else-if="tried && (Number(emp.age) < 1 || Number(emp.age) > 100)" class="field-error">1~100</span>
            </div>
          </div>

          <div class="form-group" :class="{ 'has-error': tried && !emp.callMe.trim() }">
            <label>{{ pKey('callMe') }} <span class="required">*</span></label>
            <input v-model="emp.callMe" :placeholder="roleField('callMePlaceholder')" maxlength="30" :disabled="disabled" />
            <span v-if="tried && !emp.callMe.trim()" class="field-error">{{ pKey('callMe') }}</span>
          </div>
        </div>
      </div>

      <div class="role-fields">
        <div
          v-for="field in activeRole.fields"
          :key="field.model"
          class="form-group"
          :class="{ full: field.full }"
        >
          <label>{{ field.label }}</label>
          <input
            v-model="emp[field.model]"
            :placeholder="field.placeholder"
            :maxlength="field.maxlength || 120"
            :disabled="disabled"
          />
        </div>
      </div>

      <div class="form-group full">
        <label>{{ pKey('extraInfo') }}</label>
        <textarea
          v-model="emp.extraInfo"
          :placeholder="pKey('extraInfoPlaceholder')"
          maxlength="500"
          rows="3"
          :disabled="disabled"
        ></textarea>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { t } from '@/i18n'
import { createPersona, resetPersona } from '@/lib/agent-persona'

const props = defineProps({
  modelValue: { type: Object, required: true },
  avatarList: { type: Array, default: () => [] },
  i18nPrefix: { type: String, default: 'setup.assistants' },
  showIdField: { type: Boolean, default: true },
  showAvatar: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'request-avatar-upload'])

const showAvatarPicker = ref(false)
const tried = ref(false)
let isInternalUpdate = false

const emp = reactive(createPersona())

function pKey(key) {
  const fullKey = `${props.i18nPrefix}.${key}`
  const text = t(fullKey)
  return text === fullKey ? t(`setup.assistants.${key}`) : text
}

function roleText(role, key) {
  const fullKey = `${props.i18nPrefix}.roles.${role}.${key}`
  const text = t(fullKey)
  return text === fullKey ? t(`setup.assistants.roles.${role}.${key}`) : text
}

function roleField(key) {
  return roleText(emp.roleType, key)
}

const ROLE_DEFS = computed(() => [
  {
    key: 'employee',
    label: pKey('roleEmployee'),
    fields: [
      field('employee', 'role', 'role', 40),
      field('employee', 'duty', 'duty', 120, true),
      field('employee', 'skills', 'skills', 120),
      field('employee', 'style', 'style', 80),
      field('employee', 'attitude', 'attitude', 120),
      field('employee', 'principle', 'principle', 120),
    ],
  },
  {
    key: 'assistant',
    label: pKey('roleAssistant'),
    fields: [
      field('assistant', 'duty', 'duty', 120, true),
      field('assistant', 'skills', 'skills', 120),
      field('assistant', 'style', 'style', 80),
      field('assistant', 'attitude', 'attitude', 120),
      field('assistant', 'principle', 'principle', 120),
      field('assistant', 'dislike', 'dislike', 120),
    ],
  },
  {
    key: 'partner',
    label: pKey('rolePartner'),
    fields: [
      field('partner', 'myRelation', 'myRelation', 100),
      field('partner', 'charm', 'charm', 80),
      field('partner', 'style', 'style', 80),
      field('partner', 'hobby', 'hobby', 120),
      field('partner', 'motto', 'motto', 80),
      field('partner', 'principle', 'principle', 120),
    ],
  },
  {
    key: 'friend',
    label: pKey('roleFriend'),
    fields: [
      field('friend', 'myRelation', 'myRelation', 100),
      field('friend', 'charm', 'charm', 80),
      field('friend', 'style', 'style', 80),
      field('friend', 'hobby', 'hobby', 120),
      field('friend', 'principle', 'principle', 120),
      field('friend', 'dislike', 'dislike', 120),
    ],
  },
  {
    key: 'lover',
    label: pKey('roleLover'),
    fields: [
      field('lover', 'myRelation', 'myRelation', 100),
      field('lover', 'charm', 'charm', 80),
      field('lover', 'style', 'style', 80),
      field('lover', 'motto', 'motto', 80),
      field('lover', 'hobby', 'hobby', 120),
      field('lover', 'principle', 'principle', 120),
    ],
  },
  {
    key: 'confidant',
    label: pKey('roleConfidant'),
    fields: [
      field('confidant', 'myRelation', 'myRelation', 100),
      field('confidant', 'charm', 'charm', 80),
      field('confidant', 'style', 'style', 80),
      field('confidant', 'hobby', 'hobby', 120),
      field('confidant', 'principle', 'principle', 120),
      field('confidant', 'dislike', 'dislike', 120),
    ],
  },
])

function field(role, key, model, maxlength, full = false) {
  return {
    model,
    maxlength,
    full,
    label: roleText(role, key),
    placeholder: roleText(role, `${key}Placeholder`),
  }
}

const activeRole = computed(() => ROLE_DEFS.value.find(role => role.key === emp.roleType) || ROLE_DEFS.value[0])

function selectRole(roleType) {
  emp.roleType = roleType
}

function seedFromProps(val) {
  if (!val) return
  isInternalUpdate = true
  Object.keys(emp).forEach(k => {
    if (val[k] !== undefined) emp[k] = val[k]
  })
  if (!emp.roleType) emp.roleType = 'employee'
  isInternalUpdate = false
}

seedFromProps(props.modelValue)

watch(() => props.modelValue, (val) => {
  if (isInternalUpdate) return
  seedFromProps(val)
}, { deep: true })

watch(emp, () => {
  if (isInternalUpdate) return
  isInternalUpdate = true
  emit('update:modelValue', { ...emp })
  isInternalUpdate = false
})

function clampAge() {
  let v = emp.age
  if (v === '' || v == null) return
  let n = Number(v)
  if (isNaN(n) || n < 1) emp.age = 1
  else if (n > 100) emp.age = 100
  else emp.age = Math.floor(n)
}

function validate() {
  tried.value = true
  return isValid.value
}

const isValid = computed(() => !!(
  (props.showAvatar ? emp.avatar : true) &&
  emp.name.trim() && emp.gender &&
  emp.age && Number(emp.age) >= 1 && Number(emp.age) <= 100 &&
  (props.showIdField ? emp.id.trim() : true) &&
  emp.callMe.trim()
))

function setAvatar(dataUrl) {
  emp.avatar = dataUrl
  showAvatarPicker.value = false
}

function getData() {
  return { ...emp }
}

function reset() {
  resetPersona(emp)
  tried.value = false
}

defineExpose({ validate, setAvatar, getData, reset, tried, isValid })
</script>

<style scoped>
.persona-form {
  width: 100%;
}

.role-tabs {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
  margin-bottom: var(--spacing-lg);
}

.role-tab {
  min-height: 36px;
  padding: 8px 10px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.role-tab:hover {
  border-color: var(--color-primary);
  color: var(--color-text);
}

.role-tab.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.persona-panel {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  animation: fadeIn 0.2s;
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.persona-basic-row {
  display: flex;
  gap: var(--spacing-lg);
  align-items: flex-start;
}

.avatar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.persona-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-width: 0;
}

.persona-fields.no-avatar {
  width: 100%;
}

.field-row,
.role-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.role-fields .form-group.full {
  grid-column: 1 / -1;
}

.avatar-preview {
  width: 80px;
  height: 80px;
  border-radius: var(--radius-md);
  border: 2px dashed var(--color-border);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.avatar-preview:hover {
  border-color: var(--color-primary);
}

.avatar-preview.has-error {
  border-color: var(--color-error);
}

.avatar-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  font-size: 28px;
  color: var(--color-text-tertiary);
}

.avatar-btn {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-primary);
  background: transparent;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.avatar-btn:hover {
  background: var(--color-primary-light);
}

.avatar-picker {
  margin-top: 4px;
  padding: 8px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  max-width: 200px;
}

.avatar-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.avatar-pick {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  object-fit: cover;
  transition: border-color 0.15s, transform 0.15s;
}

.avatar-pick:hover { transform: scale(1.15); }
.avatar-pick.selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-light);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.form-group label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
  text-align: left;
}

.form-group input {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  outline: none;
}

.form-group textarea {
  width: 100%;
  min-height: 86px;
  resize: vertical;
  padding: var(--spacing-sm) var(--spacing-md);
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  color: var(--color-text);
  font-size: var(--font-size-sm);
  line-height: 1.5;
  outline: none;
}

.form-group input:focus {
  border-color: var(--color-primary);
}

.form-group textarea:focus {
  border-color: var(--color-primary);
}

.form-group input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.form-group textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.gender-group {
  display: flex;
  gap: var(--spacing-sm);
}

.gender-btn {
  flex: 1;
  padding: var(--spacing-sm) var(--spacing-lg);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.gender-btn.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
  color: var(--color-primary);
}

.gender-btn:hover {
  border-color: var(--color-primary);
}

.required {
  color: var(--color-error);
  font-weight: 600;
}

.has-error input {
  border-color: var(--color-error) !important;
}

.has-error .gender-group {
  outline: 1px solid var(--color-error);
  border-radius: var(--radius-sm);
}

.field-error {
  font-size: var(--font-size-xs);
  color: var(--color-error);
  margin-top: 2px;
}

@media (max-width: 720px) {
  .role-tabs {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .persona-basic-row {
    flex-direction: column;
  }

  .field-row,
  .role-fields {
    grid-template-columns: 1fr;
  }
}
</style>
