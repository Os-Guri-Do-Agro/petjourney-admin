<script setup lang="ts">
/**
 * As metas de um mês, uma por linha, com onde cada uma está.
 *
 * Uma linha e não um cartão por meta: são de seis a dez metas, e dez cartões iguais lado a lado é a
 * parede que não diz qual importa. A ordem já vem do domínio — o que falhou e o que pede atenção
 * primeiro — e o selo carrega a urgência; a barra só mostra o quanto.
 *
 * No mês em curso, a meta de aplicação ganha o ritmo ao lado do número: "8 de 12" no dia 10 é ótimo,
 * no dia 28 é péssimo, e só o ritmo diz qual dos dois.
 */
import ProgressBar from 'primevue/progressbar'
import { useI18n } from 'vue-i18n'

import ClinicAlertChip from '../base/ClinicAlertChip.vue'
import { useRotulosDoEstoque } from '../../composables/useRotulosDoEstoque'
import type { Vacina } from '../../data/types'
import type { ProgressoDaMeta } from '../../domain/metas-de-estoque'

defineProps<{
  progresso: ProgressoDaMeta[]
  vacinas: Vacina[]
  emCurso: boolean
}>()

const { t } = useI18n()
const rotulos = useRotulosDoEstoque()

/** A barra para em 100%: o estouro é dito pelo selo e pelo número, não por uma barra que vaza. */
function preenchido(item: ProgressoDaMeta): number {
  return Math.min(100, Math.round((Number.isFinite(item.parte) ? item.parte : 1) * 100))
}
</script>

<template>
  <ul class="metas">
    <li v-for="item in progresso" :key="item.meta.id" class="meta">
      <span class="meta__nome">
        <strong>{{ rotulos.nomeDaMeta(item.meta, vacinas) }}</strong>
        <span class="meta__mede">{{ rotulos.oQueMede(item.meta.tipo) }}</span>
      </span>

      <ProgressBar
        class="meta__barra"
        :class="`meta__barra--${item.situacao}`"
        :value="preenchido(item)"
        :show-value="false"
        :aria-label="rotulos.nomeDaMeta(item.meta, vacinas)"
      />

      <span class="meta__numeros">
        <strong class="clinic-value">{{ rotulos.valor(item.meta.tipo, item.realizado) }}</strong>
        {{ t('clinico.estoque.metas.de', { alvo: rotulos.valor(item.meta.tipo, item.meta.alvo) }) }}
        <span
          v-if="emCurso && item.sentido === 'piso' && item.situacao !== 'cumprida'"
          class="meta__ritmo"
        >
          {{ t('clinico.estoque.metas.ritmo', { n: item.projecao }) }}
        </span>
      </span>

      <span class="meta__selo">
        <ClinicAlertChip
          :severidade="rotulos.tom(item.situacao)"
          :rotulo="rotulos.situacao(item.sentido, item.situacao)"
          :icone="
            item.situacao === 'cumprida'
              ? 'pi pi-check'
              : item.situacao === 'no-ritmo'
                ? 'pi pi-arrow-right'
                : ''
          "
        />
      </span>
    </li>
  </ul>
</template>

<style scoped>
.metas {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

/*
 * Quatro colunas que se alinham de linha para linha: o nome, a barra, os números e o selo. A
 * subgrade não está disponível em todo tablet da clínica; colunas fixas fazem o mesmo papel.
 */
.meta {
  display: grid;
  align-items: center;
  gap: var(--clinic-space-2) var(--clinic-space-4);
  grid-template-columns: minmax(0, 1.4fr) minmax(6rem, 1fr) minmax(0, 1.2fr) 9.5rem;
  padding-block: 0.7rem;
  border-top: 1px solid var(--clinic-line-soft);
}

.meta:first-child {
  border-top: none;
}

.meta__nome {
  display: grid;
  min-width: 0;
}

.meta__nome strong {
  overflow: hidden;
  color: var(--clinic-text);
  font-size: var(--clinic-font-body);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta__mede,
.meta__ritmo {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.meta__numeros {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.meta__numeros strong {
  color: var(--clinic-text);
  font-size: 0.95rem;
  font-weight: 800;
}

.meta__ritmo {
  display: block;
}

.meta__selo {
  display: flex;
  justify-content: flex-end;
}

.meta__barra {
  height: 0.4rem;
  --p-progressbar-background: var(--clinic-surface-sunken);
  --p-progressbar-border-radius: 99rem;
}

/* A cor da barra repete a do selo: o mesmo estado, a mesma tinta. Nunca sozinha — o selo escreve. */
.meta__barra--cumprida,
.meta__barra--no-ritmo {
  --p-progressbar-value-background: var(--clinic-accent-strong);
}

.meta__barra--atencao {
  --p-progressbar-value-background: var(--clinic-attention-text);
}

.meta__barra--falhou {
  --p-progressbar-value-background: var(--clinic-risk-text);
}

@media (prefers-reduced-motion: reduce) {
  .meta__barra :deep(.p-progressbar-value) {
    transition: none;
  }
}

@media (max-width: 760px) {
  .meta {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .meta__barra {
    grid-column: 1 / -1;
    grid-row: 2;
  }
}
</style>
