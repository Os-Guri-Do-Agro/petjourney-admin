/**
 * Quem pode buscar o animal, e a quem se liga quando ele passa mal.
 *
 * As duas perguntas têm a mesma doença: a resposta vinha como **texto livre**, e texto livre
 * aceita "a irmã" sem telefone e "Clínica do bairro" sem número. Os dois só fazem falta na hora em
 * que não há mais como perguntar — a pessoa no balcão dizendo que veio buscar, o animal passando
 * mal de madrugada.
 *
 * Três regras moram aqui porque nenhuma delas é de tela:
 *
 * - **A mesma pessoa não entra duas vezes no cadastro da família.** O telefone é a identidade: a
 *   "Vovó Sueli" de julho e a "Sueli Prado" de outubro, com o mesmo celular, são uma pessoa só.
 *   Duas fichas para ela fariam a recepção desmarcar uma e deixar a outra autorizada.
 * - **O mais recente vale, campo a campo, quando preenchido.** Quem corrige o telefone no check-in
 *   corrige o cadastro; quem deixa o documento em branco não apaga o que já estava lá.
 * - **Veterinário com nome e sem telefone não é veterinário informado.** É a ficha que parece
 *   completa e não serve na única hora em que é lida.
 *
 * Nada aqui conhece Vue, i18n ou repositório: o problema sai como `kind`, e a tela traduz.
 */

import {
  formatarTelefone,
  somenteDigitos,
  telefoneValido,
} from '@/features/clinico/domain/cadastro'

import type { ContatoDaFamilia, PessoaAutorizada, VeterinarioDoPet } from '../data/types'

/** Dois telefones são o mesmo quando os dígitos batem. Vazio não bate com nada. */
export function mesmoTelefone(um: string, outro: string): boolean {
  const digitos = somenteDigitos(um)

  return digitos !== '' && digitos === somenteDigitos(outro)
}

/**
 * O telefone como deve ser gravado: com a máscara, quando é um telefone de verdade.
 *
 * Sem isto, o "11996712284" ditado às pressas sobrescrevia o "(11) 99671-2284" do cadastro, e a
 * mesma pessoa aparecia com o número em dois formatos em duas telas. O que não é telefone válido
 * fica como veio — reformatar um número estrangeiro cortaria dígitos.
 */
export function telefoneParaGravar(telefone: string): string {
  const limpo = telefone.trim()

  return telefoneValido(limpo) ? formatarTelefone(limpo) : limpo
}

/** A pessoa como deve ser gravada: sem espaço sobrando nas pontas e com o telefone na máscara. */
export function limparPessoa(pessoa: PessoaAutorizada): PessoaAutorizada {
  return {
    id: pessoa.id.trim(),
    nome: pessoa.nome.trim(),
    telefone: telefoneParaGravar(pessoa.telefone),
    relacao: pessoa.relacao.trim(),
    documento: pessoa.documento.trim(),
  }
}

/** A pessoa sem a família a que pertence: é a forma que viaja para a estadia e para a tela. */
function semFamilia(contato: ContatoDaFamilia): PessoaAutorizada {
  return {
    id: contato.id,
    nome: contato.nome,
    telefone: contato.telefone,
    relacao: contato.relacao,
    documento: contato.documento,
  }
}

/**
 * Leva para o cadastro da família quem acabou de ser autorizado, e devolve a lista com os ids
 * definitivos.
 *
 * Quem chega com um id que o cadastro **desta família** não conhece é pessoa nova — o vazio da
 * tela e o id provisório do formulário caem aqui do mesmo jeito. Antes de criar, procura pelo
 * telefone: é o que impede a mesma pessoa de nascer duas vezes.
 *
 * Pura: devolve o cadastro novo em vez de mexer no que recebeu. Quem grava é o repositório.
 */
export function incorporarAoCadastro(entrada: {
  cadastro: ContatoDaFamilia[]
  tutorId: string
  pessoas: PessoaAutorizada[]
  novoId: () => string
}): { cadastro: ContatoDaFamilia[]; confirmadas: PessoaAutorizada[] } {
  const cadastro = entrada.cadastro.map((contato) => ({ ...contato }))
  const confirmadas: PessoaAutorizada[] = []

  for (const bruta of entrada.pessoas) {
    const pessoa = limparPessoa(bruta)

    /* Sem nome não há quem conferir no balcão. A tela já impede; aqui só não grava. */
    if (!pessoa.nome) {
      continue
    }

    const daFamilia = cadastro.filter((contato) => contato.tutorId === entrada.tutorId)
    const existente =
      daFamilia.find((contato) => pessoa.id !== '' && contato.id === pessoa.id) ??
      daFamilia.find((contato) => mesmoTelefone(contato.telefone, pessoa.telefone))

    let gravada: ContatoDaFamilia

    if (existente) {
      existente.nome = pessoa.nome
      existente.telefone = pessoa.telefone || existente.telefone
      existente.relacao = pessoa.relacao || existente.relacao
      existente.documento = pessoa.documento || existente.documento
      gravada = existente
    } else {
      gravada = { ...pessoa, id: entrada.novoId(), tutorId: entrada.tutorId }
      cadastro.push(gravada)
    }

    /* A mesma pessoa marcada duas vezes — pelo id e pelo telefone — sai uma vez só. */
    if (!confirmadas.some((item) => item.id === gravada.id)) {
      confirmadas.push(semFamilia(gravada))
    }
  }

  return { cadastro, confirmadas }
}

/** O cadastro de uma família, na ordem em que as pessoas foram entrando. */
export function contatosDe(cadastro: ContatoDaFamilia[], tutorId: string): PessoaAutorizada[] {
  return cadastro.filter((contato) => contato.tutorId === tutorId).map(semFamilia)
}

// ---------------------------------------------------------------------------
// Pessoa nova, no formulário do balcão
// ---------------------------------------------------------------------------

export type ProblemaDaPessoa = {
  nome: 'obrigatorio' | null
  telefone: 'obrigatorio' | 'invalido' | 'repetido' | null
  /** De quem é o telefone repetido, para a tela dizer o nome em vez de só recusar. */
  repetidoDe: string
}

/**
 * O que impede de acrescentar esta pessoa à lista.
 *
 * O telefone repetido é recusado **aqui**, e não fundido em silêncio: no cadastro, o mesmo
 * telefone é a mesma pessoa, e aceitar "Clara" com o celular do Marcos faria a gravação trocar o
 * nome do Marcos. Dizer de quem é o número resolve na hora — quase sempre é a mesma pessoa, que
 * já estava na lista.
 */
export function problemaDaPessoa(
  pessoa: Pick<PessoaAutorizada, 'nome' | 'telefone'>,
  jaNaLista: Pick<PessoaAutorizada, 'nome' | 'telefone'>[],
): ProblemaDaPessoa {
  const repetida = jaNaLista.find((item) => mesmoTelefone(item.telefone, pessoa.telefone))

  return {
    nome: pessoa.nome.trim() ? null : 'obrigatorio',
    telefone: !pessoa.telefone.trim()
      ? 'obrigatorio'
      : !telefoneValido(pessoa.telefone)
        ? 'invalido'
        : repetida
          ? 'repetido'
          : null,
    repetidoDe: repetida?.nome ?? '',
  }
}

export function pessoaPodeEntrar(problema: ProblemaDaPessoa): boolean {
  return problema.nome === null && problema.telefone === null
}

// ---------------------------------------------------------------------------
// Veterinário do animal
// ---------------------------------------------------------------------------

/** O veterinário como deve ser gravado. Os três campos vazios são "não informado": `null`. */
export function veterinarioInformado(
  veterinario: VeterinarioDoPet | null,
): VeterinarioDoPet | null {
  if (!veterinario) {
    return null
  }

  const limpo = {
    nome: veterinario.nome.trim(),
    clinica: veterinario.clinica.trim(),
    telefone: telefoneParaGravar(veterinario.telefone),
  }

  return limpo.nome || limpo.clinica || limpo.telefone ? limpo : null
}

/**
 * Por que este veterinário não pode ser gravado. `null` quando pode.
 *
 * Ele é opcional — muita família não tem veterinário fixo, e travar a entrada por isso ensinaria a
 * recepção a escrever "não tem" no nome. O que não pode é a ficha com nome e sem número: ela
 * parece preenchida, ninguém volta para completar, e na madrugada não serve para ligar.
 */
export function problemaDoVeterinario(
  veterinario: VeterinarioDoPet,
): 'sem-telefone' | 'telefone-invalido' | null {
  const telefone = veterinario.telefone.trim()

  if (telefone) {
    return telefoneValido(telefone) ? null : 'telefone-invalido'
  }

  return veterinario.nome.trim() || veterinario.clinica.trim() ? 'sem-telefone' : null
}
