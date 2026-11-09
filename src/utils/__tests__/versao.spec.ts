/**
 * A versão do pé do menu da conta é a do `package.json`, chegando pelo `define` do Vite. Se o
 * `define` se perder, a tela mostraria outra coisa (ou quebraria) e ninguém saberia o que está
 * no ar: é para isso que a versão existe (Regra 5 do CLAUDE.md).
 */

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { VERSAO_DO_PORTAL } from '@/utils/versao'

describe('VERSAO_DO_PORTAL', () => {
  it('é a versão do package.json, em três números', () => {
    const pacote = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'))

    expect(VERSAO_DO_PORTAL).toBe(pacote.version)
    expect(VERSAO_DO_PORTAL).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
