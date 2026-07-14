export type StatusAuditoriaParceiro = 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'SUSPENSO'

export type PapelParceiro = 'DONO' | 'OPERADOR'

export type StatusModoParceiro =
  | 'NAO_SOLICITADO'
  | 'SOLICITADO'
  | 'ATIVO'
  | 'REJEITADO'
  | 'SUSPENSO'

export type ModoParticipacao = 'afiliado' | 'participativo'

export type CupomCategoria = 'PETSHOP' | 'VETERINARIO' | 'FARMACIA' | 'BANHO_TOSA' | 'NUTRICAO'

export type CanalResgate = 'QR' | 'CODIGO_MANUAL'

export type TipoTransacaoParceiro = 'CREDITO_COMISSAO' | 'ESTORNO' | 'DEBITO_SAQUE' | 'AJUSTE'

export type OrigemComissao = 'INITIAL_PURCHASE' | 'RENEWAL' | 'UPGRADE' | 'REFUND'

export type PeriodicidadeComissao = 'MENSAL' | 'ANUAL'

export type StatusSaque = 'PENDENTE' | 'PAGO' | 'FALHA'

export type ParceiroResumo = {
  id: string
  nome: string
  logoUrl?: string | null
  statusAuditoria: StatusAuditoriaParceiro
  motivoAuditoria?: string | null
  cnpj?: string | null
}

export type PortalDashboard = {
  parceiro: ParceiroResumo
  papel: PapelParceiro
  totais: {
    cuponsAtivos: number
    resgatesTotal: number
    resgatesUltimos30d: number
  }
}

export type PortalStatus = {
  statusAuditoria: StatusAuditoriaParceiro
  statusAfiliado: StatusModoParceiro
  statusParticipativo: StatusModoParceiro
  motivoAuditoria?: string
  auditadoEm?: string
  podeOperar: boolean
}

export type PortalIndicacao = {
  codigoIndicacao: string
  link: string
  qrCodeDataUrl: string | null
  podeIndicar: boolean
  aviso?: string
}

export type CupomParceiro = {
  id: string
  codigo: string
  titulo: string
  descontoPercentual: number
  categoria: CupomCategoria
  validoAte: string
  ativo: boolean
  usoUnico: boolean
  usosRestantes?: number
  totalResgates: number
}

export type ResgateParceiro = {
  resgateId: string
  cupomCodigo: string
  canal: CanalResgate
  descontoPercentualSnapshot?: number
  resgatadoEm: string
}

/** Resultado de `POST /parceiro/portal/cupons/validar` (resgate já efetivado). */
export type ValidarCupomResultado = {
  valido: true
  resgateId: string
  canal: CanalResgate
  cupom: {
    id: string
    codigo: string
    titulo: string
    descontoPercentual: number
  }
  tutorPrimeiroNome: string | null
}

export type ValidarCupomPayload = {
  codigo: string
  canal: CanalResgate
}

export type Carteira = {
  saldoTotalCentavos: number
  saldoSacavelCentavos: number
  chavePix: string | null
  totalSacadoCentavos: number
  bloqueadoParaSaque: boolean
}

export type TransacaoCarteira = {
  id: string
  tipo: TipoTransacaoParceiro
  valorCentavos: number
  periodicidade: PeriodicidadeComissao | null
  origem: OrigemComissao | null
  createdAt: string
}

export type SaqueResumo = {
  id: string
  valorCentavos: number
  status: StatusSaque
  createdAt: string
  liquidadoEm: string | null
  motivoFalha: string | null
}

export type SaqueDetalhe = SaqueResumo & {
  chavePixSnapshot: string
  comprovante: string | null
}
