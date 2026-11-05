<script setup lang="ts">
/**
 * A gaveta dos formulários do cadastro (paciente, alerta, responsável, autorizado, inativar,
 * mesclar, excluir): à direita (à esquerda no árabe), sem cobrir a tela inteira, no mesmo desenho
 * das gavetas do estabelecimento (`gaveta.css`).
 */
import Drawer from 'primevue/drawer'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import { isRTLLocale, type Locale } from '@/i18n/locales'

import '@/components/parceiro/estabelecimento/gaveta.css'

const props = withDefaults(defineProps<{ titulo: string; icone: string; largura?: string }>(), {
  largura: '30rem',
})

const visible = defineModel<boolean>('visible', { default: false })

const { locale } = useI18n()
const telaLarga = useTelaLarga()

useSidePanelOffset(
  computed(() => visible.value && telaLarga.value),
  props.largura,
)

const posicao = computed(() => (isRTLLocale(locale.value as Locale) ? 'left' : 'right'))
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="posicao"
    :modal="false"
    :dismissable="false"
    :block-scroll="false"
    class="cadastro-gaveta"
    :style="{ width: `min(${largura}, 100vw)` }"
  >
    <template #header>
      <h2 class="eg-titulo">
        <span class="ui-ladrilho ui-ladrilho--lugar" aria-hidden="true">
          <i :class="icone" />
        </span>
        {{ titulo }}
      </h2>
    </template>

    <div class="eg">
      <slot />
    </div>

    <template #footer>
      <div class="eg__pe">
        <slot name="pe" />
      </div>
    </template>
  </Drawer>
</template>
