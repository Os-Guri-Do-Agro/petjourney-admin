import { ApiError } from '@/service/api'

/**
 * O portal não recebe um código estável para "parceiro excluído": a API responde 403 igual à
 * conta que nunca teve vínculo e igual ao OPERADOR barrado numa ação de DONO. Quem separa os
 * casos é o contexto da própria sessão, decidido aqui.
 */
export type AcessoPortalDecisao =
  | 'selecionar-parceiro'
  | 'retentar-sem-parceiro'
  | 'acesso-encerrado'
  | 'sem-acesso'
  | 'erro'

export type AcessoPortalContexto = {
  /** `parceiroId` enviado na requisição que falhou (null = deixou a API resolver). */
  parceiroIdEnviado: string | null
  /** O portal já tinha carregado o contexto desta conta antes da falha. */
  tinhaContexto: boolean
  /** A tentativa sem `parceiroId` já aconteceu. Corta o laço de retentativa. */
  jaRetentou: boolean
}

/**
 * Um `parceiroId` guardado no navegador sobrevive à exclusão do parceiro. Sem a retentativa,
 * quem é membro de dois parceiros ficaria trancado do lado de fora por causa do id morto.
 */
export function decidirAcessoPortal(
  error: unknown,
  contexto: AcessoPortalContexto,
): AcessoPortalDecisao {
  if (!(error instanceof ApiError)) {
    return 'erro'
  }

  if (error.statusCode === 400) {
    return 'selecionar-parceiro'
  }

  if (error.statusCode !== 403) {
    return 'erro'
  }

  if (contexto.parceiroIdEnviado && !contexto.jaRetentou) {
    return 'retentar-sem-parceiro'
  }

  return contexto.tinhaContexto ? 'acesso-encerrado' : 'sem-acesso'
}
