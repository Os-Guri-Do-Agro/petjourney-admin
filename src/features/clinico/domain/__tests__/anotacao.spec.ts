/**
 * A ponte entre o prontuário rico e o contrato pobre.
 *
 * O que estes testes guardam não é o mapeamento campo a campo — é a promessa de que **nada
 * some em silêncio**. Um prontuário com doze prescrições que vira uma anotação com dez sem
 * ninguém dizer qual foi cortada é o modo de falhar que importa aqui, porque só aparece
 * quando o responsável abre o app em casa e falta um remédio.
 */

import { describe, expect, it } from 'vitest'

import {
  montarAnotacaoEstruturada,
  validarAnotacaoEstruturada,
} from '@/utils/parceiro/anotacao-estruturada'

import type {
  DoseCalc,
  Encounter,
  ExamCatalogItem,
  Medication,
  Prescription,
} from '../../data/types'
import { atendimentoParaAnotacao, profissionalParaAnotacao } from '../anotacao'
import type { EntradaDaConversao, RotulosDaConversao } from '../anotacao'

// --------------------------------------------------------------------- cenário

const ROTULOS: RotulosDaConversao = {
  via: {
    oral: 'Via oral',
    subcutanea: 'Subcutânea',
    intramuscular: 'Intramuscular',
    intravenosa: 'Intravenosa',
    topica: 'Tópica',
    otologica: 'Otológica',
  },
  tipoDiagnostico: {
    presuntivo: 'presuntivo',
    definitivo: 'definitivo',
    diferencial: 'diferencial',
  },
  fracao: {
    inteiro: 'comprimido inteiro',
    meio: 'meio comprimido',
    'um-e-meio': 'um comprimido e meio',
    quarto: 'um quarto de comprimido',
    'tres-quartos': 'três quartos de comprimido',
    multiplo: 'comprimidos partidos',
    aproximado: 'dose aproximada',
  },
}

function medicamento(over: Partial<Medication> = {}): Medication {
  return {
    id: 'med-amox',
    nome: 'Amoxicilina 500 mg',
    principioAtivo: 'Amoxicilina',
    concentracao: 500,
    unidadeApresentacao: 'comprimido',
    doseUsualMgKg: { min: 10, max: 20 },
    viasPermitidas: ['oral'],
    classe: 'antibiotico',
    controlado: false,
    apresentacao: 'Comprimido 500 mg',
    indicacoes: [],
    contraindicacoes: [],
    ...over,
  } as Medication
}

function calculo(over: Partial<DoseCalc> = {}): DoseCalc {
  return {
    medicamentoId: 'med-amox',
    mgPorKg: 10,
    pesoKg: 12.4,
    mgPorAdministracao: 124,
    quantidadeApresentacao: 1,
    frequenciaHoras: 12,
    duracaoDias: 7,
    totalAdministracoes: 14,
    ...over,
  }
}

function prescricao(over: Partial<Prescription> = {}): Prescription {
  return {
    id: 'presc-1',
    medicamentoId: 'med-amox',
    via: 'oral',
    calculo: calculo(),
    observacao: '',
    alergiaConfirmada: false,
    ...over,
  }
}

function atendimento(over: Partial<Encounter> = {}): Encounter {
  return {
    id: 'enc-1',
    appointmentId: 'apt-1',
    petId: 'pet-1',
    tutorId: 'tutor-1',
    professionalId: 'prof-1',
    status: 'finalizado',
    abertoEm: '2026-09-02T13:00:00.000Z',
    finalizadoEm: '2026-09-02T13:40:00.000Z',
    anamnese: {
      queixaPrincipal: 'Tosse seca há três dias',
      historia: 'Sem contato com outros animais.',
      duracaoSintomas: '3 dias',
      evolucao: 'piorando',
      antecedentes: [],
      apetite: 'reduzido',
      evacuacao: 'normal',
      miccao: 'normal',
      ambiente: 'domiciliar',
      vacinacaoEmDia: true,
      vermifugacaoEmDia: true,
    },
    exameFisico: {
      vitais: {
        peso: { valor: 12.4, naoAferido: false },
        temperatura: { valor: 39.1, naoAferido: false },
        frequenciaCardiaca: { valor: null, naoAferido: true },
        frequenciaRespiratoria: { valor: null, naoAferido: true },
        tempoPreenchimentoCapilar: { valor: null, naoAferido: true },
        escoreCorporal: { valor: null, naoAferido: true },
        pressaoSistolica: { valor: null, naoAferido: true },
      },
      mucosas: 'normocoradas',
      hidratacao: 'normal',
      sistemas: {} as Encounter['exameFisico']['sistemas'],
      observacao: 'Traqueia sensível à palpação.',
    },
    diagnosticos: [
      { id: 'dx-1', codigo: 'R05', descricao: 'Traqueobronquite', kind: 'presuntivo' },
    ],
    conduta: {
      orientacoes: 'Repouso e retorno em sete dias.',
      prescricoes: [prescricao()],
      examesSolicitados: ['exame-raiox-torax'],
      retorno: { emDias: 7, typeId: null, appointmentId: null },
    },
    versao: 1,
    lock: null,
    preConsulta: null,
    ...over,
  } as Encounter
}

const EXAMES: ExamCatalogItem[] = [
  { id: 'exame-raiox-torax', nome: 'Radiografia de tórax', grupo: 'imagem' },
]

function converter(over: Partial<EntradaDaConversao> = {}) {
  return atendimentoParaAnotacao({
    encounter: atendimento(),
    medicamentos: [medicamento()],
    exames: EXAMES,
    rotulos: ROTULOS,
    servicoRealizado: 'Consulta clínica',
    ...over,
  })
}

function kinds(resultado: ReturnType<typeof converter>): string[] {
  return resultado.avisos.map((aviso) => aviso.kind)
}

// ------------------------------------------------------------------- o contrato

describe('o que o contrato aceita', () => {
  it('o resultado passa na validação do próprio módulo do parceiro', () => {
    /**
     * O teste que justifica o arquivo inteiro: a conversão não inventa limite nenhum, ela
     * produz algo que o validador **já existente** aceita. Se um dia o backend apertar um
     * teto, é aqui que a divergência aparece.
     */
    const { form } = converter()

    expect(validarAnotacaoEstruturada('CONSULTA', form)).toEqual([])
  })

  it('uso contínuo sai como chave ausente, não como null', () => {
    /*
     * Verificado no destino: `duracaoDias != null ? dataFim : null`. Mandar `null` no fio
     * seria mandar um valor que o DTO declara como inteiro de 1 a 3650.
     */
    const { form } = converter({
      encounter: atendimento({
        conduta: {
          ...atendimento().conduta,
          prescricoes: [prescricao({ calculo: calculo({ duracaoDias: null }) })],
        },
      }),
    })

    const payload = montarAnotacaoEstruturada('CONSULTA', form)

    /*
     * A asserção é no JSON, não no objeto: a lista viaja como `JSON.stringify` num campo do
     * multipart (`compartilhamentos-service.ts`), e é ali que `undefined` vira chave ausente.
     * No objeto em memória a chave ainda existe valendo `undefined` — inofensivo neste
     * caminho, mas o que precisa ficar travado é o que sai no fio.
     */
    expect(JSON.stringify(payload?.prescricaoItens?.[0])).not.toContain('duracaoDias')
  })

  it('duração normal atravessa como número', () => {
    const payload = montarAnotacaoEstruturada('CONSULTA', converter().form)

    expect(payload?.prescricaoItens?.[0]?.duracaoDias).toBe(7)
  })

  it('a frequência sai na convenção que o próprio DTO exemplifica', () => {
    /** Sem `frequencia` o item não vira medicamento do pet — é o campo que mais custa. */
    expect(converter().form.prescricaoItens[0]?.frequencia).toBe('12/12h')
  })

  it('o peso que viaja é o aferido hoje, o mesmo da conta da receita', () => {
    expect(converter().form.pesoKg).toBe(12.4)
  })
})

// ------------------------------------------------------------- nada em silêncio

describe('o que não cabe vira aviso', () => {
  it('corta a lista no teto e nomeia quem ficou de fora', () => {
    const doze = Array.from({ length: 12 }, (_, i) =>
      prescricao({ id: `presc-${i}`, medicamentoId: `med-${i}` }),
    )

    const resultado = converter({
      encounter: atendimento({
        conduta: { ...atendimento().conduta, prescricoes: doze },
      }),
    })

    expect(resultado.form.prescricaoItens).toHaveLength(10)

    const aviso = resultado.avisos.find((a) => a.kind === 'prescricoes-excedentes')

    expect(aviso?.params?.total).toBe(12)
    expect(String(aviso?.params?.descartados)).toBe('med-10, med-11')
  })

  it('avisa quando o item não tem frequência', () => {
    const resultado = converter({
      encounter: atendimento({
        conduta: {
          ...atendimento().conduta,
          prescricoes: [prescricao({ calculo: calculo({ frequenciaHoras: 0 }) })],
        },
      }),
    })

    expect(kinds(resultado)).toContain('sem-frequencia')
  })

  it('avisa que peso não aferido não viaja', () => {
    const base = atendimento()
    const resultado = converter({
      encounter: atendimento({
        exameFisico: {
          ...base.exameFisico,
          vitais: { ...base.exameFisico.vitais, peso: { valor: null, naoAferido: true } },
        },
      }),
    })

    expect(kinds(resultado)).toContain('peso-nao-aferido')
    expect(resultado.form.pesoKg).toBeNull()
  })

  it('avisa que via e assinatura não têm campo próprio', () => {
    /* As duas perdas estruturais do contrato. Ninguém deve descobri-las na integração. */
    expect(kinds(converter())).toEqual(
      expect.arrayContaining(['via-em-instrucoes', 'assinatura-sem-destino']),
    )
  })

  it('não avisa sobre via quando não houve prescrição', () => {
    const resultado = converter({
      encounter: atendimento({
        conduta: { ...atendimento().conduta, prescricoes: [] },
      }),
    })

    expect(kinds(resultado)).not.toContain('via-em-instrucoes')
  })

  it('avisa e trunca em vez de deixar o backend recusar tudo', () => {
    const resultado = converter({
      encounter: atendimento({
        anamnese: { ...atendimento().anamnese, queixaPrincipal: 'x'.repeat(1200) },
      }),
    })

    expect(resultado.form.motivo).toHaveLength(1000)
    expect(kinds(resultado)).toContain('texto-truncado')
  })
})

// ------------------------------------------------------------------- tradução

describe('id não chega ao responsável', () => {
  it('exame vira nome do catálogo', () => {
    /** Foi guardando id onde a tela esperava nome que os chips saíram em branco uma vez. */
    expect(converter().form.examesSolicitados[0]?.nome).toBe('Radiografia de tórax')
  })

  it('id fora do catálogo segue como texto e avisa', () => {
    const resultado = converter({ exames: [] })

    expect(resultado.form.examesSolicitados[0]?.nome).toBe('exame-raiox-torax')
    expect(kinds(resultado)).toContain('exame-desconhecido')
  })

  it('a via e a fração vão para as instruções, que é onde cabem', () => {
    const instrucoes = converter().form.prescricaoItens[0]?.instrucoes ?? ''

    expect(instrucoes).toContain('Via oral')
    expect(instrucoes).toContain('comprimido inteiro')
  })

  it('o diagnóstico achatado preserva código e tipo', () => {
    /* O contrato tem uma string onde o prontuário tem lista tipada; a diferença é clínica. */
    expect(converter().form.diagnostico).toBe('Traqueobronquite (R05) presuntivo')
  })
})

// ----------------------------------------------------------------- fracionamento

describe('a dose que viaja é a que se dá', () => {
  it('manda a quantidade partível, não a calculada', () => {
    /**
     * `fracionar(2.48)` chama "dois e meio" — e o número precisa dizer a mesma coisa, senão
     * a receita impressa e a tela do app discordam sobre o mesmo comprimido.
     */
    const resultado = converter({
      encounter: atendimento({
        conduta: {
          ...atendimento().conduta,
          prescricoes: [prescricao({ calculo: calculo({ quantidadeApresentacao: 2.48 }) })],
        },
      }),
    })

    expect(resultado.form.prescricaoItens[0]?.dose).toBe('2.5')
    expect(kinds(resultado)).toContain('dose-aproximada')
  })

  it('líquido não se fraciona: vai o número medido', () => {
    const resultado = converter({
      medicamentos: [medicamento({ unidadeApresentacao: 'ml' })],
      encounter: atendimento({
        conduta: {
          ...atendimento().conduta,
          prescricoes: [prescricao({ calculo: calculo({ quantidadeApresentacao: 2.48 }) })],
        },
      }),
    })

    expect(resultado.form.prescricaoItens[0]?.dose).toBe('2.48')
    expect(resultado.form.prescricaoItens[0]?.unidade).toBe('ml')
    expect(kinds(resultado)).not.toContain('dose-aproximada')
  })
})

// ------------------------------------------------------------------ profissional

describe('identidade do profissional', () => {
  it('nome e área viajam; o conselho não tem destino', () => {
    const saida = profissionalParaAnotacao({
      id: 'prof-1',
      nome: 'Ana Ribeiro',
      iniciais: 'AR',
      conselho: 'CRMV-SP 12345',
      especialidade: 'CARDIOLOGIA',
      corIndice: 0,
      salaPadraoId: null,
      ativo: true,
    })

    expect(saida).toEqual({ profissionalNome: 'Ana Ribeiro', profissionalEspecialidade: 'CARDIOLOGIA' })
    expect(JSON.stringify(saida)).not.toContain('CRMV')
  })

  it('sem área, a chave some — vazia diria que a área é ""', () => {
    const saida = profissionalParaAnotacao({
      id: 'prof-2',
      nome: 'Bruno Alves',
      iniciais: 'BA',
      conselho: 'CRMV-SP 54321',
      especialidade: '   ',
      corIndice: 1,
      salaPadraoId: null,
      ativo: true,
    })

    expect('profissionalEspecialidade' in saida).toBe(false)
  })
})
