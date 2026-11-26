/**
 * As regras do módulo ONG que a tela decide (PJ-TJ07TW): o erro pelo `codigo` (nunca pela
 * mensagem), o selo do convite pelo status, o toque dos avisos novos do sino e quando o CNPJ da ONG
 * só muda pelo suporte. Sem Vue: o teste chama direto.
 */
import { ApiError } from '@/service/api'
import type { ModuloDoPortal } from '@/service/parceiro/acesso-service'
import type { StatusDoConvite } from '@/service/parceiro/ong-service'

type Traduzir = (chave: string) => string

/* --------------------------------------------------------------------------------- erros */

export type ErroDaOng = {
  codigo: string
  mensagem: string
  /** O campo do formulário que o erro aponta (`campo` do corpo, ou o do código). */
  campo?: string
  /** A ficha mudou na API (entregue, encerrada): a tela lê de novo. */
  recarregar: boolean
}

/** O campo de cada código que sempre aponta para o mesmo lugar. */
const CAMPO_DO_CODIGO: Record<string, string> = {
  MICROCHIP_JA_CADASTRADO: 'microchip',
  ONG_ESPECIE_OUTRA_SO_COM_OUTRO: 'especieOutra',
  PET_OUTRO_TIPO_OBRIGATORIO: 'especieOutra',
  ENTREGA_TELEFONE_INVALIDO: 'adotanteTelefone',
}

/** A ficha não está mais como a tela mostra: ler de novo antes de tentar outra coisa. */
const CODIGOS_DE_FICHA_MUDADA = new Set(['ANIMAL_JA_ENTREGUE', 'ANIMAL_FORA_DE_CUIDADO'])

/**
 * O erro da ONG pela chave `codigo`. A `message` da API já vem no idioma da sessão e é a frase que
 * aparece, com quatro exceções que a tela completa:
 *
 * - `ONG_TAXA_EXCEDIDA`: "Muitas alterações em pouco tempo..." (e a tela não repete o pedido);
 * - `MICROCHIP_JA_CADASTRADO`: a frase da API e o que fazer (ler a coleira, o banco de chip);
 * - `MODULO_SOMENTE_LEITURA` com `reason: CNPJ_ENCERRADO`: a frase do CNPJ encerrado;
 * - `OWNERSHIP_FORBIDDEN`: o animal não é desta ONG ou não existe (o mesmo 403 para os dois).
 */
export function lerErroDaOng(err: unknown, t: Traduzir, generico: string): ErroDaOng {
  if (!(err instanceof ApiError)) {
    return {
      codigo: '',
      mensagem: err instanceof Error && err.message ? err.message : generico,
      recarregar: false,
    }
  }

  const codigo = err.codigo ?? ''
  const detalhes = err.detalhes ?? {}
  const campo =
    CAMPO_DO_CODIGO[codigo] ?? (typeof detalhes.campo === 'string' ? detalhes.campo : undefined)
  const base = { codigo, campo, recarregar: CODIGOS_DE_FICHA_MUDADA.has(codigo) }

  if (codigo === 'ONG_TAXA_EXCEDIDA') {
    return { ...base, mensagem: t('ong.erros.taxa') }
  }

  if (codigo === 'MICROCHIP_JA_CADASTRADO') {
    return { ...base, mensagem: `${err.message || generico} ${t('ong.erros.microchipDica')}` }
  }

  if (codigo === 'MODULO_SOMENTE_LEITURA' && err.reason === 'CNPJ_ENCERRADO') {
    return { ...base, mensagem: t('ong.cnpj.encerrado') }
  }

  if (codigo === 'OWNERSHIP_FORBIDDEN') {
    return { ...base, mensagem: t('ong.erros.naoEncontrado') }
  }

  return { ...base, mensagem: err.message || generico }
}

/* ---------------------------------------------------------------------------- o convite */

export type SeloDoConvite = { chave: string; classe: string; icone: string }

/** Aguardando, Aceita, Recusada, Vencida (`EXPIRADA`, derivada pela API) e Cancelada. */
const SELO_DO_CONVITE: Record<StatusDoConvite, SeloDoConvite> = {
  PENDENTE: {
    chave: 'ong.convites.status.PENDENTE',
    classe: 'ui-selo--atencao',
    icone: 'ph ph-hourglass-medium',
  },
  ACEITA: {
    chave: 'ong.convites.status.ACEITA',
    classe: 'ui-selo--ok',
    icone: 'ph ph-check-circle',
  },
  RECUSADA: {
    chave: 'ong.convites.status.RECUSADA',
    classe: 'ui-selo--contorno',
    icone: 'ph ph-x-circle',
  },
  EXPIRADA: {
    chave: 'ong.convites.status.EXPIRADA',
    classe: 'ui-selo--contorno',
    icone: 'ph ph-clock-countdown',
  },
  CANCELADA: {
    chave: 'ong.convites.status.CANCELADA',
    classe: 'ui-selo--contorno',
    icone: 'ph ph-prohibit',
  },
}

/** Status que um contrato mais novo traga e o portal ainda não conhece: o selo neutro. */
const SELO_DESCONHECIDO: SeloDoConvite = {
  chave: 'ong.convites.status.OUTRO',
  classe: 'ui-selo--contorno',
  icone: 'ph ph-circle-dashed',
}

export function seloDoConvite(status: string): SeloDoConvite {
  return SELO_DO_CONVITE[status as StatusDoConvite] ?? SELO_DESCONHECIDO
}

/** "Cancelar convite" só no pendente; vencido, respondido ou cancelado já não vale. */
export function podeCancelarConvite(status: string) {
  return status === 'PENDENTE'
}

/** Há um convite valendo: gerar outro cancela este, e a tela avisa antes. */
export function temConviteValendo(convites: readonly { status: string }[]) {
  return convites.some((convite) => convite.status === 'PENDENTE')
}

/* -------------------------------------------------------------------------- os avisos */

/** Os avisos novos do sino (seção 5 do guia): nenhum leva nome, e-mail ou id de quem adotou. */
export const ICONE_DOS_AVISOS_DA_ONG: Record<string, string> = {
  ENTREGA_DE_PET_ACEITA: 'ph ph-hand-heart',
  ENTREGA_DE_PET_RECUSADA: 'ph ph-hand-palm',
  ONG_CNPJ_IRREGULAR: 'ph ph-identification-card',
}

/**
 * O toque de um aviso da ONG: o aceite e a recusa abrem a ficha do animal (`dados.animalId`), sem o
 * id, a lista; o CNPJ irregular abre o perfil da ONG. `null`: o aviso não é da ONG.
 */
export function rotaDoAvisoDaOng(aviso: {
  tipo: string
  dados: Record<string, unknown>
}): string | null {
  if (aviso.tipo === 'ENTREGA_DE_PET_ACEITA' || aviso.tipo === 'ENTREGA_DE_PET_RECUSADA') {
    const id = aviso.dados?.animalId

    return typeof id === 'string' && id ? `/ong/animal/${encodeURIComponent(id)}` : '/ong/animais'
  }

  if (aviso.tipo === 'ONG_CNPJ_IRREGULAR') {
    return '/ong/perfil'
  }

  return null
}

/* ---------------------------------------------------------------------------- o CNPJ */

/**
 * O CNPJ da ONG só muda pelo suporte (409 `ONG_CNPJ_TROCA_PELO_SUPORTE`): cadastro aprovado com o
 * módulo ONG em qualquer status menos `REJEITADO`. Antes da aprovação, a ONG corrige o CNPJ digitado
 * errado sozinha (a aprovação confere o número novo).
 */
export function cnpjDaOngSoPeloSuporte(
  statusAuditoria: string | null | undefined,
  moduloOng: Pick<ModuloDoPortal, 'status'> | null | undefined,
) {
  return (
    statusAuditoria === 'APROVADO' &&
    Boolean(moduloOng?.status) &&
    moduloOng?.status !== 'REJEITADO'
  )
}

/* ---------------------------------------------------------------------------- datas */

/** O dia de hoje em `AAAA-MM-DD`, no relógio de quem usa. */
export function hojeNoFormatoDaApi(agora = new Date()) {
  return diaNoFormatoDaApi(agora)
}

export function diaNoFormatoDaApi(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(
    data.getDate(),
  ).padStart(2, '0')}`
}

/**
 * Um instante (`date-time`) como dia curto, no fuso de quem olha: "26 de nov. de 2026", o mesmo
 * desenho das datas de dia ao lado (a chegada, a vacina), para a linha não quebrar no tablet.
 */
export function diaDoInstante(instante: string | null | undefined, idioma: string) {
  if (!instante) return ''

  return new Date(instante).toLocaleDateString(idioma, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** `AAAA-MM-DD` para o `Date` do DatePicker, pelo dia local. */
export function diaParaData(valor: string | null | undefined): Date | null {
  const [ano, mes, dia] = (valor ?? '').split('-').map(Number)

  return ano && mes && dia ? new Date(ano, mes - 1, dia) : null
}
