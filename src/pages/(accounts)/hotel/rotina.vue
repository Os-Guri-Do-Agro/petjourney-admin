<script setup lang="ts">
/**
 * Rotina do turno — a prancheta.
 *
 * Esta tela é usada **em pé, com uma mão, no corredor do canil**, e a forma dela vem disso. A hora
 * ordena tudo porque às 8h alguém alimenta os dezoito — a pergunta não é "o que falta para o
 * Thor", é "o que é para agora".
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * A prancheta é uma **linha do tempo do turno**, irmã do checklist da internação: a hora à
 * esquerda, um trilho com um nó por horário colorido pela situação, e o trabalho à direita.
 *
 * 1. **Para agora** no topo: o que está na hora ou já passou dela, do mais antigo ao mais novo.
 * 2. O **fio do agora**, com a hora, separando o que é da vez do que ainda vem.
 * 3. **Mais tarde hoje**, com a fronteira do turno desenhada no trilho: daqui para baixo, é de
 *    quem assume.
 * 4. **Já resolvido**, recolhido no pé, a um toque.
 *
 * Cada horário reúne as rondas dele: o mesmo serviço para vários animais vira uma ronda, com uma
 * linha por animal e o botão de marcar todos de uma vez. Ao lado (embaixo, no telefone), o fim do
 * turno, a rotina padrão da casa e o gerenciamento da rotina de um hóspede.
 *
 * A fita da casa não aparece aqui de propósito: esta tela já é o dia hora a hora.
 */
import { PhCat } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import IconeDeTarefa from '@/features/hotel/components/base/IconeDeTarefa.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import CartaoDaPassagem from '@/features/hotel/components/rotina/CartaoDaPassagem.vue'
import GerenciarRotina from '@/features/hotel/components/rotina/GerenciarRotina.vue'
import AcrescentarNaRotina from '@/features/hotel/components/rotina/AcrescentarNaRotina.vue'
import HorarioDaPrancheta from '@/features/hotel/components/rotina/HorarioDaPrancheta.vue'
import PassagemDialog from '@/features/hotel/components/rotina/PassagemDialog.vue'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import {
  hospedesParaRotina,
  rotinaPadraoRepository,
  type HospedeParaRotina,
} from '@/features/hotel/data/repositories'
import type { ItemDeRotina, TarefaKind, TarefaStatus } from '@/features/hotel/data/types'
import type { TempoDaPrancheta } from '@/features/hotel/domain/rotina'
import type { EstadoDoHorario, LinhaDaRonda } from '@/features/hotel/components/rotina/ronda-types'
import {
  agruparEmRondas,
  repartirPorTempo,
  RONDA_ABRE_ATE,
  tempoDaTarefa,
} from '@/features/hotel/domain/rotina'
import { useHospedagemStore } from '@/features/hotel/stores/hospedagem'
import { useHotelStore } from '@/features/hotel/stores/hotel'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'

const { t, locale } = useI18n()
const router = useRouter()
const formato = useHotelFormat()
const hotelStore = useHotelStore()
const hospedagem = useHospedagemStore()

const passagemAberta = ref(false)

/*
 * O gerenciamento de rotina, a partir da prancheta.
 *
 * Cadastro não entra nesta tela — ela é usada em pé, com uma mão, no corredor. O que entra é a
 * **porta**: registrar o remédio que acabou de chegar e pedir uma proposta são coisas que
 * acontecem enquanto a pessoa está aqui, com o animal na frente. O cadastro dos horários da casa
 * mora na tela `/hotel/rotina-padrao`, e o cartão só leva até lá.
 */
const medicacaoAberta = ref(false)
const propostaAberta = ref(false)
const hospedeEscolhido = ref('')
const hospedes = ref<HospedeParaRotina[]>([])
const rotinaDaCasa = ref<ItemDeRotina[]>([])

function recarregarHospedes() {
  hospedes.value = hospedesParaRotina()
}

async function escolherParaProposta(id: string) {
  hospedeEscolhido.value = id

  if (id) await hospedagem.proporRotina(id)
}

async function aprovarProposta(payload: Parameters<typeof hospedagem.aprovarProposta>[0]) {
  if (await hospedagem.aprovarProposta(payload)) {
    propostaAberta.value = false
    recarregarHospedes()
  }
}

/*
 * As quatro portas de acrescentar algo à rotina de um hóspede. Cada uma grava por um caminho
 * diferente — dose, ajuste, venda, cuidado —, e todas fecham o diálogo só quando a gravação deu
 * certo: fechar antes esconderia o erro que a pessoa precisa ler.
 */
/** Abre as quatro portas de acrescentar, com a lista de hóspedes relida. */
function abrirAcrescentar() {
  recarregarHospedes()
  medicacaoAberta.value = true
}

async function registrarMedicacao(payload: Parameters<typeof hospedagem.registrarMedicacao>[0]) {
  if (await hospedagem.registrarMedicacao(payload)) {
    medicacaoAberta.value = false
  }
}

async function registrarCuidado(payload: Parameters<typeof hospedagem.registrarCuidado>[0]) {
  if (await hospedagem.registrarCuidado(payload)) {
    medicacaoAberta.value = false
  }
}

async function acrescentarServico(payload: Parameters<typeof hospedagem.acrescentarServico>[0]) {
  if (await hospedagem.acrescentarServico(payload)) {
    medicacaoAberta.value = false
  }
}

async function registrarAjuste(payload: Parameters<typeof hospedagem.registrarAjuste>[0]) {
  if (await hospedagem.registrarAjuste(payload)) {
    medicacaoAberta.value = false
    recarregarHospedes()
  }
}

const filtroKind = ref<TarefaKind | 'todas'>('todas')
const mostrarPassado = ref(false)

const KINDS: TarefaKind[] = [
  'refeicao',
  'medicacao',
  'passeio',
  'higiene',
  'agua',
  /* Os serviços vendidos: quem vai dar o banho da tarde filtra por banho e desce a lista. */
  'banho',
  'tosa',
  'recreacao',
  'adestramento',
]

onMounted(async () => {
  await hospedagem.carregarPrancheta()
  await hospedagem.carregarPassagem()
  recarregarHospedes()
  rotinaDaCasa.value = (await rotinaPadraoRepository.atual()).itens
})

watch(
  () => hotelStore.revisao,
  () => void hospedagem.carregarPrancheta(),
)

/**
 * O filtro oferece **só os tipos que existem hoje**, com quantos são.
 *
 * Os nove tipos fixos davam nove botões de peso igual ocupando 739 px de barra — medido na tela —,
 * e num dia comum quatro deles não têm uma única tarefa: ninguém contratou adestramento, e mesmo
 * assim "Adestramento" disputava espaço com "Refeição". Espremidos, os rótulos encostavam uns nos
 * outros e a fileira virava uma tira de texto corrido.
 *
 * O primeiro item é "Todas", escrito. Antes o estado "sem filtro" era a ausência de seleção — e
 * ausência de seleção não é um lugar que se saiba como alcançar; quem filtrou por banho ficava
 * procurando o botão de voltar.
 *
 * No redesenho o filtro voltou a ser uma fileira de botões, agora curtos (ícone, nome, quantos):
 * só os tipos do dia cabem numa linha, e filtrar passou a custar um toque em vez de dois. No
 * telefone a fileira rola de lado, dentro dela mesma.
 */
const tiposDoDia = computed(() => {
  const contagem = new Map<TarefaKind, number>()

  for (const linha of hospedagem.prancheta) {
    contagem.set(linha.tarefa.kind, (contagem.get(linha.tarefa.kind) ?? 0) + 1)
  }

  return [
    {
      valor: 'todas' as const,
      /* `kind` nulo é o que diz à linha para desenhar a lista em vez do ícone de um serviço. */
      kind: null,
      rotulo: t('hotel.rotina.nova.todas'),
      total: hospedagem.prancheta.length,
    },
    ...KINDS.filter((kind) => contagem.has(kind)).map((kind) => ({
      valor: kind,
      kind,
      rotulo: formato.tarefaKind(kind),
      total: contagem.get(kind) ?? 0,
    })),
  ]
})

/*
 * Se o tipo filtrado sumir do dia — a última medicação foi marcada, a prancheta recarregou —, o
 * filtro volta para "Todas". Sem isto a tela fica vazia apontando para um botão que não existe
 * mais, e parece defeito de carregamento.
 */
watch(tiposDoDia, (tipos) => {
  if (!tipos.some((tipo) => tipo.valor === filtroKind.value)) {
    filtroKind.value = 'todas'
  }
})

const blocos = computed(() =>
  hospedagem.blocosDaPrancheta.map((bloco) => ({
    ...bloco,
    linhas:
      filtroKind.value === 'todas'
        ? bloco.linhas
        : bloco.linhas.filter((linha) => linha.tarefa.kind === filtroKind.value),
  })),
)

/*
 * Os três tempos da prancheta, cada horário já repartido em rondas. As duas regras moram no
 * domínio, junto dos testes que as guardam — ver `repartirPorTempo` e `agruparEmRondas`.
 */
/**
 * O que foi marcado **nesta sessão** e onde estava quando foi marcado.
 *
 * Sem isto, marcar uma tarefa dentro de uma ronda aberta a manda na hora para "já passou": a
 * fileira evapora sob o dedo, as de baixo sobem, e o toque seguinte cai no animal errado. Quem
 * serve vinte comedouros perde o lugar vinte vezes, e o "Desfazer" — que `TarefaLinha` promete
 * barato — passa a exigir abrir outra seção para achar o que sumiu.
 *
 * Fica na tela e não no domínio de propósito: a regra do relógio continua sendo a única verdade
 * sobre onde uma tarefa pertence. Isto é uma cortesia de rolagem, com a validade de uma sessão.
 * Solta-se quando a ronda fecha (o trabalho dela acabou) ou quando o filtro muda (a lista é outra).
 */
const retidas = ref(new Map<string, TempoDaPrancheta>())

function tempoDaLinha(linha: LinhaDaRonda): TempoDaPrancheta {
  return retidas.value.get(linha.tarefa.id) ?? tempoDaTarefa(linha.situacao)
}

function reter(tarefaId: string, status: TarefaStatus) {
  const proxima = new Map(retidas.value)

  /* Desfazer devolve a tarefa ao trabalho: o relógio volta a mandar nela imediatamente. */
  if (status === 'pendente') {
    proxima.delete(tarefaId)
  } else if (!proxima.has(tarefaId)) {
    const linha = blocos.value
      .flatMap((bloco) => bloco.linhas)
      .find((item) => item.tarefa.id === tarefaId)

    if (!linha) return

    proxima.set(tarefaId, tempoDaTarefa(linha.situacao))
  }

  retidas.value = proxima
}

function liberar(linhas: LinhaDaRonda[]) {
  if (!linhas.some((linha) => retidas.value.has(linha.tarefa.id))) return

  const proxima = new Map(retidas.value)

  for (const linha of linhas) proxima.delete(linha.tarefa.id)

  retidas.value = proxima
}

/* Trocar o filtro troca a lista inteira: não há lugar a guardar. */
watch(filtroKind, () => {
  retidas.value = new Map()
})

/**
 * A distância do horário até agora, para ler sem fazer conta: "há 40 min", "em 2 h". Passada a
 * primeira hora, arredonda para a hora cheia — "em 4 h 19 min" quebrava a coluna e não ajuda a
 * decidir nada que "em 4 h" não ajude.
 */
function distancia(instante: string): string {
  const minutos = Math.round((Date.parse(instante) - Date.parse(hospedagem.agora)) / 60_000)
  const absoluto = Math.abs(minutos)

  if (absoluto < 1) return t('hotel.formato.agora')

  const valor =
    absoluto < 60
      ? t('hotel.formato.minutos', { valor: absoluto })
      : t('hotel.formato.horas', { valor: Math.round(absoluto / 60) })

  return minutos < 0 ? t('hotel.formato.haTempo', { valor }) : t('hotel.formato.emTempo', { valor })
}

/**
 * O estado de um horário, que é a cor do nó no trilho: a pior das pendentes manda. Remédio
 * atrasado é o único atraso em vermelho; o resto atrasado é âmbar; o que está na hora vai na cor do
 * hotel; o que já foi todo resolvido apaga.
 */
function estadoDoHorario(linhas: LinhaDaRonda[]): EstadoDoHorario {
  const pendentes = linhas.filter((linha) => linha.tarefa.status === 'pendente')
  const atrasadas = pendentes.filter((linha) => linha.situacao === 'atrasada')

  if (atrasadas.some((linha) => linha.tarefa.kind === 'medicacao')) return 'remedio'
  if (atrasadas.length > 0) return 'atrasada'
  if (pendentes.some((linha) => linha.situacao === 'na-janela')) return 'janela'

  return pendentes.length === 0 ? 'feita' : 'futura'
}

function emRondas(tempo: TempoDaPrancheta) {
  return repartirPorTempo(blocos.value, tempo, tempoDaLinha).map((bloco) => {
    /*
     * Todas as tarefas daquele horário, e não só as deste tempo: é delas que sai quantas da ronda
     * já foram resolvidas. Sem esse número, quem marca doze de quarenta vê a ronda encolher para
     * vinte e oito sem nada dizendo que as doze foram suas.
     *
     * Conta-se **por status**, e não subtraindo o tamanho da lista do total: a marcada fica no
     * lugar, e pela subtração ela passaria a contar como pendente.
     */
    const todasDoHorario = blocos.value.find((item) => item.hora === bloco.hora)?.linhas ?? []
    const quando = bloco.linhas[0]?.tarefa.previstaPara ?? ''

    return {
      ...bloco,
      quando,
      distancia: quando ? distancia(quando) : '',
      estado: estadoDoHorario(bloco.linhas),
      rondas: agruparEmRondas(bloco.hora, bloco.linhas).map((ronda) => ({
        ...ronda,
        aberta: rondaAberta(ronda.chave, ronda.linhas.length),
        resolvidas: todasDoHorario.filter(
          (linha) => linha.tarefa.kind === ronda.kind && linha.tarefa.status !== 'pendente',
        ).length,
      })),
    }
  })
}

const agora = computed(() => emRondas('agora'))
const adiante = computed(() => emRondas('adiante'))
const passado = computed(() => emRondas('passado'))

const feitasNoDia = computed(
  () => hospedagem.prancheta.filter((linha) => linha.tarefa.status !== 'pendente').length,
)

/** Quantas do tempo ainda estão por fazer: a contagem ao lado do título de cada seção. */
function pendentesEm(tempo: typeof agora.value) {
  return tempo
    .flatMap((bloco) => bloco.linhas)
    .filter((linha) => linha.tarefa.status === 'pendente').length
}

const pendentesAgora = computed(() => pendentesEm(agora.value))
const pendentesAdiante = computed(() => pendentesEm(adiante.value))

/** O que já passou, recolhido: quantas foram resolvidas e desde que horas. */
const resolvidasAntes = computed(() => ({
  total: passado.value.reduce((soma, bloco) => soma + bloco.linhas.length, 0),
  desde: passado.value[0]?.hora ?? '',
}))

/** A hora de agora, para o fio que atravessa a linha do tempo. */
const horaDeAgora = computed(() => formato.hora(hospedagem.agora))

/**
 * O resumo da tela, em três frases curtas: o dia, o turno com quem está nele, e o quanto do dia
 * já foi feito. Saber que são 14:00–22:00 muda o que se faz com a lista — o passeio das 21:00 é
 * seu, o das 23:00 é de quem entra depois e vai chegar na passagem.
 */
const dataDeHoje = computed(() => {
  const longa = formato.dataLonga(hospedagem.dia)

  return longa.charAt(0).toLocaleUpperCase(INTL_LOCALE[locale.value as Locale]) + longa.slice(1)
})

const fraseDoTurno = computed(() => {
  const turno = hospedagem.passagem?.turno

  if (!turno) return ''

  const partes = {
    turno: formato.turno(turno.kind),
    horario: `${formato.hora(turno.inicio)}–${formato.hora(turno.fim)}`,
  }
  const plantonista = hotelStore.cuidador(turno.responsavelId)

  return plantonista
    ? t('clinico.internacao.nova.resumo.plantaoCom', { ...partes, nome: plantonista.nome })
    : t('clinico.internacao.nova.resumo.plantao', partes)
})

const fraseDoProgresso = computed(() => {
  const total = hospedagem.prancheta.length
  const feitas = t('hotel.rotina.nova.progresso', { feitas: feitasNoDia.value, total }, total)
  const atrasadas = hospedagem.atrasadasNaPrancheta

  return atrasadas > 0
    ? `${feitas} ${t('hotel.rotina.nova.atrasadas', { total: atrasadas }, atrasadas)}`
    : feitas
})

/**
 * O horário em que o turno acaba, e o primeiro bloco de "mais tarde" que já cai fora dele.
 *
 * "Mais tarde hoje" vai até a meia-noite, mas o turno não. Sem a fronteira desenhada, quem lê a
 * lista às 13h vê o passeio das 16:00 como coisa sua e planeja o resto da tarde em cima de uma
 * tarefa que vai entregar na passagem. A régua está em `HH:MM` porque é a mesma forma das
 * etiquetas do eixo, e nesse formato comparar texto é comparar hora.
 */
const fimDoTurno = computed(() =>
  hospedagem.passagem ? formato.hora(hospedagem.passagem.turno.fim) : '',
)

const primeiroDepoisDoTurno = computed(() =>
  fimDoTurno.value
    ? (adiante.value.find((bloco) => bloco.hora >= fimDoTurno.value)?.hora ?? '')
    : '',
)

const vazio = computed(
  () => !hospedagem.carregando && !hospedagem.erro && hospedagem.prancheta.length === 0,
)

async function marcar(payload: { tarefaId: string; status: TarefaStatus }) {
  /* Retém **antes** de gravar: depois da gravação a linha já mudou de situação e o tempo original
     se perdeu. */
  reter(payload.tarefaId, payload.status)

  await hospedagem.marcarTarefa(payload.tarefaId, payload.status)
}

/**
 * Marca de uma vez as tarefas de uma ronda.
 *
 * Existe porque o trabalho real acontece em ronda: às 08:00 alguém serve os comedouros todos e só
 * depois pega o telefone. Marcar vinte linhas uma a uma, em pé, é a razão de a prancheta ser
 * preenchida de memória no fim do turno — e prancheta preenchida de memória não vale nada.
 *
 * O lote é **da ronda, não do horário**. A primeira versão marcava tudo de um horário: às 18:00,
 * com a casa cheia, isso eram 29 tarefas de dois tipos num toque — e num horário com medicação,
 * marcaria medicação junto. Ronda é um serviço só, que é o escopo que a pessoa de fato executou.
 *
 * Só marca "feita", nunca "recusou" nem "pulou": recusa é observação de um animal específico e
 * não é coisa que se aplique em lote. E vai uma por vez, parando na primeira que falhar, porque
 * disparar vinte em paralelo deixaria a lista num estado que ninguém consegue reler no corredor —
 * metade marcada, metade não, sem dizer qual metade.
 */
async function marcarRonda(ids: string[]) {
  for (const id of ids) {
    reter(id, 'feita')

    if (!(await hospedagem.marcarTarefa(id, 'feita'))) return
  }
}

/**
 * Quais rondas estão abertas.
 *
 * O mapa guarda **só o que alguém decidiu**; o resto responde pelo tamanho, via `RONDA_ABRE_ATE`.
 * Guardar o estado de todas faria a tela nascer com quarenta entradas iguais e perder a regra que
 * a torna útil nos dois tamanhos de hotel.
 */
const rondasAbertas = ref(new Map<string, boolean>())

function rondaAberta(chave: string, tamanho: number) {
  return rondasAbertas.value.get(chave) ?? tamanho <= RONDA_ABRE_ATE
}

/**
 * Abre ou fecha, e **fechar solta o que estava retido**.
 *
 * Fechar uma ronda é dizer "acabei com esta": as marcadas que ficavam à vista só para não sumirem
 * sob o dedo já não têm trabalho a proteger, e descem para "já passou", que é onde pertencem.
 * Sem isto elas ficariam penduradas na seção errada até alguém recarregar a página.
 */
function alternarRonda(chave: string, linhas: LinhaDaRonda[]) {
  const abrindo = !rondaAberta(chave, linhas.length)

  rondasAbertas.value = new Map(rondasAbertas.value).set(chave, abrindo)

  if (!abrindo) liberar(linhas)
}

async function entregarTurno(nota: string, recebidoPor: string) {
  if (await hospedagem.entregarTurno(nota, recebidoPor)) {
    passagemAberta.value = false
  }
}
/**
 * O tutorial desta tela, na ordem em que se lê a página.
 *
 * Os passos ficam aqui, e não num catálogo central, porque cada um carrega um seletor do próprio
 * template: separá-los faria o roteiro apontar para uma classe renomeada sem ninguém notar.
 */
const tourAberto = ref(false)

const passosDoTour = computed<PassoDoTour[]>(() => [
  {
    titulo: t('hotel.tour.rotina.pergunta.titulo'),
    texto: t('hotel.tour.rotina.pergunta.texto'),
  },
  {
    alvo: '.frase-do-turno',
    titulo: t('hotel.tour.rotina.progresso.titulo'),
    texto: t('hotel.tour.rotina.progresso.texto'),
  },
  {
    alvo: '.filtros',
    titulo: t('hotel.tour.rotina.filtros.titulo'),
    texto: t('hotel.tour.rotina.filtros.texto'),
  },
  {
    alvo: '.linha-do-tempo',
    titulo: t('hotel.rotina.nova.tour.tempo.titulo'),
    texto: t('hotel.rotina.nova.tour.tempo.texto'),
  },
  {
    /* A ronda de vários animais, e não a linha sozinha: é dela que este passo fala. */
    alvo: '.ronda--varios',
    titulo: t('hotel.rotina.nova.tour.ronda.titulo'),
    texto: t('hotel.rotina.nova.tour.ronda.texto'),
  },
  {
    alvo: '.tarefa',
    titulo: t('hotel.tour.rotina.marcar.titulo'),
    texto: t('hotel.tour.rotina.marcar.texto'),
  },
  {
    alvo: '.fim',
    titulo: t('hotel.tour.rotina.passagem.titulo'),
    texto: t('hotel.rotina.nova.tour.passagem.texto'),
  },
  {
    alvo: '.painel',
    titulo: t('hotel.rotina.nova.tour.gerenciar.titulo'),
    texto: t('hotel.rotina.nova.tour.gerenciar.texto'),
  },
])
</script>

<template>
  <UiPagina
    :carregando="hospedagem.carregando && hospedagem.prancheta.length === 0"
    :erro="hospedagem.erro ? t(hospedagem.erro) : ''"
    :vazio="vazio"
    :vazio-titulo="t('hotel.rotina.vazioTitulo')"
    :vazio-descricao="t('hotel.rotina.vazioDescricao')"
    vazio-icone="ph ph-list-checks"
    tour
    @tour="tourAberto = true"
    @tentar-de-novo="hospedagem.carregarPrancheta()"
  >
    <template #resumo>
      <span class="frase-do-turno">
        <time :datetime="hospedagem.dia">{{ dataDeHoje }}</time
        >{{ '. ' }}
        <template v-if="fraseDoTurno">{{ fraseDoTurno }}{{ ' ' }}</template>
        <span v-if="hospedagem.prancheta.length > 0" aria-live="polite">
          {{ fraseDoProgresso }}
        </span>
      </span>
    </template>

    <!-- Passar o turno é o rito com que esta tela se fecha: a ação cheia dela. -->
    <template #acoes>
      <Button
        type="button"
        class="acao-turno"
        icon="ph ph-arrows-left-right"
        :label="t('hotel.turno.passar')"
        @click="passagemAberta = true"
      />
    </template>

    <div class="rotina">
      <div class="rotina__grade">
        <div class="prancheta">
          <!-- O filtro por tipo: só os tipos que existem hoje, com quantos são. -->
          <div class="filtros" role="group" :aria-label="t('hotel.rotina.filtroTipo')">
            <button
              v-for="tipo in tiposDoDia"
              :key="tipo.valor"
              type="button"
              class="filtro"
              :class="{ 'filtro--ativo': filtroKind === tipo.valor }"
              :aria-pressed="filtroKind === tipo.valor"
              @click="filtroKind = tipo.valor"
            >
              <IconeDeTarefa v-if="tipo.kind" :kind="tipo.kind" class="filtro__icone" />
              <i v-else class="ph ph-list-checks filtro__icone" aria-hidden="true" />
              <span>{{ tipo.rotulo }}</span>
              <span class="filtro__conta ui-num">{{ tipo.total }}</span>
            </button>
          </div>

          <!-- ------------------------------------------------------------ para agora -->
          <UiSecao
            id="rotina-agora"
            class="linha-do-tempo"
            :titulo="t('hotel.rotina.paraAgora')"
            :contagem="pendentesAgora"
            icone="ph ph-clock"
          >
            <ol v-if="agora.length > 0" class="tempo ui-folha">
              <HorarioDaPrancheta
                v-for="bloco in agora"
                :key="bloco.hora"
                :hora="bloco.hora"
                :quando="bloco.quando"
                :distancia="bloco.distancia"
                :estado="bloco.estado"
                :rondas="bloco.rondas"
                :blocos="hotelStore.blocoPorId"
                :salvando="hospedagem.salvando"
                @alternar="alternarRonda"
                @marcar="marcar"
                @marcar-todas="marcarRonda"
              />

              <!-- Sem nada mais tarde, o fio do agora fecha a lista do que é da vez. -->
              <li v-if="adiante.length === 0" class="agora" aria-hidden="true">
                <span class="agora__rotulo ui-num">
                  {{ t('hotel.rotina.nova.agora', { hora: horaDeAgora }) }}
                </span>
                <span class="agora__fio" />
              </li>
            </ol>

            <!--
            O momento em que não há nada pendente é o único da tela em que ninguém está com pressa,
            e o único que pode ser bonito sem atrapalhar: um gato grande e macio.
          -->
            <div v-else class="em-dia ui-folha">
              <PhCat class="em-dia__bicho" weight="duotone" aria-hidden="true" />
              <p>{{ t('hotel.rotina.tudoEmDia') }}</p>
            </div>
          </UiSecao>

          <!-- ------------------------------------------------------------ mais tarde -->
          <UiSecao
            v-if="adiante.length > 0"
            id="rotina-adiante"
            :titulo="t('hotel.rotina.maisTarde')"
            :contagem="pendentesAdiante"
            icone="ph ph-fast-forward"
          >
            <ol class="tempo ui-folha">
              <!-- O fio do agora: daqui para baixo, ainda não é a hora. -->
              <li class="agora agora--topo">
                <span class="agora__rotulo ui-num">
                  {{ t('hotel.rotina.nova.agora', { hora: horaDeAgora }) }}
                </span>
                <span class="agora__fio" aria-hidden="true" />
              </li>

              <template v-for="bloco in adiante" :key="bloco.hora">
                <!--
                Onde o turno acaba, desenhado no trilho. Daqui para baixo a lista é de quem assume,
                e isso muda o que quem está lendo agora precisa planejar.
              -->
                <li v-if="bloco.hora === primeiroDepoisDoTurno" class="fronteira">
                  <span class="fronteira__hora ui-hora">{{ fimDoTurno }}</span>
                  <span class="fronteira__trilho" aria-hidden="true">
                    <i class="ph ph-sign-out" />
                  </span>
                  <span class="fronteira__texto">
                    {{ t('hotel.rotina.depoisDoTurno', { hora: fimDoTurno }) }}
                  </span>
                </li>

                <HorarioDaPrancheta
                  adiante
                  :hora="bloco.hora"
                  :quando="bloco.quando"
                  :distancia="bloco.distancia"
                  :estado="bloco.estado"
                  :rondas="bloco.rondas"
                  :blocos="hotelStore.blocoPorId"
                  :salvando="hospedagem.salvando"
                  @alternar="alternarRonda"
                  @marcar="marcar"
                  @marcar-todas="marcarRonda"
                />
              </template>
            </ol>
          </UiSecao>

          <!-- ------------------------------------------------------------ o que já passou -->
          <section v-if="passado.length > 0" class="passado">
            <button
              type="button"
              class="recolhido"
              :aria-expanded="mostrarPassado"
              aria-controls="rotina-passado"
              @click="mostrarPassado = !mostrarPassado"
            >
              <i class="ph ph-check-circle recolhido__icone" aria-hidden="true" />
              <span class="recolhido__texto">
                {{
                  t(
                    'hotel.rotina.nova.resolvidas',
                    { total: resolvidasAntes.total, desde: resolvidasAntes.desde },
                    resolvidasAntes.total,
                  )
                }}
              </span>
              <span class="recolhido__acao">
                {{ mostrarPassado ? t('hotel.rotina.nova.ocultar') : t('hotel.rotina.nova.ver') }}
                <i
                  class="ph"
                  :class="mostrarPassado ? 'ph-caret-up' : 'ph-caret-down'"
                  aria-hidden="true"
                />
              </span>
            </button>

            <ol v-if="mostrarPassado" id="rotina-passado" class="tempo ui-folha">
              <HorarioDaPrancheta
                v-for="bloco in passado"
                :key="bloco.hora"
                :hora="bloco.hora"
                :quando="bloco.quando"
                :distancia="bloco.distancia"
                :estado="bloco.estado"
                :rondas="bloco.rondas"
                :blocos="hotelStore.blocoPorId"
                :salvando="hospedagem.salvando"
                @alternar="alternarRonda"
                @marcar="marcar"
                @marcar-todas="marcarRonda"
              />
            </ol>
          </section>
        </div>

        <!-- Ao lado em tela larga, embaixo no telefone: o fim do turno e o que se pode mudar. -->
        <div class="lateral">
          <CartaoDaPassagem
            :passagem="hospedagem.passagem"
            :cuidadores="hotelStore.cuidadores"
            @passar="passagemAberta = true"
          />

          <GerenciarRotina
            :rotina-da-casa="rotinaDaCasa"
            :hospedes="hospedes"
            :hospedagem-id="hospedeEscolhido"
            :proposta="hospedagem.proposta"
            :gerando="hospedagem.gerandoProposta"
            :salvando="hospedagem.salvando"
            :erro="hospedagem.erroDeAcao"
            @atualizar:hospedagem-id="escolherParaProposta"
            @propor="escolherParaProposta(hospedeEscolhido)"
            @medicacao="abrirAcrescentar"
            @descartar="hospedagem.proposta = null"
            @aprovar="aprovarProposta"
          />
        </div>
      </div>
    </div>

    <template #sempre>
      <PassagemDialog
        :aberto="passagemAberta"
        :passagem="hospedagem.passagem"
        :cuidadores="hotelStore.cuidadores"
        :salvando="hospedagem.salvando"
        :erro="hospedagem.erroDeAcao"
        @fechar="passagemAberta = false"
        @entregar="({ nota, recebidoPor }) => entregarTurno(nota, recebidoPor)"
        @ir-para="(id) => router.push(`/hotel/hospedagem/${id}`)"
      />

      <AcrescentarNaRotina
        :aberto="medicacaoAberta"
        :hospedes="hospedes"
        :hospedagem-id="hospedeEscolhido"
        :rotina-da-casa="rotinaDaCasa"
        :servicos="hotelStore.servicos"
        :hoje="hospedagem.dia"
        :salvando="hospedagem.salvando"
        :erro="hospedagem.erroDeAcao ? t(hospedagem.erroDeAcao) : ''"
        @fechar="medicacaoAberta = false"
        @medicacao="registrarMedicacao"
        @cuidado="registrarCuidado"
        @servico="acrescentarServico"
        @ajuste="registrarAjuste"
      />

      <HotelDevPanel />

      <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />
    </template>
  </UiPagina>
</template>

<style scoped>
/*
 * Duas colunas quando a página é larga: o que está acontecendo, e o que se pode mudar.
 *
 * Quem decide é a largura **da página**, e não a da janela: com a barra aberta ou recolhida, a
 * mesma janela entrega larguras diferentes, e a linha do tempo precisa dos ~620 px em que a linha
 * de tarefa cabe com o rosto, o nome e os três botões. A coluna da direita tem largura própria;
 * quem cresce é a prancheta.
 */
.rotina {
  container-type: inline-size;
}

.rotina__grade {
  display: grid;
  align-items: start;
  gap: 28px;
  grid-template-columns: minmax(0, 1fr);
}

@container (min-width: 1000px) {
  .rotina__grade {
    grid-template-columns: minmax(0, 1fr) 340px;
  }
}

.prancheta {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 28px;
}

.lateral {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 20px;
}

/* ------------------------------------------------------------------ o filtro */

/*
 * Uma fileira de botões curtos. No telefone ela rola de lado, dentro dela mesma — a página nunca
 * rola na horizontal.
 */
.filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 -8px;
  padding: 2px;
}

@container (max-width: 640px) {
  .filtros {
    flex-wrap: nowrap;
    margin-inline: -16px;
    padding-inline: 16px;
    overflow-x: auto;
    scrollbar-width: none;
  }
}

.filtros::-webkit-scrollbar {
  display: none;
}

.filtro {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 8px;
  height: 38px;
  padding: 0 12px 0 10px;
  border: 1px solid var(--linha);
  border-radius: 999px;
  background: var(--superficie);
  color: var(--tinta-2);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.filtro:hover {
  border-color: var(--linha-media);
  color: var(--tinta);
}

.filtro:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--hotel));
  outline-offset: 2px;
}

.filtro {
  box-shadow: var(--sombra-xs);
  transition:
    background-color var(--pj-tempo-curto) var(--pj-curva-chega),
    border-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.filtro--ativo {
  border-color: color-mix(in oklab, var(--pj-lugar, var(--hotel)) 60%, transparent);
  background: var(--pj-lugar-fundo, var(--hotel-fundo));
  color: var(--pj-lugar-tinta, var(--hotel-tinta));
  font-weight: 600;
}

.filtro__icone {
  width: 18px;
  height: 18px;
  font-size: 17px;
}

.filtro__conta {
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--superficie-3);
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 650;
  text-align: center;
}

.filtro--ativo .filtro__conta {
  background: var(--superficie);
  color: var(--pj-lugar-tinta, var(--hotel-tinta));
}

/* ------------------------------------------------------------------ a linha do tempo */

/*
 * As três colunas da linha do tempo — a hora, o trilho e o trabalho — são declaradas aqui, uma vez,
 * e lidas pelos horários, pelo fio do agora e pela fronteira do turno: é o que faz os três
 * cruzarem o trilho no mesmo ponto.
 */
.tempo {
  --col-hora: 72px;
  --col-trilho: 20px;
  --vao-col: 10px;

  display: grid;
  container: tempo / inline-size;
  margin: 0;
  padding-block: 4px;
  padding-inline: 16px 4px;
  list-style: none;
}

/* ----------------------------------------------------------------- o agora */

.agora {
  display: grid;
  align-items: center;
  margin: 10px 0;
  grid-template-columns:
    calc(var(--col-hora) + var(--vao-col) + var(--col-trilho) / 2)
    minmax(0, 1fr);
}

.agora__rotulo {
  justify-self: end;
  margin-inline-end: 10px;
  padding: 3px 9px;
  border-radius: 999px;
  background: var(--hotel);
  color: var(--superficie);
  font-size: 12.5px;
  font-weight: 650;
  white-space: nowrap;
}

.agora__fio {
  position: relative;
  height: 2px;
  margin-inline-end: 12px;
  border-radius: 2px;
  background: var(--hotel);
}

.agora__fio::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--hotel);
  box-shadow: 0 0 0 4px var(--hotel-fundo);
  content: '';
  transform: translate(-50%, -50%);
}

[dir='rtl'] .agora__fio::before {
  right: 0;
  left: auto;
  transform: translate(50%, -50%);
}

/* ----------------------------------------------------------------- a fronteira do turno */

.fronteira {
  display: grid;
  align-items: center;
  column-gap: var(--vao-col);
  grid-template-columns: var(--col-hora) var(--col-trilho) minmax(0, 1fr);
}

.fronteira__hora {
  color: var(--tinta-2);
  font-size: 15px;
}

.fronteira__trilho {
  position: relative;
  display: grid;
  height: 100%;
  min-height: 52px;
  place-items: center;
}

.fronteira__trilho::before {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  margin-left: -1px;
  background: var(--linha);
  content: '';
}

.fronteira__trilho i {
  position: relative;
  display: grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border: 1px solid var(--linha-forte);
  border-radius: 50%;
  background: var(--superficie);
  color: var(--tinta-2);
  font-size: 13px;
}

.fronteira__texto {
  margin-inline-end: 12px;
  padding: 8px 12px;
  border: 1px dashed var(--linha-forte);
  border-radius: var(--raio-controle);
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.4;
}

/* ----------------------------------------------------------------- em dia */

.em-dia {
  display: grid;
  justify-items: center;
  gap: 12px;
  padding: 28px 24px 32px;
  color: var(--tinta-2);
  text-align: center;
}

.em-dia p {
  max-width: 44ch;
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 550;
  line-height: 1.45;
}

/* O gato é grande: é o único lugar da tela onde algo tem licença para ser. */
.em-dia__bicho {
  width: 96px;
  height: 96px;
  color: var(--hotel);
}

/* ----------------------------------------------------------------- o já resolvido */

.passado {
  display: grid;
  gap: 12px;
}

.recolhido {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 52px;
  padding: 8px 18px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-cartao);
  background: var(--superficie);
  box-shadow: var(--sombra-cartao);
  color: var(--tinta-2);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  text-align: start;
}

.recolhido:hover {
  background: var(--superficie-2);
}

.recolhido:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--hotel));
  outline-offset: 2px;
}

.recolhido__icone {
  color: var(--ok-tinta);
  font-size: 19px;
}

.recolhido__texto {
  flex: 1;
}

.recolhido__acao {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta);
  font-weight: 600;
}

/* ----------------------------------------------------------------- estreito */

@container (max-width: 580px) {
  .tempo {
    padding-inline-start: 6px;
  }
}

@container tempo (max-width: 560px) {
  .agora {
    column-gap: 8px;
    grid-template-columns: var(--col-trilho) minmax(0, 1fr);
  }

  .agora__rotulo {
    grid-column: 2;
    grid-row: 1;
    justify-self: start;
    margin: 0;
    margin-inline-start: 4px;
    position: relative;
    z-index: 1;
  }

  .agora__fio {
    grid-column: 1 / -1;
    grid-row: 1;
    margin-inline-start: calc(var(--col-trilho) / 2);
  }

  .fronteira {
    grid-template-columns: var(--col-trilho) minmax(0, 1fr);
  }

  .fronteira__hora {
    display: none;
  }
}
</style>
