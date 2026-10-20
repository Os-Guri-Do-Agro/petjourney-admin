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
/*
 * Lido, não preenchido: rótulo à esquerda e valor à direita, como numa ficha; a receita e os
 * exames numa faixa afundada, um remédio por linha, como a receita impressa.
 */
.estv {
  container: estv / inline-size;
  display: grid;
  gap: 14px;
}

.estv__facts {
  display: grid;
  gap: 6px;
  margin: 0;
}

.estv__fact {
  display: grid;
  min-width: 0;
  gap: 16px;
  grid-template-columns: 11rem minmax(0, 1fr);
}

.estv__fact dt {
  padding-top: 2px;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

@container estv (max-width: 30rem) {
  .estv__fact {
    gap: 1px;
    grid-template-columns: minmax(0, 1fr);
  }
}

.estv__fact dd {
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  line-height: 1.5;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.estv__block {
  display: grid;
  gap: 6px;
}

.estv__block h4 {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
}

.estv__block h4 i {
  color: var(--pj-lugar-tinta, var(--musgo));
  font-size: 16px;
}

.estv__items {
  display: grid;
  margin: 0;
  padding: 0;
  border-radius: 12px;
  background: var(--superficie-2);
  list-style: none;
}

.estv__items li {
  display: grid;
  gap: 3px;
  padding: 10px 14px;
}

.estv__items li + li {
  border-top: 1px solid var(--linha);
}

.estv__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 12px;
}

.estv__linha strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.35;
}

.estv__meta {
  color: var(--tinta-2);
  font-family: var(--font-dados);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.estv__warn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--atencao-tinta);
  font-size: 12.5px;
  font-weight: 550;
}

.estv__note {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
  white-space: pre-line;
}
</style>
