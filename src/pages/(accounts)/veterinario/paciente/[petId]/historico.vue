<script setup lang="ts">
/**
 * Histórico do paciente.
 *
 * Cabeçalho do paciente, linha do tempo e a lista de atendimentos com o que aconteceu em cada
 * um — inclusive as faltas, que fazem parte da história e costumam sumir das telas bonitas.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import ClinicPatientHeader from '@/features/clinico/components/base/ClinicPatientHeader.vue'
import type { ColunaTabela } from '@/features/clinico/components/base/table-types'
import ProntuarioTimeline from '@/features/clinico/components/prontuario/ProntuarioTimeline.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { encounterRepository, patientRepository } from '@/features/clinico/data/repositories'
import type { Appointment, Pet, TimelineEvent, Tutor } from '@/features/clinico/data/types'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const clinico = useClinicoStore()
const formato = useClinicFormat()

const pet = ref<Pet | null>(null)
const tutor = ref<Tutor | null>(null)
const eventos = ref<TimelineEvent[]>([])
const atendimentos = ref<Appointment[]>([])
const carregando = ref(false)
const erro = ref('')

const petId = computed(() => String(route.params.petId ?? ''))

const colunas = computed<ColunaTabela[]>(() => [
  { id: 'data', rotulo: t('clinico.pacientes.colunaUltimo'), largura: '10rem' },
  { id: 'tipo', rotulo: t('clinico.pacientes.colunaAtendimento'), largura: 'minmax(0, 1.5fr)' },
  {
    id: 'profissional',
    rotulo: t('clinico.agenda.mover.profissional'),
    largura: 'minmax(0, 1fr)',
    ocultarEmTelaEstreita: true,
  },
  { id: 'situacao', rotulo: '', largura: '9rem', alinharAoFim: true },
])

/**
 * O que foi encontrado em cada atendimento, indexado pelo atendimento.
 *
 * A coluna mostrava só "Consulta", "Retorno", "Consulta" — o tipo, que já se deduz do horário e
 * não diz nada de clínico. O diagnóstico é o que faz alguém abrir a linha, e ele vive na linha
 * do tempo, que esta página já carrega.
 */
const diagnosticoDoAtendimento = computed(
  () =>
    new Map(
      eventos.value
        .filter((evento) => evento.appointmentId !== null && evento.titulo.length > 0)
        .map((evento) => [evento.appointmentId, evento.titulo]),
    ),
)

const vazio = computed(
  () => !carregando.value && !erro.value && atendimentos.value.length === 0,
)

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()

    const dados = await patientRepository.obter(petId.value)

    pet.value = dados?.pet ?? null
    tutor.value = dados?.tutor ?? null

    const [historico, lista] = await Promise.all([
      encounterRepository.historico(petId.value),
      patientRepository.atendimentosDoPet(petId.value),
    ])

    eventos.value = historico
    atendimentos.value = lista
  } catch {
    erro.value = t('clinico.erros.prontuario')
  } finally {
    carregando.value = false
  }
}

function abrir(appointment: Appointment) {
  if (!appointment.encounterId) {
    return
  }

  void router.push(`/veterinario/atendimento/${appointment.encounterId}`)
}

onMounted(carregar)
watch(petId, carregar)
</script>

<template>
  <PartnerPageFrame
    :subtitle="t('clinico.pacientes.subtitulo')"
    :title="pet?.nome ?? t('clinico.pacientes.titulo')"
    :loading="carregando && !pet"
    :error="erro"
    :empty="vazio"
    :empty-title="t('clinico.prontuario.timeline.vazio')"
    block-when-suspended
    @retry="carregar"
  >
    <div class="historico clinic-scope">
      <ClinicPatientHeader :pet="pet" :tutor="tutor" />

      <div class="historico__corpo">
        <ClinicDataTable
          :colunas="colunas"
          :linhas="atendimentos"
          :chave="(item) => item.id"
          :carregando="carregando"
          :rotulo="t('clinico.prontuario.timeline.titulo')"
          @ativar="abrir"
        >
          <template #celula-data="{ linha }">
            {{ formato.dataCurta(clinicClock.dateOf(linha.inicio)) }}
            <span class="historico__meta clinic-value">{{ formato.hora(linha.inicio) }}</span>
          </template>

          <template #celula-tipo="{ linha }">
            <strong class="historico__tipo">{{ clinico.tipo(linha.typeId)?.nome }}</strong>
            <span
              v-if="diagnosticoDoAtendimento.get(linha.id) ?? linha.observacao"
              class="historico__meta"
            >
              {{ diagnosticoDoAtendimento.get(linha.id) ?? linha.observacao }}
            </span>
          </template>

          <template #celula-profissional="{ linha }">
            {{ clinico.profissional(linha.professionalId)?.nome }}
          </template>

          <template #celula-situacao="{ linha }">
            <span
              class="historico__situacao"
              :class="{
                'historico__situacao--risco': linha.status === 'falta',
                'historico__situacao--fraco': linha.status === 'cancelado',
              }"
            >
              {{ formato.status(linha.status) }}
            </span>
          </template>
        </ClinicDataTable>

        <!-- Aqui a lista completa é o ponto da página: nada de limite. -->
        <ProntuarioTimeline :eventos="eventos" :anterior="null" :limite="eventos.length" />
      </div>
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
.historico {
  display: grid;
  gap: var(--clinic-space-3);
}

.historico__corpo {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: start;
  gap: var(--clinic-space-3);
}

.historico__meta {
  display: block;
  overflow: hidden;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.historico__tipo {
  display: block;
  font-weight: 700;
}

.historico__situacao {
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.historico__situacao--risco {
  color: var(--clinic-risk-text);
}

.historico__situacao--fraco {
  color: var(--clinic-faint);
  text-decoration: line-through;
}

@media (max-width: 1200px) {
  .historico__corpo {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
