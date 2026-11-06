import { describe, expect, it } from 'vitest'

import type { Atendimento } from '@/service/parceiro/atendimentos-service'

import {
  aplicarIdsDoServidor,
  assinaturaDaSecao,
  dadosDaSecao,
  rascunhoDe,
  rotuloDoDispositivo,
} from '../rascunho-do-atendimento'

function vital(valor: number | null = null, naoAferido = false) {
  return { vital: 'PESO', valor, naoAferido, status: 'SEM_REFERENCIA', faixa: null } as never
}

function atendimento(): Atendimento {
  return {
    id: 'at-1',
    status: 'RASCUNHO',
    versao: 3,
    tipo: 'CONSULTA',
    agendamentoId: 'ag-1',
    abertoEm: '2026-11-06T10:00:00-03:00',
    realizadoEm: '2026-11-06T10:00:00-03:00',
    dataDoAtendimento: '2026-11-06',
    anamnese: {
      queixaPrincipal: 'Coceira',
      historia: null,
      desdeQuando: 'TRES_A_SETE_DIAS',
      evolucao: null,
      apetite: 'NORMAL',
      evacuacao: null,
      miccao: null,
      ambiente: null,
      vacinacaoEmDia: true,
      vermifugacaoEmDia: null,
      camposDaPreConsulta: ['QUEIXA_PRINCIPAL'],
      camposDaEscuta: [],
    },
    exameFisico: {
      vitais: {
        peso: vital(12.4),
        temperatura: vital(null, true),
        frequenciaCardiaca: vital(),
        frequenciaRespiratoria: vital(),
        tempoPreenchimentoCapilar: vital(),
        escoreCorporal: vital(),
        pressaoSistolica: vital(),
      },
      mucosas: null,
      hidratacao: null,
      observacao: null,
      sistemas: [{ sistema: 'TEGUMENTAR', status: 'ALTERADO', nota: 'Eritema' }],
      porte: null,
      faixaEtaria: null,
    },
    diagnostico: {
      semDiagnostico: false,
      itens: [{ id: 'dx-1', kind: 'PRESUNTIVO', codigo: 'DE-01', descricao: 'Dermatite' }],
      antecedentes: [],
    },
    conduta: {
      orientacoes: null,
      idiomaDasOrientacoes: null,
      sinaisDeAlerta: null,
      observacaoInterna: null,
      retornoEmDias: null,
      retornoTipoId: 'tipo-1',
      retornoAgendamentoId: null,
    },
  } as unknown as Atendimento
}

describe('rascunho do atendimento', () => {
  it('lê as quatro seções sem o que não é do portal (escuta, status do vital)', () => {
    const r = rascunhoDe(atendimento())
    expect(r.anamnese).not.toHaveProperty('camposDaEscuta')
    expect(r.exame.vitais.peso).toEqual({ valor: 12.4, naoAferido: false })
    expect(r.exame.vitais.temperatura).toEqual({ valor: null, naoAferido: true })
    expect(r.conduta).not.toHaveProperty('retornoAgendamentoId')
  })

  it('manda texto vazio como null e a marca da pré-consulta junto', () => {
    const r = rascunhoDe(atendimento())
    r.anamnese.historia = '   '
    expect(dadosDaSecao(r, 'ANAMNESE')).toMatchObject({
      queixaPrincipal: 'Coceira',
      historia: null,
      camposDaPreConsulta: ['QUEIXA_PRINCIPAL'],
    })
  })

  it('vital não aferido vai sem valor (com valor, o servidor recusa)', () => {
    const r = rascunhoDe(atendimento())
    r.exame.vitais.peso = { valor: 12.4, naoAferido: true }
    const dados = dadosDaSecao(r, 'EXAME_FISICO') as { vitais: Record<string, unknown> }
    expect(dados.vitais.peso).toEqual({ valor: null, naoAferido: true })
  })

  it('a nota do sistema só vai quando ele está alterado', () => {
    const r = rascunhoDe(atendimento())
    r.exame.sistemas = [{ sistema: 'TEGUMENTAR', status: 'NORMAL', nota: 'sobrou' }]
    const dados = dadosDaSecao(r, 'EXAME_FISICO') as { sistemas: unknown[] }
    expect(dados.sistemas).toEqual([{ sistema: 'TEGUMENTAR', status: 'NORMAL', nota: null }])
  })

  it('sem diagnóstico manda a lista vazia; item novo vai sem id, o antigo com', () => {
    const r = rascunhoDe(atendimento())
    r.diagnostico.itens.push({ kind: 'DIFERENCIAL', codigo: null, descricao: ' Alergia ' })
    r.diagnostico.itens.push({ kind: 'DIFERENCIAL', codigo: null, descricao: '' })
    expect(dadosDaSecao(r, 'DIAGNOSTICO')).toEqual({
      itens: [
        { id: 'dx-1', kind: 'PRESUNTIVO', codigo: 'DE-01', descricao: 'Dermatite' },
        { kind: 'DIFERENCIAL', codigo: null, descricao: 'Alergia' },
      ],
      semDiagnostico: false,
      antecedentes: [],
    })
    r.diagnostico.semDiagnostico = true
    expect(dadosDaSecao(r, 'DIAGNOSTICO')).toMatchObject({ itens: [], semDiagnostico: true })
  })

  it('sem dias de retorno, o tipo do retorno vai nulo', () => {
    const r = rascunhoDe(atendimento())
    expect(dadosDaSecao(r, 'CONDUTA')).toMatchObject({ retornoEmDias: null, retornoTipoId: null })
    r.conduta.retornoEmDias = 15
    expect(dadosDaSecao(r, 'CONDUTA')).toMatchObject({ retornoEmDias: 15, retornoTipoId: 'tipo-1' })
  })

  it('a assinatura não muda quando nada mudou', () => {
    const r = rascunhoDe(atendimento())
    const antes = assinaturaDaSecao(r, 'ANAMNESE')
    r.anamnese.queixaPrincipal = 'Coceira'
    expect(assinaturaDaSecao(r, 'ANAMNESE')).toBe(antes)
    r.anamnese.queixaPrincipal = 'Coceira forte'
    expect(assinaturaDaSecao(r, 'ANAMNESE')).not.toBe(antes)
  })

  it('o item novo ganha o id que o servidor criou', () => {
    const r = rascunhoDe(atendimento())
    r.diagnostico.itens.push({ kind: 'DIFERENCIAL', codigo: null, descricao: 'Alergia' })
    aplicarIdsDoServidor(r, {
      semDiagnostico: false,
      itens: [
        { id: 'dx-1', kind: 'PRESUNTIVO', codigo: 'DE-01', descricao: 'Dermatite' },
        { id: 'dx-2', kind: 'DIFERENCIAL', codigo: null, descricao: 'Alergia' },
      ],
      antecedentes: [],
    })
    expect(r.diagnostico.itens.map((item) => item.id)).toEqual(['dx-1', 'dx-2'])
  })

  it('o rótulo da aba diz o navegador e o sistema, sem texto livre', () => {
    expect(
      rotuloDoDispositivo(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0 Safari/537.36',
      ),
    ).toBe('Chrome · Windows')
    expect(
      rotuloDoDispositivo('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit Safari/604.1'),
    ).toBe('Safari · iPadOS')
  })
})
