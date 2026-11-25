import type {
  ConfiancaItemLido,
  ItemFormularioLeitura,
  LeituraReceitaParceiro,
} from '@/service/parceiro/types'

import {
  criarPrescricaoItemForm,
  DURACAO_MAX_DIAS,
  itemPrescricaoPreenchido,
  LIMITES_PRESCRICAO,
  MAX_ITENS_LISTA,
  type CampoPrescricaoConferivel,
  type PrescricaoItemForm,
} from './anotacao-estruturada'

/**
 * Regras da leitura de receita com IA na anotação de consulta (Parte 3 do épico
 * `leitura-receita-ia` da API, lado do parceiro). Sem DOM: a redução da imagem mora em
 * `reduzir-imagem.ts`, e o andamento da leitura em `useLeituraReceitaParceiro`.
 */

/** Teto de anexos da anotação (API: `MAX_ANEXOS_ANOTACAO`). Os arquivos da leitura contam nele. */
export const MAX_ANEXOS_ANOTACAO = 3

/** Até 3 imagens ou 1 PDF por leitura. */
export const MAX_ARQUIVOS_LEITURA = 3

export const MIME_PDF = 'application/pdf'

export const MIMES_IMAGEM_LEITURA = ['image/jpeg', 'image/png', 'image/webp'] as const

/** `accept` do seletor da leitura. Sem HEIC: a API recusa com 415. */
export const ACCEPT_LEITURA = [...MIMES_IMAGEM_LEITURA, MIME_PDF].join(',')

/** Imagem já reduzida acima disto é recusada (a reduzida costuma ficar abaixo de 1 MB). */
export const MAX_BYTES_IMAGEM_LEITURA = 5 * 1024 * 1024

export const MAX_BYTES_PDF_LEITURA = 10 * 1024 * 1024

/** Lado maior da imagem antes de enviar: foto de celular de 10 MB vira menos de 1 MB. */
export const LADO_MAXIMO_IMAGEM = 2576

export const QUALIDADE_JPEG = 0.85

/** Recuo entre as consultas da leitura; depois do último, repete o último. */
export const INTERVALOS_ESPERA_MS = [2000, 2000, 3000, 5000] as const

/** Sem resposta neste tempo, a tela diz "Ainda estou lendo" e para de perguntar. */
export const ESPERA_MAXIMA_MS = 60_000

/** Falhas de rede seguidas na consulta antes de desistir e mostrar o erro. */
export const FALHAS_SEGUIDAS_MAX = 3

export type ProblemaArquivoLeitura =
  | 'HEIC'
  | 'TIPO'
  | 'MISTURA'
  | 'LIMITE'
  | 'PDF_GRANDE'
  | 'IMAGEM_GRANDE'

type ArquivoBasico = { type: string; size: number; name?: string }

export function ehPdf(arquivo: { type: string }): boolean {
  return arquivo.type === MIME_PDF
}

/** HEIC/HEIF do iPhone: o navegador às vezes manda o tipo vazio, então a extensão também conta. */
export function ehHeic(arquivo: { type: string; name?: string }): boolean {
  return /image\/hei[cf]/i.test(arquivo.type) || /\.hei[cf]$/i.test(arquivo.name ?? '')
}

/** Intervalo antes da consulta número `tentativa` (0 = a primeira). */
export function intervaloDaEspera(tentativa: number): number {
  const ultimo = INTERVALOS_ESPERA_MS[INTERVALOS_ESPERA_MS.length - 1] ?? 5000

  return INTERVALOS_ESPERA_MS[tentativa] ?? ultimo
}

/** Lugares para a receita: o que sobra do teto de anexos, até 3. */
export function vagasParaLeitura(anexosDoFormulario: number): number {
  return Math.max(0, Math.min(MAX_ARQUIVOS_LEITURA, MAX_ANEXOS_ANOTACAO - anexosDoFormulario))
}

/** Ainda cabe outro arquivo nesta leitura? PDF é sempre um só. */
export function cabeMaisArquivoLeitura(atuais: ArquivoBasico[], maximo: number): boolean {
  if (atuais.some(ehPdf)) {
    return false
  }

  return atuais.length < maximo
}

/**
 * O que impede `novo` de entrar na leitura, ou `null`. A imagem ainda vai ser reduzida, então o
 * tamanho dela é conferido depois (`IMAGEM_GRANDE` sai de `problemaDaImagemReduzida`).
 */
export function problemaDoArquivoLeitura(
  atuais: ArquivoBasico[],
  novo: ArquivoBasico,
  maximo: number,
): ProblemaArquivoLeitura | null {
  if (ehHeic(novo)) {
    return 'HEIC'
  }

  const imagem = (MIMES_IMAGEM_LEITURA as readonly string[]).includes(novo.type)

  if (!imagem && !ehPdf(novo)) {
    return 'TIPO'
  }

  const temPdf = atuais.some(ehPdf)

  if (ehPdf(novo)) {
    if (atuais.length > 0) {
      return temPdf ? 'LIMITE' : 'MISTURA'
    }

    return novo.size > MAX_BYTES_PDF_LEITURA ? 'PDF_GRANDE' : null
  }

  if (temPdf) {
    return 'MISTURA'
  }

  return atuais.length >= maximo ? 'LIMITE' : null
}

export function problemaDaImagemReduzida(reduzida: ArquivoBasico): ProblemaArquivoLeitura | null {
  return reduzida.size > MAX_BYTES_IMAGEM_LEITURA ? 'IMAGEM_GRANDE' : null
}

/** Dimensões com o lado maior até `ladoMaximo`, na mesma proporção. Nunca amplia. */
export function dimensoesReduzidas(
  largura: number,
  altura: number,
  ladoMaximo: number = LADO_MAXIMO_IMAGEM,
): { largura: number; altura: number } {
  const maior = Math.max(largura, altura)

  if (maior <= ladoMaximo || maior <= 0) {
    return { largura, altura }
  }

  const escala = ladoMaximo / maior

  return {
    largura: Math.max(1, Math.round(largura * escala)),
    altura: Math.max(1, Math.round(altura * escala)),
  }
}

// ------------------------------------------------------------------ itens lidos

function textoLido(valor: unknown, limite: number): string {
  return valor == null ? '' : String(valor).trim().slice(0, limite)
}

/** A faixa do prazo de reavaliação da prescrição (1 a 730 dias, API: `reavaliarEmDias`). */
export const REAVALIACAO_MAX_DIAS = 730

/**
 * Como a tela escreve o prazo de reavaliação lido ("Reavaliar em 90 dias"), no idioma dela. Sem
 * ele, o prazo não entra no formulário.
 */
export type OpcoesDaLeitura = { reavaliarEm?: (dias: number) => string }

function prazoDeReavaliacao(valor: unknown): number | null {
  return typeof valor === 'number' &&
    Number.isInteger(valor) &&
    valor >= 1 &&
    valor <= REAVALIACAO_MAX_DIAS
    ? valor
    : null
}

/**
 * Item lido no formato do formulário, com "Confira" em todo campo cuja confiança não é ALTA
 * (média, baixa ou não lido). Sem a confiança do item, tudo fica marcado. Os textos respeitam
 * os tetos do formulário: o que passa seria 400 no envio.
 *
 * O prazo de reavaliação do uso contínuo (PJ-HC2AKL) não tem campo na anotação do parceiro (a
 * API não guarda): ele vai no fim das instruções, que a pessoa recebe no app, e as instruções
 * ficam para conferir quando a IA não tem certeza do prazo.
 */
export function prescricaoItemDaLeitura(
  item: ItemFormularioLeitura,
  confianca: ConfiancaItemLido | null | undefined,
  opcoes: OpcoesDaLeitura = {},
): PrescricaoItemForm {
  const marcar = (campo: Exclude<CampoPrescricaoConferivel, 'instrucoes'>) =>
    confianca?.[campo] !== 'ALTA'
  const dias = item.duracaoDias
  const reavaliar = opcoes.reavaliarEm ? prazoDeReavaliacao(item.reavaliarEmDias) : null
  const lidas = textoLido(item.instrucoes, LIMITES_PRESCRICAO.instrucoes)
  /* "Oral. Uso contínuo" + "Reavaliar em 90 dias": o ponto final das lidas não dobra. */
  const instrucoes =
    reavaliar === null || !opcoes.reavaliarEm
      ? lidas
      : [lidas.replace(/[.\s]+$/, ''), opcoes.reavaliarEm(reavaliar)]
          .filter(Boolean)
          .join('. ')
          .slice(0, LIMITES_PRESCRICAO.instrucoes)

  return {
    ...criarPrescricaoItemForm(),
    nome: textoLido(item.nome, LIMITES_PRESCRICAO.nome),
    dose: textoLido(item.dose, LIMITES_PRESCRICAO.dose),
    unidade: textoLido(item.unidade, LIMITES_PRESCRICAO.unidade),
    frequencia: textoLido(item.frequencia, LIMITES_PRESCRICAO.frequencia),
    duracaoDias:
      typeof dias === 'number' && Number.isFinite(dias) && dias >= 1
        ? Math.min(Math.trunc(dias), DURACAO_MAX_DIAS)
        : null,
    instrucoes,
    conferir: {
      nome: marcar('nome'),
      dose: marcar('dose'),
      frequencia: marcar('frequencia'),
      duracaoDias: marcar('duracaoDias'),
      ...(reavaliar !== null ? { instrucoes: confianca?.reavaliarEmDias !== 'ALTA' } : {}),
    },
  }
}

export type ResultadoMescla = {
  itens: PrescricaoItemForm[]
  /** Remédios lidos que entraram na lista. */
  aplicados: number
  /** Remédios lidos que não couberam no teto da lista. */
  cortados: number
}

/**
 * Junta os remédios lidos à lista do formulário: o que o profissional já digitou fica, as
 * linhas em branco saem e os lidos entram no fim, até o teto de `MAX_ITENS_LISTA`.
 */
export function mesclarPrescricaoLida(
  atuais: PrescricaoItemForm[],
  leitura: Pick<LeituraReceitaParceiro, 'itensFormulario' | 'confianca'>,
  opcoes: OpcoesDaLeitura = {},
): ResultadoMescla {
  const lidos = Array.isArray(leitura.itensFormulario) ? leitura.itensFormulario : []
  const confiancas = Array.isArray(leitura.confianca) ? leitura.confianca : []
  const mantidos = atuais.filter(itemPrescricaoPreenchido)
  const espaco = Math.max(0, MAX_ITENS_LISTA - mantidos.length)
  const novos = lidos
    .slice(0, espaco)
    .map((item, indice) => prescricaoItemDaLeitura(item, confiancas[indice], opcoes))

  return {
    itens: [...mantidos, ...novos],
    aplicados: novos.length,
    cortados: lidos.length - novos.length,
  }
}

/** Algum item da lista ainda tem campo marcado para conferir? */
export function temCampoAConferir(itens: PrescricaoItemForm[]): boolean {
  return itens.some((item) => Object.values(item.conferir ?? {}).some(Boolean))
}
