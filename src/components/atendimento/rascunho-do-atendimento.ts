/**
 * O rascunho do atendimento na tela (E4-01, guia e4 5.4): as quatro seções na forma que o PATCH
 * aceita, lidas do `AtendimentoDto`. A tela edita esta cópia; o autosave manda a seção inteira
 * (campo ausente fica, `null` limpa, lista presente substitui), com os `id` dos itens que já
 * existem.
 *
 * Funções puras: o que decide o que vai ao servidor mora aqui, testável sem tela.
 */
import type {
  Atendimento,
  DadosDaAnamnese,
  DadosDaConduta,
  DadosDoDiagnostico,
  DadosDoExame,
  SecaoDoAtendimento,
} from '@/service/parceiro/atendimentos-service'

type Exame = Atendimento['exameFisico']
export type ChaveDoVital = keyof Exame['vitais']
export type Sistema = Exame['sistemas'][number]['sistema']
export type StatusDoSistema = Exame['sistemas'][number]['status']
export type CampoDaAnamnese = NonNullable<DadosDaAnamnese['camposDaPreConsulta']>[number]
export type ItemDeDiagnostico = NonNullable<DadosDoDiagnostico['itens']>[number]
export type Antecedente = NonNullable<DadosDoDiagnostico['antecedentes']>[number]

export const CHAVES_DOS_VITAIS: readonly ChaveDoVital[] = [
  'peso',
  'temperatura',
  'frequenciaCardiaca',
  'frequenciaRespiratoria',
  'tempoPreenchimentoCapilar',
  'escoreCorporal',
  'pressaoSistolica',
]

/** Casas decimais e faixa aceitas de cada vital (o 400 do servidor, adiantado no campo). */
export const LIMITES_DOS_VITAIS: Record<
  ChaveDoVital,
  { casas: number; min: number; max: number; unidade: string }
> = {
  peso: { casas: 2, min: 0.01, max: 999.99, unidade: 'kg' },
  temperatura: { casas: 1, min: 20, max: 50, unidade: '°C' },
  frequenciaCardiaca: { casas: 0, min: 5, max: 600, unidade: 'bpm' },
  frequenciaRespiratoria: { casas: 0, min: 1, max: 300, unidade: 'mpm' },
  tempoPreenchimentoCapilar: { casas: 1, min: 0, max: 30, unidade: 's' },
  escoreCorporal: { casas: 1, min: 1, max: 9, unidade: '/9' },
  pressaoSistolica: { casas: 0, min: 20, max: 400, unidade: 'mmHg' },
}

export const SISTEMAS: readonly Sistema[] = [
  'CARDIOVASCULAR',
  'RESPIRATORIO',
  'DIGESTORIO',
  'URINARIO',
  'TEGUMENTAR',
  'LOCOMOTOR',
  'NEUROLOGICO',
  'LINFONODOS',
]

export const SECOES: readonly SecaoDoAtendimento[] = [
  'ANAMNESE',
  'EXAME_FISICO',
  'DIAGNOSTICO',
  'CONDUTA',
]

/** As abas da tela: as quatro seções do PATCH e a receita (E4-03), que grava por rotas próprias. */
export type AbaDoAtendimento = SecaoDoAtendimento | 'RECEITA'
export const ABAS: readonly AbaDoAtendimento[] = [...SECOES, 'RECEITA']

/** O campo da anamnese de cada marca da pré-consulta (o `marca` do `CampoSugerido`). */
export const CAMPO_DA_MARCA: Record<CampoDaAnamnese, keyof AnamneseNaTela> = {
  QUEIXA_PRINCIPAL: 'queixaPrincipal',
  HISTORIA: 'historia',
  DESDE_QUANDO: 'desdeQuando',
  EVOLUCAO: 'evolucao',
  APETITE: 'apetite',
  EVACUACAO: 'evacuacao',
  MICCAO: 'miccao',
  AMBIENTE: 'ambiente',
  VACINACAO_EM_DIA: 'vacinacaoEmDia',
  VERMIFUGACAO_EM_DIA: 'vermifugacaoEmDia',
}

export type AnamneseNaTela = Required<Omit<DadosDaAnamnese, 'camposDaPreConsulta'>> & {
  camposDaPreConsulta: CampoDaAnamnese[]
}

export type ExameNaTela = {
  vitais: Record<ChaveDoVital, { valor: number | null; naoAferido: boolean }>
  mucosas: NonNullable<DadosDoExame['mucosas']> | null
  hidratacao: NonNullable<DadosDoExame['hidratacao']> | null
  observacao: string | null
  sistemas: { sistema: Sistema; status: StatusDoSistema; nota: string | null }[]
}

export type DiagnosticoNaTela = {
  itens: ItemDeDiagnostico[]
  semDiagnostico: boolean
  antecedentes: Antecedente[]
}

export type CondutaNaTela = Required<DadosDaConduta>

export type RascunhoNaTela = {
  anamnese: AnamneseNaTela
  exame: ExameNaTela
  diagnostico: DiagnosticoNaTela
  conduta: CondutaNaTela
}

export function rascunhoDe(atendimento: Atendimento): RascunhoNaTela {
  const { anamnese, exameFisico, diagnostico, conduta } = atendimento

  return {
    anamnese: {
      queixaPrincipal: anamnese.queixaPrincipal,
      historia: anamnese.historia,
      desdeQuando: anamnese.desdeQuando,
      evolucao: anamnese.evolucao,
      apetite: anamnese.apetite,
      evacuacao: anamnese.evacuacao,
      miccao: anamnese.miccao,
      ambiente: anamnese.ambiente,
      vacinacaoEmDia: anamnese.vacinacaoEmDia,
      vermifugacaoEmDia: anamnese.vermifugacaoEmDia,
      camposDaPreConsulta: [...anamnese.camposDaPreConsulta],
    },
    exame: {
      vitais: Object.fromEntries(
        CHAVES_DOS_VITAIS.map((chave) => [
          chave,
          {
            valor: exameFisico.vitais[chave].valor,
            naoAferido: exameFisico.vitais[chave].naoAferido,
          },
        ]),
      ) as ExameNaTela['vitais'],
      mucosas: exameFisico.mucosas,
      hidratacao: exameFisico.hidratacao,
      observacao: exameFisico.observacao,
      sistemas: exameFisico.sistemas.map(({ sistema, status, nota }) => ({
        sistema,
        status,
        nota,
      })),
    },
    diagnostico: {
      itens: diagnostico.itens.map(({ id, kind, codigo, descricao }) => ({
        id,
        kind,
        codigo,
        descricao,
      })),
      semDiagnostico: diagnostico.semDiagnostico,
      antecedentes: diagnostico.antecedentes.map(({ id, kind, descricao, quando }) => ({
        id,
        kind,
        descricao,
        quando,
      })),
    },
    conduta: {
      orientacoes: conduta.orientacoes,
      idiomaDasOrientacoes: conduta.idiomaDasOrientacoes,
      sinaisDeAlerta: conduta.sinaisDeAlerta,
      observacaoInterna: conduta.observacaoInterna,
      retornoEmDias: conduta.retornoEmDias,
      retornoTipoId: conduta.retornoTipoId,
    },
  }
}

/** Texto vazio vira `null`: o servidor guarda "não preenchido", não uma string em branco. */
function texto(valor: string | null | undefined) {
  const limpo = (valor ?? '').trim()
  return limpo ? limpo : null
}

/**
 * Os dados que o PATCH manda para a seção: a seção inteira, com o texto limpo, os itens vazios
 * de fora e o vital "não aferido" sem valor (com valor, o servidor recusa).
 */
export function dadosDaSecao(
  rascunho: RascunhoNaTela,
  secao: SecaoDoAtendimento,
): DadosDaAnamnese | DadosDoExame | DadosDoDiagnostico | DadosDaConduta {
  switch (secao) {
    case 'ANAMNESE': {
      const a = rascunho.anamnese
      return {
        ...a,
        queixaPrincipal: texto(a.queixaPrincipal),
        historia: texto(a.historia),
        camposDaPreConsulta: [...a.camposDaPreConsulta],
      }
    }
    case 'EXAME_FISICO': {
      const e = rascunho.exame
      return {
        vitais: Object.fromEntries(
          CHAVES_DOS_VITAIS.map((chave) => {
            const medida = e.vitais[chave]
            return [
              chave,
              medida.naoAferido
                ? { valor: null, naoAferido: true }
                : { valor: medida.valor, naoAferido: false },
            ]
          }),
        ),
        mucosas: e.mucosas,
        hidratacao: e.hidratacao,
        observacao: texto(e.observacao),
        sistemas: e.sistemas.map((achado) => ({
          sistema: achado.sistema,
          status: achado.status,
          nota: achado.status === 'ALTERADO' ? texto(achado.nota) : null,
        })),
      }
    }
    case 'DIAGNOSTICO': {
      const d = rascunho.diagnostico
      const itens = d.itens
        .filter((item) => item.descricao.trim())
        .map((item) => ({
          ...(item.id ? { id: item.id } : {}),
          kind: item.kind,
          codigo: item.codigo ?? null,
          descricao: item.descricao.trim(),
        }))
      return {
        /* "Sem diagnóstico" não combina com itens (D5): ligado, a lista vai vazia. */
        itens: d.semDiagnostico ? [] : itens,
        semDiagnostico: d.semDiagnostico,
        antecedentes: d.antecedentes
          .filter((item) => item.descricao.trim())
          .map((item) => ({
            ...(item.id ? { id: item.id } : {}),
            kind: item.kind,
            descricao: item.descricao.trim(),
            quando: texto(item.quando),
          })),
      }
    }
    case 'CONDUTA': {
      const c = rascunho.conduta
      return {
        orientacoes: texto(c.orientacoes),
        idiomaDasOrientacoes: c.idiomaDasOrientacoes,
        sinaisDeAlerta: texto(c.sinaisDeAlerta),
        observacaoInterna: texto(c.observacaoInterna),
        retornoEmDias: c.retornoEmDias,
        retornoTipoId: c.retornoEmDias ? c.retornoTipoId : null,
      }
    }
  }
}

/** A assinatura de uma seção: duas iguais não precisam ir ao servidor. */
export function assinaturaDaSecao(rascunho: RascunhoNaTela, secao: SecaoDoAtendimento) {
  return JSON.stringify(dadosDaSecao(rascunho, secao))
}

/** Os itens que o servidor criou ganham `id`: a lista da tela passa a mandá-los. */
export function aplicarIdsDoServidor(
  rascunho: RascunhoNaTela,
  servidor: Atendimento['diagnostico'],
) {
  const semId = rascunho.diagnostico.itens.filter((item) => !item.id && item.descricao.trim())
  const novos = servidor.itens.filter(
    (item) => !rascunho.diagnostico.itens.some((local) => local.id === item.id),
  )
  semId.forEach((item, indice) => {
    const igual = novos[indice]
    if (igual && igual.descricao === item.descricao.trim()) item.id = igual.id
  })

  const antecedentesSemId = rascunho.diagnostico.antecedentes.filter(
    (item) => !item.id && item.descricao.trim(),
  )
  const antecedentesNovos = servidor.antecedentes.filter(
    (item) => !rascunho.diagnostico.antecedentes.some((local) => local.id === item.id),
  )
  antecedentesSemId.forEach((item, indice) => {
    const igual = antecedentesNovos[indice]
    if (igual && igual.descricao === item.descricao.trim()) item.id = igual.id
  })
}

/** Os motivos do 422 que a tela sabe dizer; o resto cai na frase geral. */
export const FALTAS_CONHECIDAS = [
  'QUEIXA',
  'DIAGNOSTICO',
  'CONDUTA',
  'PRESCRICAO_SEM_RECEITA',
  'RECEITA_EM_RASCUNHO',
  'ESCUTA_ATIVA',
] as const

/** A seção que resolve cada falta: o "ir para" da revisão. */
export const SECAO_DA_FALTA: Record<string, AbaDoAtendimento> = {
  QUEIXA: 'ANAMNESE',
  DIAGNOSTICO: 'DIAGNOSTICO',
  CONDUTA: 'CONDUTA',
  PRESCRICAO_SEM_RECEITA: 'RECEITA',
  RECEITA_EM_RASCUNHO: 'RECEITA',
}

/** O rótulo da aba para o outro dispositivo ver ("Chrome no Windows"), sem texto livre. */
export function rotuloDoDispositivo(agente: string) {
  const navegador = /Edg\//.test(agente)
    ? 'Edge'
    : /Firefox\//.test(agente)
      ? 'Firefox'
      : /Chrome\//.test(agente)
        ? 'Chrome'
        : /Safari\//.test(agente)
          ? 'Safari'
          : 'Navegador'
  const sistema = /Windows/.test(agente)
    ? 'Windows'
    : /iPad|iPhone/.test(agente)
      ? 'iPadOS'
      : /Mac OS X/.test(agente)
        ? 'macOS'
        : /Android/.test(agente)
          ? 'Android'
          : /Linux/.test(agente)
            ? 'Linux'
            : ''
  return sistema ? `${navegador} · ${sistema}` : navegador
}
