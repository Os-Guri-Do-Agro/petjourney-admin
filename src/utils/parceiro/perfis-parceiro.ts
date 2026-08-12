import type { PerfilParceiro } from '@/service/auth/auth-service'
import type { StatusAuditoriaParceiro } from '@/service/parceiro/types'

export type OpcaoParceiro = PerfilParceiro & {
  /** OPERADOR = equipe de outra pessoa; DONO = negócio próprio. */
  equipe: boolean
  /** APROVADO é o estado normal e não ganha badge. */
  badgeStatus: StatusAuditoriaParceiro | null
  /** Já é o parceiro do token: marca o item e não dispara troca. */
  ativo: boolean
}

/**
 * `parceiros[]` traz uma linha por membership. A ordem coloca o negócio próprio antes das
 * equipes, e dentro de cada grupo mantém a ordem do servidor.
 */
export function montarOpcoesParceiro(
  parceiros: PerfilParceiro[],
  parceiroAtivoId?: string | null,
): OpcaoParceiro[] {
  return parceiros
    .map((parceiro) => ({
      ...parceiro,
      equipe: parceiro.papel === 'OPERADOR',
      badgeStatus: parceiro.status === 'APROVADO' ? null : parceiro.status,
      ativo: Boolean(parceiroAtivoId) && parceiro.parceiroId === parceiroAtivoId,
    }))
    .sort((a, b) => Number(a.equipe) - Number(b.equipe))
}

/**
 * O CTA de cadastrar empresa some quando já existe negócio próprio em andamento: o backend
 * recusa um segundo com 409, e prometer o que a API nega é pior que esconder.
 */
export function podeCadastrarNovaEmpresa(parceiros: PerfilParceiro[]) {
  return !parceiros.some(
    (parceiro) =>
      parceiro.papel === 'DONO' &&
      (parceiro.status === 'PENDENTE' || parceiro.status === 'APROVADO'),
  )
}
