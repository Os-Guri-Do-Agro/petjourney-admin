<script setup lang="ts">
import { computed } from 'vue'

import { currentColors } from '@/theme/color-mode'
import {
  getPasswordRequirements,
  type PasswordRequirementKey,
} from '@/utils/validation/password'

const props = defineProps<{
  password: string
}>()

const requirements = computed(() => getPasswordRequirements(props.password))

const items: Array<{ key: PasswordRequirementKey; label: string }> = [
  { key: 'minLength', label: 'Mínimo de 6 caracteres' },
  { key: 'hasNumber', label: 'Pelo menos 1 número' },
  { key: 'hasUppercase', label: 'Pelo menos 1 letra maiúscula' },
  { key: 'hasSpecialChar', label: 'Pelo menos 1 caractere especial' },
]

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
