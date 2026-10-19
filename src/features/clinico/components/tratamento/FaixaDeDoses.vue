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
 * - **Dada** é o musgo da casa. **Pulada** é âmbar — é o que a casa disse que não deu, com
 *   motivo, e merece ser vista; não é vermelho, porque não é erro de ninguém.
 * - **Sem registro** é o cinza do trilho vazio, a mesma cor de "não se sabe". Ele não usa a cor
 *   da pulada nem nenhuma cor de aviso: a dose pode ter sido dada sem ser marcada.
 * - **A dose da vez** é só um contorno. **Prevista** é quase nada.
 *
 * As cores moram em `faixa-cores.css`, só com tokens do Trilha. O leitor de tela recebe a frase
 * inteira pelo `rotulo`; a tabela de registros, na ficha, é a versão sem cor desta faixa.
 *
 * O tamanho é de quem usa: a célula sai de `--faixa-celula` e o vão de `--faixa-vao`, e cada tela
 * os ajusta na própria folha. Com `dias-no-eixo`, cada coluna leva o número do dia embaixo — é a
 * faixa grande da ficha, onde "qual dia foi" é a pergunta seguinte.
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
    /** O número do dia embaixo de cada coluna, no lugar do primeiro e do último dia. */
    diasNoEixo?: boolean
  }>(),
  { dias: 42, compacta: false, marco: null, nomes: () => ({}), diasNoEixo: false },
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

/** O dia do mês, sem zero à esquerda: "7", "13". O mês está no rótulo de cima da faixa. */
function diaDoMes(dia: ISODate): string {
  return String(Number(dia.slice(8, 10)))
}
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

      <div
        v-if="!compacta && diasNoEixo && colunas.length"
        class="faixa__eixo faixa__eixo--dias"
        :style="{ '--faixa-dias': colunas.length }"
        aria-hidden="true"
      >
        <span
          v-for="coluna in colunas"
          :key="coluna.dia"
          :class="{ 'faixa__dia--hoje': coluna.dia === clinicClock.today() }"
        >
          {{ diaDoMes(coluna.dia) }}
        </span>
      </div>

      <div
        v-else-if="!compacta && primeiroDia && ultimoDia"
        class="faixa__eixo"
        aria-hidden="true"
      >
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
/* 12 px por dose e horário em 11,5 px: com 10 px a faixa e as horas viravam textura, não leitura. */
.faixa {
  --faixa-celula: 12px;
  --faixa-vao: 2px;

  display: flex;
  align-items: flex-start;
  gap: 8px;
  min-width: 0;
}

.faixa--compacta {
  --faixa-celula: 8px;
}

.faixa__horarios {
  display: grid;
  gap: var(--faixa-vao);
  grid-template-rows: repeat(var(--faixa-linhas, 1), var(--faixa-celula));
  color: var(--tinta-2);
  font-family: var(--font-dados);
  font-size: 11.5px;
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
  gap: 5px;
  min-width: 0;
}

.faixa__grade {
  position: relative;
  display: grid;
  gap: var(--faixa-vao);
  grid-auto-flow: column;
  /* Estreita demais, a coluna afina até 2 px em vez de vazar da folha: vira barra, continua lida. */
  grid-template-columns: repeat(var(--faixa-dias, 1), minmax(2px, var(--faixa-celula)));
  grid-template-rows: repeat(var(--faixa-linhas, 1), var(--faixa-celula));
  justify-content: start;
}

.faixa__dose {
  border-radius: max(2px, calc(var(--faixa-celula) / 5));
  background: transparent;
  transition:
    background-color var(--pj-tempo-medio, 200ms) ease-out,
    box-shadow var(--pj-tempo-medio, 200ms) ease-out;
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
  box-shadow: inset 0 0 0 2px var(--faixa-agora);
}

/* A última consulta: um fio no vão, antes do primeiro dia depois dela. */
.faixa__dose--depois-do-marco {
  position: relative;
}

.faixa__dose--depois-do-marco::before {
  position: absolute;
  top: -3px;
  bottom: calc(-1 * (var(--faixa-linhas) - 1) * (var(--faixa-celula) + var(--faixa-vao)) - 3px);
  inset-inline-start: calc(-1 * var(--faixa-vao) / 2 - 0.5px);
  width: 1px;
  background: var(--faixa-fio);
  content: '';
}

.faixa__dose[data-dose]:hover {
  box-shadow:
    0 0 0 1.5px var(--superficie),
    0 0 0 3px var(--tinta);
}

.faixa__leitura {
  position: absolute;
  z-index: 2;
  padding: 5px 8px;
  border-radius: 7px;
  background: var(--tinta);
  box-shadow: var(--sombra-2);
  color: var(--superficie);
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
  pointer-events: none;
  transform: translate(-50%, calc(-100% - 6px));
  white-space: nowrap;
}

/* A âncora é física, como o `left` calculado da caixa: vale igual em árabe. */
.faixa__leitura--inicio {
  transform: translate(-10px, calc(-100% - 6px));
}

.faixa__leitura--fim {
  transform: translate(calc(-100% + 10px), calc(-100% - 6px));
}

.faixa__eixo {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--tinta-2);
  font-family: var(--font-dados);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

/* Um número por coluna, na mesma grade da faixa: o dia cai exatamente embaixo das doses dele. */
.faixa__eixo--dias {
  display: grid;
  gap: var(--faixa-vao);
  grid-template-columns: repeat(var(--faixa-dias, 1), minmax(2px, var(--faixa-celula)));
  justify-content: start;
  text-align: center;
}

.faixa__eixo--dias span {
  overflow: hidden;
  white-space: nowrap;
}

.faixa__dia--hoje {
  color: var(--tinta);
  font-weight: 700;
}

@media (prefers-reduced-motion: reduce) {
  .faixa__dose {
    transition: none;
  }
}
</style>
