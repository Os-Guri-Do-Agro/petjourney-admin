/**
 * Store do cronômetro de atendimento.
 *
 * O que ela guarda **não é um número correndo** — é o instante em que o trecho começou. Todo o
 * resto se recalcula a partir do relógio do sistema, e é isso que faz o cronômetro sobreviver a
 * navegar entre telas, recarregar a página e fechar o navegador no meio do dia. Um contador
 * mantido em memória perderia o atendimento inteiro no primeiro F5, e o profissional
 * descobriria isso justamente no dia em que o atendimento foi longo.
 *
 * Três cuidados que o modelo de cobrança por tempo obriga:
 *
 * - **Persistência imediata.** Cada mudança vai para o `localStorage` na hora, não ao sair da
 *   página. `beforeunload` não é garantido, e o que se perde aqui é dinheiro de alguém.
 * - **Uma sessão só, sincronizada entre abas.** Duas abas com relógios diferentes produzem duas
 *   respostas para "quanto tempo durou". O evento `storage` mantém as abas contando a mesma
 *   coisa, e quem parar numa para em todas.
 * - **O histórico é do dia.** Sessão de ontem não entra no total de hoje; a limpeza acontece na
 *   leitura, não por rotina agendada, porque a aba pode ficar aberta virando a noite.
 *
 * O cronômetro é por navegador, e portanto por pessoa logada naquela máquina — que é a unidade
 * certa: quem recebe por tempo é o profissional, não a clínica.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  encerrarSessao,
  pausarSessao,
  PREFERENCIAS_PADRAO,
  retomarSessao,
  type ResumoDaSessao,
  type SessaoCronometro,
} from '../domain/cronometro'

const CHAVE_SESSAO = 'petjourney-cronometro-sessao'
const CHAVE_HISTORICO = 'petjourney-cronometro-historico'
const CHAVE_PREFERENCIAS = 'petjourney-cronometro-preferencias'

/** Sessões guardadas por dia. Passou disso, a lista vira arquivo morto dentro do navegador. */
const LIMITE_DO_HISTORICO = 40

export type ContextoDoCronometro = {
  encounterId: string | null
  rotulo: string
  /** Bloco do tipo de atendimento, quando a tela sabe qual é. */
  blocoMinutos?: number
}

export type PreferenciasDoCronometro = {
  blocoMinutos: number
  incrementoMinutos: number
}

function ler<T>(chave: string): T | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const bruto = window.localStorage.getItem(chave)

    return bruto ? (JSON.parse(bruto) as T) : null
  } catch {
    /* Conteúdo corrompido não pode derrubar o cabeçalho da aplicação inteira. */
    return null
  }
}

function gravar(chave: string, valor: unknown) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (valor === null) {
      window.localStorage.removeItem(chave)
    } else {
      window.localStorage.setItem(chave, JSON.stringify(valor))
    }
  } catch {
    /* Cota cheia ou modo privado: o cronômetro segue na memória desta aba. */
  }
}

function mesmoDia(instante: number, referencia: number): boolean {
  const a = new Date(instante)
  const b = new Date(referencia)

  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function novoId(): string {
  return `cron-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const useCronometroStore = defineStore('cronometro', () => {
  const sessao = ref<SessaoCronometro | null>(ler<SessaoCronometro>(CHAVE_SESSAO))
  const historico = ref<ResumoDaSessao[]>(ler<ResumoDaSessao[]>(CHAVE_HISTORICO) ?? [])
  const preferencias = ref<PreferenciasDoCronometro>(
    ler<PreferenciasDoCronometro>(CHAVE_PREFERENCIAS) ?? { ...PREFERENCIAS_PADRAO },
  )

  /**
   * Contexto oferecido pela tela aberta — o atendimento que o botão do cabeçalho vai cronometrar.
   *
   * Quem define é a página do prontuário, e não o cabeçalho: assim o cabeçalho não precisa saber
   * que o módulo clínico existe, e o pacote inicial da aplicação não carrega o bulário inteiro
   * para desenhar um relógio.
   */
  const contexto = ref<ContextoDoCronometro | null>(null)

  /** Sessões de hoje. Ontem não entra no total do dia, ainda que a aba não tenha sido fechada. */
  const sessoesDeHoje = computed(() =>
    historico.value.filter((item) => mesmoDia(item.encerradaEm, Date.now())),
  )

  const ultimaEncerrada = computed<ResumoDaSessao | null>(() => historico.value[0] ?? null)

  function persistirSessao() {
    gravar(CHAVE_SESSAO, sessao.value)
  }

  function persistirHistorico() {
    gravar(CHAVE_HISTORICO, historico.value)
  }

  function definirContexto(novo: ContextoDoCronometro | null) {
    contexto.value = novo
  }

  function definirPreferencias(novas: Partial<PreferenciasDoCronometro>) {
    preferencias.value = { ...preferencias.value, ...novas }
    gravar(CHAVE_PREFERENCIAS, preferencias.value)

    /*
     * A sessão em curso acompanha a mudança. O contrário — congelar o bloco de quem já começou
     * — parece mais seguro e é pior: quem corrige o incremento no meio do atendimento está
     * corrigindo justamente porque o número na tela está errado.
     */
    if (sessao.value) {
      sessao.value = { ...sessao.value, ...preferencias.value }
      persistirSessao()
    }
  }

  function iniciar(alvo?: ContextoDoCronometro | null) {
    const escolhido = alvo ?? contexto.value
    const agora = Date.now()

    sessao.value = {
      encounterId: escolhido?.encounterId ?? null,
      rotulo: escolhido?.rotulo ?? '',
      correndoDesde: agora,
      acumuladoMs: 0,
      iniciadaEm: agora,
      blocoMinutos: escolhido?.blocoMinutos ?? preferencias.value.blocoMinutos,
      incrementoMinutos: preferencias.value.incrementoMinutos,
    }

    persistirSessao()
  }

  function pausar() {
    if (!sessao.value) {
      return
    }

    sessao.value = pausarSessao(sessao.value, Date.now())
    persistirSessao()
  }

  function retomar() {
    if (!sessao.value) {
      return
    }

    sessao.value = retomarSessao(sessao.value, Date.now())
    persistirSessao()
  }

  function alternar() {
    if (!sessao.value) {
      iniciar()
      return
    }

    if (sessao.value.correndoDesde === null) {
      retomar()
    } else {
      pausar()
    }
  }

  /** Encerra e arquiva. Devolve o resumo para a tela poder mostrar o fechamento. */
  function encerrar(): ResumoDaSessao | null {
    if (!sessao.value) {
      return null
    }

    const resumo = encerrarSessao(sessao.value, Date.now(), novoId())

    historico.value = [resumo, ...historico.value].slice(0, LIMITE_DO_HISTORICO)
    sessao.value = null

    persistirSessao()
    persistirHistorico()

    return resumo
  }

  /**
   * Joga a sessão fora sem arquivar.
   *
   * É a saída para o relógio esquecido correndo desde ontem. Descartar precisa ser diferente de
   * encerrar: encerrar afirma que aquele tempo foi trabalhado, e afirmar isso por engano é o
   * único jeito de esta tela cobrar a mais de alguém.
   */
  function descartar() {
    sessao.value = null
    persistirSessao()
  }

  function limparHistorico() {
    historico.value = []
    persistirHistorico()
  }

  /**
   * Realinha esta aba com o que outra aba gravou.
   *
   * Chamado pelo componente do cabeçalho, que é quem tem ciclo de vida para assinar e cancelar
   * o evento `storage`.
   */
  function recarregarDoArmazenamento() {
    sessao.value = ler<SessaoCronometro>(CHAVE_SESSAO)
    historico.value = ler<ResumoDaSessao[]>(CHAVE_HISTORICO) ?? []
    preferencias.value = ler<PreferenciasDoCronometro>(CHAVE_PREFERENCIAS) ?? {
      ...PREFERENCIAS_PADRAO,
    }
  }

  /** Chaves que interessam ao ouvinte de `storage`. */
  const CHAVES = [CHAVE_SESSAO, CHAVE_HISTORICO, CHAVE_PREFERENCIAS]

  function ehChaveDoCronometro(chave: string | null): boolean {
    return chave === null || CHAVES.includes(chave)
  }

  return {
    sessao,
    historico,
    sessoesDeHoje,
    ultimaEncerrada,
    preferencias,
    contexto,
    definirContexto,
    definirPreferencias,
    iniciar,
    pausar,
    retomar,
    alternar,
    encerrar,
    descartar,
    limparHistorico,
    recarregarDoArmazenamento,
    ehChaveDoCronometro,
  }
})
