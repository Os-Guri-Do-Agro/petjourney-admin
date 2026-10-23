/**
 * O histórico viaja com o pet — regras puras.
 *
 * O histórico é do responsável, não da clínica: ele libera para uma clínica o que quer, por um
 * prazo, e encerra quando quiser. É o compartilhamento por código que a API já tem
 * (`CompartilhamentoPrestador`: categorias, `expiraEm`, `revogadoEm` e o snapshot que volta `null`
 * quando o acesso termina), visto aqui com o paciente novo chegando à clínica.
 *
 * E a ficha de emergência em dois degraus (visão de produto, item 14): o QR da coleira continua
 * abrindo a ficha pública de hoje — identificação, microchip e o alerta de alergia grave — e o
 * segundo degrau, com medicação, alergias, diagnósticos e o último peso, só abre para
 * profissional identificado pelo CRMV, com um motivo; fica registrado e o responsável é avisado
 * na hora. É a spec L6 (ficha de emergência pelo QR), que a API implementou em 22/10.
 *
 * Nada aqui conhece a camada mocada: entra o que a API devolveria, sai o que a tela mostra.
 */

import type { ISODate, ISODateTime } from '../data/types'

/** O que o responsável escolhe liberar. A ordem é a da tela: o que decide conduta vem primeiro. */
export const CATEGORIAS_DO_HISTORICO = [
  'ALERGIAS',
  'MEDICAMENTOS',
  'DIAGNOSTICOS',
  'VACINAS',
  'PESO',
  'DOCUMENTOS',
  'DIARIO',
] as const

export type CategoriaDoHistorico = (typeof CATEGORIAS_DO_HISTORICO)[number]

/**
 * O que já vem marcado quando o responsável libera para uma clínica nova: o que a clínica
 * precisa para atender com segurança. Documentos e diário ficam para ele marcar, porque são os
 * que mais dizem da vida da casa.
 */
export const CATEGORIAS_PADRAO: readonly CategoriaDoHistorico[] = [
  'ALERGIAS',
  'MEDICAMENTOS',
  'DIAGNOSTICOS',
  'VACINAS',
  'PESO',
]

/**
 * Prazos oferecidos ao liberar, em dias. Não existe "para sempre": todo acesso termina sozinho.
 *
 * São os da API (`criar-compartilhamento.dto.ts`): os atalhos do app (`DURACOES_PRESET_HORAS`,
 * 24 h, 48 h, 72 h e 7 dias) e o teto de 30 dias (`DURACAO_MAX_HORAS`, decisão de produto). A API
 * recebe em horas: `duracaoHoras` = dias × 24.
 */
export const PRAZOS_DO_ACESSO = [1, 2, 3, 7, 30] as const

export type PrazoDoAcesso = (typeof PRAZOS_DO_ACESSO)[number]

/** O código que o responsável mostra na recepção: 6 dígitos, como o do acesso temporário da API. */
export const CODIGO_TAMANHO = 6
export const ALFABETO_DO_CODIGO = '0123456789'

/** De onde veio cada coisa do histórico. É o que a clínica que recebe precisa ler antes de confiar. */
export type OrigemDoItem = {
  /** `CLINICA`: registrado por uma clínica. `RESPONSAVEL`: anotado por quem cuida, no app. */
  tipo: 'CLINICA' | 'RESPONSAVEL'
  /** Nome da clínica; vazio quando foi o responsável. */
  local: string
  /** Quem registrou na clínica, com o conselho, quando a clínica disse. */
  profissional: string | null
}

export type ItemDoHistorico = {
  id: string
  categoria: CategoriaDoHistorico
  titulo: string
  detalhe: string
  /** Quando aconteceu. `null` quando ninguém soube dizer (alergia antiga, por exemplo). */
  em: ISODate | null
  origem: OrigemDoItem
  /**
   * O destaque que muda conduta: alergia grave, medicação de uso contínuo, diagnóstico ainda
   * ativo. É o que sobe para a ficha de emergência.
   */
  marcador: 'grave' | 'continuo' | 'ativo' | null
}

/** Por onde alguém da clínica chegou ao histórico. */
export type CanalDaAbertura = 'FICHA' | 'EMERGENCIA'

/**
 * Uma abertura registrada. É a linha que o responsável lê em "Quem abriu e quando" — o nome e
 * o conselho de quem abriu, a clínica, o que abriu e a hora.
 */
export type AberturaDoHistorico = {
  id: string
  petId: string
  /** O acesso pelo qual abriu. `null` na emergência, que não depende de acesso liberado. */
  acessoId: string | null
  canal: CanalDaAbertura
  em: ISODateTime
  profissionalNome: string
  conselho: string
  parceiroNome: string
  categorias: CategoriaDoHistorico[]
  /**
   * Só na emergência: o motivo que o veterinário escreveu e o telefone da clínica **como
   * estavam na abertura** (spec L6, D4): a clínica não consegue trocar depois o que o
   * responsável lê. `null` na ficha aberta por acesso liberado.
   */
  motivo: string | null
  parceiroTelefone: string | null
}

/**
 * Um acesso liberado pelo responsável.
 *
 * Nasce com o código, antes de clínica nenhuma: `parceiroId` só se preenche quando a recepção
 * digita o código (`vinculadoEm`). Encerrar é imediato e não leva motivo — a clínica só vê que
 * terminou, nunca por quê nem por iniciativa de quem.
 */
export type AcessoAoHistorico = {
  id: string
  codigo: string
  petId: string
  tutorId: string
  parceiroId: string | null
  parceiroNome: string | null
  categorias: CategoriaDoHistorico[]
  liberadoEm: ISODateTime
  expiraEm: ISODateTime
  vinculadoEm: ISODateTime | null
  encerradoEm: ISODateTime | null
}

export type EstadoDoAcesso = 'aguardando' | 'ativo' | 'encerrado' | 'expirado'

/**
 * Em que pé está o acesso agora.
 *
 * Encerrado vence expirado: se o responsável encerrou antes do prazo, foi ele. Aguardando é o
 * código que ninguém digitou ainda — e que também vence no prazo.
 */
export function estadoDoAcesso(acesso: AcessoAoHistorico, agora: ISODateTime): EstadoDoAcesso {
  if (acesso.encerradoEm) {
    return 'encerrado'
  }

  if (acesso.expiraEm.localeCompare(agora) <= 0) {
    return 'expirado'
  }

  return acesso.vinculadoEm ? 'ativo' : 'aguardando'
}

/** O acesso ainda vale: a clínica vê o que foi liberado. */
export function acessoVale(acesso: AcessoAoHistorico, agora: ISODateTime): boolean {
  return estadoDoAcesso(acesso, agora) === 'ativo'
}

/** Terminou, por prazo ou pelo responsável. Para a clínica, os dois são a mesma frase. */
export function acessoTerminou(acesso: AcessoAoHistorico, agora: ISODateTime): boolean {
  const estado = estadoDoAcesso(acesso, agora)

  return estado === 'encerrado' || estado === 'expirado'
}

/** Quando terminou: a data do encerramento ou a do prazo, a que veio primeiro. */
export function terminouEm(acesso: AcessoAoHistorico): ISODateTime {
  return acesso.encerradoEm ?? acesso.expiraEm
}

/**
 * O que a clínica vê do histórico.
 *
 * `null` quando o acesso não vale — como o `snapshot` da API, que volta nulo depois de encerrado
 * ou expirado. Valendo, só as categorias liberadas, o mais recente primeiro (o que não tem data
 * vai para o fim do seu grupo).
 */
export function itensVisiveis(
  acesso: AcessoAoHistorico,
  itens: ItemDoHistorico[],
  agora: ISODateTime,
): ItemDoHistorico[] | null {
  if (!acessoVale(acesso, agora)) {
    return null
  }

  return ordenarItens(itens.filter((item) => acesso.categorias.includes(item.categoria)))
}

export function ordenarItens(itens: ItemDoHistorico[]): ItemDoHistorico[] {
  return [...itens].sort((a, b) => {
    if (a.em === b.em) {
      return a.titulo.localeCompare(b.titulo)
    }

    if (!a.em) {
      return 1
    }

    if (!b.em) {
      return -1
    }

    return b.em.localeCompare(a.em)
  })
}

/** Os itens por categoria, na ordem de `CATEGORIAS_DO_HISTORICO`, sem grupo vazio. */
export function agruparPorCategoria(
  itens: ItemDoHistorico[],
): Array<{ categoria: CategoriaDoHistorico; itens: ItemDoHistorico[] }> {
  return CATEGORIAS_DO_HISTORICO.map((categoria) => ({
    categoria,
    itens: ordenarItens(itens.filter((item) => item.categoria === categoria)),
  })).filter((grupo) => grupo.itens.length > 0)
}

/** Os lugares de onde o histórico veio, sem repetir: "veio de duas clínicas e do app". */
export function origensDoHistorico(itens: ItemDoHistorico[]): {
  clinicas: string[]
  doResponsavel: boolean
} {
  const clinicas = [
    ...new Set(
      itens.filter((item) => item.origem.tipo === 'CLINICA').map((item) => item.origem.local),
    ),
  ]

  return { clinicas, doResponsavel: itens.some((item) => item.origem.tipo === 'RESPONSAVEL') }
}

// ------------------------------------------------------------------ código

/** O que a recepção digitou, do jeito que o código existe: maiúsculo, sem espaço nem traço. */
/** Espaço e hífen do ditado saem, como no `normalizarCodigoVinculo` do portal. */
export function normalizarCodigo(texto: string): string {
  return texto.replace(/\D/g, '')
}

export function codigoCompleto(texto: string): boolean {
  return normalizarCodigo(texto).length === CODIGO_TAMANHO
}

/** Um código novo. `sortear` devolve um número em [0, 1) — no protótipo, o PRNG da semente. */
export function gerarCodigo(sortear: () => number, existentes: ReadonlySet<string>): string {
  for (let tentativa = 0; tentativa < 50; tentativa += 1) {
    let codigo = ''

    for (let i = 0; i < CODIGO_TAMANHO; i += 1) {
      codigo += ALFABETO_DO_CODIGO[Math.floor(sortear() * ALFABETO_DO_CODIGO.length)]
    }

    if (!existentes.has(codigo)) {
      return codigo
    }
  }

  throw new Error('não foi possível gerar um código livre')
}

export type MotivoDoCodigoRecusado = 'CODIGO_NAO_ENCONTRADO' | 'CODIGO_EXPIRADO' | 'CODIGO_JA_USADO'

/**
 * Por que o código não serve, ou `null` se serve.
 *
 * Usado por outra clínica e encerrado pelo responsável dizem a mesma coisa à recepção: o código
 * não vale mais. Quem tem o código não precisa saber de quem ele foi.
 */
export function motivoDoCodigoRecusado(
  acesso: AcessoAoHistorico | null,
  agora: ISODateTime,
): MotivoDoCodigoRecusado | null {
  if (!acesso) {
    return 'CODIGO_NAO_ENCONTRADO'
  }

  const estado = estadoDoAcesso(acesso, agora)

  if (estado === 'expirado') {
    return 'CODIGO_EXPIRADO'
  }

  if (estado !== 'aguardando') {
    return 'CODIGO_JA_USADO'
  }

  return null
}

// ------------------------------------------------------------------ emergência

/**
 * O conselho que abre o segundo degrau. Recepção, banho e tosa e estagiário não abrem: o que está
 * lá é dado de saúde de quem não está presente para dizer sim.
 */
export function conselhoValidoParaEmergencia(conselho: string | null | undefined): boolean {
  return /^CRMV-[A-Z]{2}\s*\d{3,}$/.test((conselho ?? '').trim())
}

/** O primeiro degrau: o mesmo que a página pública da carteirinha mostra a quem acha o pet. */
export type FichaPublica = {
  petId: string
  nome: string
  especie: string
  raca: string
  iniciais: string
  fotoUrl: string
  microchip: string
  responsavelNome: string
  /** Só o gatilho das alergias graves, como na API pública (`alertasCriticos`). */
  alertasCriticos: string[]
}

/**
 * O segundo degrau: o que o profissional precisa saber antes de medicar.
 *
 * Sem nada do responsável, nem nome nem telefone (spec L6, D3): o contato vai no sentido
 * contrário. O responsável recebe o aviso e liga para a clínica.
 */
export type FichaDeEmergencia = Omit<FichaPublica, 'responsavelNome'> & {
  medicacaoContinua: ItemDoHistorico[]
  alergias: ItemDoHistorico[]
  diagnosticosAtivos: ItemDoHistorico[]
  ultimoPeso: ItemDoHistorico | null
}

/** O motivo da abertura de emergência: obrigatório, de 10 a 300 caracteres (spec L6, D2). */
export const MOTIVO_DA_EMERGENCIA = { min: 10, max: 300 } as const

export function motivoDaEmergenciaValido(motivo: string): boolean {
  const tamanho = motivo.trim().length

  return tamanho >= MOTIVO_DA_EMERGENCIA.min && tamanho <= MOTIVO_DA_EMERGENCIA.max
}

type PetDaFicha = Pick<
  FichaPublica,
  'petId' | 'nome' | 'especie' | 'raca' | 'iniciais' | 'fotoUrl' | 'microchip'
>

export function montarFichaPublica(
  pet: PetDaFicha,
  responsavelNome: string,
  itens: ItemDoHistorico[],
): FichaPublica {
  return {
    ...pet,
    responsavelNome,
    alertasCriticos: itens
      .filter((item) => item.categoria === 'ALERGIAS' && item.marcador === 'grave')
      .map((item) => item.titulo),
  }
}

export function montarFichaDeEmergencia(
  pet: PetDaFicha,
  itens: ItemDoHistorico[],
): FichaDeEmergencia {
  const daCategoria = (categoria: CategoriaDoHistorico) =>
    ordenarItens(itens.filter((item) => item.categoria === categoria))
  const { responsavelNome: _semResponsavel, ...publica } = montarFichaPublica(pet, '', itens)

  return {
    ...publica,
    medicacaoContinua: daCategoria('MEDICAMENTOS').filter((item) => item.marcador === 'continuo'),
    // Grave primeiro: é a que não pode passar despercebida no meio da lista.
    alergias: [...daCategoria('ALERGIAS')].sort(
      (a, b) => Number(b.marcador === 'grave') - Number(a.marcador === 'grave'),
    ),
    diagnosticosAtivos: daCategoria('DIAGNOSTICOS').filter((item) => item.marcador === 'ativo'),
    ultimoPeso: daCategoria('PESO')[0] ?? null,
  }
}
