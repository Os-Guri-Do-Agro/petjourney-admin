<script setup lang="ts">
/**
 * As movimentações da carteira, agrupadas por dia, como num extrato de banco: o dia com o saldo
 * dele à direita, e cada lançamento com o sinal e a cor do que fez com o saldo (entrou, verde e
 * "+"; saiu, tinta normal e "−"). Os valores ficam alinhados à direita, em algarismos de mesma
 * largura, para a coluna ler de cima a baixo.
 *
 * Crédito de participação que ainda está na janela de segurança diz quando libera: são 14 dias
 * por crédito (`comissao.config.ts`), contados de quando ele entrou.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { ApiError } from '@/service/api'
import { getCarteiraExtrato } from '@/service/parceiro/parceiro-portal-service'
import type { TransacaoCarteira } from '@/service/parceiro/types'
import { formatCentavosToBrl } from '@/utils/format/money'

type ExtratoDayGroup = {
  dayKey: string
  label: string
  /** Data completa para o leitor de tela e para o `datetime`. */
  dataLonga: string
  totalCentavos: number
  items: TransacaoCarteira[]
}

/** A janela de segurança de cada crédito, em dias (a mesma do backend). */
const JANELA_DE_SEGURANCA_DIAS = 14

const emit = defineEmits<{
  needsProgramas: []
}>()

const { t, te, locale } = useI18n()
const { ensureContext, parceiroQuery, store } = useParceiroPortal()
const items = ref<TransacaoCarteira[]>([])
const nextCursor = ref<string | null>(null)
const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')

function intlLocale() {
  return INTL_LOCALE[locale.value as Locale]
}

function localDayKey(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function formatDayLabel(date: Date) {
  const today = startOfLocalDay(new Date())
  const target = startOfLocalDay(date)
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86_400_000)

  if (diffDays === 0) {
    return t('carteira.extrato.today')
  }

  if (diffDays === 1) {
    return t('carteira.extrato.yesterday')
  }

  return new Intl.DateTimeFormat(intlLocale(), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(date)
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(intlLocale(), {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

const groupedItems = computed((): ExtratoDayGroup[] => {
  const dias = new Map<string, ExtratoDayGroup>()

  for (const item of items.value) {
    const date = new Date(item.createdAt)
    if (Number.isNaN(date.getTime())) {
      continue
    }

    const dayKey = localDayKey(date)
    let dia = dias.get(dayKey)

    if (!dia) {
      dia = {
        dayKey,
        label: formatDayLabel(date),
        dataLonga: new Intl.DateTimeFormat(intlLocale(), { dateStyle: 'full' }).format(date),
        totalCentavos: 0,
        items: [],
      }
      dias.set(dayKey, dia)
    }

    dia.totalCentavos += item.valorCentavos
    dia.items.push(item)
  }

  return [...dias.values()]
})

/** "+ R$ 45,90" e "− R$ 120,00": o sinal escrito, nunca só a cor. */
function valorComSinal(centavos: number) {
  const valor = formatCentavosToBrl(Math.abs(centavos), intlLocale())

  if (centavos > 0) {
    return `+\u2009${valor}`
  }

  return centavos < 0 ? `\u2212\u2009${valor}` : valor
}

const ICONE_DO_TIPO: Record<TransacaoCarteira['tipo'], string> = {
  CREDITO_COMISSAO: 'ph ph-arrow-down-left',
  ESTORNO: 'ph ph-arrow-u-up-left',
  DEBITO_SAQUE: 'ph ph-arrow-up-right',
  AJUSTE: 'ph ph-sliders-horizontal',
}

/** De onde veio o crédito e o plano, com nome de gente (o enum cru era "INITIAL_PURCHASE"). */
function detalheDo(item: TransacaoCarteira) {
  const partes: string[] = []

  if (item.origem) {
    const chave = `carteira.extrato.origem.${item.origem}`
    partes.push(te(chave) ? t(chave) : item.origem)
  }

  if (item.periodicidade) {
    const chave = `carteira.extrato.periodicidade.${item.periodicidade}`
    partes.push(te(chave) ? t(chave) : item.periodicidade)
  }

  partes.push(formatTime(item.createdAt))

  return partes.join(' · ')
}

/** Crédito ainda na janela de segurança: o dia em que vira saldo sacável. */
function liberaEm(item: TransacaoCarteira) {
  if (item.tipo !== 'CREDITO_COMISSAO' || item.valorCentavos <= 0) {
    return ''
  }

  const entrou = new Date(item.createdAt)
  if (Number.isNaN(entrou.getTime())) {
    return ''
  }

  const libera = new Date(entrou.getTime() + JANELA_DE_SEGURANCA_DIAS * 86_400_000)

  if (libera.getTime() <= Date.now()) {
    return ''
  }

  return new Intl.DateTimeFormat(intlLocale(), { day: 'numeric', month: 'short' }).format(libera)
}

async function loadExtrato(cursor?: string) {
  if (cursor) {
    loadingMore.value = true
  } else {
    loading.value = true
    error.value = ''
  }

  try {
    await ensureContext()

    if (!store.statusAfiliadoAtivo) {
      emit('needsProgramas')
      return
    }

    const page = await getCarteiraExtrato({ ...parceiroQuery(), cursor, limit: 20 })

    if (cursor) {
      items.value = [...items.value, ...page.items]
    } else {
      items.value = page.items
    }

    nextCursor.value = page.nextCursor
  } catch (err) {
    if (err instanceof ApiError && err.statusCode === 409) {
      emit('needsProgramas')
      return
    }

    /** 403 aqui pode ser o parceiro excluído no meio da sessão: a tela de saída assume. */
    if (await store.revalidarAcesso(err)) {
      return
    }

    error.value = err instanceof Error ? err.message : t('carteira.extrato.errorLoad')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

onMounted(() => {
  void loadExtrato()
})
</script>


<template>
  <div id="partner-panel-extrato" class="extrato">
    <div
      v-if="loading"
      class="extrato__folha ui-folha"
      role="status"
      aria-live="polite"
      :aria-label="t('carteira.extrato.loadingTitle')"
    >
      <div class="extrato__dia-cab" aria-hidden="true">
        <Skeleton width="6rem" height="0.8rem" border-radius="6px" />
      </div>
      <div v-for="n in 3" :key="n" class="lancamento" aria-hidden="true">
        <Skeleton width="36px" height="36px" border-radius="10px" />
        <span class="lancamento__texto">
          <Skeleton width="11rem" height="0.9rem" border-radius="6px" />
          <Skeleton width="8rem" height="0.75rem" border-radius="6px" />
        </span>
        <Skeleton width="6rem" height="1rem" border-radius="6px" />
      </div>
    </div>

    <div v-else-if="error" class="extrato__estado ui-folha" role="alert">
      <span class="extrato__estado-icone extrato__estado-icone--erro" aria-hidden="true">
        <i class="ph ph-warning-circle" />
      </span>
      <p>{{ error }}</p>
      <Button
        type="button"
        :label="t('carteira.extrato.retry')"
        icon="ph ph-arrow-clockwise"
        severity="secondary"
        outlined
        @click="loadExtrato()"
      />
    </div>

    <div v-else-if="items.length === 0" class="extrato__estado ui-folha">
      <span class="extrato__estado-icone" aria-hidden="true"><i class="ph ph-list-bullets" /></span>
      <strong>{{ t('carteira.extrato.emptyTitle') }}</strong>
      <p>{{ t('carteira.extrato.emptyBody') }}</p>
    </div>

    <template v-else>
      <div class="extrato__folha ui-folha">
        <section
          v-for="day in groupedItems"
          :key="day.dayKey"
          class="extrato__dia"
          :aria-label="day.dataLonga"
        >
          <header class="extrato__dia-cab">
            <h3 class="extrato__dia-nome">
              <time :datetime="day.dayKey">{{ day.label }}</time>
            </h3>
            <span
              class="extrato__dia-total ui-num"
              :class="{ 'is-positivo': day.totalCentavos > 0 }"
            >
              {{ valorComSinal(day.totalCentavos) }}
            </span>
          </header>

          <ul class="extrato__lista">
            <li
              v-for="item in day.items"
              :key="item.id"
              class="lancamento"
              :class="item.valorCentavos > 0 ? 'lancamento--credito' : 'lancamento--debito'"
            >
              <span class="lancamento__icone" aria-hidden="true">
                <i :class="ICONE_DO_TIPO[item.tipo] ?? 'ph ph-circle'" />
              </span>

              <span class="lancamento__texto">
                <strong class="lancamento__titulo">{{ t(`carteira.extrato.tipo.${item.tipo}`) }}</strong>
                <span class="lancamento__meta ui-num">{{ detalheDo(item) }}</span>
              </span>

              <span v-if="liberaEm(item)" class="ui-selo lancamento__libera">
                <i class="ph ph-hourglass-medium" aria-hidden="true" />
                {{ t('carteira.extrato.liberaEm', { data: liberaEm(item) }) }}
              </span>

              <strong
                class="lancamento__valor ui-num"
                :class="{ 'is-negative': item.valorCentavos < 0, 'is-positivo': item.valorCentavos > 0 }"
              >
                {{ valorComSinal(item.valorCentavos) }}
              </strong>
            </li>
          </ul>
        </section>
      </div>

      <Button
        v-if="nextCursor"
        class="extrato__mais"
        type="button"
        :label="t('carteira.extrato.loadMore')"
        :loading="loadingMore"
        severity="secondary"
        outlined
        @click="loadExtrato(nextCursor ?? undefined)"
      />
    </template>
  </div>
</template>

<style scoped>
.extrato {
  display: grid;
  gap: 14px;
}

.extrato__folha {
  overflow: hidden;
}

.extrato__mais.p-button {
  justify-self: center;
}

/* ------------------------------------------------------------------ o dia */

.extrato__dia + .extrato__dia {
  border-top: 1px solid var(--linha);
}

/* A faixa do dia: o nome do dia à esquerda e o que ele somou à direita, na coluna dos valores. */
.extrato__dia-cab {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 20px;
  border-bottom: 1px solid var(--linha);
  background: var(--superficie-2);
}

.extrato__dia-nome {
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

/* Só a primeira letra: `capitalize` fazia "Seg., 7 De Out." (e "Septembar" no sérvio). */
.extrato__dia-nome time {
  display: inline-block;
}

.extrato__dia-nome time::first-letter {
  text-transform: uppercase;
}

.extrato__dia-total {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
}

.extrato__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* ------------------------------------------------------------------ o lançamento */

.lancamento {
  display: flex;
  min-height: 64px;
  align-items: center;
  gap: 14px;
  padding: 10px 20px;
}

.lancamento + .lancamento {
  border-top: 1px solid var(--linha);
}

.lancamento__icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--superficie-3);
  color: var(--tinta-2);
  font-size: 18px;
}

.lancamento--credito .lancamento__icone {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.lancamento__texto {
  display: grid;
  flex: 1;
  min-width: 0;
  gap: 2px;
}

.lancamento__titulo {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lancamento__meta {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lancamento__libera.ui-selo {
  flex: none;
}

/* A coluna dos valores: largura fixa, à direita, algarismos de mesma largura. */
.lancamento__valor {
  min-width: 8.5rem;
  flex: none;
  color: var(--tinta);
  font-size: 15.5px;
  font-weight: 650;
  text-align: end;
  white-space: nowrap;
}

.is-positivo {
  color: var(--ok-tinta);
}

.extrato__dia-total.is-positivo {
  color: var(--ok-tinta);
}

/* ------------------------------------------------------------------ estados */

.extrato__estado {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 36px 24px;
  text-align: center;
}

.extrato__estado strong {
  color: var(--tinta);
  font-size: 16px;
  font-weight: 600;
}

.extrato__estado p {
  max-width: 44ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

.extrato__estado-icone {
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border-radius: 14px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 22px;
}

.extrato__estado-icone--erro {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

@media (max-width: 640px) {
  .extrato__dia-cab,
  .lancamento {
    padding-inline: 14px;
  }

  .lancamento {
    flex-wrap: wrap;
    row-gap: 6px;
  }

  .lancamento__texto {
    flex-basis: calc(100% - 50px - 7rem);
  }

  .lancamento__valor {
    min-width: 0;
  }

  /* O selo de liberação desce para a linha de baixo, alinhado com o texto. */
  .lancamento__libera.ui-selo {
    order: 3;
    margin-inline-start: 50px;
  }
}
</style>
