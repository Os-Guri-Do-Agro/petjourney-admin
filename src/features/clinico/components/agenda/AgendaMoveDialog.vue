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
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

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
    class="clinic-dialog hc-tema"
    :style="{ width: 'min(34rem, 94vw)' }"
    :header="t('clinico.agenda.mover.titulo')"
    :dismissable-mask="true"
  >
    <div v-if="proposta" class="mover clinic-scope">
      <p class="mover__paciente">{{ pet?.nome }}</p>

      <div class="mover__comparacao">
        <div class="mover__lado">
          <span class="clinic-label">{{ t('clinico.agenda.mover.de') }}</span>
          <strong class="clinic-value">
            {{ formato.intervalo(proposta.appointment.inicio, proposta.appointment.fim) }}
          </strong>
          <span class="mover__meta">
            {{ clinico.profissional(proposta.appointment.professionalId)?.nome }}
          </span>
        </div>

        <i class="ph ph-arrow-right mover__seta" aria-hidden="true" />

        <div class="mover__lado mover__lado--destino">
          <span class="clinic-label">{{ t('clinico.agenda.mover.para') }}</span>
          <strong class="clinic-value">
            {{ formato.intervalo(proposta.inicio, proposta.fim) }}
          </strong>
          <span class="mover__meta">{{ profissionalDestino?.nome }}</span>
        </div>
      </div>

      <!-- Troca de sala: só aparece quando houve, e nomeia as duas pontas. -->
      <p v-if="salasMudaram" class="mover__salas">
        <i class="ph ph-house" aria-hidden="true" />
        <span>
          {{ nomesDasSalas(proposta.appointment.roomIds) || '—' }}
          <i class="ph ph-arrow-right mover__salas-seta" aria-hidden="true" />
          <strong>{{ nomesDasSalas(proposta.roomIds) || '—' }}</strong>
        </span>
      </p>

      <p v-if="grupoLigado" class="mover__ligado">
        <i class="ph ph-link" aria-hidden="true" />
        {{ t('clinico.agenda.duasSalas') }}
      </p>

      <ul v-if="temAviso" class="mover__avisos">
        <li
          v-for="(conflito, indice) in conflitos"
          :key="indice"
          :class="`mover__aviso mover__aviso--${conflito.severity}`"
        >
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ formato.conflito(conflito) }}</span>
        </li>
      </ul>

      <label class="mover__campo">
        <span class="clinic-label">{{ t('clinico.agenda.mover.mensagem') }}</span>
        <Textarea v-model="mensagem" rows="3" auto-resize fluid />
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
  gap: var(--clinic-space-4);
}

.mover__paciente {
  margin: 0;
  font-size: var(--clinic-font-title);
  font-weight: 750;
  letter-spacing: -0.02em;
}

.mover__comparacao {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: var(--clinic-space-3);
}

.mover__lado {
  display: grid;
  gap: 0.15rem;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.mover__lado--destino {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
}

.mover__lado strong {
  font-size: 1.05rem;
  font-weight: 800;
}

.mover__meta {
  overflow: hidden;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mover__seta {
  color: var(--clinic-faint);
}

.mover__salas {
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.mover__salas strong {
  color: var(--clinic-text);
  font-weight: 750;
}

.mover__salas-seta {
  margin: 0 0.2rem;
  font-size: 0.6rem;
}

.mover__ligado {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.mover__avisos {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.mover__aviso {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid var(--clinic-attention-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-base);
  line-height: 1.45;
}

.mover__aviso--blocking {
  border-color: var(--clinic-risk-line);
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
}

.mover__aviso--info {
  border-color: var(--clinic-line);
  background: var(--clinic-surface-soft);
  color: var(--clinic-muted);
}

.mover__campo {
  display: grid;
  gap: 0.25rem;
}

@media (max-width: 560px) {
  .mover__comparacao {
    grid-template-columns: 1fr;
  }

  .mover__seta {
    transform: rotate(90deg);
    justify-self: center;
  }
}
</style>
