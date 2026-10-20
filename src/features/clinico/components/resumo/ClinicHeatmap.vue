<script setup lang="ts">
/**
 * Mapa de calor de hora × dia da semana: onde a clínica lota.
 *
 * É a pergunta que a agenda não responde por rolagem — "que horário está sempre cheio?" — e a
 * que decide contratação, escala de almoço e onde caber um encaixe.
 *
 * Uma tabela de verdade, e não um gráfico do ApexCharts. O gráfico escondia justamente a coluna
 * das horas (a folga à esquerda era zero e o Apex cortava os rótulos), e a linha sem hora não diz
 * nada; ainda exigia uma segunda tabela, escondida, para o leitor de tela. Aqui a mesma tabela
 * serve aos dois: cabeçalho de linha é a hora, de coluna é o dia.
 *
 * A intensidade **não** é só cor. Cada célula carrega o número, e a cor entra como reforço; os
 * degraus são quatro e discretos, e não um gradiente contínuo — entre 3 e 4 atendimentos,
 * gradiente vira ruído de cor. O zero fica sem número: setenta zeros competiriam com os poucos
 * números que importam.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { CelulaDeHora } from '../../domain/resumo'

const props = defineProps<{
  celulas: CelulaDeHora[]
  pico: number
  /** Rótulos dos sete dias, de segunda a domingo. */
  dias: string[]
  vazio: string
}>()

const { t } = useI18n()

/** Segunda a domingo — mesma ordem de `inicioDaSemana`. */
const ORDEM = [1, 2, 3, 4, 5, 6, 0]

/** Faixa de horas desenhada: do primeiro ao último horário com movimento, nunca 0h–23h. */
const horas = computed(() => {
  if (props.celulas.length === 0) {
    return []
  }

  const inicio = props.celulas.reduce((menor, celula) => Math.min(menor, celula.hora), 23)
  const fim = props.celulas.reduce((maior, celula) => Math.max(maior, celula.hora), 0)
  const lista: number[] = []

  for (let hora = inicio; hora <= fim; hora += 1) {
    lista.push(hora)
  }

  return lista
})

function nomeDaHora(hora: number): string {
  return `${String(hora).padStart(2, '0')}h`
}

const porChave = computed(
  () => new Map(props.celulas.map((celula) => [`${celula.weekday}:${celula.hora}`, celula.valor])),
)

const grade = computed(() =>
  horas.value.map((hora) => ({
    hora,
    colunas: ORDEM.map((weekday) => ({
      weekday,
      valor: porChave.value.get(`${weekday}:${hora}`) ?? 0,
    })),
  })),
)

/**
 * Quatro degraus proporcionais ao pico, mais a faixa do zero.
 *
 * Os limites sobem sempre pelo menos um: com pico 3, `ceil(3 × 0,25)` e `ceil(3 × 0,5)` dariam
 * 1 e 2, mas com pico 2 dariam 1 e 1 — duas faixas na mesma cor e um degrau perdido.
 */
const degraus = computed(() => {
  const pico = Math.max(1, props.pico)
  const d1 = Math.max(1, Math.ceil(pico * 0.25))
  const d2 = Math.max(d1 + 1, Math.ceil(pico * 0.5))
  const d3 = Math.max(d2 + 1, Math.ceil(pico * 0.75))

  return { d1, d2, d3, d4: Math.max(d3 + 1, pico) }
})

function degrau(valor: number): 0 | 1 | 2 | 3 | 4 {
  const { d1, d2, d3 } = degraus.value

  if (valor <= 0) return 0
  if (valor <= d1) return 1
  if (valor <= d2) return 2
  if (valor <= d3) return 3
  return 4
}

/** Nome da faixa na legenda: o intervalo em números, que não precisa de tradução. */
function nomeDaFaixa(de: number, ate: number): string {
  return de === ate ? String(de) : `${de}–${ate}`
}

const legenda = computed(() => {
  const { d1, d2, d3, d4 } = degraus.value

  return [
    { degrau: 0, nome: '0' },
    { degrau: 1, nome: nomeDaFaixa(1, d1) },
    { degrau: 2, nome: nomeDaFaixa(d1 + 1, d2) },
    { degrau: 3, nome: nomeDaFaixa(d2 + 1, d3) },
    { degrau: 4, nome: nomeDaFaixa(d3 + 1, d4) },
  ]
})
</script>

<template>
  <p v-if="grade.length === 0" class="mapa__vazio">{{ vazio }}</p>

  <div v-else class="mapa">
    <table class="mapa__tabela">
      <thead>
        <tr>
          <th scope="col" class="mapa__canto">
            <span class="mapa__sr">{{ t('clinico.resumo.mapa.hora') }}</span>
          </th>
          <th v-for="(dia, indice) in dias" :key="dia + indice" scope="col">{{ dia }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="linha in grade" :key="linha.hora">
          <th scope="row">{{ nomeDaHora(linha.hora) }}</th>
          <td
            v-for="coluna in linha.colunas"
            :key="`${linha.hora}-${coluna.weekday}`"
            class="mapa__celula"
            :class="`mapa__celula--${degrau(coluna.valor)}`"
          >
            <span v-if="coluna.valor > 0">{{ coluna.valor }}</span>
            <span v-else class="mapa__sr">0</span>
          </td>
        </tr>
      </tbody>
    </table>

    <ul class="mapa__legenda" aria-hidden="true">
      <li v-for="faixa in legenda" :key="faixa.degrau">
        <span class="mapa__amostra" :class="`mapa__celula--${faixa.degrau}`" />
        {{ faixa.nome }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.mapa {
  display: grid;
  gap: 0.75rem;
}

.mapa__tabela {
  width: 100%;
  border-collapse: separate;
  border-spacing: 3px;
  table-layout: fixed;
  font-variant-numeric: tabular-nums;
}

.mapa__tabela th {
  color: var(--tinta-2);
  font-size: 0.75rem;
  font-weight: 650;
}

.mapa__tabela thead th {
  padding-block-end: 0.15rem;
}

/* A coluna das horas: estreita, alinhada à célula. */
.mapa__canto,
.mapa__tabela tbody th {
  width: 2.6rem;
  padding-inline-end: 0.35rem;
  text-align: end;
}

.mapa__celula {
  height: 2rem;
  border-radius: 8px;
  font-family: var(--font-dados);
  font-size: 0.75rem;
  font-weight: 650;
  text-align: center;
}

/* A escada na cor do lugar (a Clínica): do poço vazio ao azul cheio do horário que lota. */
.mapa__celula--0 {
  background: var(--superficie-2);
}

.mapa__celula--1 {
  background: color-mix(in oklab, var(--clinica) 14%, var(--superficie));
  color: var(--tinta);
}

.mapa__celula--2 {
  background: color-mix(in oklab, var(--clinica) 30%, var(--superficie));
  color: var(--tinta);
}

.mapa__celula--3 {
  background: color-mix(in oklab, var(--clinica) 56%, var(--superficie));
  color: var(--tinta);
}

.mapa__celula--4 {
  background: var(--clinica);
  color: var(--superficie);
}

.mapa__legenda {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem 0.9rem;
  margin: 0;
  padding: 0;
  padding-inline-start: 2.6rem;
  color: var(--tinta-2);
  font-size: 0.75rem;
  font-weight: 600;
  list-style: none;
}

.mapa__legenda li {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

.mapa__amostra {
  display: inline-block;
  width: 0.875rem;
  height: 0.875rem;
  border-radius: 4px;
}

.mapa__vazio {
  margin: 0;
  color: var(--tinta-2);
  font-size: 0.8125rem;
}

.mapa__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
