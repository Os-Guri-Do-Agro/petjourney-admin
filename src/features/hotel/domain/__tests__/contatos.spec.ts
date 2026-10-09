import { describe, expect, it } from 'vitest'

import {
  incorporarAoCadastro,
  pessoaPodeEntrar,
  problemaDaPessoa,
  problemaDoVeterinario,
  veterinarioInformado,
} from '../contatos'
import type { ContatoDaFamilia } from '../../data/types'

const CLARA: ContatoDaFamilia = {
  id: 'pessoa-1',
  tutorId: 'tutor-1',
  nome: 'Clara',
  telefone: '(11) 99671-2284',
  relacao: 'Irmã',
  documento: 'RG 1',
}

describe('cadastro da família', () => {
  it('a mesma pessoa marcada duas vezes sai uma vez só', () => {
    let sequencia = 0
    const { cadastro, confirmadas } = incorporarAoCadastro({
      cadastro: [CLARA],
      tutorId: 'tutor-1',
      pessoas: [
        { id: 'pessoa-1', nome: 'Clara', telefone: '', relacao: '', documento: '' },
        { id: '', nome: 'Clarinha', telefone: '11 99671 2284', relacao: '', documento: '' },
      ],
      novoId: () => `nova-${(sequencia += 1)}`,
    })

    expect(confirmadas.map((item) => item.id)).toEqual(['pessoa-1'])
    expect(cadastro).toHaveLength(1)
    /* Telefone vazio no primeiro não apagou o que o cadastro sabia. */
    expect(cadastro[0]?.telefone).toBe('(11) 99671-2284')
  })

  it('o telefone de outra família não é a mesma pessoa', () => {
    const { cadastro, confirmadas } = incorporarAoCadastro({
      cadastro: [CLARA],
      tutorId: 'tutor-2',
      pessoas: [{ id: '', nome: 'Clara', telefone: CLARA.telefone, relacao: '', documento: '' }],
      novoId: () => 'pessoa-nova',
    })

    expect(confirmadas[0]?.id).toBe('pessoa-nova')
    expect(cadastro).toHaveLength(2)
  })

  it('não mexe no cadastro que recebeu', () => {
    const original = [{ ...CLARA }]

    incorporarAoCadastro({
      cadastro: original,
      tutorId: 'tutor-1',
      pessoas: [{ ...CLARA, nome: 'Clara Okamoto' }],
      novoId: () => 'x',
    })

    expect(original[0]?.nome).toBe('Clara')
  })
})

describe('pessoa nova no balcão', () => {
  it('pede nome e telefone válido', () => {
    expect(problemaDaPessoa({ nome: '', telefone: '' }, [])).toMatchObject({
      nome: 'obrigatorio',
      telefone: 'obrigatorio',
    })
    expect(problemaDaPessoa({ nome: 'Ana', telefone: '(11) 9123' }, []).telefone).toBe('invalido')
    expect(
      pessoaPodeEntrar(problemaDaPessoa({ nome: 'Ana', telefone: '(11) 91234-5678' }, [])),
    ).toBe(true)
  })

  it('o telefone repetido diz de quem é, em vez de só recusar', () => {
    const problema = problemaDaPessoa({ nome: 'Ana', telefone: '11996712284' }, [CLARA])

    expect(problema.telefone).toBe('repetido')
    expect(problema.repetidoDe).toBe('Clara')
  })
})

describe('veterinário do animal', () => {
  it('é opcional, mas com nome e sem telefone não passa', () => {
    expect(problemaDoVeterinario({ nome: '', clinica: '', telefone: '' })).toBeNull()
    expect(problemaDoVeterinario({ nome: 'Dra. Helena', clinica: '', telefone: '' })).toBe(
      'sem-telefone',
    )
    expect(problemaDoVeterinario({ nome: '', clinica: 'Clínica', telefone: '' })).toBe(
      'sem-telefone',
    )
    expect(problemaDoVeterinario({ nome: 'Dra. Helena', clinica: '', telefone: '(11) 3555' })).toBe(
      'telefone-invalido',
    )
    expect(
      problemaDoVeterinario({ nome: 'Dra. Helena', clinica: '', telefone: '(11) 3555-0142' }),
    ).toBeNull()
  })

  it('três campos vazios são "não informado"', () => {
    expect(veterinarioInformado({ nome: ' ', clinica: '', telefone: '' })).toBeNull()
    expect(veterinarioInformado(null)).toBeNull()
    expect(veterinarioInformado({ nome: ' Dra. Ana ', clinica: '', telefone: '' })).toEqual({
      nome: 'Dra. Ana',
      clinica: '',
      telefone: '',
    })
  })
})
