<script setup lang="ts">
/**
 * Uma ronda da prancheta: o mesmo serviço, no mesmo horário, para vários animais.
 *
 * O cabeçalho responde **o que é e para quantos**; as linhas, **para quais**. São duas perguntas
 * feitas em momentos diferentes: a primeira antes de sair andando pelo corredor, a segunda depois,
 * com o balde na mão. A hora não se repete aqui — ela mora na coluna da linha do tempo, ao lado.
 *
 * ## As formas
 *
 * - **Um animal só**: não há ronda a nomear. A linha aparece sozinha, com o serviço no disco e o
 *   rosto do animal embaixo (ver `TarefaLinha`).
 * - **Vários, aberta**: o cabeçalho (disco do serviço, quantos, quantos atrasaram, e marcar todos
 *   de uma vez) e uma linha por animal, na ordem de andar a casa.
 * - **Vários, fechada**: só o cabeçalho, com os rostos de quem está na ronda. Uma ronda nasce
 *   fechada quando é longa (`RONDA_ABRE_ATE`, na página) — num hotel de quarenta, o bloco das
 *   18:00 deixa de ser 29 linhas e vira duas.
 *
 * ## Marcar várias de uma vez
 *
 * O trabalho real acontece em ronda: às 08:00 alguém serve os comedouros todos e só depois pega o
 * telefone. O botão de lote fica no cabeçalho, sempre no mesmo lugar, e marca só as **pendentes**
 * desta ronda como feitas — recusa é observação de um animal e não se aplica em lote.
 *
 * **Medicação não se marca em lote.** Servir quarenta comedouros é um gesto repetido; dar remédio
 * é quarenta decisões, cada uma com dose e animal próprios. No lugar do botão fica a frase que diz
 * isso — a ausência calada de um botão que as outras rondas têm lê como defeito.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import TarefaLinha from './TarefaLinha.vue'
import HotelSelo from '../base/HotelSelo.vue'
import IconeDeTarefa from '../base/IconeDeTarefa.vue'
import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { TarefaKind, TarefaStatus } from '../../data/types'
import { agruparPelaCasa } from '../../domain/ronda-ordem'
import type { LinhaDaRonda } from './ronda-types'

/**
 * A partir de quantas linhas a ronda aberta ganha as réguas de bloco da casa ("Canil A"). Abaixo
 * disso a lista cabe num olhar, e a régua custaria mais altura do que economiza leitura.
 */
const REGUA_DE_BLOCO_ACIMA_DE = 6

/** Quantos rostos a ronda fechada mostra antes do "+N". */
const ROSTOS_NA_RONDA_FECHADA = 6

const props = defineProps<{
  kind: TarefaKind
  /** O horário desta ronda, em `HH:MM`. A hora é desenhada pela linha do tempo, ao lado. */
  hora: string
  linhas: LinhaDaRonda[]
  /** Quantas do mesmo serviço, no mesmo horário, já estão resolvidas. */
  resolvidas: number
  /** Os blocos da casa, para ordenar as linhas pelo caminho que se anda. */
  blocos: ReadonlyMap<string, { nome: string; ordem: number }>
  aberta: boolean
  salvando: boolean
  /**
   * A ronda é de mais tarde. O lote dela fica de texto: o contornado é da ronda que é para agora,
   * e dois pesos iguais na mesma tela deixam de dizer qual é a vez.
   */
  adiante?: boolean
}>()

const emit = defineEmits<{
  alternar: []
  marcar: [payload: { tarefaId: string; status: TarefaStatus }]
  marcarTodas: [ids: string[]]
}>()

const { t } = useI18n()
const formato = useHotelFormat()

/**
 * O que ainda falta fazer nesta ronda. Não é o mesmo que `linhas`: uma linha marcada **continua
 * na lista** até a ronda ser fechada, para não evaporar sob o dedo de quem está marcando.
 */
const pendentes = computed(() => props.linhas.filter((linha) => linha.tarefa.status === 'pendente'))

const atrasadas = computed(
  () => props.linhas.filter((linha) => linha.situacao === 'atrasada').length,
)

const ehMedicacao = computed(() => props.kind === 'medicacao')

const aceitaLote = computed(() => !ehMedicacao.value && pendentes.value.length > 1)

/** Uma ronda de um animal só não ganha cabeçalho: seria a mesma frase duas vezes. */
const comCabecalho = computed(() => props.linhas.length > 1)

const listaVisivel = computed(() => !comCabecalho.value || props.aberta)

/** A situação da ronda, para o disco do cabeçalho: a pior das pendentes manda. */
const estado = computed(() => {
  if (atrasadas.value > 0) return ehMedicacao.value ? 'remedio' : 'atrasada'
  if (pendentes.value.some((linha) => linha.situacao === 'na-janela')) return 'janela'

  return pendentes.value.length === 0 ? 'feita' : 'futura'
})

const grupos = computed(() => agruparPelaCasa(props.linhas, props.blocos))

const comRegua = computed(
  () => grupos.value.length > 1 && props.linhas.length > REGUA_DE_BLOCO_ACIMA_DE,
)

const rostos = computed(() => props.linhas.slice(0, ROSTOS_NA_RONDA_FECHADA))
const restoDosRostos = computed(() => Math.max(0, props.linhas.length - ROSTOS_NA_RONDA_FECHADA))

function marcarPendentes() {
  emit(
    'marcarTodas',
    pendentes.value.map((linha) => linha.tarefa.id),
  )
}
</script>

<template>
  <li
    class="ronda"
    :data-hora="hora"
    :class="[
      `ronda--${estado}`,
      {
        'ronda--varios': comCabecalho,
        'ronda--fechada': comCabecalho && !aberta,
        'ronda--com-atraso': atrasadas > 0,
      },
    ]"
  >
    <div v-if="comCabecalho" class="ronda__cabeca">
      <span class="ronda__icone" aria-hidden="true">
        <i v-if="estado === 'feita'" class="ph ph-check" />
        <IconeDeTarefa v-else :kind="kind" />
      </span>

      <!--
        O cabeçalho inteiro abre e fecha, e não só a setinha: mirar um chevron de doze pixels em
        pé no corredor é o tipo de precisão que ninguém tem com uma mão.
      -->
      <button type="button" class="ronda__abrir" :aria-expanded="aberta" @click="emit('alternar')">
        <span class="ronda__titulo">
          <strong class="ronda__nome">{{ formato.tarefaKind(kind) }}</strong>
          <span v-if="pendentes.length > 0" class="ronda__quantos ui-num">
            {{ t('hotel.rotina.animais', { total: pendentes.length }, pendentes.length) }}
          </span>
          <i
            class="ronda__seta ph"
            :class="aberta ? 'ph-caret-up' : 'ph-caret-down'"
            aria-hidden="true"
          />
        </span>

        <span class="ronda__meta">
          <HotelSelo
            v-if="atrasadas > 0"
            :rotulo="t('hotel.rotina.atrasadas', { total: atrasadas }, atrasadas)"
            :tom="ehMedicacao ? 'risco' : 'atencao'"
            icone="ph ph-clock-countdown"
          />
          <span v-if="resolvidas > 0" class="ronda__feitas ui-num">
            <i class="ph ph-check" aria-hidden="true" />
            {{ t('hotel.rotina.jaResolvidas', { total: resolvidas }, resolvidas) }}
          </span>
        </span>
      </button>

      <div v-if="aceitaLote || (ehMedicacao && pendentes.length > 1)" class="ronda__lote-lugar">
        <Button
          v-if="aceitaLote"
          type="button"
          class="ronda__lote"
          :label="t('hotel.rotina.marcarRonda', { total: pendentes.length }, pendentes.length)"
          icon="ph ph-checks"
          severity="secondary"
          :outlined="!adiante"
          :text="adiante"
          :disabled="salvando"
          @click="marcarPendentes"
        />

        <span v-else-if="ehMedicacao && pendentes.length > 1" class="ronda__umAUm">
          <i class="ph ph-pill" aria-hidden="true" />
          {{ t('hotel.rotina.nova.umAUm') }}
        </span>
      </div>

      <!-- Fechada, os rostos dizem de quem é a ronda sem abri-la. -->
      <span v-if="!aberta" class="ronda__rostos" aria-hidden="true">
        <PetAvatar
          v-for="linha in rostos"
          :key="linha.tarefa.id"
          class="ronda__rosto"
          :nome="linha.petNome"
          :iniciais="linha.petIniciais"
          :especie="linha.petEspecie"
          :foto-url="linha.petFotoUrl"
          tamanho="sm"
        />
        <span v-if="restoDosRostos > 0" class="ronda__mais ui-num">+{{ restoDosRostos }}</span>
      </span>
    </div>

    <ul v-if="listaVisivel" class="ronda__lista">
      <template v-for="grupo in grupos" :key="grupo.blocoId">
        <li v-if="comRegua && grupo.nome" class="ronda__regua">{{ grupo.nome }}</li>

        <TarefaLinha
          v-for="linha in grupo.linhas"
          :key="linha.tarefa.id"
          :tarefa="linha.tarefa"
          :situacao="linha.situacao"
          :pet-nome="linha.petNome"
          :pet-iniciais="linha.petIniciais"
          :pet-especie="linha.petEspecie"
          :pet-foto-url="linha.petFotoUrl"
          :acomodacao-nome="linha.acomodacaoNome"
          :dentro-da-ronda="comCabecalho"
          :salvando="salvando"
          @marcar="(payload) => emit('marcar', payload)"
        />
      </template>
    </ul>
  </li>
</template>

<style scoped>
.ronda {
  position: relative;
  display: grid;
  container-type: inline-size;
  list-style: none;
}

/* ------------------------------------------------------------------ cabeçalho */

.ronda__cabeca {
  display: grid;
  align-items: center;
  gap: 8px 12px;
  padding: 12px 14px 12px 16px;
  grid-template-areas: 'icone abrir lote';
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.ronda--fechada .ronda__cabeca {
  grid-template-areas:
    'icone abrir lote'
    '. rostos rostos';
}

.ronda__icone {
  display: grid;
  width: 38px;
  height: 38px;
  grid-area: icone;
  place-items: center;
  border-radius: 11px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 15px;
}

.ronda__icone i {
  font-size: 19px;
}

.ronda--janela .ronda__icone {
  background: var(--hotel-fundo);
  color: var(--hotel-tinta);
}

.ronda--atrasada .ronda__icone {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.ronda--remedio .ronda__icone {
  background: var(--risco);
  color: var(--superficie);
}

.ronda--feita .ronda__icone {
  color: var(--ok-tinta);
}

.ronda__abrir {
  display: grid;
  min-width: 0;
  grid-area: abrir;
  justify-items: start;
  gap: 4px;
  margin: -6px -8px;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--raio-controle);
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  text-align: start;
}

.ronda__abrir:hover {
  background: var(--superficie-2);
}

.ronda__abrir:focus-visible {
  outline: 2px solid var(--hotel);
  outline-offset: 0;
}

.ronda__titulo {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
}

.ronda__nome {
  font-size: 15px;
  font-weight: 600;
}

.ronda--feita .ronda__nome {
  color: var(--tinta-2);
}

.ronda__quantos {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.ronda__seta {
  align-self: center;
  color: var(--tinta-3);
  font-size: 13px;
}

.ronda__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
}

.ronda__meta:empty {
  display: none;
}

.ronda__feitas {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--ok-tinta);
  font-size: 13px;
  font-weight: 550;
}

.ronda__lote-lugar {
  display: flex;
  grid-area: lote;
  justify-content: flex-end;
}

.ronda__lote.p-button {
  min-height: 40px;
  white-space: nowrap;
}

.ronda__umAUm {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
}

.ronda__rostos {
  display: flex;
  grid-area: rostos;
  align-items: center;
}

.ronda__rosto {
  margin-inline-end: -6px;
  box-shadow: 0 0 0 2px var(--superficie);
}

.ronda__mais {
  margin-inline-start: 14px;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
}

/* ------------------------------------------------------------------ linhas */

/*
 * As linhas recuam até o texto do cabeçalho: o recuo diz "isto está dentro daquilo" sem uma
 * segunda moldura para dizer o mesmo.
 */
.ronda__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ronda--varios .ronda__lista {
  padding-inline-start: 50px;
}

.ronda--varios .ronda__lista > li {
  border-top: 1px solid var(--linha);
}

.ronda--varios .ronda__lista > li.ronda__regua {
  border-top: 0;
}

.ronda__regua {
  padding: 12px 16px 2px;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

/*
 * Estreita, o lote desce para uma fileira dele, com a largura toda: é o botão que encerra a
 * ronda, e no telefone ele precisa ser fácil de achar sem mirar.
 */
@container (max-width: 520px) {
  .ronda__cabeca {
    grid-template-areas:
      'icone abrir'
      'lote lote';
    grid-template-columns: auto minmax(0, 1fr);
  }

  .ronda--fechada .ronda__cabeca {
    grid-template-areas:
      'icone abrir'
      'rostos rostos'
      'lote lote';
  }

  .ronda__lote-lugar {
    justify-content: stretch;
  }

  .ronda__lote-lugar:has(.ronda__umAUm) {
    justify-content: flex-start;
  }

  .ronda__lote.p-button {
    flex: 1 1 auto;
  }

  .ronda--varios .ronda__lista {
    padding-inline-start: 12px;
  }
}
</style>
