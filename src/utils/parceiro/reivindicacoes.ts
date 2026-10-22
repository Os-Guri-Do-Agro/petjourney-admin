import type { PortalStatus, SituacaoReivindicacao } from '@/service/parceiro/types'

/**
 * Qual rota o "Vincular código" chama, decidida pelo cadastro do parceiro.
 *
 * - `vincular`: cadastro operando, o acesso entra na lista na hora.
 * - `reivindicar`: cadastro em análise. A API guarda o código e vincula na aprovação (o parceiro
 *   em análise continua sem ver nada do pet até lá).
 * - `null`: recusado, suspenso ou ainda sem status. A API recusaria as duas rotas, então o
 *   modal não abre e a faixa do cadastro explica por quê.
 */
export type ModoDoVinculo = 'vincular' | 'reivindicar'

export function modoDoVinculo(
  status: Pick<PortalStatus, 'podeOperar' | 'statusAuditoria'> | null | undefined,
): ModoDoVinculo | null {
  if (!status) {
    return null
  }

  if (status.podeOperar) {
    return 'vincular'
  }

  return status.statusAuditoria === 'PENDENTE' ? 'reivindicar' : null
}

/** O tom do ladrilho: o do lugar para o que ainda vai acontecer, âmbar só quando há o que fazer. */
export type TomDoAviso = 'lugar' | 'atencao' | 'neutro'

export type AvisoDaReivindicacao = {
  /** Chave de `acessos.reivindicacoes.*`, com `{pet}` no texto. */
  chave: string
  tom: TomDoAviso
  icone: string
}

/**
 * O aviso de cada situação. `VINCULADO` não tem: o acesso já está na lista, e repetir o pet num
 * aviso só faria a pessoa procurar a diferença.
 *
 * Os ícones são os da própria tela: ampulheta para o que venceu e proibido para o que o
 * responsável encerrou, como no selo do histórico.
 */
const AVISOS = new Map<SituacaoReivindicacao, AvisoDaReivindicacao>([
  [
    'AGUARDANDO_APROVACAO',
    { chave: 'acessos.reivindicacoes.aguardandoAprovacao', tom: 'lugar', icone: 'ph ph-clock' },
  ],
  // O único com saída na mão do parceiro (pedir um código novo): o único em âmbar.
  [
    'VENCIDO',
    { chave: 'acessos.reivindicacoes.vencido', tom: 'atencao', icone: 'ph ph-hourglass' },
  ],
  [
    'ENCERRADO',
    { chave: 'acessos.reivindicacoes.encerrado', tom: 'neutro', icone: 'ph ph-prohibit' },
  ],
  [
    'JA_VINCULADO',
    { chave: 'acessos.reivindicacoes.jaVinculado', tom: 'neutro', icone: 'ph ph-link-break' },
  ],
])

/** Situação nova que a API venha a mandar fica sem aviso, em vez de virar uma chave quebrada. */
export function avisoDaReivindicacao(situacao: string): AvisoDaReivindicacao | null {
  return AVISOS.get(situacao as SituacaoReivindicacao) ?? null
}
