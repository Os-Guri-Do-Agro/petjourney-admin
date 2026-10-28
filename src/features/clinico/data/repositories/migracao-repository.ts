/**
 * Repositório da importação.
 *
 * Grava o plano **em lotes**, na ordem das linhas. Na API isto é um job no servidor
 * (`POST /parceiro/portal/importacoes/:id/lotes`), e o formato já é o dele: cada lote devolve o
 * que aconteceu com cada linha e os vínculos criados até ali — é com os vínculos que o lote
 * seguinte sabe que o responsável da linha 12 já foi criado na linha 4.
 *
 * Lote que falha não grava nada (a falha do mock acontece antes de qualquer escrita), então
 * repetir o lote é seguro. É o que torna "pausar e continuar depois" honesto.
 *
 * Juntar com cadastro existente **só preenche o que está em branco** — nunca troca um valor que
 * a clínica já tinha. A planilha é mais velha que o cadastro que alguém digitou aqui.
 */

import { SEVERIDADE_PADRAO } from '../../domain/cadastro'
import type { BaseAtual, ItemDoPlano, SituacaoDaLinha } from '../../domain/migracao'
import { simularChamada } from '../mock-runtime'
import { getDataset, novoId } from '../store'
import type { ContatoPreferido, Pet, Tutor } from '../types'

import { iniciaisDe } from './patient-repository'

export type VinculosDaImportacao = {
  /** Grupo de responsável da planilha → `Tutor.id` criado ou juntado. */
  tutores: Record<string, string>
  /** Linha da planilha → `Pet.id` criado ou juntado. */
  animais: Record<number, string>
}

export type ResultadoDaLinha = {
  linha: number
  situacao: SituacaoDaLinha
  tutorId: string | null
  petId: string | null
}

function canalPreferido(telefone: string, email: string): ContatoPreferido {
  return !telefone && email ? 'email' : 'whatsapp'
}

function alergiaComoAlerta(detalhe: string): Pet['alertas'][number] {
  return { id: novoId('alerta'), kind: 'alergia', severidade: SEVERIDADE_PADRAO.alergia, detalhe }
}

function garantirResponsavel(item: ItemDoPlano, vinculos: VinculosDaImportacao): string | null {
  const dataset = getDataset()

  if (!item.grupo || !item.responsavel) {
    return null
  }

  const conhecido = vinculos.tutores[item.grupo]

  if (conhecido) {
    return conhecido
  }

  const daPlanilha = item.responsavel

  if (item.tutorExistente) {
    const tutor = dataset.tutores.find((candidato) => candidato.id === item.tutorExistente!.id)

    if (tutor) {
      const conhecidos = [tutor.telefone, tutor.telefoneSecundario].map((numero) =>
        numero.replace(/\D/g, ''),
      )
      const novo = [daPlanilha.telefone, daPlanilha.telefoneSecundario].find(
        (numero) => numero && !conhecidos.includes(numero.replace(/\D/g, '')),
      )

      if (novo && !tutor.telefoneSecundario) tutor.telefoneSecundario = novo
      if (!tutor.email && daPlanilha.email) tutor.email = daPlanilha.email
      if (!tutor.documento && daPlanilha.documento) tutor.documento = daPlanilha.documento
      if (!tutor.endereco && daPlanilha.endereco) tutor.endereco = daPlanilha.endereco
    }

    vinculos.tutores[item.grupo] = item.tutorExistente.id

    return item.tutorExistente.id
  }

  const tutor: Tutor = {
    id: novoId('tutor'),
    nome: daPlanilha.nome,
    telefone: daPlanilha.telefone,
    telefoneSecundario: daPlanilha.telefoneSecundario,
    email: daPlanilha.email,
    documento: daPlanilha.documento,
    preferenciaContato: canalPreferido(daPlanilha.telefone, daPlanilha.email),
    endereco: daPlanilha.endereco,
  }

  dataset.tutores.push(tutor)
  vinculos.tutores[item.grupo] = tutor.id

  return tutor.id
}

function preencherPaciente(pet: Pet, item: ItemDoPlano) {
  const animal = item.animal

  if (!animal) {
    return
  }

  if (!pet.raca && animal.raca) pet.raca = animal.raca
  if (!pet.sexo && animal.sexo) pet.sexo = animal.sexo
  if (!pet.nascimento && animal.nascimento) pet.nascimento = animal.nascimento
  if (pet.pesoKg === null && animal.pesoKg !== null) pet.pesoKg = animal.pesoKg
  if (!pet.microchip && animal.microchip) pet.microchip = animal.microchip
  if (!pet.pelagem && animal.pelagem) pet.pelagem = animal.pelagem

  if (item.mesclaDoAnimal?.preenche.includes('alergia') && animal.alergia) {
    pet.alertas = [...pet.alertas, alergiaComoAlerta(animal.alergia)]
  }
}

export const migracaoRepository = {
  /** O que já está cadastrado, para o plano procurar repetidos. Cópia, como `todosOsPets`. */
  base(): BaseAtual {
    const dataset = getDataset()

    return { tutores: [...dataset.tutores], pets: [...dataset.pets] }
  },

  /** O DDD do telefone da clínica: é o que ganha o número anotado sem DDD. */
  dddDaClinica(): string {
    return getDataset().clinic.telefone.replace(/\D/g, '').slice(0, 2) || '11'
  },

  importarLote(
    itens: ItemDoPlano[],
    vinculosAnteriores: VinculosDaImportacao,
  ): Promise<{ resultados: ResultadoDaLinha[]; vinculos: VinculosDaImportacao }> {
    return simularChamada(
      'migracao.importar',
      () => {
        const dataset = getDataset()
        const vinculos: VinculosDaImportacao = {
          tutores: { ...vinculosAnteriores.tutores },
          animais: { ...vinculosAnteriores.animais },
        }

        const resultados = itens.map((item): ResultadoDaLinha => {
          if (item.situacao === 'fora' || item.situacao === 'pendente') {
            return { linha: item.linha, situacao: item.situacao, tutorId: null, petId: null }
          }

          const tutorId = garantirResponsavel(item, vinculos)

          if (item.situacao === 'contato' || !item.animal || !tutorId) {
            return { linha: item.linha, situacao: 'contato', tutorId, petId: null }
          }

          if (item.juntaComLinha !== null) {
            return {
              linha: item.linha,
              situacao: 'junta',
              tutorId,
              petId: vinculos.animais[item.juntaComLinha] ?? null,
            }
          }

          if (item.petExistente) {
            const pet = dataset.pets.find((candidato) => candidato.id === item.petExistente!.id)

            if (pet) {
              preencherPaciente(pet, item)
            }

            vinculos.animais[item.linha] = item.petExistente.id

            return { linha: item.linha, situacao: 'junta', tutorId, petId: item.petExistente.id }
          }

          const animal = item.animal
          const pet: Pet = {
            id: novoId('pet'),
            nome: animal.nome,
            especie: animal.especie!,
            raca: animal.raca,
            sexo: animal.sexo,
            nascimento: animal.nascimento,
            castrado: animal.castrado,
            porte: null,
            pesoKg: animal.pesoKg,
            microchip: animal.microchip,
            pelagem: animal.pelagem,
            tutorId,
            alertas: animal.alergia ? [alergiaComoAlerta(animal.alergia)] : [],
            iniciais: iniciaisDe(animal.nome),
            fotoUrl: '',
          }

          dataset.pets.push(pet)
          vinculos.animais[item.linha] = pet.id

          return { linha: item.linha, situacao: 'entra', tutorId, petId: pet.id }
        })

        return { resultados, vinculos }
      },
      itens.length,
    )
  },
}
