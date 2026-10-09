<script setup lang="ts">
import { PhCheck, PhCircle } from '@phosphor-icons/vue'
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
      <PhCheck
        v-if="requirements[item.key]"
        class="password-requirements__icone"
        aria-hidden="true"
      />
      <PhCircle v-else class="password-requirements__icone" weight="fill" aria-hidden="true" />
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

/* Componente do Phosphor, não a fonte: os 25% que o `.ph::before` compensa vão no tamanho. */
.password-requirements__icone {
  flex: none;
  font-size: 0.78rem;
  color: var(--req-pending);
}

.password-requirements__item--met {
  color: var(--req-success);
}

.password-requirements__item--met .password-requirements__icone {
  font-size: 0.9rem;
  color: var(--req-success);
}
</style>
