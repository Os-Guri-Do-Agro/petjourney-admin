/**
 * A versão do login e do pé do menu da conta é a do `package.json`, chegando pelo `define` do
 * Vite junto com o commit e o momento do build. Se o `define` se perder, a tela mostraria outra
 * coisa (ou quebraria) e ninguém saberia o que está no ar: é para isso que a versão existe
 * (Regra 5 do CLAUDE.md).
 */

import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { BUILD_DO_PORTAL, VERSAO_DO_PORTAL, descricaoDoBuild } from '@/utils/versao'

describe('VERSAO_DO_PORTAL', () => {
  it('é a versão do package.json, em três números', () => {
    const pacote = JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8'))

    expect(VERSAO_DO_PORTAL).toBe(pacote.version)
    expect(VERSAO_DO_PORTAL).toMatch(/^\d+\.\d+\.\d+$/)
  })
})

describe('BUILD_DO_PORTAL', () => {
  it('traz o momento do build em ISO e o commit curto (ou vazio)', () => {
    expect(Number.isNaN(new Date(BUILD_DO_PORTAL.data).getTime())).toBe(false)
    expect(BUILD_DO_PORTAL.commit).toMatch(/^([0-9a-f]{7})?$/)
  })

  it('vira a dica "Gerada em <data> · <commit>" no idioma da tela', () => {
    const dica = descricaoDoBuild((data) => `Gerada em ${data}`, 'pt-BR')

    const sufixo = BUILD_DO_PORTAL.commit ? ` · ${BUILD_DO_PORTAL.commit}` : ''

    expect(dica).toMatch(/^Gerada em \d{2}\/\d{2}\/\d{4},? \d{2}:\d{2}/)
    expect(dica.endsWith(sufixo)).toBe(true)
  })
})
