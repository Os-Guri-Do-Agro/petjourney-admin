/**
 * O que as telas da internação pela API (E5-01) repetem: o ícone de cada tipo de leito, o tom de
 * cada urgência e de cada gravidade. O cartão do mapa se pinta pela **urgência**, nunca pela
 * gravidade (doc 07): a gravidade é um selo, a urgência é o que cobra ação.
 */
import type {
  Gravidade,
  KindDoLeito,
  NivelDeUrgencia,
  StatusDaInternacao,
} from '@/service/parceiro/internacao-service'

export const ICONE_DO_KIND: Record<KindDoLeito, string> = {
  UTI: 'ph ph-heartbeat',
  GERAL: 'ph ph-bed',
  FELINO: 'ph ph-cat',
  ISOLAMENTO: 'ph ph-virus',
}

/** O selo da gravidade (`ui-selo--*`). */
export const TOM_DA_GRAVIDADE: Record<Gravidade, string> = {
  ESTAVEL: 'ok',
  ATENCAO: 'atencao',
  CRITICO: 'risco',
}

/** O tom da pauta (`UiPauta`) e do cartão do mapa pela urgência. */
export const TOM_DA_URGENCIA: Record<NivelDeUrgencia, 'risco' | 'atencao' | 'neutro'> = {
  URGENTE: 'risco',
  ATENCAO: 'atencao',
  NENHUMA: 'neutro',
}

/** O selo do desfecho no detalhe e na linha do tempo. */
export const TOM_DO_STATUS: Record<StatusDaInternacao, string> = {
  INTERNADO: 'atencao',
  ALTA: 'ok',
  TRANSFERIDO: 'contorno',
  OBITO: '',
  ENCERRAMENTO_ADMINISTRATIVO: 'contorno',
}
