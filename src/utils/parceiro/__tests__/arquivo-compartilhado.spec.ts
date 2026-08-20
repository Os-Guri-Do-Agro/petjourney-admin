import { describe, expect, it } from 'vitest'

import { ApiError } from '@/service/api'
import { classificarFalhaArquivo } from '@/utils/parceiro/arquivo-compartilhado'

describe('classificarFalhaArquivo', () => {
  it('trata 409 como acesso encerrado', () => {
    expect(classificarFalhaArquivo(new ApiError('encerrado', 409))).toBe('ACESSO_ENCERRADO')
  })

  it('não confunde 404 de arquivo com fim do acesso', () => {
    expect(classificarFalhaArquivo(new ApiError('nao encontrado', 404))).toBe('INDISPONIVEL')
  })

  it('403 de permissão não encerra o acesso na tela', () => {
    expect(classificarFalhaArquivo(new ApiError('forbidden', 403))).toBe('INDISPONIVEL')
  })

  it('falha de rede vira indisponível', () => {
    expect(classificarFalhaArquivo(new Error('offline'))).toBe('INDISPONIVEL')
    expect(classificarFalhaArquivo(null)).toBe('INDISPONIVEL')
  })
})
