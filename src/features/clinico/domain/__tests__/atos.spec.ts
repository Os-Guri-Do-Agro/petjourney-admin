/**
 * A história do que o paciente recebeu.
 *
 * O que estes testes protegem é a regra que sustenta a tela inteira: a lista **junta** três
 * registros e não cria um quarto. Se alguém um dia gravar a vacina também como ato "para ficar
 * mais simples", a linha aparece duas vezes — e é exatamente o tipo de defeito que ninguém nota
 * numa demonstração e que, na clínica, faz a conta de exposição a um princípio ativo sair
 * dobrada.
 *
 * O outro ponto é o corte de `feita`: dose recusada e dose pulada são informação, e continuam no
 * checklist da internação. Aqui não entram, porque não entraram no animal.
 */

import { describe, expect, it } from 'vitest'

import type {
  AdministracaoAgendada,
  AplicacaoVacina,
  AtoClinico,
  Internacao,
  PrescricaoDeInternacao,
  Vacina,
} from '../../data/types'
import { historicoDeAtos, jaRecebeu, type FonteDosAtos } from '../atos'

const PET = 'pet-luna'

function internacao(patch: Partial<Internacao> = {}): Internacao {
  return {
    id: 'int-1',
    petId: PET,
    tutorId: 'tutor-1',
    leitoId: 'leito-1',
    encounterId: null,
    status: 'internado',
    motivo: 'Observação',
    diagnostico: '',
    gravidade: 'estavel',
    pesoEntradaKg: 12,
    entradaEm: '2026-09-01T08:00:00-03:00',
    saidaEm: null,
    responsavelId: 'prof-ana',
    observacao: '',
    ...patch,
  } as Internacao
}

function prescricao(patch: Partial<PrescricaoDeInternacao> = {}): PrescricaoDeInternacao {
  return {
    id: 'presc-1',
    internacaoId: 'int-1',
    kind: 'medicamento',
    medicamentoId: 'med-dipirona',
    descricao: 'Dipirona 310 mg',
    via: 'intravenosa',
    doseTexto: '310 mg',
    frequenciaHoras: 8,
    continuo: false,
    primeiroHorario: '2026-09-01T10:00:00-03:00',
    encerraEm: null,
    prescritoPor: 'prof-ana',
    prescritoEm: '2026-09-01T09:00:00-03:00',
    suspensaEm: null,
    motivoSuspensao: '',
    observacao: '',
    ...patch,
  }
}

function administracao(patch: Partial<AdministracaoAgendada> = {}): AdministracaoAgendada {
  return {
    id: 'adm-1',
    internacaoId: 'int-1',
    prescricaoId: 'presc-1',
    previstaPara: '2026-09-01T10:00:00-03:00',
    status: 'feita',
    executadaEm: '2026-09-01T10:05:00-03:00',
    executadaPor: 'prof-helena',
    plantaoId: 'plt-1',
    observacao: '',
    ...patch,
  }
}

function aplicacao(patch: Partial<AplicacaoVacina> = {}): AplicacaoVacina {
  return {
    id: 'apl-1',
    petId: PET,
    vacinaId: 'vac-v10',
    origem: 'clinica',
    professionalId: 'prof-ana',
    aplicadaEm: '2026-08-01T09:00:00-03:00',
    lote: 'L-1',
    validadeLote: '2027-01-01',
    dose: 3,
    dosesNaSerie: 3,
    via: 'subcutanea',
    proximaDoseEm: '2027-08-01',
    agendamentoDaProximaId: null,
    encounterId: null,
    externa: null,
    observacao: '',
    ...patch,
  }
}

function ato(patch: Partial<AtoClinico> = {}): AtoClinico {
  return {
    id: 'ato-1',
    petId: PET,
    kind: 'procedimento',
    origem: 'clinica',
    encounterId: 'enc-1',
    internacaoId: null,
    medicamentoId: null,
    descricao: 'Troca de curativo',
    via: null,
    doseTexto: '',
    realizadoEm: '2026-09-05T14:00:00-03:00',
    professionalId: 'prof-ana',
    observacao: '',
    ...patch,
  }
}

const VACINAS: Vacina[] = [
  {
    id: 'vac-v10',
    nome: 'V10',
    fabricante: 'Teste',
    especies: ['canina'],
    dosesNaSerie: 3,
    dosesAdultoSemHistorico: 2,
    idadeMinimaDias: 42,
    essencial: true,
    vias: ['subcutanea'],
    intervaloReforcoDias: 365,
    obrigatoria: false,
    estoqueMinimo: 10,
  },
]

function fonte(patch: Partial<FonteDosAtos> = {}): FonteDosAtos {
  return {
    petId: PET,
    atos: [],
    aplicacoes: [],
    vacinas: VACINAS,
    administracoes: [],
    prescricoes: [],
    internacoes: [],
    ...patch,
  }
}

describe('historicoDeAtos', () => {
  it('junta gravado, internação e vacina numa lista só', () => {
    const lista = historicoDeAtos(
      fonte({
        atos: [ato()],
        aplicacoes: [aplicacao()],
        administracoes: [administracao()],
        prescricoes: [prescricao()],
        internacoes: [internacao()],
      }),
    )

    expect(lista.map((item) => item.origem)).toEqual(['clinica', 'internacao', 'vacina'])
  })

  it('ordena do mais recente para o mais antigo', () => {
    const lista = historicoDeAtos(
      fonte({
        atos: [
          ato({ id: 'a', realizadoEm: '2026-01-01T10:00:00-03:00' }),
          ato({ id: 'c', realizadoEm: '2026-09-01T10:00:00-03:00' }),
          ato({ id: 'b', realizadoEm: '2026-05-01T10:00:00-03:00' }),
        ],
      }),
    )

    expect(lista.map((item) => item.id)).toEqual(['c', 'b', 'a'])
  })

  it('desempata pelo id, para a ordem não dançar entre carregamentos', () => {
    /*
     * Duas doses no mesmo minuto trocando de lugar a cada abertura da tela fazem quem confere a
     * lista duas vezes desconfiar do registro inteiro.
     */
    const mesmoInstante = '2026-09-01T10:00:00-03:00'
    const lista = historicoDeAtos(
      fonte({
        atos: [
          ato({ id: 'ato-z', realizadoEm: mesmoInstante }),
          ato({ id: 'ato-a', realizadoEm: mesmoInstante }),
        ],
      }),
    )

    expect(lista.map((item) => item.id)).toEqual(['ato-a', 'ato-z'])
  })

  it('só conta a dose que o animal recebeu', () => {
    /*
     * Pulada e recusada continuam no checklist da internação, onde a pergunta é "o turno cumpriu
     * o aprazamento?". Aqui a pergunta é "o que entrou neste animal" — e o comprimido que o gato
     * cuspiu não entrou.
     */
    const lista = historicoDeAtos(
      fonte({
        administracoes: [
          administracao({ id: 'feita' }),
          administracao({ id: 'pulada', status: 'pulada' }),
          administracao({ id: 'recusada', status: 'recusada' }),
          administracao({ id: 'pendente', status: 'pendente', executadaEm: null }),
          administracao({ id: 'suspensa', status: 'suspensa' }),
        ],
        prescricoes: [prescricao()],
        internacoes: [internacao()],
      }),
    )

    expect(lista).toHaveLength(1)
    expect(lista[0]!.id).toBe('ato-adm-feita')
  })

  it('não traz a internação de outro paciente', () => {
    const lista = historicoDeAtos(
      fonte({
        administracoes: [administracao()],
        prescricoes: [prescricao()],
        internacoes: [internacao({ petId: 'pet-outro' })],
      }),
    )

    expect(lista).toEqual([])
  })

  it('guarda quem executou, que não é quem prescreveu', () => {
    /* A diferença entre os dois é o ponto do registro de execução. */
    const lista = historicoDeAtos(
      fonte({
        administracoes: [administracao()],
        prescricoes: [prescricao({ prescritoPor: 'prof-ana' })],
        internacoes: [internacao()],
      }),
    )

    expect(lista[0]!.professionalId).toBe('prof-helena')
    expect(lista[0]!.realizadoEm).toBe('2026-09-01T10:05:00-03:00')
  })

  it('classifica curativo prescrito na internação como procedimento, não medicamento', () => {
    /*
     * A internação prescreve fisioterapia pelo mesmo caminho por onde prescreve dipirona. No
     * histórico do paciente os dois não são a mesma coisa, e o filtro depende disso.
     */
    const lista = historicoDeAtos(
      fonte({
        administracoes: [administracao()],
        prescricoes: [
          prescricao({ kind: 'procedimento', medicamentoId: null, descricao: 'Curativo' }),
        ],
        internacoes: [internacao()],
      }),
    )

    expect(lista[0]!.kind).toBe('procedimento')
  })

  it('trata vacina como procedimento e pega o nome do catálogo', () => {
    const lista = historicoDeAtos(fonte({ aplicacoes: [aplicacao()] }))

    expect(lista[0]!.kind).toBe('procedimento')
    expect(lista[0]!.descricao).toBe('V10')
    expect(lista[0]!.origem).toBe('vacina')
  })

  it('ignora o que é de outro paciente', () => {
    const lista = historicoDeAtos(
      fonte({
        atos: [ato({ id: 'meu' }), ato({ id: 'alheio', petId: 'pet-outro' })],
        aplicacoes: [aplicacao({ id: 'apl-outro', petId: 'pet-outro' })],
      }),
    )

    expect(lista.map((item) => item.id)).toEqual(['meu'])
  })
})

describe('jaRecebeu', () => {
  it('conta as vezes e devolve a última', () => {
    const lista = historicoDeAtos(
      fonte({
        atos: [
          ato({
            id: 'a',
            kind: 'medicamento',
            medicamentoId: 'med-dipirona',
            realizadoEm: '2026-03-01T10:00:00-03:00',
          }),
          ato({
            id: 'b',
            kind: 'medicamento',
            medicamentoId: 'med-dipirona',
            realizadoEm: '2026-07-01T10:00:00-03:00',
          }),
          ato({ id: 'c', kind: 'medicamento', medicamentoId: 'med-tramadol' }),
        ],
      }),
    )

    expect(jaRecebeu(lista, 'med-dipirona')).toEqual({
      vezes: 2,
      ultimaEm: '2026-07-01T10:00:00-03:00',
    })
  })

  it('devolve zero sem inventar data quando nunca recebeu', () => {
    expect(jaRecebeu([], 'med-dipirona')).toEqual({ vezes: 0, ultimaEm: null })
  })

  it('não soma o ato digitado à mão sem medicamento do bulário', () => {
    /*
     * Somar "dipirona" escrito de três jeitos produziria um número que parece exato e não é —
     * e este número é lido na hora de decidir se prescreve de novo.
     */
    const lista = historicoDeAtos(
      fonte({
        atos: [ato({ kind: 'medicamento', medicamentoId: null, descricao: 'Dipirona' })],
      }),
    )

    expect(jaRecebeu(lista, 'med-dipirona').vezes).toBe(0)
  })
})
