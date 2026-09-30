<script setup lang="ts">
/**
 * Histórico do paciente.
 *
 * Cabeçalho do paciente, linha do tempo e a lista de atendimentos com o que aconteceu em cada
 * um — inclusive as faltas, que fazem parte da história e costumam sumir das telas bonitas.
 *
 * O acabamento é o da Visão geral, como o resto da ficha (`ficha/ficha.css`): o nome no lugar da
 * saudação, a frase do momento do paciente em degradê, e o resumo em 30 segundos como pílula
 * cheia — é o que se lê antes de rolar o histórico.
 *
 * E o que o animal **recebeu**, que é outra pergunta. Atendimento responde "quando esteve aqui";
 * ato responde "o que entrou nele, e quando" — a pergunta que se faz antes de prescrever e
 * depois de uma reação adversa. As duas listas convivem porque nenhuma responde pela outra: uma
 * consulta sem nada aplicado é linha na primeira e não na segunda, e a dose dada às 3 da manhã
 * no leito é linha na segunda e em nenhum atendimento.
 */
import Button from 'primevue/button'
import { PhBed, PhCalendarCheck, PhClockCounterClockwise } from '@phosphor-icons/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import '@/components/home/home-card.css'
import '@/features/clinico/components/pacientes/ficha/ficha.css'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import FichaCabeca from '@/features/clinico/components/pacientes/ficha/FichaCabeca.vue'
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
import { diffDays } from '@/features/clinico/domain/clinic-time'
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

/**
 * A página só fica vazia quando o paciente não existe.
 *
 * Antes, "sem atendimento" apagava a página inteira — cabeçalho, linha do tempo, procedimentos e o
 * botão das vacinas. Servia quando atendimento era a única coisa que um paciente podia ter; deixou
 * de servir quando a vacina de fora passou a ser registrada sem consulta: o filhote que chega com
 * a carteirinha do pet shop tinha duas doses no registro e uma tela dizendo que não havia nada.
 * Cada seção tem o próprio vazio.
 */
const vazio = computed(() => !carregando.value && !erro.value && !pet.value)

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

function verResumo() {
  void router.push(`/veterinario/paciente/${petId.value}/resumo`)
}

/**
 * O momento do paciente numa frase, no lugar da saudação da Visão geral.
 *
 * Na ordem do que importa agora: em internação (e onde), atendimento hoje (e a que horas), o último
 * atendimento feito, e só então "nenhum atendimento ainda" — o caso do filhote que chegou com a
 * carteirinha do pet shop.
 */
const frase = computed(() => {
  const leito = internacaoAberta.value

  if (leito?.internacao) {
    return t('clinico.ficha.historico.internado', { leito: leito.leito.nome })
  }

  const hoje = clinicClock.today()
  const deHoje = atendimentos.value.find(
    (item) =>
      clinicClock.dateOf(item.inicio) === hoje &&
      !['cancelado', 'falta', 'finalizado'].includes(item.status),
  )

  if (deHoje) {
    return t('clinico.ficha.historico.hoje', { hora: formato.hora(deHoje.inicio) })
  }

  const ultimo = atendimentos.value
    .filter((item) => item.status === 'finalizado')
    .sort((a, b) => b.inicio.localeCompare(a.inicio))[0]

  if (ultimo) {
    const dias = diffDays(clinicClock.dateOf(ultimo.inicio), hoje)

    return dias === 0
      ? t('clinico.ficha.historico.ultimoHoje')
      : t('clinico.ficha.historico.ultimo', { dias }, dias)
  }

  return t('clinico.pacientes.semAtendimentos')
})

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
    class="ficha-tema hc-tema"
    :title="pet?.nome ?? t('clinico.pacientes.titulo')"
    :loading="carregando && !pet"
    :error="erro"
    :empty="vazio"
    :empty-title="t('clinico.prontuario.timeline.vazio')"
    block-when-suspended
    @retry="carregar"
  >
    <template v-if="pet" #cabecalho>
      <FichaCabeca :pet="pet" :tutor="tutor" atual="historico" :frase="frase" nav-cheia="resumo">
        <!--
          Quando o animal está internado **neste minuto**, o histórico diz isso e leva ao leito.
          Sem esta pílula, a página mais completa que a clínica tem sobre um paciente era a única
          que não sabia que ele estava internado ali dentro.
        -->
        <template v-if="internacaoAberta" #acoes>
          <Button
            class="ficha-pilula"
            :label="t('clinico.pacientes.verInternacao')"
            @click="abrirInternacao"
          >
            <template #icon>
              <PhBed class="ficha-pilula__icone" weight="duotone" aria-hidden="true" />
            </template>
          </Button>
        </template>
      </FichaCabeca>
    </template>

    <div v-if="pet" class="ficha-conteudo historico clinic-scope">
      <div class="ficha-grade historico__grade">
        <div class="ficha-coluna">
          <section class="hc" aria-labelledby="historico-atendimentos">
            <header class="hc__cabeca">
              <h2 id="historico-atendimentos" class="hc__titulo">
                <PhCalendarCheck class="hc__icone" weight="duotone" aria-hidden="true" />
                {{ t('clinico.atendimentos.titulo') }}
              </h2>
            </header>

            <ClinicDataTable
              :colunas="colunas"
              :linhas="atendimentos"
              :chave="(item) => item.id"
              :carregando="carregando"
              :vazio-titulo="t('clinico.pacientes.semAtendimentos')"
              :rotulo="t('clinico.atendimentos.titulo')"
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
          </section>

          <AtosDoPaciente
            :atos="atos"
            :carregando="carregando"
            @registrar="registrandoAto = true"
            @abrir-atendimento="abrirAtendimento"
          />
        </div>

        <div class="ficha-coluna">
          <!-- Aqui a lista completa é o ponto da página: nada de limite. -->
          <section class="hc" aria-labelledby="historico-linha">
            <header class="hc__cabeca">
              <h2 id="historico-linha" class="hc__titulo">
                <PhClockCounterClockwise class="hc__icone" weight="duotone" aria-hidden="true" />
                {{ t('clinico.ficha.historico.linhaDoTempo') }}
              </h2>
            </header>
            <ProntuarioTimeline :eventos="eventos" :anterior="null" :limite="eventos.length" />
          </section>
        </div>
      </div>

      <ResumoSugestaoDialog
        v-if="resumo"
        v-model:visivel="sugestaoAberta"
        :pet-nome="pet.nome"
        :resumo="resumo"
        @ver="verResumo"
      />

      <AtoNovoDialog
        v-model:visivel="registrandoAto"
        :pet-nome="pet.nome"
        @registrar="registrarAto"
      />
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
/* Atendimentos e procedimentos à esquerda, a linha do tempo ao lado. */
@container (min-width: 62rem) {
  .historico__grade {
    grid-template-columns: minmax(0, 1.65fr) minmax(20rem, 1fr);
  }
}

.historico__meta {
  display: block;
  overflow: hidden;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.historico__tipo {
  display: block;
  font-weight: 600;
}

.historico__situacao {
  font-size: 0.8125rem;
  font-weight: 600;
}

.historico__situacao--risco {
  color: var(--hc-coral-tinta);
}

.historico__situacao--fraco {
  color: var(--hc-tinta-2);
  text-decoration: line-through;
}
</style>
