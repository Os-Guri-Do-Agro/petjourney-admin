import {
  computed,
  onScopeDispose,
  reactive,
  ref,
  shallowRef,
  toValue,
  type MaybeRefOrGetter,
} from 'vue'

import { ApiError } from '@/service/api'
import {
  criarLeituraReceita,
  getLeituraReceita,
} from '@/service/parceiro/compartilhamentos-service'
import type { LeituraReceitaParceiro } from '@/service/parceiro/types'
import {
  cabeMaisArquivoLeitura,
  ehPdf,
  ESPERA_MAXIMA_MS,
  FALHAS_SEGUIDAS_MAX,
  intervaloDaEspera,
  problemaDaImagemReduzida,
  problemaDoArquivoLeitura,
  vagasParaLeitura,
  type ProblemaArquivoLeitura,
} from '@/utils/parceiro/leitura-receita'
import { reduzirImagemParaLeitura } from '@/utils/parceiro/reduzir-imagem'

/**
 * "Ler receita com IA" na anotação de consulta do portal (Parte 3 do épico `leitura-receita-ia`).
 *
 * Fluxo: escolher até 3 fotos (ou 1 PDF), mandar ler, perguntar pela leitura com recuo até ela
 * sair de PROCESSANDO e, em AGUARDANDO_CONFIRMACAO, pôr os remédios na prescrição do formulário.
 * O id da leitura vai junto no envio da anotação (`leituraReceitaId`), e a API copia os arquivos
 * dela como anexo "Receita Médica". Por isso eles contam no teto de 3 anexos desde a escolha.
 *
 * O estado é da tela: o 503 esconde o botão até a pessoa sair dela.
 */

export type EtapaLeituraReceita =
  /** O botão "Ler receita com IA". */
  | 'inicial'
  /** Arquivos escolhidos, ainda não mandados. */
  | 'escolhendo'
  | 'enviando'
  | 'lendo'
  /** 60 s sem resposta: "Ainda estou lendo". */
  | 'demorou'
  /** Remédios na lista e leitura vinculada à anotação. */
  | 'pronta'
  | 'falhou'
  /** A leitura saiu de PROCESSANDO para um estado que não serve mais (já usada). */
  | 'jaUsada'
  /** A consulta da leitura falhou seguidas vezes (rede). */
  | 'erroConsulta'

export type AvisoLeituraReceita =
  | { tipo: 'problema'; problema: ProblemaArquivoLeitura; maximo: number }
  | { tipo: 'semVaga' }
  /** Mensagem da API (já no idioma do pedido) ou de rede. */
  | { tipo: 'mensagem'; texto: string }

/** Aviso da leitura pronta (receita de exemplo, outro pet, letra difícil), com o texto da API. */
export type AvisoDaLeitura = LeituraReceitaParceiro['avisos'][number]

export type ResultadoLeituraReceita = {
  /** Remédios lidos (antes do teto da lista). */
  lidos: number
  aplicados: number
  cortados: number
  /** Algum campo aplicado ficou com "Confira". */
  temConferir: boolean
  /** Na ordem da API, que põe o de documento modelo primeiro. */
  avisos: AvisoDaLeitura[]
}

export type VinculoLeituraReceita = {
  id: string
  /** Quantos arquivos a API vai copiar como anexo da anotação. */
  arquivos: number
  pdf: boolean
}

type Opcoes = {
  compartilhamentoId: MaybeRefOrGetter<string>
  /** Mesmo formato do `useParceiroPortal`: `undefined` quando não há parceiro escolhido. */
  parceiroQuery: () => { parceiroId?: string | null } | undefined
  /** Anexos já escolhidos no formulário da anotação. */
  anexosDoFormulario: MaybeRefOrGetter<number>
  /** Põe os remédios lidos no formulário. Chamado uma vez por leitura. */
  aoLer: (leitura: LeituraReceitaParceiro) => Omit<ResultadoLeituraReceita, 'lidos' | 'avisos'>
  /** 409: o acesso encerrou com a tela aberta. */
  aoEncerrarAcesso: () => void
  /** 503 (ou acesso que não é de consulta): o botão some; a tela avisa com a mensagem da API. */
  aoFicarIndisponivel?: (mensagem: string) => void
  /** Troca a redução da imagem (testes). */
  reduzirImagem?: (arquivo: File) => Promise<File>
}

function mensagemDoErro(erro: unknown): string {
  return erro instanceof Error ? erro.message : ''
}

/** Só os avisos com texto: a API já manda a mensagem no idioma do pedido, e o portal não traduz código. */
function avisosComTexto(leitura: LeituraReceitaParceiro): AvisoDaLeitura[] {
  if (!Array.isArray(leitura.avisos)) {
    return []
  }

  return leitura.avisos.filter(
    (aviso) => typeof aviso?.mensagem === 'string' && aviso.mensagem.trim() !== '',
  )
}

export function useLeituraReceitaParceiro(opcoes: Opcoes) {
  const reduzir = opcoes.reduzirImagem ?? reduzirImagemParaLeitura

  const disponivel = ref(true)
  const etapa = ref<EtapaLeituraReceita>('inicial')
  const arquivos = shallowRef<File[]>([])
  /** Reduzindo as fotos escolhidas. */
  const preparando = ref(false)
  const aviso = shallowRef<AvisoLeituraReceita | null>(null)
  const leituraId = ref<string | null>(null)
  const resultado = shallowRef<ResultadoLeituraReceita | null>(null)
  const vinculo = shallowRef<VinculoLeituraReceita | null>(null)
  const mensagemFalha = ref<string | null>(null)
  const erroConsulta = ref<string | null>(null)

  /** Muda a cada cancelamento: resposta de uma rodada antiga é ignorada. */
  let geracao = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let inicioEspera = 0
  let tentativa = 0
  let falhasSeguidas = 0

  const vagas = computed(() => vagasParaLeitura(toValue(opcoes.anexosDoFormulario)))

  /** Arquivos da receita que vão (ou podem ir) como anexo: ocupam lugar desde a escolha. */
  const reservados = computed(() => {
    if (etapa.value === 'pronta') {
      return vinculo.value?.arquivos ?? 0
    }

    const comArquivos: EtapaLeituraReceita[] = [
      'escolhendo',
      'enviando',
      'lendo',
      'demorou',
      'erroConsulta',
    ]

    return comArquivos.includes(etapa.value) ? arquivos.value.length : 0
  })

  /** Receita escolhida ou em leitura: mandar a anotação agora perderia a leitura. */
  const ocupada = computed(
    () =>
      preparando.value ||
      etapa.value === 'escolhendo' ||
      etapa.value === 'enviando' ||
      etapa.value === 'lendo' ||
      etapa.value === 'demorou',
  )

  /** Vai no `POST .../anotacoes`. */
  const leituraReceitaId = computed(() =>
    etapa.value === 'pronta' ? (vinculo.value?.id ?? null) : null,
  )

  const podeAdicionar = computed(() => cabeMaisArquivoLeitura(arquivos.value, vagas.value))

  function pararEspera() {
    geracao += 1

    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  /** Volta ao botão. Os remédios que já entraram na lista ficam. */
  function limpar() {
    pararEspera()
    etapa.value = 'inicial'
    arquivos.value = []
    preparando.value = false
    aviso.value = null
    leituraId.value = null
    resultado.value = null
    vinculo.value = null
    mensagemFalha.value = null
    erroConsulta.value = null
  }

  function marcarIndisponivel() {
    disponivel.value = false
    limpar()
  }

  function aoTerminar(leitura: LeituraReceitaParceiro, id: string) {
    if (leitura.status === 'AGUARDANDO_CONFIRMACAO') {
      const aplicado = opcoes.aoLer(leitura)
      const daLeitura = Array.isArray(leitura.arquivos) ? leitura.arquivos : []

      resultado.value = {
        lidos: Array.isArray(leitura.itensFormulario) ? leitura.itensFormulario.length : 0,
        ...aplicado,
        avisos: avisosComTexto(leitura),
      }
      vinculo.value = {
        id,
        arquivos: daLeitura.length || arquivos.value.length,
        pdf: daLeitura.some((a) => a.mimetype === 'application/pdf') || arquivos.value.some(ehPdf),
      }
      etapa.value = 'pronta'
      return
    }

    if (leitura.status === 'FALHOU') {
      mensagemFalha.value = leitura.mensagemFalha
      etapa.value = 'falhou'
      return
    }

    etapa.value = 'jaUsada'
  }

  function agendar(minha: number, id: string) {
    timer = setTimeout(() => void consultar(minha, id), intervaloDaEspera(tentativa))
  }

  async function consultar(minha: number, id: string) {
    if (minha !== geracao) {
      return
    }

    tentativa += 1

    try {
      const leitura = await getLeituraReceita(
        toValue(opcoes.compartilhamentoId),
        id,
        opcoes.parceiroQuery(),
      )

      if (minha !== geracao) {
        return
      }

      falhasSeguidas = 0

      if (leitura.status === 'PROCESSANDO') {
        if (Date.now() - inicioEspera >= ESPERA_MAXIMA_MS) {
          etapa.value = 'demorou'
          return
        }

        agendar(minha, id)
        return
      }

      aoTerminar(leitura, id)
    } catch (erro) {
      if (minha !== geracao) {
        return
      }

      if (erro instanceof ApiError && erro.statusCode === 409) {
        limpar()
        opcoes.aoEncerrarAcesso()
        return
      }

      falhasSeguidas += 1

      if (falhasSeguidas >= FALHAS_SEGUIDAS_MAX) {
        erroConsulta.value = mensagemDoErro(erro)
        etapa.value = 'erroConsulta'
        return
      }

      agendar(minha, id)
    }
  }

  function esperar(id: string) {
    pararEspera()
    const minha = geracao
    inicioEspera = Date.now()
    tentativa = 0
    falhasSeguidas = 0
    erroConsulta.value = null
    etapa.value = 'lendo'
    agendar(minha, id)
  }

  /** Arquivos do seletor. HEIC, tipo errado e mistura de PDF com foto viram aviso. */
  async function adicionarArquivos(lista: File[]) {
    aviso.value = null

    if (vagas.value <= 0) {
      aviso.value = { tipo: 'semVaga' }
      return
    }

    const minha = geracao
    preparando.value = true

    try {
      for (const arquivo of lista) {
        const atuais = arquivos.value
        const problema = problemaDoArquivoLeitura(atuais, arquivo, vagas.value)

        if (problema) {
          aviso.value = {
            tipo: 'problema',
            problema,
            maximo: atuais.some(ehPdf) ? 1 : vagas.value,
          }
          continue
        }

        let final = arquivo

        if (!ehPdf(arquivo)) {
          try {
            final = await reduzir(arquivo)
          } catch {
            aviso.value = { tipo: 'problema', problema: 'TIPO', maximo: vagas.value }
            continue
          }

          if (minha !== geracao) {
            return
          }

          const grande = problemaDaImagemReduzida(final)

          if (grande) {
            aviso.value = { tipo: 'problema', problema: grande, maximo: vagas.value }
            continue
          }
        }

        arquivos.value = [...arquivos.value, final]
      }
    } finally {
      if (minha === geracao) {
        preparando.value = false
      }
    }

    if (arquivos.value.length && etapa.value === 'inicial') {
      etapa.value = 'escolhendo'
    }
  }

  function removerArquivo(indice: number) {
    aviso.value = null
    arquivos.value = arquivos.value.filter((_, i) => i !== indice)

    if (!arquivos.value.length) {
      etapa.value = 'inicial'
    }
  }

  async function enviar() {
    const lista = arquivos.value

    if (etapa.value !== 'escolhendo' || preparando.value || !lista.length) {
      return
    }

    if (lista.length > vagas.value) {
      aviso.value = {
        tipo: 'problema',
        problema: 'LIMITE',
        maximo: lista.some(ehPdf) ? 1 : vagas.value,
      }
      return
    }

    const minha = geracao
    aviso.value = null
    etapa.value = 'enviando'

    try {
      const criada = await criarLeituraReceita(
        toValue(opcoes.compartilhamentoId),
        lista,
        opcoes.parceiroQuery(),
      )

      if (minha !== geracao) {
        return
      }

      // 200 `reaproveitada`: o mesmo arquivo já está em leitura neste acesso; segue o mesmo id.
      leituraId.value = criada.id
      esperar(criada.id)
    } catch (erro) {
      if (minha !== geracao) {
        return
      }

      if (erro instanceof ApiError) {
        if (erro.statusCode === 503 || erro.reason === 'LEITURA_RECEITA_TIPO_ACESSO_INVALIDO') {
          marcarIndisponivel()
          opcoes.aoFicarIndisponivel?.(erro.message)
          return
        }

        if (erro.statusCode === 409) {
          limpar()
          opcoes.aoEncerrarAcesso()
          return
        }
      }

      // 429 (limite do dia da equipe), 413, 415 e rede: a mensagem e os mesmos arquivos, para
      // tentar de novo ou trocar.
      aviso.value = { tipo: 'mensagem', texto: mensagemDoErro(erro) }
      etapa.value = 'escolhendo'
    }
  }

  /** "Ver de novo" depois do "Ainda estou lendo" ou do erro de rede. */
  function verDeNovo() {
    if (leituraId.value) {
      esperar(leituraId.value)
    }
  }

  onScopeDispose(pararEspera)

  return reactive({
    disponivel,
    etapa,
    arquivos,
    preparando,
    aviso,
    vagas,
    podeAdicionar,
    resultado: computed(() => (etapa.value === 'pronta' ? resultado.value : null)),
    vinculo: computed(() => (etapa.value === 'pronta' ? vinculo.value : null)),
    mensagemFalha,
    erroConsulta,
    reservados,
    ocupada,
    leituraReceitaId,
    adicionarArquivos,
    removerArquivo,
    enviar,
    verDeNovo,
    /** Cancela, fecha o aviso ou tira o vínculo ("Não anexar a receita"). */
    limpar,
    marcarIndisponivel,
  })
}

export type LeituraReceitaParceiroEstado = ReturnType<typeof useLeituraReceitaParceiro>
