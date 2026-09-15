/**
 * Cadastro: validação, máscara e cadastro repetido.
 *
 * O motivo de este arquivo existir cabe em duas frases. Um CPF errado só aparece semanas depois,
 * na hora de emitir a nota, com o responsável longe. E um responsável cadastrado duas vezes parte
 * o histórico em dois: as faltas deixam de somar, a vacina vencida fica no cadastro que ninguém
 * abre e a cobrança sai duplicada.
 *
 * Nenhum dos dois é visível na tela no instante em que acontece — por isso são regras de domínio
 * com teste, e não conferência a olho de quem cadastra.
 */

import { describe, expect, it } from 'vitest'

import type { Tutor } from '../../data/types'
import {
  cpfValido,
  emailValido,
  formatarCep,
  formatarCpf,
  formatarTelefone,
  responsaveisSemelhantes,
  telefoneValido,
  validarCadastro,
  type RascunhoDeCadastro,
} from '../cadastro'

const HOJE = '2026-08-31'

function tutor(patch: Partial<Tutor> = {}): Tutor {
  return {
    id: 'tutor-teste',
    nome: 'Marina Alves',
    telefone: '(11) 98422-1030',
    telefoneSecundario: '',
    email: 'marina@exemplo.com',
    documento: '318.442.910-57',
    preferenciaContato: 'whatsapp',
    endereco: null,
    ...patch,
  }
}

function rascunho(patch: Partial<RascunhoDeCadastro> = {}): RascunhoDeCadastro {
  return {
    nome: 'Luna',
    nascimento: '',
    responsavelNovo: true,
    responsavelId: '',
    responsavelNome: 'Marina Alves',
    telefone: '(11) 98422-1030',
    telefoneSecundario: '',
    documento: '',
    email: '',
    cep: '',
    hoje: HOJE,
    ...patch,
  }
}

describe('cpfValido', () => {
  it('aceita um CPF com dígitos verificadores corretos', () => {
    expect(cpfValido('318.442.910-57')).toBe(true)
    expect(cpfValido('31844291057')).toBe(true)
  })

  it('recusa o CPF cujo dígito verificador não fecha', () => {
    expect(cpfValido('318.442.910-58')).toBe(false)
  })

  it('recusa onze dígitos iguais', () => {
    /**
     * Passa na conta dos verificadores e é exatamente o que alguém digita para vencer um campo
     * obrigatório. Sem esta guarda, o cadastro aceitaria `111.111.111-11` como identidade.
     */
    expect(cpfValido('111.111.111-11')).toBe(false)
    expect(cpfValido('00000000000')).toBe(false)
  })

  it('recusa quantidade de dígitos diferente de onze', () => {
    expect(cpfValido('318.442.910')).toBe(false)
    expect(cpfValido('')).toBe(false)
  })
})

describe('telefoneValido', () => {
  it('aceita fixo de dez dígitos e celular de onze', () => {
    expect(telefoneValido('(11) 3044-1180')).toBe(true)
    expect(telefoneValido('(11) 98422-1030')).toBe(true)
  })

  it('recusa celular anotado sem o nono dígito', () => {
    /*
     * O erro que de fato acontece: o número tem dez dígitos e **parece** um fixo — até alguém
     * tentar mandar a confirmação por mensagem e ela não chegar a lugar nenhum.
     */
    expect(telefoneValido('(11) 8422-1030')).toBe(false)
  })

  it('recusa DDD que começa em zero e contagem fora de 10 ou 11', () => {
    expect(telefoneValido('(01) 98422-1030')).toBe(false)
    expect(telefoneValido('11984221')).toBe(false)
  })
})

describe('emailValido', () => {
  it('aceita endereço com domínio e recusa o que não tem', () => {
    expect(emailValido('marina.alves@exemplo.com')).toBe(true)
    expect(emailValido('marina.alves@exemplo')).toBe(false)
    expect(emailValido('marina.alves')).toBe(false)
  })
})

describe('máscaras', () => {
  it('formata o que já foi digitado sem completar o que falta', () => {
    /*
     * Máscara que completa com zeros faz quem está corrigindo o meio de um número ditado por
     * telefone brigar com o campo. Aqui, meio número continua meio número.
     */
    expect(formatarTelefone('11')).toBe('11')
    expect(formatarTelefone('11984')).toBe('(11) 984')
    expect(formatarTelefone('11984221030')).toBe('(11) 98422-1030')
    expect(formatarTelefone('1130441180')).toBe('(11) 3044-1180')
  })

  it('descarta o que passa do tamanho do campo', () => {
    expect(formatarTelefone('119842210309999')).toBe('(11) 98422-1030')
    expect(formatarCpf('3184429105712345')).toBe('318.442.910-57')
    expect(formatarCep('054350201234')).toBe('05435-020')
  })

  it('não muda o que já está formatado', () => {
    expect(formatarCpf('318.442.910-57')).toBe('318.442.910-57')
    expect(formatarCep('05435-020')).toBe('05435-020')
  })
})

describe('validarCadastro', () => {
  it('não reclama de nada quando o mínimo está preenchido', () => {
    expect(validarCadastro(rascunho()).size).toBe(0)
  })

  it('exige nome do paciente, nome e telefone de quem responde por ele', () => {
    const erros = validarCadastro(rascunho({ nome: '   ', responsavelNome: '', telefone: '' }))

    expect(erros.get('nome')).toBe('obrigatorio')
    expect(erros.get('responsavelNome')).toBe('obrigatorio')
    expect(erros.get('telefone')).toBe('obrigatorio')
  })

  it('devolve todos os erros de uma vez', () => {
    /*
     * Validar campo a campo faria o formulário acusar o primeiro e esconder os outros três —
     * quem preenche descobriria um por vez e desistiria no terceiro.
     */
    const erros = validarCadastro(
      rascunho({
        nome: '',
        telefone: '(11) 8422-1030',
        documento: '111.111.111-11',
        email: 'marina@exemplo',
        cep: '0543',
      }),
    )

    expect([...erros.keys()].sort()).toEqual(['cep', 'documento', 'email', 'nome', 'telefone'])
  })

  it('valida o opcional que alguém preencheu, e ignora o que ficou em branco', () => {
    expect(validarCadastro(rascunho({ documento: '', email: '', cep: '' })).size).toBe(0)
    expect(validarCadastro(rascunho({ documento: '318.442.910-58' })).get('documento')).toBe(
      'documento',
    )
    expect(
      validarCadastro(rascunho({ telefoneSecundario: '(11) 8422-1030' })).get('telefoneSecundario'),
    ).toBe('telefone')
  })

  it('recusa nascimento no futuro', () => {
    expect(validarCadastro(rascunho({ nascimento: '2026-09-01' })).get('nascimento')).toBe('futuro')
    expect(validarCadastro(rascunho({ nascimento: HOJE })).has('nascimento')).toBe(false)
  })

  it('não valida dados de responsável quando o escolhido já existe', () => {
    /*
     * Escolher alguém da lista não pode exigir que se redigite o telefone dele: o cadastro que
     * está lá é o que vale, e um erro de validação aqui travaria o botão sem campo visível para
     * corrigir.
     */
    const erros = validarCadastro(
      rascunho({
        responsavelNovo: false,
        responsavelId: 'tutor-marina',
        responsavelNome: '',
        telefone: '',
        documento: 'xx',
      }),
    )

    expect(erros.size).toBe(0)
  })

  it('exige escolher alguém quando o caminho é "já cadastrado"', () => {
    /*
     * O sistema aceita dois caminhos: responsável novo, ou paciente novo ligado a alguém que já
     * existe. O meio do caminho — "já cadastrado" sem ninguém escolhido — criaria um paciente
     * sem quem avisar.
     */
    const erros = validarCadastro(rascunho({ responsavelNovo: false, responsavelId: '' }))

    expect(erros.get('responsavelEscolhido')).toBe('obrigatorio')
  })
})

describe('responsaveisSemelhantes', () => {
  const base = [
    tutor(),
    tutor({
      id: 'tutor-joao',
      nome: 'João Pedro Camargo',
      telefone: '(11) 99120-4477',
      telefoneSecundario: '(11) 2892-3317',
      documento: '440.288.107-28',
    }),
  ]

  it('acha pelo telefone escrito de outro jeito', () => {
    const achados = responsaveisSemelhantes(base, {
      nome: 'Marina A.',
      telefone: '11984221030',
      documento: '',
    })

    expect(achados).toHaveLength(1)
    expect(achados[0]!.tutor.id).toBe('tutor-teste')
    expect(achados[0]!.motivo).toBe('telefone')
  })

  it('acha pelo telefone secundário', () => {
    /* É onde o telefone da casa costuma estar nos dois cadastros repetidos. */
    const achados = responsaveisSemelhantes(base, {
      nome: '',
      telefone: '(11) 2892-3317',
      documento: '',
    })

    expect(achados[0]?.tutor.id).toBe('tutor-joao')
  })

  it('acha pelo nome, ignorando acento e caixa', () => {
    const achados = responsaveisSemelhantes(base, {
      nome: '  joao pedro camargo ',
      telefone: '',
      documento: '',
    })

    expect(achados[0]?.tutor.id).toBe('tutor-joao')
    expect(achados[0]?.motivo).toBe('nome')
  })

  it('prefere o motivo mais confiável quando há mais de um achado', () => {
    /*
     * Documento é identidade; nome é indício — dois "Ana Paula Souza" numa clínica de bairro
     * acontecem. A ordem é o que a tela usa para dizer *por que* está perguntando.
     */
    const achados = responsaveisSemelhantes(
      [tutor({ id: 'por-nome', documento: '', telefone: '' }), base[1]!],
      { nome: 'Marina Alves', telefone: '(11) 99120-4477', documento: '440.288.107-28' },
    )

    expect(achados.map((item) => item.motivo)).toEqual(['documento', 'nome'])
  })

  it('não confunde cadastros só porque os campos estão vazios', () => {
    /*
     * A armadilha do filtro por dígitos: termo sem número vira string vazia, que todo telefone
     * "contém". Um rascunho em branco não pode devolver o cadastro inteiro como duplicata — o
     * aviso perderia o sentido na primeira vez que alguém abrisse o formulário.
     */
    const achados = responsaveisSemelhantes(base, { nome: '', telefone: '', documento: '' })

    expect(achados).toEqual([])
  })

  it('ignora nome curto demais para ser indício', () => {
    expect(
      responsaveisSemelhantes([tutor({ nome: 'Ana' })], {
        nome: 'Ana',
        telefone: '',
        documento: '',
      }),
    ).toEqual([])
  })
})
