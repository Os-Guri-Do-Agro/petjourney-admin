<script setup lang="ts">
import { computed, useSlots } from 'vue'
import InputText from 'primevue/inputtext'

import { Colors } from '@/theme/colors'

defineOptions({
  inheritAttrs: false,
})

const model = defineModel<string>({ default: '' })
const slots = useSlots()

const props = withDefaults(
  defineProps<{
    id: string
    label: string
    type?: string
    placeholder?: string
    autocomplete?: string
    required?: boolean
    hint?: string
  }>(),
  {
    type: 'text',
    placeholder: '',
    autocomplete: undefined,
    required: false,
    hint: '',
  },
)

const hasLabel = computed(() => Boolean(props.label))
const hasLeadingSlot = computed(() => Boolean(slots.leading))
const hasTrailingSlot = computed(() => Boolean(slots.trailing))

const cursorColor = encodeURIComponent(Colors.primary)

const fieldStyle = {
  '--auth-primary': Colors.auth.text,
  '--auth-muted': Colors.auth.muted,
  '--auth-soft': Colors.auth.soft,
  '--auth-border': Colors.auth.line,
  '--auth-white': Colors.auth.white,
  '--auth-shadow-rgb': Colors.auth.shadowRgb,
  '--auth-focus': Colors.vet.primary,
  '--auth-focus-ring': Colors.vet.secondary,
  '--auth-danger': Colors.red,
  '--auth-text-cursor': `url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2724%27 viewBox=%270 0 16 24%27%3E%3Cpath d=%27M6 2h4v2H9v16h1v2H6v-2h1V4H6V2Z%27 fill=%27${cursorColor}%27/%3E%3C/svg%3E") 8 12, text`,
}

</script>

<template>
  <label class="auth-text-field block space-y-2" :for="id" :style="fieldStyle">
    <span v-if="hasLabel" class="auth-text-field__label text-sm font-semibold">
      {{ label }}
      <span v-if="required" class="auth-text-field__required">*</span>
    </span>

    <span class="auth-text-field__control">
      <span v-if="hasLeadingSlot" class="auth-text-field__leading">
        <slot name="leading" />
      </span>

      <InputText
        v-bind="$attrs"
        :id="id"
        v-model="model"
        class="auth-text-field__input"
        :class="{
          'auth-text-field__input--with-leading': hasLeadingSlot,
          'auth-text-field__input--with-trailing': hasTrailingSlot,
        }"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :required="required"
        :type="type"
      />

      <span v-if="hasTrailingSlot" class="auth-text-field__trailing">
        <slot name="trailing" />
      </span>
    </span>

    <span v-if="hint" class="auth-text-field__hint block text-xs leading-5">
      {{ hint }}
    </span>
  </label>
</template>

<style scoped>
.auth-text-field__label {
  color: var(--auth-primary);
  font-size: 0.8125rem;
  font-weight: 700;
}

.auth-text-field__required {
  color: var(--auth-danger);
}

.auth-text-field__control {
  position: relative;
  display: block;
}

.auth-text-field__input {
  width: 100%;
  height: 3.125rem;
  padding: 0 1rem;
  border: 1px solid var(--auth-border);
  border-radius: 0.875rem;
  background: var(--auth-white);
  caret-color: var(--auth-primary);
  color: var(--auth-primary);
  cursor: var(--auth-text-cursor);
  font-size: 0.9375rem;
  line-height: 1.5rem;
  box-shadow: 0 10px 24px rgb(var(--auth-shadow-rgb) / 0.035);
  outline: none;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.auth-text-field__input--with-leading {
  padding-left: 2.75rem;
}

.auth-text-field__input--with-trailing {
  padding-right: 3rem;
}

.auth-text-field__leading,
.auth-text-field__trailing {
  position: absolute;
  top: 50%;
  display: inline-flex;
  align-items: center;
  color: var(--auth-soft);
  transform: translateY(-50%);
}

.auth-text-field__leading {
  left: 1rem;
}

.auth-text-field__trailing {
  right: 0.85rem;
}

.auth-text-field__input::placeholder {
  color: var(--auth-soft);
}

.auth-text-field__input:focus {
  caret-color: var(--auth-primary);
  color: var(--auth-primary);
  cursor: var(--auth-text-cursor);
}

.auth-text-field__input:focus,
.auth-text-field__input:focus-visible {
  border-color: var(--auth-focus);
  box-shadow:
    0 0 0 4px color-mix(in srgb, var(--auth-focus-ring) 38%, transparent),
    0 10px 24px rgb(var(--auth-shadow-rgb) / 0.08);
}

.auth-text-field__hint {
  color: var(--auth-muted);
}
</style>
