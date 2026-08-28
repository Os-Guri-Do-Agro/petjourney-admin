import { describe, expect, it } from 'vitest'

import enGB from '@/locales/en-GB.json'
import en from '@/locales/en.json'
import es from '@/locales/es.json'
import pt from '@/locales/pt.json'
import {
  ESPECIALIDADE_OUTRA,
  ESPECIALIDADES,
  isEspecialidadeConhecida,
  rotuloEspecialidade,
  servidorGuardouEspecialidade,
  valorEspecialidade,
} from '@/utils/parceiro/especialidade'

const LIMITE = 60
const traduz = (chave: string) => `[${chave}]`

describe('valorEspecialidade', () => {
  it('opção da lista viaja como CHAVE, nunca como rótulo', () => {
    expect(valorEspecialidade('CARDIOLOGIA', '', LIMITE)).toBe('CARDIOLOGIA')
  })

  it('"Outra" viaja como texto livre, dentro do teto do backend', () => {
    expect(valorEspecialidade(ESPECIALIDADE_OUTRA, '  Acupuntura  ', LIMITE)).toBe('Acupuntura')
    expect(valorEspecialidade(ESPECIALIDADE_OUTRA, 'a'.repeat(80), LIMITE)).toHaveLength(LIMITE)
  })

  /** String vazia diria ao backend que a área é "": o campo tem que ficar FORA do form. */
  it('sem escolha, e com "Outra" em branco, não há o que mandar', () => {
    expect(valorEspecialidade(null, '', LIMITE)).toBeUndefined()
    expect(valorEspecialidade(ESPECIALIDADE_OUTRA, '   ', LIMITE)).toBeUndefined()
  })
})

describe('rotuloEspecialidade', () => {
  it('a chave nunca sai crua na tela: quem traduz é o cliente', () => {
    expect(rotuloEspecialidade('CARDIOLOGIA', traduz)).toBe('[CARDIOLOGIA]')
  })

  it('texto livre sai como o profissional escreveu', () => {
    expect(rotuloEspecialidade('Acupuntura', traduz)).toBe('Acupuntura')
  })

  /** AC9: anotação antiga sai sem parênteses, e não com "(null)". */
  it('anotação sem o campo não vira "(null)"', () => {
    expect(rotuloEspecialidade(null, traduz)).toBeNull()
    expect(rotuloEspecialidade(undefined, traduz)).toBeNull()
    expect(rotuloEspecialidade('   ', traduz)).toBeNull()
  })

  it('separa a lista fechada do texto livre', () => {
    expect(isEspecialidadeConhecida('ANIMAIS_EXOTICOS')).toBe(true)
    expect(isEspecialidadeConhecida('Fisioterapia')).toBe(false)
  })
})

/**
 * A rota de anotação é multipart e NÃO roda a ValidationPipe: campo desconhecido é
 * ignorado em silêncio, sem 400. Comparar o enviado com o devolvido é o único mecanismo
 * de detecção que existe.
 */
describe('servidorGuardouEspecialidade', () => {
  it('servidor que devolve o campo igual guardou', () => {
    expect(servidorGuardouEspecialidade('CARDIOLOGIA', 'CARDIOLOGIA')).toBe(true)
  })

  it('servidor antigo engole o campo em silêncio, e isso é detectado', () => {
    expect(servidorGuardouEspecialidade('CARDIOLOGIA', null)).toBe(false)
    expect(servidorGuardouEspecialidade('CARDIOLOGIA', undefined)).toBe(false)
  })

  it('sem área enviada não há o que conferir', () => {
    expect(servidorGuardouEspecialidade(undefined, null)).toBe(true)
  })
})

describe('copy da área de atuação', () => {
  const LOCALES: [string, { acessos: { especialidade: unknown; anotacao: unknown } }][] = [
    ['pt', pt],
    ['en', en],
    ['en-GB', enGB],
    ['es', es],
  ]

  it('toda área tem rótulo nos 4 locales, mais "Outra" e a copy do formulário', () => {
    for (const [nome, dicionario] of LOCALES) {
      const areas = dicionario.acessos.especialidade as Record<string, string>
      const anotacao = dicionario.acessos.anotacao as Record<string, string>

      for (const chave of [...ESPECIALIDADES, ESPECIALIDADE_OUTRA]) {
        expect(areas[chave]?.trim(), `${nome}: ${chave}`).toBeTruthy()
        expect(areas[chave], `${nome}: ${chave} cru`).not.toBe(chave)
      }

      for (const chave of [
        'especialidade',
        'especialidadeOutraPlaceholder',
        'especialidadeNaoSalva',
      ]) {
        expect(anotacao[chave]?.trim(), `${nome}: ${chave}`).toBeTruthy()
      }
    }
  })

  /** en-GB é escrito, nunca herdado do en-US. */
  it('en-GB tem grafia própria', () => {
    expect(enGB.acessos.especialidade.ORTOPEDIA).toBe('Orthopaedics')
    expect(en.acessos.especialidade.ORTOPEDIA).toBe('Orthopedics')
  })
})
