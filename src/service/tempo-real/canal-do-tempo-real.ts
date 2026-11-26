/**
 * O canal de tempo real (PJ-3SO0WX): o SSE de "mudou, releia". Ele não leva dado: avisa que o recurso
 * `id` do `tipo` mudou, e a tela refaz o GET de sempre (permissão, formato e LGPD seguem no REST).
 *
 * Esta classe é só a conversa com a API, sem Vue: pedir o ticket, abrir o `EventSource`, ler as
 * mensagens, reconectar e decidir quando parar. Quem liga, desliga e entrega os avisos às telas é o
 * `useTempoReal`. Guia do front: seção 2 (doc do card PJ-3SO0WX).
 *
 * ## Regras
 *
 * 1. Ticket novo a cada abertura (uso único, 60 s): a reconexão automática do `EventSource` reusa a
 *    URL e levaria 401, então todo `error` fecha a fonte e a reabertura é nossa.
 * 2. Espera crescente entre as tentativas: 1 s, 2 s, 4 s... até 60 s, com sorteio de até metade (a
 *    mesma conta do ouvinte da API: `base * (0.5 + sorteio / 2)`). O `canal.pronto` zera a conta.
 * 3. Vigia: 60 s sem nenhuma mensagem (o batimento vem a cada 25 s), fecha e reabre.
 * 4. `canal.encerrado`, pelo motivo: RENOVAR reabre na hora; LENTO reabre com espera;
 *    SESSAO_ENCERRADA pede ticket (com o login valendo, volta; sem ele, para); ACESSO_REVOGADO para
 *    com esse parceiro e avisa (o portal segue o fluxo de sem acesso); SUBSTITUIDA para de vez nesta
 *    aba (outra conexão do usuário assumiu: a tela fica no polling de reserva).
 * 5. O ticket: 404 é o canal desligado no ambiente (não tenta mais nesta sessão); 403 é o parceiro
 *    que não é (mais) da conta (não tenta de novo com ele); 401 é o login que acabou (para); 429
 *    espera o `tenteDeNovoEmSegundos`; o resto (rede, 5xx) espera e tenta de novo.
 * 6. O `GET /eventos` que falha antes do stream (401 do ticket, 429 da rede, 503 lotado ou fora) não
 *    mostra o status ao `EventSource` do navegador: chega como `error`, e a regra 2 vale para todos
 *    (a primeira volta em até 1 s, que é o "peça outro" do 401; as seguintes esperam mais).
 * 7. Mensagem que não é JSON, sem `tipo`, de controle desconhecido, ou de uma fonte que já foi
 *    trocada: ignorada. Aviso de tipo desconhecido segue para as telas, que só ouvem os tipos delas.
 */
import type {
  MotivoDoEncerramentoDoTempoReal,
  TipoDaMensagemDoTempoReal,
} from '@/service/contrato/openapi'

/** Os avisos de "mudou, releia" (as mensagens que não são de controle do canal). */
export type TipoDeAvisoDoTempoReal = Exclude<TipoDaMensagemDoTempoReal, `canal.${string}`>

export type AvisoDoTempoReal = { tipo: TipoDeAvisoDoTempoReal | (string & {}); id: string }

/** Por que o canal parou de vez (até alguém religar ou a sessão mudar). */
export type MotivoDaParada = 'SEM_SESSAO' | 'DESLIGADO' | 'SEM_ACESSO' | 'SUBSTITUIDA'

export const ESPERA_INICIAL_MS = 1_000
export const ESPERA_MAXIMA_MS = 60_000
/** Sem nenhuma mensagem por este tempo, a conexão está morta (o batimento vem a cada 25 s). */
export const VIGIA_MS = 60_000

/** O que o canal usa do `EventSource` (nos testes, um falso). */
export interface FonteDeEventos {
  onmessage: ((evento: MessageEvent) => void) | null
  onerror: ((evento: Event) => void) | null
  close(): void
}

export interface DependenciasDoCanal {
  pedirTicket: (parceiroId: string) => Promise<{ ticket: string }>
  abrirFonte: (ticket: string) => FonteDeEventos
  /** Há login nesta aba (sem ele, nem pede o ticket). */
  temSessao: () => boolean
  /** De 0 a 1 (padrão: `Math.random`). */
  sortear?: () => number
}

export interface OuvintesDoCanal {
  aoAvisar: (aviso: AvisoDoTempoReal) => void
  /** `canal.pronto` e `canal.releia`: a tela relê tudo. */
  aoReler: () => void
  /** O canal entregando avisos (depois do `canal.pronto`) ou não. */
  aoMudarAoVivo: (aoVivo: boolean) => void
  /** `ACESSO_REVOGADO`: o membro saiu da equipe ou a conta foi desativada. */
  aoPerderAcesso: () => void
}

type Erro = { statusCode?: unknown; detalhes?: Record<string, unknown> }

function statusDo(erro: unknown) {
  const status = (erro as Erro | null)?.statusCode
  return typeof status === 'number' ? status : 0
}

function esperaPedidaPor(erro: unknown) {
  const segundos = Number((erro as Erro | null)?.detalhes?.tenteDeNovoEmSegundos)
  return Number.isFinite(segundos) && segundos > 0 ? segundos * 1000 : 0
}

export class CanalDoTempoReal {
  private parceiroId: string | null = null
  private parada: MotivoDaParada | null = null
  private fonte: FonteDeEventos | null = null
  private reabertura: ReturnType<typeof setTimeout> | null = null
  private vigia: ReturnType<typeof setTimeout> | null = null
  private falhas = 0
  /** Cada abertura é uma vez nova: resposta e mensagem de uma vez velha não mexem em nada. */
  private vez = 0
  private aoVivo = false

  /* O que vale até a sessão acabar (`encerrarSessao`). */
  private desligadoNaSessao = false
  private substituida = false
  private readonly parceirosSemAcesso = new Set<string>()

  constructor(
    private readonly deps: DependenciasDoCanal,
    private readonly ouvintes: OuvintesDoCanal,
  ) {}

  /** Abre (ou mantém) o canal da equipe deste parceiro. Outro parceiro: fecha o atual e abre o dele. */
  ligar(parceiroId: string) {
    if (this.parceiroId === parceiroId && this.parada !== 'SEM_SESSAO') return

    if (this.parceiroId !== parceiroId) {
      this.fecharTudo()
      this.parceiroId = parceiroId
      this.falhas = 0
    }

    const motivo = this.motivoParaNaoAbrir(parceiroId)
    if (motivo) {
      this.parar(motivo)
      return
    }

    this.parada = null
    void this.abrir()
  }

  /** Fecha o canal (ninguém escuta, logout, troca de parceiro). */
  desligar() {
    this.fecharTudo()
    this.parceiroId = null
    this.parada = null
    this.falhas = 0
  }

  /** O login acabou: fecha e esquece o que valia só para ele (canal desligado, aba substituída). */
  encerrarSessao() {
    this.desligar()
    this.desligadoNaSessao = false
    this.substituida = false
    this.parceirosSemAcesso.clear()
  }

  get motivoDaParada() {
    return this.parada
  }

  get estaAoVivo() {
    return this.aoVivo
  }

  /* --------------------------------------------------------------------------- abrir */

  private motivoParaNaoAbrir(parceiroId: string): MotivoDaParada | null {
    if (this.desligadoNaSessao) return 'DESLIGADO'
    if (this.substituida) return 'SUBSTITUIDA'
    if (this.parceirosSemAcesso.has(parceiroId)) return 'SEM_ACESSO'
    return null
  }

  private async abrir() {
    const parceiroId = this.parceiroId
    this.fecharFonte()
    this.limparReabertura()
    const vez = ++this.vez

    if (!parceiroId) return
    if (!this.deps.temSessao()) {
      this.parar('SEM_SESSAO')
      return
    }

    let ticket: string
    try {
      ticket = (await this.deps.pedirTicket(parceiroId)).ticket
    } catch (erro) {
      if (vez === this.vez) this.ticketFalhou(erro, parceiroId)
      return
    }
    if (vez !== this.vez) return

    let fonte: FonteDeEventos
    try {
      fonte = this.deps.abrirFonte(ticket)
    } catch {
      this.reabrirComEspera()
      return
    }

    this.fonte = fonte
    fonte.onmessage = (evento) => {
      if (vez === this.vez) this.lerMensagem(evento.data)
    }
    fonte.onerror = () => {
      if (vez !== this.vez) return
      this.fecharFonte()
      this.reabrirComEspera()
    }
    this.armarVigia()
  }

  private ticketFalhou(erro: unknown, parceiroId: string) {
    switch (statusDo(erro)) {
      case 404:
        this.desligadoNaSessao = true
        this.parar('DESLIGADO')
        return
      case 403:
        this.parceirosSemAcesso.add(parceiroId)
        this.parar('SEM_ACESSO')
        return
      case 401:
        this.parar('SEM_SESSAO')
        return
      case 429:
        this.reabrirComEspera(esperaPedidaPor(erro))
        return
      default:
        this.reabrirComEspera()
    }
  }

  /* ------------------------------------------------------------------------ mensagens */

  private lerMensagem(dados: unknown) {
    this.armarVigia()

    let mensagem: unknown
    try {
      mensagem = JSON.parse(String(dados))
    } catch {
      return
    }
    if (!mensagem || typeof mensagem !== 'object') return

    const { tipo, id, motivo } = mensagem as Record<string, unknown>
    if (typeof tipo !== 'string') return

    switch (tipo) {
      case 'canal.pronto':
        this.falhas = 0
        this.mudarAoVivo(true)
        this.ouvintes.aoReler()
        return
      case 'canal.releia':
        this.ouvintes.aoReler()
        return
      case 'canal.encerrado':
        this.encerrado(motivo)
        return
      default:
        /* `canal.batimento` só alimenta o vigia; controle novo que não conhecemos, idem. */
        if (tipo.startsWith('canal.')) return
        if (typeof id === 'string' && id) this.ouvintes.aoAvisar({ tipo, id })
    }
  }

  private encerrado(motivo: unknown) {
    this.fecharFonte()

    switch (motivo as MotivoDoEncerramentoDoTempoReal) {
      case 'RENOVAR':
      case 'SESSAO_ENCERRADA':
        void this.abrir()
        return
      case 'ACESSO_REVOGADO':
        if (this.parceiroId) this.parceirosSemAcesso.add(this.parceiroId)
        this.parar('SEM_ACESSO')
        this.ouvintes.aoPerderAcesso()
        return
      case 'SUBSTITUIDA':
        this.substituida = true
        this.parar('SUBSTITUIDA')
        return
      default:
        /* LENTO, e motivo que ainda não conhecemos: a API fechou, reabre com espera. */
        this.reabrirComEspera()
    }
  }

  /* ---------------------------------------------------------------------- reconectar */

  private reabrirComEspera(minimoMs = 0) {
    this.fecharFonte()
    this.limparReabertura()
    this.falhas += 1
    const base = Math.min(ESPERA_MAXIMA_MS, ESPERA_INICIAL_MS * 2 ** (this.falhas - 1))
    const sorteio = (this.deps.sortear ?? Math.random)()
    const espera = Math.max(minimoMs, Math.round(base * (0.5 + sorteio / 2)))

    this.reabertura = setTimeout(() => {
      this.reabertura = null
      void this.abrir()
    }, espera)
  }

  private armarVigia() {
    if (this.vigia) clearTimeout(this.vigia)
    this.vigia = setTimeout(() => {
      this.vigia = null
      this.reabrirComEspera()
    }, VIGIA_MS)
  }

  /* --------------------------------------------------------------------------- fechar */

  private parar(motivo: MotivoDaParada) {
    this.fecharFonte()
    this.limparReabertura()
    this.vez += 1
    this.parada = motivo
  }

  private fecharTudo() {
    this.fecharFonte()
    this.limparReabertura()
    this.vez += 1
  }

  private fecharFonte() {
    if (this.vigia) {
      clearTimeout(this.vigia)
      this.vigia = null
    }
    if (this.fonte) {
      const fonte = this.fonte
      this.fonte = null
      fonte.onmessage = null
      fonte.onerror = null
      fonte.close()
    }
    this.mudarAoVivo(false)
  }

  private limparReabertura() {
    if (this.reabertura) {
      clearTimeout(this.reabertura)
      this.reabertura = null
    }
  }

  private mudarAoVivo(aoVivo: boolean) {
    if (this.aoVivo === aoVivo) return
    this.aoVivo = aoVivo
    this.ouvintes.aoMudarAoVivo(aoVivo)
  }
}
