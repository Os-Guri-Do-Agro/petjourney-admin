<script setup lang="ts">
/**
 * Histórico do paciente.
 *
 * Cabeçalho do paciente, linha do tempo e a lista de atendimentos com o que aconteceu em cada
 * um — inclusive as faltas, que fazem parte da história e costumam sumir das telas bonitas.
 *
 * E o que o animal **recebeu**, que é outra pergunta. Atendimento responde "quando esteve aqui";
 * ato responde "o que entrou nele, e quando" — a pergunta que se faz antes de prescrever e
 * depois de uma reação adversa. As duas listas convivem porque nenhuma responde pela outra: uma
 * consulta sem nada aplicado é linha na primeira e não na segunda, e a dose dada às 3 da manhã
 * no leito é linha na segunda e em nenhum atendimento.
 */
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import ClinicPatientHeader from '@/features/clinico/components/base/ClinicPatientHeader.vue'
import AtoNovoDialog from '@/features/clinico/components/pacientes/AtoNovoDialog.vue'
import AtosDoPaciente from '@/features/clinico/components/pacientes/AtosDoPaciente.vue'
import ResumoSugestaoDialog from '@/features/clinico/components/pacientes/resumo/ResumoSugestaoDialog.vue'
import type { ColunaTabela } from '@/features/clinico/components/base/table-types'
import ProntuarioTimeline from '@/features/clinico/components/prontuario/ProntuarioTimeline.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { useClinicPrefs } from '@/features/clinico/composables/useClinicPrefs'
import {
  encounterRepository,
  internacaoRepository,
  patientRepository,
  type LeitoNoMapa,
} from '@/features/clinico/data/repositories'
import type {
  Appointment,
  AtoClinico,
  Pet,
  TimelineEvent,
  Tutor,
} from '@/features/clinico/data/types'
import {
  montarResumoDoPaciente,
  type ResumoDoPaciente,
} from '@/features/clinico/domain/resumo-do-paciente'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const clinico = useClinicoStore()
const formato = useClinicFormat()
const prefs = useClinicPrefs()

const pet = ref<Pet | null>(null)
const tutor = ref<Tutor | null>(null)
const eventos = ref<TimelineEvent[]>([])
const atendimentos = ref<Appointment[]>([])
const atos = ref<AtoClinico[]>([])
const registrandoAto = ref(false)
/** O leito onde este paciente está **agora**, quando está. */
const internacaoAberta = ref<LeitoNoMapa | null>(null)
const carregando = ref(false)
const erro = ref('')
/** O resumo "Este pet em 30 segundos": alimenta o selo do botão e a sugestão ao abrir. */
const resumo = ref<ResumoDoPaciente | null>(null)
const sugestaoAberta = ref(false)

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

const vazio = computed(() => !carregando.value && !erro.value && atendimentos.value.length === 0)

async function carregar() {
  carregando.value = true
  erro.value = ''

  try {
    await clinico.carregar()

    const dados = await patientRepository.obter(petId.value)

    pet.value = dados?.pet ?? null
    tutor.value = dados?.tutor ?? null

    const [historico, lista, recebidos, mapa, paraOResumo] = await Promise.all([
      encounterRepository.historico(petId.value),
      patientRepository.atendimentosDoPet(petId.value),
      patientRepository.historicoDeAtos(petId.value),
      /*
       * O mapa de leitos responde "este animal está aqui agora?". Falhar não derruba a página:
       * o histórico continua sendo histórico, e o que se perde é apenas o atalho para o leito.
       */
      internacaoRepository.mapa().catch(() => null),
      /* Mesma regra: sem resumo, o histórico abre igual, só sem selo e sem sugestão. */
      patientRepository.paraOResumo(petId.value).catch(() => null),
    ])

    eventos.value = historico
    atendimentos.value = lista
    atos.value = recebidos
    internacaoAberta.value =
      mapa?.leitos.find(
        (item) => item.internacao !== null && item.internacao.petId === petId.value,
      ) ?? null
    resumo.value =
      dados && paraOResumo ? montarResumoDoPaciente({ pet: dados.pet, ...paraOResumo }) : null
    sugestaoAberta.value = resumo.value !== null && prefs.sugerirResumo.value && !vindoDoResumo()
  } catch {
    erro.value = t('clinico.erros.prontuario')
  } finally {
    carregando.value = false
  }
}

/**
 * Quem chegou aqui pelo "Histórico completo" do resumo acabou de lê-lo. Sugerir o resumo de
 * volta seria o modal mandando a pessoa para a tela de onde ela saiu.
 */
function vindoDoResumo(): boolean {
  const anterior = String(router.options.history.state.back ?? '')

  return anterior.startsWith(`/veterinario/paciente/${petId.value}/resumo`)
}

/** Os sinais do resumo, no botão: o número diz que há o que ler, a cor diz o quanto. */
const seloDoResumo = computed(() => {
  const sinais = resumo.value?.sinais ?? []

  if (sinais.length === 0) {
    return null
  }

  return {
    total: sinais.length,
    risco: sinais.some((sinal) => sinal.severidade === 'risco'),
  }
})

function verResumo() {
  void router.push(`/veterinario/paciente/${petId.value}/resumo`)
}

function abrir(appointment: Appointment) {
  if (!appointment.encounterId) {
    return
  }

  void router.push(`/veterinario/atendimento/${appointment.encounterId}`)
}

/**
 * O ato lançado aqui não pertence a um atendimento.
 *
 * `encounterId` fica nulo de propósito: esta tela é a ficha do paciente, e o que se lança dela é
 * o que aconteceu fora de uma consulta aberta — o relato do responsável, o curativo do balcão.
 * O ato **da** consulta nasce no prontuário, com o elo já no lugar.
 */
async function registrarAto(
  valor: Omit<Parameters<typeof patientRepository.registrarAto>[0], "petId" | "encounterId">,
) {
  await patientRepository.registrarAto({ ...valor, petId: petId.value, encounterId: null })

  registrandoAto.value = false
  atos.value = await patientRepository.historicoDeAtos(petId.value)
}

function abrirAtendimento(encounterId: string) {
  void router.push(`/veterinario/atendimento/${encounterId}`)
}

function abrirInternacao() {
  const id = internacaoAberta.value?.internacao?.id

  if (id) {
    void router.push(`/veterinario/internacao/${id}`)
  }
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
      <ClinicPatientHeader :pet="pet" :tutor="tutor">
        <!--
          Quando o animal está internado **neste minuto**, o histórico diz isso e leva ao leito.

          Sem esta linha, a página mais completa que a clínica tem sobre um paciente era a única
          que não sabia que ele estava internado ali dentro: a internação aparecia na linha do
          tempo como um evento entre outros, com data de entrada e nenhuma indicação de que ainda
          está acontecendo.
        -->
        <template #acoes>
          <Button
            v-if="internacaoAberta"
            :label="t('clinico.pacientes.verInternacao')"
            icon="pi pi-building"
            severity="secondary"
            outlined
            size="small"
            @click="abrirInternacao"
          />
          <!--
            A ação principal da ficha: o resumo é o que se lê antes de rolar o histórico. O selo
            conta os sinais e fica no tom de risco quando algum é de risco — a urgência mora no
            selo, não no botão inteiro.
          -->
          <Button
            :label="t('clinico.resumoDoPaciente.verResumo')"
            icon="pi pi-stopwatch"
            :badge="seloDoResumo ? String(seloDoResumo.total) : undefined"
            :badge-severity="seloDoResumo?.risco ? 'danger' : 'warn'"
            :aria-label="
              seloDoResumo
                ? t('clinico.resumoDoPaciente.verResumoComSinais', { total: seloDoResumo.total })
                : t('clinico.resumoDoPaciente.verResumo')
            "
            @click="verResumo"
          />
        </template>
      </ClinicPatientHeader>

      <p v-if="internacaoAberta" class="historico__internado" role="status">
        <i class="pi pi-building" aria-hidden="true" />
        {{ t('clinico.pacientes.internadoAgora') }} ·
        <strong>{{ internacaoAberta.leito.nome }}</strong>
        <span>{{ internacaoAberta.internacao!.motivo }}</span>
      </p>

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

      <AtosDoPaciente
        :atos="atos"
        :carregando="carregando"
        @registrar="registrandoAto = true"
        @abrir-atendimento="abrirAtendimento"
      />

      <ResumoSugestaoDialog
        v-if="resumo && pet"
        v-model:visivel="sugestaoAberta"
        :pet-nome="pet.nome"
        :resumo="resumo"
        @ver="verResumo"
      />

      <AtoNovoDialog
        v-model:visivel="registrandoAto"
        :pet-nome="pet?.nome ?? ''"
        @registrar="registrarAto"
      />
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

/*
 * "Internado agora" é estado, não alerta: o animal estar no leito não é problema nenhum. Por
 * isso a faixa usa o acento do módulo e não o tom de risco — pintá-la de vermelho faria a
 * página gritar sobre um pós-operatório que está correndo bem.
 */
.historico__internado {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  margin: 0;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid var(--clinic-accent);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-2);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.historico__internado span {
  color: var(--clinic-muted);
  font-weight: 500;
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
