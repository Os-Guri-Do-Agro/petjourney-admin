/**
 * O migrador contra a planilha bagunçada de demonstração — o "pronto quando" do requisito:
 * uma planilha real de clínica entra e sai do outro lado com cada linha explicada.
 *
 * As expectativas de linha a linha estão anotadas na própria planilha
 * (`data/fixtures/planilhas-de-demonstracao.ts`). Se uma delas mudar, o comentário de lá muda
 * junto — é ele que o roteiro de demonstração usa.
 */
import { beforeEach, describe, expect, it } from 'vitest'

import { gradeDaDemonstracao } from '../../data/fixtures/planilhas-de-demonstracao'
import { migracaoRepository } from '../../data/repositories'
import { resetDataset } from '../../data/store'
import {
  lerCpf,
  lerData,
  lerEspecie,
  lerMicrochip,
  lerPeso,
  lerRegistros,
  lerSexo,
  lerTelefone,
  nomeProprio,
  ordemDasDatas,
  planejar,
  reconhecerOrigem,
  sugerirMapeamento,
  valoresDeEspecie,
  type BaseAtual,
  type EscolhaDeEspecie,
  type OpcaoDaDecisao,
  type SituacaoDaLinha,
} from '../migracao'
import { montarPlanilha, type PlanilhaLida } from '../planilha'

const HOJE = '2026-09-29'

function demonstracao(id: 'clinica' | 'simplesvet' | 'vetus'): PlanilhaLida {
  return montarPlanilha(gradeDaDemonstracao(id), {
    arquivo: `${id}.csv`,
    formato: 'demonstracao',
    codificacao: null,
  })
}

function planoDe(
  planilha: PlanilhaLida,
  base: BaseAtual,
  escolhas: Record<string, OpcaoDaDecisao> = {},
  especies: Record<string, EscolhaDeEspecie> = {},
) {
  const mapeamento = sugerirMapeamento(planilha)
  const { registros, padronizacoes } = lerRegistros(planilha, mapeamento, {
    hoje: HOJE,
    ddd: '11',
    especies,
  })

  return { mapeamento, registros, padronizacoes, plano: planejar(registros, base, escolhas) }
}

describe('leitura de valores', () => {
  it('datas: cinco formatos, ano curto, serial do Excel, sem dia, idade, americana, inválida e futura', () => {
    const contexto = { ordem: 'dmy' as const, hoje: HOJE }

    expect(lerData('12/03/2019', contexto)).toMatchObject({
      valor: '2019-03-12',
      ajuste: undefined,
    })
    expect(lerData('2019-03-12 00:00:00', contexto).valor).toBe('2019-03-12')
    expect(lerData('12.03.2019', contexto).valor).toBe('2019-03-12')
    expect(lerData('05/11/17', contexto)).toMatchObject({
      valor: '2017-11-05',
      ajuste: 'data-ano-curto',
    })
    expect(lerData('05/11/98', contexto).valor).toBe('1998-11-05')
    expect(lerData('43891', contexto)).toMatchObject({
      valor: '2020-03-01',
      ajuste: 'data-da-planilha',
    })
    expect(lerData('12 de março de 2019', contexto).valor).toBe('2019-03-12')
    expect(lerData('mar/2021', contexto)).toMatchObject({
      valor: '2021-03-01',
      ajuste: 'data-sem-dia',
    })
    expect(lerData('2022', contexto)).toMatchObject({ valor: '2022-01-01', ajuste: 'data-sem-dia' })
    expect(lerData('3 anos', contexto)).toMatchObject({
      valor: '2023-09-29',
      ajuste: 'nascimento-pela-idade',
    })
    expect(lerData('04/23/2019', contexto)).toMatchObject({
      valor: '2019-04-23',
      ajuste: 'data-americana',
    })
    expect(lerData('31/02/2020', contexto)).toMatchObject({ valor: null, ajuste: 'data-invalida' })
    expect(lerData('15/08/2027', contexto)).toMatchObject({ valor: null, ajuste: 'data-futura' })
    expect(lerData('00231', contexto).ajuste).toBe('data-invalida')
  })

  it('a coluna decide se é americana: 03/04 é 4 de março quando outra célula diz 04/23', () => {
    expect(ordemDasDatas(['03/04/2019', '04/23/2019'])).toBe('mdy')
    expect(ordemDasDatas(['03/04/2019', '23/04/2019', '04/23/2019'])).toBe('dmy')
    expect(lerData('03/04/2019', { ordem: 'mdy', hoje: HOJE }).valor).toBe('2019-03-04')
  })

  it('telefone: máscara, +55, 0xx, sem DDD, sem nono dígito e dois números numa célula', () => {
    expect(lerTelefone('11984221030', '11')).toMatchObject({
      numeros: ['(11) 98422-1030'],
      padronizou: true,
    })
    expect(lerTelefone('+55 11 97777-6666', '11').numeros).toEqual(['(11) 97777-6666'])
    expect(lerTelefone('0xx11 5555-1234', '11').numeros).toEqual(['(11) 5555-1234'])
    expect(lerTelefone('(011) 98888-7777', '11').numeros).toEqual(['(11) 98888-7777'])

    const semDdd = lerTelefone('8888-1234', '21')

    expect(semDdd.numeros).toEqual(['(21) 98888-1234'])
    expect(semDdd.ajustes.map((ajuste) => ajuste.tipo)).toEqual([
      'telefone-ddd-da-clinica',
      'telefone-nono-digito',
    ])

    expect(lerTelefone('11 98765-4321 / 3322-1100', '11').numeros).toEqual([
      '(11) 98765-4321',
      '(11) 3322-1100',
    ])
    expect(lerTelefone('123', '11')).toMatchObject({
      numeros: [],
      ajustes: [{ tipo: 'telefone-invalido' }],
    })
  })

  it('peso: vírgula, unidade colada, gramas, milhar, e o que só pode ser engano', () => {
    expect(lerPeso('12,8', 'canina').valor).toBe(12.8)
    expect(lerPeso('32,4kg', 'canina').valor).toBe(32.4)
    expect(lerPeso('4500 g', 'canina')).toMatchObject({ valor: 4.5, ajuste: 'peso-em-gramas' })
    expect(lerPeso('1.250,5 kg', 'equina').valor).toBe(1250.5)
    expect(lerPeso('350', 'canina')).toMatchObject({ valor: null, ajuste: 'peso-invalido' })
    expect(lerPeso('430', 'equina').valor).toBe(430)
    expect(lerPeso('0', 'felina').ajuste).toBe('peso-invalido')
  })

  it('CPF que perdeu o zero no Excel volta; onze iguais não passam', () => {
    expect(lerCpf('1234567890')).toMatchObject({ valor: '012.345.678-90', ajuste: 'cpf-zeros' })
    expect(lerCpf('12846397546')).toMatchObject({ valor: '128.463.975-46', padronizou: true })
    expect(lerCpf('111.111.111-11')).toMatchObject({ valor: null, ajuste: 'cpf-invalido' })
  })

  it('microchip em notação científica é descartado com o motivo, porque os dígitos já se perderam', () => {
    expect(lerMicrochip('9,82E+14')).toMatchObject({ valor: null, ajuste: 'microchip-cientifico' })
    expect(lerMicrochip('982000123456789').valor).toBe('982000123456789')
    expect(lerMicrochip('1234').ajuste).toBe('microchip-invalido')
  })

  it('espécie certa, espécie provável, e sexo que também diz castração', () => {
    expect(lerEspecie('Cão')).toEqual({ especie: 'canina', confianca: 'certa' })
    expect(lerEspecie('Coelho')).toEqual({ especie: 'roedor', confianca: 'provavel' })
    expect(lerEspecie('Peixe').especie).toBeNull()
    expect(lerSexo('Fêmea castrada')).toEqual({ sexo: 'femea', castrado: true, reconhecido: true })
    expect(lerSexo('MC')).toEqual({ sexo: 'macho', castrado: true, reconhecido: true })
    expect(lerSexo('')).toEqual({ sexo: null, castrado: null, reconhecido: true })
    expect(lerSexo('indefinido').reconhecido).toBe(false)
    /* Pontuação sozinha é célula em branco, não valor desconhecido. */
    expect(lerSexo('?').sexo).toBeNull()
  })

  it('nome em maiúsculas vira nome próprio; nome escrito com cuidado fica como está', () => {
    expect(nomeProprio('MARIA DA SILVA')).toEqual({ valor: 'Maria da Silva', mudou: true })
    expect(nomeProprio("Joana D'Arc Lima")).toEqual({ valor: "Joana D'Arc Lima", mudou: false })
  })
})

describe('mapeamento sugerido', () => {
  it('a planilha feita à mão: pelo nome da coluna, com a segunda coluna de telefone como telefone 2', () => {
    const planilha = demonstracao('clinica')
    const mapeamento = sugerirMapeamento(planilha)
    const destinos = Object.fromEntries(
      mapeamento.map((item) => [planilha.cabecalhos[item.coluna] || '(vazio)', item.destino]),
    )

    expect(planilha.linhaDoCabecalho).toBe(3)
    expect(destinos).toEqual({
      'NOME CLIENTE': 'responsavelNome',
      CPF: 'cpf',
      Fone: 'telefone',
      'Cel/WhatsApp': 'telefone2',
      'E-mail': 'email',
      Endereço: 'endereco',
      Bairro: 'bairro',
      Cidade: 'cidade',
      Animal: 'petNome',
      Espécie: 'especie',
      Raça: 'raca',
      Sexo: 'sexo',
      'Nasc.': 'nascimento',
      Peso: 'peso',
      'Castrado?': 'castrado',
      Alergias: 'alergia',
      Chip: 'microchip',
      Obs: null,
      Situação: 'situacao',
      '(vazio)': null,
    })
    expect(mapeamento[3]).toMatchObject({ confianca: 'provavel', como: 'nome' })
  })

  it('reconhece os exports e nasce certo por eles', () => {
    for (const id of ['simplesvet', 'vetus'] as const) {
      const planilha = demonstracao(id)
      const mapeamento = sugerirMapeamento(planilha)

      expect(reconhecerOrigem(planilha.cabecalhos)?.id).toBe(id)
      expect(
        mapeamento.filter((item) => item.destino).every((item) => item.como === 'origem'),
      ).toBe(true)
      expect(mapeamento.some((item) => item.destino === 'petNome')).toBe(true)
    }
  })

  it('pelo conteúdo, quando o nome da coluna não diz nada', () => {
    const planilha = montarPlanilha(
      [
        ['Col A', 'Col B', 'Col C'],
        ['Ana Lima', 'ana@exemplo.com', '(11) 98888-7777'],
        ['Bia Reis', 'bia@exemplo.com', '11 97777-6666'],
      ],
      { arquivo: 'x.csv', formato: 'csv', codificacao: 'utf-8' },
    )

    expect(sugerirMapeamento(planilha).map((item) => [item.destino, item.como])).toEqual([
      [null, 'nenhum'],
      ['email', 'conteudo'],
      ['telefone', 'conteudo'],
    ])
  })
})

describe('plano da planilha bagunçada', () => {
  let base: BaseAtual

  beforeEach(() => {
    resetDataset()
    base = migracaoRepository.base()
  })

  function situacoes(escolhas: Record<string, OpcaoDaDecisao> = {}, especies = {}) {
    const { plano } = planoDe(demonstracao('clinica'), base, escolhas, especies)
    const porSituacao: Record<SituacaoDaLinha, number[]> = {
      entra: [],
      junta: [],
      contato: [],
      pendente: [],
      fora: [],
    }

    for (const item of plano.itens) {
      porSituacao[item.situacao].push(item.linha)
    }

    return { plano, porSituacao }
  }

  it('cada linha no seu lugar antes de qualquer decisão', () => {
    const { plano, porSituacao } = situacoes()

    expect(porSituacao).toEqual({
      entra: [6, 9, 17, 19, 21, 23, 24, 25, 27, 28, 29, 30, 31, 32, 33, 34, 35, 38, 39, 41],
      junta: [4, 14, 18, 37],
      contato: [8, 42],
      pendente: [5, 7, 10, 11, 15, 16],
      fora: [13, 20, 22, 26, 40],
    })
    expect(plano.contagem).toMatchObject({ linhas: 37, vazias: 2, pendentes: 6 })
  })

  it('o que fica de fora diz por quê', () => {
    const { plano } = situacoes()
    const motivo = (linha: number) => plano.itens.find((item) => item.linha === linha)?.motivos

    expect(motivo(13)).toEqual(['animal-sem-responsavel'])
    expect(motivo(20)).toEqual(['falecido'])
    expect(motivo(22)).toEqual(['animal-sem-nome'])
    expect(motivo(26)).toEqual(['especie-desconhecida'])
    expect(motivo(40)).toEqual(['especie-desconhecida'])
  })

  it('acha na base quem já é cliente — por telefone, por CPF, e só pergunta quando é só o nome', () => {
    const { plano } = situacoes()
    const doTipo = (tipo: string) => plano.decisoes.filter((decisao) => decisao.tipo === tipo)

    expect(
      doTipo('responsavel-existente').map((decisao) => [
        decisao.outro.nome,
        decisao.motivo,
        decisao.escolha,
      ]),
    ).toEqual([
      ['Marina Alves', 'telefone', 'juntar'],
      ['Eduardo Bittencourt', 'documento', 'juntar'],
      ['Luciana Prado', 'nome', null],
      ['Fátima Gonçalves', 'documento', 'juntar'],
    ])
    expect(doTipo('mesma-pessoa').map((decisao) => [decisao.linhas, decisao.outro.linhas])).toEqual(
      [[[7], [16]]],
    )
    expect(doTipo('orfao').map((decisao) => [decisao.linhas[0], decisao.outro.nome])).toEqual([
      [5, 'Marina Alves'],
      [10, 'Carla Menezes'],
      [11, 'Carla Menezes'],
    ])
    expect(doTipo('animal-repetido').map((decisao) => decisao.linhas)).toEqual([[6, 18]])
  })

  it('juntar não troca o que a clínica já tinha: diz onde a planilha discorda', () => {
    const { plano } = situacoes()
    const luna = plano.itens.find((item) => item.linha === 4)!
    const thor = plano.itens.find((item) => item.linha === 14)!

    expect(luna.petExistente?.nome).toBe('Luna')
    expect(luna.mesclaDoAnimal?.conflitos.map((conflito) => conflito.campo)).toContain('peso')
    expect(thor.mesclaDoAnimal?.preenche).toContain('alergia')
    expect(thor.ajustes.map((ajuste) => ajuste.tipo)).toEqual(
      expect.arrayContaining(['telefone-nono-digito', 'email-invalido', 'microchip-cientifico']),
    )
  })

  it('com as decisões tomadas, nada fica pendente e a continuação da célula mesclada herda o responsável', () => {
    const { plano: antes } = situacoes()
    const escolhas: Record<string, OpcaoDaDecisao> = {}

    for (const decisao of antes.decisoes) {
      escolhas[decisao.id] = decisao.tipo === 'mesma-pessoa' ? 'manter' : 'juntar'
    }

    const { plano, porSituacao } = situacoes(escolhas)

    expect(porSituacao.pendente).toEqual([])
    expect(porSituacao.junta).toEqual([4, 5, 14, 15, 18, 37])
    expect(plano.itens.find((item) => item.linha === 10)).toMatchObject({
      situacao: 'entra',
      responsavel: { nome: 'Carla Menezes' },
    })
    expect(plano.itens.find((item) => item.linha === 11)!.ajustes[0]).toMatchObject({
      tipo: 'responsavel-da-linha-anterior',
      para: 'Carla Menezes',
    })
    /* Frida só é achada depois que a linha 5 vira da Marina — e aí é a Frida que já existe. */
    expect(plano.itens.find((item) => item.linha === 5)!.petExistente?.nome).toBe('Frida')
  })

  it('o de-para de espécie: o em branco sem raça pode ganhar espécie; o peixe pode continuar de fora', () => {
    const planilha = demonstracao('clinica')
    const valores = valoresDeEspecie(planilha, sugerirMapeamento(planilha))
    const emBranco = valores.find((valor) => valor.chave === '')!

    expect(valores.find((valor) => valor.chave === 'peixe')).toMatchObject({
      sugestao: null,
      ocorrencias: 1,
    })
    expect(valores.find((valor) => valor.chave === 'coelho')).toMatchObject({
      sugestao: 'roedor',
      confianca: 'provavel',
    })
    /* Pipoca (Shih Tzu) e Amendoim ("?" com Pinscher) a raça resolve; a Lua não. */
    expect(emBranco).toMatchObject({ ocorrencias: 3, pelaRaca: 2 })

    const { porSituacao } = situacoes({}, { '': 'felina', peixe: 'fora' })

    expect(porSituacao.fora).toEqual([13, 20, 22, 26])
    expect(porSituacao.entra).toContain(40)
  })

  it('o que só mudou de forma é somado, não listado', () => {
    const { padronizacoes } = planoDe(demonstracao('clinica'), base)

    /* 11984221030, '11 98765-4321', 11998765544, +55 11…, 0xx11… */
    expect(padronizacoes.telefone).toBe(5)
    expect(padronizacoes.nome).toBeGreaterThanOrEqual(5)
    expect(padronizacoes.documento).toBeGreaterThan(0)
  })
})

describe('bases grandes', () => {
  beforeEach(() => {
    resetDataset()
  })

  it('o export de 2.400 linhas planeja sem nenhuma pergunta de "mesma pessoa"', () => {
    const planilha = demonstracao('vetus')
    const { plano } = planoDe(planilha, migracaoRepository.base())

    expect(planilha.linhas).toHaveLength(2_400)
    expect(plano.decisoes.filter((decisao) => decisao.tipo === 'mesma-pessoa')).toEqual([])
    expect(plano.contagem.pendentes).toBe(0)
    expect(plano.contagem.entram).toBeGreaterThan(2_200)
  })

  it('o export do SimplesVet acha o Daniel e a Sushi que já estão aqui', () => {
    const { plano } = planoDe(demonstracao('simplesvet'), migracaoRepository.base())
    const sushi = plano.itens.find(
      (item) => item.animal?.nome === 'Sushi' && item.responsavel?.nome === 'Daniel Okamoto',
    )

    expect(sushi).toMatchObject({ situacao: 'junta', tutorExistente: { nome: 'Daniel Okamoto' } })
  })
})
