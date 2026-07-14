import { ApiError } from '@/service/api'

/** Alfabeto do token de resgate: maiúsculas sem caracteres ambíguos (0/O/1/I/L). */
const CODIGO_RESGATE_REGEX = /^[A-Z2-9]{6,32}$/

export function normalizarCodigoResgate(raw: string): string {
  return raw.toUpperCase().replace(/\s+/g, '')
}

export function isCodigoResgateFormatoValido(codigo: string): boolean {
  return CODIGO_RESGATE_REGEX.test(codigo)
}

export type ValidarCupomErrorView = {
  title: string
  message: string
  /** Após timeout/rede: orientar conferência no histórico. */
  suggestCheckHistorico?: boolean
}

export function resolveValidarCupomError(error: unknown): ValidarCupomErrorView {
  if (!(error instanceof ApiError)) {
    const message =
      error instanceof Error ? error.message : 'Não foi possível validar o código. Tente de novo.'

    return {
      title: 'Falha na validação',
      message,
      suggestCheckHistorico: true,
    }
  }

  if (error.statusCode === 404) {
    return {
      title: 'Código inválido',
      message: 'Código inválido. Confira com o cliente.',
    }
  }

  if (error.statusCode === 410) {
    return {
      title: 'Código expirado',
      message: 'Código expirado. Peça pro cliente gerar um novo no app (leva 2 toques).',
    }
  }

  if (error.statusCode === 409) {
    return {
      title: 'Não foi possível validar',
      message: error.message,
      suggestCheckHistorico: true,
    }
  }

  if (error.statusCode === 403) {
    return {
      title: 'Sem acesso',
      message: 'Sem acesso a este cupom. Verifique o cadastro e a aprovação do parceiro.',
    }
  }

  if (error.statusCode === 400) {
    return {
      title: 'Negócio não selecionado',
      message:
        error.message ||
        'Selecione a empresa parceira e tente validar de novo.',
    }
  }

  return {
    title: 'Falha na validação',
    message: error.message || 'Não foi possível validar o código.',
    suggestCheckHistorico: true,
  }
}
