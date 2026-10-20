<script setup lang="ts">
/**
 * Um horário na linha do tempo do turno: a hora à esquerda, um nó no trilho, e as rondas daquele
 * horário à direita.
 *
 * É a irmã do horário do checklist da internação, com o relógio do canil. O nó diz o estado do
 * horário de longe, antes de qualquer palavra ser lida:
 *
 * - **vermelho cheio** — remédio atrasado: o único atraso que não pode esperar a ronda seguinte;
 * - **âmbar** — algo atrasou;
 * - **lavanda, a cor do hotel** — é a hora de fazer;
 * - **apagado** — tudo resolvido;
 * - **vazio** — ainda vai chegar.
 *
 * A cor nunca está sozinha: a linha atrasada leva o selo com a palavra, e a ronda atrasada diz
 * quantas são. O trilho é desenhado por cada horário, de ponta a ponta da altura dele, e é isso
 * que faz os horários se lerem como um caminho só.
 *
 * As colunas (`--col-hora`, `--col-trilho`, `--vao-col`) vêm da lista que envolve os horários,
 * para o fio do "agora" e a fronteira do turno cruzarem o trilho exatamente onde estão os nós.
 */
import { useI18n } from 'vue-i18n'

import RondaDoHorario from './RondaDoHorario.vue'
import type { TarefaStatus } from '../../data/types'
import type { EstadoDoHorario, LinhaDaRonda, RondaNoHorario } from './ronda-types'

/** O estado em palavra, com a chave escrita por extenso para a busca e a verificação acharem. */
const CHAVE_DO_ESTADO: Record<EstadoDoHorario, string> = {
  remedio: 'hotel.rotina.nova.estado.remedio',
  atrasada: 'hotel.rotina.nova.estado.atrasada',
  janela: 'hotel.rotina.nova.estado.janela',
  feita: 'hotel.rotina.nova.estado.feita',
  futura: 'hotel.rotina.nova.estado.futura',
}

defineProps<{
  hora: string
  /** O instante previsto, para o `datetime` e a distância até agora. */
  quando: string
  /** "há 40 min", "em 2 h": a distância do horário até agora, para ler sem fazer conta. */
  distancia: string
  estado: EstadoDoHorario
  rondas: RondaNoHorario[]
  blocos: ReadonlyMap<string, { nome: string; ordem: number }>
  salvando: boolean
  adiante?: boolean
}>()

const emit = defineEmits<{
  alternar: [chave: string, linhas: LinhaDaRonda[]]
  marcar: [payload: { tarefaId: string; status: TarefaStatus }]
  marcarTodas: [ids: string[]]
}>()

const { t } = useI18n()
</script>

<template>
  <li class="horario" :class="`horario--${estado}`">
    <div class="horario__hora">
      <time class="ui-hora" :datetime="quando">{{ hora }}</time>
      <small>{{ distancia }}</small>
    </div>

    <span class="horario__trilho" aria-hidden="true">
      <span class="horario__no" />
    </span>

    <!-- O estado do horário em palavra, para quem não vê o nó. -->
    <span class="horario__estado">{{ t(CHAVE_DO_ESTADO[estado]) }}</span>

    <ul class="horario__rondas">
      <RondaDoHorario
        v-for="ronda in rondas"
        :key="ronda.chave"
        :kind="ronda.kind"
        :hora="hora"
        :linhas="ronda.linhas"
        :resolvidas="ronda.resolvidas"
        :blocos="blocos"
        :aberta="ronda.aberta"
        :salvando="salvando"
        :adiante="adiante"
        @alternar="emit('alternar', ronda.chave, ronda.linhas)"
        @marcar="(payload) => emit('marcar', payload)"
        @marcar-todas="(ids) => emit('marcarTodas', ids)"
      />
    </ul>
  </li>
</template>

<style scoped>
.horario {
  position: relative;
  display: grid;
  column-gap: var(--vao-col, 12px);
  grid-template-columns: var(--col-hora, 72px) var(--col-trilho, 20px) minmax(0, 1fr);
  grid-template-rows: auto;
}

.horario__hora {
  display: grid;
  align-content: start;
  gap: 1px;
  padding-top: 18px;
}

.horario__hora .ui-hora {
  font-size: 20px;
  line-height: 1.1;
}

.horario__hora small {
  color: var(--tinta-3);
  font-size: 12px;
}

.horario--janela .horario__hora .ui-hora {
  color: var(--hotel-tinta);
}

.horario--atrasada .horario__hora .ui-hora,
.horario--atrasada .horario__hora small {
  color: var(--atencao-tinta);
}

.horario--remedio .horario__hora .ui-hora,
.horario--remedio .horario__hora small {
  color: var(--risco-tinta);
}

.horario--feita .horario__hora .ui-hora {
  color: var(--tinta-3);
}

/* O trilho atravessa o horário inteiro; o nó fica na altura da hora. */
.horario__trilho {
  position: relative;
  display: flex;
  justify-content: center;
}

.horario__trilho::before {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--linha);
  content: '';
}

.horario__no {
  position: relative;
  width: 14px;
  height: 14px;
  margin-top: 24px;
  border: 2px solid var(--linha-forte);
  border-radius: 50%;
  background: var(--superficie);
}

.horario--janela .horario__no {
  border-color: var(--hotel);
  background: var(--hotel);
  box-shadow: 0 0 0 4px var(--hotel-fundo);
}

.horario--atrasada .horario__no {
  border-color: var(--atencao);
  background: var(--atencao);
  box-shadow: 0 0 0 4px var(--atencao-fundo);
}

.horario--remedio .horario__no {
  border-color: var(--risco);
  background: var(--risco);
  box-shadow: 0 0 0 4px var(--risco-fundo);
}

/* Feito é passado: o nó apaga em vez de comemorar. */
.horario--feita .horario__no {
  border-color: var(--linha-forte);
  background: var(--linha-forte);
}

.horario__estado {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

.horario__rondas {
  display: grid;
  min-width: 0;
  margin: 0;
  padding: 4px 0;
  list-style: none;
}

/*
 * Na linha do tempo quem diz a gravidade é o nó do trilho e o selo: a marca na borda da linha,
 * que a linha sozinha usa fora daqui, seria um segundo trilho colado no primeiro.
 */
.horario__rondas :deep(.ui-marca::before) {
  display: none;
}

.horario__rondas > li + li {
  border-top: 1px solid var(--linha);
}

/* Entre um horário e o seguinte, um filete só na coluna do trabalho: o trilho passa por cima. */
.horario + .horario > .horario__rondas {
  border-top: 1px solid var(--linha);
}

/*
 * Estreita, a hora não cabe numa coluna própria sem espremer o nome do animal: ela sobe para a
 * primeira linha do horário, ao lado da distância, e o trilho fica sozinho na borda.
 */
@container tempo (max-width: 560px) {
  .horario {
    grid-template-columns: var(--col-trilho, 20px) minmax(0, 1fr);
  }

  .horario__hora {
    display: flex;
    grid-column: 2;
    grid-row: 1;
    align-items: baseline;
    gap: 8px;
    padding-block: 14px 0;
    padding-inline: 4px 0;
  }

  .horario__trilho {
    grid-column: 1;
    grid-row: 1 / span 2;
  }

  .horario__no {
    margin-top: 18px;
  }

  .horario__rondas {
    grid-column: 2;
    grid-row: 2;
  }

  /* A hora sobe para dentro do horário: o filete que os separa sobe junto, para cima dela. */
  .horario + .horario > .horario__rondas {
    border-top: 0;
  }

  .horario + .horario > .horario__hora {
    margin-top: 4px;
    border-top: 1px solid var(--linha);
  }
}
</style>
