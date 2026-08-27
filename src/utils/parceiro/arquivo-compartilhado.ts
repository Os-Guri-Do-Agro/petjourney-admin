import { ApiError } from '@/service/api'

/**
 * Por que a abertura de um arquivo do prontuário falhou.
 *
 * - `ACESSO_ENCERRADO`: o acesso deixou de estar ATIVO entre o load e o clique
 *   (o responsável revogou, ou expirou). O cofre é expurgado no encerramento,
 *   então não há o que servir e a tela precisa se atualizar, não só avisar.
 * - `ARQUIVO_REMOVIDO`: o acesso segue vivo, mas **este** arquivo saiu dele. O
 *   responsável tirou o documento do cofre e o binário já não existe.
 * - `INDISPONIVEL`: qualquer outra falha (rede, 5xx). Transitória até prova em
 *   contrário.
 *
 * A diferença entre os dois últimos é a diferença entre "tente de novo" e "não
 * adianta tentar", e ela precisa chegar em quem está atendendo. Dizer "não foi
 * possível abrir agora" sobre um arquivo que foi apagado faz o profissional
 * insistir; dizer "foi removido" sobre uma queda de rede faz ele desistir do que
 * ainda está lá.
 */
export type FalhaArquivo = 'ACESSO_ENCERRADO' | 'ARQUIVO_REMOVIDO' | 'INDISPONIVEL'

/**
 * O backend reserva o **409** desta rota para um caso só: acesso fora de ATIVO
 * (`COMPARTILHAMENTO_JA_ENCERRADO`). Ele é lançado antes de tocar o bucket, de
 * propósito, para não depender de a limpeza ter rodado para negar o acesso.
 *
 * **404 e 403 são o arquivo, não o acesso.** O 404 é o id que não está mais no
 * cofre; o 403 é a mesma subtração vista do storage, que deixa de assinar URL
 * para um objeto que saiu. Os dois só acontecem com o acesso ainda ATIVO — se
 * ele tivesse caído, o 409 teria vindo antes.
 *
 * Roteamos por status e não por `errorKey` porque o `ApiError` do portal não
 * carrega esse campo; aqui o status já é inequívoco.
 */
export function classificarFalhaArquivo(error: unknown): FalhaArquivo {
  if (!(error instanceof ApiError)) {
    return 'INDISPONIVEL'
  }

  if (error.statusCode === 409) {
    return 'ACESSO_ENCERRADO'
  }

  if (error.statusCode === 404 || error.statusCode === 403) {
    return 'ARQUIVO_REMOVIDO'
  }

  return 'INDISPONIVEL'
}
