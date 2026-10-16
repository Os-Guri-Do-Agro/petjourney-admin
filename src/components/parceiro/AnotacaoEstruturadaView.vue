<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import type { Anotacao } from '@/service/parceiro/types'
import {
  escalaresPreenchidos,
  temEstruturados,
  type CampoEscalar,
} from '@/utils/parceiro/anotacao-estruturada'

/**
 * Bloco estruturado de uma anotação já salva. Renderiza só o que foi preenchido:
 * anotação legada (tudo `null`, listas vazias) não desenha nada e o card volta a
 * ser o de antes.
 */
const props = defineProps<{ anotacao: Anotacao }>()

const { t, locale } = useI18n()

const intlLocale = computed(() => INTL_LOCALE[locale.value as Locale])

const CAMPOS_DATA_HORA: CampoEscalar[] = ['dataEntrada', 'dataSaida']
const CAMPOS_DATA: CampoEscalar[] = ['dataResultado']
/** Texto corrido merece linha inteira; rótulo curto cabe em duas colunas. */
const CAMPOS_LONGOS: CampoEscalar[] = [
  'diagnostico',
  'laudoTexto',
  'produtos',
  'condicaoPele',
  'comportamento',
  'alimentacao',
  'intercorrencias',
  'motivo',
]

const visivel = computed(() => temEstruturados(props.anotacao))

const escalares = computed(() =>
  escalaresPreenchidos(props.anotacao).map((item) => ({
    campo: item.campo,
    label: t(`acessos.estruturada.campos.${item.campo}`),
    valor: formatar(item.campo, item.valor),
    longo: CAMPOS_LONGOS.includes(item.campo),
  })),
)

function formatar(campo: CampoEscalar, valor: string | number) {
  if (campo === 'pesoKg' && typeof valor === 'number') {
    return `${new Intl.NumberFormat(intlLocale.value, { maximumFractionDigits: 2 }).format(valor)} kg`
  }

  if (typeof valor !== 'string') {
    return String(valor)
  }

  if (CAMPOS_DATA_HORA.includes(campo)) {
    return formatarData(valor, { dateStyle: 'medium', timeStyle: 'short' })
  }

  if (CAMPOS_DATA.includes(campo)) {
    return formatarData(valor, { dateStyle: 'medium' })
  }

  return valor
}

function formatarData(valor: string, options: Intl.DateTimeFormatOptions) {
  const data = new Date(valor)

  return Number.isNaN(data.getTime()) ? valor : data.toLocaleString(intlLocale.value, options)
}

/** Linha compacta do item: só os campos que o prestador preencheu. */
function detalhesPrescricao(item: Anotacao['prescricaoItens'][number]) {
  const dose = [item.dose, item.unidade].filter(Boolean).join(' ')

  return [
    dose,
    item.frequencia,
    item.duracaoDias != null ? t('acessos.estruturada.view.duracao', item.duracaoDias) : '',
  ].filter(Boolean)
}
</script>

<template>
  <section v-if="visivel" class="estv" :aria-label="t('acessos.estruturada.view.title')">
    <dl v-if="escalares.length" class="estv__facts">
      <div
        v-for="item in escalares"
        :key="item.campo"
        class="estv__fact"
        :class="{ 'estv__fact--wide': item.longo }"
      >
        <dt>{{ item.label }}</dt>
        <dd>{{ item.valor }}</dd>
      </div>
    </dl>

    <div v-if="anotacao.prescricaoItens?.length" class="estv__block">
      <h4>
        <i class="ph ph-pill" aria-hidden="true" />
        {{ t('acessos.estruturada.prescricao.title') }}
      </h4>
      <ul class="estv__items">
        <li v-for="item in anotacao.prescricaoItens" :key="item.id">
          <div class="estv__linha">
            <strong>{{ item.nome }}</strong>
            <span v-if="detalhesPrescricao(item).length" class="estv__meta">
              {{ detalhesPrescricao(item).join(' · ') }}
            </span>
          </div>
          <p v-if="item.instrucoes" class="estv__note">{{ item.instrucoes }}</p>
          <span v-if="!item.frequencia" class="estv__warn">
            <i class="ph ph-warning" aria-hidden="true" />
            {{ t('acessos.estruturada.view.semFrequencia') }}
          </span>
        </li>
      </ul>
    </div>

    <div v-if="anotacao.examesSolicitados?.length" class="estv__block">
      <h4>
        <i class="ph ph-flask" aria-hidden="true" />
        {{ t('acessos.estruturada.exames.title') }}
      </h4>
      <ul class="estv__items">
        <li v-for="item in anotacao.examesSolicitados" :key="item.id">
          <div class="estv__linha">
            <strong>{{ item.nome }}</strong>
            <span v-if="item.observacao" class="estv__meta">{{ item.observacao }}</span>
          </div>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
/* Lido, não preenchido: rótulo pequeno em cima, valor embaixo, sem caixa em volta. */
.estv {
  container: estv / inline-size;
  display: grid;
  gap: 1rem;
}

/* Rótulo à esquerda, valor à direita, como numa ficha: lê em coluna sem empilhar altura. */
.estv__facts {
  display: grid;
  gap: 0.45rem;
  margin: 0;
}

.estv__fact {
  display: grid;
  grid-template-columns: 10.5rem minmax(0, 1fr);
  gap: 1rem;
  min-width: 0;
}

.estv__fact dt {
  padding-top: 0.1rem;
  color: color-mix(in srgb, var(--hc-tinta) 55%, var(--hc-cartao));
  font-size: 0.76rem;
  font-weight: 650;
}

@container estv (max-width: 30rem) {
  .estv__fact {
    grid-template-columns: minmax(0, 1fr);
    gap: 0.1rem;
  }
}

.estv__fact dd {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.88rem;
  line-height: 1.5;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.estv__block {
  display: grid;
  gap: 0.4rem;
}

.estv__block h4 {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  color: color-mix(in srgb, var(--hc-tinta) 55%, var(--hc-cartao));
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.estv__block h4 i {
  color: var(--hc-marca);
  font-size: 0.85rem;
}

.estv__items {
  display: grid;
  margin: 0;
  padding: 0;
  border: 1px solid var(--hc-borda);
  border-radius: 0.7rem;
  list-style: none;
}

.estv__items li {
  display: grid;
  gap: 0.2rem;
  padding: 0.6rem 0.8rem;
}

.estv__items li + li {
  border-top: 1px solid var(--hc-linha);
}

.estv__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.15rem 0.75rem;
}

.estv__linha strong {
  color: var(--hc-tinta);
  font-size: 0.88rem;
  font-weight: 700;
  line-height: 1.35;
}

.estv__meta {
  color: color-mix(in srgb, var(--hc-tinta) 68%, var(--hc-cartao));
  font-size: 0.8rem;
  font-variant-numeric: tabular-nums;
}

.estv__warn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--hc-pessego-tinta);
  font-size: 0.74rem;
  font-weight: 600;
}

.estv__note {
  margin: 0;
  color: color-mix(in srgb, var(--hc-tinta) 68%, var(--hc-cartao));
  font-size: 0.8rem;
  line-height: 1.45;
  white-space: pre-line;
}
</style>
