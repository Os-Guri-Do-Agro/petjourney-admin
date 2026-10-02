/**
 * O motor da anamnese por voz.
 *
 * O que estes testes guardam é a promessa que faz o veterinário confiar no que vê: **todo campo
 * proposto aponta para o que foi dito**, e o que foi dito com latido, com duas vozes ou só
 * deduzido chega marcado. Um motor que acerta tudo em silêncio seria pior que um que erra à
 * vista — a revisão viraria o gesto de apertar um botão.
 */

import { describe, expect, it } from 'vitest'

import { consultaGravada } from '../../data/fixtures/consulta-gravada'
import type { Anamnese, TrechoDaConversa } from '../../data/types'
import {
  alertasDaProposta,
  ancorarCitacao,
  extrairDaConversa,
  normalizar,
  pareceePergunta,
  patchDaEscuta,
  textoDaCitacao,
} from '../escuta'
import type { CampoDaEscuta, PropostaDaEscuta } from '../escuta'

// --------------------------------------------------------------------- ajudantes

let sequencia = 0

function fala(
  texto: string,
  extra: Partial<Omit<TrechoDaConversa, 'texto'>> = {},
): TrechoDaConversa {
  sequencia += 1

  return {
    id: `t${sequencia}`,
    falante: 'responsavel',
    texto,
    emMs: sequencia * 1000,
    confianca: 0.93,
    interferencia: null,
    ...extra,
  }
}

function proposta(trechos: TrechoDaConversa[], campo: CampoDaEscuta): PropostaDaEscuta | undefined {
  return extrairDaConversa(trechos).propostas.find((item) => item.campo === campo)
}

function valor(texto: string, campo: CampoDaEscuta) {
  return proposta([fala(texto)], campo)?.valor
}

function porId(trechos: TrechoDaConversa[]) {
  return new Map(trechos.map((trecho) => [trecho.id, trecho]))
}

const ANAMNESE_VAZIA: Anamnese = {
  queixaPrincipal: '',
  historia: '',
  duracaoSintomas: '',
  evolucao: '',
  antecedentes: [],
  apetite: '',
  evacuacao: '',
  miccao: '',
  ambiente: '',
  vacinacaoEmDia: null,
  vermifugacaoEmDia: null,
}

// --------------------------------------------------------------------- texto

describe('normalizar', () => {
  it('tira acento e caixa sem mudar o comprimento — é o que permite citar o original', () => {
    const original = 'Tá VOMITANDO, não come; cocô mole — ração'

    expect(normalizar(original)).toBe('ta vomitando, nao come; coco mole — racao')
    expect(normalizar(original)).toHaveLength(original.length)
  })
})

// --------------------------------------------------------------------- campos

describe('o que cada frase vira', () => {
  it('junta os sintomas da queixa na ordem em que apareceram, sem repetir', () => {
    const trechos = [
      fala('Ela tá vomitando desde ontem.'),
      fala('Vomitou de novo e tá bem quietinha, tossindo um pouco.'),
    ]

    expect(proposta(trechos, 'queixaPrincipal')?.valor).toBe('Vômito, apatia, tosse')
  })

  it('lê a duração por extenso e em algarismo, e "desde" com o dia', () => {
    expect(valor('Começou faz dois dias.', 'duracaoSintomas')).toBe('2 dias')
    expect(valor('Já tem uma semana que ele tá assim.', 'duracaoSintomas')).toBe('1 semana')
    expect(valor('Faz 3 meses, mais ou menos.', 'duracaoSintomas')).toBe('3 meses')
    expect(valor('Tá assim desde sábado.', 'duracaoSintomas')).toBe('Desde sábado')
    expect(valor('Começou na semana passada.', 'duracaoSintomas')).toBe('Desde a semana passada')
  })

  it('distingue apetite ausente, reduzido e normal — inclusive com negação', () => {
    expect(valor('Recusou a ração hoje cedo.', 'apetite')).toBe('ausente')
    expect(valor('Não come nada desde ontem.', 'apetite')).toBe('ausente')
    expect(valor('Tá comendo pouquinho.', 'apetite')).toBe('reduzido')
    expect(valor('Não tá comendo bem.', 'apetite')).toBe('reduzido')
    expect(valor('Tá comendo normal.', 'apetite')).toBe('normal')
  })

  it('lê evacuação, micção e ambiente', () => {
    expect(valor('O cocô tá mole.', 'evacuacao')).toBe('diarreia')
    expect(valor('Faz dois dias que não faz cocô.', 'evacuacao')).toBe('constipacao')
    expect(valor('O xixi tá normal.', 'miccao')).toBe('normal')
    expect(valor('Chora pra fazer xixi.', 'miccao')).toBe('disuria')
    expect(valor('A gente mora em apartamento.', 'ambiente')).toBe('domiciliar')
    expect(valor('Ele fica solto no quintal.', 'ambiente')).toBe('externo')
  })

  it('não confunde "tá mole" (apatia) com fezes moles', () => {
    const trechos = [fala('Ela tá mole, só dormindo.')]

    expect(proposta(trechos, 'queixaPrincipal')?.valor).toBe('Apatia')
    expect(proposta(trechos, 'evacuacao')).toBeUndefined()
  })

  it('lê evolução, e "não melhorou" não é melhora', () => {
    expect(valor('Hoje tá pior.', 'evolucao')).toBe('piorando')
    expect(valor('Já melhorou bastante.', 'evolucao')).toBe('melhorando')
    expect(valor('Não melhorou nada.', 'evolucao')).toBe('estavel')
    expect(valor('Vai e volta.', 'evolucao')).toBe('intermitente')
  })

  it('separa o que foi dito do que foi deduzido na prevenção', () => {
    const dita = proposta([fala('As vacinas estão em dia.')], 'vacinacaoEmDia')
    const deduzida = proposta([fala('A vacina da raiva ele tomou em março.')], 'vacinacaoEmDia')

    expect(dita).toMatchObject({ valor: true, modo: 'dito' })
    expect(deduzida).toMatchObject({ valor: true, modo: 'deduzido' })
    expect(valor('A vacina tá atrasada.', 'vacinacaoEmDia')).toBe(false)
    expect(valor('Vermífugo tá em dia.', 'vermifugacaoEmDia')).toBe(true)
    expect(valor('Faz tempo que não dou vermífugo.', 'vermifugacaoEmDia')).toBe(false)
  })

  it('lista antecedentes com tipo, sem arrastar o "né" do fim', () => {
    const trechos = [
      fala('Ela é alérgica a dipirona né, e toma enalapril todo dia.'),
      fala('Foi castrada ano passado. Teve displasia também.'),
    ]
    const lista = extrairDaConversa(trechos).propostas.filter(
      (item) => item.campo === 'antecedente',
    )

    expect(lista.map((item) => [item.tipo, item.valor, item.quando])).toEqual([
      ['alergia', 'Dipirona', ''],
      ['medicacao-continua', 'Enalapril', ''],
      ['cirurgia', 'Castração', 'ano passado'],
      ['doenca-previa', 'Displasia', ''],
    ])
  })

  it('não inventa antecedente onde houve negação', () => {
    const trechos = [fala('Não é castrada, e não é alérgica a nada que eu saiba.')]

    expect(extrairDaConversa(trechos).propostas).toEqual([])
  })

  it('guarda o relato da história como a frase dita, curta', () => {
    const trechos = [fala('Domingo ela pegou um osso de frango do lixo.')]

    expect(proposta(trechos, 'historia')?.valor).toBe('Pegou um osso de frango do lixo.')
  })
})

// --------------------------------------------------------------------- quem falou

describe('quem falou', () => {
  it('pergunta do veterinário não vira fato — "ela tá comendo?" não é apetite', () => {
    const trechos = [
      fala('E ela tá comendo normal?', { falante: 'veterinario' }),
      fala('Não, recusou a ração.'),
    ]

    expect(proposta(trechos, 'apetite')?.valor).toBe('ausente')
    expect(proposta(trechos, 'apetite')?.divergencias).toEqual([])
  })

  it('ao vivo, sem autoria, descarta o que tem cara de pergunta', () => {
    expect(pareceePergunta('Desde quando ela tá vomitando')).toBe(true)
    expect(pareceePergunta('E o cocô')).toBe(true)
    expect(pareceePergunta('Tá comendo?')).toBe(true)
    expect(pareceePergunta('Ela tá vomitando desde ontem')).toBe(false)

    const trechos = [
      fala('Como tá o xixi', { falante: 'nao-identificado' }),
      fala('O xixi tá normal', { falante: 'nao-identificado' }),
    ]

    expect(proposta(trechos, 'miccao')?.citacoes).toHaveLength(1)
  })
})

// --------------------------------------------------------------------- o que fica de fora

describe('o que é ouvido e não vira campo', () => {
  it('anota a hipótese diagnóstica e não preenche nada com ela', () => {
    const trechos = [
      fala('Pode ser uma gastroenterite, mas vou examinar antes.', { falante: 'veterinario' }),
    ]
    const resultado = extrairDaConversa(trechos)

    expect(resultado.propostas).toEqual([])
    expect(resultado.notas).toMatchObject([{ kind: 'hipotese', valor: 'gastroenterite' }])
  })

  it('não confunde "pode ser que" com hipótese', () => {
    const resultado = extrairDaConversa([fala('Pode ser que ela coma mais tarde.')])

    expect(resultado.notas).toEqual([])
  })

  it('o peso dito pelo responsável é informação de casa; dito pelo veterinário, medida', () => {
    const resultado = extrairDaConversa([
      fala('Pesei em casa, tá com uns seis quilos.'),
      fala('Deu 6,4 kg na balança. Temperatura 39,5.', { falante: 'veterinario' }),
    ])

    expect(resultado.notas.map((nota) => [nota.kind, nota.valor])).toEqual([
      ['peso-informado', '6 kg'],
      ['medida', '39,5 °C'],
    ])
  })
})

// --------------------------------------------------------------------- confiança

describe('o que a revisão precisa ver', () => {
  it('marca a proposta que saiu de trecho com latido, e cita exatamente o que foi ouvido', () => {
    const trechos = [fala('Começou faz dez dias.', { confianca: 0.46, interferencia: 'latido' })]
    const duracao = proposta(trechos, 'duracaoSintomas') as PropostaDaEscuta

    expect(duracao.valor).toBe('10 dias')
    expect(alertasDaProposta(duracao, porId(trechos))).toEqual(['latido'])
    expect(textoDaCitacao(duracao.citacoes[0]!, porId(trechos))).toBe('faz dez dias')
  })

  it('confiança baixa sem interferência nomeada também é marcada', () => {
    const trechos = [fala('O xixi tá normal.', { confianca: 0.5 })]
    const miccao = proposta(trechos, 'miccao') as PropostaDaEscuta

    expect(alertasDaProposta(miccao, porId(trechos))).toEqual(['baixa-confianca'])
  })

  it('quando a conversa diz duas coisas, a mais recente vence e a outra fica à vista', () => {
    const trechos = [fala('O cocô tá normal.'), fala('Não, peraí, o cocô tava mole hoje.')]
    const evacuacao = proposta(trechos, 'evacuacao') as PropostaDaEscuta

    expect(evacuacao.valor).toBe('diarreia')
    expect(evacuacao.divergencias.map((item) => item.valor)).toEqual(['normal'])
    expect(alertasDaProposta(evacuacao, porId(trechos))).toEqual(['divergencia'])
  })

  it('frase limpa vence frase com latido, mesmo dita antes', () => {
    const trechos = [
      fala('Começou faz dois dias.'),
      fala('Faz dez dias.', { confianca: 0.4, interferencia: 'latido' }),
    ]

    expect(proposta(trechos, 'duracaoSintomas')?.valor).toBe('2 dias')
  })

  it('citação que não existe na conversa é o alerta mais grave — é o que um modelo inventa', () => {
    const trechos = [fala('O xixi tá normal.')]
    const inventada: PropostaDaEscuta = {
      id: 'vacinacaoEmDia',
      campo: 'vacinacaoEmDia',
      valor: true,
      tipo: null,
      quando: '',
      modo: 'dito',
      citacoes: [{ trechoId: 't-que-nao-existe', inicio: 0, fim: 4 }],
      divergencias: [],
    }

    expect(alertasDaProposta(inventada, porId(trechos))[0]).toBe('sem-origem')
    expect(alertasDaProposta({ ...inventada, citacoes: [] }, porId(trechos))).toEqual([
      'sem-origem',
    ])
  })

  it('ancora a frase de um modelo na transcrição ignorando acento, e recusa o que não foi dito', () => {
    const trechos = [fala('Ela tá vomitando desde ontem.')]

    expect(ancorarCitacao(trechos, 'ta vomitando')).toEqual({
      trechoId: trechos[0]!.id,
      inicio: 4,
      fim: 16,
    })
    expect(ancorarCitacao(trechos, 'vacina em dia')).toBeNull()
  })
})

// --------------------------------------------------------------------- aplicação

describe('patchDaEscuta', () => {
  let ids = 0
  const novoId = () => `ant-${(ids += 1)}`

  it('substitui campo simples, soma história e não repete antecedente', () => {
    const atual: Anamnese = {
      ...ANAMNESE_VAZIA,
      queixaPrincipal: 'Claudicação',
      historia: 'Sem trauma observado.',
      antecedentes: [{ id: 'a1', kind: 'alergia', descricao: 'Dipirona', quando: '' }],
    }

    const patch = patchDaEscuta(
      atual,
      [
        { campo: 'queixaPrincipal', valor: 'Vômito, apatia', tipo: null, quando: '' },
        { campo: 'historia', valor: 'Pegou um osso de frango do lixo.', tipo: null, quando: '' },
        { campo: 'apetite', valor: 'ausente', tipo: null, quando: '' },
        { campo: 'vacinacaoEmDia', valor: false, tipo: null, quando: '' },
        { campo: 'antecedente', valor: 'dipirona', tipo: 'alergia', quando: '' },
        { campo: 'antecedente', valor: 'Castração', tipo: 'cirurgia', quando: 'ano passado' },
      ],
      novoId,
    )

    expect(patch.queixaPrincipal).toBe('Vômito, apatia')
    expect(patch.historia).toBe('Sem trauma observado.\nPegou um osso de frango do lixo.')
    expect(patch.apetite).toBe('ausente')
    expect(patch.vacinacaoEmDia).toBe(false)
    expect(patch.antecedentes?.map((item) => item.descricao)).toEqual(['Dipirona', 'Castração'])
  })

  it('recusa opção que o campo não aceita', () => {
    const patch = patchDaEscuta(
      ANAMNESE_VAZIA,
      [{ campo: 'apetite', valor: 'voraz', tipo: null, quando: '' }],
      novoId,
    )

    expect(patch).toEqual({})
  })
})

// --------------------------------------------------------------------- a consulta de demonstração

describe('a consulta de demonstração', () => {
  const trechos = consultaGravada({ pet: 'Nina', sexo: 'femea', responsavel: 'Camila' })
  const resultado = extrairDaConversa(trechos)
  const mapa = porId(trechos)

  function linha(campo: CampoDaEscuta) {
    const item = resultado.propostas.find((candidata) => candidata.campo === campo)

    return item ? { valor: item.valor, alertas: alertasDaProposta(item, mapa) } : null
  }

  it('preenche a anamnese inteira a partir da conversa', () => {
    expect(linha('queixaPrincipal')).toEqual({ valor: 'Vômito, apatia', alertas: [] })
    expect(linha('evolucao')).toEqual({ valor: 'piorando', alertas: [] })
    expect(linha('historia')).toEqual({ valor: 'Pegou um osso de frango do lixo.', alertas: [] })
    expect(linha('apetite')).toEqual({ valor: 'ausente', alertas: [] })
    expect(linha('miccao')).toEqual({ valor: 'normal', alertas: [] })
    expect(linha('ambiente')).toEqual({ valor: 'domiciliar', alertas: [] })
    expect(linha('vermifugacaoEmDia')).toEqual({ valor: true, alertas: [] })
  })

  it('erra onde a clínica atrapalhou, e o erro chega marcado', () => {
    /* A responsável disse "dois"; o latido cobriu. */
    expect(linha('duracaoSintomas')).toEqual({ valor: '10 dias', alertas: ['latido'] })
    /* Mãe e filha responderam juntas e discordaram. */
    expect(linha('evacuacao')).toEqual({
      valor: 'diarreia',
      alertas: ['fala-sobreposta', 'divergencia'],
    })
    /* Ninguém disse "em dia": uma vacina tomada foi o que a máquina pôs de si. */
    expect(linha('vacinacaoEmDia')).toEqual({ valor: true, alertas: ['deduzido'] })
  })

  it('traz alergia e castração como antecedentes', () => {
    const lista = resultado.propostas.filter((item) => item.campo === 'antecedente')

    expect(lista.map((item) => [item.tipo, item.valor, item.quando])).toEqual([
      ['alergia', 'Dipirona', ''],
      ['cirurgia', 'Castração', 'ano passado'],
    ])
  })

  it('ouve a hipótese e o peso de casa, e não preenche nenhum dos dois', () => {
    expect(resultado.notas.map((nota) => [nota.kind, nota.valor])).toEqual([
      ['peso-informado', '6 kg'],
      ['hipotese', 'gastroenterite'],
    ])
  })

  it('cita na ordem em que foi dito, sem repetir a mesma frase', () => {
    const citadas = (campo: CampoDaEscuta) =>
      resultado.propostas
        .find((item) => item.campo === campo)
        ?.citacoes.map((citacao) => textoDaCitacao(citacao, mapa))

    expect(citadas('apetite')).toEqual(['recusou a ração', 'Nem tocou no pote'])
    expect(citadas('evacuacao')).toEqual(['fez mole'])
  })

  it('toda citação aponta para um pedaço real da conversa', () => {
    for (const item of resultado.propostas) {
      for (const citacao of item.citacoes) {
        expect(textoDaCitacao(citacao, mapa)).not.toBe('')
      }
    }
  })

  it('concorda com o sexo do paciente sem mudar o que se extrai', () => {
    const doThor = consultaGravada({ pet: 'Thor', sexo: 'macho', responsavel: 'Rita' })

    expect(doThor[0]?.texto).toBe('Oi, Rita, tudo bem? Me conta, o que aconteceu com o Thor?')
    expect(doThor.some((trecho) => /quietinho, só deitado/.test(trecho.texto))).toBe(true)
    expect(extrairDaConversa(doThor).propostas.map((item) => [item.campo, item.valor])).toEqual(
      resultado.propostas.map((item) => [item.campo, item.valor]),
    )
  })
})
