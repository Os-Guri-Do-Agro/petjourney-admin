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
 * vira uma suspeita de que o hotel aumentou o preço. O saldo a receber fecha a conta, grande: é o
 * número que o balcão cobra na saída.
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
    /** O título fica só para o leitor de tela: a seção em volta já diz o que é. */
    semTitulo?: boolean
  }>(),
  { pagoCentavos: 0, densa: false, semTitulo: false },
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
    <caption class="orc__caption" :class="{ 'orc__caption--oculta': semTitulo }">
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
        <td v-if="!densa" class="orc__num ui-num">{{ formato.numero(linha.quantidade) }}</td>
        <td v-if="!densa" class="orc__num ui-num">
          {{ formato.moeda(linha.valorUnitarioCentavos) }}
        </td>
        <td class="orc__num ui-num">{{ formato.moeda(linha.totalCentavos) }}</td>
      </tr>
    </tbody>

    <tfoot>
      <tr class="orc__total">
        <th scope="row" :colspan="densa ? 1 : 3">{{ t('hotel.orcamento.somaTotal') }}</th>
        <td class="orc__num ui-num">{{ formato.moeda(orcamento.totalCentavos) }}</td>
      </tr>

      <tr v-if="temPagamento" class="orc__pago">
        <th scope="row" :colspan="densa ? 1 : 3">{{ t('hotel.orcamento.pago') }}</th>
        <td class="orc__num ui-num">−{{ formato.moeda(pagoCentavos) }}</td>
      </tr>

      <!--
        O saldo é o número que o balcão cobra na saída, e por isso ele — e não o total — é o que
        fica em destaque no rodapé.
      -->
      <tr class="orc__saldo">
        <th scope="row" :colspan="densa ? 1 : 3">{{ t('hotel.orcamento.saldo') }}</th>
        <td class="orc__num ui-num">{{ formato.moeda(orcamento.saldoCentavos) }}</td>
      </tr>

      <tr v-if="!temPagamento" class="orc__sinal">
        <th scope="row" :colspan="densa ? 1 : 3">{{ t('hotel.orcamento.sinalSugerido') }}</th>
        <td class="orc__num ui-num">{{ formato.moeda(orcamento.sinalCentavos) }}</td>
      </tr>
    </tfoot>
  </table>
</template>

<style scoped>
.orc {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  color: var(--tinta);
  font-size: 14px;
}

.orc__caption {
  padding-bottom: 10px;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
  text-align: start;
}

.orc__caption--oculta {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.orc th,
.orc td {
  padding: 9px 10px;
  text-align: start;
}

/* O cabeçalho das colunas num poço, como as tabelas do kit. */
.orc thead th {
  height: 38px;
  padding-block: 0;
  background: var(--superficie-2);
  color: var(--tinta-3);
  font-size: 12.5px;
  font-weight: 600;
}

.orc thead th:first-child {
  border-start-start-radius: 10px;
  border-end-start-radius: 10px;
}

.orc thead th:last-child {
  border-start-end-radius: 10px;
  border-end-end-radius: 10px;
}

.orc tbody th {
  font-weight: 500;
}

.orc tbody tr + tr th,
.orc tbody tr + tr td {
  border-top: 1px solid var(--linha-suave);
}

.orc tbody th,
.orc tbody td {
  height: 44px;
}

.orc .orc__num {
  text-align: end;
  white-space: nowrap;
}

.orc tfoot th,
.orc tfoot td {
  border-top: 1px solid var(--linha-suave);
}

.orc tbody tr:first-child th,
.orc tbody tr:first-child td {
  border-top: 0;
}

.orc__total th,
.orc__total td {
  font-weight: 600;
}

.orc__pago th,
.orc__pago td {
  color: var(--ok-tinta);
}

.orc .orc__saldo th,
.orc .orc__saldo td {
  padding-block: 12px;
  border-top: 1px solid var(--linha-media);
  color: var(--tinta);
  font-size: 16px;
  font-weight: 650;
}

.orc__saldo td {
  font-size: 19px;
  letter-spacing: -0.01em;
}

.orc__sinal th,
.orc__sinal td {
  color: var(--tinta-2);
  font-size: 13px;
}
</style>
