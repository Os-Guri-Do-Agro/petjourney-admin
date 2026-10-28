<script setup lang="ts">
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import type { StatusAuditoriaParceiro } from '@/service/parceiro/types'

const props = withDefaults(
  defineProps<{
    /**
     * Cobre também o cadastro SUSPENSO, com a copy de leitura liberada.
     * Use nas telas onde a leitura NÃO é gated por auditoria (atendimentos:
     * seção 4 da spec das Partes 11 a 13). Nas demais, o SUSPENSO continua no
     * gate de página cheia da moldura (`UiPagina bloquear-se-suspenso`) e este
     * banner não o duplica.
     */
    coverSuspended?: boolean
  }>(),
  { coverSuspended: false },
)

const { t } = useI18n()
const { store } = useParceiroPortal()

const visible = computed(() => {
  if (store.loadState !== 'ready' || store.podeOperar) {
    return false
  }

  if (store.cadastroSuspenso) {
    return props.coverSuspended
  }

  const status = store.statusAuditoria
  return status === 'PENDENTE' || status === 'REJEITADO'
})

const copyKey = computed(() => {
  const status = store.statusAuditoria as StatusAuditoriaParceiro | null

  if (status === 'SUSPENSO') {
    return 'suspendedReadOnly'
  }

  return status === 'REJEITADO' ? 'rejected' : 'pending'
})
</script>

<template>
  <!--
    A faixa do cadastro: um aviso na largura da tela, na cor de atenção (em análise) ou de risco
    (recusado, suspenso), com o motivo quando houver e o caminho para resolver.
  -->
  <aside v-if="visible" class="operability-banner" :data-tone="copyKey" role="status">
    <span class="operability-banner__icone" aria-hidden="true">
      <i class="ph" :class="copyKey === 'rejected' ? 'ph-x-circle' : 'ph-lock'" />
    </span>
    <span class="operability-banner__texto">
      <strong>{{ t(`frame.operability.${copyKey}.title`) }}</strong>
      <span>
        {{ t(`frame.operability.${copyKey}.body`) }}
        <template v-if="store.status?.motivoAuditoria">
          {{ t('frame.operability.reasonPrefix') }} {{ store.status.motivoAuditoria }}
        </template>
      </span>
    </span>
    <!-- O caminho para resolver num botão de verdade, e não em texto solto sobre a faixa. -->
    <!-- O componente, e não as classes num link: sem um Button montado na tela o PrimeVue não
         carrega o estilo, e o "botão" virava texto solto (no escuro, sumia na faixa). -->
    <Button
      :as="RouterLink"
      to="/settings?aba=empresa"
      class="operability-banner__link"
      severity="secondary"
      size="small"
      :label="t(`frame.operability.${copyKey}.link`)"
    />
  </aside>
</template>

<style scoped>
.operability-banner {
  --faixa-cor: var(--atencao);
  --faixa-fundo: var(--atencao-fundo);
  --faixa-tinta: var(--atencao-tinta);

  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 12px 16px 12px 12px;
  border: 1px solid color-mix(in oklab, var(--faixa-cor) 40%, var(--linha));
  border-radius: 14px;
  background: var(--faixa-fundo);
  color: var(--tinta);
}

.operability-banner[data-tone='rejected'],
.operability-banner[data-tone='suspendedReadOnly'] {
  --faixa-cor: var(--risco);
  --faixa-fundo: var(--risco-fundo);
  --faixa-tinta: var(--risco-tinta);
}

.operability-banner__icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--superficie);
  color: var(--faixa-tinta);
  font-size: 19px;
}

.operability-banner__texto {
  display: grid;
  min-width: 0;
  flex: 1 1 280px;
  gap: 2px;
  line-height: 1.45;
}

.operability-banner__texto strong {
  font-size: 14.5px;
  font-weight: 600;
}

.operability-banner__texto span {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.operability-banner__link {
  flex: none;
  text-decoration: none;
}
</style>
