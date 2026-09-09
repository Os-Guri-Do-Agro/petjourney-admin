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

/** Gravidade do contador — a mesma escada de tom do resto do módulo. */
export type TomDePendencia = 'neutro' | 'atencao' | 'risco'

export type ContagemDePendencia = {
  total: number
  tom: TomDePendencia
}

const VAZIO: ContagemDePendencia = { total: 0, tom: 'neutro' }

const fila = ref<ContagemDePendencia>(VAZIO)
const internacao = ref<ContagemDePendencia>(VAZIO)
const atividades = ref<ContagemDePendencia>(VAZIO)
const vacinas = ref<ContagemDePendencia>(VAZIO)

const carregando = ref(false)
const carregado = ref(false)

/** Uma carga por vez. Sem isto, cinco páginas montando juntas disparariam cinco rondas. */
let emVoo: Promise<void> | null = null

async function apurar() {
  const [
    { encounterRepository, internacaoRepository, vacinaRepository, waitlistRepository },
    { retornosVencidos },
    { clinicClock },
  ] = await Promise.all([
    import('../data/repositories'),
    import('../domain/follow-up'),
    import('../stores/clinico'),
  ])

  const [entradas, mapa, rascunhos, retornos, chamada] = await Promise.all([
    waitlistRepository.listar().catch(() => []),
    internacaoRepository.mapa().catch(() => null),
    encounterRepository.listarRascunhos(null).catch(() => []),
    encounterRepository.listarRetornosPendentes().catch(() => []),
    vacinaRepository.listaDeChamada().catch(() => []),
  ])

  const aguardando = entradas.filter((entrada) => entrada.status === 'aguardando').length
  const ofertadas = entradas.filter((entrada) => entrada.status === 'ofertado').length

  fila.value = { total: aguardando, tom: 'neutro' }

  const atrasadas = (mapa?.leitos ?? []).reduce((soma, item) => soma + item.atrasadas, 0)
  const retidos = mapa?.boletinsRetidos ?? 0

  /*
   * Boletim retido é risco e dose atrasada é atenção — a ordem não é de gravidade clínica, é de
   * quem está esperando. A dose atrasada espera a enfermagem, que está no corredor; o boletim
   * retido espera uma ligação que **ninguém sabe que precisa dar**, e do outro lado há um
   * responsável sem notícia do animal dele.
   */
  internacao.value = {
    total: atrasadas + retidos,
    tom: retidos > 0 ? 'risco' : atrasadas > 0 ? 'atencao' : 'neutro',
  }

  const vencidos = retornosVencidos(retornos, clinicClock, clinicClock.today()).length
  const pendencias = rascunhos.length + vencidos + ofertadas

  atividades.value = { total: pendencias, tom: pendencias > 0 ? 'atencao' : 'neutro' }

  const emAtraso = chamada.filter((linha) => linha.situacao === 'vencido').length

  vacinas.value = { total: emAtraso, tom: emAtraso > 0 ? 'atencao' : 'neutro' }
}

function carregar() {
  if (emVoo) {
    return emVoo
  }

  carregando.value = true

  emVoo = apurar()
    .catch(() => {
      /*
       * Contador é acessório: a tela de destino continua sendo a fonte da verdade. Falhar aqui
       * não pode derrubar o menu nem plantar uma faixa de erro no shell — o número simplesmente
       * não aparece, e quem clica vê o mesmo de sempre.
       */
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

  return {
    fila: computed(() => (ativo() ? fila.value : VAZIO)),
    internacao: computed(() => (ativo() ? internacao.value : VAZIO)),
    atividades: computed(() => (ativo() ? atividades.value : VAZIO)),
    vacinas: computed(() => (ativo() ? vacinas.value : VAZIO)),
    carregando: computed(() => carregando.value),
    recarregar: carregar,
  }
}

/** Zera o singleton. Existe para o teste, e para o logout não deixar contagem de outra conta. */
export function limparPendenciasClinicas() {
  fila.value = VAZIO
  internacao.value = VAZIO
  atividades.value = VAZIO
  vacinas.value = VAZIO
  carregado.value = false
  carregando.value = false
  emVoo = null
}
