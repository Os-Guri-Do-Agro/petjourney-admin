import { describe, expect, it } from 'vitest'

import { ApiError } from '@/service/api'
import { classificarFalhaArquivo } from '@/utils/parceiro/arquivo-compartilhado'

describe('classificarFalhaArquivo', () => {
  it('trata 409 como acesso encerrado', () => {
    expect(classificarFalhaArquivo(new ApiError('encerrado', 409))).toBe('ACESSO_ENCERRADO')
  })

  /**
   * O responsável passou a poder tirar um documento de um acesso já concedido. O 404 deixou de
   * ser ruído: ele é a subtração chegando na tela, e precisa ser dita como definitiva.
   */
  it('trata 404 como arquivo removido do cofre, não como falha genérica', () => {
    expect(classificarFalhaArquivo(new ApiError('nao encontrado', 404))).toBe('ARQUIVO_REMOVIDO')
  })

  it('403 do storage é a mesma remoção vista do bucket', () => {
    expect(classificarFalhaArquivo(new ApiError('forbidden', 403))).toBe('ARQUIVO_REMOVIDO')
  })

  it('não confunde arquivo removido com fim do acesso', () => {
    expect(classificarFalhaArquivo(new ApiError('nao encontrado', 404))).not.toBe(
      'ACESSO_ENCERRADO',
    )
  })

  /** Rede e 5xx continuam transitórios: dizer "foi removido" faria desistir do que ainda existe. */
  it('falha de rede e 5xx viram indisponível', () => {
    expect(classificarFalhaArquivo(new Error('offline'))).toBe('INDISPONIVEL')
    expect(classificarFalhaArquivo(null)).toBe('INDISPONIVEL')
    expect(classificarFalhaArquivo(new ApiError('boom', 500))).toBe('INDISPONIVEL')
    expect(classificarFalhaArquivo(new ApiError('gateway', 502))).toBe('INDISPONIVEL')
  })
})
