<script setup lang="ts">
/**
 * Prévia da oferta de vaga.
 *
 * A remarcação sempre mostrou o texto que sai para o responsável; a oferta de vaga disparava
 * **sem prévia nenhuma**. Era a única conversa do módulo que acontecia sem ninguém ver o que
 * foi dito — e é a mais delicada das três, porque tem prazo: passado o prazo a vaga volta a ser
 * da clínica, e quem recebeu a mensagem precisa saber disso desde a primeira linha.
 *
 * Por isso o prazo entra **no texto**, não só na lista — e aparece dito antes dele, numa faixa de
 * atenção. No alto, o paciente e a vaga: a hora grande, como em toda a Agenda.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

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
        <PetAvatar
          :nome="pet?.nome ?? ''"
          :iniciais="pet?.iniciais ?? ''"
          :especie="pet?.especie ?? null"
          :foto-url="pet?.fotoUrl ?? ''"
          tamanho="md"
        />
        <div class="oferta__quem">
          <strong class="oferta__paciente">{{ pet?.nome }}</strong>
          <p class="oferta__meta">
            {{ tutor?.nome }}
            <template v-if="posicao"> · {{ t('clinico.fila.posicaoNaFila', { posicao }) }}</template>
          </p>
        </div>

        <span class="oferta__slot">
          <small>
            {{ formato.diaDaSemanaCurto(clinicClock.dateOf(slotInicio)) }},
            {{ formato.dataCurta(clinicClock.dateOf(slotInicio)) }}
          </small>
          <strong class="ui-hora">{{ formato.hora(slotInicio) }}</strong>
        </span>
      </header>

      <!-- O prazo é a regra que faz a fila funcionar: dito antes do texto, não depois. -->
      <p class="oferta__prazo">
        <i class="ph ph-clock-countdown" aria-hidden="true" />
        {{ t('clinico.fila.oferta.prazo', { minutos: OFERTA_MINUTOS }, OFERTA_MINUTOS) }}
      </p>

      <label class="oferta__campo">
        <span class="oferta__rotulo">{{ t('clinico.agenda.mover.mensagem') }}</span>
        <Textarea v-model="mensagem" rows="4" auto-resize fluid />
      </label>
    </div>

    <template #footer>
      <Button
        type="button"
        :label="t('clinico.agenda.mover.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        type="button"
        :label="t('clinico.fila.ofertarVaga')"
        icon="ph ph-paper-plane-tilt"
        :loading="fila.salvando"
        @click="emit('confirmar', { mensagem })"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.oferta {
  display: grid;
  gap: 16px;
  color: var(--tinta);
}

.oferta__topo {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  background: var(--superficie-2);
}

.oferta__quem {
  flex: 1;
  min-width: 0;
}

.oferta__paciente {
  color: var(--tinta);
  font-size: 17px;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.oferta__meta {
  margin: 2px 0 0;
  color: var(--tinta-2);
  font-size: 13px;
}

/* A vaga: a data pequena e a hora grande, como em toda a Agenda. */
.oferta__slot {
  display: grid;
  flex: none;
  justify-items: end;
  padding-inline-start: 16px;
  border-inline-start: 1px solid var(--linha);
  line-height: 1.1;
}

.oferta__slot small {
  color: var(--tinta-2);
  font-size: 12.5px;
  white-space: nowrap;
}

.oferta__slot .ui-hora {
  font-size: 26px;
  letter-spacing: -0.02em;
}

.oferta__prazo {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  padding: 10px 14px;
  border-radius: 12px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-size: 13.5px;
  font-weight: 550;
  line-height: 1.45;
}

.oferta__prazo i {
  flex: none;
  font-size: 16px;
  transform: translateY(2px);
}

.oferta__campo {
  display: grid;
  gap: 6px;
}

.oferta__rotulo {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}
</style>
