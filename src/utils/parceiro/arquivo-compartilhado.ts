import { ApiError } from '@/service/api'

/**
 * Por que a abertura de um arquivo do prontuário falhou.
 *
 * - `ACESSO_ENCERRADO`: o acesso deixou de estar ATIVO entre o load e o clique
 *   (o responsável revogou, ou expirou). O cofre é expurgado no encerramento,
 *   então não há o que servir e a tela precisa se atualizar, não só avisar.
 * - `INDISPONIVEL`: qualquer outra falha (rede, 404 de arquivo, 5xx).
 */
export type FalhaArquivo = 'ACESSO_ENCERRADO' | 'INDISPONIVEL'

/**
 * O backend reserva o **409** desta rota para um caso só: acesso fora de ATIVO
 * (`COMPARTILHAMENTO_JA_ENCERRADO`). Ele é lançado antes de tocar o bucket, de
 * propósito, para não depender de a limpeza ter rodado para negar o acesso.
 *
 * Roteamos por status e não por `errorKey` porque o `ApiError` do portal não
 * carrega esse campo; aqui o status já é inequívoco.
 */
export function classificarFalhaArquivo(error: unknown): FalhaArquivo {
  if (error instanceof ApiError && error.statusCode === 409) {
    return 'ACESSO_ENCERRADO'
  }

  return 'INDISPONIVEL'
}
