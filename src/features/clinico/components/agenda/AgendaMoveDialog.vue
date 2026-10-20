<script setup lang="ts">
/**
 * Confirmação de remarcação.
 *
 * Arrastar **sempre** abre esta caixa. Ela mostra de → para, o profissional, os avisos que a
 * mudança produz e o texto que sairia para o responsável. Remarcação é conversa com alguém
 * que reservou a manhã para vir à clínica — não pode acontecer por deslize de mouse.
 *
 * Quando há aviso, o botão primário nomeia a consequência: "Remarcar mesmo assim".
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import AgendaAvisos from './AgendaAvisos.vue'
import AgendaDialogoTopo from './AgendaDialogoTopo.vue'
import ClinicField from '../base/ClinicField.vue'
import type { ArrasteProposta } from '../../composables/useAgendaDrag'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useAgendaStore } from '../../stores/agenda'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{ proposta: ArrasteProposta | null }>()

const emit = defineEmits<{
  /** A mensagem viaja junto: ela vira comprovante do lado de fora, não morre com a caixa. */
  confirmar: [proposta: ArrasteProposta, mensagem: string]
  fechar: []
}>()

const { t } = useI18n()
const idTitulo = useId()
const agenda = useAgendaStore()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const mensagem = ref('')

const aberto = computed({
  get: () => props.proposta !== null,
  set: (valor: boolean) => {
    if (!valor) {
      emit('fechar')
    }
  },
})

const pet = computed(() =>
  props.proposta ? clinico.pet(props.proposta.appointment.petId) : null,
)

const profissionalDestino = computed(() =>
  props.proposta ? clinico.profissional(props.proposta.professionalId) : null,
)

const conflitos = computed(() => {
  const proposta = props.proposta

  if (!proposta) {
    return []
  }

  return agenda.conflitosDe({
    id: proposta.appointment.id,
    petId: proposta.appointment.petId,
    professionalId: proposta.professionalId,
    roomIds: proposta.roomIds,
    typeId: proposta.appointment.typeId,
    inicio: proposta.inicio,
    fim: proposta.fim,
    linkedGroupId: proposta.appointment.linkedGroupId,
  })
})

const temAviso = computed(() => conflitos.value.length > 0)

/**
 * Salas de origem e destino, só quando **mudaram**.
 *
 * No agrupamento por sala, arrastar troca de sala e não de profissional — e a linha "de → para"
 * mostrando o mesmo nome dos dois lados faria a confirmação parecer um engano. Comparação por
 * conjunto, não por ordem: a mesma cirurgia listada em outra ordem não é uma mudança.
 */
const salasMudaram = computed(() => {
  const proposta = props.proposta

  if (!proposta) {
    return false
  }

  const antes = [...proposta.appointment.roomIds].sort().join(',')
  const depois = [...proposta.roomIds].sort().join(',')

  return antes !== depois
})

function nomesDasSalas(ids: string[]) {
  return ids.map((id) => clinico.sala(id)?.nome ?? id).join(' + ')
}

const grupoLigado = computed(() => Boolean(props.proposta?.appointment.linkedGroupId))

/** O texto nasce preenchido, mas é editável: quem conhece o responsável ajusta o tom. */
watch(
  () => props.proposta,
  (proposta) => {
    if (!proposta) {
      return
    }

    mensagem.value = t('clinico.agenda.mover.mensagemPadrao', {
      paciente: clinico.pet(proposta.appointment.petId)?.nome ?? '',
      data: formato.dataCurta(clinicClock.dateOf(proposta.inicio)),
      hora: formato.hora(proposta.inicio),
    })
  },
)
</script>

<template>
  <Dialog
    v-model:visible="aberto"
    modal
    class="clinic-dialog hc-tema agenda-dialogo"
    :style="{ width: 'min(36rem, 94vw)' }"
    :aria-labelledby="idTitulo"
    :dismissable-mask="true"
  >
    <template #header>
      <AgendaDialogoTopo
        :id="idTitulo"
        :titulo="t('clinico.agenda.mover.titulo')"
        :subtitulo="pet?.nome ?? ''"
        icone="ph ph-arrows-down-up"
      />
    </template>

    <div v-if="proposta" class="mover clinic-scope">
      <div class="mover__comparacao">
        <div class="mover__lado">
          <span class="mover__rotulo">{{ t('clinico.agenda.mover.de') }}</span>
          <s class="mover__hora ui-hora">
            {{ formato.intervalo(proposta.appointment.inicio, proposta.appointment.fim) }}
          </s>
          <span class="mover__meta">
            {{ formato.dataCurta(clinicClock.dateOf(proposta.appointment.inicio)) }} ·
            {{ clinico.profissional(proposta.appointment.professionalId)?.nome }}
          </span>
        </div>

        <i class="ph ph-arrow-right mover__seta" aria-hidden="true" />

        <div class="mover__lado mover__lado--destino">
          <span class="mover__rotulo">{{ t('clinico.agenda.mover.para') }}</span>
          <strong class="mover__hora ui-hora">
            {{ formato.intervalo(proposta.inicio, proposta.fim) }}
          </strong>
          <span class="mover__meta">
            {{ formato.dataCurta(clinicClock.dateOf(proposta.inicio)) }} ·
            {{ profissionalDestino?.nome }}
          </span>
        </div>
      </div>

      <!-- Troca de sala: só aparece quando houve, e nomeia as duas pontas. -->
      <p v-if="salasMudaram" class="mover__nota">
        <i class="ph ph-door" aria-hidden="true" />
        <span>
          {{ nomesDasSalas(proposta.appointment.roomIds) || '–' }}
          <i class="ph ph-arrow-right mover__nota-seta" aria-hidden="true" />
          <strong>{{ nomesDasSalas(proposta.roomIds) || '–' }}</strong>
        </span>
      </p>

      <p v-if="grupoLigado" class="mover__nota">
        <i class="ph ph-link" aria-hidden="true" />
        {{ t('clinico.agenda.duasSalas') }}
      </p>

      <AgendaAvisos v-if="temAviso" :conflitos="conflitos" />

      <ClinicField :rotulo="t('clinico.agenda.mover.mensagem')">
        <template #default="{ id }">
          <Textarea :id="id" v-model="mensagem" rows="3" auto-resize fluid />
        </template>
      </ClinicField>
    </div>

    <template #footer>
      <Button
        :label="t('clinico.agenda.mover.cancelar')"
        severity="secondary"
        text
        @click="emit('fechar')"
      />
      <Button
        :label="
          temAviso
            ? t('clinico.agenda.mover.confirmarComAviso')
            : t('clinico.agenda.mover.confirmar')
        "
        :severity="temAviso ? 'warn' : 'primary'"
        :loading="agenda.salvando"
        @click="proposta && emit('confirmar', proposta, mensagem)"
      />
    </template>
  </Dialog>
</template>

<style scoped>
.mover {
  display: grid;
  gap: 18px;
}

.mover__comparacao {
  display: grid;
  align-items: stretch;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
}

.mover__lado {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 3px;
  padding: 12px 14px;
  border: 1px solid var(--linha);
  border-radius: 12px;
  background: var(--superficie-2);
}

/* O destino é o que se está decidindo: na cor da Clínica, com a borda acesa. */
.mover__lado--destino {
  border-color: var(--clinica);
  background: var(--clinica-fundo);
}

.mover__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.mover__hora {
  font-size: 18px;
}

s.mover__hora {
  color: var(--tinta-2);
  font-weight: 550;
  text-decoration-thickness: 1px;
}

.mover__meta {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mover__seta {
  align-self: center;
  color: var(--tinta-3);
  font-size: 18px;
}

.mover__nota {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.mover__nota > i {
  font-size: 16px;
}

.mover__nota strong {
  color: var(--tinta);
  font-weight: 600;
}

.mover__nota-seta {
  margin: 0 4px;
  font-size: 12px;
}

@media (max-width: 560px) {
  .mover__comparacao {
    grid-template-columns: minmax(0, 1fr);
  }

  .mover__seta {
    justify-self: center;
    transform: rotate(90deg);
  }
}
</style>
