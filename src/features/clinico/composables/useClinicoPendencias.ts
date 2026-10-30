/**
 * Quanto trabalho está parado atrás de cada tela do módulo clínico.
 *
 * O menu clínico tem dez destinos, e até aqui todos pareciam igualmente vazios: para saber se
 * havia alguém esperando na fila, uma dose atrasada na internação ou um rascunho sem fecho, era
 * preciso **abrir as dez telas**. Quem opera a clínica fazia essa ronda várias vezes por dia, e
 * era ela — não a quantidade de telas — que fazia o fluxo parecer confuso: o menu não dizia onde
 * estava o trabalho, só onde ele *poderia* estar.
 *
 * Este composable responde a pergunta uma vez e empresta a resposta para o menu inteiro.
 *
 * ## Por que é singleton de módulo, e não uma store
 *
 * O consumidor é o **shell**, que vive acima do router e monta uma vez só. Uma store por
 * componente recarregaria a contagem a cada troca de página — cinco chamadas mocadas a cada
 * clique de menu, para reescrever os mesmos quatro números. Aqui a carga acontece uma vez e é
 * refeita apenas quando o módulo avisa que o mundo mudou (`invalidarPendenciasClinicas`), que é
 * exatamente quando um desses números pode ter mudado: uma dose marcada, uma alta, um
 * atendimento fechado.
 *
 * ## Por que nada aqui é importado no topo
 *
 * Este arquivo é lido pelo menu do portal, que existe para **toda** conta — inclusive as que não
 * têm o módulo clínico ligado. Um `import` estático de `../data/repositories` arrastaria o
 * dataset inteiro de demonstração (pacientes, agenda, internação, bulário) para o primeiro
 * carregamento de todo mundo, para calcular quatro números que a maioria das contas nunca vê. O
 * `import()` dentro da função mantém isso onde já estava: no pedaço do módulo clínico, baixado
 * quando o módulo é aberto.
 *
 * ## O que entra na contagem
 *
 * Só o que **alguém precisa fazer**, nunca o que meramente existe. "38 atendimentos hoje" não é
 * pendência, é rotina; "2 doses atrasadas" é. Um contador que soma rotina ensina a ignorar
 * contador — e aí ele deixa de funcionar justamente no dia em que o número importa.
 *
 * Cada número aparece em **um lugar só**. O rascunho de prontuário é pendência de Atividades e
 * não também de Prontuários: o mesmo trabalho contado duas vezes faz a clínica procurar duas
 * vezes e achar uma.
 */

import { computed, ref, watch } from 'vue'

import {
  consultar,
  criarReconferencia,
  situacaoPelasFontes,
  type SituacaoDaConferencia,
} from '@/composables/conferencia'

/** Gravidade do contador — a mesma escada de tom do resto do módulo. */
export type TomDePendencia = 'neutro' | 'atencao' | 'risco'

/**
 * Um pedaço do total, com nome próprio: "1 boletim retido", "2 administrações atrasadas".
 *
 * O selo do menu mostra só o total; a visão geral mostra também de que ele é feito, porque "2 itens
 * a resolver na internação · Urgente" obrigava a clicar para saber qual dos dois era urgente.
 * `chave` é o nome da frase no catálogo (`inicio.pauta.parte.<chave>`), nunca texto pronto.
 */
export type ParteDePendencia = {
  chave: string
  total: number
}

export type ContagemDePendencia = {
  total: number
  tom: TomDePendencia
  /** De que o total é feito. Só as partes que existem — zero não vira parte. */
  partes?: ParteDePendencia[]
}

/** As partes que existem, na ordem em que foram dadas (a de maior gravidade primeiro). */
export function partesQueExistem(partes: ParteDePendencia[]): ParteDePendencia[] {
  return partes.filter((parte) => parte.total > 0)
}

const VAZIO: ContagemDePendencia = { total: 0, tom: 'neutro' }

const fila = ref<ContagemDePendencia>(VAZIO)
/**
 * Pedidos de horário do app e do link esperando a recepção. Atenção enquanto estão no prazo;
 * risco quando o prazo prometido ao responsável passou — do outro lado alguém leu "respondemos em
 * até 4 h" e está esperando.
 */
const pedidos = ref<ContagemDePendencia>(VAZIO)
const internacao = ref<ContagemDePendencia>(VAZIO)
const atividades = ref<ContagemDePendencia>(VAZIO)
const vacinas = ref<ContagemDePendencia>(VAZIO)
/**
 * Tratamentos críticos cuja adesão caiu em casa. Risco, e não atenção: do outro lado há um animal
 * cardiopata sem o diurético há dois dias, e ninguém na clínica sabe — é o mesmo raciocínio do
 * boletim retido.
 */
const tratamentos = ref<ContagemDePendencia>(VAZIO)
/**
 * Vacinas abaixo do mínimo — o que falta comprar. Atenção, e não risco: a geladeira vazia cancela a
 * consulta de amanhã, não a de agora, e a compra ainda dá tempo.
 */
const estoque = ref<ContagemDePendencia>(VAZIO)
/**
 * Pacientes com falta ainda sem motivo: cada um é uma ligação a fazer. Conta paciente, não falta,
 * como o recorte "A justificar" e a frase do topo da tela. Atenção, e não risco: ninguém está
 * esperando do outro lado; é a apuração que fica para trás.
 */
const faltas = ref<ContagemDePendencia>(VAZIO)

const carregando = ref(false)
const carregado = ref(false)
/**
 * Quando a última conferência que **deu certo** terminou — a visão geral diz "conferido às 8h12".
 * Uma conferência que falhou inteira não mexe aqui: a hora continua dizendo de quando são os
 * números que estão na tela.
 */
const conferidoEm = ref<Date | null>(null)
/** Como foi a última conferência. `null` enquanto nenhuma terminou. */
const situacao = ref<SituacaoDaConferencia | null>(null)

/** Uma carga por vez. Sem isto, cinco páginas montando juntas disparariam cinco rondas. */
let emVoo: Promise<void> | null = null

async function apurar() {
  const [
    {
      encounterRepository,
      internacaoRepository,
      patientRepository,
      tratamentoRepository,
      vacinaRepository,
      waitlistRepository,
    },
    { retornosVencidos },
    { clinicClock },
    { pedidoRepository },
    { agruparPedidos, situacaoDoPrazo },
  ] = await Promise.all([
    import('../data/repositories'),
    import('../domain/follow-up'),
    import('../stores/clinico'),
    import('../data/agendamento-online'),
    import('../domain/pedidos'),
  ])

  const [entradas, mapa, rascunhos, retornos, chamada, emCasa, geladeira, abertos, ausencias] =
    await Promise.all([
      consultar(() => waitlistRepository.listar()),
      consultar(() => internacaoRepository.mapa()),
      consultar(() => encounterRepository.listarRascunhos(null)),
      consultar(() => encounterRepository.listarRetornosPendentes()),
      consultar(() => vacinaRepository.listaDeChamada()),
      consultar(() => tratamentoRepository.daClinica()),
      consultar(() => vacinaRepository.estoque()),
      consultar(() => pedidoRepository.pendentes()),
      consultar(() => patientRepository.resumoDeFaltas()),
    ])

  /*
   * Cada contador só é reescrito quando **todas** as fontes dele responderam. Os demais ficam com o
   * último valor conhecido: Atividades depende da fila (vagas ofertadas), e uma fila que não
   * respondeu não pode zerar a contagem de rascunhos que respondeu.
   */
  if (entradas.ok) {
    const aguardando = entradas.valor.filter((entrada) => entrada.status === 'aguardando').length
    fila.value = { total: aguardando, tom: 'neutro' }
  }

  if (abertos.ok) {
    /* Conta o envio, não o pet: os dois pets da mesma casa são um pedido só para quem responde. */
    const grupos = agruparPedidos(abertos.valor)
    const agora = clinicClock.nowIso()
    const atrasados = grupos.filter(
      (grupo) => situacaoDoPrazo(grupo[0]!, agora) === 'atrasado',
    ).length

    pedidos.value = {
      total: grupos.length,
      tom: atrasados > 0 ? 'risco' : grupos.length > 0 ? 'atencao' : 'neutro',
      partes: partesQueExistem([
        { chave: 'pedidosAtrasados', total: atrasados },
        { chave: 'pedidosNoPrazo', total: grupos.length - atrasados },
      ]),
    }
  }

  if (mapa.ok) {
    const atrasadas = (mapa.valor?.leitos ?? []).reduce((soma, item) => soma + item.atrasadas, 0)
    const retidos = mapa.valor?.boletinsRetidos ?? 0

    /*
     * Boletim retido é risco e dose atrasada é atenção — a ordem não é de gravidade clínica, é de
     * quem está esperando. A dose atrasada espera a enfermagem, que está no corredor; o boletim
     * retido espera uma ligação que **ninguém sabe que precisa dar**, e do outro lado há um
     * responsável sem notícia do animal dele.
     */
    internacao.value = {
      total: atrasadas + retidos,
      tom: retidos > 0 ? 'risco' : atrasadas > 0 ? 'atencao' : 'neutro',
      partes: partesQueExistem([
        { chave: 'boletinsRetidos', total: retidos },
        { chave: 'administracoesAtrasadas', total: atrasadas },
      ]),
    }
  }

  if (entradas.ok && rascunhos.ok && retornos.ok) {
    const ofertadas = entradas.valor.filter((entrada) => entrada.status === 'ofertado').length
    const vencidos = retornosVencidos(retornos.valor, clinicClock, clinicClock.today()).length
    const pendencias = rascunhos.valor.length + vencidos + ofertadas

    atividades.value = {
      total: pendencias,
      tom: pendencias > 0 ? 'atencao' : 'neutro',
      partes: partesQueExistem([
        { chave: 'rascunhos', total: rascunhos.valor.length },
        { chave: 'retornosVencidos', total: vencidos },
        { chave: 'vagasOfertadas', total: ofertadas },
      ]),
    }
  }

  if (chamada.ok) {
    const emAtraso = chamada.valor.filter((linha) => linha.situacao === 'vencido').length
    vacinas.value = { total: emAtraso, tom: emAtraso > 0 ? 'atencao' : 'neutro' }
  }

  if (emCasa.ok) {
    const emQueda = emCasa.valor.filter((linha) => linha.alerta !== null).length
    tratamentos.value = { total: emQueda, tom: emQueda > 0 ? 'risco' : 'neutro' }
  }

  if (geladeira.ok) {
    const aComprar = geladeira.valor.indicadores.vacinasAbaixoDoMinimo
    estoque.value = { total: aComprar, tom: aComprar > 0 ? 'atencao' : 'neutro' }
  }

  if (ausencias.ok) {
    const aJustificar = ausencias.valor.filter((linha) => linha.semJustificativa > 0).length
    faltas.value = { total: aJustificar, tom: aJustificar > 0 ? 'atencao' : 'neutro' }
  }

  situacao.value = situacaoPelasFontes([
    entradas,
    mapa,
    rascunhos,
    retornos,
    chamada,
    emCasa,
    geladeira,
    abertos,
    ausencias,
  ])

  if (situacao.value !== 'falhou') {
    conferidoEm.value = new Date()
  }
}

function carregar() {
  if (emVoo) {
    return emVoo
  }

  carregando.value = true

  emVoo = apurar()
    .catch(() => {
      /*
       * Nem os repositórios carregaram (o pedaço do módulo não baixou). O menu continua quieto — o
       * selo simplesmente não aparece —, mas a visão geral precisa saber que não conferiu.
       */
      situacao.value = 'falhou'
    })
    .finally(() => {
      carregando.value = false
      carregado.value = true
      emVoo = null
    })

  return emVoo
}

/**
 * Refaz a contagem, se alguém já a estava usando.
 *
 * Chamado por `invalidarTudo()` da store clínica — a mesma linha que já avisa as telas de que o
 * mundo mudou. A direção da dependência importa: é o módulo clínico que conhece o contador, e
 * não o contador que fica observando a store, que é o que obrigaria este arquivo a importar a
 * store no topo e a arrastar o dataset para o menu de todo mundo.
 *
 * Não carrega o que nunca foi carregado: numa conta sem o módulo, isto é uma função vazia.
 */
export function invalidarPendenciasClinicas() {
  if (carregado.value) {
    void carregar()
  }
}

/** O relógio que refaz a contagem sozinho — ver `criarReconferencia`. */
const reconferencia = criarReconferencia({
  recarregar: carregar,
  conferidoEm: () => conferidoEm.value,
  carregado: () => carregado.value,
})

/**
 * Contagens do módulo clínico, carregadas sob demanda.
 *
 * `ativo` diz se o consumidor tem direito de ver o módulo. Enquanto for `false`, tudo fica
 * zerado e **nada é pedido ao repositório**: uma conta sem o módulo ligado não paga por dados
 * que não vai ver.
 */
export function useClinicoPendencias(ativo: () => boolean) {
  watch(
    ativo,
    (ligado) => {
      if (ligado && !carregado.value) {
        void carregar()
      }
    },
    { immediate: true },
  )

  reconferencia.assinar(ativo)

  return {
    fila: computed(() => (ativo() ? fila.value : VAZIO)),
    pedidos: computed(() => (ativo() ? pedidos.value : VAZIO)),
    internacao: computed(() => (ativo() ? internacao.value : VAZIO)),
    atividades: computed(() => (ativo() ? atividades.value : VAZIO)),
    vacinas: computed(() => (ativo() ? vacinas.value : VAZIO)),
    tratamentos: computed(() => (ativo() ? tratamentos.value : VAZIO)),
    estoque: computed(() => (ativo() ? estoque.value : VAZIO)),
    faltas: computed(() => (ativo() ? faltas.value : VAZIO)),
    situacao: computed(() => (ativo() ? situacao.value : null)),
    conferidoEm: computed(() => conferidoEm.value),
    carregando: computed(() => carregando.value),
    carregado: computed(() => carregado.value),
    recarregar: carregar,
  }
}

/** Zera o singleton. Existe para o teste, e para o logout não deixar contagem de outra conta. */
export function limparPendenciasClinicas() {
  fila.value = VAZIO
  pedidos.value = VAZIO
  internacao.value = VAZIO
  atividades.value = VAZIO
  vacinas.value = VAZIO
  tratamentos.value = VAZIO
  estoque.value = VAZIO
  faltas.value = VAZIO
  conferidoEm.value = null
  situacao.value = null
  carregado.value = false
  carregando.value = false
  emVoo = null
}
