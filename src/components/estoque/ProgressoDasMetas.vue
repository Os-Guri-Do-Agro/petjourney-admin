<script setup lang="ts">
/**
 * As metas de um mês, uma por linha, com onde cada uma está (E6-02a, guia e6 15.1). A ordem, a
 * situação, o ritmo e a parte vêm da API (o que falhou e o que pede atenção primeiro); a tela só
 * escreve. O selo carrega a urgência em palavra; a barra só mostra o quanto.
 *
 * No mês em curso, a meta de aplicação (piso) ganha o ritmo ao lado do número: "8 de 12" no dia 10
 * é ótimo, no dia 28 é péssimo, e só o ritmo diz qual dos dois. O teto estoura na hora.
 */
import { useI18n } from 'vue-i18n'

import type { ProgressoDaMeta, SituacaoDaMeta } from '@/service/parceiro/estoque-service'

import { useRotulosDasMetas } from './useRotulosDasMetas'

defineProps<{ progresso: ProgressoDaMeta[]; emCurso: boolean }>()

const { t } = useI18n()
const rotulos = useRotulosDasMetas()

/** `parte` nula é alvo 0 já passado: barra cheia. A barra para em 100%; o estouro é do selo. */
function preenchido(item: ProgressoDaMeta) {
  return Math.min(100, Math.round((item.parte ?? 1) * 100))
}

/* A meta no ritmo fica neutra: não pede nada, e pintá-la faria a lista competir com o que pede. */
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
  <ul class="pm">
    <li v-for="item in progresso" :key="item.meta.id" class="pm__meta">
      <span class="pm__nome">
        <strong>{{ rotulos.nome(item.meta) }}</strong>
        <span class="pm__mede">{{ rotulos.oQueMede(item.meta.tipo) }}</span>
      </span>

      <span
        class="pm__trilho"
        role="progressbar"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="preenchido(item)"
        :aria-label="rotulos.nome(item.meta)"
      >
        <span
          class="pm__barra"
          :class="`pm__barra--${TOM[item.situacao]}`"
          :style="{ inlineSize: `${preenchido(item)}%` }"
        />
      </span>

      <span class="pm__numeros">
        <span>
          <strong class="ui-num">{{ rotulos.valor(item.meta.tipo, item.realizado) }}</strong>
          {{
            t(item.sentido === 'teto' ? 'estoque.metas.limite' : 'estoque.metas.de', {
              alvo: rotulos.valor(item.meta.tipo, item.meta.alvo),
            })
          }}
        </span>
        <span
          v-if="emCurso && item.sentido === 'piso' && item.situacao !== 'cumprida'"
          class="pm__ritmo"
        >
          {{ t('estoque.metas.ritmo', { n: item.projecao }) }}
        </span>
      </span>

      <span class="pm__selo">
        <span
          class="ui-selo"
          :class="TOM[item.situacao] === 'neutro' ? '' : `ui-selo--${TOM[item.situacao]}`"
        >
          <i :class="ICONE[item.situacao]" aria-hidden="true" />
          {{ rotulos.situacao(item.sentido, item.situacao) }}
        </span>
      </span>
    </li>
  </ul>
</template>

<style scoped>
.pm {
  display: grid;
  margin: 0;
  container-type: inline-size;
  padding: 0;
  list-style: none;
}

/* Quatro colunas que se alinham de linha para linha: o nome, a barra, os números e o selo. */
.pm__meta {
  display: grid;
  align-items: center;
  gap: 8px 20px;
  grid-template-columns: minmax(0, 1.4fr) minmax(6rem, 1fr) minmax(0, 1.2fr) 10.5rem;
  min-height: 60px;
  padding: 14px 10px;
  border-top: 1px solid var(--linha);
}

.pm__meta:first-child {
  border-top: none;
}

.pm__nome {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.pm__nome strong {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pm__mede,
.pm__ritmo {
  color: var(--tinta-2);
  font-size: 13px;
}

.pm__numeros {
  display: grid;
  gap: 2px;
  color: var(--tinta-2);
  font-size: 13px;
}

.pm__numeros strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
}

.pm__selo {
  display: flex;
  justify-content: flex-end;
}

.pm__trilho {
  display: block;
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--superficie-3);
}

/* A cor da barra repete a do selo: o mesmo estado, a mesma tinta. Nunca sozinha: o selo escreve. */
.pm__barra {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--musgo);
  transition: inline-size var(--pj-tempo-medio) var(--pj-curva-chega);
}

.pm__barra--ok {
  background: var(--ok);
}

.pm__barra--atencao {
  background: var(--atencao);
}

.pm__barra--risco {
  background: var(--risco);
}

@media (prefers-reduced-motion: reduce) {
  .pm__barra {
    transition: none;
  }
}

/* Pela largura da caixa, não da janela: o menu aberto come a largura no tablet. */
@container (max-width: 46rem) {
  .pm__meta {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .pm__trilho {
    grid-column: 1 / -1;
    grid-row: 2;
  }

  .pm__numeros {
    grid-column: 1 / -1;
  }

  .pm__selo {
    grid-column: 2;
    grid-row: 1;
  }
}
</style>
