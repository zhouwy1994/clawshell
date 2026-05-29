<template>
  <div class="persona-form">
    <div class="emp-tabs">
      <button
        v-for="tab in EMP_TABS"
        :key="tab.key"
        class="emp-tab"
        :class="{ active: empTab === tab.key }"
        @click="empTab = tab.key"
      >{{ tab.label }}</button>
    </div>

    <!-- Tab: Basic Profile -->
    <div v-if="empTab === 'basic'" class="emp-panel">
      <div class="emp-basic-row">
        <div v-if="showAvatar" class="emp-avatar-col">
          <label class="emp-avatar-label">{{ pKey('avatar') }} <span class="required">*</span></label>
          <div class="emp-avatar-preview" :class="{ 'has-error': tried && !emp.avatar }" @click="showAvatarPicker = !showAvatarPicker">
            <img v-if="emp.avatar" :src="emp.avatar" alt="avatar" />
            <span v-else class="emp-avatar-placeholder">📷</span>
          </div>
          <span v-if="tried && !emp.avatar" class="field-error">{{ pKey('avatar') }}</span>
          <button class="emp-avatar-btn" @click="$emit('request-avatar-upload')">{{ pKey('avatarUpload') }}</button>
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
        <div class="emp-basic-fields" :class="{ 'no-avatar': !showAvatar }">
          <div class="emp-field-row">
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
          <div class="emp-field-row">
            <div class="form-group" :class="{ 'has-error': tried && !emp.gender }">
              <label>{{ pKey('gender') }} <span class="required">*</span></label>
              <div class="gender-group">
                <button class="gender-btn" :class="{ active: emp.gender === '女' }" @click="emp.gender = '女'" :disabled="disabled">{{ pKey('genderFemale') }}</button>
                <button class="gender-btn" :class="{ active: emp.gender === '男' }" @click="emp.gender = '男'" :disabled="disabled">{{ pKey('genderMale') }}</button>
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
          <div class="emp-field-row">
            <div class="form-group">
              <label>{{ pKey('role') }}</label>
              <input v-model="emp.role" :placeholder="pKey('rolePlaceholder')" maxlength="20" :disabled="disabled" />
            </div>
            <div class="form-group">
              <label>{{ pKey('dept') }}</label>
              <input v-model="emp.dept" :placeholder="pKey('deptPlaceholder')" maxlength="50" :disabled="disabled" />
            </div>
          </div>
          <div class="form-group full">
            <label>{{ pKey('duty') }}</label>
            <input v-model="emp.duty" :placeholder="pKey('dutyPlaceholder')" maxlength="200" :disabled="disabled" />
          </div>
        </div>
      </div>
    </div>

    <!-- Tab: Relationships -->
    <div v-if="empTab === 'relation'" class="emp-panel">
      <div class="form-group" :class="{ 'has-error': tried && !emp.callMe.trim() }">
        <label>{{ pKey('callMe') }} <span class="required">*</span></label>
        <input v-model="emp.callMe" :placeholder="pKey('callMePlaceholder')" :disabled="disabled" />
        <span v-if="tried && !emp.callMe.trim()" class="field-error">{{ pKey('callMe') }}</span>
      </div>
      <div class="form-group">
        <label>{{ pKey('myRelation') }}</label>
        <input v-model="emp.myRelation" :placeholder="pKey('myRelationPlaceholder')" maxlength="200" :disabled="disabled" />
      </div>
      <div class="form-group">
        <label>{{ pKey('othersRelation') }}</label>
        <input v-model="emp.othersRelation" :placeholder="pKey('othersRelationPlaceholder')" maxlength="200" :disabled="disabled" />
      </div>
    </div>

    <!-- Tab: Personality & Style -->
    <div v-if="empTab === 'personality'" class="emp-panel">
      <div class="form-group">
        <label>{{ pKey('charm') }}</label>
        <input v-model="emp.charm" :placeholder="pKey('charmPlaceholder')" maxlength="80" :disabled="disabled" />
      </div>
      <div class="form-group">
        <label>{{ pKey('style') }}</label>
        <input v-model="emp.style" :placeholder="pKey('stylePlaceholder')" maxlength="80" :disabled="disabled" />
      </div>
      <div class="form-group">
        <label>{{ pKey('motto') }}</label>
        <input v-model="emp.motto" :placeholder="pKey('mottoPlaceholder')" maxlength="80" :disabled="disabled" />
      </div>
    </div>

    <!-- Tab: Work Ability -->
    <div v-if="empTab === 'ability'" class="emp-panel">
      <div class="form-group">
        <label>{{ pKey('skills') }}</label>
        <input v-model="emp.skills" :placeholder="pKey('skillsPlaceholder')" maxlength="200" :disabled="disabled" />
      </div>
      <div class="form-group">
        <label>{{ pKey('weakness') }}</label>
        <input v-model="emp.weakness" :placeholder="pKey('weaknessPlaceholder')" maxlength="200" :disabled="disabled" />
      </div>
      <div class="form-group">
        <label>{{ pKey('attitude') }}</label>
        <input v-model="emp.attitude" :placeholder="pKey('attitudePlaceholder')" maxlength="200" :disabled="disabled" />
      </div>
    </div>

    <!-- Tab: Values & Preferences -->
    <div v-if="empTab === 'values'" class="emp-panel">
      <div class="form-group">
        <label>{{ pKey('principle') }}</label>
        <input v-model="emp.principle" :placeholder="pKey('principlePlaceholder')" maxlength="200" :disabled="disabled" />
      </div>
      <div class="form-group">
        <label>{{ pKey('hobby') }}</label>
        <input v-model="emp.hobby" :placeholder="pKey('hobbyPlaceholder')" maxlength="200" :disabled="disabled" />
      </div>
      <div class="form-group">
        <label>{{ pKey('dislike') }}</label>
        <input v-model="emp.dislike" :placeholder="pKey('dislikePlaceholder')" maxlength="200" :disabled="disabled" />
      </div>
    </div>

    <!-- Tab: Signature Traits -->
    <div v-if="empTab === 'trait'" class="emp-panel">
      <div class="form-group">
        <label>{{ pKey('credo') }}</label>
        <input v-model="emp.credo" :placeholder="pKey('credoPlaceholder')" maxlength="200" :disabled="disabled" />
      </div>
      <div class="form-group">
        <label>{{ pKey('report') }}</label>
        <input v-model="emp.report" :placeholder="pKey('reportPlaceholder')" maxlength="200" :disabled="disabled" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch } from 'vue'
import { t } from '@/i18n'

const props = defineProps({
  modelValue: { type: Object, required: true },
  avatarList: { type: Array, default: () => [] },
  i18nPrefix: { type: String, default: 'setup.employee' },
  showIdField: { type: Boolean, default: true },
  showAvatar: { type: Boolean, default: true },
  disabled: { type: Boolean, default: false },
})

const emit = defineEmits(['update:modelValue', 'request-avatar-upload'])

const empTab = ref('basic')
const showAvatarPicker = ref(false)
const tried = ref(false)
let isInternalUpdate = false

const emp = reactive({
  name: '', gender: '', age: '', id: '', role: '', duty: '', dept: '',
  callMe: '', myRelation: '', othersRelation: '',
  charm: '', style: '', motto: '',
  skills: '', weakness: '', attitude: '',
  principle: '', hobby: '', dislike: '',
  credo: '', report: '', avatar: '',
})

function seedFromProps(val) {
  if (!val) return
  isInternalUpdate = true
  Object.keys(emp).forEach(k => {
    if (val[k] !== undefined) emp[k] = val[k]
  })
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

function pKey(key) {
  return t(`${props.i18nPrefix}.${key}`)
}

const EMP_TABS = computed(() => [
  { key: 'basic', label: pKey('basic') },
  { key: 'relation', label: pKey('relation') },
  { key: 'personality', label: pKey('personality') },
  { key: 'ability', label: pKey('ability') },
  { key: 'values', label: pKey('values') },
  { key: 'trait', label: pKey('trait') },
])

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
  Object.keys(emp).forEach(k => {
    emp[k] = (k === 'id' && !props.showIdField) ? '' : ''
  })
  tried.value = false
  empTab.value = 'basic'
}

defineExpose({ validate, setAvatar, getData, reset, tried, isValid })
</script>

<style scoped>
.persona-form {
  width: 100%;
}

.emp-tabs {
  display: flex;
  gap: 0;
  border-bottom: 2px solid var(--color-border);
  margin-bottom: var(--spacing-lg);
  flex-wrap: wrap;
}

.emp-tab {
  padding: 10px 14px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  color: var(--color-text-tertiary);
  font-size: var(--font-size-sm);
  cursor: pointer;
  font-weight: 500;
  transition: all 0.2s;
  white-space: nowrap;
}

.emp-tab:hover { color: var(--color-text); }
.emp-tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

.emp-panel {
  animation: fadeIn 0.2s;
}

.emp-basic-row {
  display: flex;
  gap: var(--spacing-lg);
  align-items: flex-start;
}

.emp-avatar-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  flex-shrink: 0;
}

.emp-basic-fields {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  min-width: 0;
}

.emp-field-row {
  display: flex;
  gap: var(--spacing-md);
}

.emp-field-row .form-group {
  flex: 1;
}

.emp-basic-fields .form-group.full {
  width: 100%;
}

.emp-basic-fields.no-avatar {
  width: 100%;
}

.emp-avatar-preview {
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

.emp-avatar-preview:hover {
  border-color: var(--color-primary);
}

.emp-avatar-preview.has-error {
  border-color: var(--color-error);
}

.emp-avatar-label {
  font-size: var(--font-size-sm);
  color: var(--color-text-secondary);
}

.emp-avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.emp-avatar-placeholder {
  font-size: 28px;
  color: var(--color-text-tertiary);
}

.emp-avatar-btn {
  font-size: var(--font-size-xs);
  color: var(--color-primary);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--color-primary);
  background: transparent;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.emp-avatar-btn:hover {
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

.form-group input:focus {
  border-color: var(--color-primary);
}

.form-group input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.gender-group {
  display: flex;
  gap: var(--spacing-sm);
}

.gender-btn {
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
</style>
