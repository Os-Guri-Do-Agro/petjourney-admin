<script setup lang="ts">
/**
 * Rotina do turno — a prancheta.
 *
 * Esta tela é usada **em pé, com uma mão, no corredor do canil**, e a forma dela vem disso. A hora
 * ordena tudo porque às 8h alguém alimenta os dezoito — a pergunta não é "o que falta para o
 * Thor", é "o que é para agora". O que passou fica recolhido; o que vem depois fica abaixo.
 *
 * ## A pauta e a folha de trabalho
 *
 * A tela mostra **duas coisas em registros diferentes**, e o erro que ela cometeu por muito tempo
 * foi desenhar as duas do mesmo jeito: toda tarefa do dia era um cartão com disco, nome e três
 * botões, das 07:00 às 22:00, para as quarenta e nove. Mas quem está no corredor só tem uma ronda
 * na mão por vez; as outras onze precisa **enxergar**, não executar.
 *
 * Agora o dia é uma **pauta** — uma fileira por ronda, com hora, serviço, quantos, quantos
 * atrasados e o botão de marcar o lote ali mesmo — e só a ronda aberta é **folha de trabalho**,
 * com os animais um por fileira. Quem decide qual é qual é `RONDA_ABRE_ATE`, que já existia e já
 * era testada: ela mudou de emprego, não de valor.
 *
 * Num hotel de cinco, nada nasce fechado e não há um toque a dar antes de trabalhar. Num hotel de
 * quarenta, o bloco das 18:00 deixa de ser 29 caixas e vira duas fileiras.
 *
 * ## Por que não há mais um eixo do tempo desenhado
 *
 * Havia uma calha de 3,6 rem à esquerda, com um chip da hora e um fio descendo. Ela era a única
 * forma que distinguia esta tela das irmãs, e por isso doeu tirá-la — mas cobrava aquela largura
 * de **toda** fileira, o dia inteiro, para desenhar decoração, e no telefone tirava 2,9 rem dos
 * 390 disponíveis justamente do nome do animal. A hora entrou para dentro do cartão da ronda: como
 * todos têm a mesma largura e a hora é tabular na primeira célula, a coluna de horas continua lá —
 * desenhada pelo próprio conteúdo, e não por uma calha vazia.
 */
import { PhCat, PhListChecks } from '@phosphor-icons/vue'
import Button from 'primevue/button'
import Select from 'primevue/select'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import IconeDeTarefa from '@/features/hotel/components/base/IconeDeTarefa.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import CartaoDaPassagem from '@/features/hotel/components/rotina/CartaoDaPassagem.vue'
import GerenciarRotina from '@/features/hotel/components/rotina/GerenciarRotina.vue'
import AcrescentarNaRotina from '@/features/hotel/components/rotina/AcrescentarNaRotina.vue'
import PassagemDialog from '@/features/hotel/components/rotina/PassagemDialog.vue'
import RondaDoHorario from '@/features/hotel/components/rotina/RondaDoHorario.vue'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import {
  hospedesParaRotina,
  rotinaPadraoRepository,
  type HospedeParaRotina,
} from '@/features/hotel/data/repositories'
import type { ItemDeRotina, TarefaKind, TarefaStatus } from '@/features/hotel/data/types'
import type { TempoDaPrancheta } from '@/features/hotel/domain/rotina'
import type { LinhaDaRonda } from '@/features/hotel/components/rotina/ronda-types'
import {
  agruparEmRondas,
  repartirPorTempo,
  RONDA_ABRE_ATE,
  tempoDaTarefa,
} from '@/features/hotel/domain/rotina'
import { useHospedagemStore } from '@/features/hotel/stores/hospedagem'
import { useHotelStore } from '@/features/hotel/stores/hotel'

const { t } = useI18n()
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
      rotulo: t('hotel.rotina.todas'),
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
 * A opção escolhida, inteira — o `#value` do Select recebe só o valor cru, e o que o recolhido
 * precisa mostrar é o ícone e a contagem que moram ao lado dele.
 */
const tipoSelecionado = computed(() =>
  tiposDoDia.value.find((tipo) => tipo.valor === filtroKind.value),
)

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

function emRondas(tempo: TempoDaPrancheta) {
  return repartirPorTempo(blocos.value, tempo, tempoDaLinha).map((bloco) => {
    /*
     * Todas as tarefas daquele horário, e não só as deste tempo: é delas que sai quantas da ronda
     * já foram resolvidas. Sem esse número, quem marca doze de quarenta vê a ronda encolher para
     * vinte e oito sem nada dizendo que as doze foram suas — e num hotel grande é aí que se perde
     * a conta e se marca de novo o que já estava feito.
     *
     * Conta-se **por status**, e não subtraindo o tamanho da lista do total. A subtração dava o
     * mesmo resultado enquanto a lista só tinha pendentes; agora que a marcada fica no lugar, ela
     * passaria a contar como pendente e o número andaria para trás a cada toque.
     */
    const todasDoHorario = blocos.value.find((item) => item.hora === bloco.hora)?.linhas ?? []

    return {
      ...bloco,
      rondas: agruparEmRondas(bloco.hora, bloco.linhas).map((ronda) => ({
        ...ronda,
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

/**
 * A data e, ao lado dela, **qual turno é este e até que horas ele vai**.
 *
 * A tela se chama "Rotina do turno" e não dizia de que turno: o cabeçalho trazia só a data, e as
 * tarefas listadas iam até o fim do dia sem marcar onde acaba a responsabilidade de quem está
 * lendo. Saber que são 14:00–22:00 muda o que se faz com a lista — o passeio das 21:00 é seu, o
 * das 23:00 é de quem entra depois e vai chegar na passagem.
 *
 * Cai no subtítulo que já existe, em vez de virar bloco novo: é a mesma classe de informação que
 * a data, e a data já mora lá.
 */
const subtitulo = computed(() => {
  const data = formato.dataLonga(hospedagem.dia)
  const turno = hospedagem.passagem?.turno

  if (!turno) return data

  const janela = `${formato.hora(turno.inicio)}–${formato.hora(turno.fim)}`

  return `${data} · ${formato.turno(turno.kind)} ${janela}`
})

/** As duas fatias da barra, em porcentagem do dia. O resto da pista é o que ainda vem. */
const fatia = computed(() => {
  const total = hospedagem.prancheta.length || 1

  return {
    feitas: (feitasNoDia.value / total) * 100,
    atrasadas: (hospedagem.atrasadasNaPrancheta / total) * 100,
  }
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
    alvo: '.progresso',
    titulo: t('hotel.tour.rotina.progresso.titulo'),
    texto: t('hotel.tour.rotina.progresso.texto'),
  },
  {
    alvo: '.barra',
    titulo: t('hotel.tour.rotina.filtros.titulo'),
    texto: t('hotel.tour.rotina.filtros.texto'),
  },
  {
    alvo: '.tempo',
    titulo: t('hotel.tour.rotina.tempo.titulo'),
    texto: t('hotel.tour.rotina.tempo.texto'),
  },
  {
    alvo: '.ronda',
    titulo: t('hotel.tour.rotina.ronda.titulo'),
    texto: t('hotel.tour.rotina.ronda.texto'),
  },
  {
    /*
     * Apontava para `.horario`, que era a calha do eixo do tempo e deixou de existir quando a
     * hora entrou para dentro do cartão da ronda. Um passo cujo alvo some é **descartado em
     * silêncio** por `HotelTour` — o tutorial encolheria de seis para cinco passos sem nada
     * ficar vermelho. A fileira da tarefa é o alvo certo: é sobre marcar que este passo fala.
     */
    alvo: '.tarefa',
    titulo: t('hotel.tour.rotina.marcar.titulo'),
    texto: t('hotel.tour.rotina.marcar.texto'),
  },
  {
    /* O roteiro acaba onde o turno acaba, que é o pé da página. */
    alvo: '.fim',
    titulo: t('hotel.tour.rotina.passagem.titulo'),
    texto: t('hotel.tour.rotina.passagem.texto'),
  },
])
</script>

<template>
  <PartnerPageFrame
    :title="t('hotel.rotina.titulo')"
    :subtitle="subtitulo"
    tour
    @tour="tourAberto = true"
    :loading="hospedagem.carregando && hospedagem.prancheta.length === 0"
    :error="hospedagem.erro ? t(hospedagem.erro) : ''"
    :empty="vazio"
    :empty-title="t('hotel.rotina.vazioTitulo')"
    :empty-description="t('hotel.rotina.vazioDescricao')"
    @retry="hospedagem.carregarPrancheta()"
  >
    <div class="tela clinic-scope">
      <div class="rotina">
      <!-- O progresso do dia numa frase e numa pista, e o filtro por tipo. -->
      <div class="barra">
        <div class="progresso">
          <p class="progresso__frase">
            <strong class="clinic-value">{{ feitasNoDia }}</strong>
            {{
              t(
                'hotel.rotina.de',
                { total: hospedagem.prancheta.length },
                hospedagem.prancheta.length,
              )
            }}
            <span v-if="hospedagem.atrasadasNaPrancheta > 0" class="progresso__alerta">
              ·
              {{
                t(
                  'hotel.rotina.atrasadas',
                  { total: hospedagem.atrasadasNaPrancheta },
                  hospedagem.atrasadasNaPrancheta,
                )
              }}
            </span>
          </p>

          <!--
            A pista repete em forma o que a frase diz em número, e é a forma que se lê de longe:
            de relance dá para ver se o dia está em dia. `aria-hidden` porque a frase logo acima
            já anuncia o mesmo — duas leituras seguidas do mesmo fato atrapalham quem ouve.
          -->
          <span class="pista" aria-hidden="true">
            <span class="pista__feitas" :style="{ width: `${fatia.feitas}%` }" />
            <span class="pista__atrasadas" :style="{ width: `${fatia.atrasadas}%` }" />
          </span>
        </div>

        <Select
          v-model="filtroKind"
          :options="tiposDoDia"
          option-label="rotulo"
          option-value="valor"
          :aria-label="t('hotel.rotina.filtroTipo')"
          :pt="{ overlay: { class: 'clinic-overlay' } }"
          class="filtro"
          size="small"
          scroll-height="22rem"
        >
          <!--
            O valor recolhido mostra o mesmo que a linha do painel: ícone, nome e quantos. Sem o
            ícone aqui, abrir a lista trocava a forma do que se estava lendo, e sem a contagem
            quem filtrou por "Refeição" perdia de vista quantas são — que é o número que fez
            escolher aquele filtro.
          -->
          <template #value>
            <span v-if="tipoSelecionado" class="filtro__opcao">
              <IconeDeTarefa
                v-if="tipoSelecionado.kind"
                :kind="tipoSelecionado.kind"
                class="filtro__icone"
              />
              <PhListChecks v-else class="filtro__icone" weight="duotone" aria-hidden="true" />

              <span class="filtro__rotulo">{{ tipoSelecionado.rotulo }}</span>
              <span class="filtro__conta">{{ tipoSelecionado.total }}</span>
            </span>
          </template>

          <!--
            Rótulo, ícone e contagem num invólucro próprio, e não soltos: o painel do Select é
            teleportado para fora da página, então `:deep` a partir daqui não alcança a linha
            dele. O que alcança é o conteúdo do slot, que carrega o atributo de escopo consigo —
            então a fileira é montada dentro do que é meu.
          -->
          <template #option="{ option }">
            <span class="filtro__opcao">
              <IconeDeTarefa v-if="option.kind" :kind="option.kind" class="filtro__icone" />
              <PhListChecks v-else class="filtro__icone" weight="duotone" aria-hidden="true" />

              <span class="filtro__rotulo">{{ option.rotulo }}</span>
              <span class="filtro__conta">{{ option.total }}</span>
            </span>
          </template>
        </Select>
      </div>

      <!-- ------------------------------------------------------------ para agora -->
      <section v-if="agora.length > 0" class="tempo tempo--agora">
        <h2 class="tempo__titulo">
          <i class="pi pi-clock" aria-hidden="true" />
          {{ t('hotel.rotina.paraAgora') }}
        </h2>

        <ul class="pauta">
          <template v-for="bloco in agora" :key="bloco.hora">
            <RondaDoHorario
              v-for="ronda in bloco.rondas"
              :key="ronda.chave"
              :kind="ronda.kind"
              :hora="bloco.hora"
              :linhas="ronda.linhas"
              :resolvidas="ronda.resolvidas"
              :blocos="hotelStore.blocoPorId"
              :aberta="rondaAberta(ronda.chave, ronda.linhas.length)"
              :salvando="hospedagem.salvando"
              @alternar="alternarRonda(ronda.chave, ronda.linhas)"
              @marcar="marcar"
              @marcar-todas="marcarRonda"
            />
          </template>
        </ul>
      </section>

      <!--
        O momento em que não há nada pendente é o único da tela em que ninguém está com pressa, e
        é o único que pode ser bonito sem atrapalhar. Um gato grande e macio em vez do ícone de
        confirmação de sempre: a tela passa a ter um lugar onde respira.
      -->
      <p v-else class="emDia">
        <PhCat class="emDia__bicho" weight="duotone" aria-hidden="true" />
        {{ t('hotel.rotina.tudoEmDia') }}
      </p>

      <!-- ------------------------------------------------------------ mais tarde -->
      <section v-if="adiante.length > 0" class="tempo">
        <h2 class="tempo__titulo tempo__titulo--calmo">
          <i class="pi pi-forward" aria-hidden="true" />
          {{ t('hotel.rotina.maisTarde') }}
        </h2>

        <ul class="pauta">
          <template v-for="bloco in adiante" :key="bloco.hora">
            <!-- Onde o turno acaba. Daqui para baixo a lista é de quem assume, e isso muda o que
                 quem está lendo agora precisa planejar. -->
            <li v-if="bloco.hora === primeiroDepoisDoTurno" class="fronteira">
              <i class="pi pi-sign-out" aria-hidden="true" />
              {{ t('hotel.rotina.depoisDoTurno', { hora: fimDoTurno }) }}
            </li>

            <RondaDoHorario
              v-for="ronda in bloco.rondas"
              :key="ronda.chave"
              :kind="ronda.kind"
              :hora="bloco.hora"
              :linhas="ronda.linhas"
              :resolvidas="ronda.resolvidas"
              :blocos="hotelStore.blocoPorId"
              :aberta="rondaAberta(ronda.chave, ronda.linhas.length)"
              :salvando="hospedagem.salvando"
              @alternar="alternarRonda(ronda.chave, ronda.linhas)"
              @marcar="marcar"
              @marcar-todas="marcarRonda"
            />
          </template>
        </ul>
      </section>

      <!-- ------------------------------------------------------------ o que já passou -->
      <section v-if="passado.length > 0" class="tempo">
        <button type="button" class="recolhido" @click="mostrarPassado = !mostrarPassado">
          <i
            :class="mostrarPassado ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"
            aria-hidden="true"
          />
          {{ t('hotel.rotina.jaPassou', { total: passado.length }, passado.length) }}
        </button>

        <ul v-if="mostrarPassado" class="pauta pauta--passado">
          <template v-for="bloco in passado" :key="bloco.hora">
            <RondaDoHorario
              v-for="ronda in bloco.rondas"
              :key="ronda.chave"
              :kind="ronda.kind"
              :hora="bloco.hora"
              :linhas="ronda.linhas"
              :resolvidas="ronda.resolvidas"
              :blocos="hotelStore.blocoPorId"
              :aberta="rondaAberta(ronda.chave, ronda.linhas.length)"
              :salvando="hospedagem.salvando"
              @alternar="alternarRonda(ronda.chave, ronda.linhas)"
              @marcar="marcar"
              @marcar-todas="marcarRonda"
            />
          </template>
        </ul>
      </section>

      <!--
        O fim do turno fecha a prancheta, que é onde ele de fato acontece: quem trabalha o turno
        inteiro nesta tela precisa ver o que trava a entrega muito antes das 22h.
      -->
        <CartaoDaPassagem
          :passagem="hospedagem.passagem"
          :cuidadores="hotelStore.cuidadores"
          @passar="passagemAberta = true"
        />
      </div>

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
        @medicacao="recarregarHospedes(); medicacaoAberta = true"
        @descartar="hospedagem.proposta = null"
        @aprovar="aprovarProposta"
      />
    </div>

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

    <template #actions>
      <!--
        O `span` não é embrulho à toa: o slot `#actions` renderiza noutro ramo da árvore, fora da
        `div.clinic-scope` da página, e sem ele o botão caía no tema cru — rótulo a 3,30:1, que
        reprova, e borda a 1,07:1, que é borda nenhuma. Era esta a causa de ele parecer apagado.
      -->
      <span class="clinic-scope clinic-acoes">
        <Button
          :label="t('hotel.turno.passar')"
          class="acao-turno"
          icon="pi pi-sign-out"
          severity="secondary"
          outlined
          size="small"
          @click="passagemAberta = true"
        />
      </span>
    </template>
  </PartnerPageFrame>
</template>

<style scoped>
/*
 * Duas colunas: o que está acontecendo, e o que se pode mudar.
 *
 * A largura voltou a ser a da página inteira, e a medida de leitura saiu. Ela existia para
 * resolver um vazio à direita — a pauta é uma lista de coluna única e não tinha o que fazer com
 * 1500 px. Agora tem: a segunda coluna é o gerenciamento, e ela ocupa exatamente o espaço que
 * antes sobrava. O problema se resolveu por conteúdo, não por teto.
 *
 * `28rem` fixos à direita, e não uma fração: o painel tem largura de leitura própria, e crescer
 * junto com o monitor faria a coluna de horários dele se esparramar. Quem cresce é a pauta.
 *
 * `align-items: start` para que a coluna da direita possa grudar — item de grade esticado nunca
 * gruda, porque já ocupa a altura toda e não chega ao limite que dispara o `sticky`.
 */
.tela {
  display: grid;
  align-items: start;
  gap: var(--clinic-space-5);
  grid-template-columns: minmax(0, 1fr) 28rem;
}

/*
 * O ponto de corte é 1400 px, e o número vem de uma conta, não de gosto.
 *
 * A coluna da direita custa 28 rem fixos, o trilho de navegação leva perto de 290 px, e as folgas
 * somam mais 60. Para a pauta ainda ter os ~620 px em que a fileira de tarefa funciona — disco,
 * nome, e os três botões na mesma linha —, a janela precisa de cerca de 1400.
 *
 * Com o corte em 1100, a faixa entre 1100 e 1400 entregava duas colunas com a pauta em 320 px: o
 * "Pular" subia por cima do selo "Atrasada" e a fileira virava um bolo. O detalhe que engana é que
 * a media query mede a **janela**, e quem ficou estreita foi a **coluna** — a regra de 620 px da
 * fileira nunca disparava, porque a janela continuava larga.
 */
@media (max-width: 1400px) {
  .tela {
    grid-template-columns: minmax(0, 1fr);
  }
}

.rotina {
  display: grid;
  min-width: 0;
  gap: var(--clinic-space-4);
}

/*
 * O topo é um cartão, como em todas as telas irmãs do módulo.
 *
 * Eram dois objetos soltos sobre o fundo da página, um encostado em cada ponta de uma barra sem
 * largura máxima — com quase 950 px de nada entre a frase do dia e o filtro. Dentro de um cartão
 * de 52 rem, o mesmo `space-between` deixa de ser um buraco e vira folga interna.
 */
.barra {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
}

/*
 * A pista não cresce sem limite. Sem a largura de base, ela é o único item elástico da barra e
 * viraria uma fita de mil pixels num monitor largo — e uma barra de progresso muito longa deixa
 * de ser lida de relance, que é a única coisa que ela sabe fazer.
 */
.progresso {
  display: grid;
  min-width: 14rem;
  flex: 0 1 26rem;
  gap: 0.35rem;
}

.progresso__frase {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-body);
}

.progresso__frase strong {
  margin-inline-end: 0.2rem;
  color: var(--clinic-text);
  font-size: 1.3rem;
  font-weight: 700;
}

.progresso__alerta {
  color: var(--clinic-risk-text);
  font-weight: 700;
}

/* ------------------------------------------------------------------ a pista do dia */

.pista {
  display: flex;
  overflow: hidden;
  height: 0.4rem;
  border-radius: 0.2rem;
  background: var(--clinic-surface-sunken);
}

.pista__feitas {
  background: var(--clinic-accent-deep);
}

.pista__atrasadas {
  background: var(--clinic-risk-text);
}

/* ------------------------------------------------------------------ o filtro */

/*
 * Um Select recolhido, e não uma barra de seis segmentos.
 *
 * A barra ocupava 566 px do topo e pesava mais que a lista que filtra. E filtrar é ação rara
 * aqui: o que se faz nesta tela é marcar tarefa. Recolhido, o controle sai do caminho e o topo
 * volta a ser a frase do dia; o preço são dois toques em vez de um, cobrados só de quem filtra.
 *
 * De quebra some um efeito colateral que a barra tinha: em fileira única ela fixava um piso de
 * largura que, por ser irmã da lista na mesma grade, virava a largura de toda a tela — num
 * telefone de 420 px a prancheta saía com 566 e era cortada.
 */
.filtro {
  width: 15.5rem;
}

.filtro__opcao {
  display: flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: var(--clinic-space-2);
}

/*
 * O ícone tem tamanho próprio aqui, e não o do disco das tarefas: numa fileira de lista ele
 * acompanha o texto, não uma pastilha. A classe pousa na raiz do componente do ícone, e o
 * atributo de escopo vai junto — por isso o seletor alcança mesmo com o painel teleportado.
 */
/* Sem cor própria: o ícone herda a do rótulo que acompanha, como o resto do módulo. */
.filtro__icone {
  width: 1.15rem;
  height: 1.15rem;
  flex: 0 0 auto;
}

/* O rótulo estica e empurra a contagem para a borda: a coluna de números fica alinhada. */
.filtro__rotulo {
  overflow: hidden;
  flex: 1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Quantas são, de cada tipo: é o que decide se vale a pena filtrar antes de filtrar. */
.filtro__conta {
  color: var(--clinic-faint);
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

/* ------------------------------------------------------------------ tempos */

.tempo {
  display: grid;
  gap: var(--clinic-space-2);
}

/*
 * O rótulo da seção atravessa a largura inteira.
 *
 * Ele é o nível mais alto da tela e era o texto mais fraco dela: 11 px em caixa alta disputando
 * com chips verdes cheios e com itens em negrito dois níveis abaixo. Crescer não resolveria — um
 * rótulo de seção grande rouba o lugar do conteúdo.
 *
 * O que o torna o nível mais alto é ser **o único elemento que vai de ponta a ponta**: o texto à
 * esquerda e um filete correndo até a borda da coluna. É o mesmo idioma que a régua da fronteira
 * do turno já usa nesta página, e ali ele já tinha sido aprovado.
 */
.tempo__titulo {
  display: flex;
  align-items: center;
  margin: 0;
  gap: 0.4rem;
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tempo__titulo::after {
  height: 1px;
  flex: 1;
  background: var(--tempo-regua, var(--clinic-line));
  content: '';
}

/* O que não é "agora" fala mais baixo — inclusive a régua. */
.tempo__titulo--calmo {
  --tempo-regua: var(--clinic-line-soft);

  color: var(--clinic-faint);
}

.emDia {
  display: grid;
  justify-items: center;
  margin: 0;
  padding: var(--clinic-space-6) var(--clinic-space-5);
  border: 1px solid var(--clinic-line-strong);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-4);
  background: var(--clinic-surface);
  color: var(--clinic-accent-strong);
  font-weight: 700;
  text-align: center;
}

/*
 * O gato é **grande**, e é o único lugar da tela onde algo tem licença para ser.
 *
 * Nasceu com 2,6 rem, que é tamanho de ícone de aviso — e o comentário que o introduziu prometia
 * "um gato grande e macio". Em 2,6 rem o `duotone` do Phosphor não se lê: o preenchimento por
 * baixo do contorno vira uma mancha, e o desenho perde justamente a maciez que o fez ser escolhido.
 *
 * Crescer aqui não custa nada ao trabalho. Este bloco só existe quando **não há uma única tarefa
 * pendente** — é o único instante em que ninguém está com pressa, e o único em que a tela pode
 * respirar sem atrapalhar. Nas outras 49 tarefas do dia ele não aparece.
 */
.emDia__bicho {
  width: 7.5rem;
  height: 7.5rem;
}

/* No telefone ele encolhe, mas continua sendo a primeira coisa que se vê. */
@media (max-width: 620px) {
  .emDia {
    padding: var(--clinic-space-5) var(--clinic-space-4);
  }

  .emDia__bicho {
    width: 5.5rem;
    height: 5.5rem;
  }
}

/* ------------------------------------------------------------------ a pauta do turno */

/*
 * A pauta: um cartão de ronda por fileira, e a hora **dentro** de cada um.
 *
 * Aqui existia uma calha de 3,6 rem à esquerda, com um chip verde da hora e um fio descendo até o
 * horário seguinte — o eixo do tempo desenhado. Ele saiu, e a hora virou a primeira célula do
 * cartão (ver `RondaDoHorario`).
 *
 * A calha cobrava a mesma largura de **toda** fileira, o dia inteiro, para desenhar decoração; no
 * telefone cobrava 2,9 rem dos 390 disponíveis, roubando-os justamente do nome do animal. E ela
 * não saiu barata: as duas notas que moravam aqui documentavam dois defeitos que ela mesma
 * produzia — a linha cortada a 420 px de largura e os 220 px de chip verde esticado ao lado das
 * tarefas. Sem coluna elástica e sem item de grade que possa esticar, os dois ficam
 * estruturalmente impossíveis.
 *
 * A coluna de horas não se perdeu: como todo cartão tem a mesma largura e a hora é tabular na
 * primeira célula, os dígitos caem uns sobre os outros de fileira em fileira. Quem desenha a
 * coluna agora é o conteúdo, e não uma calha vazia.
 */
.pauta {
  display: grid;
  gap: var(--clinic-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

/*
 * A fronteira do turno: uma régua com a frase no meio, não um cartão.
 *
 * Cartão pesaria como se fosse mais uma tarefa, e não é tarefa nenhuma — é uma mudança de dono
 * da lista. Régua é o que se usa para dizer "daqui para lá é outra coisa" sem pedir a vez.
 */
.fronteira {
  display: flex;
  align-items: center;
  margin-block: var(--clinic-space-2);
  gap: 0.45rem;
  color: var(--clinic-outro-turno);
  font-size: var(--clinic-font-label);
  font-weight: 400;
}

.fronteira::after {
  height: 1px;
  flex: 1;
  background: var(--clinic-outro-turno-line);
  content: '';
}

/*
 * O que já passou fala mais baixo pelos próprios tokens, não por transparência.
 *
 * Havia um `opacity: 0.75` aqui. Ele empilhava perda de contraste sobre um conteúdo que já estava
 * no piso — o cinza apagado do resolvido — e levava junto o que não devia apagar, como o selo de
 * uma recusa. O passado já se anuncia pelo texto riscado e pela cor do disco.
 */
.recolhido {
  display: flex;
  align-items: center;
  justify-self: start;
  padding: 0.25rem 0;
  border: 0;
  gap: 0.4rem;
  background: transparent;
  color: var(--clinic-faint);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.recolhido:hover {
  color: var(--clinic-accent-strong);
}

@media (max-width: 720px) {
  /*
   * No telefone os cartões encostam nas bordas da coluna e a folga entre eles encolhe: o que
   * sobrava para a calha do eixo volta inteiro para o texto das fileiras.
   */
  .pauta {
    gap: var(--clinic-space-2);
  }
}
</style>
