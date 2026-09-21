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
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

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
    class="clinic-dialog"
    :style="{ width: 'min(36rem, 94vw)' }"
    :header="t('clinico.faltas.reagendar.titulo')"
    :dismissable-mask="true"
  >
    <div v-if="appointment" class="reagendar clinic-scope">
      <header class="reagendar__topo">
        <div>
          <strong class="reagendar__paciente">{{ pet?.nome }}</strong>
          <p class="reagendar__meta">
            {{ t('clinico.faltas.reagendar.faltouEm', {
              data: formato.dataCurta(clinicClock.dateOf(appointment.inicio)),
              hora: formato.hora(appointment.inicio),
            }) }}
          </p>
        </div>

        <!-- O telefone fica clicável: a ligação acontece agora, não depois. -->
        <a v-if="tutor" class="reagendar__telefone clinic-value" :href="`tel:${tutor.telefone}`">
          <i class="pi pi-phone" aria-hidden="true" />
          <bdi dir="ltr">{{ tutor.telefone }}</bdi>
        </a>
      </header>

      <p v-if="buscando" class="reagendar__estado" role="status">
        <i class="pi pi-spin pi-spinner" aria-hidden="true" />
        {{ t('clinico.tabela.carregando') }}
      </p>

      <p v-else-if="opcoes.length === 0" class="reagendar__estado reagendar__estado--vazio">
        <i class="pi pi-calendar-times" aria-hidden="true" />
        {{ t('clinico.agenda.semana.semAlternativa') }}
      </p>

      <template v-else>
        <ul class="reagendar__lista" role="radiogroup" :aria-label="t('clinico.faltas.reagendar.titulo')">
          <li v-for="opcao in opcoes" :key="opcao.slot.inicio">
            <Button
              class="opcao"
              :class="{ 'opcao--ativa': escolhido?.inicio === opcao.slot.inicio }"
              severity="secondary"
              outlined
              fluid
              role="radio"
              :aria-checked="escolhido?.inicio === opcao.slot.inicio"
              @click="escolher(opcao.slot)"
            >
              <span class="opcao__data">
                <strong class="clinic-value">{{ formato.dataCurta(opcao.data) }}</strong>
                <span class="opcao__semana">
                  {{ opcao.ehHoje ? t('clinico.agenda.hoje') : formato.diaDaSemanaCurto(opcao.data) }}
                </span>
              </span>
              <span class="opcao__hora clinic-value">
                {{ formato.intervalo(opcao.slot.inicio, opcao.slot.fim) }}
              </span>
              <span class="opcao__prof">{{ opcao.profissional }}</span>
            </Button>
          </li>
        </ul>

        <label class="reagendar__campo">
          <span class="clinic-label">{{ t('clinico.agenda.mover.mensagem') }}</span>
          <Textarea
            v-model="mensagem"
            rows="3"
            auto-resize
            fluid
            @input="editouAMao = true"
          />
        </label>
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
        icon="pi pi-calendar-plus"
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
  gap: var(--clinic-space-4);
}

.reagendar__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.reagendar__paciente {
  font-size: var(--clinic-font-title);
  font-weight: 750;
  letter-spacing: -0.02em;
}

.reagendar__meta {
  margin: 0.1rem 0 0;
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.reagendar__telefone {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--clinic-line-strong);
  border-radius: var(--clinic-radius-chip);
  color: var(--clinic-accent-strong);
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
}

.reagendar__telefone:hover {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
}

.reagendar__estado {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: var(--clinic-space-5);
  border: 1px dashed var(--clinic-line-strong);
  border-radius: var(--clinic-radius-control);
  color: var(--clinic-muted);
}

.reagendar__estado--vazio {
  color: var(--clinic-faint);
}

.reagendar__lista {
  display: grid;
  gap: var(--clinic-space-2);
  max-height: 15rem;
  overflow-y: auto;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Cada horário é uma linha de três colunas, não um botão de rótulo centralizado. */
.opcao.p-button {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr);
  justify-content: stretch;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-2) var(--clinic-space-3);
  font-size: var(--clinic-font-base);
  font-weight: inherit;
  text-align: start;
}

/*
 * Escolhido ganha contorno e fundo, não só cor de texto: o estado precisa sobreviver ao cinza.
 * O seletor repete as classes do botão para vencer a regra de botão contornado do módulo.
 */
.opcao--ativa.p-button.p-button-secondary.p-button-outlined,
.opcao--ativa.p-button.p-button-secondary.p-button-outlined:not(:disabled):hover {
  border-color: var(--clinic-accent-strong);
  background: var(--clinic-accent-tint);
  color: var(--clinic-text);
  font-weight: 700;
}

.opcao__data {
  display: grid;
  gap: 0.05rem;
}

.opcao__data strong {
  font-weight: 800;
}

.opcao__semana {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.opcao__hora {
  font-weight: 750;
}

.opcao__prof {
  min-width: 0;
  overflow: hidden;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  text-align: end;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reagendar__campo {
  display: grid;
  gap: 0.25rem;
}
</style>
