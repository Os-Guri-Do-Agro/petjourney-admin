<script setup lang="ts">
/**
 * Mapa de calor de hora × dia da semana: onde a clínica lota.
 *
 * É a pergunta que a agenda não responde por rolagem — "que horário está sempre cheio?" —
 * e a que decide contratação, escala de almoço e onde caber um encaixe.
 *
 * A intensidade **não** é só cor. Cada célula carrega o número, e a cor entra como reforço:
 * mapa de calor que só fala por cor exclui quem não distingue verde de âmbar e morre impresso
 * em preto e branco.
 */
import { computed } from 'vue'

import type { CelulaDeHora } from '../../domain/resumo'

const props = defineProps<{
  celulas: CelulaDeHora[]
  pico: number
  /** Rótulos dos sete dias, de segunda a domingo. */
  dias: string[]
  vazio: string
}>()

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

/** Segunda a domingo — mesma ordem de `inicioDaSemana`. */
const ORDEM = [1, 2, 3, 4, 5, 6, 0]

const grade = computed(() => {
  const porChave = new Map(
    props.celulas.map((celula) => [`${celula.weekday}:${celula.hora}`, celula.valor]),
  )

  return horas.value.map((hora) => ({
    hora,
    colunas: ORDEM.map((weekday) => {
      const valor = porChave.get(`${weekday}:${hora}`) ?? 0

      return {
        weekday,
        valor,
        /** Quatro degraus: sem degrau contínuo a diferença entre 3 e 4 vira ruído de cor. */
        nivel: valor === 0 ? 0 : Math.min(4, Math.ceil((valor / Math.max(1, props.pico)) * 4)),
      }
    }),
  }))
})
</script>

<template>
  <div class="mapa">
    <p v-if="grade.length === 0" class="mapa__vazio">{{ vazio }}</p>

    <table v-else class="mapa__grade">
      <thead>
        <tr>
          <th scope="col"><span class="mapa__oculto">h</span></th>
          <th v-for="(dia, indice) in dias" :key="dia + indice" scope="col">{{ dia }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="linha in grade" :key="linha.hora">
          <th scope="row" class="mapa__hora clinic-value">
            {{ String(linha.hora).padStart(2, '0') }}h
          </th>
          <td
            v-for="coluna in linha.colunas"
            :key="`${linha.hora}-${coluna.weekday}`"
            class="mapa__celula"
            :class="`mapa__celula--n${coluna.nivel}`"
          >
            {{ coluna.valor || '' }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.mapa {
  overflow-x: auto;
}

.mapa__vazio {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.mapa__grade {
  width: 100%;
  border-collapse: separate;
  border-spacing: 2px;
  table-layout: fixed;
}

.mapa__grade th {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.mapa__hora {
  width: 2.6rem;
  color: var(--clinic-muted);
  text-align: right;
  padding-right: 0.3rem;
}

.mapa__oculto {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.mapa__celula {
  height: 1.5rem;
  border-radius: 0.28rem;
  background: var(--clinic-surface-sunken);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 750;
  text-align: center;
}

.mapa__celula--n1 {
  background: color-mix(in srgb, var(--clinic-accent) 22%, var(--clinic-surface));
  color: var(--clinic-text);
}

/* Texto pleno a partir do nível 2: com `muted` sobre 45% de acento a razão caía a 3,4:1. */
.mapa__celula--n2 {
  background: color-mix(in srgb, var(--clinic-accent) 45%, var(--clinic-surface));
  color: var(--clinic-text);
}

/*
 * Escurecer a célula até o branco fechar 4,5:1 fecharia junto a distância para o nível 4, e um
 * mapa de quatro degraus com dois degraus iguais deixa de ser mapa. Quem inverte é o texto — e
 * com uma tinta que não acompanha o tema, porque o fundo desta célula também não acompanha.
 */
.mapa__celula--n3 {
  background: color-mix(in srgb, var(--clinic-accent-strong) 68%, var(--clinic-surface));
  color: var(--clinic-heat-ink);
}

.mapa__celula--n4 {
  background: var(--clinic-accent-strong);
  color: var(--clinic-surface);
}
</style>
