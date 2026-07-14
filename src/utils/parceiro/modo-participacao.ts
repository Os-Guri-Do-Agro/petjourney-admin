import { ApiError } from '@/service/api'
import type { ModoParticipacao, StatusModoParceiro } from '@/service/parceiro/types'

export type ModoCardCopy = {
  title: string
  subtitle: string
  description: string
  features: string[]
  icon: string
  tone: 'afiliado' | 'participativo'
}

export type ModoCta =
  | { type: 'solicitar'; label: 'Solicitar' }
  | { type: 'solicitar-novamente'; label: 'Solicitar de novo' }
  | { type: 'aguardando'; label: 'Aguardando análise' }
  | { type: 'carteira'; label: 'Ir para a Carteira'; to: '/parceiro/carteira' }
  | { type: 'none' }

const SOLICITAR_STATUSES: StatusModoParceiro[] = [
  'NAO_SOLICITADO',
  'REJEITADO',
  'SUSPENSO',
]

export function canSolicitarModo(status: StatusModoParceiro) {
  return SOLICITAR_STATUSES.includes(status)
}

export function getModoCardCopy(modo: ModoParticipacao): ModoCardCopy {
  if (modo === 'afiliado') {
    return {
      title: 'Programa de Afiliados',
      subtitle: 'Transparência e comissões',
      description:
        'Receba comissão por cada indicação que vira assinante. Acesse sua carteira, acompanhe saldo e saque via PIX.',
      features: [
        'Comissão por indicação convertida',
        'Extrato e saldo em tempo real',
        'Saque via PIX',
      ],
      icon: 'pi pi-wallet',
      tone: 'afiliado',
    }
  }

  return {
    title: 'Programa Participativo',
    subtitle: 'Comunidade e perks',
    description:
      'Faça parte da comunidade PetJourney: perks exclusivos e collabs.',
    features: [
      'Selo de parceiro participativo',
      'Perks e benefícios exclusivos',
      'Convites para collabs da rede',
    ],
    icon: 'pi pi-star',
    tone: 'participativo',
  }
}

/** DONO com membership, ou usuário ainda sem vínculo tentando entrar no programa. */
export function canManageSolicitacaoModo(isDono: boolean, semAcessoParceiro: boolean) {
  return isDono || semAcessoParceiro
}

export function resolveModoCta(
  status: StatusModoParceiro,
  modo: ModoParticipacao,
  canManageSolicitacao: boolean,
): ModoCta {
  if (!canManageSolicitacao) {
    return { type: 'none' }
  }

  if (status === 'NAO_SOLICITADO') {
    return { type: 'solicitar', label: 'Solicitar' }
  }

  if (status === 'REJEITADO' || status === 'SUSPENSO') {
    return { type: 'solicitar-novamente', label: 'Solicitar de novo' }
  }

  if (status === 'SOLICITADO') {
    return { type: 'aguardando', label: 'Aguardando análise' }
  }

  if (status === 'ATIVO' && modo === 'afiliado') {
    return { type: 'carteira', label: 'Ir para a Carteira', to: '/parceiro/carteira' }
  }

  return { type: 'none' }
}

export function resolveSolicitarModoError(error: unknown) {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : 'Não foi possível solicitar.'
  }

  if (error.statusCode === 403) {
    return 'Sem permissão para solicitar. Confirme o vínculo da conta ou peça ao dono da empresa.'
  }

  if (error.statusCode === 409) {
    const hint = `${error.message} ${error.error ?? ''}`.toLowerCase()

    if (hint.includes('afiliado_nao_ativo')) {
      return 'Ative o programa afiliado para acessar a carteira.'
    }

    if (hint.includes('operavel') || hint.includes('operável')) {
      return 'Seu cadastro ainda está em análise.'
    }

    if (hint.includes('solicitado') || hint.includes('ativo')) {
      return 'Este programa já foi solicitado ou está ativo.'
    }

    return error.message
  }

  return error.message
}

export function isAfiliadoNaoAtivoError(error: unknown) {
  if (!(error instanceof ApiError) || error.statusCode !== 409) {
    return false
  }

  const hint = `${error.message} ${error.error ?? ''}`.toLowerCase()

  return hint.includes('afiliado_nao_ativo')
}
