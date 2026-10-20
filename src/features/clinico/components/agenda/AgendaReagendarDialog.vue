<script setup lang="ts">
/**
 * Reagendamento de uma falta.
 *
 * Falta é dinheiro perdido, e o único jeito de recuperar parte dele é oferecer outro horário
 * enquanto o telefone ainda está na mão. Por isso a caixa abre **já com horários** — buscar
 * primeiro e perguntar depois transformaria a ligação numa espera.
 *
 * A mensagem ao responsável nasce escrita e editável, no mesmo padrão da remarcação. Aqui o
 * texto importa mais que lá: quem faltou precisa ser convidado de volta, não cobrado.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import AgendaDialogoTopo from './AgendaDialogoTopo.vue'
import ClinicField from '../base/ClinicField.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Appointment, SlotSugestao } from '../../data/types'
import { diffDays } from '../../domain/clinic-time'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  /** A falta que se está reagendando. `null` fecha a caixa. */
  appointment: Appointment | null
  sugestoes: SlotSugestao[]
  buscando: boolean
  salvando: boolean
}>()

const emit = defineEmits<{
  confirmar: [payload: { slot: SlotSugestao; mensagem: string }]
  fechar: []
}>()

const { t } = useI18n()
const idTitulo = useId()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const mensagem = ref('')
const escolhido = ref<SlotSugestao | null>(null)

const aberto = computed({
  get: () => props.appointment !== null,
  set: (valor: boolean) => {
    if (!valor) {
      emit('fechar')
    }
  },
})

const pet = computed(() =>
  props.appointment ? clinico.pet(props.appointment.petId) : null,
)

const tutor = computed(() =>
  props.appointment ? clinico.tutor(props.appointment.tutorId) : null,
)

function comInicial(texto: string) {
  return texto.charAt(0).toLocaleUpperCase() + texto.slice(1)
}

const opcoes = computed(() =>
  props.sugestoes.map((slot) => {
    const data = clinicClock.dateOf(slot.inicio)

    return {
      slot,
      data,
      dias: props.appointment
        ? diffDays(clinicClock.dateOf(props.appointment.inicio), data)
        : 0,
      profissional: clinico.profissional(slot.professionalId)?.nome ?? '',
      ehHoje: data === clinicClock.today(),
      semana: comInicial(formato.diaDaSemanaCurto(data)),
    }
  }),
)

/**
 * O texto se reescreve quando o horário muda — mas **só até alguém digitar**.
 *
 * Sem essa trava, escolher outro horário depois de ajustar o tom apagaria o ajuste; com ela,
 * quem editou fica com o próprio texto e conserta a hora sozinho, que é o mal menor.
 */
const editouAMao = ref(false)

function textoPadrao(slot: SlotSugestao | null) {
  if (!slot) {
    return ''
  }

  return t('clinico.faltas.reagendar.mensagemPadrao', {
    paciente: pet.value?.nome ?? '',
    data: formato.dataCurta(clinicClock.dateOf(slot.inicio)),
    hora: formato.hora(slot.inicio),
  })
}

watch(
  () => props.appointment,
  (appointment) => {
    escolhido.value = null
    editouAMao.value = false
    mensagem.value = appointment ? '' : mensagem.value
  },
)

/** Primeiro horário chega escolhido: é o que a recepção vai oferecer em nove de dez ligações. */
watch(
  () => props.sugestoes,
  (lista) => {
    if (!escolhido.value && lista.length > 0) {
      escolher(lista[0]!)
    }
  },
)

function escolher(slot: SlotSugestao) {
  escolhido.value = slot

  if (!editouAMao.value) {
    mensagem.value = textoPadrao(slot)
  }
}

function confirmar() {
  if (escolhido.value) {
    emit('confirmar', { slot: escolhido.value, mensagem: mensagem.value })
  }
}
</script>

<template>
  <Dialog
    v-model:visible="aberto"
    modal
    class="clinic-dialog hc-tema agenda-dialogo"
    :style="{ width: 'min(38rem, 94vw)' }"
    :aria-labelledby="idTitulo"
    :dismissable-mask="true"
  >
    <template #header>
      <AgendaDialogoTopo
        :id="idTitulo"
        :titulo="t('clinico.faltas.reagendar.titulo')"
        :subtitulo="pet?.nome ?? ''"
        icone="ph ph-calendar-plus"
      />
    </template>

    <div v-if="appointment" class="reagendar clinic-scope">
      <div class="reagendar__topo">
        <span class="ui-selo ui-selo--risco">
          <i class="ph ph-user-minus" aria-hidden="true" />
          {{
            t('clinico.faltas.reagendar.faltouEm', {
              data: formato.dataCurta(clinicClock.dateOf(appointment.inicio)),
              hora: formato.hora(appointment.inicio),
            })
          }}
        </span>

        <!-- O telefone fica clicável: a ligação acontece agora, não depois. -->
        <a v-if="tutor" class="reagendar__telefone" :href="`tel:${tutor.telefone}`">
          <i class="ph ph-phone" aria-hidden="true" />
          <bdi dir="ltr" class="ui-num">{{ tutor.telefone }}</bdi>
        </a>
      </div>

      <p v-if="buscando" class="reagendar__estado" role="status">
        <i class="ph ph-spin ph-circle-notch" aria-hidden="true" />
        {{ t('clinico.tabela.carregando') }}
      </p>

      <p v-else-if="opcoes.length === 0" class="reagendar__estado">
        <i class="ph ph-calendar-x" aria-hidden="true" />
        {{ t('clinico.agenda.semana.semAlternativa') }}
      </p>

      <template v-else>
        <ul
          class="reagendar__lista"
          role="radiogroup"
          :aria-label="t('clinico.faltas.reagendar.titulo')"
        >
          <li v-for="opcao in opcoes" :key="opcao.slot.inicio">
            <button
              type="button"
              class="opcao"
              :class="{ 'opcao--ativa': escolhido?.inicio === opcao.slot.inicio }"
              role="radio"
              :aria-checked="escolhido?.inicio === opcao.slot.inicio"
              @click="escolher(opcao.slot)"
            >
              <span class="opcao__marca" aria-hidden="true">
                <i v-if="escolhido?.inicio === opcao.slot.inicio" class="ph ph-check" />
              </span>
              <span class="opcao__data">
                <strong class="ui-num">{{ formato.dataCurta(opcao.data) }}</strong>
                <span class="opcao__semana">
                  {{ opcao.ehHoje ? t('clinico.agenda.hoje') : opcao.semana }}
                </span>
              </span>
              <span class="opcao__hora ui-hora">
                {{ formato.intervalo(opcao.slot.inicio, opcao.slot.fim) }}
              </span>
              <span class="opcao__prof">{{ opcao.profissional }}</span>
            </button>
          </li>
        </ul>

        <ClinicField :rotulo="t('clinico.agenda.mover.mensagem')">
          <template #default="{ id }">
            <Textarea
              :id="id"
              v-model="mensagem"
              rows="3"
              auto-resize
              fluid
              @input="editouAMao = true"
            />
          </template>
        </ClinicField>
      </template>
    </div>

    <template #footer>
      <Button
        :label="t('clinico.agenda.mover.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        :label="t('clinico.faltas.reagendar.confirmar')"
        icon="ph ph-calendar-plus"
        :disabled="!escolhido"
        :loading="salvando"
        @click="confirmar"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.reagendar {
  display: grid;
  gap: 18px;
}

.reagendar__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 14px;
}

.reagendar__telefone {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 8px;
  padding: 0 14px;
  border: 1px solid var(--linha-forte);
  border-radius: 10px;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
  text-decoration: none;
  white-space: nowrap;
}

.reagendar__telefone i {
  color: var(--clinica-tinta);
  font-size: 16px;
}

.reagendar__telefone:hover {
  background: var(--superficie-2);
}

.reagendar__telefone:focus-visible {
  outline: 2px solid var(--clinica);
  outline-offset: 2px;
}

.reagendar__estado {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 0;
  padding: 22px;
  border: 1px dashed var(--linha-forte);
  border-radius: 12px;
  color: var(--tinta-2);
  font-size: 14px;
}

/* Os horários numa lista de linhas: data, hora e quem atende, lidos da esquerda para a direita. */
.reagendar__lista {
  display: grid;
  max-height: 17rem;
  margin: 0;
  padding: 0;
  overflow-y: auto;
  border: 1px solid var(--linha);
  border-radius: 12px;
  list-style: none;
}

.reagendar__lista > li + li {
  border-top: 1px solid var(--linha);
}

.opcao {
  display: grid;
  width: 100%;
  min-height: 52px;
  align-items: center;
  gap: 14px;
  padding: 8px 14px;
  border: 0;
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  grid-template-columns: 22px 4.5rem auto minmax(0, 1fr);
  text-align: start;
}

.opcao:hover {
  background: var(--superficie-2);
}

.opcao:focus-visible {
  outline: 2px solid var(--clinica);
  outline-offset: -2px;
}

/* Escolhido: fundo, marca com o visto e contorno — o estado precisa sobreviver ao cinza. */
.opcao--ativa,
.opcao--ativa:hover {
  background: var(--clinica-fundo);
}

.opcao__marca {
  display: grid;
  width: 20px;
  height: 20px;
  place-items: center;
  border: 1.5px solid var(--linha-forte);
  border-radius: 50%;
  color: var(--superficie);
  font-size: 12px;
}

.opcao--ativa .opcao__marca {
  border-color: var(--clinica-tinta);
  background: var(--clinica-tinta);
}

.opcao__data {
  display: grid;
  gap: 1px;
}

.opcao__data strong {
  font-size: 14px;
  font-weight: 650;
}

.opcao__semana {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.opcao__prof {
  min-width: 0;
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13px;
  text-align: end;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 520px) {
  .opcao {
    grid-template-columns: 22px auto minmax(0, 1fr);
  }

  .opcao__prof {
    grid-column: 2 / -1;
    text-align: start;
  }
}
</style>
