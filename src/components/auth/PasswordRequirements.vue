<script setup lang="ts">
/**
 * O que a senha ainda precisa, conferido enquanto se digita: cada regra acende em verde, com o
 * visto no lugar do círculo, quando é cumprida — forma e palavra, além da cor.
 */
import { PhCheckCircle, PhCircle } from '@phosphor-icons/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

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
</script>

<template>
  <ul class="password-requirements">
    <li
      v-for="item in items"
      :key="item.key"
      class="password-requirements__item"
      :class="{ 'password-requirements__item--met': requirements[item.key] }"
    >
      <PhCheckCircle
        v-if="requirements[item.key]"
        class="password-requirements__icone"
        weight="fill"
        aria-hidden="true"
      />
      <PhCircle v-else class="password-requirements__icone" aria-hidden="true" />
      {{ item.label }}
    </li>
  </ul>
</template>

<style scoped>
.password-requirements {
  display: grid;
  gap: 6px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 13rem), 1fr));
}

.password-requirements__item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.35;
}

/* Componente do Phosphor, não a fonte: o tamanho vai em px. */
.password-requirements__icone {
  width: 17px;
  height: 17px;
  flex: none;
  color: var(--tinta-3);
}

.password-requirements__item--met {
  color: var(--ok-tinta);
  font-weight: 550;
}

.password-requirements__item--met .password-requirements__icone {
  color: var(--ok);
}
</style>
