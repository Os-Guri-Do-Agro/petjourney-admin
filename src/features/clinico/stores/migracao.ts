/**
 * Store do migrador de dados.
 *
 * Uma importação por vez, em três etapas — uma coisa por vez:
 *
 * 1. **Arquivo.** Um arquivo da pessoa ou uma das demonstrações.
 * 2. **Dúvidas.** Uma pergunta por vez, na ordem da fila (`perguntas`). Só o que o sistema não
 *    consegue decidir sozinho vira pergunta: a coluna obrigatória que ele não achou, a espécie
 *    que não reconheceu, e o que só a pessoa sabe (mesma pessoa? de quem é este animal?). Toda
 *    pergunta tem uma resposta segura — ninguém fica preso nela. Sem pergunta, a etapa passa
 *    sozinha.
 * 3. **Importar.** O resumo, o botão, o progresso em lotes e o relatório. Nada é gravado antes do
 *    botão, e o botão não anda com pergunta sem resposta. Pausa e continua; se um lote falha, a
 *    importação para ali e retoma do mesmo lote.
 *
 * **As colunas não são uma etapa.** Havia uma, e o retorno foi direto: quem opera o balcão não
 * entende "mapeamento de colunas", e não precisa — o sistema liga as colunas sozinho (todas, nos
 * exports conhecidos; quase todas, na planilha feita à mão). Só a coluna sem a qual não dá para
 * importar (nome do animal, nome do responsável) vira pergunta, e só quando ele não a acha. Quem
 * quiser conferir abre o painel de colunas pelo resumo; nada fica de fora calado.
 *
 * **A importação não depende da tela aberta.** O laço mora aqui, e a página só observa: dá para
 * sair, abrir a agenda, e voltar para ver onde está — a lista de pacientes avisa enquanto houver
 * importação pausada ou em andamento. Na API isto é um job no servidor, retomável de qualquer
 * aparelho; no protótipo vive na memória da aba (recarregar a página recomeça o mock inteiro).
 *
 * O plano que está sendo importado **congela** no começo da importação. Sem isso, cada lote
 * gravado mudaria a base, o plano recalculado passaria a achar "já cadastrado" em tudo o que
 * acabou de entrar, e o relatório contaria a importação como se ela tivesse juntado tudo.
 */

import { defineStore } from 'pinia'
import { computed, ref, shallowRef } from 'vue'

import {
  DEMONSTRACOES,
  gradeDaDemonstracao,
  type DemonstracaoId,
} from '../data/fixtures/planilhas-de-demonstracao'
import { FalhaNaLeitura, lerArquivo, type ErroDeLeitura } from '../data/leitura-de-planilha'
import { MockError } from '../data/mock-runtime'
import {
  migracaoRepository,
  type ResultadoDaLinha,
  type VinculosDaImportacao,
} from '../data/repositories'
import {
  faltasDoMapeamento,
  lerRegistros,
  planejar,
  reconhecerOrigem,
  sugerirMapeamento,
  valoresDeEspecie,
  type BaseAtual,
  especiePelaRaca,
  normalizarRotulo,
  type CampoDeDestino,
  type Decisao,
  type EscolhaDeEspecie,
  type ItemDoPlano,
  type MapeamentoDaColuna,
  type OpcaoDaDecisao,
  type Plano,
  type TipoDeDecisao,
} from '../domain/migracao'
import { montarPlanilha, type PlanilhaLida } from '../domain/planilha'

import { clinicClock, useClinicoStore } from './clinico'

export type EtapaDaMigracao = 'arquivo' | 'duvidas' | 'importar'

/**
 * Uma pergunta da etapa de dúvidas. As duas espécies de pergunta andam na mesma fila porque, para
 * quem responde, são a mesma coisa: algo que o sistema não sabe e a pessoa sabe.
 */
export type PerguntaDaMigracao =
  | {
      id: string
      tipo: 'especie'
      /** Valor normalizado da célula; `''` é a espécie em branco. */
      chave: string
      /** Como está escrito na planilha. */
      exemplo: string
      /** Os animais que dependem da resposta — os que nem a raça resolve. */
      animais: Array<{ linha: number; nome: string }>
      resposta: EscolhaDeEspecie | null
    }
  | { id: string; tipo: 'decisao'; decisao: Decisao; resposta: OpcaoDaDecisao | null }
  | {
      id: string
      tipo: 'coluna'
      /** O campo obrigatório que o sistema não achou em coluna nenhuma. */
      campo: CampoDeDestino
      /** A coluna escolhida (índice), ou `null` enquanto ninguém respondeu. */
      resposta: number | null
    }
export type EstadoDaImportacao = 'parada' | 'rodando' | 'pausada' | 'falhou' | 'concluida'

/**
 * Linhas por lote. Pequeno o bastante para o progresso andar a cada fração de segundo e para
 * uma falha perder pouco; grande o bastante para 2.400 linhas não virarem 2.400 chamadas.
 */
export const TAMANHO_DO_LOTE = 80

const VINCULOS_VAZIOS: VinculosDaImportacao = { tutores: {}, animais: {} }

export const useMigracaoStore = defineStore('clinico-migracao', () => {
  const etapa = ref<EtapaDaMigracao>('arquivo')
  const planilha = shallowRef<PlanilhaLida | null>(null)
  const demonstracao = ref<DemonstracaoId | null>(null)
  const lendo = ref(false)
  const erroDeLeitura = ref<ErroDeLeitura | null>(null)

  const mapeamento = ref<MapeamentoDaColuna[]>([])
  const especies = ref<Record<string, EscolhaDeEspecie>>({})
  const escolhas = ref<Record<string, OpcaoDaDecisao>>({})
  const base = shallowRef<BaseAtual>({ tutores: [], pets: [] })
  /** Os obrigatórios que viraram pergunta. Fica na fila depois de respondido, para dar para voltar. */
  const camposPerguntados = ref<CampoDeDestino[]>([])

  const estado = ref<EstadoDaImportacao>('parada')
  const planoImportado = shallowRef<Plano | null>(null)
  /** Só o que grava alguma coisa. As linhas de fora já nascem com resultado. */
  const fila = shallowRef<ItemDoPlano[]>([])
  const cursor = ref(0)
  const resultados = shallowRef<ResultadoDaLinha[]>([])
  const vinculos = shallowRef<VinculosDaImportacao>(VINCULOS_VAZIOS)
  const erroDaImportacao = ref<string | null>(null)
  const iniciadaEm = ref<string | null>(null)
  const concluidaEm = ref<string | null>(null)
  /** Um lote saiu e não voltou. Pausar agora espera por ele. */
  const loteEmVoo = ref(false)

  /* Troca a cada recomeço: um lote que volta depois do recomeço não escreve em lugar nenhum. */
  let execucao = 0
  let lacoAtivo = false

  // ------------------------------------------------------------------ derivados

  const origem = computed(() =>
    planilha.value ? reconhecerOrigem(planilha.value.cabecalhos) : null,
  )

  const leitura = computed(() =>
    planilha.value
      ? lerRegistros(planilha.value, mapeamento.value, {
          hoje: clinicClock.today(),
          ddd: migracaoRepository.dddDaClinica(),
          especies: especies.value,
        })
      : null,
  )

  const valores = computed(() =>
    planilha.value ? valoresDeEspecie(planilha.value, mapeamento.value) : [],
  )

  const faltas = computed(() => faltasDoMapeamento(mapeamento.value))

  const planoAoVivo = computed(() =>
    leitura.value ? planejar(leitura.value.registros, base.value, escolhas.value) : null,
  )

  /** O plano que a tela mostra: o congelado, depois que a importação começou. */
  const plano = computed(() => planoImportado.value ?? planoAoVivo.value)

  const pendentes = computed(
    () => planoAoVivo.value?.decisoes.filter((decisao) => decisao.escolha === null).length ?? 0,
  )

  /*
   * A fila de perguntas. Respondida continua na fila — é o que deixa voltar à anterior e mudar de
   * ideia. Pergunta de decisão só entra quando não tem resposta automática: semelhança forte
   * (mesmo CPF, mesmo telefone) se resolve sozinha e aparece no resumo, não aqui.
   */
  const perguntas = computed<PerguntaDaMigracao[]>(() => {
    const atual = planilha.value

    if (!atual) {
      return []
    }

    const colunaDe = (campo: CampoDeDestino) =>
      mapeamento.value.find((item) => item.destino === campo)?.coluna
    const colunaEspecie = colunaDe('especie')
    const colunaRaca = colunaDe('raca')
    const colunaNome = colunaDe('petNome')

    const deEspecie: PerguntaDaMigracao[] = valores.value
      .filter((valor) => !valor.sugestao && valor.ocorrencias - valor.pelaRaca > 0)
      .map((valor) => ({
        id: `especie:${valor.chave}`,
        tipo: 'especie' as const,
        chave: valor.chave,
        exemplo: valor.exemplo,
        animais: atual.linhas.flatMap((celulas, indice) => {
          const bruto = colunaEspecie === undefined ? '' : (celulas[colunaEspecie] ?? '')
          const nome = colunaNome === undefined ? '' : (celulas[colunaNome] ?? '')
          const raca = colunaRaca === undefined ? '' : (celulas[colunaRaca] ?? '')

          return normalizarRotulo(bruto) === valor.chave && nome && !especiePelaRaca(raca)
            ? [{ linha: atual.linhaDoCabecalho + 1 + indice, nome }]
            : []
        }),
        resposta: especies.value[valor.chave] ?? null,
      }))

    const deColuna: PerguntaDaMigracao[] = camposPerguntados.value.map((campo) => ({
      id: `coluna:${campo}`,
      tipo: 'coluna' as const,
      campo,
      resposta: colunaDe(campo) ?? null,
    }))

    /* Sem as colunas obrigatórias, o resto da fila seria calculado sobre leitura sem sentido. */
    if (faltas.value.length > 0) {
      return deColuna
    }

    const deDecisao: PerguntaDaMigracao[] = (planoAoVivo.value?.decisoes ?? [])
      .filter((decisao) => decisao.padrao === null)
      .map((decisao) => ({
        id: decisao.id,
        tipo: 'decisao' as const,
        decisao,
        resposta: decisao.escolha,
      }))

    return [...deColuna, ...deEspecie, ...deDecisao]
  })

  const semResposta = computed(
    () => perguntas.value.filter((pergunta) => pergunta.resposta === null).length,
  )

  const total = computed(() => fila.value.length)

  /** Há importação começada e não terminada — a lista de pacientes avisa, e trocar de arquivo espera. */
  const emAndamento = computed(
    () => estado.value === 'rodando' || estado.value === 'pausada' || estado.value === 'falhou',
  )

  const resultadoPorLinha = computed(
    () => new Map(resultados.value.map((resultado) => [resultado.linha, resultado])),
  )

  // ------------------------------------------------------------------ arquivo

  function limparImportacao() {
    execucao += 1
    lacoAtivo = false
    loteEmVoo.value = false
    estado.value = 'parada'
    planoImportado.value = null
    fila.value = []
    cursor.value = 0
    resultados.value = []
    vinculos.value = VINCULOS_VAZIOS
    erroDaImportacao.value = null
    iniciadaEm.value = null
    concluidaEm.value = null
  }

  function comecar(nova: PlanilhaLida, id: DemonstracaoId | null) {
    limparImportacao()
    planilha.value = nova
    demonstracao.value = id
    mapeamento.value = sugerirMapeamento(nova)
    especies.value = {}
    escolhas.value = {}
    erroDeLeitura.value = null
    /* A base entra aqui: é contra ela que o repetido é procurado, e as perguntas já dependem disso. */
    base.value = migracaoRepository.base()
    camposPerguntados.value = faltasDoMapeamento(mapeamento.value)
    etapa.value = 'duvidas'
    seguirSemPerguntas()
  }

  /** Nada a perguntar: a etapa de dúvidas passa sozinha, direto para o resumo. */
  function seguirSemPerguntas() {
    if (etapa.value === 'duvidas' && perguntas.value.length === 0 && pendentes.value === 0) {
      etapa.value = 'importar'
    }
  }

  async function abrirArquivo(arquivo: File) {
    if (emAndamento.value) {
      return
    }

    lendo.value = true
    erroDeLeitura.value = null

    try {
      comecar(await lerArquivo(arquivo), null)
    } catch (erro) {
      erroDeLeitura.value = erro instanceof FalhaNaLeitura ? erro.kind : 'corrompido'
    } finally {
      lendo.value = false
    }
  }

  function usarDemonstracao(id: DemonstracaoId) {
    if (emAndamento.value) {
      return
    }

    const item = DEMONSTRACOES.find((demonstracao) => demonstracao.id === id)!

    comecar(
      montarPlanilha(gradeDaDemonstracao(id), {
        arquivo: item.arquivo,
        formato: 'demonstracao',
        codificacao: null,
      }),
      id,
    )
  }

  // ------------------------------------------------------------------ colunas

  /**
   * Um campo vai para uma coluna só. Escolher "Telefone" numa coluna tira o "Telefone" da coluna
   * que o tinha — a tela mostra as duas mudando, e a pessoa vê o que acabou de trocar.
   */
  function mapear(coluna: number, destino: CampoDeDestino | null) {
    mapeamento.value = mapeamento.value.map((item) => {
      if (item.coluna === coluna) {
        return { ...item, destino, confianca: destino ? 'certa' : 'nenhuma', como: 'pessoa' }
      }

      if (destino && item.destino === destino) {
        return { ...item, destino: null, confianca: 'nenhuma', como: 'pessoa' }
      }

      return item
    })
  }

  /**
   * Guarda na fila o obrigatório que falta agora. Guardado, ele não some quando for respondido —
   * a pergunta continua lá para quem voltar e quiser mudar de ideia.
   */
  function lembrarFaltas() {
    camposPerguntados.value = [...new Set([...camposPerguntados.value, ...faltas.value])]
  }

  /**
   * A resposta à pergunta de coluna: é só mapear o campo naquela coluna. Se a coluna escolhida era
   * a do outro obrigatório, esse outro passa a faltar — e vira a próxima pergunta.
   */
  function responderColuna(campo: CampoDeDestino, coluna: number) {
    mapear(coluna, campo)
    lembrarFaltas()
  }

  /**
   * Quem mexeu nas colunas pelo painel pode ter tirado um obrigatório. Aí ele volta como pergunta,
   * no lugar de sempre, em vez de o resumo quebrar calado.
   */
  function conferirObrigatorias() {
    if (faltas.value.length === 0 || estado.value !== 'parada') {
      return
    }

    lembrarFaltas()
    etapa.value = 'duvidas'
  }

  function escolherEspecie(chave: string, escolha: EscolhaDeEspecie | null) {
    const novas = { ...especies.value }

    if (escolha === null) {
      delete novas[chave]
    } else {
      novas[chave] = escolha
    }

    especies.value = novas
  }

  /** A base é relida na volta às dúvidas: outra importação pode ter terminado nesse meio-tempo. */
  function abrirDuvidas() {
    if (!planilha.value || estado.value !== 'parada') {
      return
    }

    base.value = migracaoRepository.base()
    etapa.value = 'duvidas'
  }

  /** O resumo antes do botão. Só abre com toda pergunta respondida. */
  function abrirResumo() {
    if (!planilha.value || estado.value !== 'parada') {
      return
    }

    if (faltas.value.length > 0) {
      conferirObrigatorias()

      return
    }

    if (etapa.value !== 'duvidas') {
      base.value = migracaoRepository.base()
    }

    if (semResposta.value > 0 || pendentes.value > 0) {
      etapa.value = 'duvidas'

      return
    }

    etapa.value = 'importar'
  }

  /** Voltar é livre até o botão de importar; depois dele, o plano está congelado. */
  function irPara(destino: EtapaDaMigracao) {
    if (estado.value !== 'parada') {
      return
    }

    if (destino === 'duvidas') {
      abrirDuvidas()
    } else if (destino === 'importar') {
      abrirResumo()
    } else {
      etapa.value = destino
    }
  }

  // ----------------------------------------------------------------- decisões

  function escolher(id: string, opcao: OpcaoDaDecisao) {
    escolhas.value = { ...escolhas.value, [id]: opcao }
  }

  /** Responde de uma vez todas as pendentes de um tipo — o caminho para quem confere cinquenta. */
  function escolherPendentes(tipo: TipoDeDecisao, opcao: OpcaoDaDecisao) {
    const novas = { ...escolhas.value }

    for (const decisao of planoAoVivo.value?.decisoes ?? []) {
      if (decisao.tipo === tipo && decisao.escolha === null) {
        novas[decisao.id] = opcao
      }
    }

    escolhas.value = novas
  }

  // ---------------------------------------------------------------- importação

  async function rodar() {
    if (lacoAtivo) {
      return
    }

    lacoAtivo = true
    const minha = execucao

    try {
      while (estado.value === 'rodando' && cursor.value < fila.value.length) {
        const lote = fila.value.slice(cursor.value, cursor.value + TAMANHO_DO_LOTE)

        loteEmVoo.value = true

        try {
          const resposta = await migracaoRepository.importarLote(lote, vinculos.value)

          if (minha !== execucao) {
            return
          }

          resultados.value = [...resultados.value, ...resposta.resultados]
          vinculos.value = resposta.vinculos
          cursor.value += lote.length
        } catch (erro) {
          if (minha !== execucao) {
            return
          }

          estado.value = 'falhou'
          erroDaImportacao.value = erro instanceof MockError ? erro.kind : 'falha-servidor'

          return
        } finally {
          if (minha === execucao) {
            loteEmVoo.value = false
          }
        }
      }

      if (cursor.value >= fila.value.length && estado.value === 'rodando') {
        estado.value = 'concluida'
        concluidaEm.value = clinicClock.nowIso()

        const clinico = useClinicoStore()

        await clinico.carregar(true)
        clinico.invalidarTudo()
      }
    } finally {
      if (minha === execucao) {
        lacoAtivo = false
      }
    }
  }

  async function importar() {
    const atual = planoAoVivo.value

    if (!atual || pendentes.value > 0 || semResposta.value > 0 || estado.value !== 'parada') {
      return
    }

    planoImportado.value = atual
    fila.value = atual.itens.filter((item) => item.situacao !== 'fora')
    resultados.value = atual.itens
      .filter((item) => item.situacao === 'fora')
      .map((item) => ({ linha: item.linha, situacao: 'fora', tutorId: null, petId: null }))
    cursor.value = 0
    vinculos.value = VINCULOS_VAZIOS
    erroDaImportacao.value = null
    iniciadaEm.value = clinicClock.nowIso()
    etapa.value = 'importar'
    estado.value = 'rodando'

    await rodar()
  }

  /** O lote em andamento termina; o próximo não sai. */
  function pausar() {
    if (estado.value === 'rodando') {
      estado.value = 'pausada'
    }
  }

  /** Do mesmo lote em que parou. Se a pausa pegou um lote no ar, o laço que já existe segue com ele. */
  async function continuar() {
    if (estado.value !== 'pausada' && estado.value !== 'falhou') {
      return
    }

    erroDaImportacao.value = null
    estado.value = 'rodando'

    await rodar()
  }

  /** Outro arquivo. Não vale no meio de uma importação — pausada ou não, ela precisa acabar antes. */
  function recomecar() {
    if (emAndamento.value) {
      return
    }

    limparImportacao()
    planilha.value = null
    demonstracao.value = null
    mapeamento.value = []
    especies.value = {}
    escolhas.value = {}
    base.value = { tutores: [], pets: [] }
    camposPerguntados.value = []
    erroDeLeitura.value = null
    etapa.value = 'arquivo'
  }

  /** Para os testes e para o painel de desenvolvimento: tudo de volta ao zero, inclusive no meio. */
  function $limpar() {
    limparImportacao()
    recomecar()
  }

  return {
    etapa,
    planilha,
    demonstracao,
    lendo,
    erroDeLeitura,
    mapeamento,
    especies,
    escolhas,
    estado,
    cursor,
    total,
    resultados,
    resultadoPorLinha,
    erroDaImportacao,
    iniciadaEm,
    concluidaEm,
    loteEmVoo,
    origem,
    leitura,
    valores,
    faltas,
    plano,
    pendentes,
    perguntas,
    semResposta,
    emAndamento,
    abrirArquivo,
    usarDemonstracao,
    mapear,
    escolherEspecie,
    abrirDuvidas,
    abrirResumo,
    responderColuna,
    conferirObrigatorias,
    irPara,
    escolher,
    escolherPendentes,
    importar,
    pausar,
    continuar,
    recomecar,
    $limpar,
  }
})
