<script setup lang="ts">
/**
 * Prontuário eletrônico do atendimento.
 *
 * A consulta acontece em quatro momentos e a tela segue esses momentos: **uma etapa por vez**,
 * com o estado das outras à vista no topo. Empilhar anamnese, exame, diagnóstico e conduta na
 * mesma rolagem colocava mais de trinta campos competindo pela atenção de quem está com o
 * animal na mesa — a informação estava toda lá e nenhuma se destacava.
 *
 * O parâmetro da rota aceita duas formas: o id do prontuário (`enc-…`) ou `novo-<appointmentId>`
 * quando o atendimento ainda não tem registro aberto. É o que permite a agenda linkar para cá
 * sem precisar criar o prontuário antes.
 *
 * Estados que a página resolve e que o `PartnerPageFrame` não cobre: **rascunho local**
 * encontrado no navegador, **leitura** quando outro dispositivo detém a edição, e o **autosave**
 * em curso.
 *
 * Ao sair, `onBeforeRouteLeave` e `onBeforeUnmount` gravam o pendente e devolvem a edição.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ClinicPatientHeader from '@/features/clinico/components/base/ClinicPatientHeader.vue'
import ProntuarioAnamnese from '@/features/clinico/components/prontuario/ProntuarioAnamnese.vue'
import ProntuarioConduta from '@/features/clinico/components/prontuario/ProntuarioConduta.vue'
import ProntuarioDiagnostico from '@/features/clinico/components/prontuario/ProntuarioDiagnostico.vue'
import ProntuarioExameFisico from '@/features/clinico/components/prontuario/ProntuarioExameFisico.vue'
import EscutaGatilho from '@/features/clinico/components/escuta/EscutaGatilho.vue'
import EscutaIndicador from '@/features/clinico/components/escuta/EscutaIndicador.vue'
import EscutaPainel from '@/features/clinico/components/escuta/EscutaPainel.vue'
import DocumentoAtestado from '@/features/clinico/components/documentos/DocumentoAtestado.vue'
import DocumentoEncaminhamento from '@/features/clinico/components/documentos/DocumentoEncaminhamento.vue'
import DocumentoObito from '@/features/clinico/components/documentos/DocumentoObito.vue'
import DocumentoOrcamento from '@/features/clinico/components/documentos/DocumentoOrcamento.vue'
import DocumentoOrientacoes from '@/features/clinico/components/documentos/DocumentoOrientacoes.vue'
import DocumentoPedidoExame from '@/features/clinico/components/documentos/DocumentoPedidoExame.vue'
import DocumentoReceituario from '@/features/clinico/components/documentos/DocumentoReceituario.vue'
import DocumentoRelatorioPlano from '@/features/clinico/components/documentos/DocumentoRelatorioPlano.vue'
import DocumentoTermo from '@/features/clinico/components/documentos/DocumentoTermo.vue'
import DocumentoVacinacao from '@/features/clinico/components/documentos/DocumentoVacinacao.vue'
import type {
  DocumentoId,
  TermoKind,
} from '@/features/clinico/components/documentos/documento-types'
import ProntuarioImpressao from '@/features/clinico/components/prontuario/ProntuarioImpressao.vue'
import ProntuarioPreConsulta from '@/features/clinico/components/prontuario/ProntuarioPreConsulta.vue'
import ProntuarioReceita from '@/features/clinico/components/prontuario/ProntuarioReceita.vue'
import ProntuarioResumo from '@/features/clinico/components/prontuario/ProntuarioResumo.vue'
import ProntuarioRetornoDialog from '@/features/clinico/components/prontuario/ProntuarioRetornoDialog.vue'
import ProntuarioStepper from '@/features/clinico/components/prontuario/ProntuarioStepper.vue'
import ProntuarioTecladoDialog from '@/features/clinico/components/prontuario/ProntuarioTecladoDialog.vue'
import ProntuarioVacinacao from '@/features/clinico/components/prontuario/ProntuarioVacinacao.vue'
import ProntuarioTimeline from '@/features/clinico/components/prontuario/ProntuarioTimeline.vue'
import type { PassoProntuario } from '@/features/clinico/components/prontuario/step-types'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { useProntuarioTeclado } from '@/features/clinico/composables/useProntuarioTeclado'
import { vacinaRepository } from '@/features/clinico/data/repositories'
import type {
  AplicacaoVacina,
  Prescription,
  SlotSugestao,
} from '@/features/clinico/data/types'
import type { EtapaId } from '@/features/clinico/domain/encounter-progress'
import {
  alergiaNaoConfirmada,
  progressoDoAtendimento,
} from '@/features/clinico/domain/encounter-progress'
import { useClinicoStore } from '@/features/clinico/stores/clinico'
import { useEscutaStore } from '@/features/clinico/stores/escuta'
import { useProntuarioStore } from '@/features/clinico/stores/prontuario'
import { useCronometroStore } from '@/features/cronometro/stores/cronometro'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const clinico = useClinicoStore()
const prontuario = useProntuarioStore()
const escuta = useEscutaStore()
const cronometro = useCronometroStore()
const formato = useClinicFormat()

const assumirAberto = ref(false)
const finalizarAberto = ref(false)
const etapa = ref<EtapaId>('anamnese')
const historicoAberto = ref(false)

// ------------------------------------------------------------------ modo teclado

/**
 * Digitação rápida.
 *
 * Nasce **ligado**: o modo não muda o que a tela faz com o mouse — só acrescenta caminhos de
 * teclado. Um interruptor desligado por padrão significaria que ninguém o encontra, e o
 * requisito pede que a consulta seja registrada mais rápido do que se escreve à mão.
 *
 * A preferência persiste porque quem desliga tem motivo (leitor de tela com esquema próprio de
 * navegação, por exemplo) e não quer religar a cada paciente.
 */
const CHAVE_TECLADO = 'clinic.keyboardMode'

const modoTeclado = ref(
  typeof window === 'undefined' || window.localStorage.getItem(CHAVE_TECLADO) !== 'false',
)

const idModoTeclado = useId()
const mapaAberto = ref(false)
const corpoDaEtapa = ref<HTMLElement | null>(null)

watch(modoTeclado, (valor) => {
  window.localStorage.setItem(CHAVE_TECLADO, String(valor))
})

useProntuarioTeclado({
  raiz: corpoDaEtapa,
  etapa: computed(() => etapa.value),
  ativo: computed(() => modoTeclado.value && !prontuario.somenteLeitura),
  acoes: {
    proximaEtapa: () => proximaEtapa.value && irParaEtapa(proximaEtapa.value.id),
    etapaAnterior: () => etapaAnterior.value && irParaEtapa(etapaAnterior.value.id),
    ajuda: () => {
      mapaAberto.value = !mapaAberto.value
    },
  },
})

const idDaRota = computed(() => String(route.params.encounterId ?? ''))
const encounter = computed(() => prontuario.encounter)

/** Peso vigente: o do exame físico de hoje, com o cadastro do paciente como piso. */
const pesoVigente = computed(() => {
  const medido = encounter.value?.exameFisico.vitais.peso

  if (medido && !medido.naoAferido && medido.valor !== null) {
    return medido.valor
  }

  return prontuario.pet?.pesoKg ?? null
})

const motivoLeitura = computed(() => {
  const lock = prontuario.donoDaEdicao

  if (!prontuario.somenteLeitura) {
    return ''
  }

  if (encounter.value?.status === 'finalizado') {
    return t('clinico.prontuario.finalizado')
  }

  return lock
    ? t('clinico.prontuario.somenteLeitura', {
        dispositivo: lock.deviceLabel,
        desde: formato.hora(lock.desde),
      })
    : ''
})

const progresso = computed(() => {
  const atual = encounter.value

  if (!atual) {
    return []
  }

  return progressoDoAtendimento(atual, prontuario.pet, (id) => clinico.medicamento(id))
})

/**
 * O resumo de cada passo é o que dispensa abrir a etapa só para lembrar o que tem lá. Fica
 * curto de propósito: uma linha, sem reticências no meio de uma palavra.
 */
const passos = computed<PassoProntuario[]>(() => {
  const atual = encounter.value

  if (!atual) {
    return []
  }

  const [anamnese, exame, diagnostico, conduta, resumo] = progresso.value

  return [
    {
      id: 'anamnese',
      rotulo: t('clinico.prontuario.anamnese.titulo'),
      estado: anamnese?.estado ?? 'vazio',
      resumo: atual.anamnese.queixaPrincipal,
    },
    {
      id: 'exame',
      rotulo: t('clinico.prontuario.exameFisico.titulo'),
      estado: exame?.estado ?? 'vazio',
      resumo:
        (exame?.preenchidos ?? 0) > 0
          ? t('clinico.prontuario.passos.vitaisAferidos', {
              preenchidos: exame?.preenchidos ?? 0,
              total: exame?.total ?? 0,
            })
          : '',
    },
    {
      id: 'diagnostico',
      rotulo: t('clinico.prontuario.diagnostico.titulo'),
      estado: diagnostico?.estado ?? 'vazio',
      resumo: atual.diagnosticos.map((item) => clinico.descricaoDoDiagnostico(item)).join(' · '),
    },
    {
      id: 'conduta',
      rotulo: t('clinico.prontuario.conduta.titulo'),
      estado: conduta?.estado ?? 'vazio',
      resumo:
        conduta?.estado === 'alerta'
          ? t('clinico.prontuario.conduta.alergiaConfirmar')
          : atual.conduta.prescricoes.length > 0
            ? t(
                'clinico.prontuario.passos.prescricoes',
                { contagem: atual.conduta.prescricoes.length },
                atual.conduta.prescricoes.length,
              )
            : atual.conduta.orientacoes,
    },
    {
      id: 'resumo',
      rotulo: t('clinico.prontuario.resumo.titulo'),
      estado: resumo?.estado ?? 'vazio',
      resumo:
        atual.conduta.prescricoes.length > 0
          ? t('clinico.documentos.passoComReceita')
          : t('clinico.documentos.passoSemReceita'),
    },
  ]
})

const indiceDaEtapa = computed(() => passos.value.findIndex((passo) => passo.id === etapa.value))
const etapaAnterior = computed(() => passos.value[indiceDaEtapa.value - 1] ?? null)
const proximaEtapa = computed(() => passos.value[indiceDaEtapa.value + 1] ?? null)

/** O que ainda falta para finalizar. Não bloqueia: nomeia. */
const pendencias = computed(() => {
  const atual = encounter.value

  if (!atual) {
    return []
  }

  const faltando: string[] = []

  if (!atual.anamnese.queixaPrincipal.trim()) {
    faltando.push(t('clinico.prontuario.anamnese.queixaPrincipal'))
  }

  if (atual.diagnosticos.length === 0) {
    faltando.push(t('clinico.prontuario.diagnostico.titulo'))
  }

  if (alergiaNaoConfirmada(atual, prontuario.pet, (id) => clinico.medicamento(id))) {
    faltando.push(t('clinico.prontuario.conduta.alergiaConfirmar'))
  }

  return faltando
})

const erroTraduzido = computed(() => (prontuario.erro ? t(prontuario.erro) : ''))

const ehRetorno = computed(() => {
  const appointmentId = encounter.value?.appointmentId

  if (!appointmentId) {
    return false
  }

  return prontuario.consultaAnterior !== null
})

const ETAPAS: EtapaId[] = ['anamnese', 'exame', 'diagnostico', 'conduta', 'resumo']

/**
 * A etapa mora na URL pelo mesmo motivo que a data mora na URL da agenda: recarregar no meio
 * do exame físico não pode devolver a pessoa à anamnese. `replace` para que "voltar" saia do
 * prontuário em vez de desfazer quatro trocas de etapa.
 */
function irParaEtapa(id: string) {
  etapa.value = ETAPAS.includes(id as EtapaId) ? (id as EtapaId) : 'anamnese'

  void router.replace({ query: { ...route.query, etapa: etapa.value } })

  /** Trocar de etapa recomeça a leitura pelo topo; manter a rolagem esconde o cabeçalho. */
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function carregar() {
  await clinico.carregar()

  if (idDaRota.value.startsWith('novo-')) {
    await prontuario.abrirPorAppointment(idDaRota.value.replace('novo-', ''))

    /** Normaliza a URL para o id real, senão recarregar criaria outro caminho de entrada. */
    if (prontuario.encounter) {
      void router.replace(`/veterinario/atendimento/${prontuario.encounter.id}`)
    }
  } else {
    await prontuario.abrirPorId(idDaRota.value)
  }

  /**
   * O retorno abre mostrando a consulta anterior. Nos demais casos o histórico começa
   * recolhido: é contexto, não a tarefa da vez.
   */
  historicoAberto.value = ehRetorno.value

  /**
   * A etapa da URL manda. Sem ela, entra na primeira ainda incompleta — continuar é mais
   * comum que recomeçar.
   */
  const daUrl = String(route.query.etapa ?? '')

  if (ETAPAS.includes(daUrl as EtapaId)) {
    etapa.value = daUrl as EtapaId

    return
  }

  const pendente = progresso.value.find((item) => item.estado !== 'completo')

  etapa.value = pendente?.id ?? 'anamnese'
}

async function finalizar() {
  await prontuario.finalizar()
  finalizarAberto.value = false

  /*
   * Devolve à agenda. Antes a tela ficava onde estava, virava somente leitura e o passo
   * seguinte do dia — o próximo paciente — exigia achar o menu. O atendimento acabou; o lugar
   * de quem acabou de atender é a grade.
   */
  void router.push('/veterinario/agenda')
}

async function assumir() {
  await prontuario.assumirEdicao()
  assumirAberto.value = false
}

/**
 * O PDF sai pela impressão do navegador, com as folhas A4 de `components/documentos`. Não há
 * biblioteca de PDF no bundle: seriam centenas de kB para reproduzir o que o navegador já faz,
 * e um segundo motor de layout para manter alinhado com o primeiro.
 *
 * **Só o documento escolhido é montado.** A regra de impressão esconde todo filho direto do
 * `body` que não seja a raiz de impressão; deixar as quatro folhas montadas e escondê-las por
 * CSS faria as quatro saírem no papel no dia em que alguém mexesse naquele seletor.
 */
const documentoParaImprimir = ref<DocumentoId>('prontuario')

/** Qual termo, quando é um termo. `null` para todo o resto. */
const termoParaImprimir = computed<TermoKind | null>(() => {
  const mapa: Partial<Record<DocumentoId, TermoKind>> = {
    'termo-consentimento': 'consentimento',
    'termo-recusa': 'recusa',
    'termo-eutanasia': 'eutanasia',
  }

  return mapa[documentoParaImprimir.value] ?? null
})

/** Os três atestados dividem componente; o `else` do teleporte cai aqui. */
const tipoDoAtestado = computed<'saude' | 'comparecimento' | 'viagem'>(() => {
  if (documentoParaImprimir.value === 'atestado-comparecimento') {
    return 'comparecimento'
  }

  return documentoParaImprimir.value === 'atestado-viagem' ? 'viagem' : 'saude'
})

async function emitirDocumento(documento: DocumentoId) {
  documentoParaImprimir.value = documento

  /** Sem esperar a montagem, a impressão dispara com a folha anterior ainda no DOM. */
  await nextTick()

  window.print()
}

function salvarEmPdf() {
  void emitirDocumento('prontuario')
}

/**
 * Abre a escolha de horário do retorno e dispara a busca.
 *
 * Antes daqui a função só navegava para a agenda focando o atendimento **que acabava de
 * terminar** — não criava nada, perdia os dias e o tipo escolhidos na conduta, e deixava o
 * aviso de retorno pendente na tela para sempre, mesmo depois de marcarem o retorno à mão.
 */
/** Aplicações de vacina do paciente — o comprovante imprime a partir delas. */
const aplicacoesDeVacina = ref<AplicacaoVacina[]>([])

async function recarregarVacinas() {
  const petId = prontuario.pet?.id

  aplicacoesDeVacina.value = petId ? await vacinaRepository.doPaciente(petId) : []
}

/* A dose aplicada nesta consulta precisa sair no comprovante impresso logo depois. */
watch(() => prontuario.pet?.id, recarregarVacinas, { immediate: true })

const retornoAberto = ref(false)

/**
 * Repetir a receita anterior.
 *
 * As prescrições chegam já copiadas e com ids novos; aqui elas só entram na conduta de hoje.
 * **Acrescenta** em vez de substituir: quem repete o contínuo do mês passado costuma estar
 * prescrevendo algo novo por cima, e apagar o que já foi digitado seria perder trabalho.
 */
function repetirReceita(prescricoes: Prescription[]) {
  const atual = encounter.value

  if (!atual) {
    return
  }

  prontuario.atualizar({
    conduta: {
      ...atual.conduta,
      prescricoes: [...atual.conduta.prescricoes, ...prescricoes],
    },
  })
}

function agendarRetorno() {
  retornoAberto.value = true
  void prontuario.buscarSugestoesDeRetorno()
}

async function confirmarRetorno(slot: SlotSugestao) {
  const criado = await prontuario.agendarRetorno(slot)

  if (criado) {
    retornoAberto.value = false
  }
}

onMounted(carregar)

/**
 * Trocar de atendimento pela mesma rota fecha o microfone: a autorização foi dada por outro
 * responsável, para outro paciente.
 */
watch(idDaRota, () => {
  escuta.suspender()
  void carregar()
})

/**
 * A gravação começou: o histórico recolhe. É contexto que o veterinário já leu antes de chamar o
 * paciente, e a conversa ao lado do prontuário proposto precisa da largura inteira.
 */
watch(
  () => escuta.fase,
  (fase, anterior) => {
    if (fase === 'gravando' && anterior === 'inativa') {
      historicoAberto.value = false
    }
  },
)

/**
 * Oferece este atendimento ao cronômetro do cabeçalho.
 *
 * Quem publica o contexto é a página, e não o cabeçalho: assim o cabeçalho — que vive no pacote
 * inicial da aplicação — não precisa importar o módulo clínico só para saber o nome do paciente.
 * A dependência aponta para a store genérica, que não conhece nenhum dos dois.
 *
 * O contexto é oferta, não comando: quem decide começar a contar é a pessoa. Um relógio que
 * dispara sozinho ao abrir o prontuário mede a tela aberta, não o atendimento — e num modelo em
 * que o tempo vira dinheiro, medir a coisa errada é o defeito grave.
 */
watch(
  [() => encounter.value?.id, () => prontuario.pet?.nome],
  ([id, nome]) => {
    cronometro.definirContexto(id ? { encounterId: id, rotulo: nome ?? '' } : null)
  },
  { immediate: true },
)

onBeforeRouteLeave(async () => {
  cronometro.definirContexto(null)
  /* Microfone aberto numa tela que ninguém olha é o que a autorização do responsável não cobre. */
  escuta.suspender()
  await prontuario.descarregar()
  prontuario.$limpar()
})

onBeforeUnmount(() => {
  cronometro.definirContexto(null)
  escuta.suspender()
  void prontuario.descarregar()
})
</script>

<template>
  <PartnerPageFrame
    :subtitle="t('clinico.prontuario.subtitulo')"
    :title="t('clinico.prontuario.titulo')"
    :loading="prontuario.carregando && !encounter"
    :error="erroTraduzido"
    block-when-suspended
    @retry="carregar"
  >
    <template #actions>
      <span class="clinic-scope clinic-acoes">
        <span v-if="prontuario.salvando" class="salvando clinic-value">
          <i class="pi pi-spin pi-spinner" aria-hidden="true" />
          {{ t('clinico.prontuario.salvandoAgora') }}
        </span>
        <span v-else-if="prontuario.salvoEm" class="salvando clinic-value">
          <i class="pi pi-check" aria-hidden="true" />
          {{ t('clinico.prontuario.salvoEm', { valor: formato.hora(prontuario.salvoEm) }) }}
        </span>
  
        <Button
          v-if="encounter"
          :label="t('clinico.prontuario.imprimir')"
          icon="pi pi-file-pdf"
          severity="secondary"
          outlined
          :title="t('clinico.prontuario.impressao.dica')"
          @click="salvarEmPdf"
        />
  
        <Button
          v-if="encounter && encounter.status === 'rascunho' && !prontuario.somenteLeitura"
          :label="t('clinico.prontuario.finalizar')"
          icon="pi pi-check-circle"
          @click="finalizarAberto = true"
        />
      </span>
    </template>

    <div v-if="encounter" class="prontuario clinic-scope">
      <!-- Rascunho encontrado no navegador. Oferta, nunca sobrescrita silenciosa. -->
      <p v-if="prontuario.rascunhoPendente" class="faixa faixa--rascunho" role="status">
        <i class="pi pi-history" aria-hidden="true" />
        <span>
          {{ t('clinico.prontuario.rascunhoLocal') }} ·
          {{ formato.relativo(prontuario.rascunhoPendente.salvoEm) }}
        </span>
        <Button
          :label="t('clinico.prontuario.restaurarRascunho')"
          size="small"
          @click="prontuario.restaurarRascunho()"
        />
        <Button
          :label="t('clinico.prontuario.descartarRascunho')"
          size="small"
          severity="secondary"
          text
          @click="prontuario.descartarRascunho()"
        />
      </p>

      <!-- Leitura por outro dispositivo: com saída explícita, não um beco. -->
      <p
        v-if="prontuario.somenteLeitura && encounter.status !== 'finalizado'"
        class="faixa faixa--leitura"
        role="status"
      >
        <i class="pi pi-lock" aria-hidden="true" />
        <span>{{ motivoLeitura }}</span>
        <Button
          :label="t('clinico.prontuario.assumirEdicao')"
          size="small"
          severity="warn"
          @click="assumirAberto = true"
        />
      </p>

      <ClinicPatientHeader :pet="prontuario.pet" :tutor="prontuario.tutor">
        <template #acoes>
          <Button
            :label="
              historicoAberto
                ? t('clinico.prontuario.timeline.ocultar')
                : t('clinico.prontuario.timeline.mostrar')
            "
            :icon="historicoAberto ? 'pi pi-chevron-right' : 'pi pi-history'"
            severity="secondary"
            :outlined="!historicoAberto"
            :text="historicoAberto"
            size="small"
            @click="historicoAberto = !historicoAberto"
          />
        </template>
      </ClinicPatientHeader>

      <ProntuarioStepper :passos="passos" :ativo="etapa" @ir="irParaEtapa" />

      <!--
        O interruptor fica junto do stepper porque é ali que o modo se manifesta: é o stepper
        que `Alt + →` percorre. Escondido em ajustes, ninguém saberia que existe.
      -->
      <div class="teclado">
        <!-- A gravação segue fora da anamnese; fora dela, isto é o que diz que o microfone está aberto. -->
        <EscutaIndicador
          v-if="escuta.emCurso && escuta.encounterId === encounter.id && etapa !== 'anamnese'"
          @voltar="irParaEtapa('anamnese')"
        />

        <span class="teclado__toggle">
          <ToggleSwitch v-model="modoTeclado" :input-id="idModoTeclado" />
          <label :for="idModoTeclado">{{ t('clinico.prontuario.teclado.modo') }}</label>
        </span>

        <Button
          type="button"
          class="teclado__mapa clinic-focusable"
          link
          size="small"
          icon="pi pi-question-circle"
          :label="t('clinico.prontuario.teclado.verTeclas')"
          :title="t('clinico.prontuario.teclado.titulo')"
          @click="mapaAberto = true"
        />
      </div>

      <div class="prontuario__corpo" :class="{ 'prontuario__corpo--com-aside': historicoAberto }">
        <div ref="corpoDaEtapa" class="etapa">
          <!--
            A pré-consulta abre **acima** da anamnese: é o que o vet lê antes de digitar, e
            embaixo do formulário ela chegaria depois de o campo já ter sido preenchido à mão.
          -->
          <template v-if="etapa === 'anamnese'">
            <ProntuarioPreConsulta
              v-if="encounter.preConsulta"
              :pre-consulta="encounter.preConsulta"
              :anamnese="encounter.anamnese"
              :somente-leitura="prontuario.somenteLeitura"
              @aplicar="prontuario.atualizar({ anamnese: { ...encounter.anamnese, ...$event } })"
            />

            <!--
              A conversa gravada fica entre a pré-consulta e o formulário: é depois de ler o que o
              responsável respondeu no app, e antes de o campo ser preenchido.
            -->
            <EscutaPainel
              :encounter-id="encounter.id"
              :anamnese="encounter.anamnese"
              :pet="prontuario.pet"
              :tutor="prontuario.tutor"
              :somente-leitura="prontuario.somenteLeitura"
              :motivo-leitura="motivoLeitura"
              @aplicar="prontuario.atualizar({ anamnese: { ...encounter.anamnese, ...$event } })"
            />
          </template>

          <ProntuarioAnamnese
            v-if="etapa === 'anamnese'"
            :valor="encounter.anamnese"
            :somente-leitura="prontuario.somenteLeitura"
            :motivo-leitura="motivoLeitura"
            @atualizar="prontuario.atualizar({ anamnese: { ...encounter.anamnese, ...$event } })"
          >
            <template #acoes>
              <EscutaGatilho
                :encounter-id="encounter.id"
                :somente-leitura="prontuario.somenteLeitura"
                :motivo-leitura="motivoLeitura"
              />
            </template>
          </ProntuarioAnamnese>

          <ProntuarioExameFisico
            v-else-if="etapa === 'exame'"
            :valor="encounter.exameFisico"
            :pet="prontuario.pet"
            :somente-leitura="prontuario.somenteLeitura"
            :motivo-leitura="motivoLeitura"
            @atualizar="prontuario.atualizar($event)"
          />

          <ProntuarioDiagnostico
            v-else-if="etapa === 'diagnostico'"
            :valor="encounter.diagnosticos"
            :somente-leitura="prontuario.somenteLeitura"
            :motivo-leitura="motivoLeitura"
            @atualizar="prontuario.atualizar($event)"
          />

          <ProntuarioConduta
            v-else-if="etapa === 'conduta'"
            :valor="encounter.conduta"
            :pet="prontuario.pet"
            :peso-kg="pesoVigente"
            :somente-leitura="prontuario.somenteLeitura"
            :motivo-leitura="motivoLeitura"
            @atualizar="prontuario.atualizar($event)"
            @agendar-retorno="agendarRetorno"
          />

          <!--
            A emissão fica **abaixo** da conduta, na mesma etapa: assinar é o último ato do
            atendimento, e separá-lo numa etapa própria faria a receita virar uma tarefa que
            se esquece de fazer.
          -->
          <!--
            Vacinação vive na conduta, ao lado da receita: as duas são o que sai do atendimento
            e vão para a carteira do animal.
          -->
          <ProntuarioVacinacao
            v-if="etapa === 'conduta'"
            :encounter="encounter"
            :pet="prontuario.pet"
            :somente-leitura="prontuario.somenteLeitura"
            @registrada="recarregarVacinas"
          />

          <ProntuarioReceita
            v-if="etapa === 'conduta'"
            :encounter="encounter"
            :somente-leitura="prontuario.somenteLeitura"
            @repetir="repetirReceita"
          />

          <!--
            `v-if` e não `v-else`: o `else` ficava pendurado no `v-if` da receita, e o resumo
            inteiro aparecia embaixo da anamnese, do exame e do diagnóstico.
          -->
          <ProntuarioResumo
            v-if="etapa === 'resumo'"
            :encounter="encounter"
            :pet="prontuario.pet"
            :tutor="prontuario.tutor"
            @emitir="emitirDocumento"
            @liberar-resumo="prontuario.liberarResumo()"
          />

          <!--
            O rodapé é o caminho de teclado entre as etapas: sair do último campo cai no botão
            que leva à etapa seguinte, sem atalho para decorar.
          -->
          <footer class="etapa__rodape">
            <Button
              v-if="etapaAnterior"
              :label="etapaAnterior.rotulo"
              icon="pi pi-arrow-left"
              severity="secondary"
              text
              @click="irParaEtapa(etapaAnterior.id)"
            />
            <span v-else />

            <Button
              v-if="proximaEtapa"
              :label="proximaEtapa.rotulo"
              icon="pi pi-arrow-right"
              icon-pos="right"
              severity="secondary"
              outlined
              @click="irParaEtapa(proximaEtapa.id)"
            />
            <Button
              v-else-if="encounter.status === 'rascunho' && !prontuario.somenteLeitura"
              :label="t('clinico.prontuario.finalizar')"
              icon="pi pi-check-circle"
              @click="finalizarAberto = true"
            />
          </footer>
        </div>

        <ProntuarioTimeline
          v-if="historicoAberto"
          :eventos="prontuario.timeline"
          :anterior="prontuario.consultaAnterior"
          :rota-completa="`/veterinario/paciente/${encounter.petId}/historico`"
        />
      </div>
    </div>

    <!-- transferência explícita da edição -->
    <Dialog
      v-model:visible="assumirAberto"
      modal
      class="clinic-dialog"
      :style="{ width: 'min(30rem, 94vw)' }"
      :header="t('clinico.prontuario.assumirDialogo.titulo')"
      dismissable-mask
    >
      <p class="dialogo clinic-scope">{{ t('clinico.prontuario.assumirDialogo.descricao') }}</p>
      <template #footer>
        <Button
          :label="t('clinico.agenda.mover.cancelar')"
          severity="secondary"
          text
          @click="assumirAberto = false"
        />
        <Button
          :label="t('clinico.prontuario.assumirDialogo.confirmar')"
          severity="warn"
          @click="assumir"
        />
      </template>
    </Dialog>

    <!-- finalizar: nomeia o que falta, e ainda assim deixa finalizar -->
    <Dialog
      v-model:visible="finalizarAberto"
      modal
      class="clinic-dialog"
      :style="{ width: 'min(30rem, 94vw)' }"
      :header="t('clinico.prontuario.finalizarDialogo.titulo')"
      dismissable-mask
    >
      <div class="dialogo clinic-scope">
        <p>{{ t('clinico.prontuario.finalizarDialogo.descricao') }}</p>
        <p v-if="pendencias.length > 0" class="dialogo__pendencias">
          <i class="pi pi-exclamation-circle" aria-hidden="true" />
          {{ t('clinico.prontuario.finalizarDialogo.pendencias', { itens: pendencias.join(', ') }) }}
        </p>
      </div>

      <template #footer>
        <Button
          :label="t('clinico.agenda.mover.cancelar')"
          severity="secondary"
          text
          @click="finalizarAberto = false"
        />
        <Button
          :label="
            pendencias.length > 0
              ? t('clinico.prontuario.finalizarDialogo.confirmar')
              : t('clinico.prontuario.finalizar')
          "
          :severity="pendencias.length > 0 ? 'warn' : 'primary'"
          @click="finalizar"
        />
      </template>
    </Dialog>
    <!--
      A folha de impressão vive fora da página, direto no `body`: é o que permite a regra de
      impressão esconder todo o resto com um seletor de filho direto.
    -->
    <Teleport to="body">
      <div v-if="encounter" class="clinic-print-root">
        <ProntuarioImpressao
          v-if="documentoParaImprimir === 'prontuario'"
          :encounter="encounter"
          :pet="prontuario.pet"
          :tutor="prontuario.tutor"
        />
        <DocumentoReceituario
          v-else-if="documentoParaImprimir === 'receituario'"
          :encounter="encounter"
          :pet="prontuario.pet"
          :tutor="prontuario.tutor"
        />
        <DocumentoPedidoExame
          v-else-if="documentoParaImprimir === 'pedido-exame'"
          :encounter="encounter"
          :pet="prontuario.pet"
          :tutor="prontuario.tutor"
        />
        <DocumentoOrientacoes
          v-else-if="documentoParaImprimir === 'orientacoes'"
          :encounter="encounter"
          :pet="prontuario.pet"
          :tutor="prontuario.tutor"
        />
        <DocumentoEncaminhamento
          v-else-if="documentoParaImprimir === 'encaminhamento'"
          :encounter="encounter"
          :pet="prontuario.pet"
          :tutor="prontuario.tutor"
        />
        <DocumentoRelatorioPlano
          v-else-if="documentoParaImprimir === 'relatorio-plano'"
          :encounter="encounter"
          :pet="prontuario.pet"
          :tutor="prontuario.tutor"
        />
        <DocumentoObito
          v-else-if="documentoParaImprimir === 'declaracao-obito'"
          :encounter="encounter"
          :pet="prontuario.pet"
          :tutor="prontuario.tutor"
        />
        <DocumentoVacinacao
          v-else-if="documentoParaImprimir === 'comprovante-vacinacao'"
          :encounter="encounter"
          :pet="prontuario.pet"
          :tutor="prontuario.tutor"
          :aplicacoes="aplicacoesDeVacina"
        />
        <DocumentoOrcamento
          v-else-if="documentoParaImprimir === 'orcamento'"
          :encounter="encounter"
          :pet="prontuario.pet"
          :tutor="prontuario.tutor"
        />
        <!--
          Os três termos compartilham componente: a estrutura é a mesma — texto declaratório e
          duas assinaturas —, e o que muda é a gravidade do texto, que vem do `kind`.
        -->
        <DocumentoTermo
          v-else-if="termoParaImprimir"
          :encounter="encounter"
          :pet="prontuario.pet"
          :tutor="prontuario.tutor"
          :kind="termoParaImprimir"
        />
        <DocumentoAtestado
          v-else
          :encounter="encounter"
          :pet="prontuario.pet"
          :tutor="prontuario.tutor"
          :tipo="tipoDoAtestado"
        />
      </div>
    </Teleport>

    <ProntuarioTecladoDialog v-model:visible="mapaAberto" />

    <ProntuarioRetornoDialog
      v-if="encounter"
      v-model:visivel="retornoAberto"
      :sugestoes="prontuario.sugestoesDeRetorno"
      :buscando="prontuario.buscandoRetorno"
      :salvando="prontuario.salvando"
      :a-partir-de="prontuario.dataDoAtendimento"
      :em-dias="encounter.conduta.retorno.emDias"
      @escolher="confirmarRetorno"
    />
  </PartnerPageFrame>
</template>

<style scoped>
.prontuario {
  display: grid;
  gap: var(--clinic-space-3);
}

.teclado {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--clinic-space-3);
}

.teclado__toggle {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.teclado__toggle label {
  cursor: pointer;
}

.teclado__mapa.p-button {
  gap: 0.3rem;
  padding: 0;
  font-size: var(--clinic-font-label);
}

.teclado__mapa.p-button,
.teclado__mapa.p-button:not(:disabled):hover,
.teclado__mapa.p-button:not(:disabled):active {
  color: var(--clinic-accent-strong);
}

.teclado__mapa :deep(.p-button-label) {
  font-weight: 700;
  text-underline-offset: 2px;
}

.prontuario__corpo {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-items: start;
  gap: var(--clinic-space-3);
}

.prontuario__corpo--com-aside {
  grid-template-columns: minmax(0, 1fr) auto;
}

.etapa {
  display: grid;
  gap: var(--clinic-space-3);
  min-width: 0;
}

.etapa__rodape {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.faixa {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  line-height: 1.45;
}

.faixa span {
  flex: 1;
  min-width: 12rem;
}

.faixa--rascunho {
  border-color: var(--clinic-accent);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.faixa--leitura {
  border-color: var(--clinic-attention-line);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
}

.salvando {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.dialogo {
  display: grid;
  gap: var(--clinic-space-3);
  line-height: 1.55;
}

.dialogo p {
  margin: 0;
}

.dialogo__pendencias {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-attention-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
  font-weight: 650;
}

@media (max-width: 1200px) {
  .prontuario__corpo--com-aside {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
