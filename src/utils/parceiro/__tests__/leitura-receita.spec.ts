/**
 * Regras da leitura de receita com IA na anotação de consulta.
 *
 * O que mais custa errar aqui: aceitar HEIC (a API responde 415 depois do upload), deixar a
 * receita passar do teto de 3 anexos (400 no envio da anotação, com a anotação inteira escrita)
 * e apagar o que o profissional já tinha digitado na prescrição ao pôr os remédios lidos.
 */

import { describe, expect, it } from 'vitest'

import type { ItemFormularioLeitura } from '@/service/parceiro/types'

import {
  criarAnotacaoEstruturadaForm,
  criarPrescricaoItemForm,
  montarAnotacaoEstruturada,
  type PrescricaoItemForm,
} from '../anotacao-estruturada'
import {
  ACCEPT_LEITURA,
  cabeMaisArquivoLeitura,
  dimensoesReduzidas,
  ehHeic,
  intervaloDaEspera,
  MAX_BYTES_IMAGEM_LEITURA,
  MAX_BYTES_PDF_LEITURA,
  mesclarPrescricaoLida,
  prescricaoItemDaLeitura,
  problemaDaImagemReduzida,
  problemaDoArquivoLeitura,
  temCampoAConferir,
  vagasParaLeitura,
} from '../leitura-receita'

const foto = (nome = 'receita.jpg', size = 300_000, type = 'image/jpeg') => ({
  name: nome,
  size,
  type,
})
const pdf = (size = 400_000) => ({ name: 'receita.pdf', size, type: 'application/pdf' })

function lido(overrides: Partial<ItemFormularioLeitura> = {}): ItemFormularioLeitura {
  return {
    nome: 'Amoxicilina 250 mg/5 ml',
    dose: '5 ml',
    unidade: 'ml',
    frequencia: '12/12h',
    duracaoDias: 7,
    instrucoes: 'Via oral. Dar após a refeição',
    ...overrides,
  }
}

const ALTA = { nome: 'ALTA', dose: 'ALTA', frequencia: 'ALTA', duracaoDias: 'ALTA' } as const

describe('arquivos da leitura', () => {
  it('não oferece HEIC no seletor', () => {
    expect(ACCEPT_LEITURA).not.toMatch(/heic|heif/i)
    expect(ACCEPT_LEITURA.split(',')).toEqual([
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
    ])
  })

  it('reconhece HEIC pelo tipo e pela extensão (o navegador às vezes manda o tipo vazio)', () => {
    expect(ehHeic({ type: 'image/heic', name: 'a.heic' })).toBe(true)
    expect(ehHeic({ type: '', name: 'IMG_0001.HEIC' })).toBe(true)
    expect(ehHeic({ type: 'image/heif', name: 'x' })).toBe(true)
    expect(ehHeic({ type: 'image/jpeg', name: 'receita.jpg' })).toBe(false)
    expect(problemaDoArquivoLeitura([], foto('IMG.heic', 1000, ''), 3)).toBe('HEIC')
  })

  it('recusa tipo que não é imagem aceita nem PDF', () => {
    expect(problemaDoArquivoLeitura([], foto('a.gif', 1000, 'image/gif'), 3)).toBe('TIPO')
    expect(problemaDoArquivoLeitura([], foto('a.docx', 1000, 'application/msword'), 3)).toBe('TIPO')
  })

  it('aceita até o máximo de fotos e para no limite', () => {
    expect(problemaDoArquivoLeitura([foto(), foto()], foto(), 3)).toBeNull()
    expect(problemaDoArquivoLeitura([foto(), foto(), foto()], foto(), 3)).toBe('LIMITE')
    expect(problemaDoArquivoLeitura([foto()], foto(), 1)).toBe('LIMITE')
  })

  it('não mistura PDF com foto, nos dois sentidos, e aceita um PDF só', () => {
    expect(problemaDoArquivoLeitura([foto()], pdf(), 3)).toBe('MISTURA')
    expect(problemaDoArquivoLeitura([pdf()], foto(), 3)).toBe('MISTURA')
    expect(problemaDoArquivoLeitura([pdf()], pdf(), 3)).toBe('LIMITE')
    expect(problemaDoArquivoLeitura([], pdf(), 3)).toBeNull()
  })

  it('recusa PDF acima de 10 MB; a foto só é medida depois de reduzida', () => {
    expect(problemaDoArquivoLeitura([], pdf(MAX_BYTES_PDF_LEITURA + 1), 3)).toBe('PDF_GRANDE')
    expect(problemaDoArquivoLeitura([], foto('grande.jpg', 12 * 1024 * 1024), 3)).toBeNull()
    expect(problemaDaImagemReduzida(foto('r.jpg', MAX_BYTES_IMAGEM_LEITURA + 1))).toBe(
      'IMAGEM_GRANDE',
    )
    expect(problemaDaImagemReduzida(foto('r.jpg', 800_000))).toBeNull()
  })

  it('PDF fecha a lista; foto deixa adicionar até o máximo', () => {
    expect(cabeMaisArquivoLeitura([pdf()], 3)).toBe(false)
    expect(cabeMaisArquivoLeitura([foto(), foto()], 3)).toBe(true)
    expect(cabeMaisArquivoLeitura([foto(), foto()], 2)).toBe(false)
  })

  it('a receita só usa o que sobra do teto de 3 anexos', () => {
    expect(vagasParaLeitura(0)).toBe(3)
    expect(vagasParaLeitura(1)).toBe(2)
    expect(vagasParaLeitura(3)).toBe(0)
    expect(vagasParaLeitura(5)).toBe(0)
  })
})

describe('redução da imagem', () => {
  it('leva o lado maior a 2576 px mantendo a proporção', () => {
    expect(dimensoesReduzidas(4032, 3024)).toEqual({ largura: 2576, altura: 1932 })
    expect(dimensoesReduzidas(3024, 4032)).toEqual({ largura: 1932, altura: 2576 })
  })

  it('nunca amplia imagem que já cabe', () => {
    expect(dimensoesReduzidas(1200, 1600)).toEqual({ largura: 1200, altura: 1600 })
    expect(dimensoesReduzidas(2576, 100)).toEqual({ largura: 2576, altura: 100 })
  })
})

describe('espera da leitura', () => {
  it('recua 2, 2, 3 e depois 5 s', () => {
    expect([0, 1, 2, 3, 4, 9].map(intervaloDaEspera)).toEqual([2000, 2000, 3000, 5000, 5000, 5000])
  })
})

describe('itens lidos', () => {
  it('marca "Confira" em todo campo sem confiança alta', () => {
    const item = prescricaoItemDaLeitura(lido(), {
      nome: 'ALTA',
      dose: 'MEDIA',
      frequencia: 'BAIXA',
      duracaoDias: null,
    })

    expect(item.conferir).toEqual({ nome: false, dose: true, frequencia: true, duracaoDias: true })
  })

  it('sem a confiança do item, marca tudo', () => {
    const item = prescricaoItemDaLeitura(lido(), undefined)

    expect(item.conferir).toEqual({ nome: true, dose: true, frequencia: true, duracaoDias: true })
  })

  it('confiança alta em tudo não marca nada', () => {
    expect(temCampoAConferir([prescricaoItemDaLeitura(lido(), ALTA)])).toBe(false)
  })

  it('duração vazia, zero ou quebrada vira vazio; acima do teto é cortada no teto', () => {
    expect(prescricaoItemDaLeitura(lido({ duracaoDias: null }), ALTA).duracaoDias).toBeNull()
    expect(prescricaoItemDaLeitura(lido({ duracaoDias: 0 }), ALTA).duracaoDias).toBeNull()
    expect(prescricaoItemDaLeitura(lido({ duracaoDias: 7.8 }), ALTA).duracaoDias).toBe(7)
    expect(prescricaoItemDaLeitura(lido({ duracaoDias: 99999 }), ALTA).duracaoDias).toBe(3650)
  })

  it('texto lido respeita os tetos do formulário', () => {
    const item = prescricaoItemDaLeitura(lido({ nome: 'x'.repeat(500), dose: null }), ALTA)

    expect(item.nome).toHaveLength(200)
    expect(item.dose).toBe('')
  })

  it('a marca de conferir nunca vai para o payload da anotação', () => {
    const form = criarAnotacaoEstruturadaForm()
    form.prescricaoItens = [prescricaoItemDaLeitura(lido(), undefined)]

    const payload = montarAnotacaoEstruturada('CONSULTA', form)

    expect(payload?.prescricaoItens?.[0]).toEqual({
      nome: 'Amoxicilina 250 mg/5 ml',
      dose: '5 ml',
      unidade: 'ml',
      frequencia: '12/12h',
      duracaoDias: 7,
      instrucoes: 'Via oral. Dar após a refeição',
    })
    expect(JSON.stringify(payload)).not.toContain('conferir')
  })
})

describe('mesclar com a prescrição do formulário', () => {
  const digitado = (nome: string): PrescricaoItemForm => ({ ...criarPrescricaoItemForm(), nome })

  it('mantém o que o profissional digitou, tira linha em branco e põe os lidos no fim', () => {
    const atuais = [digitado('Omeprazol'), criarPrescricaoItemForm()]
    const mescla = mesclarPrescricaoLida(atuais, {
      itensFormulario: [lido({ nome: 'Dipirona' }), lido({ nome: 'Meloxicam' })],
      confianca: [ALTA, ALTA],
    })

    expect(mescla.itens.map((i) => i.nome)).toEqual(['Omeprazol', 'Dipirona', 'Meloxicam'])
    expect(mescla.aplicados).toBe(2)
    expect(mescla.cortados).toBe(0)
  })

  it('para no teto de 10 e conta os que não couberam', () => {
    const atuais = Array.from({ length: 8 }, (_, i) => digitado(`Remédio ${i + 1}`))
    const mescla = mesclarPrescricaoLida(atuais, {
      itensFormulario: [lido(), lido(), lido(), lido()],
      confianca: [],
    })

    expect(mescla.itens).toHaveLength(10)
    expect(mescla.aplicados).toBe(2)
    expect(mescla.cortados).toBe(2)
  })

  it('tolera resposta sem as listas', () => {
    const mescla = mesclarPrescricaoLida([digitado('Omeprazol')], {
      itensFormulario: undefined as unknown as ItemFormularioLeitura[],
      confianca: undefined as unknown as [],
    })

    expect(mescla.itens.map((i) => i.nome)).toEqual(['Omeprazol'])
    expect(mescla.aplicados).toBe(0)
  })
})
