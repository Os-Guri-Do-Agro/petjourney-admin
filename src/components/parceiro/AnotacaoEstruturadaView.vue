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
    label: t(`atendimentos.estruturada.campos.${item.campo}`),
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
    item.duracaoDias != null ? t('atendimentos.estruturada.view.duracao', item.duracaoDias) : '',
  ].filter(Boolean)
}
</script>

<template>
  <section v-if="visivel" class="estv" :aria-label="t('atendimentos.estruturada.view.title')">
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
        <i class="pi pi-inbox" aria-hidden="true" />
        {{ t('atendimentos.estruturada.prescricao.title') }}
      </h4>
      <ul class="estv__items">
        <li v-for="item in anotacao.prescricaoItens" :key="item.id">
          <strong>{{ item.nome }}</strong>
          <span v-if="detalhesPrescricao(item).length" class="estv__meta">
            {{ detalhesPrescricao(item).join(' · ') }}
          </span>
          <span v-if="!item.frequencia" class="estv__warn">
            <i class="pi pi-info-circle" aria-hidden="true" />
            {{ t('atendimentos.estruturada.view.semFrequencia') }}
          </span>
          <p v-if="item.instrucoes" class="estv__note">{{ item.instrucoes }}</p>
        </li>
      </ul>
    </div>

    <div v-if="anotacao.examesSolicitados?.length" class="estv__block">
      <h4>
        <i class="pi pi-search" aria-hidden="true" />
        {{ t('atendimentos.estruturada.exames.title') }}
      </h4>
      <ul class="estv__items">
        <li v-for="item in anotacao.examesSolicitados" :key="item.id">
          <strong>{{ item.nome }}</strong>
          <p v-if="item.observacao" class="estv__note">{{ item.observacao }}</p>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.estv {
  display: grid;
  gap: 0.65rem;
  padding-top: 0.65rem;
  border-top: 1px solid color-mix(in srgb, var(--partner-line) 88%, transparent);
}

.estv__facts {
  display: grid;
  gap: 0.45rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 0;
}

.estv__fact {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
  padding: 0.5rem 0.65rem;
  border-radius: 0.7rem;
  background: color-mix(in srgb, var(--partner-surface) 72%, var(--partner-card));
}

.estv__fact--wide {
  grid-column: 1 / -1;
}

.estv__fact dt {
  color: var(--partner-faint);
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.estv__fact dd {
  margin: 0;
  color: var(--partner-text);
  font-size: 0.86rem;
  font-weight: 550;
  line-height: 1.5;
  white-space: pre-line;
  overflow-wrap: anywhere;
}

.estv__block {
  display: grid;
  gap: 0.35rem;
}

.estv__block h4 {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  color: var(--partner-faint);
  font-size: 0.68rem;
  font-weight: 750;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.estv__block h4 i {
  color: var(--partner-primary-strong);
  font-size: 0.68rem;
}

.estv__items {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.estv__items li {
  display: grid;
  gap: 0.2rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid color-mix(in srgb, var(--partner-line) 90%, transparent);
  border-radius: 0.7rem;
  background: var(--partner-card);
}

.estv__items strong {
  color: var(--partner-text);
  font-size: 0.84rem;
  font-weight: 700;
  line-height: 1.3;
}

.estv__meta {
  color: var(--partner-muted);
  font-size: 0.76rem;
  font-weight: 600;
}

.estv__warn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--partner-amber-text);
  font-size: 0.74rem;
  font-weight: 650;
}

.estv__warn i {
  font-size: 0.7rem;
}

.estv__note {
  margin: 0.1rem 0 0;
  color: var(--partner-muted);
  font-size: 0.78rem;
  line-height: 1.45;
  white-space: pre-line;
}

@media (max-width: 640px) {
  .estv__facts {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
