/**
 * O migrador da base da clínica pela API (E2-05, PJ-NSCETD; guia e2, seção 4).
 *
 * Três etapas, como na demonstração:
 *
 * 1. **Arquivo.** O arquivo é lido no navegador, as colunas são ligadas sozinhas e o que só a pessoa
 *    sabe vira pergunta antes de mandar: a coluna obrigatória que não se achou e a espécie que nem o
 *    nome nem a raça resolvem. Depois as linhas vão em lotes de 500, cada uma como está na célula.
 * 2. **Dúvidas.** As do servidor (quem já é cliente, quem se repete, o animal sem responsável), uma
 *    por vez, até a importação ficar `PRONTA`.
 * 3. **Importar.** O resumo, a confirmação e o acompanhamento do job no servidor, que segue com a aba
 *    fechada; depois o relatório, o desfazer e as propostas de vínculo.
 *
 * O arquivo fica na memória enquanto se navega pelo portal (para o painel de colunas e para baixar as
 * linhas que não entraram). A importação mora no servidor: ao abrir a tela, a aberta mais recente
 * volta pelo histórico, de qualquer aparelho.
 */
import { defineStore } from 'pinia'
import { computed, ref, shallowRef, watch } from 'vue'

import {
  colunaDe,
  dddDoTelefone,
  emLotes,
  faltasObrigatorias,
  hashDoConteudo,
  ligar,
  ligarColunas,
  linhasParaEnviar,
  ordemDaColunaDeNascimento,
  origemDaPlanilha,
  perguntasDeEspecie,
  type ColunaLigada,
  type EscolhaDeEspecie,
  type PerguntaDeEspecie,
} from '@/components/importacao/planilha-para-a-api'
import {
  DEMONSTRACOES,
  gradeDaDemonstracao,
  type DemonstracaoId,
} from '@/features/clinico/data/fixtures/planilhas-de-demonstracao'
import {
  FalhaNaLeitura,
  lerArquivo,
  type ErroDeLeitura,
} from '@/features/clinico/data/leitura-de-planilha'
import { escreverCsv, montarPlanilha, type PlanilhaLida } from '@/features/clinico/domain/planilha'
import { novaChaveDeIdempotencia } from '@/service/idempotencia'
import { obterEstabelecimento } from '@/service/parceiro/estabelecimento-service'
import {
  LINHAS_POR_CHAMADA,
  LINHAS_POR_IMPORTACAO,
  STATUS_ABERTOS,
  confirmarImportacao,
  continuarImportacao,
  criarImportacao,
  descartarImportacao,
  desfazerImportacao,
  enviarLinhas,
  listarImportacoes,
  obterImportacao,
  pausarImportacao,
  proporVinculos,
  type CampoDaLinha,
  type Importacao,
  type StatusDaImportacao,
} from '@/service/parceiro/importacao-service'
import { useParceiroStore } from '@/stores/parceiro'
import { criarUltimaLeitura } from '@/utils/ultima-leitura'

export type EtapaDaImportacao = 'arquivo' | 'duvidas' | 'importar'

/** A pergunta que o portal faz antes de mandar: a coluna obrigatória ou a espécie. */
export type PerguntaLocal =
  | { id: string; tipo: 'coluna'; campo: CampoDaLinha; resposta: number | null }
  | {
      id: string
      tipo: 'especie'
      pergunta: PerguntaDeEspecie
      resposta: EscolhaDeEspecie | null
    }

export type EnvioDasLinhas = {
  /** Linhas que a API já recebeu. */
  feitas: number
  total: number
  /** O próximo lote a sair: ao tentar de novo, segue dele, com a mesma chave. */
  lote: number
  parado: boolean
}

/** Acabou: dá para abrir outro arquivo. */
export const STATUS_FINAIS: readonly StatusDaImportacao[] = ['CONCLUIDA', 'DESFEITA', 'CANCELADA']

export const useImportacaoStore = defineStore('importacao-da-base', () => {
  const parceiro = useParceiroStore()

  function query() {
    return parceiro.parceiroId ? { parceiroId: parceiro.parceiroId } : undefined
  }

  /* ---------------------------------------------------------------------------- arquivo */

  const planilha = shallowRef<PlanilhaLida | null>(null)
  const hash = ref<string | null>(null)
  const demonstracao = ref<DemonstracaoId | null>(null)
  const lendo = ref(false)
  const erroDeLeitura = ref<ErroDeLeitura | null>(null)
  const colunas = ref<ColunaLigada[]>([])
  const especies = ref<Record<string, EscolhaDeEspecie>>({})
  /** Os obrigatórios que viraram pergunta: ficam na fila depois de respondidos, para voltar a eles. */
  const camposPerguntados = ref<CampoDaLinha[]>([])

  /* --------------------------------------------------------------------------- servidor */

  const importacao = ref<Importacao | null>(null)
  const historico = ref<Importacao[]>([])
  const retomando = ref(false)
  const envio = ref<EnvioDasLinhas | null>(null)
  /** O mesmo arquivo já entrou: o envio espera a clínica dizer se importa de novo. */
  const jaImportadoEm = ref<string | null>(null)

  let chaveDaCriacao: string | null = null
  let chavesDosLotes = new Map<number, string>()
  /* Uma leitura que volta depois de uma ação (pausar, desfazer) não pode desfazer o que ela mostrou. */
  const leitura = criarUltimaLeitura()

  const faltas = computed(() => faltasObrigatorias(colunas.value))

  const perguntasLocais = computed<PerguntaLocal[]>(() => {
    const atual = planilha.value
    if (!atual) return []

    const deColuna: PerguntaLocal[] = camposPerguntados.value.map((campo) => ({
      id: `coluna:${campo}`,
      tipo: 'coluna',
      campo,
      resposta: colunaDe(colunas.value, campo) ?? null,
    }))

    /* Sem as colunas obrigatórias, a espécie seria lida sobre uma ligação sem sentido. */
    if (faltas.value.length > 0) return deColuna

    const deEspecie: PerguntaLocal[] = perguntasDeEspecie(atual, colunas.value).map((pergunta) => ({
      id: `especie:${pergunta.chave}`,
      tipo: 'especie',
      pergunta,
      resposta: especies.value[pergunta.chave] ?? null,
    }))

    return [...deColuna, ...deEspecie]
  })

  const semResposta = computed(
    () => perguntasLocais.value.filter((pergunta) => pergunta.resposta === null).length,
  )

  const grandeDemais = computed(() => (planilha.value?.linhas.length ?? 0) > LINHAS_POR_IMPORTACAO)

  const etapa = computed<EtapaDaImportacao>(() => {
    const status = importacao.value?.status
    if (!status || status === 'RECEBENDO_LINHAS') return 'arquivo'
    if (status === 'COM_DUVIDAS') return 'duvidas'
    return 'importar'
  })

  /** Arquivo trocado só com a importação acabada (ou sem nenhuma): a aberta precisa ser descartada. */
  const podeTrocarArquivo = computed(
    () => !envio.value && (!importacao.value || STATUS_FINAIS.includes(importacao.value.status)),
  )

  /** As colunas se ligam até as linhas saírem; depois disso, é o que o servidor recebeu. */
  const colunasTravadas = computed(() => Boolean(importacao.value))

  /* ------------------------------------------------------------------------ começar */

  function limparImportacao() {
    leitura.nova()
    importacao.value = null
    envio.value = null
    jaImportadoEm.value = null
    chaveDaCriacao = null
    chavesDosLotes = new Map()
  }

  function comecar(lida: PlanilhaLida, novoHash: string, id: DemonstracaoId | null) {
    limparImportacao()
    planilha.value = lida
    hash.value = novoHash
    demonstracao.value = id
    colunas.value = ligarColunas(lida)
    especies.value = {}
    camposPerguntados.value = faltasObrigatorias(colunas.value)
    erroDeLeitura.value = null
  }

  async function abrirArquivo(arquivo: File) {
    if (!podeTrocarArquivo.value) return

    lendo.value = true
    erroDeLeitura.value = null

    try {
      const [lida, bytes] = await Promise.all([lerArquivo(arquivo), arquivo.arrayBuffer()])
      comecar(lida, await hashDoConteudo(bytes), null)
    } catch (erro) {
      erroDeLeitura.value = erro instanceof FalhaNaLeitura ? erro.kind : 'corrompido'
    } finally {
      lendo.value = false
    }
  }

  /** As planilhas de demonstração, só no build de desenvolvimento (o smoke da API usa as mesmas). */
  async function usarDemonstracao(id: DemonstracaoId) {
    if (!podeTrocarArquivo.value) return

    const item = DEMONSTRACOES.find((demonstracao) => demonstracao.id === id)!
    const grade = gradeDaDemonstracao(id)
    const lida = montarPlanilha(grade, {
      arquivo: item.arquivo,
      formato: 'demonstracao',
      codificacao: null,
    })

    comecar(lida, await hashDoConteudo(new TextEncoder().encode(escreverCsv(grade))), id)
  }

  function recomecar() {
    if (!podeTrocarArquivo.value) return

    limparImportacao()
    planilha.value = null
    hash.value = null
    demonstracao.value = null
    colunas.value = []
    especies.value = {}
    camposPerguntados.value = []
    erroDeLeitura.value = null
  }

  /* --------------------------------------------------------------- colunas e espécie */

  function lembrarFaltas() {
    camposPerguntados.value = [...new Set([...camposPerguntados.value, ...faltas.value])]
  }

  function ligarColuna(coluna: number, campo: CampoDaLinha | null) {
    if (colunasTravadas.value) return
    colunas.value = ligar(colunas.value, coluna, campo)
    lembrarFaltas()
  }

  function escolherEspecie(chave: string, escolha: EscolhaDeEspecie | null) {
    if (colunasTravadas.value) return
    const novas = { ...especies.value }
    if (escolha) novas[chave] = escolha
    else delete novas[chave]
    especies.value = novas
  }

  /* -------------------------------------------------------------------------- enviar */

  async function dddDaClinica() {
    try {
      const { perfil } = await obterEstabelecimento(query())
      return dddDoTelefone(
        perfil?.telefonePublico ?? perfil?.whatsappPublico ?? perfil?.telefonePlantao ?? null,
      )
    } catch {
      return null
    }
  }

  /**
   * Cria a importação e manda as linhas. Com o mesmo arquivo já importado, para e espera a resposta
   * (`jaImportadoEm`); com erro no meio, para no lote que falhou, que sai de novo com a mesma chave.
   */
  async function enviar() {
    const lida = planilha.value
    if (!lida || !hash.value || envio.value || importacao.value) return
    if (semResposta.value > 0 || faltas.value.length > 0 || grandeDemais.value) return

    envio.value = { feitas: 0, total: lida.linhas.length, lote: 0, parado: false }

    try {
      chaveDaCriacao ??= novaChaveDeIdempotencia()
      const criada = await criarImportacao(
        {
          arquivoNome: lida.arquivo,
          hashArquivo: hash.value,
          totalLinhas: lida.linhas.length,
          ddd: await dddDaClinica(),
          ordemDasDatas: ordemDaColunaDeNascimento(lida, colunas.value),
          origemDetectada: origemDaPlanilha(lida),
        },
        chaveDaCriacao,
        query(),
      )

      importacao.value = await obterImportacao(criada.id, query())

      if (criada.jaImportadoEm) {
        jaImportadoEm.value = criada.jaImportadoEm
        envio.value = { ...envio.value, parado: true }
        return
      }

      await mandarLinhas()
    } catch (erro) {
      if (!importacao.value) envio.value = null
      else if (envio.value) envio.value = { ...envio.value, parado: true }
      throw erro
    }
  }

  async function mandarLinhas() {
    const lida = planilha.value
    const atual = importacao.value
    if (!lida || !atual || !envio.value) return

    const lotes = emLotes(linhasParaEnviar(lida, colunas.value, especies.value), LINHAS_POR_CHAMADA)
    envio.value = { ...envio.value, parado: false }

    try {
      for (let indice = envio.value.lote; indice < lotes.length; indice += 1) {
        const chave = chavesDosLotes.get(indice) ?? novaChaveDeIdempotencia()
        chavesDosLotes.set(indice, chave)

        const recebidas = await enviarLinhas(atual.id, lotes[indice]!, chave, query())
        envio.value = {
          feitas: recebidas.recebidas,
          total: recebidas.totalLinhas,
          lote: indice + 1,
          parado: false,
        }
      }
    } catch (erro) {
      if (envio.value) envio.value = { ...envio.value, parado: true }
      throw erro
    }

    envio.value = null
    await atualizar()
  }

  /** "Este arquivo já foi importado em {data}": sim manda as linhas; não descarta a importação. */
  async function responderReimportacao(importar: boolean) {
    jaImportadoEm.value = null
    if (importar) await mandarLinhas()
    else await descartar()
  }

  /* ------------------------------------------------------------------------ servidor */

  function aplicar(nova: Importacao) {
    leitura.nova()
    importacao.value = nova
    historico.value = historico.value.map((item) => (item.id === nova.id ? nova : item))
  }

  /** Relê o status: o acompanhamento chama a cada 1,5 s enquanto o servidor trabalha. */
  async function atualizar() {
    const atual = importacao.value
    if (!atual) return

    const vez = leitura.nova()
    const nova = await obterImportacao(atual.id, query())
    if (leitura.valendo(vez) && importacao.value?.id === nova.id) importacao.value = nova
  }

  /**
   * Ao abrir a tela: a importação desta sessão é relida; sem ela, a aberta mais recente do histórico
   * (a tela pode ter sido recarregada, ou a importação começou em outro aparelho).
   */
  async function retomar() {
    retomando.value = true

    try {
      const pagina = await listarImportacoes({ limite: 10 }, query())
      historico.value = pagina.itens

      if (importacao.value) {
        await atualizar()
        return
      }

      const aberta = pagina.itens.find((item) => STATUS_ABERTOS.includes(item.status))
      if (aberta) importacao.value = aberta
    } finally {
      retomando.value = false
    }
  }

  /** Uma importação do histórico: o relatório, o desfazer e as propostas. */
  async function abrir(id: string) {
    if (!podeTrocarArquivo.value) return
    const nova = await obterImportacao(id, query())
    limparImportacao()
    planilha.value = null
    hash.value = null
    importacao.value = nova
  }

  async function confirmar() {
    if (!importacao.value) return
    aplicar(await confirmarImportacao(importacao.value.id, query()))
  }

  async function pausar() {
    if (!importacao.value) return
    aplicar(await pausarImportacao(importacao.value.id, query()))
  }

  async function continuar() {
    if (!importacao.value) return
    aplicar(await continuarImportacao(importacao.value.id, query()))
  }

  async function desfazer() {
    if (!importacao.value) return
    aplicar(await desfazerImportacao(importacao.value.id, query()))
  }

  /** Antes de importar: nada foi gravado. O arquivo fica, para trocar uma coluna e mandar de novo. */
  async function descartar() {
    const atual = importacao.value
    if (!atual) return

    const descartada = await descartarImportacao(atual.id, query())
    historico.value = historico.value.map((item) => (item.id === atual.id ? descartada : item))
    limparImportacao()
  }

  async function propor() {
    if (!importacao.value) return null
    return proporVinculos(importacao.value.id, query())
  }

  /* Outra empresa, outra base: nada desta segue. */
  watch(
    () => parceiro.parceiroId,
    (novo, antigo) => {
      if (novo !== antigo) {
        limparImportacao()
        planilha.value = null
        hash.value = null
        colunas.value = []
        especies.value = {}
        camposPerguntados.value = []
        historico.value = []
      }
    },
  )

  return {
    planilha,
    hash,
    demonstracao,
    lendo,
    erroDeLeitura,
    colunas,
    especies,
    importacao,
    historico,
    retomando,
    envio,
    jaImportadoEm,
    faltas,
    perguntasLocais,
    semResposta,
    grandeDemais,
    etapa,
    podeTrocarArquivo,
    colunasTravadas,
    abrirArquivo,
    usarDemonstracao,
    recomecar,
    ligarColuna,
    escolherEspecie,
    enviar,
    mandarLinhas,
    responderReimportacao,
    atualizar,
    retomar,
    abrir,
    confirmar,
    pausar,
    continuar,
    desfazer,
    descartar,
    propor,
  }
})
