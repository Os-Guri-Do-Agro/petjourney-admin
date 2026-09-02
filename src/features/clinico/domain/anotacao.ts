/**
 * Do atendimento clínico para a anotação do prestador.
 *
 * É a ponte entre as duas implementações que este repositório tem dos mesmos conceitos: o
 * módulo clínico (`/veterinario/*`), que inventou o formato porque não havia contrato, e
 * `/parceiro/acessos`, que fala o contrato real e já está no ar.
 *
 * **A regra deste arquivo é não repetir o contrato.** Limites, campos por tipo de serviço,
 * validação e montagem do payload já moram em `@/utils/parceiro/anotacao-estruturada`, testados
 * contra o DTO do backend. Duplicá-los aqui criaria dois lugares para divergir, e divergir
 * significa 400 na cara de quem atendeu, com a anotação inteira perdida. Por isso a saída daqui
 * é o **formulário** que aquele módulo já sabe validar e montar — não um payload pronto.
 *
 * O que este arquivo faz de verdade é a parte que só o módulo clínico sabe: traduzir um
 * prontuário rico para campos pobres, e **dizer em voz alta o que não coube**. Nada é
 * descartado em silêncio; tudo que se perde no caminho volta como aviso, para a tela mostrar
 * antes de enviar.
 *
 * Três decisões que vêm da conferência com o backend (`docs/clinico/06-perguntas-ao-app.md`):
 *
 * 1. **Uso contínuo se escreve omitindo `duracaoDias`.** O DTO declara `@IsInt() @Min(1)`, e a
 *    importação faz `duracaoDias != null ? dataFim : null`. Mandar `null` no fio não é a forma;
 *    não mandar a chave é. Aqui o `null` do `DoseCalc` atravessa como `null` no formulário, e é
 *    `montarAnotacaoEstruturada` quem o converte em chave ausente.
 * 2. **Item sem `frequencia` vira prescrição, mas não vira medicamento** do pet. É perda
 *    silenciosa do lado de lá, então vira aviso do lado de cá.
 * 3. **Via de administração não tem campo.** Vai para `instrucoes`, que é o único lugar onde
 *    cabe — e o aviso existe para ninguém supor que ela viaja em campo próprio.
 */

import type {
  AnotacaoEstruturadaForm,
  ExameSolicitadoForm,
  PrescricaoItemForm,
} from '@/utils/parceiro/anotacao-estruturada'
import {
  criarAnotacaoEstruturadaForm,
  DURACAO_MAX_DIAS,
  DURACAO_MIN_DIAS,
  LIMITES_CAMPOS_LIVRES,
  LIMITES_ESCALARES,
  LIMITES_PRESCRICAO,
  MAX_ITENS_LISTA,
  PESO_MAX_KG,
  PESO_MIN_KG,
} from '@/utils/parceiro/anotacao-estruturada'

import type {
  DiagnosisKind,
  Encounter,
  ExamCatalogItem,
  Medication,
  Prescription,
  PrescriptionRoute,
  Professional,
} from '../data/types'
import { fracionar, type Fracionamento } from './receita'

// ---------------------------------------------------------------------------
// O que não cabe no contrato
// ---------------------------------------------------------------------------

/**
 * Um aviso viaja como `kind` + `params`, nunca como frase pronta.
 *
 * Mesma regra dos conflitos da agenda, e pelo mesmo motivo: a tela roda em quatro idiomas e
 * este arquivo não conhece nenhum deles.
 */
export type AvisoDeConversao = {
  kind:
    /** Mais de dez prescrições: o contrato recusa a anotação inteira acima do teto. */
    | 'prescricoes-excedentes'
    | 'exames-excedentes'
    /** Id de exame que o catálogo não reconhece — segue como texto livre. */
    | 'exame-desconhecido'
    /** Sem frequência o item não vira medicamento do pet na importação. */
    | 'sem-frequencia'
    | 'duracao-fora-da-faixa'
    /** A conta não caiu numa fração partível e foi arredondada. */
    | 'dose-aproximada'
    | 'peso-nao-aferido'
    | 'peso-fora-da-faixa'
    | 'texto-truncado'
    /** Via de administração não tem campo próprio; foi para as instruções. */
    | 'via-em-instrucoes'
    /** CRMV e código verificador não têm destino no contrato. */
    | 'assinatura-sem-destino'
  params?: Record<string, string | number>
}

/**
 * Rótulos que precisam de tradução e que este arquivo não pode produzir.
 *
 * Chegam prontos de quem tem `t()`. É o mesmo desenho dos catálogos clínicos, que já vêm
 * traduzidos por `catalog-i18n` antes de qualquer regra tocá-los.
 */
export type RotulosDaConversao = {
  via: Record<PrescriptionRoute, string>
  tipoDiagnostico: Record<DiagnosisKind, string>
  /** Como a quantidade é dita a quem vai dar o remédio: "meio", "um e meio". */
  fracao: Record<Fracionamento['kind'], string>
}

export type EntradaDaConversao = {
  encounter: Encounter
  /** Catálogos **já traduzidos** — a tradução acontece antes, nunca aqui. */
  medicamentos: Medication[]
  exames: ExamCatalogItem[]
  rotulos: RotulosDaConversao
  /** Nome do serviço prestado; campo obrigatório do contrato. */
  servicoRealizado: string
}

/** Os campos livres da anotação, que não fazem parte do bloco estruturado. */
export type CamposLivresDaAnotacao = {
  servicoRealizado: string
  texto: string
}

export type ResultadoDaConversao = {
  /**
   * Pronto para `validarAnotacaoEstruturada` e `montarAnotacaoEstruturada`.
   *
   * Formulário, e não payload, de propósito: quem atendeu revisa o que sai da clínica antes de
   * sair. O prontuário é da clínica; a anotação é do responsável, e as duas coisas não são a
   * mesma.
   */
  form: AnotacaoEstruturadaForm
  livres: CamposLivresDaAnotacao
  avisos: AvisoDeConversao[]
}

// ---------------------------------------------------------------------------
// Auxiliares
// ---------------------------------------------------------------------------

/**
 * Corta no limite do contrato e avisa.
 *
 * Truncar é ruim; ser recusado com 400 e perder a anotação inteira é pior. O aviso é o que
 * torna a escolha visível em vez de conveniente.
 */
function limitar(
  valor: string,
  max: number,
  campo: string,
  avisos: AvisoDeConversao[],
): string {
  const limpo = valor.trim()

  if (limpo.length <= max) {
    return limpo
  }

  avisos.push({ kind: 'texto-truncado', params: { campo, max } })

  return limpo.slice(0, max).trimEnd()
}

/**
 * Número para texto sem separador de milhar e sem zero à toa.
 *
 * Ponto decimal, não vírgula: o campo é lido por gente **e** pelo app, e um número que muda de
 * forma conforme o idioma de quem digitou é um número que nenhum dos dois lados consegue somar.
 */
function numeroParaTexto(valor: number): string {
  return String(Math.round(valor * 1000) / 1000)
}

/** `12/12h` — a convenção que o próprio DTO usa como exemplo. */
function frequenciaParaTexto(horas: number): string {
  return `${horas}/${horas}h`
}

function juntar(partes: (string | undefined)[], separador: string): string {
  return partes.map((parte) => parte?.trim()).filter(Boolean).join(separador)
}

// ---------------------------------------------------------------------------
// Prescrições
// ---------------------------------------------------------------------------

function prescricaoParaItem(
  prescricao: Prescription,
  medicamento: Medication | undefined,
  rotulos: RotulosDaConversao,
  avisos: AvisoDeConversao[],
): PrescricaoItemForm {
  const { calculo } = prescricao
  const nome = medicamento?.nome ?? prescricao.medicamentoId
  const unidade = medicamento?.unidadeApresentacao ?? ''

  /*
   * A quantidade que vai no fio é a **partível**, a mesma que a receita impressa manda dar.
   * Mandar a calculada faria a instrução do papel e a do app discordarem sobre o mesmo
   * comprimido, no mesmo dia, para o mesmo animal.
   */
  const fracionamento = medicamento
    ? fracionar(calculo.quantidadeApresentacao, medicamento.unidadeApresentacao)
    : null

  const quantidade = fracionamento?.quantidade ?? calculo.quantidadeApresentacao

  if (fracionamento?.aproximado) {
    avisos.push({ kind: 'dose-aproximada', params: { medicamento: nome } })
  }

  if (!(calculo.frequenciaHoras > 0)) {
    avisos.push({ kind: 'sem-frequencia', params: { medicamento: nome } })
  }

  if (
    calculo.duracaoDias !== null &&
    (!Number.isInteger(calculo.duracaoDias) ||
      calculo.duracaoDias < DURACAO_MIN_DIAS ||
      calculo.duracaoDias > DURACAO_MAX_DIAS)
  ) {
    avisos.push({
      kind: 'duracao-fora-da-faixa',
      params: {
        medicamento: nome,
        dias: calculo.duracaoDias,
        min: DURACAO_MIN_DIAS,
        max: DURACAO_MAX_DIAS,
      },
    })
  }

  /*
   * Via, fração em palavra e observação dividem `instrucoes` porque é o único campo de texto
   * corrido que a prescrição tem. A via vem primeiro: é o que muda o que a pessoa faz com o
   * remédio na mão.
   */
  const instrucoes = juntar(
    [
      rotulos.via[prescricao.via],
      fracionamento ? rotulos.fracao[fracionamento.kind] : undefined,
      prescricao.observacao,
    ],
    ' · ',
  )

  return {
    nome: nome.slice(0, LIMITES_PRESCRICAO.nome),
    dose: quantidade > 0 ? numeroParaTexto(quantidade) : '',
    unidade,
    frequencia: calculo.frequenciaHoras > 0 ? frequenciaParaTexto(calculo.frequenciaHoras) : '',
    /** `null` atravessa como `null`: quem o transforma em chave ausente é a montagem. */
    duracaoDias: calculo.duracaoDias,
    instrucoes: instrucoes.slice(0, LIMITES_PRESCRICAO.instrucoes),
  }
}

/**
 * Corta a lista no teto do contrato, nomeando o que ficou de fora.
 *
 * Cortar em silêncio seria a pior das opções: a receita impressa teria doze itens e o app do
 * responsável, dez, sem nada na tela dizendo quais dois faltam.
 */
function limitarLista<T>(
  itens: T[],
  nomeDe: (item: T) => string,
  kind: AvisoDeConversao['kind'],
  avisos: AvisoDeConversao[],
): T[] {
  if (itens.length <= MAX_ITENS_LISTA) {
    return itens
  }

  const descartados = itens.slice(MAX_ITENS_LISTA)

  avisos.push({
    kind,
    params: {
      limite: MAX_ITENS_LISTA,
      total: itens.length,
      descartados: descartados.map(nomeDe).join(', '),
    },
  })

  return itens.slice(0, MAX_ITENS_LISTA)
}

// ---------------------------------------------------------------------------
// A conversão
// ---------------------------------------------------------------------------

/**
 * Monta o formulário de anotação a partir de um atendimento.
 *
 * Não filtra por tipo de serviço e não valida: as duas coisas já existem, testadas, em
 * `validarAnotacaoEstruturada` e `montarAnotacaoEstruturada`. Chame-as em seguida — e
 * `filtrarEstruturadoPorTipo` por último, que é a barreira que impede um campo de consulta de
 * sair num acesso de banho e derrubar a anotação com 400.
 */
export function atendimentoParaAnotacao(entrada: EntradaDaConversao): ResultadoDaConversao {
  const { encounter, medicamentos, exames, rotulos } = entrada
  const avisos: AvisoDeConversao[] = []
  const form = criarAnotacaoEstruturadaForm()

  const porId = new Map(medicamentos.map((item) => [item.id, item]))
  const examePorId = new Map(exames.map((item) => [item.id, item]))

  // ------------------------------------------------------------- motivo

  form.motivo = limitar(
    encounter.anamnese.queixaPrincipal,
    LIMITES_ESCALARES.motivo,
    'motivo',
    avisos,
  )

  // -------------------------------------------------------- diagnóstico

  /*
   * O contrato tem **uma string** onde o prontuário tem uma lista tipada. Código e tipo
   * (presuntivo, definitivo, diferencial) não têm campo, e a diferença entre eles é clínica:
   * some no achatamento se não for escrita. Por isso vão no texto, não se perdem.
   */
  form.diagnostico = limitar(
    encounter.diagnosticos
      .map((diagnostico) =>
        juntar(
          [
            diagnostico.descricao,
            diagnostico.codigo ? `(${diagnostico.codigo})` : undefined,
            rotulos.tipoDiagnostico[diagnostico.kind],
          ],
          ' ',
        ),
      )
      .join('\n'),
    LIMITES_ESCALARES.diagnostico,
    'diagnostico',
    avisos,
  )

  // --------------------------------------------------------------- peso

  /*
   * O peso que viaja é o **aferido hoje**, o mesmo que a receita usou na conta. Mandar o do
   * cadastro faria a dose do app não fechar com a do papel.
   */
  const peso = encounter.exameFisico.vitais.peso

  if (peso.naoAferido || peso.valor === null) {
    avisos.push({ kind: 'peso-nao-aferido' })
  } else if (peso.valor < PESO_MIN_KG || peso.valor > PESO_MAX_KG) {
    avisos.push({
      kind: 'peso-fora-da-faixa',
      params: { peso: peso.valor, min: PESO_MIN_KG, max: PESO_MAX_KG },
    })
  } else {
    form.pesoKg = peso.valor
  }

  // -------------------------------------------------------- prescrições

  const prescricoes = limitarLista(
    encounter.conduta.prescricoes,
    (prescricao) => porId.get(prescricao.medicamentoId)?.nome ?? prescricao.medicamentoId,
    'prescricoes-excedentes',
    avisos,
  )

  form.prescricaoItens = prescricoes.map((prescricao) =>
    prescricaoParaItem(prescricao, porId.get(prescricao.medicamentoId), rotulos, avisos),
  )

  if (prescricoes.length) {
    avisos.push({ kind: 'via-em-instrucoes' })
    avisos.push({ kind: 'assinatura-sem-destino' })
  }

  // ------------------------------------------------------------- exames

  /*
   * O prontuário guarda **ids** de catálogo; o contrato quer o nome que o responsável lê. Id
   * que o catálogo não conhece segue como texto livre em vez de virar linha vazia — foi
   * exatamente assim que os chips em branco apareceram uma vez.
   */
  const solicitados = limitarLista(
    encounter.conduta.examesSolicitados,
    (id) => examePorId.get(id)?.nome ?? id,
    'exames-excedentes',
    avisos,
  )

  form.examesSolicitados = solicitados.map<ExameSolicitadoForm>((id) => {
    const item = examePorId.get(id)

    if (!item) {
      avisos.push({ kind: 'exame-desconhecido', params: { id } })
    }

    return { nome: (item?.nome ?? id).slice(0, 200), observacao: '' }
  })

  // ------------------------------------------------------- campos livres

  /*
   * Conteúdo, sem rótulo de seção: o texto vai para a tela do responsável, e um cabeçalho em
   * português dentro de um app que roda em quatro idiomas é pior que nenhum cabeçalho.
   */
  const livres: CamposLivresDaAnotacao = {
    servicoRealizado: limitar(
      entrada.servicoRealizado,
      LIMITES_CAMPOS_LIVRES.servicoRealizado,
      'servicoRealizado',
      avisos,
    ),
    texto: limitar(
      juntar(
        [
          encounter.anamnese.historia,
          encounter.exameFisico.observacao,
          encounter.conduta.orientacoes,
        ],
        '\n\n',
      ),
      LIMITES_CAMPOS_LIVRES.texto,
      'texto',
      avisos,
    ),
  }

  return { form, livres, avisos }
}

/**
 * Identidade do profissional, como o contrato a aceita.
 *
 * São dois campos e só: nome e área. O conselho (CRMV) **não tem destino** — vale para a
 * receita impressa, que é o documento legal, e não atravessa para o app. Quem quiser o CRMV do
 * lado de lá precisa de campo novo na API, não de gambiarra no nome.
 */
export function profissionalParaAnotacao(profissional: Professional): {
  profissionalNome: string
  profissionalEspecialidade?: string
} {
  const especialidade = profissional.especialidade.trim()

  return {
    profissionalNome: profissional.nome.trim().slice(0, LIMITES_CAMPOS_LIVRES.profissionalNome),
    /* Ausente, não vazio: string vazia diria que a área é "". */
    ...(especialidade
      ? {
          profissionalEspecialidade: especialidade.slice(
            0,
            LIMITES_CAMPOS_LIVRES.profissionalEspecialidade,
          ),
        }
      : {}),
  }
}
