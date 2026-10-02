/**
 * Adesão ao tratamento — o remédio de casa, visto pela clínica e registrado pelo app.
 *
 * Dois lados, como a vacina:
 *
 * - **O que a clínica lê**: a ficha do paciente, a lista da clínica e o alerta. Só o que a casa
 *   compartilha; o tratamento que ela não compartilha aparece como existente e mais nada.
 * - **O que o app faz**: registrar a dose, desfazer o toque errado, criar o lembrete da receita.
 *   Mora aqui só porque a prévia do celular, no portal, precisa fazer a demonstração andar. Com a
 *   API, esse lado sai daqui e vai para o app — as regras que ele aplica são as mesmas do
 *   contrato (`ROTAS_DA_ADESAO`, `REGRAS_DA_DOSE`).
 *
 * As contas (grade, situação da dose, resumo, alerta) são do domínio (`domain/adesao.ts`); aqui
 * só se junta o que existe e se decide o período.
 */

import type { AvisoDeDose, TratamentosDoPet } from '../../contrato/responsavel'
import {
  ANTECEDENCIA_DO_REGISTRO_MIN,
  alertaDeAdesao,
  dosesDoTratamento,
  dosesNoPeriodo,
  emCurso,
  resumirAdesao,
  sugerirPrimeiraDose,
  ultimaDoseEm,
  type AlertaDeAdesao,
  type DoseNaGrade,
  type MotivoDaDosePulada,
  type RegistroDeDose,
  type ResumoDaAdesao,
} from '../../domain/adesao'
import { createClinicClock, epochToWall, wallToIso } from '../../domain/clinic-time'
import type { TratamentoNoResumo } from '../../domain/resumo-do-paciente'
import { CLINIC_UTC_OFFSET, medicationsFixture } from '../fixtures'
import { simularChamada } from '../mock-runtime'
import { projetarAvisosDeDose, projetarTratamentos } from '../projecao-do-responsavel'
import { tratamentoDaPrescricao } from '../seed-adesao'
import { agoraIso, getDataset, novoId } from '../store'
import type { SeedResult } from '../seed'
import type {
  Cuidador,
  Encounter,
  ISODateTime,
  Medication,
  PetSpecies,
  TratamentoEmCasa,
} from '../types'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

/**
 * Recusa de registro de dose — a mesma lista do contrato (`CodigoDeErroDaAdesao` e
 * `SOMENTE_LEITURA`), em forma traduzível. A tela escreve a frase; o repositório diz a regra.
 */
export class DoseRecusadaError extends Error {
  readonly kind: 'dose-ja-registrada' | 'dose-fora-da-janela' | 'somente-leitura'
  /** Na `dose-ja-registrada`: quem registrou antes, para a tela dizer "Rafael já deu às 8h05". */
  readonly registro: RegistroDeDose | null

  constructor(kind: DoseRecusadaError['kind'], registro: RegistroDeDose | null = null) {
    super(`tratamento.registrar: ${kind}`)
    this.name = 'DoseRecusadaError'
    this.kind = kind
    this.registro = registro
  }
}

/** Um tratamento como a clínica o lê: a grade, o período, o total e o alerta. */
export type TratamentoNaFicha = {
  tratamento: TratamentoEmCasa
  /** A casa compartilha os registros. Sem isso, tudo abaixo vem vazio. */
  compartilhado: boolean
  emCurso: boolean
  ultimaDoseEm: ISODateTime | null
  /** Todas as doses até agora, mais a da vez. A faixa corta o que couber. */
  doses: DoseNaGrade[]
  /** Desde a última consulta (ou o início, se começou depois dela). É a conta do retorno. */
  periodo: ResumoDaAdesao
  /** Desde o início do tratamento. */
  total: ResumoDaAdesao
  alerta: AlertaDeAdesao | null
}

export type AdesaoDoPaciente = {
  tratamentos: TratamentoNaFicha[]
  /** Quem cuida deste pet em casa — o dono primeiro. */
  cuidadores: Cuidador[]
  /** A última consulta finalizada antes de hoje. É dela que "desde a última consulta" conta. */
  ultimaConsultaEm: ISODateTime | null
}

/** Uma linha da lista da clínica, com o paciente e o responsável já resolvidos. */
export type LinhaDeTratamento = TratamentoNaFicha & {
  petNome: string
  petIniciais: string
  petFotoUrl: string
  especie: PetSpecies
  tutorNome: string
  tutorTelefone: string
  /** Quem cuida, pelo id — o nome de quem registrou cada dose. */
  nomes: Record<string, string>
}

/** Um item de receita que ainda não virou lembrete — o que o celular oferece para criar. */
export type ItemSemLembrete = {
  prescricaoId: string
  medicamentoId: string
  /** Por dose, na unidade da apresentação — como o tratamento vai guardar. */
  quantidade: number
  unidade: Medication['unidadeApresentacao']
  frequenciaHoras: number
  duracaoDias: number | null
  /** O horário que o app sugere para a primeira dose. */
  sugestao: ISODateTime
}

export type ReceitaSemLembrete = {
  encounterId: string
  liberadaEm: ISODateTime
  itens: ItemSemLembrete[]
}

/** O celular do responsável, como a prévia do portal o desenha: só o que o contrato entrega. */
export type TratamentosNoApp = {
  contrato: TratamentosDoPet
  /** O aviso de dose mais recente que já saiu e ainda tem dose aberta — o que está na tela. */
  aviso: AvisoDeDose | null
  receitasSemLembrete: ReceitaSemLembrete[]
}

function somarMinutos(iso: ISODateTime, minutos: number): ISODateTime {
  return wallToIso(
    epochToWall(Date.parse(iso) + minutos * 60_000, clock.utcOffset),
    clock.utcOffset,
  )
}

/** A última consulta finalizada do pet antes de hoje — hoje é a consulta em que se olha. */
function ultimaConsultaAntesDeHoje(dataset: SeedResult, petId: string): ISODateTime | null {
  const inicioDeHoje = Date.parse(clock.toIso(clock.today(), 0))
  const datas = dataset.encounters
    .filter(
      (encounter) =>
        encounter.petId === petId &&
        encounter.status === 'finalizado' &&
        encounter.finalizadoEm !== null &&
        Date.parse(encounter.finalizadoEm) < inicioDeHoje,
    )
    .map((encounter) => encounter.finalizadoEm!)
    .sort((a, b) => Date.parse(b) - Date.parse(a))

  return datas[0] ?? null
}

/**
 * A leitura da clínica de um tratamento, com o período começando em `desde`.
 *
 * Exportada para o resumo "Este pet em 30 segundos", que junta a adesão às outras fontes numa
 * chamada só — ver `patientRepository.paraOResumo`.
 */
export function lerTratamento(
  tratamento: TratamentoEmCasa,
  dataset: SeedResult,
  agora: ISODateTime,
  ultimaConsultaEm: ISODateTime | null,
): TratamentoNaFicha {
  const compartilhado = tratamento.compartilhadoComAClinica
  const doses = compartilhado
    ? dosesDoTratamento(
        tratamento,
        dataset.registrosDeDose,
        agora,
        somarMinutos(agora, ANTECEDENCIA_DO_REGISTRO_MIN),
      )
    : []
  const desde =
    ultimaConsultaEm && Date.parse(ultimaConsultaEm) > Date.parse(tratamento.inicioEm)
      ? ultimaConsultaEm
      : tratamento.inicioEm

  return {
    tratamento,
    compartilhado,
    emCurso: emCurso(tratamento, agora),
    ultimaDoseEm: ultimaDoseEm(tratamento),
    doses,
    periodo: resumirAdesao(doses, desde, agora, tratamento.frequenciaHoras),
    total: resumirAdesao(doses, tratamento.inicioEm, agora, tratamento.frequenciaHoras),
    alerta: compartilhado
      ? alertaDeAdesao({ ...tratamento, contatoEm: tratamento.contato?.em ?? null }, doses, agora)
      : null,
  }
}

/**
 * Os remédios de casa como o resumo "Este pet em 30 segundos" os lê: o período desde a última
 * consulta, e só as doses dele na faixa. Síncrono — roda dentro da chamada do resumo.
 */
export function tratamentosDoResumo(petId: string): TratamentoNoResumo[] {
  const dataset = getDataset()
  const agora = agoraIso()
  const ultimaConsultaEm = ultimaConsultaAntesDeHoje(dataset, petId)
  const nomes = Object.fromEntries(
    cuidadoresDoPet(dataset, petId).map((cuidador) => [cuidador.id, cuidador.nome]),
  )

  return dataset.tratamentos
    .filter((tratamento) => tratamento.petId === petId)
    .map((tratamento) => lerTratamento(tratamento, dataset, agora, ultimaConsultaEm))
    .sort(naOrdemDaFicha)
    .map((lido) => ({
      id: lido.tratamento.id,
      medicamentoId: lido.tratamento.medicamentoId,
      medicamento: lido.tratamento.medicamento,
      critico: lido.tratamento.critico,
      compartilhado: lido.compartilhado,
      emCurso: lido.emCurso,
      quantidade: lido.tratamento.quantidade,
      unidade: lido.tratamento.unidade,
      frequenciaHoras: lido.tratamento.frequenciaHoras,
      duracaoDias: lido.tratamento.duracaoDias,
      doses: dosesNoPeriodo(lido.doses, lido.periodo.desde, somarMinutos(agora, 24 * 60)),
      periodo: lido.periodo,
      alerta: lido.alerta,
      nomes,
    }))
}

/** Em curso primeiro; entre eles, o que tem alerta; depois o mais recente. */
function naOrdemDaFicha(a: TratamentoNaFicha, b: TratamentoNaFicha): number {
  return (
    Number(b.emCurso) - Number(a.emCurso) ||
    Number(b.alerta !== null) - Number(a.alerta !== null) ||
    Date.parse(b.tratamento.inicioEm) - Date.parse(a.tratamento.inicioEm)
  )
}

function cuidadoresDoPet(dataset: SeedResult, petId: string): Cuidador[] {
  return dataset.cuidadores
    .filter((cuidador) => cuidador.petIds.includes(petId))
    .sort((a, b) => Number(a.papel !== 'dono') - Number(b.papel !== 'dono'))
}

function tratamentoOuFalha(dataset: SeedResult, tratamentoId: string): TratamentoEmCasa {
  const tratamento = dataset.tratamentos.find((item) => item.id === tratamentoId)

  if (!tratamento) {
    throw new Error(`tratamento: ${tratamentoId} não existe`)
  }

  return tratamento
}

/** Quem está registrando pode registrar para este pet? É o `SOMENTE_LEITURA` do contrato. */
function editaOPet(dataset: SeedResult, cuidadorId: string, petId: string): boolean {
  const cuidador = dataset.cuidadores.find((item) => item.id === cuidadorId)

  return cuidador?.acesso === 'edicao' && cuidador.petIds.includes(petId)
}

/**
 * Quanto tempo uma receita liberada fica oferecendo "Criar lembretes" no topo do celular.
 *
 * É o aviso de "receita nova", não o arquivo de receitas: a de três semanas atrás continua no
 * resumo daquela consulta, com o botão dela. Sem este corte, o paciente com dez consultas no mês
 * abria o celular com dez cartões de receita empilhados em cima do remédio de hoje.
 */
const RECEITA_NOVA_HORAS = 24

/**
 * Receitas liberadas deste pet nas últimas 24 horas, com item que ainda não virou lembrete.
 *
 * Só as liberadas: o app não vê o que a clínica ainda não entregou. E só item sem tratamento —
 * criar de novo devolveria o mesmo.
 */
function receitasSemLembrete(dataset: SeedResult, petId: string, agora: ISODateTime) {
  const comLembrete = new Set(dataset.tratamentos.map((item) => item.prescricaoId))
  const desde = Date.parse(agora) - RECEITA_NOVA_HORAS * 3_600_000

  return dataset.encounters
    .filter(
      (encounter): encounter is Encounter & { resumoLiberadoEm: ISODateTime } =>
        encounter.petId === petId &&
        Boolean(encounter.resumoLiberadoEm) &&
        Date.parse(encounter.resumoLiberadoEm!) >= desde &&
        encounter.conduta.prescricoes.some((prescricao) => !comLembrete.has(prescricao.id)),
    )
    .sort((a, b) => Date.parse(b.resumoLiberadoEm) - Date.parse(a.resumoLiberadoEm))
    .map((encounter) => ({
      encounterId: encounter.id,
      liberadaEm: encounter.resumoLiberadoEm,
      itens: encounter.conduta.prescricoes
        .filter((prescricao) => !comLembrete.has(prescricao.id))
        .map((prescricao) => ({
          prescricaoId: prescricao.id,
          medicamentoId: prescricao.medicamentoId,
          quantidade: prescricao.calculo.quantidadeApresentacao,
          unidade:
            medicationsFixture.find((item) => item.id === prescricao.medicamentoId)
              ?.unidadeApresentacao ?? 'comprimido',
          frequenciaHoras: prescricao.calculo.frequenciaHoras,
          duracaoDias: prescricao.calculo.duracaoDias,
          sugestao: sugerirPrimeiraDose(prescricao.calculo.frequenciaHoras, agora),
        })),
    }))
}

export const tratamentoRepository = {
  /** A ficha do paciente: todos os tratamentos dele, com a conta do retorno. */
  doPaciente(petId: string): Promise<AdesaoDoPaciente> {
    return simularChamada('tratamento.listar', () => {
      const dataset = getDataset()
      const agora = agoraIso()
      const ultimaConsultaEm = ultimaConsultaAntesDeHoje(dataset, petId)

      return {
        tratamentos: dataset.tratamentos
          .filter((tratamento) => tratamento.petId === petId)
          .map((tratamento) => lerTratamento(tratamento, dataset, agora, ultimaConsultaEm))
          .sort(naOrdemDaFicha),
        cuidadores: cuidadoresDoPet(dataset, petId),
        ultimaConsultaEm,
      }
    })
  },

  /**
   * A lista da clínica: o que está em curso e o que terminou há pouco, com o alerta primeiro.
   *
   * Tratamento de paciente que saiu do cadastro fica fora, como na lista de vacinas: uma linha
   * sem nome parece defeito de carga.
   */
  daClinica(): Promise<LinhaDeTratamento[]> {
    return simularChamada('tratamento.listar', () => {
      const dataset = getDataset()
      const agora = agoraIso()

      return dataset.tratamentos
        .map((tratamento) => {
          const pet = dataset.pets.find((item) => item.id === tratamento.petId)

          if (!pet) {
            return null
          }

          const tutor = dataset.tutores.find((item) => item.id === pet.tutorId)

          return {
            ...lerTratamento(
              tratamento,
              dataset,
              agora,
              ultimaConsultaAntesDeHoje(dataset, pet.id),
            ),
            petNome: pet.nome,
            petIniciais: pet.iniciais,
            petFotoUrl: pet.fotoUrl,
            especie: pet.especie,
            tutorNome: tutor?.nome ?? '',
            tutorTelefone: tutor?.telefone ?? '',
            nomes: Object.fromEntries(
              cuidadoresDoPet(dataset, pet.id).map((cuidador) => [cuidador.id, cuidador.nome]),
            ),
          }
        })
        .filter((linha): linha is LinhaDeTratamento => linha !== null)
        .sort(naOrdemDaFicha)
    })
  },

  /**
   * Quantos tratamentos o pet tem, e quantos pedem a clínica.
   *
   * Síncrono de propósito, como `vacinaRepository.plano`: é a conta que o cabeçalho da ficha faz
   * para decidir se mostra a pílula e com que selo.
   */
  contagem(petId: string): { total: number; alertas: number } {
    const dataset = getDataset()
    const agora = agoraIso()
    const ultimaConsultaEm = ultimaConsultaAntesDeHoje(dataset, petId)
    const lidos = dataset.tratamentos
      .filter((tratamento) => tratamento.petId === petId)
      .map((tratamento) => lerTratamento(tratamento, dataset, agora, ultimaConsultaEm))

    return {
      total: lidos.length,
      alertas: lidos.filter((item) => item.alerta !== null).length,
    }
  },

  /** O celular de quem cuida, na forma do contrato — o que a prévia desenha. */
  noApp(petId: string, cuidadorId: string): Promise<TratamentosNoApp> {
    return simularChamada('tratamento.listar', () => {
      const dataset = getDataset()
      const agora = agoraIso()
      const pet = dataset.pets.find((item) => item.id === petId)
      const ctx = { dataset, agora }
      const inicioDeHoje = clock.toIso(clock.today(), 0)
      const avisosDeHoje = pet
        ? projetarAvisosDeDose(pet.tutorId, ctx, inicioDeHoje, agora).filter((aviso) =>
            aviso.doses.some((dose) => dose.petId === petId),
          )
        : []

      return {
        contrato: projetarTratamentos(petId, cuidadorId, ctx),
        aviso: avisosDeHoje[avisosDeHoje.length - 1] ?? null,
        receitasSemLembrete: editaOPet(dataset, cuidadorId, petId)
          ? receitasSemLembrete(dataset, petId, agora)
          : [],
      }
    })
  },

  /**
   * Registra uma dose — o toque do app.
   *
   * As três recusas do contrato: quem só tem leitura, a dose que outra pessoa da casa já marcou
   * (com o registro dela, para a tela dizer quem e quando — é o que evita a dose dobrada), e a
   * dose fora da janela.
   */
  registrarDose(input: {
    tratamentoId: string
    numero: number
    situacao: 'dada' | 'pulada'
    motivo: MotivoDaDosePulada | null
    cuidadorId: string
  }): Promise<RegistroDeDose> {
    return simularChamada('tratamento.registrar', () => {
      const dataset = getDataset()
      const tratamento = tratamentoOuFalha(dataset, input.tratamentoId)
      const agora = agoraIso()

      if (!editaOPet(dataset, input.cuidadorId, tratamento.petId)) {
        throw new DoseRecusadaError('somente-leitura')
      }

      const dose = dosesDoTratamento(
        tratamento,
        dataset.registrosDeDose,
        agora,
        somarMinutos(agora, ANTECEDENCIA_DO_REGISTRO_MIN),
      ).find((item) => item.numero === input.numero)

      if (dose?.registro) {
        throw new DoseRecusadaError('dose-ja-registrada', dose.registro)
      }

      if (!dose || dose.situacao !== 'aberta') {
        throw new DoseRecusadaError('dose-fora-da-janela')
      }

      if (input.situacao === 'pulada' && !input.motivo) {
        throw new Error('tratamento.registrar: pulada sem motivo')
      }

      const registro: RegistroDeDose = {
        id: novoId('dose'),
        tratamentoId: tratamento.id,
        numero: input.numero,
        situacao: input.situacao,
        motivo: input.situacao === 'pulada' ? input.motivo : null,
        registradaEm: agora,
        cuidadorId: input.cuidadorId,
      }

      dataset.registrosDeDose.push(registro)

      return registro
    })
  },

  /**
   * Desfaz o próprio registro, enquanto a dose ainda está na janela.
   *
   * O toque errado precisa de volta — "dei" por engano na dose do outro pet — e só quem tocou
   * pode voltar: desfazer o registro de outra pessoa da casa apagaria o que ela viu acontecer.
   */
  desfazerDose(input: { tratamentoId: string; numero: number; cuidadorId: string }): Promise<void> {
    return simularChamada('tratamento.registrar', () => {
      const dataset = getDataset()
      const tratamento = tratamentoOuFalha(dataset, input.tratamentoId)
      const agora = agoraIso()
      const indice = dataset.registrosDeDose.findIndex(
        (item) => item.tratamentoId === tratamento.id && item.numero === input.numero,
      )
      const registro = dataset.registrosDeDose[indice]

      if (!registro || registro.cuidadorId !== input.cuidadorId) {
        throw new DoseRecusadaError('somente-leitura')
      }

      const dose = dosesDoTratamento(tratamento, [], agora, agora).find(
        (item) => item.numero === input.numero,
      )

      if (dose && Date.parse(agora) >= Date.parse(dose.registravelAte)) {
        throw new DoseRecusadaError('dose-fora-da-janela')
      }

      dataset.registrosDeDose.splice(indice, 1)
    })
  },

  /**
   * O "Criar lembretes" do resumo da consulta, no app.
   *
   * Um tratamento por item, com o horário da primeira dose que a pessoa escolheu. Criar de novo
   * devolve o que já existe — dois lembretes para o mesmo item seriam dois avisos para a mesma
   * dose.
   */
  criarLembretes(input: {
    encounterId: string
    itens: Array<{ prescricaoId: string; primeiraDoseEm: ISODateTime }>
    cuidadorId: string
    compartilharComAClinica: boolean
  }): Promise<TratamentoEmCasa[]> {
    return simularChamada('tratamento.registrar', () => {
      const dataset = getDataset()
      const encounter = dataset.encounters.find((item) => item.id === input.encounterId)

      if (!encounter || !encounter.resumoLiberadoEm) {
        throw new Error(`tratamento.criarLembretes: ${input.encounterId} não foi liberado`)
      }

      if (!editaOPet(dataset, input.cuidadorId, encounter.petId)) {
        throw new DoseRecusadaError('somente-leitura')
      }

      const agora = agoraIso()

      return input.itens.flatMap((item) => {
        const existente = dataset.tratamentos.find(
          (tratamento) => tratamento.prescricaoId === item.prescricaoId,
        )

        if (existente) {
          return [existente]
        }

        const prescricao = encounter.conduta.prescricoes.find(
          (candidata) => candidata.id === item.prescricaoId,
        )

        if (!prescricao) {
          return []
        }

        const criado = tratamentoDaPrescricao(encounter, prescricao, {
          id: novoId('trat'),
          inicioEm: item.primeiraDoseEm,
          lembreteCriadoEm: agora,
          lembreteCriadoPor: input.cuidadorId,
          compartilhadoComAClinica: input.compartilharComAClinica,
        })

        dataset.tratamentos.push(criado)

        return [criado]
      })
    })
  },

  /** O dono muda o que a clínica vê. O lembrete continua; a janela da clínica abre ou fecha. */
  alterarCompartilhamento(input: {
    tratamentoId: string
    compartilhado: boolean
    cuidadorId: string
  }): Promise<TratamentoEmCasa> {
    return simularChamada('tratamento.registrar', () => {
      const dataset = getDataset()
      const tratamento = tratamentoOuFalha(dataset, input.tratamentoId)
      const cuidador = dataset.cuidadores.find((item) => item.id === input.cuidadorId)

      if (cuidador?.papel !== 'dono' || cuidador.tutorId !== tratamento.tutorId) {
        throw new DoseRecusadaError('somente-leitura')
      }

      tratamento.compartilhadoComAClinica = input.compartilhado

      return tratamento
    })
  },

  /** O vet decide se o tratamento é crítico — na receita ou depois, na ficha. */
  marcarCritico(tratamentoId: string, critico: boolean): Promise<TratamentoEmCasa> {
    return simularChamada('encounter.salvar', () => {
      const tratamento = tratamentoOuFalha(getDataset(), tratamentoId)

      tratamento.critico = critico

      return tratamento
    })
  },

  /**
   * A clínica falou com a casa. Apaga o alerta até a próxima dose que não aparecer como dada —
   * o assunto passou a estar com alguém.
   */
  registrarContato(input: {
    tratamentoId: string
    professionalId: string
    nota: string
  }): Promise<TratamentoEmCasa> {
    return simularChamada('encounter.salvar', () => {
      const tratamento = tratamentoOuFalha(getDataset(), input.tratamentoId)

      tratamento.contato = {
        em: agoraIso(),
        professionalId: input.professionalId,
        nota: input.nota.trim(),
      }

      return tratamento
    })
  },
}
