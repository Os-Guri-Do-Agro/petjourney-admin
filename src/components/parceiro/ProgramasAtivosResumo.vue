<script setup lang="ts">
/**
 * Os dois programas, resumidos em Configurações → Empresa, quando os dois estão ativos.
 *
 * Com os dois valendo, a tela Programas não tem mais o que pedir e sai do menu (17/11/2026, pedido
 * do Luís). O que sobra para consultar cabe numa seção: o nome, o que o programa dá, desde quando
 * vale e, no de Afiliados, o caminho para os ganhos. Fica junto do credenciamento, que é onde mora
 * a situação da parceria.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import type { ModoParticipacao } from '@/service/parceiro/types'

const { t, locale } = useI18n()
const { store } = useParceiroPortal()

const ICONE: Record<ModoParticipacao, string> = {
  afiliado: 'ph ph-wallet',
  participativo: 'ph ph-star',
}

/** Desde quando vale: a decisão do programa, ou a do credenciamento quando a API não manda. */
function ativoDesde(modo: ModoParticipacao) {
  const raw = store.modoBloco(modo).decididoEm ?? store.status?.auditadoEm
  if (!raw) return null
  return new Date(raw).toLocaleDateString(INTL_LOCALE[locale.value as Locale], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const programas = computed(() =>
  (['afiliado', 'participativo'] as const).map((modo) => {
    const desde = ativoDesde(modo)
    return {
      modo,
      icone: ICONE[modo],
      nome: t(`programas.card.${modo}.title`),
      resumo: t(`programas.card.${modo}.feature1`),
      selo: desde
        ? t('programas.linha.ativoDesde', { data: desde })
        : t('programas.card.status.ativo'),
    }
  }),
)
</script>

<template>
  <article class="ui-folha cfg-folha" aria-labelledby="programas-ativos-titulo">
    <section class="cfg-secao">
      <header class="cfg-secao__cabeca">
        <span class="ui-ladrilho cfg-secao__ladrilho" aria-hidden="true">
          <i class="ph ph-squares-four" />
        </span>
        <h3 id="programas-ativos-titulo" class="cfg-secao__titulo">
          {{ t('nav.items.programas') }}
        </h3>
        <p class="cfg-secao__descricao">{{ t('programas.saudacao.todosAtivos') }}</p>
      </header>

      <ul class="pa">
        <li v-for="programa in programas" :key="programa.modo" class="pa__linha">
          <span class="ui-ladrilho ui-ladrilho--lugar" aria-hidden="true">
            <i :class="programa.icone" />
          </span>
          <span class="pa__texto">
            <strong>{{ programa.nome }}</strong>
            <span>{{ programa.resumo }}</span>
          </span>
          <span class="ui-selo ui-selo--ok pa__selo">
            <i class="ph ph-check-circle" aria-hidden="true" />
            {{ programa.selo }}
          </span>
          <Button
            v-if="programa.modo === 'afiliado'"
            :as="RouterLink"
            to="/parceiro/carteira"
            class="pa__acao"
            icon="ph ph-wallet"
            :label="t('programas.linha.irParaGanhos')"
            severity="secondary"
            outlined
            size="small"
          />
        </li>
      </ul>
    </section>
  </article>
</template>

<style scoped>
/* Um programa por linha: o ladrilho, o nome e o que dá, desde quando vale e a ação. */
.pa {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.pa__linha {
  display: grid;
  align-items: center;
  gap: 8px 14px;
  padding: 14px 0;
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.pa__linha + .pa__linha {
  border-top: 1px solid var(--linha-suave);
}

.pa__linha:first-child {
  padding-top: 0;
}

.pa__linha:last-child {
  padding-bottom: 0;
}

.pa__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.pa__texto strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
}

.pa__texto span {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.pa__selo {
  justify-self: end;
}

/* A ação desce para a linha de baixo, alinhada ao texto. */
.pa__acao {
  justify-self: start;
  grid-column: 2 / -1;
}
</style>
