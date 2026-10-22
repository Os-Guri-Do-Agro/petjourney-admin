<script setup lang="ts">
/**
 * Histórico do paciente.
 *
 * Cabeçalho do paciente e o histórico numa lista só, do mais recente para trás — inclusive as
 * faltas, que fazem parte da história e costumam sumir das telas bonitas. A tabela de atendimentos
 * e a linha do tempo, que contavam os mesmos acontecimentos lado a lado, viraram
 * `HistoricoLista`; o convite ao resumo em 30 segundos, que abria como diálogo por cima de tudo,
 * virou uma linha que diz o veredito sem interromper.
 *
 * Redesenho total (19/10/2026): a página saiu do `PartnerPageFrame` para o `UiPagina`, volta a
 * "Pacientes" pelo `#voltar`, e a capa da ficha (`FichaCabeca`) traz as abas do paciente — a do
 * Resumo com a contagem de sinais, que é o "leia isto antes" de antes. Embaixo, à esquerda, o
 * próximo agendado e a linha do tempo; à direita, em tela larga, o que o animal recebeu. Quando
 * ele está internado neste minuto, "Abrir internação" é a ação da capa.
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
import { RouterLink, useRoute, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import FichaCabeca from '@/features/clinico/components/pacientes/ficha/FichaCabeca.vue'
import HistoricoLista from '@/features/clinico/components/pacientes/ficha/HistoricoLista.vue'
import AtoNovoDialog from '@/features/clinico/components/pacientes/AtoNovoDialog.vue'
import AtosDoPaciente from '@/features/clinico/components/pacientes/AtosDoPaciente.vue'
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
/** O resumo "Este pet em 30 segundos": alimenta o selo do botão e a linha do veredito. */
const resumo = ref<ResumoDoPaciente | null>(null)
/** Chegou pelo "Histórico completo" do resumo: acabou de lê-lo, o veredito não se repete. */
const veioDoResumo = ref(false)

const petId = computed(() => String(route.params.petId ?? ''))

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
    veioDoResumo.value = vindoDoResumo()
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

/**
 * O veredito do resumo numa linha, no lugar do diálogo que abria por cima do histórico.
 *
 * O diálogo pedia um clique antes de qualquer leitura; a linha diz o mesmo — "nada fora do comum"
 * ou quantos sinais há — e leva ao resumo, como a aba dele na capa.
 * Respeita o "não sugerir mais", que se liga e desliga na tela do resumo.
 */
const veredito = computed(() => {
  if (!resumo.value || veioDoResumo.value || !prefs.sugerirResumo.value) {
    return null
  }

  if (resumo.value.primeiraVez) {
    return { texto: t('clinico.resumoDoPaciente.sugestao.primeiraVez'), tom: 'neutro' as const }
  }

  const n = resumo.value.sinais.length

  if (n === 0) {
    return { texto: t('clinico.resumoDoPaciente.sinais.nadaFora'), tom: 'neutro' as const }
  }

  return {
    texto: t('clinico.ficha.historico.sinais', { n }, n),
    tom: resumo.value.sinais.some((sinal) => sinal.severidade === 'risco')
      ? ('risco' as const)
      : ('atencao' as const),
  }
})

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

/**
 * O ato lançado aqui não pertence a um atendimento.
 *
 * `encounterId` fica nulo de propósito: esta tela é a ficha do paciente, e o que se lança dela é
 * o que aconteceu fora de uma consulta aberta — o relato do responsável, o curativo do balcão.
 * O ato **da** consulta nasce no prontuário, com o elo já no lugar.
 */
async function registrarAto(
  valor: Omit<Parameters<typeof patientRepository.registrarAto>[0], 'petId' | 'encounterId'>,
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
  <UiPagina
    :titulo="pet?.nome ?? t('clinico.pacientes.titulo')"
    :carregando="carregando && !pet"
    :erro="erro"
    :vazio="vazio"
    :vazio-titulo="t('clinico.prontuario.timeline.vazio')"
    vazio-icone="ph ph-paw-print"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
  >
    <template #voltar>
      <RouterLink to="/veterinario/pacientes" class="voltar">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ t('clinico.pacientes.titulo') }}
      </RouterLink>
    </template>

    <template v-if="pet" #cabecalho>
      <FichaCabeca :pet="pet" :tutor="tutor" atual="historico" :frase="frase" nav-cheia="resumo">
        <!--
          Quando o animal está internado **neste minuto**, o histórico diz isso e leva ao leito.
          Sem esta ação, a página mais completa que a clínica tem sobre um paciente era a única
          que não sabia que ele estava internado ali dentro.
        -->
        <template v-if="internacaoAberta" #acoes>
          <Button
            type="button"
            icon="ph ph-bed"
            :label="t('clinico.pacientes.verInternacao')"
            @click="abrirInternacao"
          />
        </template>
      </FichaCabeca>
    </template>

    <div v-if="pet" class="historico">
      <p
        v-if="veredito"
        class="historico__veredito ui-poco"
        :class="`historico__veredito--${veredito.tom}`"
      >
        <span
          class="ui-ladrilho ui-ladrilho--p historico__veredito-icone"
          :class="veredito.tom !== 'neutro' ? `ui-ladrilho--${veredito.tom}` : ''"
          aria-hidden="true"
        >
          <i class="ph" :class="veredito.tom !== 'neutro' ? 'ph-warning' : 'ph-timer'" />
        </span>
        <span>
          <strong>{{ t('clinico.ficha.historico.emTrintaSegundos') }}</strong>
          {{ veredito.texto }}
        </span>
        <RouterLink class="ui-mais" :to="`/veterinario/paciente/${pet.id}/resumo`">
          {{ t('clinico.resumoDoPaciente.sugestao.ver') }}
        </RouterLink>
      </p>

      <div class="historico__grade">
        <HistoricoLista :eventos="eventos" :atendimentos="atendimentos" @abrir="abrirAtendimento" />

        <!-- O que o animal recebeu é outra pergunta ("o que entrou nele, e quando"): fica ao lado. -->
        <AtosDoPaciente
          :atos="atos"
          :carregando="carregando"
          @registrar="registrandoAto = true"
          @abrir-atendimento="abrirAtendimento"
        />
      </div>
    </div>

    <template #sempre>
      <AtoNovoDialog
        v-if="pet"
        v-model:visivel="registrandoAto"
        :pet-nome="pet.nome"
        @registrar="registrarAto"
      />
    </template>
  </UiPagina>
</template>

<style scoped>
.voltar .ph {
  font-size: 13px;
}

[dir='rtl'] .voltar .ph {
  scale: -1 1;
}

.historico {
  display: grid;
  gap: 20px;
  container-type: inline-size;
}

/* O histórico manda; o que o animal recebeu fica ao lado, mais estreito. */
.historico__grade {
  display: grid;
  align-items: start;
  gap: 24px;
}

@container (min-width: 900px) {
  .historico__grade {
    grid-template-columns: minmax(0, 1fr) minmax(320px, 400px);
  }
}

/* O veredito do resumo: uma linha rente, num poço — o ladrilho carrega a urgência. */
.historico__veredito {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  margin: 0;
  padding: 10px 18px 10px 12px;
  color: var(--tinta-2);
  font-size: 14px;
}

.historico__veredito > span:not(.ui-ladrilho) {
  flex: 1 1 14rem;
  min-width: 0;
}

.historico__veredito strong {
  color: var(--tinta);
  font-weight: 600;
}

.historico__veredito .ui-mais {
  margin-inline-start: auto;
}
</style>
