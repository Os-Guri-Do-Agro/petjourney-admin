<script setup lang="ts">
/**
 * O ícone de interface da casa — fechar, confirmar, navegar, avisar.
 *
 * ## Por que existe, se já havia um conjunto de ícones funcionando
 *
 * O portal usava **dois conjuntos ao mesmo tempo**: PrimeIcons para o cromo e Phosphor para o
 * domínio. Só no módulo do hotel eram 155 usos de um contra 20 do outro, e sete componentes
 * carregavam os dois no mesmo arquivo — a tela da rotina do turno mostra um chevron monoline do
 * PrimeIcons encostado numa gota duotone do Phosphor.
 *
 * Duas famílias de ícone lado a lado não lêem como duas famílias: lêem como descuido. Espessura
 * diferente, raio de canto diferente, peso óptico diferente no mesmo tamanho nominal. É o tipo de
 * incoerência que ninguém sabe nomear ao olhar, mas que faz a tela parecer montada por partes.
 *
 * ## Por que um mapa, e não importar Phosphor direto em cada arquivo
 *
 * Importar direto resolveria a família, mas não o peso: nada impediria um arquivo de usar
 * `weight="regular"` e outro `duotone`, e voltaríamos à mesma incoerência por outro caminho.
 * Aqui o peso é decidido uma vez. E o nome do ícone passa a ser **o que ele significa**, não o
 * que ele desenha: quem escreve `nome="excluir"` não precisa saber que o desenho é uma lixeira,
 * e trocar o desenho depois não obriga a varrer a aplicação.
 *
 * O `Record<NomeDeIcone, Component>` faz o resto: nome fora do mapa é erro de compilação, não
 * quadrado vazio descoberto em produção. E como só se pode nomear o que está aqui, a regra da
 * casa de que **ícone vem de biblioteca e nunca é desenhado à mão** deixa de depender de alguém
 * lembrar dela.
 *
 * ## O custo, dito em voz alta
 *
 * Todos os ícones do mapa entram no bundle de quem importar este componente, mesmo os não usados
 * na página — cerca de 8 KB comprimidos para o conjunto inteiro. Num portal administrativo que já
 * carrega PrimeVue e ApexCharts, é troca barata pela coerência. Se um dia pesar, o caminho é
 * quebrar o mapa por área, não voltar a espalhar importação solta.
 *
 * ## Ícone de domínio não mora aqui
 *
 * Serviço do hotel (refeição, água, passeio) tem casa própria em `IconeDeTarefa.vue`, amarrado ao
 * `TarefaKind`. Aqui é só cromo: o que a interface faz, não o que o negócio é.
 */
import {
  PhArrowClockwise,
  PhArrowCounterClockwise,
  PhArrowDown,
  PhArrowDownLeft,
  PhArrowLeft,
  PhArrowRight,
  PhArrowUp,
  PhArrowUpRight,
  PhBell,
  PhCalculator,
  PhCalendarBlank,
  PhCamera,
  PhCaretDown,
  PhCaretLeft,
  PhCaretRight,
  PhChartBar,
  PhChartLine,
  PhChartPie,
  PhChatCircle,
  PhCheck,
  PhCheckCircle,
  PhClock,
  PhEye,
  PhFastForward,
  PhFilePlus,
  PhFlag,
  PhHourglass,
  PhIdentificationCard,
  PhInfo,
  PhList,
  PhListChecks,
  PhLock,
  PhMinus,
  PhMinusCircle,
  PhPaperPlaneTilt,
  PhPencilSimple,
  PhPhone,
  PhPlus,
  PhPlusCircle,
  PhPower,
  PhProhibit,
  PhShield,
  PhSignIn,
  PhSignOut,
  PhSpinner,
  PhTag,
  PhTimer,
  PhTrash,
  PhUser,
  PhWallet,
  PhWarning,
  PhWarningCircle,
  PhWrench,
  PhX,
  PhXCircle,
} from '@phosphor-icons/vue'
import { computed, type Component } from 'vue'

/**
 * O vocabulário de interface da casa. Nomeado pelo que a ação significa, em português, como o
 * resto do código — `excluir`, não `trash`; `alerta`, não `exclamation-triangle`.
 *
 * Dois nomes podem apontar para o mesmo desenho sem problema (`voltarAcao` e `recarregar` são
 * setas circulares em sentidos opostos, mas `avancarLista` e `proximo` compartilham o mesmo
 * caret): o que importa é que o **call site** diga a intenção, para que trocar o desenho de uma
 * delas depois não arraste a outra junto.
 */
export type NomeDeIcone =
  /* ---------------------------------------------------------------- decisão */
  | 'confirmar'
  | 'confirmarForte'
  | 'recusar'
  | 'recusarForte'
  | 'acrescentar'
  | 'acrescentarForte'
  | 'remover'
  | 'removerForte'
  | 'excluir'
  | 'editar'
  | 'proibir'
  /* ---------------------------------------------------------------- aviso */
  | 'alerta'
  | 'alertaCircular'
  | 'informacao'
  | 'sinalizar'
  | 'notificar'
  /* ---------------------------------------------------------------- navegação */
  | 'proximo'
  | 'anterior'
  | 'expandir'
  | 'avancarLista'
  | 'irPara'
  | 'voltar'
  | 'subir'
  | 'descer'
  | 'entrarNoDetalhe'
  | 'sairDoDetalhe'
  /* ---------------------------------------------------------------- fluxo */
  | 'entrada'
  | 'saida'
  | 'voltarAcao'
  | 'recarregar'
  | 'desligar'
  /* ---------------------------------------------------------------- tempo */
  | 'relogio'
  | 'cronometro'
  | 'ampulheta'
  | 'calendario'
  | 'carregando'
  /* ---------------------------------------------------------------- dados */
  | 'lista'
  | 'listaConferida'
  | 'graficoBarra'
  | 'graficoLinha'
  | 'graficoPizza'
  | 'calcular'
  /* ---------------------------------------------------------------- pessoas e coisas */
  | 'pessoa'
  | 'documento'
  | 'telefone'
  | 'recado'
  | 'enviar'
  | 'carteira'
  | 'etiqueta'
  | 'cadeado'
  | 'protecao'
  | 'ver'
  | 'camera'
  | 'anexar'
  | 'manutencao'

const ICONES: Record<NomeDeIcone, Component> = {
  /* decisão */
  confirmar: PhCheck,
  confirmarForte: PhCheckCircle,
  recusar: PhX,
  recusarForte: PhXCircle,
  acrescentar: PhPlus,
  acrescentarForte: PhPlusCircle,
  remover: PhMinus,
  removerForte: PhMinusCircle,
  excluir: PhTrash,
  /* `PencilSimple` e não `Pencil`: o simples tem o mesmo peso de traço dos demais deste mapa. */
  editar: PhPencilSimple,
  proibir: PhProhibit,

  /* aviso */
  alerta: PhWarning,
  alertaCircular: PhWarningCircle,
  informacao: PhInfo,
  sinalizar: PhFlag,
  notificar: PhBell,

  /* navegação — caret, e não seta: caret é para percorrer, seta é para ir a outro lugar. */
  proximo: PhCaretRight,
  anterior: PhCaretLeft,
  expandir: PhCaretDown,
  avancarLista: PhFastForward,
  irPara: PhArrowRight,
  voltar: PhArrowLeft,
  subir: PhArrowUp,
  descer: PhArrowDown,
  entrarNoDetalhe: PhArrowUpRight,
  sairDoDetalhe: PhArrowDownLeft,

  /* fluxo */
  entrada: PhSignIn,
  saida: PhSignOut,
  /* Anti-horário desfaz; horário refaz. O sentido do giro é a única coisa que os separa. */
  voltarAcao: PhArrowCounterClockwise,
  recarregar: PhArrowClockwise,
  desligar: PhPower,

  /* tempo */
  relogio: PhClock,
  cronometro: PhTimer,
  ampulheta: PhHourglass,
  calendario: PhCalendarBlank,
  carregando: PhSpinner,

  /* dados */
  lista: PhList,
  listaConferida: PhListChecks,
  graficoBarra: PhChartBar,
  graficoLinha: PhChartLine,
  graficoPizza: PhChartPie,
  calcular: PhCalculator,

  /* pessoas e coisas */
  pessoa: PhUser,
  documento: PhIdentificationCard,
  telefone: PhPhone,
  recado: PhChatCircle,
  enviar: PhPaperPlaneTilt,
  carteira: PhWallet,
  etiqueta: PhTag,
  cadeado: PhLock,
  protecao: PhShield,
  ver: PhEye,
  camera: PhCamera,
  anexar: PhFilePlus,
  manutencao: PhWrench,
}

const props = defineProps<{
  nome: NomeDeIcone
  /**
   * O peso sai do padrão só onde o ícone precisa de silhueta cheia para ler pequeno — dentro de
   * um disco colorido, por exemplo. Fora disso, não mexa: o `duotone` uniforme é justamente o que
   * esta casa estava perdendo.
   */
  peso?: 'duotone' | 'fill' | 'bold'
}>()

const icone = computed(() => ICONES[props.nome])
</script>

<template>
  <component :is="icone" class="icone" :weight="peso ?? 'duotone'" aria-hidden="true" />
</template>

<style scoped>
/*
 * Dimensionado em `em` para herdar o `font-size` de quem o contém — era assim que o ícone de
 * fonte do PrimeIcons se comportava, então nenhuma caixa precisa mudar de medida junto com a
 * troca do desenho.
 *
 * O `1.15em` não é arbitrário: o glifo do PrimeIcons ocupava a caixa inteira do `em`, enquanto o
 * SVG do Phosphor deixa margem interna. Sem a compensação, todo ícone da aplicação encolheria
 * visivelmente no dia da troca.
 */
.icone {
  width: 1.15em;
  height: 1.15em;
  flex: 0 0 auto;
}
</style>
