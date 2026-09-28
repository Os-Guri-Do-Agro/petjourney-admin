/**
 * De onde vem a conversa da anamnese por voz: do microfone, pelo reconhecimento de voz do
 * navegador, ou da consulta gravada de demonstração, tocada no ritmo de uma consulta.
 *
 * As duas entregam a mesma coisa — trechos finais, o texto provisório do que está sendo dito, o
 * nível do som e o relógio —, e é isso que deixa o painel não saber qual está tocando. A
 * diferença que importa não some por isso: a store sabe a fonte, e a tela diz qual é.
 *
 * ## O microfone
 *
 * Usa o `SpeechRecognition` do navegador (Chrome e Edge; o Firefox não tem). Três coisas dele
 * que moldam este arquivo:
 *
 * - **Não separa vozes.** Todo trecho chega como `nao-identificado`, e a tela avisa.
 * - **Para sozinho depois de um silêncio.** Uma consulta tem silêncios; o reconhecimento é
 *   religado enquanto a gravação estiver aberta — com um freio, para não girar em falso se o
 *   serviço cair.
 * - **No Chrome, o áudio vai ao serviço de voz do Google.** O painel diz isso ao veterinário.
 *   Daqui para dentro do produto só volta texto: nenhum byte de áudio é guardado.
 *
 * O medidor de nível abre o microfone uma segunda vez, pelo Web Audio, só para medir volume. É o
 * que prova, sem ler nada, que o microfone está ouvindo — e é fechado junto com a pausa, para a
 * luz do microfone apagar quando a tela diz "pausado".
 */

import { consultaGravada, type ContextoDaConsultaGravada } from './fixtures/consulta-gravada'
import type { TrechoDaConversa } from './types'

export type ErroDaEscuta = 'sem-suporte' | 'permissao' | 'microfone' | 'rede' | 'servico'

export type EventosDaFonte = {
  /** Trecho final: entra na conversa e não muda mais. */
  aoTrecho: (trecho: TrechoDaConversa) => void
  /** O que está sendo dito agora, ainda provisório. Vazio quando ninguém fala. */
  aoInterino: (texto: string) => void
  /** De 0 a 1. */
  aoNivel: (nivel: number) => void
  /** Posição da gravação em milissegundos, sem as pausas. */
  aoTempo: (ms: number) => void
  /** A fonte terminou de entregar o que tinha depois de `encerrar`. */
  aoFim: () => void
  aoErro: (erro: ErroDaEscuta) => void
}

export type FonteDaEscuta = {
  iniciar: () => void
  pausar: () => void
  retomar: () => void
  /** Encerra. O microfone ainda entrega o que estava ouvindo antes de avisar o fim. */
  encerrar: () => void
  /** Solta tudo sem esperar nada — saída da tela. */
  descartar: () => void
  /** Só a demonstração: entrega o resto da conversa de uma vez. */
  adiantar?: () => void
}

// ------------------------------------------------------------------ demonstração

/** Um passo do relógio da demonstração. */
const PASSO_MS = 60
/** Ritmo da fala: milissegundos de conversa por palavra. */
const MS_POR_PALAVRA = 330

/**
 * A consulta gravada, tocada como se estivesse acontecendo.
 *
 * A conversa dura perto de dois minutos; a `velocidade` encurta isso para caber numa
 * demonstração sem mudar a ordem nem os intervalos relativos. O relógio que a tela mostra é o da
 * conversa, não o da parede: é ele que casa com a hora de cada fala.
 *
 * Quando a última fala termina, a fonte **continua ouvindo** o silêncio da sala, como o
 * microfone faria. Quem encerra é quem conduz a consulta — a demonstração não decide por ele.
 */
export function criarFonteDeDemonstracao(
  contexto: ContextoDaConsultaGravada,
  eventos: EventosDaFonte,
  opcoes: { velocidade: number; palavraAPalavra: boolean },
): FonteDaEscuta {
  const trechos = consultaGravada(contexto)
  let posicao = 0
  let proximo = 0
  let temporizador: ReturnType<typeof setInterval> | null = null
  let encerrada = false

  function duracaoDe(indice: number): number {
    const trecho = trechos[indice]

    if (!trecho) {
      return 0
    }

    const palavras = trecho.texto.split(/\s+/).filter(Boolean).length
    const falada = trecho.texto ? Math.max(900, palavras * MS_POR_PALAVRA) : 700
    const seguinte = trechos[indice + 1]

    return seguinte ? Math.min(falada, seguinte.emMs - trecho.emMs - 250) : falada
  }

  /** O som da sala entre as falas: baixo, mas não zero — microfone aberto nunca mede silêncio puro. */
  function somDaSala() {
    eventos.aoInterino('')
    eventos.aoNivel(0.04 + Math.random() * 0.05)
  }

  function passo() {
    posicao += PASSO_MS * opcoes.velocidade
    eventos.aoTempo(posicao)

    const atual = trechos[proximo]

    if (!atual || posicao < atual.emMs) {
      somDaSala()

      return
    }

    const progresso = Math.min(1, (posicao - atual.emMs) / Math.max(1, duracaoDe(proximo)))

    if (progresso >= 1) {
      eventos.aoInterino('')
      eventos.aoTrecho(atual)
      proximo += 1

      return
    }

    if (atual.texto && opcoes.palavraAPalavra) {
      const palavras = atual.texto.split(/\s+/)
      const ditas = Math.max(1, Math.ceil(progresso * palavras.length))

      eventos.aoInterino(palavras.slice(0, ditas).join(' '))
    }

    /* O latido sem fala é o pico do medidor: é o som mais alto da sala. */
    eventos.aoNivel(atual.texto ? 0.35 + Math.random() * 0.5 : 0.9 + Math.random() * 0.1)
  }

  function parar() {
    if (temporizador) {
      clearInterval(temporizador)
      temporizador = null
    }
  }

  function tocar() {
    if (!temporizador && !encerrada) {
      temporizador = setInterval(passo, PASSO_MS)
    }
  }

  function silenciar() {
    eventos.aoNivel(0)
    eventos.aoInterino('')
  }

  return {
    iniciar: tocar,
    pausar: () => {
      parar()
      silenciar()
    },
    retomar: tocar,
    encerrar: () => {
      /* A fala pela metade fica de fora: é roteiro, e meia frase de roteiro não foi dita. */
      parar()
      silenciar()

      if (!encerrada) {
        encerrada = true
        eventos.aoFim()
      }
    },
    descartar: () => {
      encerrada = true
      parar()
    },
    adiantar: () => {
      for (; proximo < trechos.length; proximo += 1) {
        const trecho = trechos[proximo]

        if (trecho) {
          eventos.aoTrecho(trecho)
        }
      }

      const ultimo = trechos.length - 1

      posicao = Math.max(posicao, (trechos[ultimo]?.emMs ?? 0) + duracaoDe(ultimo))
      eventos.aoTempo(posicao)
      somDaSala()
    },
  }
}

// ------------------------------------------------------------------ microfone

/*
 * O pedaço do `SpeechRecognition` que este arquivo usa. Declarado aqui porque a biblioteca DOM
 * do TypeScript não traz o prefixo `webkit`, que é o nome pelo qual o Chrome o expõe.
 */
type Alternativa = { readonly transcript: string; readonly confidence: number }
type Lista<T> = { readonly length: number; readonly [indice: number]: T }
type Resultado = Lista<Alternativa> & { readonly isFinal: boolean }
type EventoDeResultado = { readonly resultIndex: number; readonly results: Lista<Resultado> }

type Reconhecedor = {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  onresult: ((evento: EventoDeResultado) => void) | null
  onerror: ((evento: { readonly error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}

type ConstrutorDeReconhecedor = new () => Reconhecedor

function construtor(): ConstrutorDeReconhecedor | null {
  if (typeof window === 'undefined') {
    return null
  }

  const janela = window as unknown as {
    SpeechRecognition?: ConstrutorDeReconhecedor
    webkitSpeechRecognition?: ConstrutorDeReconhecedor
  }

  return janela.SpeechRecognition ?? janela.webkitSpeechRecognition ?? null
}

/** O navegador transcreve voz? No Firefox, não — e a tela oferece a demonstração no lugar. */
export function microfoneDisponivel(): boolean {
  return construtor() !== null
}

/** Mais de tantos religamentos em dez segundos é o serviço caindo, não silêncio na sala. */
const RELIGAMENTOS_TOLERADOS = 6
/** Quanto esperar o reconhecimento entregar a última frase depois de encerrar. */
const ESPERA_DO_FIM_MS = 1500

type Medidor = { fechar: () => void }

async function abrirMedidor(aoNivel: (nivel: number) => void): Promise<Medidor | null> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return null
  }

  try {
    const fluxo = await navigator.mediaDevices.getUserMedia({ audio: true })
    const contexto = new AudioContext()
    const analisador = contexto.createAnalyser()

    analisador.fftSize = 512
    contexto.createMediaStreamSource(fluxo).connect(analisador)

    const amostras = new Uint8Array(analisador.fftSize)
    const intervalo = setInterval(() => {
      analisador.getByteTimeDomainData(amostras)

      let soma = 0

      for (const amostra of amostras) {
        const desvio = (amostra - 128) / 128

        soma += desvio * desvio
      }

      /* Fala a um metro dá RMS perto de 0,05–0,2; o fator leva isso para a metade da escala. */
      aoNivel(Math.min(1, Math.sqrt(soma / amostras.length) * 5))
    }, 90)

    return {
      fechar: () => {
        clearInterval(intervalo)
        fluxo.getTracks().forEach((faixa) => faixa.stop())
        void contexto.close()
      },
    }
  } catch {
    /* Sem medidor a gravação continua; o reconhecimento avisa se a permissão foi negada. */
    return null
  }
}

export function criarFonteDoMicrofone(
  eventos: EventosDaFonte,
  opcoes: { idioma: string },
): FonteDaEscuta {
  const Construtor = construtor()
  let reconhecedor: Reconhecedor | null = null
  let estado: 'parado' | 'ouvindo' | 'pausado' | 'encerrando' = 'parado'
  let contador = 0
  let acumuladoMs = 0
  let desde = 0
  let relogio: ReturnType<typeof setInterval> | null = null
  let inicioDoTrecho: number | null = null
  let religamentos: number[] = []
  let medidor: Medidor | null = null
  /** Muda a cada abertura e fechamento: o medidor que chega atrasado sabe que perdeu a vez. */
  let geracaoDoMedidor = 0

  function agora() {
    return acumuladoMs + (estado === 'ouvindo' ? performance.now() - desde : 0)
  }

  function ligarMedidor() {
    const geracao = (geracaoDoMedidor += 1)

    void abrirMedidor(eventos.aoNivel).then((aberto) => {
      if (geracao === geracaoDoMedidor) {
        medidor = aberto
      } else {
        aberto?.fechar()
      }
    })
  }

  function desligarMedidor() {
    geracaoDoMedidor += 1
    medidor?.fechar()
    medidor = null
    eventos.aoNivel(0)
  }

  function pararRelogio() {
    if (relogio) {
      clearInterval(relogio)
      relogio = null
    }
  }

  function soltar() {
    desligarMedidor()
    pararRelogio()

    if (reconhecedor) {
      reconhecedor.onresult = null
      reconhecedor.onerror = null
      reconhecedor.onend = null

      try {
        reconhecedor.abort()
      } catch {
        /* Já estava parado. */
      }

      reconhecedor = null
    }

    eventos.aoInterino('')
  }

  function falhar(erro: ErroDaEscuta) {
    estado = 'parado'
    soltar()
    eventos.aoErro(erro)
  }

  function terminar() {
    estado = 'parado'
    soltar()
    eventos.aoFim()
  }

  function aoResultado(evento: EventoDeResultado) {
    let interino = ''

    for (let indice = evento.resultIndex; indice < evento.results.length; indice += 1) {
      const resultado = evento.results[indice]
      const alternativa = resultado?.[0]

      if (!resultado || !alternativa) {
        continue
      }

      if (!resultado.isFinal) {
        inicioDoTrecho ??= agora()
        interino += alternativa.transcript

        continue
      }

      const texto = alternativa.transcript.trim()

      if (texto) {
        contador += 1
        eventos.aoTrecho({
          id: `voz-${contador}`,
          falante: 'nao-identificado',
          texto: texto.charAt(0).toUpperCase() + texto.slice(1),
          emMs: Math.round(inicioDoTrecho ?? agora()),
          /* O Chrome devolve 0 quando não mediu. Zero ali é "não sei", não "não confio". */
          confianca: alternativa.confidence > 0 ? alternativa.confidence : 0.85,
          interferencia: null,
        })
      }

      inicioDoTrecho = null
    }

    eventos.aoInterino(interino.trim())
  }

  function aoErro(evento: { readonly error: string }) {
    switch (evento.error) {
      /* Silêncio na sala, ou o próprio `abort` desta fonte: nenhum dos dois é falha. */
      case 'no-speech':
      case 'aborted':
        return
      case 'not-allowed':
      case 'service-not-allowed':
        falhar('permissao')

        return
      case 'audio-capture':
        falhar('microfone')

        return
      case 'network':
        falhar('rede')

        return
      default:
        falhar('servico')
    }
  }

  function aoFimDoReconhecedor() {
    if (estado === 'encerrando') {
      terminar()

      return
    }

    if (estado !== 'ouvindo') {
      return
    }

    const instante = Date.now()

    religamentos = [...religamentos.filter((vez) => instante - vez < 10_000), instante]

    if (religamentos.length > RELIGAMENTOS_TOLERADOS) {
      falhar('servico')

      return
    }

    try {
      reconhecedor?.start()
    } catch {
      falhar('servico')
    }
  }

  function ouvir() {
    estado = 'ouvindo'
    desde = performance.now()

    try {
      reconhecedor?.start()
    } catch {
      /*
       * Ainda encerrando a sessão anterior (pausa seguida de retomada rápida). O `onend` dela
       * chega com o estado já em "ouvindo" e religa sozinho.
       */
    }

    ligarMedidor()
    pararRelogio()
    relogio = setInterval(() => eventos.aoTempo(agora()), 250)
  }

  return {
    iniciar: () => {
      if (!Construtor) {
        eventos.aoErro('sem-suporte')

        return
      }

      reconhecedor = new Construtor()
      reconhecedor.lang = opcoes.idioma
      reconhecedor.continuous = true
      reconhecedor.interimResults = true
      reconhecedor.maxAlternatives = 1
      reconhecedor.onresult = aoResultado
      reconhecedor.onerror = aoErro
      reconhecedor.onend = aoFimDoReconhecedor
      ouvir()
    },
    pausar: () => {
      if (estado !== 'ouvindo') {
        return
      }

      acumuladoMs = agora()
      estado = 'pausado'
      /* `stop`, e não `abort`: a frase que estava no meio ainda chega, antes de o som fechar. */
      reconhecedor?.stop()
      desligarMedidor()
      pararRelogio()
      eventos.aoInterino('')
    },
    retomar: () => {
      if (estado === 'pausado') {
        ouvir()
      }
    },
    encerrar: () => {
      const ouvia = estado === 'ouvindo'

      if (ouvia) {
        acumuladoMs = agora()
      }

      estado = 'encerrando'
      desligarMedidor()
      pararRelogio()

      if (!ouvia || !reconhecedor) {
        terminar()

        return
      }

      reconhecedor.stop()
      /* Se o `onend` não vier, a revisão não pode ficar esperando por ele. */
      setTimeout(() => {
        if (estado === 'encerrando') {
          terminar()
        }
      }, ESPERA_DO_FIM_MS)
    },
    descartar: () => {
      estado = 'parado'
      soltar()
    },
  }
}
