<script setup lang="ts">
/**
 * As metas de um mês, uma por linha, com onde cada uma está.
 *
 * Uma linha e não um cartão por meta: são de seis a dez metas, e dez cartões iguais lado a lado é a
 * parede que não diz qual importa. A ordem já vem do domínio — o que falhou e o que pede atenção
 * primeiro — e o selo carrega a urgência em palavra; a barra só mostra o quanto.
 *
 * No mês em curso, a meta de aplicação ganha o ritmo ao lado do número: "8 de 12" no dia 10 é ótimo,
 * no dia 28 é péssimo, e só o ritmo diz qual dos dois.
 */
import { useI18n } from 'vue-i18n'

import { useRotulosDoEstoque } from '../../composables/useRotulosDoEstoque'
import type { Vacina } from '../../data/types'
import type { ProgressoDaMeta, SituacaoDaMeta } from '../../domain/metas-de-estoque'

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

/*
 * O tom do selo e da barra. A meta batida ganha o verde; a que está no ritmo fica neutra — não
 * pede nada de ninguém, e pintá-la faria a lista inteira competir com o que pede atenção.
 */
const TOM: Record<SituacaoDaMeta, 'risco' | 'atencao' | 'ok' | 'neutro'> = {
  falhou: 'risco',
  atencao: 'atencao',
  cumprida: 'ok',
  'no-ritmo': 'neutro',
}

const ICONE: Record<SituacaoDaMeta, string> = {
  falhou: 'ph ph-x-circle',
  atencao: 'ph ph-warning',
  cumprida: 'ph ph-check',
  'no-ritmo': 'ph ph-arrow-right',
}
</script>

<template>
  <ul class="metas">
    <li v-for="item in progresso" :key="item.meta.id" class="meta">
      <span class="meta__nome">
        <strong>{{ rotulos.nomeDaMeta(item.meta, vacinas) }}</strong>
        <span class="meta__mede">{{ rotulos.oQueMede(item.meta.tipo) }}</span>
      </span>

      <span
        class="meta__trilho"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="preenchido(item)"
        :aria-label="rotulos.nomeDaMeta(item.meta, vacinas)"
      >
        <span
          class="meta__barra"
          :class="`meta__barra--${TOM[item.situacao]}`"
          :style="{ inlineSize: `${preenchido(item)}%` }"
        />
      </span>

      <span class="meta__numeros">
        <span>
          <strong class="ui-num">{{ rotulos.valor(item.meta.tipo, item.realizado) }}</strong>
          <!-- Teto não é alvo a alcançar: "5 doses · limite 0 doses", não "5 doses de 0 doses". -->
          {{
            t(
              item.sentido === 'teto' ? 'clinico.estoque.metas.limite' : 'clinico.estoque.metas.de',
              {
                alvo: rotulos.valor(item.meta.tipo, item.meta.alvo),
              },
            )
          }}
        </span>
        <span
          v-if="emCurso && item.sentido === 'piso' && item.situacao !== 'cumprida'"
          class="meta__ritmo"
        >
          {{ t('clinico.estoque.metas.ritmo', { n: item.projecao }) }}
        </span>
      </span>

      <span class="meta__selo">
        <span class="ui-selo" :class="`ui-selo--${TOM[item.situacao]}`">
          <i :class="ICONE[item.situacao]" aria-hidden="true" />
          {{ rotulos.situacao(item.sentido, item.situacao) }}
        </span>
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
  gap: 8px 20px;
  grid-template-columns: minmax(0, 1.4fr) minmax(6rem, 1fr) minmax(0, 1.2fr) 10.5rem;
  min-height: 60px;
  padding-block: 12px;
  border-top: 1px solid var(--linha);
}

.meta:first-child {
  border-top: none;
}

.meta__nome {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.meta__nome strong {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta__mede,
.meta__ritmo {
  color: var(--tinta-2);
  font-size: 13px;
}

.meta__numeros {
  display: grid;
  gap: 2px;
  color: var(--tinta-2);
  font-size: 13px;
}

.meta__numeros strong {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 650;
}

.meta__selo {
  display: flex;
  justify-content: flex-end;
}

.meta__trilho {
  display: block;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--superficie-3);
}

/* A cor da barra repete a do selo: o mesmo estado, a mesma tinta. Nunca sozinha — o selo escreve. */
.meta__barra {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--musgo);
  transition: inline-size var(--pj-tempo-medio) var(--pj-curva-chega);
}

.meta__barra--ok {
  background: var(--ok);
}

.meta__barra--atencao {
  background: var(--atencao);
}

.meta__barra--risco {
  background: var(--risco);
}

@media (prefers-reduced-motion: reduce) {
  .meta__barra {
    transition: none;
  }
}

@media (max-width: 760px) {
  .meta {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .meta__trilho {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .meta__numeros {
    grid-column: 1 / -1;
  }
}
</style>
