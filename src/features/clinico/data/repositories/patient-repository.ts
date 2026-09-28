/**
 * Repositório de pacientes e responsáveis.
 *
 * A busca é a mesma que a recepção faz no balcão: nome do paciente **ou** nome/telefone de
 * quem responde por ele. Acento não pode ser barreira — quem digita "acai" precisa achar
 * "Açaí".
 */

import { historicoDeAtos } from '../../domain/atos'
import { resumirFaltas } from '../../domain/load'
import { addDays, createClinicClock, diffDays } from '../../domain/clinic-time'
import type { DiarioParaClinica } from '../../contrato/responsavel'
import { JANELA_DO_PESO_DIAS, type ConsultaDoResumo } from '../../domain/resumo-do-paciente'
import { CLINIC_UTC_OFFSET } from '../fixtures'
import { simularChamada } from '../mock-runtime'
import { getDataset, novoId } from '../store'
import { vacinasFixture } from '../fixtures/vacinas'
import type {
  AlertSeverity,
  Appointment,
  AtoClinico,
  AtoClinicoKind,
  PrescriptionRoute,
  ContatoPreferido,
  EnderecoPostal,
  ISODate,
  ISODateTime,
  NoShowSummary,
  Pet,
  PetAlertKind,
  PetPorte,
  PetSex,
  PetSpecies,
  Tutor,
} from '../types'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

export const LIMITE_REINCIDENCIA = 3

/**
 * Uma falta, com o que aconteceu depois dela.
 *
 * O agregado (NoShowSummary) dimensiona o problema; isto aqui é o que permite decidir.
 */
export type FaltaDetalhada = {
  appointment: Appointment
  pet: Pet | null
  minutosPerdidos: number
  /** Instante do atendimento que substituiu esta falta, quando houve. */
  reagendadoPara: ISODateTime | null
  reagendadoId: string | null
}

/** Duas letras para o avatar: primeira do nome e primeira do segundo termo, quando existe. */
function iniciaisDe(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const primeira = partes[0]?.[0] ?? '?'
  const segunda = partes[1]?.[0] ?? partes[0]?.[1] ?? ''

  return (primeira + segunda).toUpperCase()
}

function normalizar(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

export type PacienteResumo = {
  pet: Pet
  tutor: Tutor | null
  ultimoAtendimentoEm: string | null
  proximoAtendimentoEm: string | null
  atendimentosNoAno: number
}

export const patientRepository = {
  buscar(termo: string, limite = 50): Promise<PacienteResumo[]> {
    return simularChamada('paciente.listar', () => {
      const alvo = normalizar(termo)
      const dataset = getDataset()
      const agora = clock.nowIso()

      return getDataset().pets
        .map((pet) => {
          const tutor = getDataset().tutores.find((item) => item.id === pet.tutorId) ?? null
          const doPet = dataset.appointments.filter(
            (appointment) => appointment.petId === pet.id && appointment.status !== 'cancelado',
          )

          const passados = doPet
            .filter((appointment) => appointment.fim < agora)
            .sort((a, b) => b.inicio.localeCompare(a.inicio))
          const futuros = doPet
            .filter((appointment) => appointment.inicio >= agora)
            .sort((a, b) => a.inicio.localeCompare(b.inicio))

          return {
            pet,
            tutor,
            ultimoAtendimentoEm: passados[0]?.inicio ?? null,
            proximoAtendimentoEm: futuros[0]?.inicio ?? null,
            atendimentosNoAno: doPet.filter(
              (appointment) => appointment.inicio.slice(0, 4) === agora.slice(0, 4),
            ).length,
          }
        })
        .filter(({ pet, tutor }) => {
          if (!alvo) {
            return true
          }

          /*
           * Os dígitos do termo, quando há algum.
           *
           * A comparação por telefone era `telefone.replace(/\D/g, '').includes(alvo.replace(...))`
           * sem esta guarda — e um termo **sem nenhum dígito** vira string vazia, que qualquer
           * texto contém. O resultado é que buscar "Rita" ou "zzzz" devolvia o cadastro inteiro
           * pelo casamento de telefone com nada: a busca parecia funcionar (a lista sempre tinha
           * o paciente procurado, em algum lugar) e nunca filtrava.
           */
          const digitos = alvo.replace(/\D/g, '')

          return (
            normalizar(pet.nome).includes(alvo) ||
            normalizar(pet.raca).includes(alvo) ||
            normalizar(tutor?.nome ?? '').includes(alvo) ||
            (digitos.length > 0 &&
              (tutor?.telefone ?? '').replace(/\D/g, '').includes(digitos))
          )
        })
        .sort((a, b) => a.pet.nome.localeCompare(b.pet.nome, 'pt-BR'))
        .slice(0, limite)
    })
  },

  obter(petId: string): Promise<{ pet: Pet; tutor: Tutor | null } | null> {
    return simularChamada('paciente.listar', () => {
      const pet = getDataset().pets.find((item) => item.id === petId)

      if (!pet) {
        return null
      }

      return { pet, tutor: getDataset().tutores.find((item) => item.id === pet.tutorId) ?? null }
    })
  },

  atendimentosDoPet(petId: string): Promise<Appointment[]> {
    return simularChamada('paciente.historico', () =>
      getDataset()
        .appointments.filter((appointment) => appointment.petId === petId)
        .sort((a, b) => b.inicio.localeCompare(a.inicio)),
    )
  },

  /**
   * O que o resumo "Este pet em 30 segundos" precisa, numa chamada só.
   *
   * O resumo é lido na porta da sala, com o paciente esperando: três chamadas em sequência
   * seriam três esperas. A montagem em si (o que é sinal, o que é tendência) é do domínio —
   * aqui só se junta o que existe e se resolve o fim de cada receita.
   *
   * `atendimentoDeHoje` é o horário ainda aberto do paciente no dia: é ele que o botão "abrir o
   * atendimento" abre. Nulo quando o paciente não está na agenda de hoje.
   *
   * O diário vem como a API vai entregá-lo (`GET /parceiro/portal/pacientes/:petId/diario`, no
   * contrato): **só com o consentimento do responsável**, a nota pessoal só se ele a liberou, e o
   * peso de casa só se liberou o peso. Sem consentimento, `diario` é `null` — e o resumo diz
   * "não liberou" em vez de parecer vazio. A janela cobre os seis meses do gráfico de peso; o
   * recorte "desde a última consulta" é do domínio.
   */
  paraOResumo(petId: string): Promise<{
    consultas: ConsultaDoResumo[]
    diario: DiarioParaClinica | null
    atendimentoDeHoje: Appointment | null
    agora: ISODateTime
  }> {
    return simularChamada('paciente.historico', () => {
      const dataset = getDataset()
      const agora = clock.nowIso()
      const porAppointment = new Map(dataset.appointments.map((item) => [item.id, item]))

      const consultas = dataset.encounters
        .filter((encounter) => encounter.petId === petId && encounter.status === 'finalizado')
        .map((encounter): ConsultaDoResumo => {
          const em = encounter.finalizadoEm ?? encounter.abertoEm
          /* O último dia de tratamento inteiro: receita de 14 dias termina à noite do 14º. */
          const fimDoDia = (dias: number) =>
            clock.toIso(addDays(clock.dateOf(em), dias), 23 * 60 + 59)

          return {
            encounterId: encounter.id,
            appointmentId: encounter.appointmentId,
            em,
            typeId: porAppointment.get(encounter.appointmentId)?.typeId ?? '',
            professionalId: encounter.professionalId,
            diagnosticos: encounter.diagnosticos,
            pesoKg: encounter.exameFisico.vitais.peso?.valor ?? null,
            prescricoes: encounter.conduta.prescricoes.map((prescricao) => ({
              medicamentoId: prescricao.medicamentoId,
              /* Sem duração é receita contínua: não tem último dia. */
              ate:
                prescricao.calculo.duracaoDias === null
                  ? null
                  : fimDoDia(prescricao.calculo.duracaoDias),
            })),
          }
        })

      const hoje = clock.today()
      const atendimentoDeHoje =
        dataset.appointments
          .filter(
            (appointment) =>
              appointment.petId === petId &&
              clock.dateOf(appointment.inicio) >= hoje &&
              !['cancelado', 'falta', 'finalizado'].includes(appointment.status),
          )
          .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))
          .find((appointment) => clock.dateOf(appointment.inicio) === dataset.ancora) ?? null

      const tutorId = dataset.pets.find((pet) => pet.id === petId)?.tutorId
      const consentimento = dataset.consentimentos.find((item) => item.tutorId === tutorId)
      const desde = clock.toIso(addDays(hoje, -JANELA_DO_PESO_DIAS), 0)
      const naJanela = (data: string) => Date.parse(data) >= Date.parse(desde)

      const diario: DiarioParaClinica | null = consentimento?.diarioCompleto
        ? {
            petId,
            desde,
            entradas: dataset.diario
              .filter((registro) => registro.petId === petId && naJanela(registro.data))
              .map(({ petId: _pet, ...registro }) => ({
                ...registro,
                nota: consentimento.notas ? registro.nota : null,
              })),
            pesos: consentimento.peso
              ? dataset.pesagensDeCasa
                  .filter((pesagem) => pesagem.petId === petId && naJanela(pesagem.data))
                  .map(({ petId: _pet, ...pesagem }) => pesagem)
              : [],
          }
        : null

      return {
        consultas,
        diario,
        atendimentoDeHoje,
        agora,
      }
    })
  },

  /** Painel de faltas: quantas **e quanto** — minutos de agenda parados. */
  resumoDeFaltas(): Promise<Array<NoShowSummary & { pet: Pet | null; tutor: Tutor | null }>> {
    return simularChamada('paciente.listar', () =>
      resumirFaltas(getDataset().appointments, clock, LIMITE_REINCIDENCIA).map((resumo) => ({
        ...resumo,
        pet: getDataset().pets.find((item) => item.id === resumo.petId) ?? null,
        tutor: getDataset().tutores.find((item) => item.id === resumo.tutorId) ?? null,
      })),
    )
  },

  /**
   * As faltas em si de um responsável, não o agregado.
   *
   * O painel mostra "3 faltas, 90 minutos perdidos" — e isso basta para dimensionar o problema,
   * mas não para decidir o que fazer. Três faltas em três anos e três faltas no mês são
   * situações diferentes, e só a lista separa as duas.
   *
   * Cada linha carrega se o horário **foi reagendado depois**: falta que virou consulta na
   * semana seguinte não é o mesmo caso de falta que nunca voltou, e cobrar as duas igual é como
   * a política de reincidência perde a confiança de quem a aplica.
   */
  faltasDoResponsavel(tutorId: string): Promise<FaltaDetalhada[]> {
    return simularChamada('paciente.historico', () => {
      const dataset = getDataset()
      const faltas = dataset.appointments
        .filter(
          (appointment) => appointment.tutorId === tutorId && appointment.status === 'falta',
        )
        .sort((a, b) => b.inicio.localeCompare(a.inicio))

      return faltas.map((falta) => {
        /*
         * Reagendado = existe atendimento do mesmo paciente, depois desta falta, criado
         * **após** ela ter acontecido. A janela de 60 dias evita chamar de reagendamento a
         * consulta de rotina que já estava marcada meses à frente.
         */
        const limite = clock.dateOf(falta.inicio)
        const reagendado =
          dataset.appointments.find(
            (candidato) =>
              candidato.id !== falta.id &&
              candidato.petId === falta.petId &&
              candidato.status !== 'cancelado' &&
              candidato.inicio > falta.inicio &&
              candidato.criadoEm >= falta.inicio &&
              diffDays(limite, clock.dateOf(candidato.inicio)) <= 60,
          ) ?? null

        return {
          appointment: falta,
          pet: dataset.pets.find((item) => item.id === falta.petId) ?? null,
          minutosPerdidos: clock.durationMinutes(falta.inicio, falta.fim),
          reagendadoPara: reagendado?.inicio ?? null,
          reagendadoId: reagendado?.id ?? null,
        }
      })
    })
  },

  /*
   * Cópia, não a array do dataset.
   *
   * Devolvendo a array viva, cadastrar um paciente mutava em lugar: a store reatribuía a **mesma
   * referência**, o Vue não via mudança nenhuma, e o paciente recém-criado não aparecia na lista
   * do agendamento. De quebra, quem recebia a array podia alterar o dataset sem passar por aqui.
   */
  todosOsPets(): Pet[] {
    return [...getDataset().pets]
  },

  todosOsTutores(): Tutor[] {
    return [...getDataset().tutores]
  },

  /**
   * Tudo o que este paciente recebeu, do mais recente para o mais antigo.
   *
   * Junta três registros que nunca se encontravam — a carteira de vacinas, o checklist da
   * internação e os atos gravados na consulta — e é por isso que existe: "este animal já tomou
   * isso?" é a pergunta que se faz antes de prescrever e depois de uma reação adversa, e até
   * aqui ela não tinha tela.
   *
   * A junção é de leitura, e não uma quarta tabela. Ver `domain/atos.ts`.
   */
  historicoDeAtos(petId: string): Promise<AtoClinico[]> {
    return simularChamada('paciente.historico', () => {
      const dataset = getDataset()

      return historicoDeAtos({
        petId,
        atos: dataset.atos,
        aplicacoes: dataset.aplicacoesDeVacina,
        vacinas: vacinasFixture,
        administracoes: dataset.internacao.administracoes,
        prescricoes: dataset.internacao.prescricoes,
        internacoes: dataset.internacao.internacoes,
      })
    })
  },

  /**
   * Grava um procedimento realizado ou uma medicação aplicada.
   *
   * Só isto se grava: vacina e dose de internação já têm registro próprio e entram derivadas.
   * Uma porta que aceitasse gravá-las aqui produziria a segunda cópia que `domain/atos.ts`
   * existe para evitar.
   *
   * `realizadoEm` vem de fora e não do relógio: o ato quase sempre é lançado depois de
   * acontecer — no fim da consulta, ou semanas depois, quando o responsável conta uma castração
   * feita em outro serviço. Carimbar a hora do lançamento seria gravar quando alguém digitou,
   * que é a única hora que ninguém vai querer saber.
   */
  registrarAto(input: {
    petId: string
    kind: AtoClinicoKind
    medicamentoId: string | null
    descricao: string
    via: PrescriptionRoute | null
    doseTexto: string
    realizadoEm: ISODateTime
    /** Vazio quando a clínica não presenciou — o ato nasce `avulso`. */
    professionalId: string
    encounterId: string | null
    observacao: string
  }): Promise<AtoClinico> {
    return simularChamada('paciente.historico', () => {
      const dataset = getDataset()

      if (!dataset.pets.some((pet) => pet.id === input.petId)) {
        throw new Error(`paciente.registrarAto: ${input.petId} não existe`)
      }

      if (!input.descricao.trim()) {
        throw new Error('paciente.registrarAto: ato sem descrição')
      }

      const ato: AtoClinico = {
        id: novoId('ato'),
        petId: input.petId,
        kind: input.kind,
        /*
         * Quem executou define a origem: sem profissional, a clínica não viu acontecer.
         *
         * `clinica` e não `consulta` porque o ato pode ter acontecido sem consulta aberta — o
         * curativo do balcão é feito por alguém da equipe e não pertence a atendimento nenhum.
         * O elo com o prontuário, quando existe, é `encounterId`; a origem diz apenas quem fez.
         */
        origem: input.professionalId ? 'clinica' : 'avulso',
        encounterId: input.encounterId,
        internacaoId: null,
        medicamentoId: input.kind === 'medicamento' ? input.medicamentoId : null,
        descricao: input.descricao.trim(),
        via: input.via,
        doseTexto: input.doseTexto.trim(),
        realizadoEm: input.realizadoEm,
        professionalId: input.professionalId,
        observacao: input.observacao.trim(),
      }

      dataset.atos.push(ato)

      return ato
    })
  },

  /**
   * Cadastro de paciente — o de balcão e o completo, pelo mesmo caminho.
   *
   * Aceita responsável existente ou novo. Quem liga para marcar costuma ser cliente antigo com
   * bicho novo, e obrigar a recadastrar a pessoa criaria um segundo cadastro com o mesmo
   * telefone — o defeito que parte o histórico em dois e faz a falta não somar.
   *
   * **O exigido é o mesmo nos dois modos**: nome do paciente e alguém por quem chamar. O que
   * muda é quanto a tela pergunta. Nascimento, peso, porte, microchip, pelagem, alerta e
   * endereço entram quando existem; campo em branco aqui é resposta honesta, e não um dado que
   * a recepção inventou para vencer um asterisco.
   *
   * O alerta chega sem `id` de propósito: quem cadastra descreve a alergia, não numera linha de
   * banco. O identificador nasce aqui, junto do paciente.
   */
  criarPaciente(input: {
    nome: string
    especie: PetSpecies
    raca: string
    sexo: PetSex
    nascimento: ISODate | null
    pesoKg: number | null
    porte: PetPorte | null
    castrado: boolean
    microchip: string
    pelagem: string
    alertas: Array<{ kind: PetAlertKind; severidade: AlertSeverity; detalhe: string }>
    tutorId: string | null
    novoTutor: {
      nome: string
      telefone: string
      telefoneSecundario: string
      documento: string
      email: string
      preferenciaContato: ContatoPreferido
      endereco: EnderecoPostal | null
    } | null
  }): Promise<{ pet: Pet; tutor: Tutor }> {
    return simularChamada('paciente.listar', () => {
      const dataset = getDataset()

      const existente = input.tutorId
        ? dataset.tutores.find((item) => item.id === input.tutorId)
        : undefined

      /*
       * Paciente sem responsável é paciente que ninguém consegue avisar — e o módulo inteiro
       * (confirmação, fila, boletim de internação) parte do princípio de que há para quem ligar.
       * Recusar aqui evita que uma tela futura crie o órfão que só aparece na hora da alta.
       */
      if (!existente && !input.novoTutor) {
        throw new Error('paciente.criar: sem responsável existente nem novo')
      }

      const responsavel: Tutor = existente ?? {
        id: novoId('tutor'),
        nome: input.novoTutor!.nome.trim(),
        telefone: input.novoTutor!.telefone.trim(),
        telefoneSecundario: input.novoTutor!.telefoneSecundario.trim(),
        email: input.novoTutor!.email.trim(),
        documento: input.novoTutor!.documento.trim(),
        preferenciaContato: input.novoTutor!.preferenciaContato,
        endereco: input.novoTutor!.endereco,
      }

      if (!existente) {
        dataset.tutores.push(responsavel)
      }

      const pet: Pet = {
        id: novoId('pet'),
        nome: input.nome.trim(),
        especie: input.especie,
        raca: input.raca.trim(),
        sexo: input.sexo,
        nascimento: input.nascimento,
        castrado: input.castrado,
        /* Sem porte informado, a estimativa por peso cobre — e se anuncia como palpite. */
        porte: input.porte,
        pesoKg: input.pesoKg,
        microchip: input.microchip.replace(/\D/g, ''),
        pelagem: input.pelagem.trim(),
        tutorId: responsavel.id,
        alertas: input.alertas
          .filter((alerta) => alerta.kind)
          .map((alerta) => ({
            id: novoId('alerta'),
            kind: alerta.kind,
            severidade: alerta.severidade,
            detalhe: alerta.detalhe.trim(),
          })),
        iniciais: iniciaisDe(input.nome),
        fotoUrl: '',
      }

      dataset.pets.push(pet)

      return { pet, tutor: responsavel }
    })
  },
}
