import i18n from '@/i18n'
import { ApiError } from '@/service/api'
import type {
  ModoParticipacao,
  ModoStatusBloco,
  StatusModoParceiro,
} from '@/service/parceiro/types'

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

/** Parte 9: SUSPENSO não pode re-solicitar (só o suporte reativa). */
const SOLICITAR_STATUSES: StatusModoParceiro[] = ['NAO_SOLICITADO', 'REJEITADO']

export const MODOS_PARTICIPACAO: ModoParticipacao[] = ['afiliado', 'participativo']

/**
 * Default do formulário de cadastro, também no reenvio pós-recusa: a recusa devolve
 * os programas só pedidos para `NAO_SOLICITADO` e o backend esquece a intenção, então
 * partir do status atual renderizaria tudo desmarcado e jogaria o parceiro de volta
 * no funil antigo sem ele perceber.
 */
export const PROGRAMAS_PADRAO_CADASTRO: ModoParticipacao[] = ['afiliado']

/** Programa já decidido não é mexido pelo formulário: só o que está pedido ou livre entra na submissão. */
export function isProgramaEditavelNoCadastro(status: StatusModoParceiro) {
  return status === 'NAO_SOLICITADO' || status === 'SOLICITADO' || status === 'REJEITADO'
}

/**
 * Seleção inicial do formulário de cadastro/reenvio. Sem status (primeiro cadastro)
 * vale o default; com status, o que já está `SOLICITADO` continua marcado e o que
 * está `ATIVO`/`SUSPENSO` fica fora, porque o POST não deve mexer nele.
 */
export function resolveProgramasIniciais(
  blocos?: Partial<Record<ModoParticipacao, Pick<ModoStatusBloco, 'status'>>> | null,
): ModoParticipacao[] {
  if (!blocos) {
    return [...PROGRAMAS_PADRAO_CADASTRO]
  }

  return MODOS_PARTICIPACAO.filter((modo) => {
    const status = blocos[modo]?.status

    if (status === 'SOLICITADO') {
      return true
    }

    if (status && !isProgramaEditavelNoCadastro(status)) {
      return false
    }

    return PROGRAMAS_PADRAO_CADASTRO.includes(modo)
  })
}

/** Programas que o admin ainda vai decidir, para a tela de espera listar o que foi pedido. */
export function programasEmAnalise(
  blocos?: Partial<Record<ModoParticipacao, Pick<ModoStatusBloco, 'status'>>> | null,
): ModoParticipacao[] {
  if (!blocos) {
    return []
  }

  return MODOS_PARTICIPACAO.filter((modo) => blocos[modo]?.status === 'SOLICITADO')
}

export function canSolicitarModo(status: StatusModoParceiro) {
  return SOLICITAR_STATUSES.includes(status)
}

export function getModoCardCopy(modo: ModoParticipacao): ModoCardCopy {
  if (modo === 'afiliado') {
    return {
      title: 'Programa de Afiliados',
      subtitle: 'Transparência e participação',
      description:
        'Receba participação por cada indicação que vira assinante. Acesse sua carteira, acompanhe saldo e saque via PIX.',
      features: [
        'Participação por indicação convertida',
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
    description: 'Faça parte da comunidade PetJourney: perks exclusivos e collabs.',
    features: [
      'Selo de parceiro participativo',
      'Perks e benefícios exclusivos',
      'Convites para collabs da rede',
    ],
    icon: 'pi pi-star',
    tone: 'participativo',
  }
}

/** Solicitar modo exige parceiro existente e papel DONO (sem vínculo, o caminho é o cadastro). */
export function canManageSolicitacaoModo(isDono: boolean, semAcessoParceiro: boolean) {
  return isDono && !semAcessoParceiro
}

/** Regra de ouro (Parte 9): o botão de solicitar renderiza SE `podeSolicitar === true`, e mais nada. */
export function resolveModoCta(
  bloco: Pick<ModoStatusBloco, 'status' | 'podeSolicitar'>,
  modo: ModoParticipacao,
  canManageSolicitacao: boolean,
): ModoCta {
  if (!canManageSolicitacao) {
    return { type: 'none' }
  }

  if (bloco.podeSolicitar) {
    return bloco.status === 'REJEITADO'
      ? { type: 'solicitar-novamente', label: 'Solicitar de novo' }
      : { type: 'solicitar', label: 'Solicitar' }
  }

  if (bloco.status === 'SOLICITADO') {
    return { type: 'aguardando', label: 'Aguardando análise' }
  }

  if (bloco.status === 'ATIVO' && modo === 'afiliado') {
    return { type: 'carteira', label: 'Ir para a Carteira', to: '/parceiro/carteira' }
  }

  return { type: 'none' }
}

export function resolveSolicitarModoError(error: unknown) {
  const t = i18n.global.t.bind(i18n.global)

  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : String(t('programas.card.error.generic'))
  }

  if (error.reason === 'PARCEIRO_MODO_JA_SOLICITADO') {
    return String(t('programas.card.error.alreadyRequested'))
  }

  if (error.reason === 'PARCEIRO_MODO_SUSPENSO') {
    return String(t('programas.card.error.modoSuspenso'))
  }

  if (error.statusCode === 403) {
    return String(t('programas.card.error.forbidden'))
  }

  if (error.statusCode === 409) {
    const hint = `${error.message} ${error.error ?? ''}`.toLowerCase()

    if (hint.includes('afiliado_nao_ativo')) {
      return String(t('programas.card.error.afiliadoNaoAtivo'))
    }

    if (hint.includes('operavel') || hint.includes('operável')) {
      return String(t('programas.card.error.notOperable'))
    }

    return error.message
  }

  return error.message
}

/** Erros do funil de cadastro (Parte 9), roteados pelo `reason` estável. */
export function resolveCadastroErrorView(error: unknown): {
  message: string
  field?: 'nome' | 'cnpj'
} {
  const t = i18n.global.t.bind(i18n.global)

  if (!(error instanceof ApiError)) {
    return {
      message:
        error instanceof Error ? error.message : String(t('parceiroCadastro.errors.generic')),
    }
  }

  switch (error.reason) {
    case 'PARCEIRO_CADASTRO_JA_EXISTE':
      return { message: String(t('parceiroCadastro.errors.jaExiste')) }
    case 'PARCEIRO_CADASTRO_SUSPENSO':
      return { message: String(t('parceiroCadastro.errors.suspenso')) }
    case 'PARCEIRO_CADASTRO_NOME_EM_USO':
      return { message: String(t('parceiroCadastro.errors.nomeEmUso')), field: 'nome' }
    case 'PARCEIRO_CADASTRO_CNPJ_EM_USO':
      return { message: String(t('parceiroCadastro.errors.cnpjEmUso')), field: 'cnpj' }
    default:
      return { message: error.message }
  }
}

export function isAfiliadoNaoAtivoError(error: unknown) {
  if (!(error instanceof ApiError) || error.statusCode !== 409) {
    return false
  }

  const hint = `${error.message} ${error.error ?? ''}`.toLowerCase()

  return hint.includes('afiliado_nao_ativo')
}
