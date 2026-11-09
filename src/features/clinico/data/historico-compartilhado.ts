/**
 * O histórico que viaja com o pet — o servidor de mentira, nos dois lados (doc 19).
 *
 * `historicoLiberadoRepository` é a recepção: lista os pacientes cujo histórico o responsável
 * liberou para esta clínica, recebe um código novo, abre o histórico (e cada abertura fica
 * registrada) e lê a coleira. `historicoDoResponsavel` é o celular: com quem o histórico está,
 * liberar para uma clínica nova, encerrar e "quem abriu e quando".
 *
 * Os dois leem o mesmo `getDataset().historicoCompartilhado`: encerrar no celular some com o
 * histórico na tela da clínica na hora, e abrir aqui aparece lá.
 *
 * Como a API de verdade (`CompartilhamentoPrestador`): o histórico só volta enquanto o acesso
 * vale — encerrado ou vencido, volta `null`, e a clínica nunca sabe quem encerrou nem por quê.
 */

import { addDays, createClinicClock } from '../domain/clinic-time'
import {
  conselhoValidoParaEmergencia,
  estadoDoAcesso,
  gerarCodigo,
  itensVisiveis,
  montarFichaDeEmergencia,
  montarFichaPublica,
  motivoDaEmergenciaValido,
  motivoDoCodigoRecusado,
  normalizarCodigo,
  origensDoHistorico,
  terminouEm,
  type AberturaDoHistorico,
  type AcessoAoHistorico,
  type CategoriaDoHistorico,
  type EstadoDoAcesso,
  type FichaDeEmergencia,
  type FichaPublica,
  type ItemDoHistorico,
  type MotivoDoCodigoRecusado,
} from '../domain/historico-compartilhado'

import { CLINIC_UTC_OFFSET, professionalsFixture } from './fixtures'
import { createPrng, hashSeed, simularChamada } from './mock-runtime'
import type { AvisoDoHistorico } from './seed-historico'
import { agoraIso, getDataset, novoId } from './store'
import type { ISODateTime, Pet, Tutor } from './types'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

export type CodigoDeErroDoHistorico =
  | MotivoDoCodigoRecusado
  | 'ACESSO_NAO_ENCONTRADO'
  | 'COLEIRA_NAO_ENCONTRADA'
  /** Quem tentou abrir a ficha de emergência não tem CRMV. */
  | 'CRMV_OBRIGATORIO'
  /** O motivo da emergência é obrigatório, de 10 a 300 caracteres. */
  | 'MOTIVO_INVALIDO'

export class ErroDoHistorico extends Error {
  readonly codigo: CodigoDeErroDoHistorico

  constructor(codigo: CodigoDeErroDoHistorico) {
    super(`[historico] ${codigo}`)
    this.name = 'ErroDoHistorico'
    this.codigo = codigo
  }
}

// ---------------------------------------------------------------------------
// Quem é quem
// ---------------------------------------------------------------------------

/** O pet, seja paciente desta clínica ou ainda só do app. */
function petDoHistorico(petId: string): Pet | null {
  const dataset = getDataset()

  return (
    dataset.pets.find((pet) => pet.id === petId) ??
    dataset.contasSoNoApp.flatMap((conta) => conta.pets).find((pet) => pet.id === petId) ??
    null
  )
}

function tutorDoHistorico(tutorId: string): Tutor | null {
  const dataset = getDataset()

  return (
    dataset.tutores.find((tutor) => tutor.id === tutorId) ??
    dataset.contasSoNoApp.find((conta) => conta.tutor.id === tutorId)?.tutor ??
    null
  )
}

function estado() {
  return getDataset().historicoCompartilhado
}

function itensDoPet(petId: string): ItemDoHistorico[] {
  return estado().itensPorPet[petId] ?? []
}

function acessoPorId(acessoId: string): AcessoAoHistorico {
  const acesso = estado().acessos.find((item) => item.id === acessoId)

  if (!acesso) {
    throw new ErroDoHistorico('ACESSO_NAO_ENCONTRADO')
  }

  return acesso
}

// ---------------------------------------------------------------------------
// Lado da clínica
// ---------------------------------------------------------------------------

/**
 * Uma linha da lista "Histórico liberado". Terminado (por prazo ou pelo responsável) é um estado
 * só: a clínica não precisa saber qual dos dois, e o responsável não precisa se explicar.
 */
export type LinhaDoHistorico = {
  acessoId: string
  petId: string
  petNome: string
  petIniciais: string
  petFotoUrl: string
  especie: Pet['especie']
  raca: string
  tutorNome: string
  categorias: CategoriaDoHistorico[]
  liberadoEm: ISODateTime
  /** Até quando vale, enquanto vale. */
  expiraEm: ISODateTime
  estado: 'ativo' | 'terminou'
  /** Quando terminou, se terminou. */
  terminouEm: ISODateTime | null
  /** A abertura mais recente feita por esta clínica. */
  ultimaAbertura: AberturaDoHistorico | null
  /** Clínicas de onde o histórico veio, só enquanto vale. */
  clinicasDeOrigem: string[]
}

export type HistoricoAberto = {
  linha: LinhaDoHistorico
  /** `null` quando o acesso terminou: o histórico não volta mais, como na API. */
  itens: ItemDoHistorico[] | null
  /** As aberturas desta clínica neste acesso, a mais recente primeiro. */
  aberturas: AberturaDoHistorico[]
  /** A abertura que esta chamada registrou, quando registrou. */
  registrada: AberturaDoHistorico | null
}

/** O que a recepção vê antes de receber: de quem é, o que vem e até quando. */
export type CodigoConferido = {
  codigo: string
  petNome: string
  petIniciais: string
  especie: Pet['especie']
  raca: string
  tutorNome: string
  categorias: CategoriaDoHistorico[]
  expiraEm: ISODateTime
  /** O pet já é paciente da clínica: receber não cria cadastro novo. */
  jaEPaciente: boolean
}

function clinicaAtual() {
  return getDataset().clinic
}

function linhaDoAcesso(acesso: AcessoAoHistorico, agora: ISODateTime): LinhaDoHistorico {
  const pet = petDoHistorico(acesso.petId)
  const tutor = tutorDoHistorico(acesso.tutorId)
  const situacao = estadoDoAcesso(acesso, agora)
  const ativo = situacao === 'ativo'
  const aberturas = estado()
    .aberturas.filter((abertura) => abertura.acessoId === acesso.id)
    .sort((a, b) => b.em.localeCompare(a.em))

  return {
    acessoId: acesso.id,
    petId: acesso.petId,
    petNome: pet?.nome ?? '',
    petIniciais: pet?.iniciais ?? '',
    petFotoUrl: pet?.fotoUrl ?? '',
    especie: pet?.especie ?? 'canina',
    raca: pet?.raca ?? '',
    tutorNome: tutor?.nome ?? '',
    categorias: [...acesso.categorias],
    liberadoEm: acesso.liberadoEm,
    expiraEm: acesso.expiraEm,
    estado: ativo ? 'ativo' : 'terminou',
    terminouEm: ativo ? null : terminouEm(acesso),
    ultimaAbertura: aberturas[0] ?? null,
    clinicasDeOrigem: ativo
      ? origensDoHistorico(itensVisiveis(acesso, itensDoPet(acesso.petId), agora) ?? []).clinicas
      : [],
  }
}

/** Os acessos que esta clínica recebeu (o código já digitado). */
function acessosDaClinica(): AcessoAoHistorico[] {
  const clinica = clinicaAtual()

  return estado().acessos.filter(
    (acesso) => acesso.parceiroId === clinica.id && acesso.vinculadoEm !== null,
  )
}

function acessoPeloCodigo(texto: string): AcessoAoHistorico | null {
  const codigo = normalizarCodigo(texto)

  return estado().acessos.find((acesso) => acesso.codigo === codigo) ?? null
}

/** Copia do app para a clínica o responsável e o pet, quando a clínica ainda não os conhece. */
function cadastrarSePreciso(acesso: AcessoAoHistorico) {
  const dataset = getDataset()

  if (dataset.pets.some((pet) => pet.id === acesso.petId)) {
    return
  }

  const conta = dataset.contasSoNoApp.find((item) => item.tutor.id === acesso.tutorId)
  const pet = conta?.pets.find((item) => item.id === acesso.petId)

  if (!conta || !pet) {
    return
  }

  if (!dataset.tutores.some((tutor) => tutor.id === conta.tutor.id)) {
    dataset.tutores.push({ ...conta.tutor })
  }

  dataset.pets.push({ ...pet, alertas: [...pet.alertas] })
}

function profissionalPorId(professionalId: string | null) {
  return professionalsFixture.find((item) => item.id === professionalId) ?? null
}

export type ColeiraDeDemonstracao = { codigo: string; petNome: string; petIniciais: string }

export const historicoLiberadoRepository = {
  /** Ativos primeiro (o que vence antes em cima), depois os que terminaram (o mais recente em cima). */
  listar(): Promise<LinhaDoHistorico[]> {
    return simularChamada('historico.listar', () => {
      const agora = agoraIso()
      const linhas = acessosDaClinica().map((acesso) => linhaDoAcesso(acesso, agora))
      const ativos = linhas
        .filter((linha) => linha.estado === 'ativo')
        .sort((a, b) => a.expiraEm.localeCompare(b.expiraEm))
      const terminados = linhas
        .filter((linha) => linha.estado === 'terminou')
        .sort((a, b) => (b.terminouEm ?? '').localeCompare(a.terminouEm ?? ''))

      return [...ativos, ...terminados]
    })
  },

  /**
   * Abre o histórico de um acesso. Valendo, registra quem abriu e o quê — é a linha que o
   * responsável lê em "Quem abriu e quando". Terminado, não registra nada: não há o que abrir.
   */
  abrir(acessoId: string, professionalId: string): Promise<HistoricoAberto> {
    return simularChamada('historico.abrir', () => {
      const agora = agoraIso()
      const acesso = acessoPorId(acessoId)

      if (acesso.parceiroId !== clinicaAtual().id) {
        throw new ErroDoHistorico('ACESSO_NAO_ENCONTRADO')
      }

      const itens = itensVisiveis(acesso, itensDoPet(acesso.petId), agora)
      let registrada: AberturaDoHistorico | null = null
      const profissional = profissionalPorId(professionalId)

      if (itens && profissional) {
        registrada = {
          id: novoId('abertura'),
          petId: acesso.petId,
          acessoId: acesso.id,
          canal: 'FICHA',
          em: agora,
          profissionalNome: profissional.nome,
          conselho: profissional.conselho,
          parceiroNome: clinicaAtual().nome,
          categorias: [...new Set(itens.map((item) => item.categoria))],
          motivo: null,
          parceiroTelefone: null,
        }
        estado().aberturas.push(registrada)
      }

      const aberturas = estado()
        .aberturas.filter((abertura) => abertura.acessoId === acesso.id)
        .sort((a, b) => b.em.localeCompare(a.em))

      return { linha: linhaDoAcesso(acesso, agora), itens, aberturas, registrada }
    })
  },

  /** Confere o código antes de receber: diz de quem é, o que vem e até quando. */
  conferirCodigo(texto: string): Promise<CodigoConferido> {
    return simularChamada('historico.receber', () => {
      const agora = agoraIso()
      const acesso = acessoPeloCodigo(texto)
      const motivo = motivoDoCodigoRecusado(acesso, agora)

      if (motivo || !acesso) {
        throw new ErroDoHistorico(motivo ?? 'CODIGO_NAO_ENCONTRADO')
      }

      const pet = petDoHistorico(acesso.petId)
      const tutor = tutorDoHistorico(acesso.tutorId)

      return {
        codigo: acesso.codigo,
        petNome: pet?.nome ?? '',
        petIniciais: pet?.iniciais ?? '',
        especie: pet?.especie ?? 'canina',
        raca: pet?.raca ?? '',
        tutorNome: tutor?.nome ?? '',
        categorias: [...acesso.categorias],
        expiraEm: acesso.expiraEm,
        jaEPaciente: getDataset().pets.some((item) => item.id === acesso.petId),
      }
    })
  },

  /**
   * Recebe o histórico: o acesso passa a ser desta clínica, e o pet que só existia no app vira
   * paciente com o responsável — é aqui que o paciente novo chega com o histórico completo.
   */
  receber(texto: string): Promise<{ acessoId: string; petId: string }> {
    return simularChamada('historico.receber', () => {
      const agora = agoraIso()
      const acesso = acessoPeloCodigo(texto)
      const motivo = motivoDoCodigoRecusado(acesso, agora)

      if (motivo || !acesso) {
        throw new ErroDoHistorico(motivo ?? 'CODIGO_NAO_ENCONTRADO')
      }

      acesso.parceiroId = clinicaAtual().id
      acesso.parceiroNome = clinicaAtual().nome
      acesso.vinculadoEm = agora
      cadastrarSePreciso(acesso)

      return { acessoId: acesso.id, petId: acesso.petId }
    })
  },

  /**
   * Os códigos que esperam uma clínica, para a demonstração digitar sem precisar do celular de
   * verdade — inclusive o que acabou de ser gerado no celular da prévia.
   */
  codigosEsperando(): Array<{ codigo: string; petNome: string; tutorNome: string }> {
    const agora = agoraIso()

    return estado()
      .acessos.filter((acesso) => estadoDoAcesso(acesso, agora) === 'aguardando')
      .sort((a, b) => b.liberadoEm.localeCompare(a.liberadoEm))
      .map((acesso) => ({
        codigo: acesso.codigo,
        petNome: petDoHistorico(acesso.petId)?.nome ?? '',
        tutorNome: tutorDoHistorico(acesso.tutorId)?.nome ?? '',
      }))
  },

  /** As coleiras que a demonstração deixa "ler" sem câmera. */
  coleirasDeDemonstracao(): ColeiraDeDemonstracao[] {
    return estado().coleiras.map((coleira) => {
      const pet = petDoHistorico(coleira.petId)

      return { codigo: coleira.codigo, petNome: pet?.nome ?? '', petIniciais: pet?.iniciais ?? '' }
    })
  },

  /** O primeiro degrau: o mesmo que qualquer pessoa vê ao ler o QR. Não registra nada. */
  lerColeira(codigo: string): Promise<FichaPublica> {
    return simularChamada('historico.coleira', () => {
      const { pet, tutor } = petDaColeira(codigo)

      return montarFichaPublica(paraFicha(pet), tutor?.nome ?? '', itensDoPet(pet.id))
    })
  },

  /**
   * O segundo degrau. Só com CRMV e com um motivo; abrir fica registrado com nome, conselho,
   * motivo e o telefone da clínica, e o responsável recebe o aviso na hora. Não depende de
   * acesso liberado: é a emergência sem ele por perto.
   */
  abrirEmergencia(
    codigo: string,
    professionalId: string | null,
    motivo: string,
  ): Promise<{ ficha: FichaDeEmergencia; abertura: AberturaDoHistorico }> {
    return simularChamada('historico.coleira', () => {
      const profissional = profissionalPorId(professionalId)

      if (!profissional || !conselhoValidoParaEmergencia(profissional.conselho)) {
        throw new ErroDoHistorico('CRMV_OBRIGATORIO')
      }

      if (!motivoDaEmergenciaValido(motivo)) {
        throw new ErroDoHistorico('MOTIVO_INVALIDO')
      }

      const { pet } = petDaColeira(codigo)
      const agora = agoraIso()
      const itens = itensDoPet(pet.id)
      const abertura: AberturaDoHistorico = {
        id: novoId('abertura'),
        petId: pet.id,
        acessoId: null,
        canal: 'EMERGENCIA',
        em: agora,
        profissionalNome: profissional.nome,
        conselho: profissional.conselho,
        parceiroNome: clinicaAtual().nome,
        categorias: ['ALERGIAS', 'MEDICAMENTOS', 'DIAGNOSTICOS', 'PESO'],
        motivo: motivo.trim(),
        parceiroTelefone: clinicaAtual().telefone,
      }
      const aviso: AvisoDoHistorico = {
        id: novoId('aviso-historico'),
        tutorId: pet.tutorId,
        petId: pet.id,
        em: agora,
        aberturaId: abertura.id,
      }

      estado().aberturas.push(abertura)
      estado().avisos.push(aviso)

      return { ficha: montarFichaDeEmergencia(paraFicha(pet), itens), abertura }
    })
  },
}

function petDaColeira(codigo: string): { pet: Pet; tutor: Tutor | null } {
  const coleira = estado().coleiras.find((item) => item.codigo === codigo.trim().toLowerCase())
  const pet = coleira ? petDoHistorico(coleira.petId) : null

  if (!pet) {
    throw new ErroDoHistorico('COLEIRA_NAO_ENCONTRADA')
  }

  return { pet, tutor: tutorDoHistorico(pet.tutorId) }
}

function paraFicha(pet: Pet) {
  return {
    petId: pet.id,
    nome: pet.nome,
    especie: pet.especie,
    raca: pet.raca,
    iniciais: pet.iniciais,
    fotoUrl: pet.fotoUrl,
    microchip: pet.microchip,
  }
}

// ---------------------------------------------------------------------------
// Lado do responsável — o celular da demonstração
// ---------------------------------------------------------------------------

export type PetNoCelular = { id: string; nome: string; iniciais: string; fotoUrl: string }

export type AcessoNoCelular = {
  id: string
  petId: string
  petNome: string
  /** `null` enquanto o código não foi usado. */
  parceiroNome: string | null
  codigo: string
  categorias: CategoriaDoHistorico[]
  liberadoEm: ISODateTime
  expiraEm: ISODateTime
  encerradoEm: ISODateTime | null
  estado: EstadoDoAcesso
  /** Quantas vezes alguém da clínica abriu. */
  aberturas: number
}

export type AvisoNoCelular = {
  id: string
  petNome: string
  em: ISODateTime
  abertura: AberturaDoHistorico
}

function acessoNoCelular(acesso: AcessoAoHistorico, agora: ISODateTime): AcessoNoCelular {
  return {
    id: acesso.id,
    petId: acesso.petId,
    petNome: petDoHistorico(acesso.petId)?.nome ?? '',
    parceiroNome: acesso.parceiroNome,
    codigo: acesso.codigo,
    categorias: [...acesso.categorias],
    liberadoEm: acesso.liberadoEm,
    expiraEm: acesso.expiraEm,
    encerradoEm: acesso.encerradoEm,
    estado: estadoDoAcesso(acesso, agora),
    aberturas: estado().aberturas.filter((abertura) => abertura.acessoId === acesso.id).length,
  }
}

function acessoDoResponsavel(tutorId: string, acessoId: string): AcessoAoHistorico {
  const acesso = acessoPorId(acessoId)

  if (acesso.tutorId !== tutorId) {
    throw new ErroDoHistorico('ACESSO_NAO_ENCONTRADO')
  }

  return acesso
}

export const historicoDoResponsavel = {
  /** Os pets da conta, sejam ou não pacientes da clínica. */
  pets(tutorId: string): PetNoCelular[] {
    const dataset = getDataset()
    const daClinica = dataset.pets.filter((pet) => pet.tutorId === tutorId)
    const doApp = dataset.contasSoNoApp
      .filter((conta) => conta.tutor.id === tutorId)
      .flatMap((conta) => conta.pets)
      .filter((pet) => !daClinica.some((item) => item.id === pet.id))

    return [...daClinica, ...doApp]
      .filter((pet) => (estado().itensPorPet[pet.id] ?? []).length > 0)
      .map((pet) => ({ id: pet.id, nome: pet.nome, iniciais: pet.iniciais, fotoUrl: pet.fotoUrl }))
  },

  /** Todos os acessos da conta. A tela separa os que valem dos que terminaram. */
  acessos(tutorId: string): Promise<AcessoNoCelular[]> {
    return simularChamada('historico.listar', () => {
      const agora = agoraIso()

      return estado()
        .acessos.filter((acesso) => acesso.tutorId === tutorId)
        .map((acesso) => acessoNoCelular(acesso, agora))
        .sort((a, b) => b.liberadoEm.localeCompare(a.liberadoEm))
    })
  },

  /** "Quem abriu e quando", do pet: a mais recente primeiro, emergência incluída. */
  aberturas(tutorId: string, petId: string): Promise<AberturaDoHistorico[]> {
    return simularChamada('historico.listar', () => {
      const pet = petDoHistorico(petId)

      if (!pet || pet.tutorId !== tutorId) {
        return []
      }

      return estado()
        .aberturas.filter((abertura) => abertura.petId === petId)
        .sort((a, b) => b.em.localeCompare(a.em))
    })
  },

  /** Os avisos da conta: hoje, só a ficha de emergência aberta. O mais recente primeiro. */
  avisos(tutorId: string): Promise<AvisoNoCelular[]> {
    return simularChamada('historico.listar', () =>
      estado()
        .avisos.filter((aviso) => aviso.tutorId === tutorId)
        .sort((a, b) => b.em.localeCompare(a.em))
        .flatMap((aviso) => {
          const abertura = estado().aberturas.find((item) => item.id === aviso.aberturaId)

          return abertura
            ? [
                {
                  id: aviso.id,
                  petNome: petDoHistorico(aviso.petId)?.nome ?? '',
                  em: aviso.em,
                  abertura,
                },
              ]
            : []
        }),
    )
  },

  /** Libera para uma clínica nova: nasce um código, que vale até o fim do prazo ou até ser usado. */
  liberar(
    tutorId: string,
    petId: string,
    categorias: CategoriaDoHistorico[],
    prazoDias: number,
  ): Promise<AcessoNoCelular> {
    return simularChamada('historico.liberar', () => {
      const agora = agoraIso()
      const pet = petDoHistorico(petId)

      if (!pet || pet.tutorId !== tutorId || categorias.length === 0) {
        throw new ErroDoHistorico('ACESSO_NAO_ENCONTRADO')
      }

      const existentes = new Set(estado().acessos.map((acesso) => acesso.codigo))
      const sortear = createPrng(hashSeed(`${tutorId}|${petId}|${agora}|${existentes.size}`))
      const acesso: AcessoAoHistorico = {
        id: novoId('acesso'),
        codigo: gerarCodigo(sortear, existentes),
        petId,
        tutorId,
        parceiroId: null,
        parceiroNome: null,
        categorias: [...categorias],
        liberadoEm: agora,
        expiraEm: clock.toIso(addDays(clock.dateOf(agora), prazoDias), clock.minutesOf(agora)),
        vinculadoEm: null,
        encerradoEm: null,
      }

      estado().acessos.push(acesso)

      return acessoNoCelular(acesso, agora)
    })
  },

  /**
   * Encerra na hora. Sem motivo e sem aviso de motivo à clínica: para ela, o acesso terminou —
   * a mesma frase de quando vence no prazo. O que a clínica registrou na ficha dela continua dela.
   */
  encerrar(tutorId: string, acessoId: string): Promise<void> {
    return simularChamada('historico.encerrar', () => {
      const acesso = acessoDoResponsavel(tutorId, acessoId)

      if (!acesso.encerradoEm) {
        acesso.encerradoEm = agoraIso()
      }
    })
  },
}
