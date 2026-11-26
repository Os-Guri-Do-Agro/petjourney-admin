<script setup lang="ts">
/**
 * Registrar o retorno de um animal entregue (exceção 7 da spec): `POST .../retorno` numa ficha
 * `ENTREGUE` nasce uma ficha nova em cuidado, com a identidade e a saúde do que a ONG entregou. O pet
 * de quem adotou não é tocado. A gaveta explica isso antes do botão; o resultado abre a ficha nova.
 */
import Button from 'primevue/button'
import { useI18n } from 'vue-i18n'

import CadastroGaveta from '@/components/cadastro/CadastroGaveta.vue'

defineProps<{ nome: string; registrando: boolean; erro: string }>()
const emit = defineEmits<{ confirmar: [] }>()
const aberta = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()
</script>

<template>
  <CadastroGaveta
    v-model:visible="aberta"
    :titulo="t('ong.ficha.retorno.titulo')"
    icone="ph ph-arrow-u-down-left"
  >
    <p class="eg__dica">{{ t('ong.ficha.retorno.texto', { nome }) }}</p>

    <p class="eg__aviso">
      <i class="ph ph-info" aria-hidden="true" />
      <span>{{ t('ong.ficha.retorno.limite') }}</span>
    </p>

    <p v-if="erro" class="eg__erro" role="alert">
      <i class="ph ph-warning-circle" aria-hidden="true" />
      <span>{{ erro }}</span>
    </p>

    <template #pe>
      <Button
        type="button"
        :label="t('cadastro.cancelar')"
        severity="secondary"
        outlined
        :disabled="registrando"
        @click="aberta = false"
      />
      <Button
        type="button"
        icon="ph ph-arrow-u-down-left"
        :label="t('ong.ficha.retorno.confirmar')"
        :loading="registrando"
        @click="emit('confirmar')"
      />
    </template>
  </CadastroGaveta>
</template>
