<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { currentColors } from '@/theme/color-mode'
import {
  getPasswordRequirements,
  type PasswordRequirementKey,
} from '@/utils/validation/password'

const props = defineProps<{
  password: string
}>()

const { t } = useI18n()

const requirements = computed(() => getPasswordRequirements(props.password))

const items = computed(() => {
  const labels: Record<PasswordRequirementKey, string> = {
    minLength: t('auth.passwordRequirements.minLength'),
    hasNumber: t('auth.passwordRequirements.hasNumber'),
    hasUppercase: t('auth.passwordRequirements.hasUppercase'),
    hasSpecialChar: t('auth.passwordRequirements.hasSpecialChar'),
  }

  return (Object.keys(labels) as PasswordRequirementKey[]).map((key) => ({
    key,
    label: labels[key],
  }))
})

const listStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--req-muted': colors.auth.muted,
    '--req-success': colors.success,
    '--req-pending': colors.auth.soft,
  }
})
</script>

<template>
  <ul class="password-requirements" :style="listStyle">
    <li
      v-for="item in items"
      :key="item.key"
      class="password-requirements__item"
      :class="{ 'password-requirements__item--met': requirements[item.key] }"
    >
      <i
        :class="requirements[item.key] ? 'pi pi-check' : 'pi pi-circle-fill'"
        aria-hidden="true"
      />
      {{ item.label }}
    </li>
  </ul>
</template>

<style scoped>
.password-requirements {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.password-requirements__item {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  color: var(--req-muted);
  font-size: 0.8125rem;
  font-weight: 600;
}

.password-requirements__item .pi {
  font-size: 0.62rem;
  color: var(--req-pending);
}

.password-requirements__item--met {
  color: var(--req-success);
}

.password-requirements__item--met .pi {
  font-size: 0.72rem;
  color: var(--req-success);
}
</style>
