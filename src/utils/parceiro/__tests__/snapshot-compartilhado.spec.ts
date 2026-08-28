import { describe, expect, it } from 'vitest'

import type { ItemSnapshot, SnapshotPetCompartilhado } from '@/service/parceiro/types'
import {
  carimboDoResumo,
  estadoDoBloco,
  estadoTratamentosContinuos,
  montarBlocosLista,
  normalizarMotivo,
  rotuloItem,
  snapshotDisponivel,
  type FonteSnapshot,
} from '@/utils/parceiro/snapshot-compartilhado'

const TODAS_CATEGORIAS = [
  'ALERGIAS',
  'VACINAS',
  'MEDICAMENTOS',
  'COMPORTAMENTO',
  'DIAGNOSTICOS',
  'DIARIO',
  'DOCUMENTOS',
]

function snapshot(overrides: Partial<SnapshotPetCompartilhado> = {}): SnapshotPetCompartilhado {
  return {
    alergias: [],
    vacinas: [],
    medicamentos: [],
    comportamento: [],
    diagnosticos: [],
    diario: [],
    documentos: [],
    ...overrides,
  }
}

function fonte(overrides: Partial<FonteSnapshot> = {}): FonteSnapshot {
  return {
    status: 'ATIVO',
    categorias: [...TODAS_CATEGORIAS],
    snapshot: snapshot(),
    ...overrides,
  }
}

/** AC-P7: acesso encerrado tem `snapshot: null` e nada da Parte 15 pode rodar sobre isso. */
describe('acesso encerrado', () => {
  it('EXPIRADO com snapshot null não disponibiliza nada', () => {
    expect(snapshotDisponivel(fonte({ status: 'EXPIRADO', snapshot: null }))).toBe(false)
  })

  it('REVOGADO sem categorias não quebra e não renderiza bloco algum', () => {
    const encerrado = fonte({ status: 'REVOGADO', snapshot: null, categorias: undefined })

    expect(montarBlocosLista(encerrado)).toEqual([])
    expect(estadoDoBloco(encerrado, 'documentos', 0)).toBe('OCULTO')
    expect(estadoDoBloco(encerrado, 'diario', 0)).toBe('OCULTO')
  })

  it('ATIVO com snapshot null também é oculto (defesa, não deveria acontecer)', () => {
    expect(estadoDoBloco(fonte({ snapshot: null }), 'alergias', 0)).toBe('OCULTO')
  })
})

/** AC-P5 e AC-P6: matriz categoria x vazio x motivo. */
describe('estadoDoBloco', () => {
  it('categoria fora do consentimento não renderiza, mesmo com conteúdo no snapshot', () => {
    const semDocumentos = fonte({ categorias: ['ALERGIAS'] })

    expect(estadoDoBloco(semDocumentos, 'documentos', 3)).toBe('OCULTO')
  })

  it('categoria compartilhada com conteúdo renderiza', () => {
    expect(estadoDoBloco(fonte(), 'vacinas', 2)).toBe('CONTEUDO')
  })

  it('vazio com SEM_REGISTRO devolve o motivo', () => {
    const comMotivo = fonte({ snapshot: snapshot({ motivos: { vacinas: 'SEM_REGISTRO' } }) })

    expect(estadoDoBloco(comMotivo, 'vacinas', 0)).toBe('SEM_REGISTRO')
  })

  it('diário vazio com FILTRADO_JANELA devolve o motivo do diário', () => {
    const comMotivo = fonte({ snapshot: snapshot({ motivos: { diario: 'FILTRADO_JANELA' } }) })

    expect(estadoDoBloco(comMotivo, 'diario', 0)).toBe('FILTRADO_JANELA')
  })

  it('vazio sem motivos cai em genérico: acesso anterior à Parte 15 não permite inferir', () => {
    expect(estadoDoBloco(fonte(), 'medicamentos', 0)).toBe('GENERICO')
  })

  /**
   * Categoria retirada de um acesso já concedido: a seção fica, vazia, dizendo o porquê.
   *
   * O acesso chega com VACINAS FORA de `categorias`, que é como o backend responde depois
   * da subtração. Enquanto a regra lia o consentimento antes do motivo, este caso caía em
   * `OCULTO` e a frase nunca aparecia: quem atende lia ausência de vacina onde houve perda
   * de permissão.
   */
  it('categoria removida pelo responsável não se confunde com sem registro', () => {
    const removida = fonte({
      categorias: TODAS_CATEGORIAS.filter((c) => c !== 'VACINAS'),
      snapshot: snapshot({ motivos: { vacinas: 'REMOVIDO_PELO_TUTOR' } }),
    })

    expect(estadoDoBloco(removida, 'vacinas', 0)).toBe('REMOVIDO_PELO_TUTOR')
    expect(montarBlocosLista(removida).map((b) => b.id)).toContain('vacinas')
  })

  it('categoria removida com a categoria ainda na lista também fala', () => {
    const removida = fonte({
      snapshot: snapshot({ motivos: { vacinas: 'REMOVIDO_PELO_TUTOR' } }),
    })

    expect(estadoDoBloco(removida, 'vacinas', 0)).toBe('REMOVIDO_PELO_TUTOR')
  })

  it('conteúdo presente vence carimbo de removido residual', () => {
    const removida = fonte({
      categorias: TODAS_CATEGORIAS.filter((c) => c !== 'VACINAS'),
      snapshot: snapshot({ motivos: { vacinas: 'REMOVIDO_PELO_TUTOR' } }),
    })

    expect(estadoDoBloco(removida, 'vacinas', 2)).toBe('OCULTO')
  })

  it('motivo presente para outro bloco não vaza para o bloco vazio', () => {
    const comMotivo = fonte({ snapshot: snapshot({ motivos: { vacinas: 'SEM_REGISTRO' } }) })

    expect(estadoDoBloco(comMotivo, 'alergias', 0)).toBe('GENERICO')
  })
})

describe('normalizarMotivo', () => {
  it('SEM_REGISTRO vale em qualquer bloco', () => {
    expect(normalizarMotivo('documentos', 'SEM_REGISTRO')).toBe('SEM_REGISTRO')
  })

  it('FILTRADO_JANELA fora do diário vira genérico: a frase da janela mentiria ali', () => {
    expect(normalizarMotivo('alergias', 'FILTRADO_JANELA')).toBe('GENERICO')
  })

  /**
   * O oposto do genérico: aqui a tela **precisa** afirmar. Cair em "nada a mostrar" faria quem
   * atende ler ausência de vacina onde houve perda de permissão.
   */
  it('REMOVIDO_PELO_TUTOR vale em qualquer bloco', () => {
    expect(normalizarMotivo('vacinas', 'REMOVIDO_PELO_TUTOR')).toBe('REMOVIDO_PELO_TUTOR')
    expect(normalizarMotivo('documentos', 'REMOVIDO_PELO_TUTOR')).toBe('REMOVIDO_PELO_TUTOR')
    expect(normalizarMotivo('diario', 'REMOVIDO_PELO_TUTOR')).toBe('REMOVIDO_PELO_TUTOR')
  })

  it('enum desconhecido vira genérico em vez de afirmar ausência de registro', () => {
    expect(normalizarMotivo('vacinas', 'MOTIVO_QUE_AINDA_NAO_EXISTE')).toBe('GENERICO')
    expect(normalizarMotivo('vacinas', null)).toBe('GENERICO')
    expect(normalizarMotivo('vacinas', undefined)).toBe('GENERICO')
  })
})

describe('montarBlocosLista', () => {
  it('mantém a ordem clínica e só traz as categorias compartilhadas', () => {
    const parcial = fonte({
      categorias: ['DIAGNOSTICOS', 'ALERGIAS'],
      snapshot: snapshot({ alergias: [{ titulo: 'Dipirona' }] }),
    })

    expect(montarBlocosLista(parcial).map((b) => b.id)).toEqual(['alergias', 'diagnosticos'])
  })

  it('bloco com conteúdo vem sem motivo; bloco vazio vem com motivo', () => {
    const misto = fonte({
      categorias: ['ALERGIAS', 'VACINAS'],
      snapshot: snapshot({
        alergias: [{ titulo: 'Dipirona' }],
        motivos: { vacinas: 'SEM_REGISTRO' },
      }),
    })

    expect(montarBlocosLista(misto)).toEqual([
      { id: 'alergias', items: [{ titulo: 'Dipirona' }], motivo: null },
      { id: 'vacinas', items: [], motivo: 'SEM_REGISTRO' },
    ])
  })

  it('campo ausente no snapshot é tratado como lista vazia', () => {
    const semCampo = fonte({ categorias: ['VACINAS'], snapshot: {} })

    expect(montarBlocosLista(semCampo)).toEqual([{ id: 'vacinas', items: [], motivo: 'GENERICO' }])
  })
})

/** AC-P2 e AC-P3: label traduzido quando existe, enum cru quando não. */
/** AC-P2 e AC-P3: o backend traduz in-place; a tela renderiza o que veio, sem campo de label. */
describe('rótulos', () => {
  it('mostra título e detalhe como vieram traduzidos na request', () => {
    const diagnostico: ItemSnapshot = { titulo: 'Liver disease' }
    const alergia: ItemSnapshot = { titulo: 'Frango', detalhe: 'Alimentar' }

    expect(rotuloItem(diagnostico)).toEqual({ titulo: 'Liver disease', detalhe: '' })
    /* O gatilho é texto do responsável e chega intacto; só o detalhe é enum traduzido. */
    expect(rotuloItem(alergia)).toEqual({ titulo: 'Frango', detalhe: 'Alimentar' })
  })

  it('item sem detalhe devolve string vazia, não undefined', () => {
    expect(rotuloItem({ titulo: 'Antirrábica' }).detalhe).toBe('')
  })

  it('detalhe só com espaço não vira seção de detalhe na tela', () => {
    expect(rotuloItem({ titulo: 'Antirrábica', detalhe: '   ' }).detalhe).toBe('')
  })
})

/** AC-P8. */
describe('carimboDoResumo', () => {
  it('usa snapshotAtualizadoEm quando o responsável mexeu depois de entregar', () => {
    expect(
      carimboDoResumo({
        criadoEm: '2026-08-10T10:00:00.000Z',
        snapshotAtualizadoEm: '2026-08-12T09:00:00.000Z',
      }),
    ).toEqual({ data: '2026-08-12T09:00:00.000Z', atualizado: true })
  })

  it('cai em criadoEm quando o campo é null ou ausente', () => {
    expect(
      carimboDoResumo({ criadoEm: '2026-08-10T10:00:00.000Z', snapshotAtualizadoEm: null }).data,
    ).toBe('2026-08-10T10:00:00.000Z')
    expect(carimboDoResumo({ criadoEm: '2026-08-10T10:00:00.000Z' })).toEqual({
      data: '2026-08-10T10:00:00.000Z',
      atualizado: false,
    })
  })
})

/**
 * Bloco próprio de tratamento contínuo (Parte 16).
 *
 * A distinção entre chave AUSENTE e lista vazia é o miolo: errar nela esconde o remédio de
 * todo dia de todo acesso criado antes do deploy, sem erro nenhum na tela.
 */
describe('estadoTratamentosContinuos', () => {
  const REMEDIO = {
    titulo: 'Prednisolona',
    detalhe: '2 mg · 1x ao dia · oral',
    detalheLabel: '2 mg · 1x ao dia · oral',
    destaque: true,
    motivo: 'para a dor',
    diagnostico: 'Artrose',
    desde: '2025-03-10T00:00:00.000Z',
    observacoes: 'dar junto com a comida',
  }

  const comTratamentos = [...TODAS_CATEGORIAS, 'TRATAMENTOS']

  it('chave ausente não abre o bloco: naquele acesso o remédio sai dentro de Medicamentos', () => {
    expect(estadoTratamentosContinuos(fonte({ categorias: comTratamentos }))).toBe('OCULTO')
  })

  it('lista vazia com TRATAMENTOS consentido abre o bloco e diz por que está vazio', () => {
    const vazio = fonte({
      categorias: comTratamentos,
      snapshot: snapshot({
        tratamentosContinuos: [],
        motivos: { tratamentosContinuos: 'SEM_REGISTRO' },
      }),
    })

    expect(estadoTratamentosContinuos(vazio)).toBe('SEM_REGISTRO')
  })

  it('lista vazia sem TRATAMENTOS consentido não deixa rastro', () => {
    const naoCompartilhado = fonte({ snapshot: snapshot({ tratamentosContinuos: [] }) })

    expect(estadoTratamentosContinuos(naoCompartilhado)).toBe('OCULTO')
  })

  it('com tratamento em curso o bloco mostra conteúdo', () => {
    const comItem = fonte({
      categorias: comTratamentos,
      snapshot: snapshot({ tratamentosContinuos: [REMEDIO] }),
    })

    expect(estadoTratamentosContinuos(comItem)).toBe('CONTEUDO')
  })

  it('retirada pelo responsável fala mesmo com a categoria fora da lista', () => {
    const removido = fonte({
      snapshot: snapshot({
        tratamentosContinuos: [],
        motivos: { tratamentosContinuos: 'REMOVIDO_PELO_TUTOR' },
      }),
    })

    expect(estadoTratamentosContinuos(removido)).toBe('REMOVIDO_PELO_TUTOR')
  })

  it('acesso encerrado não abre o bloco', () => {
    const encerrado = fonte({ status: 'REVOGADO', snapshot: null, categorias: undefined })

    expect(estadoTratamentosContinuos(encerrado)).toBe('OCULTO')
  })
})
