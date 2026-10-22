<script setup lang="ts">
/**
 * O atendimento — a tela em que o veterinário passa a consulta inteira.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * É tela de trabalho concentrado, e se organiza em torno de três perguntas:
 *
 * 1. **Com quem** — a capa do paciente (`FichaCabeca`, a mesma da ficha e do internado): o rosto,
 *    o nome como título, os alertas que mudam a conduta, o peso de que sai toda dose e o
 *    responsável com o telefone; embaixo, a frase do atendimento (aberto quando, com quem, quantos
 *    passos prontos) e as saídas para a ficha. Ao rolar, o paciente não some: uma barra compacta
 *    desce e fica presa no alto, com o nome, os alertas, os passos e "Finalizar". Quem está no
 *    meio da prescrição não sobe a página para conferir a alergia.
 * 2. **Onde estou** — o trilho dos cinco passos (anamnese, exame, diagnóstico, conduta, resumo),
 *    com o feito, o atual e o que falta, e o resumo de cada um embaixo do nome.
 * 3. **O que escrevo agora** — a etapa atual numa folha larga, com campos generosos e o rótulo
 *    em cima. À direita, em tela larga, a coluna de contexto: a consulta anterior em destaque e
 *    o histórico do paciente. Contexto, não tarefa — some com um clique, e recolhe sozinho
 *    quando a gravação da consulta começa e precisa da largura.
 *
 * "Finalizar atendimento" é a ação cheia, à direita da capa; "Imprimir ou salvar PDF" fica
 * contornada ao lado. O estado da gravação automática mora na linha de ferramentas da etapa. As faixas (rascunho encontrado no navegador, leitura por outro dispositivo, atendimento
 * finalizado) entram entre o trilho e a folha, cada uma com o tom e a saída dela.
 *
 * ## O que não mudou
 *
 * O parâmetro da rota aceita o id do prontuário (`enc-…`) ou `novo-<appointmentId>`; o segundo
 * abre o prontuário e normaliza a URL. A etapa mora na URL (`?etapa=`). O modo teclado
 * (`Alt + →/←`, `Alt + S`, `Alt + ?`, `Enter` avança) segue ligado por padrão, com a preferência
 * em `localStorage`. A folha de impressão é teleportada para o `body` (a regra de impressão
 * esconde todo filho direto do `body` que não seja ela). Ao sair, a escuta é suspensa, o
 * pendente é gravado e o store é limpo.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { onBeforeRouteLeave, RouterLink, useRoute, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import { rolagemAtual, rolarConteudoPara, topoDoRolador } from '@/composables/rolagemDoConteudo'
import { useTelaLarga } from '@/composables/useTelaLarga'
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
import EscutaGatilho from '@/features/clinico/components/escuta/EscutaGatilho.vue'
import EscutaIndicador from '@/features/clinico/components/escuta/EscutaIndicador.vue'
import EscutaPainel from '@/features/clinico/components/escuta/EscutaPainel.vue'
import FichaCabeca from '@/features/clinico/components/pacientes/ficha/FichaCabeca.vue'
import ProntuarioAnamnese from '@/features/clinico/components/prontuario/ProntuarioAnamnese.vue'
import ProntuarioConduta from '@/features/clinico/components/prontuario/ProntuarioConduta.vue'
import ProntuarioDiagnostico from '@/features/clinico/components/prontuario/ProntuarioDiagnostico.vue'
import ProntuarioDialogoTopo from '@/features/clinico/components/prontuario/ProntuarioDialogoTopo.vue'
import ProntuarioExameFisico from '@/features/clinico/components/prontuario/ProntuarioExameFisico.vue'
import ProntuarioImpressao from '@/features/clinico/components/prontuario/ProntuarioImpressao.vue'
import ProntuarioPreConsulta from '@/features/clinico/components/prontuario/ProntuarioPreConsulta.vue'
import ProntuarioReceita from '@/features/clinico/components/prontuario/ProntuarioReceita.vue'
import ProntuarioResumo from '@/features/clinico/components/prontuario/ProntuarioResumo.vue'
import ProntuarioRetornoDialog from '@/features/clinico/components/prontuario/ProntuarioRetornoDialog.vue'
import ProntuarioStepper from '@/features/clinico/components/prontuario/ProntuarioStepper.vue'
import ProntuarioTecladoDialog from '@/features/clinico/components/prontuario/ProntuarioTecladoDialog.vue'
import ProntuarioTimeline from '@/features/clinico/components/prontuario/ProntuarioTimeline.vue'
import ProntuarioVacinacao from '@/features/clinico/components/prontuario/ProntuarioVacinacao.vue'
import type { PassoProntuario } from '@/features/clinico/components/prontuario/step-types'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import { useProntuarioTeclado } from '@/features/clinico/composables/useProntuarioTeclado'
import { useRotulosDaEscuta } from '@/features/clinico/composables/useRotulosDaEscuta'
import { vacinaRepository } from '@/features/clinico/data/repositories'
import type {
  AplicacaoVacina,
  PetAlert,
  Prescription,
  SlotSugestao,
} from '@/features/clinico/data/types'
import type { EtapaId } from '@/features/clinico/domain/encounter-progress'
import {
  alergiaNaoConfirmada,
  progressoDoAtendimento,
} from '@/features/clinico/domain/encounter-progress'
import { clinicClock, useClinicoStore } from '@/features/clinico/stores/clinico'
import { useEscutaStore } from '@/features/clinico/stores/escuta'
import { useProntuarioStore } from '@/features/clinico/stores/prontuario'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const clinico = useClinicoStore()
const prontuario = useProntuarioStore()
const escuta = useEscutaStore()
const formato = useClinicFormat()
const rotulosDaEscuta = useRotulosDaEscuta()
const telaLarga = useTelaLarga(1280)

const assumirAberto = ref(false)
const finalizarAberto = ref(false)
const etapa = ref<EtapaId>('anamnese')
const historicoAberto = ref(false)

const idFinalizar = useId()
const idAssumir = useId()

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

/**
 * O motivo da leitura dentro da folha. Com a faixa do alto já dizendo "somente leitura" (ou
 * "finalizado"), repetir a frase no topo de cada folha seria a mesma notícia duas vezes.
 */
const motivoDaFolha = ''

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
          ? t('clinico.prontuario.nova.finalizar.alergia')
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

/** O número da etapa no ladrilho do cabeçalho da folha, o mesmo do disco no trilho (CSS `content`). */
const numeroDaEtapa = computed(() => JSON.stringify(String(indiceDaEtapa.value + 1)))
const etapaAnterior = computed(() => passos.value[indiceDaEtapa.value - 1] ?? null)
const proximaEtapa = computed(() => passos.value[indiceDaEtapa.value + 1] ?? null)

/** O que ainda falta para finalizar, com a etapa onde se resolve. Não bloqueia: nomeia. */
const pendencias = computed(() => {
  const atual = encounter.value

  if (!atual) {
    return []
  }

  const faltando: Array<{ texto: string; etapa: EtapaId }> = []

  if (!atual.anamnese.queixaPrincipal.trim()) {
    faltando.push({ texto: t('clinico.prontuario.nova.finalizar.queixa'), etapa: 'anamnese' })
  }

  if (atual.diagnosticos.length === 0) {
    faltando.push({
      texto: t('clinico.prontuario.nova.finalizar.diagnostico'),
      etapa: 'diagnostico',
    })
  }

  if (alergiaNaoConfirmada(atual, prontuario.pet, (id) => clinico.medicamento(id))) {
    faltando.push({ texto: t('clinico.prontuario.nova.finalizar.alergia'), etapa: 'conduta' })
  }

  return faltando
})

function rotuloDaEtapa(id: EtapaId) {
  return passos.value.find((passo) => passo.id === id)?.rotulo ?? ''
}

const erroTraduzido = computed(() => (prontuario.erro ? t(prontuario.erro) : ''))

const ehRetorno = computed(() => {
  const appointmentId = encounter.value?.appointmentId

  if (!appointmentId) {
    return false
  }

  return prontuario.consultaAnterior !== null
})

const podeFinalizar = computed(
  () =>
    Boolean(encounter.value) &&
    encounter.value?.status === 'rascunho' &&
    !prontuario.somenteLeitura,
)

const finalizado = computed(() => encounter.value?.status === 'finalizado')

// ------------------------------------------------------------------ o alto da tela

/**
 * Para onde o "voltar" leva: a tela de onde se veio, quando ela é uma das que abrem atendimento
 * (o Hoje, a agenda, a ficha do paciente…). Sem histórico — link colado, aba nova —, vai para
 * Pacientes, que é o destino desta tela na barra.
 *
 * Lido uma vez: o `replace` de `novo-…` para o id real e as trocas de etapa preservam o `back`
 * do histórico, mas a tela não precisa reagir a ele.
 */
const voltouDe =
  typeof window === 'undefined'
    ? ''
    : String((window.history.state as { back?: unknown } | null)?.back ?? '')

const ORIGENS: Array<{ prefixo: string; chave: string }> = [
  { prefixo: '/veterinario/meu-dia', chave: 'espacos.clinica.hoje' },
  { prefixo: '/veterinario/agenda', chave: 'espacos.clinica.agenda' },
  { prefixo: '/veterinario/fila', chave: 'espacos.abas.fila' },
  { prefixo: '/veterinario/pedidos', chave: 'espacos.abas.pedidos' },
  { prefixo: '/veterinario/atendimentos', chave: 'espacos.abas.atendimentos' },
  { prefixo: '/veterinario/internacao', chave: 'espacos.clinica.internacao' },
  { prefixo: '/veterinario/atividades', chave: 'espacos.abas.atividades' },
  { prefixo: '/veterinario/pacientes', chave: 'espacos.clinica.pacientes' },
]

const voltar = computed(() => {
  if (voltouDe.startsWith('/veterinario/paciente/')) {
    return {
      rota: voltouDe,
      rotulo: prontuario.pet
        ? t('clinico.prontuario.nova.voltarFicha', { pet: prontuario.pet.nome })
        : t('espacos.clinica.pacientes'),
    }
  }

  const origem = ORIGENS.find((item) => voltouDe.startsWith(item.prefixo))

  return origem
    ? { rota: voltouDe, rotulo: t(origem.chave) }
    : { rota: '/veterinario/pacientes', rotulo: t('espacos.clinica.pacientes') }
})

const profissional = computed(() =>
  encounter.value ? (clinico.profissional(encounter.value.professionalId)?.nome ?? '') : '',
)

/** A frase de estado: quando abriu e com quem, quantos passos estão prontos — ou quando fechou. */
const fraseDoResumo = computed(() => {
  const atual = encounter.value

  if (!atual) {
    return ''
  }

  if (atual.status === 'finalizado' && atual.finalizadoEm) {
    return t('clinico.prontuario.nova.resumo.finalizado', {
      data: formato.dataCurta(clinicClock.dateOf(atual.finalizadoEm)),
      hora: formato.hora(atual.finalizadoEm),
      profissional: profissional.value,
    })
  }

  const prontos = passos.value.filter((passo) => passo.estado === 'completo').length

  return [
    t('clinico.prontuario.nova.resumo.aberto', {
      hora: formato.hora(atual.abertoEm),
      profissional: profissional.value,
    }),
    t('clinico.prontuario.nova.resumo.etapas', { feitas: prontos, total: passos.value.length }),
  ].join('. ')
})

/** Gravando agora, salvo às tantas, ou a promessa de que salva sozinho. */
const estadoDaGravacao = computed(() => {
  if (!encounter.value || finalizado.value) {
    return ''
  }

  if (prontuario.salvando) {
    return t('clinico.prontuario.salvandoAgora')
  }

  return prontuario.salvoEm
    ? t('clinico.prontuario.nova.salvoAs', { hora: formato.hora(prontuario.salvoEm) })
    : t('clinico.prontuario.nova.autosave')
})

/** A escuta deste atendimento está aberta: a barra fixa diz isso em qualquer etapa. */
const gravandoAqui = computed(
  () => Boolean(encounter.value) && escuta.emCurso && escuta.encounterId === encounter.value?.id,
)

/** Os alertas que mudam a conduta, para a barra fixa — o selo inteiro mora no cabeçalho. */
const alertasDaBarra = computed(() =>
  (prontuario.pet?.alertas ?? [])
    .filter((alerta) => alerta.severidade !== 'info')
    .sort((a, b) => Number(b.severidade === 'risco') - Number(a.severidade === 'risco')),
)

function textoDoAlerta(alerta: PetAlert) {
  return alerta.detalhe ? `${formato.alerta(alerta.kind)}: ${alerta.detalhe}` : formato.alerta(alerta.kind)
}

/**
 * Na barra fixa o alerta vai curto — o nome dele —, menos a alergia, que leva o princípio: é o
 * detalhe que decide a receita. O texto inteiro fica no `title` e na capa.
 */
function textoCurtoDoAlerta(alerta: PetAlert) {
  return alerta.kind === 'alergia' ? textoDoAlerta(alerta) : formato.alerta(alerta.kind)
}

const metaDaBarra = computed(() => {
  const pet = prontuario.pet

  if (!pet) {
    return ''
  }

  return [
    pet.raca || formato.especie(pet.especie),
    formato.idade(pet.nascimento),
    pesoVigente.value !== null ? formato.peso(pesoVigente.value) : '',
  ]
    .filter(Boolean)
    .join(' · ')
})

// ------------------------------------------------------------------ a barra que acompanha

/**
 * A barra compacta aparece quando o cabeçalho do paciente passa para baixo da faixa fixa do
 * alto (a fita do dia, e no celular a barra do topo). A altura dessa faixa é medida, não
 * escrita: ela muda entre tela larga e celular, e um número fixo deixaria a barra por baixo
 * dela ou flutuando com um vão.
 */
const cabecaDoPaciente = ref<HTMLElement | null>(null)
const alturaDoTopo = ref(0)
const pacienteFora = ref(false)

let quadroPendente = 0
let observador: ResizeObserver | null = null
let observadas: HTMLElement[] = []

function faixasFixas() {
  return [...document.querySelectorAll<HTMLElement>('.palco__fita, .palco > .topo')].filter(
    (elemento) => getComputedStyle(elemento).position === 'sticky',
  )
}

/**
 * Mede a faixa fixa do alto e passa a acompanhar o tamanho dela. Chamada na montagem, depois de
 * carregar e, se ainda não achou nada, na primeira rolagem: a moldura pode terminar de montar
 * depois da tela (a rota é carregada sob demanda).
 */
function medirTopo() {
  const fixas = faixasFixas()

  alturaDoTopo.value = Math.max(
    0,
    ...fixas.map((elemento) => Math.round(elemento.getBoundingClientRect().bottom)),
  )

  if (typeof ResizeObserver === 'undefined') {
    return
  }

  const novas = fixas.filter((elemento) => !observadas.includes(elemento))

  if (novas.length > 0) {
    observador ??= new ResizeObserver(() => medirTopo())
    novas.forEach((elemento) => observador?.observe(elemento))
    observadas = [...observadas, ...novas]
  }
}

function acompanharRolagem() {
  if (quadroPendente) {
    return
  }

  quadroPendente = requestAnimationFrame(() => {
    quadroPendente = 0

    if (observadas.length === 0) {
      medirTopo()
    }

    const cabeca = cabecaDoPaciente.value

    pacienteFora.value = cabeca
      ? cabeca.getBoundingClientRect().bottom < topoDoRolador() + alturaDoTopo.value + 8
      : false
  })
}

function aoRedimensionar() {
  medirTopo()
  acompanharRolagem()
}

/*
 * Rola a janela no celular e a folha (`main#conteudo`) em tela larga; ouvir os dois cobre a troca
 * de um para o outro quando a janela muda de largura.
 */
let folhaQueRola: HTMLElement | null = null

onMounted(() => {
  medirTopo()
  folhaQueRola = document.getElementById('conteudo')
  folhaQueRola?.addEventListener('scroll', acompanharRolagem, { passive: true })
  window.addEventListener('scroll', acompanharRolagem, { passive: true })
  window.addEventListener('resize', aoRedimensionar, { passive: true })
})

onBeforeUnmount(() => {
  folhaQueRola?.removeEventListener('scroll', acompanharRolagem)
  window.removeEventListener('scroll', acompanharRolagem)
  window.removeEventListener('resize', aoRedimensionar)
  observador?.disconnect()
  cancelAnimationFrame(quadroPendente)
})

// ------------------------------------------------------------------ etapas

const ETAPAS: EtapaId[] = ['anamnese', 'exame', 'diagnostico', 'conduta', 'resumo']

/**
 * A etapa mora na URL pelo mesmo motivo que a data mora na URL da agenda: recarregar no meio
 * do exame físico não pode devolver a pessoa à anamnese. `replace` para que "voltar" saia do
 * prontuário em vez de desfazer quatro trocas de etapa.
 */
function irParaEtapa(id: string) {
  etapa.value = ETAPAS.includes(id as EtapaId) ? (id as EtapaId) : 'anamnese'

  void router.replace({ query: { ...route.query, etapa: etapa.value } })

  /*
   * Trocar de etapa recomeça a leitura pelo começo da folha. Rola só até o trilho, e só quando
   * ele já saiu de vista: voltar ao topo da página inteira esconderia a etapa atrás do
   * cabeçalho do paciente, que a barra fixa já repete.
   */
  void nextTick(() => {
    const trilho = document.getElementById('atendimento-trilho')

    if (!trilho) {
      return
    }

    const limite = topoDoRolador() + alturaDoTopo.value
    const topo = trilho.getBoundingClientRect().top

    if (topo < limite) {
      const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

      rolarConteudoPara(rolagemAtual() + topo - limite - 76, reduzir ? 'auto' : 'smooth')
    }
  })
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
   * Em tela larga a coluna de contexto abre: cabe ao lado da folha sem roubar a largura dela.
   * Em tela menor ela cairia em cima da folha, e começa recolhida — menos no retorno, que abre
   * mostrando a consulta anterior porque é dela que a consulta de hoje depende.
   */
  historicoAberto.value = telaLarga.value || ehRetorno.value

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

/* Depois de carregar, a moldura já está de pé: mede de novo a faixa do alto. */
watch(
  () => Boolean(encounter.value),
  (aberto) => {
    if (aberto) {
      void nextTick(aoRedimensionar)
    }
  },
)

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

/** "Ir para o diagnóstico", de dentro do diálogo de finalizar: fecha e leva à etapa. */
function resolverPendencia(id: EtapaId) {
  finalizarAberto.value = false
  irParaEtapa(id)
}

async function assumir() {
  await prontuario.assumirEdicao()
  assumirAberto.value = false
}

// ------------------------------------------------------------------ documentos

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

/** Aplicações de vacina do paciente — o comprovante imprime a partir delas. */
const aplicacoesDeVacina = ref<AplicacaoVacina[]>([])

async function recarregarVacinas() {
  const petId = prontuario.pet?.id

  aplicacoesDeVacina.value = petId ? await vacinaRepository.doPaciente(petId) : []
}

/* A dose aplicada nesta consulta precisa sair no comprovante impresso logo depois. */
watch(() => prontuario.pet?.id, recarregarVacinas, { immediate: true })

// ------------------------------------------------------------------ conduta

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

/** Crítico é da prescrição: vai com ela para a receita e, no app, para o tratamento de casa. */
function marcarCritico(prescricaoId: string, critico: boolean) {
  const atual = encounter.value

  if (!atual) {
    return
  }

  prontuario.atualizar({
    conduta: {
      ...atual.conduta,
      prescricoes: atual.conduta.prescricoes.map((prescricao) =>
        prescricao.id === prescricaoId ? { ...prescricao, critico } : prescricao,
      ),
    },
  })
}

/**
 * Abre a escolha de horário do retorno e dispara a busca.
 *
 * Antes daqui a função só navegava para a agenda focando o atendimento **que acabava de
 * terminar** — não criava nada, perdia os dias e o tipo escolhidos na conduta, e deixava o
 * aviso de retorno pendente na tela para sempre, mesmo depois de marcarem o retorno à mão.
 */
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

onBeforeRouteLeave(async () => {
  /* Microfone aberto numa tela que ninguém olha é o que a autorização do responsável não cobre. */
  escuta.suspender()
  await prontuario.descarregar()
  prontuario.$limpar()
})

onBeforeUnmount(() => {
  escuta.suspender()
  void prontuario.descarregar()
})
</script>

<template>
  <UiPagina
    class="atendimento"
    :style="{ '--topo-fixo': `${alturaDoTopo}px` }"
    :titulo="t('clinico.prontuario.nova.titulo')"
    :carregando="prontuario.carregando && !encounter"
    :erro="erroTraduzido"
    bloquear-se-suspenso
    @tentar-de-novo="carregar"
  >
    <template #voltar>
      <RouterLink :to="voltar.rota" class="voltar">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ voltar.rotulo }}
      </RouterLink>
    </template>

    <template #cabecalho>
      <!--
        A capa do paciente, a mesma da ficha e do internado: o paciente é o título desta tela. A
        frase dela diz o estado do atendimento, e as ações ficam à direita, na própria capa.
      -->
      <div ref="cabecaDoPaciente" class="cabeca">
        <FichaCabeca
          v-if="prontuario.pet && encounter"
          :pet="prontuario.pet"
          :tutor="prontuario.tutor"
          :atual="null"
          :frase="fraseDoResumo"
          :peso-kg="pesoVigente"
        >
          <template #acoes>
            <Button
              type="button"
              :label="t('clinico.prontuario.nova.imprimir')"
              icon="ph ph-printer"
              severity="secondary"
              outlined
              :title="t('clinico.prontuario.impressao.dica')"
              @click="salvarEmPdf"
            />
            <Button
              v-if="podeFinalizar"
              type="button"
              :label="t('clinico.prontuario.finalizar')"
              icon="ph ph-check-circle"
              @click="finalizarAberto = true"
            />
          </template>
        </FichaCabeca>
        <h1 v-else class="cabeca__reserva">{{ t('clinico.prontuario.nova.titulo') }}</h1>
      </div>
    </template>

    <div v-if="encounter" class="corpo">
      <!--
        A barra que acompanha a rolagem. Mora no fluxo com altura zero: fica presa logo abaixo da
        faixa fixa do alto e só aparece quando o cabeçalho do paciente sai de vista.
      -->
      <div class="fixo" :class="{ 'fixo--visivel': pacienteFora }" :inert="pacienteFora ? undefined : true">
        <div
          class="fixo__barra"
          role="region"
          :aria-label="t('clinico.prontuario.nova.fixoRotulo')"
        >
          <PetAvatar
            v-if="prontuario.pet"
            :nome="prontuario.pet.nome"
            :iniciais="prontuario.pet.iniciais"
            :especie="prontuario.pet.especie"
            :foto-url="prontuario.pet.fotoUrl"
            tamanho="sm"
          />
          <span class="fixo__quem">
            <strong class="fixo__nome">{{ prontuario.pet?.nome }}</strong>
            <span class="fixo__meta ui-num">{{ metaDaBarra }}</span>
          </span>

          <ul v-if="alertasDaBarra.length" class="fixo__alertas">
            <li
              v-for="alerta in alertasDaBarra"
              :key="alerta.id"
              class="ui-selo"
              :class="`ui-selo--${alerta.severidade}`"
              :title="textoDoAlerta(alerta)"
            >
              <i
                :class="alerta.severidade === 'risco' ? 'ph ph-warning' : 'ph ph-warning-circle'"
                aria-hidden="true"
              />
              <span>{{ textoCurtoDoAlerta(alerta) }}</span>
            </li>
          </ul>

          <span v-if="gravandoAqui" class="fixo__escuta">
            <span
              class="fixo__ponto"
              :class="{ 'fixo__ponto--pausado': escuta.fase !== 'gravando' }"
              aria-hidden="true"
            />
            {{
              escuta.fase === 'gravando'
                ? t('clinico.escuta.indicador.ouvindo')
                : t('clinico.escuta.indicador.pausada')
            }}
            <span class="ui-num">{{ rotulosDaEscuta.relogio(escuta.tempoMs) }}</span>
          </span>

          <ProntuarioStepper class="fixo__passos" :passos="passos" :ativo="etapa" mini @ir="irParaEtapa" />

          <Button
            v-if="podeFinalizar"
            type="button"
            size="small"
            class="fixo__finalizar"
            icon="ph ph-check-circle"
            :label="t('clinico.prontuario.finalizar')"
            @click="finalizarAberto = true"
          />
        </div>
      </div>

      <!--
        O painel das etapas: o trilho dos cinco passos num cartão, e no pé dele as ferramentas da
        etapa — o estado da gravação, o microfone fora da anamnese, o teclado e o contexto.
      -->
      <section class="etapas ui-folha">
        <ProntuarioStepper
          id="atendimento-trilho"
          class="trilho"
          :passos="passos"
          :ativo="etapa"
          @ir="irParaEtapa"
        />

        <!-- As ferramentas da etapa: o microfone fora da anamnese, o teclado, o contexto. -->
        <div class="ferramentas">
          <span v-if="estadoDaGravacao" class="gravacao" aria-live="polite">
            <i
              :class="prontuario.salvando ? 'ph ph-circle-notch ph-spin' : 'ph ph-cloud-check'"
              aria-hidden="true"
            />
            {{ estadoDaGravacao }}
          </span>

          <EscutaIndicador
            v-if="gravandoAqui && etapa !== 'anamnese'"
            @voltar="irParaEtapa('anamnese')"
          />

          <div class="ferramentas__fim">
            <!--
              O interruptor fica junto do trilho porque é ali que o modo se manifesta: é o trilho
              que `Alt + →` percorre. Escondido em ajustes, ninguém saberia que existe.
            -->
            <span class="teclado">
              <ToggleSwitch v-model="modoTeclado" :input-id="idModoTeclado" />
              <label :for="idModoTeclado">{{ t('clinico.prontuario.teclado.modo') }}</label>
            </span>

            <button
              type="button"
              class="ferramenta"
              :title="t('clinico.prontuario.teclado.titulo')"
              @click="mapaAberto = true"
            >
              <i class="ph ph-keyboard" aria-hidden="true" />
              {{ t('clinico.prontuario.teclado.verTeclas') }}
            </button>

            <button
              type="button"
              class="ferramenta"
              :aria-pressed="historicoAberto"
              aria-controls="atendimento-contexto"
              @click="historicoAberto = !historicoAberto"
            >
              <i
                :class="historicoAberto ? 'ph ph-sidebar-simple' : 'ph ph-clock-counter-clockwise'"
                aria-hidden="true"
              />
              {{
                historicoAberto
                  ? t('clinico.prontuario.timeline.ocultar')
                  : t('clinico.prontuario.nova.mostrarHistorico')
              }}
            </button>
          </div>
        </div>
      </section>

      <!-- Rascunho encontrado no navegador. Oferta, nunca sobrescrita silenciosa. -->
      <section v-if="prontuario.rascunhoPendente" class="faixa faixa--rascunho" role="status">
        <span class="faixa__icone" aria-hidden="true">
          <i class="ph ph-clock-counter-clockwise" />
        </span>
        <span class="faixa__texto">
          <strong>{{ t('clinico.prontuario.nova.faixa.rascunhoTitulo') }}</strong>
          <span>
            {{
              t('clinico.prontuario.nova.faixa.rascunhoTexto', {
                quando: formato.relativo(prontuario.rascunhoPendente.salvoEm),
              })
            }}
          </span>
        </span>
        <span class="faixa__acoes">
          <Button
            type="button"
            :label="t('clinico.prontuario.descartarRascunho')"
            severity="secondary"
            text
            size="small"
            @click="prontuario.descartarRascunho()"
          />
          <Button
            type="button"
            :label="t('clinico.prontuario.restaurarRascunho')"
            icon="ph ph-arrow-counter-clockwise"
            severity="secondary"
            outlined
            size="small"
            @click="prontuario.restaurarRascunho()"
          />
        </span>
      </section>

      <!-- Leitura por outro dispositivo: com saída explícita, não um beco. -->
      <section
        v-if="prontuario.somenteLeitura && !finalizado"
        class="faixa faixa--leitura"
        role="status"
      >
        <span class="faixa__icone" aria-hidden="true"><i class="ph ph-lock-simple" /></span>
        <span class="faixa__texto">
          <strong>{{ t('clinico.prontuario.nova.faixa.leituraTitulo') }}</strong>
          <span>{{ motivoLeitura }}</span>
        </span>
        <span class="faixa__acoes">
          <Button
            type="button"
            :label="t('clinico.prontuario.assumirEdicao')"
            icon="ph ph-hand-grabbing"
            severity="secondary"
            outlined
            size="small"
            @click="assumirAberto = true"
          />
        </span>
      </section>

      <!-- Finalizado: a tela continua alcançável, e diz na primeira linha que virou leitura. -->
      <section v-if="finalizado" class="faixa faixa--finalizado" role="status">
        <span class="faixa__icone" aria-hidden="true"><i class="ph ph-check-circle" /></span>
        <span class="faixa__texto">
          <strong>{{ t('clinico.prontuario.nova.faixa.finalizadoTitulo') }}</strong>
          <span>{{ t('clinico.prontuario.nova.faixa.finalizadoTexto') }}</span>
        </span>
        <span v-if="etapa !== 'resumo'" class="faixa__acoes">
          <Button
            type="button"
            :label="t('clinico.prontuario.nova.faixa.verResumo')"
            severity="secondary"
            outlined
            size="small"
            @click="irParaEtapa('resumo')"
          />
        </span>
      </section>

      <div class="mesa" :class="{ 'mesa--com-contexto': historicoAberto }">
        <div ref="corpoDaEtapa" class="etapa" :style="{ '--etapa-numero': numeroDaEtapa }">
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
            :motivo-leitura="motivoDaFolha"
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
            :motivo-leitura="motivoDaFolha"
            @atualizar="prontuario.atualizar($event)"
          />

          <ProntuarioDiagnostico
            v-else-if="etapa === 'diagnostico'"
            :valor="encounter.diagnosticos"
            :somente-leitura="prontuario.somenteLeitura"
            :motivo-leitura="motivoDaFolha"
            @atualizar="prontuario.atualizar($event)"
          />

          <ProntuarioConduta
            v-else-if="etapa === 'conduta'"
            :valor="encounter.conduta"
            :pet="prontuario.pet"
            :peso-kg="pesoVigente"
            :somente-leitura="prontuario.somenteLeitura"
            :motivo-leitura="motivoDaFolha"
            @atualizar="prontuario.atualizar($event)"
            @agendar-retorno="agendarRetorno"
          />

          <!--
            Vacinação e receita vivem na conduta, embaixo dela: as duas são o que sai do
            atendimento e vai para a carteira e para o app do responsável. Assinar é o último
            ato do atendimento — numa etapa própria, a receita viraria tarefa esquecida.
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
            @critico="marcarCritico"
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
          <footer class="rodape">
            <button
              v-if="etapaAnterior"
              type="button"
              class="rodape__passo rodape__passo--anterior"
              @click="irParaEtapa(etapaAnterior.id)"
            >
              <i class="ph ph-arrow-left" aria-hidden="true" />
              <span>
                <small>{{ t('clinico.prontuario.nova.rodape.anterior') }}</small>
                <strong>{{ etapaAnterior.rotulo }}</strong>
              </span>
            </button>
            <span v-else />

            <button
              v-if="proximaEtapa"
              type="button"
              class="rodape__passo rodape__passo--proxima"
              @click="irParaEtapa(proximaEtapa.id)"
            >
              <span>
                <small>{{ t('clinico.prontuario.nova.rodape.proxima') }}</small>
                <strong>{{ proximaEtapa.rotulo }}</strong>
              </span>
              <i class="ph ph-arrow-right" aria-hidden="true" />
            </button>
            <Button
              v-else-if="podeFinalizar"
              type="button"
              class="rodape__finalizar"
              :label="t('clinico.prontuario.finalizar')"
              icon="ph ph-check-circle"
              @click="finalizarAberto = true"
            />
          </footer>
        </div>

        <ProntuarioTimeline
          v-show="historicoAberto"
          id="atendimento-contexto"
          class="contexto"
          :eventos="prontuario.timeline"
          :anterior="prontuario.consultaAnterior"
          :rota-completa="`/veterinario/paciente/${encounter.petId}/historico`"
          :compacto="!telaLarga"
          @fechar="historicoAberto = false"
        />
      </div>
    </div>

    <template #sempre>
      <!-- transferência explícita da edição -->
      <Dialog
        v-model:visible="assumirAberto"
        modal
        class="clinic-dialog hc-tema"
        :style="{ width: 'min(30rem, 94vw)' }"
        :aria-labelledby="idAssumir"
        dismissable-mask
      >
        <template #header>
          <ProntuarioDialogoTopo
            :id="idAssumir"
            :titulo="t('clinico.prontuario.assumirDialogo.titulo')"
            :subtitulo="motivoLeitura"
            icone="ph ph-lock-simple-open"
            tom="atencao"
          />
        </template>

        <p class="dialogo__texto">{{ t('clinico.prontuario.assumirDialogo.descricao') }}</p>

        <template #footer>
          <Button
            type="button"
            :label="t('clinico.comum.cancelar')"
            severity="secondary"
            text
            @click="assumirAberto = false"
          />
          <Button
            type="button"
            :label="t('clinico.prontuario.assumirDialogo.confirmar')"
            icon="ph ph-hand-grabbing"
            severity="warn"
            @click="assumir"
          />
        </template>
      </Dialog>

      <!-- finalizar: nomeia o que falta, leva até lá, e ainda assim deixa finalizar -->
      <Dialog
        v-model:visible="finalizarAberto"
        modal
        class="clinic-dialog hc-tema"
        :style="{ width: 'min(32rem, 94vw)' }"
        :aria-labelledby="idFinalizar"
        dismissable-mask
      >
        <template #header>
          <ProntuarioDialogoTopo
            :id="idFinalizar"
            :titulo="t('clinico.prontuario.finalizarDialogo.titulo')"
            :subtitulo="[prontuario.pet?.nome, profissional].filter(Boolean).join(' · ')"
            :icone="pendencias.length > 0 ? 'ph ph-warning-circle' : 'ph ph-check-circle'"
            :tom="pendencias.length > 0 ? 'atencao' : 'ok'"
          />
        </template>

        <div class="dialogo">
          <section v-if="pendencias.length > 0" class="dialogo__faltam">
            <h3>{{ t('clinico.prontuario.nova.finalizar.faltam') }}</h3>
            <ul>
              <li v-for="item in pendencias" :key="item.etapa + item.texto">
                <i class="ph ph-warning-circle" aria-hidden="true" />
                <span>{{ item.texto }}</span>
                <button type="button" class="ui-mais" @click="resolverPendencia(item.etapa)">
                  {{ t('clinico.prontuario.nova.finalizar.ir', { etapa: rotuloDaEtapa(item.etapa) }) }}
                </button>
              </li>
            </ul>
          </section>

          <p v-else class="dialogo__ok">
            <i class="ph ph-check-circle" aria-hidden="true" />
            {{ t('clinico.prontuario.nova.finalizar.tudoCerto') }}
          </p>

          <p class="dialogo__texto">{{ t('clinico.prontuario.nova.finalizar.depois') }}</p>
        </div>

        <template #footer>
          <Button
            type="button"
            :label="t('clinico.prontuario.nova.finalizar.voltar')"
            severity="secondary"
            text
            @click="finalizarAberto = false"
          />
          <Button
            type="button"
            :label="
              pendencias.length > 0
                ? t('clinico.prontuario.finalizarDialogo.confirmar')
                : t('clinico.prontuario.finalizar')
            "
            icon="ph ph-check-circle"
            :severity="pendencias.length > 0 ? 'warn' : undefined"
            @click="finalizar"
          />
        </template>
      </Dialog>

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
    </template>
  </UiPagina>
</template>

<style scoped>
/*
 * A tela inteira escreve em 15 px, e os campos são generosos: 44 px de altura, número e texto no
 * mesmo corpo. É onde o veterinário passa a consulta, e campo apertado é onde o dedo erra.
 *
 * Os tokens de cada componente do PrimeVue são reescritos aqui, e não o `--p-form-field-*`: as
 * variáveis deles já foram resolvidas na raiz, e mudar a de origem aqui embaixo não chegaria.
 */
.atendimento {
  --p-inputtext-padding-y: 10px;
  --p-inputtext-padding-x: 12px;
  --p-textarea-padding-y: 10px;
  --p-textarea-padding-x: 12px;
  --p-select-padding-y: 10px;
  --p-select-padding-x: 12px;
  --p-multiselect-padding-y: 8px;
  --p-multiselect-padding-x: 12px;

  font-size: 15px;
}

.atendimento :deep(.p-inputtext),
.atendimento :deep(.p-textarea),
.atendimento :deep(.p-select-label),
.atendimento :deep(.p-multiselect-label),
.atendimento :deep(.p-inputnumber-input) {
  font-size: 15px;
  line-height: 1.45;
}

.atendimento :deep(.p-textarea) {
  line-height: 1.55;
}

/* Os pequenos (editor de antecedente, tipo do diagnóstico) continuam pequenos. */
.atendimento :deep(.p-inputtext-sm),
.atendimento :deep(.p-select-sm .p-select-label) {
  padding-block: 6px;
  font-size: 14px;
}

/* ------------------------------------------------------------------ alto */

.voltar .ph {
  font-size: 13px;
}

[dir='rtl'] .voltar .ph {
  scale: -1 1;
}

/* A capa ocupa a linha inteira do alto; as ações moram nela. */
.cabeca {
  min-width: 0;
  flex: 1 1 100%;
}

.cabeca__reserva {
  margin: 0;
  color: var(--tinta);
  font-size: 30px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.gravacao {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 6px;
  color: var(--tinta-3);
  font-size: 13.5px;
  white-space: nowrap;
}

.gravacao .ph {
  font-size: 16px;
}

.corpo {
  display: grid;
  gap: 20px;
}

/* ------------------------------------------------------------------ a barra fixa */

.fixo {
  position: sticky;
  z-index: 25;
  top: var(--topo-fixo, 0px);
  height: 0;
  margin-bottom: -18px;
}

.fixo__barra {
  position: absolute;
  top: 8px;
  right: 0;
  left: 0;
  display: flex;
  min-height: 56px;
  align-items: center;
  gap: 12px;
  padding: 8px 10px 8px 12px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  background: color-mix(in oklab, var(--superficie) 94%, transparent);
  box-shadow: var(--sombra-2);
  backdrop-filter: blur(10px);
  opacity: 0;
  transform: translateY(-6px);
  transition:
    opacity var(--pj-tempo-medio) var(--pj-curva-chega),
    transform var(--pj-tempo-medio) var(--pj-curva-chega),
    visibility 0s linear var(--pj-tempo-medio);
  visibility: hidden;
}

.fixo--visivel .fixo__barra {
  opacity: 1;
  transform: none;
  transition:
    opacity var(--pj-tempo-medio) var(--pj-curva-chega),
    transform var(--pj-tempo-medio) var(--pj-curva-chega);
  visibility: visible;
}

.fixo__quem {
  display: grid;
  min-width: 0;
  max-width: 240px;
  flex: 0 0 auto;
  gap: 1px;
  line-height: 1.25;
}

.fixo__nome {
  overflow: hidden;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fixo__meta {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 12.5px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fixo__alertas {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  gap: 6px;
  margin: 0;
  padding: 0;
  overflow: hidden;
  list-style: none;
}

.fixo__alertas .ui-selo {
  min-width: 0;
  flex: 0 1 auto;
}

.fixo__alertas .ui-selo span {
  overflow: hidden;
  text-overflow: ellipsis;
}

.fixo__escuta {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 11px;
  border-radius: 999px;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.fixo__ponto {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--risco);
  animation: pulsar 1.6s ease-in-out infinite;
}

.fixo__ponto--pausado {
  background: var(--neutro-tinta);
  animation: none;
}

@keyframes pulsar {
  50% {
    opacity: 0.35;
  }
}

.fixo__passos {
  flex: none;
  margin-inline-start: auto;
}

.fixo__finalizar {
  flex: none;
}

/* ------------------------------------------------------------------ trilho */

/* O painel das etapas: o trilho em cima, as ferramentas no pé, rentes e tingidas. */
.etapas {
  display: grid;
  min-width: 0;
}

.trilho {
  padding: 14px 14px 12px;
  scroll-margin-top: calc(var(--topo-fixo, 0px) + 76px);
}

.ferramentas {
  display: flex;
  min-height: 52px;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  padding: 6px 12px 6px 20px;
  border-top: 1px solid var(--linha-suave);
  border-radius: 0 0 calc(var(--raio-cartao) - 1px) calc(var(--raio-cartao) - 1px);
  background: color-mix(in oklab, var(--superficie-2) 60%, var(--superficie));
}

.ferramentas__fim {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 6px;
  margin-inline-start: auto;
}

.teclado {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding-inline-end: 8px;
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 500;
}

.teclado label {
  cursor: pointer;
}

.ferramenta {
  display: inline-flex;
  min-height: 36px;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--tinta-2);
  cursor: pointer;
  font: inherit;
  font-size: 13.5px;
  font-weight: 500;
}

.ferramenta .ph {
  font-size: 17px;
}

.ferramenta:hover {
  background: var(--superficie-3);
  color: var(--tinta);
}

.ferramenta[aria-pressed='true'] {
  color: var(--tinta);
}

.ferramenta:focus-visible,
.rodape__passo:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 2px;
}

/* ------------------------------------------------------------------ faixas
 * Uma linha com o disco do ícone, o que aconteceu e a saída. O tom diz de que tipo é: o rascunho
 * é oferta (cor do lugar), a leitura pede atenção, o finalizado é estado neutro.
 */
.faixa {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  padding: 12px 14px 12px 12px;
  border: 1px solid var(--faixa-linha, var(--linha));
  border-radius: 14px;
  background: var(--faixa-fundo, var(--superficie-2));
}

.faixa__icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--superficie);
  color: var(--faixa-tinta, var(--tinta-2));
  font-size: 19px;
}

.faixa__texto {
  display: grid;
  min-width: 0;
  flex: 1 1 280px;
  gap: 2px;
  line-height: 1.4;
}

.faixa__texto strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.faixa__texto span {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.faixa__acoes {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.faixa--rascunho {
  --faixa-fundo: color-mix(in oklab, var(--pj-lugar-fundo) 70%, var(--superficie));
  --faixa-linha: color-mix(in oklab, var(--pj-lugar) 30%, var(--linha));
  --faixa-tinta: var(--pj-lugar-tinta);
}

.faixa--leitura {
  --faixa-fundo: var(--atencao-fundo);
  --faixa-linha: color-mix(in oklab, var(--atencao) 40%, var(--linha));
  --faixa-tinta: var(--atencao-tinta);
}

.faixa--finalizado {
  --faixa-fundo: var(--neutro-fundo);
  --faixa-linha: var(--linha);
  --faixa-tinta: var(--ok-tinta);
}

/* ------------------------------------------------------------------ mesa: folha e contexto */

.mesa {
  display: grid;
  align-items: start;
  gap: 24px;
  grid-template-columns: minmax(0, 1fr);
}

.mesa--com-contexto {
  grid-template-columns: minmax(0, 1fr) 340px;
}

.etapa {
  display: grid;
  min-width: 0;
  gap: 20px;
}

/*
 * A folha da etapa (o `ClinicForm` de anamnese, exame, diagnóstico e conduta) no acabamento de
 * cartão: cabeçalho com o ladrilho do número da etapa — o mesmo do disco no trilho —, um fio
 * suave, e os campos embaixo com respiro. O número vem do `--etapa-numero` (string para `content`).
 */
.etapa :deep(.bloco) {
  gap: 0;
  padding: 0;
  border-radius: var(--raio-cartao);
  box-shadow: var(--sombra-cartao);
}

.etapa :deep(.bloco__cabecalho) {
  align-items: center;
  padding: 18px 22px 16px;
  border-bottom: 1px solid var(--linha-suave);
}

.etapa :deep(.bloco__titulos) {
  position: relative;
  min-height: 40px;
  align-content: center;
  padding-inline-start: 54px;
}

.etapa :deep(.bloco__titulos)::before {
  position: absolute;
  top: 50%;
  display: grid;
  width: 40px;
  height: 40px;
  place-items: center;
  border-radius: 12px;
  background: var(--pj-lugar-fundo, var(--clinica-fundo));
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
  content: var(--etapa-numero, '');
  font-family: var(--font-dados);
  font-size: 17px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  inset-inline-start: 0;
  transform: translateY(-50%);
}

.etapa :deep(.bloco__titulo) {
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.012em;
}

.etapa :deep(.bloco__leitura) {
  margin: 16px 24px 0;
}

.etapa :deep(.bloco__grade) {
  padding: 20px 24px 24px;
}

/*
 * A coluna de contexto acompanha a rolagem: a consulta anterior continua à vista enquanto a
 * conduta desce. Se ela for maior que a janela, rola dentro de si.
 */
.contexto {
  position: sticky;
  top: calc(var(--topo-fixo, 0px) + 80px);
  max-height: calc(100dvh - var(--topo-fixo, 0px) - 96px);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
}

/* Rodapé da etapa: voltar à esquerda, seguir à direita, em botões que dizem para onde. */
.rodape {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 4px;
}

.rodape__passo {
  display: inline-flex;
  min-height: 52px;
  align-items: center;
  gap: 12px;
  padding: 6px 16px;
  border: 1px solid transparent;
  border-radius: 12px;
  background: none;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  text-align: start;
}

.rodape__passo span {
  display: grid;
  line-height: 1.25;
}

.rodape__passo small {
  color: var(--tinta-3);
  font-size: 12.5px;
}

.rodape__passo strong {
  font-size: 15px;
  font-weight: 600;
}

.rodape__passo .ph {
  color: var(--tinta-2);
  font-size: 18px;
}

.rodape__passo--anterior {
  padding-inline-start: 6px;
}

.rodape__passo--anterior:hover {
  background: var(--superficie-2);
}

.rodape__passo--proxima {
  border-color: var(--linha-media);
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
  text-align: end;
}

.rodape__passo--proxima:hover {
  background: var(--superficie-2);
}

[dir='rtl'] .rodape__passo .ph {
  scale: -1 1;
}

/* ------------------------------------------------------------------ diálogos */

.dialogo {
  display: grid;
  gap: 16px;
}

.dialogo__texto {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.55;
}

.dialogo__faltam {
  display: grid;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--atencao-fundo);
}

.dialogo__faltam h3 {
  margin: 0;
  color: var(--atencao-tinta);
  font-size: 14px;
  font-weight: 600;
}

.dialogo__faltam ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dialogo__faltam li {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 8px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
}

.dialogo__faltam li .ph {
  align-self: center;
  color: var(--atencao-tinta);
  font-size: 16px;
}

.dialogo__faltam li span {
  flex: 1 1 12rem;
}

.dialogo__faltam .ui-mais {
  color: var(--clinica-tinta);
  font-size: 13.5px;
}

.dialogo__ok {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 14px 16px;
  border-radius: 12px;
  background: var(--ok-fundo);
  color: var(--ok-tinta);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
}

.dialogo__ok .ph {
  margin-top: 2px;
  font-size: 17px;
}

/* ------------------------------------------------------------------ larguras */

/* A barra fixa abre mão do que menos importa primeiro: os alertas, depois os passos. */
@media (max-width: 1280px) {
  .mesa--com-contexto {
    grid-template-columns: minmax(0, 1fr);
  }

  /* Em tela menor o contexto, quando pedido, vem antes da folha — e não lá embaixo dela. */
  .contexto {
    position: static;
    max-height: none;
    order: -1;
    overflow: visible;
  }

  .fixo__alertas .ui-selo span {
    display: none;
  }
}

@media (max-width: 900px) {
  .fixo__passos,
  .fixo__meta {
    display: none;
  }

  .etapa :deep(.bloco__cabecalho) {
    padding: 16px 16px 14px;
  }

  .etapa :deep(.bloco__grade) {
    padding: 18px 16px 20px;
  }

  .etapa :deep(.bloco__leitura) {
    margin-inline: 16px;
  }

  .ferramentas {
    padding-inline: 10px;
  }

  .fixo__barra {
    gap: 10px;
  }

  .rodape__passo--anterior small,
  .rodape__passo--proxima small {
    display: none;
  }
}

@media (max-width: 560px) {
  /* No celular fica o alerta mais grave — é o que muda a dose —, e só ele. */
  .fixo__alertas li:not(:first-child),
  .fixo__escuta span.ui-num {
    display: none;
  }

  .fixo__alertas .ui-selo span {
    display: inline;
  }

  .fixo__finalizar :deep(.p-button-label) {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .fixo__barra,
  .fixo--visivel .fixo__barra {
    transition: none;
  }

  .fixo__ponto {
    animation: none;
  }
}
</style>
