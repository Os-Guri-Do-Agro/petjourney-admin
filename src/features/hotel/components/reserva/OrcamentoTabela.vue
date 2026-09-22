<script setup lang="ts">
/**
 * O orçamento, linha a linha.
 *
 * **Um total sozinho é uma conta que o cliente não confere e a recepção não defende.** Cada linha
 * diz o que é, quantas vezes e quanto, e a soma acontece à vista. É a diferença entre "são 540
 * reais" e "são oito diárias de 60, mais o banho de 89, menos o sinal" — e só a segunda sobrevive
 * à pergunta seguinte.
 *
 * A linha de temporada existe separada pelo mesmo motivo: embutida na diária, o acréscimo de Natal
 * vira uma suspeita de que o hotel aumentou o preço.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useHotelFormat } from '../../composables/useHotelFormat'
import type { LinhaDoOrcamento, Orcamento } from '../../data/types'

const props = withDefaults(
  defineProps<{
    orcamento: Orcamento
    pagoCentavos?: number
    /** Compacta: some a coluna de quantidade, para caber em cartão estreito. */
    densa?: boolean
  }>(),
  { pagoCentavos: 0, densa: false },
)

const { t } = useI18n()
const formato = useHotelFormat()

function rotulo(linha: LinhaDoOrcamento): string {
  return linha.kind === 'servico' && linha.servicoKind
    ? formato.servico(linha.servicoKind)
    : t(`hotel.orcamento.linha.${linha.kind}`)
}

const temPagamento = computed(() => props.pagoCentavos > 0)
</script>

<template>
  <table class="orc" :class="{ 'orc--densa': densa }">
    <caption class="orc__caption">
      {{
        t('hotel.orcamento.titulo')
      }}
    </caption>

    <thead>
      <tr>
        <th scope="col">{{ t('hotel.orcamento.item') }}</th>
        <th v-if="!densa" scope="col" class="orc__num">{{ t('hotel.orcamento.quantidade') }}</th>
        <th v-if="!densa" scope="col" class="orc__num">{{ t('hotel.orcamento.unitario') }}</th>
        <th scope="col" class="orc__num">{{ t('hotel.orcamento.total') }}</th>
      </tr>
    </thead>

    <tbody>
      <tr v-for="(linha, indice) in orcamento.linhas" :key="`${linha.kind}-${indice}`">
        <th scope="row">{{ rotulo(linha) }}</th>
        <td v-if="!densa" class="orc__num clinic-value">{{ formato.numero(linha.quantidade) }}</td>
        <td v-if="!densa" class="orc__num clinic-value">
          {{ formato.moeda(linha.valorUnitarioCentavos) }}
        </td>
        <td class="orc__num clinic-value">{{ formato.moeda(linha.totalCentavos) }}</td>
      </tr>
    </tbody>

    <tfoot>
      <tr class="orc__total">
        <th scope="row" :colspan="densa ? 1 : 3">{{ t('hotel.orcamento.somaTotal') }}</th>
        <td class="orc__num clinic-value">{{ formato.moeda(orcamento.totalCentavos) }}</td>
      </tr>

      <tr v-if="temPagamento">
        <th scope="row" :colspan="densa ? 1 : 3">{{ t('hotel.orcamento.pago') }}</th>
        <td class="orc__num clinic-value">−{{ formato.moeda(pagoCentavos) }}</td>
      </tr>

      <!--
        O saldo é o número que o balcão cobra na saída, e por isso ele — e não o total — é o que
        fica em destaque no rodapé.
      -->
      <tr class="orc__saldo">
        <th scope="row" :colspan="densa ? 1 : 3">{{ t('hotel.orcamento.saldo') }}</th>
        <td class="orc__num clinic-value">{{ formato.moeda(orcamento.saldoCentavos) }}</td>
      </tr>

      <tr v-if="!temPagamento" class="orc__sinal">
        <th scope="row" :colspan="densa ? 1 : 3">{{ t('hotel.orcamento.sinalSugerido') }}</th>
        <td class="orc__num clinic-value">{{ formato.moeda(orcamento.sinalCentavos) }}</td>
      </tr>
    </tfoot>
  </table>
</template>

<style scoped>
.orc {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--clinic-font-label);
}

.orc__caption {
  padding-bottom: var(--clinic-space-2);
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-align: start;
  text-transform: uppercase;
}

.orc th,
.orc td {
  padding: 0.35rem 0.5rem;
  text-align: start;
}

.orc thead th {
  border-bottom: 1px solid var(--clinic-line);
  color: var(--clinic-faint);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.orc tbody th {
  font-weight: 600;
}

.orc tbody tr + tr th,
.orc tbody tr + tr td {
  border-top: 1px solid var(--clinic-line-soft);
}

.orc__num {
  text-align: end;
  font-variant-numeric: tabular-nums;
}

.orc tfoot th,
.orc tfoot td {
  border-top: 1px solid var(--clinic-line);
}

.orc__total th,
.orc__total td {
  font-weight: 750;
}

.orc__saldo th,
.orc__saldo td {
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-body);
  font-weight: 800;
}

.orc__sinal th,
.orc__sinal td {
  border-top-color: var(--clinic-line-soft);
  color: var(--clinic-faint);
}
</style>
