<script setup lang="ts">
/**
 * Prévia da oferta de vaga.
 *
 * A remarcação sempre mostrou o texto que sai para o responsável; a oferta de vaga disparava
 * **sem prévia nenhuma**. Era a única conversa do módulo que acontecia sem ninguém ver o que
 * foi dito — e é a mais delicada das três, porque tem prazo: passado o prazo a vaga volta a ser
 * da clínica, e quem recebeu a mensagem precisa saber disso desde a primeira linha.
 *
 * Por isso o prazo entra **no texto**, não só na tabela.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../composables/useClinicFormat'
import { OFERTA_MINUTOS } from '../../data/repositories'
import type { ISODateTime, WaitlistEntry } from '../../data/types'
import { useFilaStore } from '../../stores/fila'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  entrada: WaitlistEntry | null
  slotInicio: ISODateTime | null
}>()

const emit = defineEmits<{
  confirmar: [payload: { mensagem: string }]
  fechar: []
}>()

const { t } = useI18n()
const clinico = useClinicoStore()
const fila = useFilaStore()
const formato = useClinicFormat()

const mensagem = ref('')

const aberto = computed({
  get: () => props.entrada !== null,
  set: (valor: boolean) => {
    if (!valor) {
      emit('fechar')
    }
  },
})

const pet = computed(() => (props.entrada ? clinico.pet(props.entrada.petId) : null))
const tutor = computed(() => (props.entrada ? clinico.tutor(props.entrada.tutorId) : null))
const posicao = computed(() => (props.entrada ? fila.posicaoDe(props.entrada.id) : null))

watch(
  () => [props.entrada, props.slotInicio],
  () => {
    if (!props.entrada || !props.slotInicio) {
      return
    }

    mensagem.value = t(
      'clinico.fila.oferta.mensagemPadrao',
      {
        paciente: pet.value?.nome ?? '',
        data: formato.dataCurta(clinicClock.dateOf(props.slotInicio)),
        hora: formato.hora(props.slotInicio),
        minutos: OFERTA_MINUTOS,
      },
      OFERTA_MINUTOS,
    )
  },
  { immediate: true },
)
</script>

<template>
  <Dialog
    v-model:visible="aberto"
    modal
    class="clinic-dialog"
    :style="{ width: 'min(32rem, 94vw)' }"
    :header="t('clinico.fila.ofertarVaga')"
    :dismissable-mask="true"
  >
    <div v-if="entrada && slotInicio" class="oferta clinic-scope">
      <header class="oferta__topo">
        <div>
          <strong class="oferta__paciente">{{ pet?.nome }}</strong>
          <p class="oferta__meta">
            {{ tutor?.nome }}
            <template v-if="posicao"> · {{ t('clinico.fila.posicaoNaFila', { posicao }) }}</template>
          </p>
        </div>

        <span class="oferta__slot clinic-value">
          {{ formato.dataCurta(clinicClock.dateOf(slotInicio)) }} ·
          {{ formato.hora(slotInicio) }}
        </span>
      </header>

      <!-- O prazo é a regra que faz a fila funcionar: dito antes do texto, não depois. -->
      <p class="oferta__prazo">
        <i class="pi pi-clock" aria-hidden="true" />
        {{ t('clinico.fila.oferta.prazo', { minutos: OFERTA_MINUTOS }, OFERTA_MINUTOS) }}
      </p>

      <label class="oferta__campo">
        <span class="clinic-label">{{ t('clinico.agenda.mover.mensagem') }}</span>
        <Textarea v-model="mensagem" rows="4" auto-resize fluid />
      </label>
    </div>

    <template #footer>
      <Button
        :label="t('clinico.agenda.mover.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        :label="t('clinico.fila.ofertarVaga')"
        icon="pi pi-send"
        :loading="fila.salvando"
        @click="emit('confirmar', { mensagem })"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.oferta {
  display: grid;
  gap: var(--clinic-space-4);
}

.oferta__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.oferta__paciente {
  font-size: var(--clinic-font-title);
  font-weight: 750;
  letter-spacing: -0.02em;
}

.oferta__meta {
  margin: 0.1rem 0 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.oferta__slot {
  padding: 0.25rem 0.6rem;
  border: 1px solid var(--clinic-accent);
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-weight: 750;
  white-space: nowrap;
}

.oferta__prazo {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid var(--clinic-attention-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.oferta__campo {
  display: grid;
  gap: 0.25rem;
}
</style>
