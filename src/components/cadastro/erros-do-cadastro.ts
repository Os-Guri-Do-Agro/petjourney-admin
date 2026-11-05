/**
 * Os erros do cadastro (E2-01) pelo código: o que vai para um campo e o que vai para o aviso.
 *
 * - `TELEFONE_INVALIDO` traz `campo` (telefone, telefoneSecundario, emergenciaTelefone);
 * - `CPF_INVALIDO` é do campo CPF;
 * - `CPF_JA_CADASTRADO` traz o `clienteId` do cliente que já tem esse CPF, para "usar este";
 * - o resto mostra a `message` da API, que já vem traduzida.
 */
import { ApiError } from '@/service/api'

export type ErroDoCadastro = {
  codigo: string
  mensagem: string
  campo?: string
  /** `CPF_JA_CADASTRADO`: o cliente que já tem o CPF. */
  clienteId?: string
}

export function lerErroDoCadastro(err: unknown, generico: string): ErroDoCadastro {
  if (!(err instanceof ApiError)) {
    return { codigo: '', mensagem: err instanceof Error && err.message ? err.message : generico }
  }

  const codigo = err.codigo ?? ''
  const detalhes = err.detalhes ?? {}
  const campo =
    codigo === 'CPF_INVALIDO' || codigo === 'CPF_JA_CADASTRADO'
      ? 'cpf'
      : typeof detalhes.campo === 'string'
        ? detalhes.campo
        : undefined

  return {
    codigo,
    mensagem: err.message || generico,
    campo,
    clienteId: typeof detalhes.clienteId === 'string' ? detalhes.clienteId : undefined,
  }
}
