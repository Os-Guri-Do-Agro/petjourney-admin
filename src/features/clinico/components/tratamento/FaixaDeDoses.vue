<script setup lang="ts">
/**
 * A faixa de doses: um quadradinho por dose, uma coluna por dia, uma linha por horário.
 *
 * É a "adesão em uma linha" do requisito, desenhada em vez de calculada. Um número ("39 de 41")
 * responde quanto; a faixa responde **como** — e é o como que o vet procura: a dose das 23h que
 * ninguém marca aparece como uma linha inteira mais clara, o fim de semana sem registro aparece
 * como um vão que se repete, os dois dias em que acabou o remédio aparecem juntos no fim.
 *
 * O desenho tem uma regra só: **não julgar.**
 *
 * - **Dada** é a tinta sálvia do módulo. **Pulada** é pêssego — é o que a casa disse que não deu,
 *   com motivo, e merece ser vista; não é vermelho, porque não é erro de ninguém.
 * - **Sem registro** é o cinza do trilho vazio, a mesma cor de "não se sabe". Ele não usa a cor
 *   da pulada nem nenhuma cor de aviso: a dose pode ter sido dada sem ser marcada.
 * - **A dose da vez** é só um contorno. **Prevista** é quase nada.
 *
 * O par sálvia × pêssego foi conferido para daltonismo (ΔE ≥ 12 no claro e ≥ 14 no escuro, com o
 * pêssego escurecido no tema escuro). O leitor de tela recebe a frase inteira pelo `rotulo`; a
 * tabela de registros, ao lado, é a versão sem cor desta faixa.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import './faixa-cores.css'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { ISODate, ISODateTime } from '../../data/types'
import { horariosDoDia, type DoseNaGrade, type SituacaoDaDose } from '../../domain/adesao'
import { addDays, diffDays } from '../../domain/clinic-time'
import { clinicClock } from '../../stores/clinico'

const props = withDefaults(
  defineProps<{
    doses: DoseNaGrade[]
    frequenciaHoras: number
    /** A frase que o leitor de tela lê no lugar da faixa. */
    rotulo: string
    /** Quantos dias, contando do último para trás. */
    dias?: number
    /** Célula menor e sem eixos: a linha de uma tabela. */
    compacta?: boolean
    /** A última consulta: um fio antes do primeiro dia depois dela. */
    marco?: ISODateTime | null
    /** Quem registrou, pelo id — para a leitura ao passar o ponteiro. */
    nomes?: Record<string, string>
  }>(),
  { dias: 42, compacta: false, marco: null, nomes: () => ({}) },
)

const { t } = useI18n()
const formato = useClinicFormat()

type Celula = {
  chave: string
  situacao: SituacaoDaDose | 'vazia'
  dose: DoseNaGrade | null
}

type Coluna = { dia: ISODate; celulas: Celula[]; marco: boolean }

/** A grade repete os mesmos horários todo dia? Aí cada linha é um horário fixo. */
const regular = computed(
  () =>
    props.frequenciaHoras > 0 && props.frequenciaHoras <= 24 && 24 % props.frequenciaHoras === 0,
)

const horarios = computed(() => {
  const primeira = props.doses[0]

  if (!primeira || !regular.value) {
    return [] as string[]
  }

  return horariosDoDia(primeira.previstaEm, props.frequenciaHoras).sort()
})

const linhas = computed(() => Math.max(1, horarios.value.length))

const colunas = computed<Coluna[]>(() => {
  const primeira = props.doses[0]
  const ultima = props.doses[props.doses.length - 1]

  if (!primeira || !ultima) {
    return []
  }

  const fim = clinicClock.dateOf(ultima.previstaEm)
  const inicio = [
    clinicClock.dateOf(primeira.previstaEm),
    addDays(fim, -(props.dias - 1)),
  ].sort()[1]!
  const total = diffDays(inicio, fim) + 1
  const porDia = new Map<ISODate, DoseNaGrade[]>()

  for (const dose of props.doses) {
    const dia = clinicClock.dateOf(dose.previstaEm)

    porDia.set(dia, [...(porDia.get(dia) ?? []), dose])
  }

  const diaDoMarco = props.marco ? clinicClock.dateOf(props.marco) : null

  return Array.from({ length: total }, (_, indice) => {
    const dia = addDays(inicio, indice)
    const doDia = porDia.get(dia) ?? []
    const celulas: Celula[] = Array.from({ length: linhas.value }, (_, linha) => ({
      chave: `${dia}-${linha}`,
      situacao: 'vazia',
      dose: null,
    }))

    doDia.forEach((dose, ordem) => {
      const linha = regular.value ? horarios.value.indexOf(dose.previstaEm.slice(11, 16)) : ordem
      const celula = celulas[linha]

      if (celula) {
        celula.situacao = dose.situacao
        celula.dose = dose
      }
    })

    return { dia, celulas, marco: indice > 0 && dia === diaDoMarco }
  })
})

// ------------------------------------------------------------------ leitura ao passar o ponteiro

const faixa = ref<HTMLElement | null>(null)
const emFoco = ref<{
  texto: string
  x: number
  y: number
  /** Perto da borda, a leitura encosta do lado de dentro em vez de vazar do cartão. */
  ancora: 'inicio' | 'meio' | 'fim'
} | null>(null)

function leitura(dose: DoseNaGrade): string {
  const quando = t('clinico.adesao.faixa.quando', {
    data: formato.dataCurta(clinicClock.dateOf(dose.previstaEm)),
    hora: formato.hora(dose.previstaEm),
  })
  const registro = dose.registro
  const quem = registro ? (props.nomes[registro.cuidadorId] ?? '') : ''

  switch (dose.situacao) {
    case 'dada':
      return `${quando} · ${t('clinico.adesao.faixa.dadaPor', { nome: quem, hora: formato.hora(registro!.registradaEm) })}`
    case 'pulada':
      return `${quando} · ${t('clinico.adesao.faixa.puladaPor', {
        nome: quem,
        motivo: t(`clinico.adesao.motivo.${registro!.motivo ?? 'esqueci'}`).toLocaleLowerCase(),
      })}`
    default:
      return `${quando} · ${t(`clinico.adesao.situacao.${dose.situacao}`)}`
  }
}

function mostrar(evento: PointerEvent) {
  const alvo = (evento.target as HTMLElement | null)?.closest<HTMLElement>('[data-dose]')
  const coluna = Number(alvo?.dataset.coluna)
  const linha = Number(alvo?.dataset.linha)
  const dose = colunas.value[coluna]?.celulas[linha]?.dose

  if (!alvo || !dose || !faixa.value) {
    emFoco.value = null

    return
  }

  const caixa = faixa.value.getBoundingClientRect()
  const celula = alvo.getBoundingClientRect()
  const x = celula.left - caixa.left + celula.width / 2
  const proporcao = caixa.width > 0 ? x / caixa.width : 0.5

  emFoco.value = {
    texto: leitura(dose),
    x,
    y: celula.top - caixa.top,
    ancora: proporcao < 0.25 ? 'inicio' : proporcao > 0.75 ? 'fim' : 'meio',
  }
}

const primeiroDia = computed(() => colunas.value[0]?.dia ?? null)
const ultimoDia = computed(() => colunas.value[colunas.value.length - 1]?.dia ?? null)
</script>

<template>
  <div class="faixa faixa-cores" :class="{ 'faixa--compacta': compacta }">
    <div v-if="!compacta && linhas > 1" class="faixa__horarios" aria-hidden="true">
      <span v-for="horario in horarios" :key="horario">{{ horario }}</span>
    </div>

    <div class="faixa__corpo">
      <div
        ref="faixa"
        class="faixa__grade"
        role="img"
        :aria-label="rotulo"
        :style="{ '--faixa-dias': colunas.length, '--faixa-linhas': linhas }"
        @pointerover="mostrar"
        @pointerleave="emFoco = null"
      >
        <template v-for="(coluna, indiceDaColuna) in colunas" :key="coluna.dia">
          <span
            v-for="(celula, indiceDaLinha) in coluna.celulas"
            :key="celula.chave"
            class="faixa__dose"
            :class="[
              `faixa__dose--${celula.situacao}`,
              { 'faixa__dose--depois-do-marco': coluna.marco && indiceDaLinha === 0 },
            ]"
            :data-dose="celula.dose ? '' : undefined"
            :data-coluna="indiceDaColuna"
            :data-linha="indiceDaLinha"
          />
        </template>

        <span
          v-if="emFoco"
          class="faixa__leitura"
          :class="`faixa__leitura--${emFoco.ancora}`"
          aria-hidden="true"
          :style="{ left: `${emFoco.x}px`, top: `${emFoco.y}px` }"
        >
          {{ emFoco.texto }}
        </span>
      </div>

      <div v-if="!compacta && primeiroDia && ultimoDia" class="faixa__eixo" aria-hidden="true">
        <span>{{ formato.dataCurta(primeiroDia) }}</span>
        <span>{{
          ultimoDia === clinicClock.today()
            ? t('clinico.adesao.faixa.hoje')
            : formato.dataCurta(ultimoDia)
        }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.faixa {
  --faixa-celula: 0.625rem;
  --faixa-vao: 2px;

  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  min-width: 0;
}

.faixa--compacta {
  --faixa-celula: 0.5rem;
}

.faixa__horarios {
  display: grid;
  gap: var(--faixa-vao);
  grid-template-rows: repeat(var(--faixa-linhas, 1), var(--faixa-celula));
  color: var(--clinic-muted);
  font-size: 0.625rem;
  font-variant-numeric: tabular-nums;
  line-height: var(--faixa-celula);
}

.faixa__horarios span {
  display: flex;
  align-items: center;
  height: var(--faixa-celula);
}

.faixa__corpo {
  display: grid;
  gap: 0.3rem;
  min-width: 0;
}

.faixa__grade {
  position: relative;
  display: grid;
  gap: var(--faixa-vao);
  grid-auto-flow: column;
  /* Estreita demais, a coluna afina até 2 px em vez de vazar do cartão: vira barra, continua lida. */
  grid-template-columns: repeat(var(--faixa-dias, 1), minmax(2px, var(--faixa-celula)));
  grid-template-rows: repeat(var(--faixa-linhas, 1), var(--faixa-celula));
  justify-content: start;
}

.faixa__dose {
  border-radius: 2px;
  background: transparent;
  transition:
    background-color 160ms ease-out,
    box-shadow 160ms ease-out;
}

.faixa__dose--dada {
  background: var(--faixa-dada);
}

.faixa__dose--pulada {
  background: var(--faixa-pulada);
}

.faixa__dose--sem-registro {
  background: var(--faixa-sem-registro);
}

.faixa__dose--prevista {
  background: var(--faixa-prevista);
}

/* A dose da vez: só o contorno, por dentro — ainda não é nada, e pode virar qualquer coisa. */
.faixa__dose--aberta {
  box-shadow: inset 0 0 0 1.5px var(--faixa-agora);
}

/* A última consulta: um fio no vão, antes do primeiro dia depois dela. */
.faixa__dose--depois-do-marco {
  position: relative;
}

.faixa__dose--depois-do-marco::before {
  position: absolute;
  top: -0.2rem;
  bottom: calc(-1 * (var(--faixa-linhas) - 1) * (var(--faixa-celula) + var(--faixa-vao)) - 0.2rem);
  inset-inline-start: calc(-1 * var(--faixa-vao) / 2 - 0.5px);
  width: 1px;
  background: var(--clinic-muted);
  content: '';
}

.faixa__dose[data-dose]:hover {
  box-shadow:
    0 0 0 1.5px var(--clinic-surface),
    0 0 0 3px var(--clinic-text);
}

.faixa__leitura {
  position: absolute;
  z-index: 2;
  padding: 0.3rem 0.5rem;
  border-radius: 0.45rem;
  background: var(--clinic-text);
  color: var(--clinic-surface);
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.3;
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 0.4rem));
  white-space: nowrap;
}

/* A âncora é física, como o `left` calculado da caixa: vale igual em árabe. */
.faixa__leitura--inicio {
  transform: translate(-0.6rem, calc(-100% - 0.4rem));
}

.faixa__leitura--fim {
  transform: translate(calc(-100% + 0.6rem), calc(-100% - 0.4rem));
}

.faixa__eixo {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  color: var(--clinic-muted);
  font-size: 0.6875rem;
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  .faixa__dose {
    transition: none;
  }
}
</style>
