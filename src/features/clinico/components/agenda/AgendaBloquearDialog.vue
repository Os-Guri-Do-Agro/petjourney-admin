<script setup lang="ts">
/**
 * Bloqueio de horário: almoço, reunião, manutenção, folga, férias.
 *
 * Duas escolhas que o formulário torna explícitas em vez de esconder:
 *
 * - **Bloqueio sem profissional é da clínica inteira.** Manutenção do raio-x não é folga de
 *   ninguém — ela some da grade de todo mundo. O campo aceita ficar vazio de propósito, e o texto
 *   diz o que isso significa.
 * - **Recorrência é escolha de dias da semana, não uma data que se repete.** Almoço não é "toda
 *   segunda a partir de 24/08": é segunda a sexta, sempre. Guardar como recorrência e materializar
 *   na leitura é o que impede a agenda de encher de cópias.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import AgendaDialogoTopo from './AgendaDialogoTopo.vue'
import { ICONE_DO_BLOQUEIO } from './agenda-icones'
import ClinicField from '../base/ClinicField.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { BlockReason, ISODate, WeekdayIndex } from '../../data/types'
import { clockToMinutes, minutesToClock } from '../../domain/clinic-time'
import { ocupaHorario } from '../../domain/conflicts'
import { useAgendaStore } from '../../stores/agenda'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  visivel: boolean
  data: ISODate
  /** Sugestão de partida; a escolha do formulário vive em `professionalId`. */
  sugestaoProfissional?: string | null
}>()

const emit = defineEmits<{
  'update:visivel': [valor: boolean]
  criado: []
}>()

const { t } = useI18n()
const toast = useToast()
const agenda = useAgendaStore()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const MOTIVOS: BlockReason[] = ['almoco', 'reuniao', 'manutencao', 'bloqueio-pessoal', 'ferias']
const DIAS: WeekdayIndex[] = [1, 2, 3, 4, 5, 6, 0]

const motivo = ref<BlockReason>('reuniao')
const professionalId = ref<string | null>(null)
const roomId = ref<string | null>(null)
const inicio = ref('12:00')
const fim = ref('13:00')
const detalhe = ref('')
const repete = ref(false)
const diasEscolhidos = ref<WeekdayIndex[]>([])
const enviando = ref(false)

const opcoesMotivo = computed(() =>
  MOTIVOS.map((valor) => ({
    valor,
    rotulo: formato.motivoBloqueio(valor),
    icone: ICONE_DO_BLOQUEIO[valor],
  })),
)

const opcoesProfissional = computed(() => [
  { valor: null, rotulo: t('clinico.agenda.bloqueio.clinicaInteira') },
  ...clinico.profissionais.map((item) => ({ valor: item.id, rotulo: item.nome })),
])

const opcoesSala = computed(() => [
  { valor: null, rotulo: t('clinico.agenda.bloqueio.semSala') },
  ...clinico.salas.map((sala) => ({ valor: sala.id, rotulo: sala.nome })),
])

const opcoesDias = computed(() =>
  DIAS.map((dia) => {
    const rotulo = formato.diaDaSemanaCurto(diaExemplo(dia))

    return { valor: dia, rotulo: rotulo.charAt(0).toLocaleUpperCase() + rotulo.slice(1) }
  }),
)

const idRepete = useId()
const idDias = useId()
const idTitulo = useId()

/** Dia marcado entra e sai da lista; a ordem é a da semana, que é como a recorrência se lê. */
function alternarDia(dia: WeekdayIndex) {
  diasEscolhidos.value = diasEscolhidos.value.includes(dia)
    ? diasEscolhidos.value.filter((item) => item !== dia)
    : DIAS.filter((item) => item === dia || diasEscolhidos.value.includes(item))
}

/** Um dia real daquela semana só para o `Intl` nomear o dia — nada de tabela fixa de rótulos. */
function diaExemplo(weekday: WeekdayIndex): ISODate {
  const base = new Date(`${props.data}T12:00:00Z`)
  const atual = base.getUTCDay()

  base.setUTCDate(base.getUTCDate() + ((weekday - atual + 7) % 7))

  return base.toISOString().slice(0, 10) as ISODate
}

const janelaValida = computed(() => clockToMinutes(fim.value) > clockToMinutes(inicio.value))

const podeSalvar = computed(
  () => janelaValida.value && (!repete.value || diasEscolhidos.value.length > 0),
)

/**
 * Quem já está marcado debaixo do bloqueio, neste dia. O bloqueio continua possível (a folga é
 * da pessoa), mas a recepção precisa saber antes que vai ter de remarcar alguém: sem isto, o
 * bloqueio das 15h às 16h do Tiago caía em cima do banho da Sushi sem uma palavra.
 */
const afetados = computed(() => {
  if (!janelaValida.value || agenda.data !== props.data) {
    return []
  }

  const de = clinicClock.toIso(props.data, clockToMinutes(inicio.value))
  const ate = clinicClock.toIso(props.data, clockToMinutes(fim.value))

  return agenda.atendimentos
    .filter(
      (item) =>
        ocupaHorario(item) &&
        item.inicio < ate &&
        item.fim > de &&
        (professionalId.value === null || item.professionalId === professionalId.value) &&
        (roomId.value === null || item.roomIds.includes(roomId.value)),
    )
    .sort((um, outro) => um.inicio.localeCompare(outro.inicio))
})

const frase = computed(() =>
  afetados.value
    .map((item) => `${clinico.pet(item.petId)?.nome ?? ''} ${formato.hora(item.inicio)}`)
    .join(', '),
)

watch(
  () => props.visivel,
  (aberto) => {
    if (!aberto) {
      return
    }

    motivo.value = 'reuniao'
    professionalId.value = props.sugestaoProfissional ?? null
    roomId.value = null
    detalhe.value = ''
    repete.value = false
    diasEscolhidos.value = []

    const janela = janelaInicial()

    inicio.value = minutesToClock(janela.inicio)
    fim.value = minutesToClock(janela.fim)
  },
)

/**
 * A hora em que o formulário abre: a próxima meia hora livre de bloqueio, com uma hora de duração.
 *
 * Abria sempre em "Reunião, 12:00 às 13:00, clínica inteira": em cima do almoço que já existe, e
 * no passado para quem bloqueava à tarde.
 */
function janelaInicial(): { inicio: number; fim: number } {
  const MEIA_HORA = 30
  const abre = clockToMinutes(agenda.dia?.expediente?.inicio ?? '08:00')
  const fecha = clockToMinutes(agenda.dia?.expediente?.fim ?? '18:00')
  const agora = clinicClock.now()
  const partida =
    agora.date === props.data
      ? Math.max(abre, Math.ceil(agora.minutes / MEIA_HORA) * MEIA_HORA)
      : abre

  const bloqueiosQueValem = agenda.bloqueios.filter(
    (bloqueio) =>
      (bloqueio.professionalId === null && bloqueio.roomId === null) ||
      (professionalId.value !== null && bloqueio.professionalId === professionalId.value),
  )

  for (let minuto = partida; minuto + MEIA_HORA <= fecha; minuto += MEIA_HORA) {
    const ate = Math.min(minuto + 60, fecha)
    const de = clinicClock.toIso(props.data, minuto)
    const fimIso = clinicClock.toIso(props.data, ate)

    if (!bloqueiosQueValem.some((bloqueio) => bloqueio.inicio < fimIso && bloqueio.fim > de)) {
      return { inicio: minuto, fim: ate }
    }
  }

  return { inicio: abre, fim: Math.min(abre + 60, fecha) }
}

async function confirmar() {
  if (!podeSalvar.value || enviando.value) {
    return
  }

  enviando.value = true

  try {
    const bloqueio = await agenda.criarBloqueio({
      professionalId: professionalId.value,
      roomId: roomId.value,
      inicio: clinicClock.toIso(props.data, clockToMinutes(inicio.value)),
      fim: clinicClock.toIso(props.data, clockToMinutes(fim.value)),
      motivo: motivo.value,
      detalhe: detalhe.value.trim(),
      weekdaysRecorrentes: repete.value ? diasEscolhidos.value : null,
    })

    if (bloqueio) {
      /* Sem isto o diálogo só sumia: a recepção não sabia se o bloqueio tinha entrado (C-09). */
      toast.add({
        severity: 'success',
        summary: t('clinico.agenda.bloqueio.criado', { inicio: inicio.value, fim: fim.value }),
        life: 4000,
      })
      emit('criado')
      emit('update:visivel', false)
    }
  } finally {
    enviando.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="visivel"
    modal
    class="clinic-dialog hc-tema agenda-dialogo"
    :style="{ width: 'min(36rem, 94vw)' }"
    :aria-labelledby="idTitulo"
    @update:visible="emit('update:visivel', $event)"
  >
    <template #header>
      <AgendaDialogoTopo
        :id="idTitulo"
        :titulo="t('clinico.agenda.bloqueio.titulo')"
        :subtitulo="formato.dataLonga(data)"
        icone="ph ph-prohibit"
      />
    </template>

    <form class="formulario clinic-scope" @submit.prevent="confirmar">
      <ClinicField :rotulo="t('clinico.agenda.bloqueio.motivo')" largo>
        <template #default="{ id }">
          <Select
            v-model="motivo"
            :input-id="id"
            fluid
            option-label="rotulo"
            option-value="valor"
            :options="opcoesMotivo"
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          >
            <template #option="{ option }">
              <span class="opcao">
                <i :class="option.icone" aria-hidden="true" />
                {{ option.rotulo }}
              </span>
            </template>
          </Select>
        </template>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.agenda.criar.hora')">
        <template #default="{ id }">
          <InputText :id="id" v-model="inicio" type="time" fluid />
        </template>
      </ClinicField>

      <ClinicField
        :rotulo="t('clinico.agenda.bloqueio.ate')"
        :erro="janelaValida ? '' : t('clinico.agenda.bloqueio.janelaInvalida')"
      >
        <template #default="{ id, descrito }">
          <InputText
            :id="id"
            v-model="fim"
            type="time"
            fluid
            :invalid="!janelaValida"
            :aria-describedby="descrito"
          />
        </template>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.agenda.mover.profissional')">
        <template #default="{ id }">
          <Select
            v-model="professionalId"
            :input-id="id"
            fluid
            option-label="rotulo"
            option-value="valor"
            :options="opcoesProfissional"
            :placeholder="t('clinico.agenda.bloqueio.clinicaInteira')"
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
        </template>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.agenda.criar.sala')">
        <template #default="{ id }">
          <Select
            v-model="roomId"
            :input-id="id"
            fluid
            option-label="rotulo"
            option-value="valor"
            :options="opcoesSala"
            :placeholder="t('clinico.agenda.bloqueio.semSala')"
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          />
        </template>
      </ClinicField>

      <ClinicField :rotulo="t('clinico.agenda.bloqueio.detalhe')" largo>
        <template #default="{ id }">
          <InputText :id="id" v-model="detalhe" fluid />
        </template>
      </ClinicField>

      <div class="repete formulario__largo">
        <Checkbox v-model="repete" binary :input-id="idRepete" />
        <label :for="idRepete">{{ t('clinico.agenda.bloqueio.repetir') }}</label>
      </div>

      <!--
        Escolha múltipla: cada dia é um botão que liga e desliga, com o estado dito pelo
        `aria-pressed` e por contorno e fundo — não só pela cor.
      -->
      <fieldset v-if="repete" class="dias formulario__largo">
        <legend :id="idDias" class="dias__titulo">
          {{ t('clinico.agenda.bloqueio.diasDaSemana') }}
        </legend>

        <div class="dias__lista" role="group" :aria-labelledby="idDias">
          <button
            v-for="dia in opcoesDias"
            :key="dia.valor"
            type="button"
            class="dia"
            :class="{ 'dia--ligado': diasEscolhidos.includes(dia.valor) }"
            :aria-pressed="diasEscolhidos.includes(dia.valor)"
            @click="alternarDia(dia.valor)"
          >
            <i v-if="diasEscolhidos.includes(dia.valor)" class="ph ph-check" aria-hidden="true" />
            {{ dia.rotulo }}
          </button>
        </div>
      </fieldset>

      <p v-if="afetados.length > 0" class="afetados formulario__largo" role="status">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        <span>
          {{
            t(
              'clinico.agenda.bloqueio.afetados',
              { nomes: frase, count: afetados.length },
              afetados.length,
            )
          }}
        </span>
      </p>
    </form>

    <template #footer>
      <Button
        severity="secondary"
        text
        :label="t('clinico.comum.cancelar')"
        @click="emit('update:visivel', false)"
      />
      <Button
        icon="ph ph-prohibit"
        :disabled="!podeSalvar || enviando"
        :loading="enviando"
        :label="t('clinico.agenda.bloqueio.salvar')"
        @click="confirmar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.formulario {
  display: grid;
  gap: 18px 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.formulario__largo {
  grid-column: 1 / -1;
}

.afetados {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-size: 13.5px;
  line-height: 1.5;
}

.afetados i {
  margin-top: 2px;
  font-size: 16px;
}

.opcao {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.opcao i {
  color: var(--tinta-2);
  font-size: 16px;
}

.repete {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
}

.repete label {
  cursor: pointer;
}

.dias {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
}

.dias__titulo {
  margin-bottom: 8px;
  padding: 0;
  color: var(--tinta);
  font-size: 13px;
  font-weight: 550;
}

.dias__lista {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.dia {
  display: inline-flex;
  min-width: 52px;
  min-height: 36px;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 0 12px;
  border: 1px solid var(--linha-forte);
  border-radius: 999px;
  background: var(--superficie);
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
}

.dia:hover {
  background: var(--superficie-2);
}

.dia:focus-visible {
  outline: 2px solid var(--clinica);
  outline-offset: 2px;
}

/* Dia ligado: contorno, fundo e o visto — o estado sobrevive ao cinza. */
.dia--ligado,
.dia--ligado:hover {
  border-color: var(--clinica);
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
  font-weight: 600;
}

@media (max-width: 620px) {
  .formulario {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
