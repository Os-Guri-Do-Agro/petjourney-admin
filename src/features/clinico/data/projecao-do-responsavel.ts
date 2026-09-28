/**
 * O dataset do portal visto pelo responsável, na forma do contrato.
 *
 * É o que a API vai fazer do lado de lá: pegar o que a clínica registrou — no vocabulário da
 * clínica, com mg/kg, código de diagnóstico e boletim retido — e entregar ao app só o que é do
 * responsável, no vocabulário do contrato (`contrato/responsavel.ts`). Aqui ela serve a duas
 * coisas:
 *
 * - **Gerar os dados de demonstração do app** (`npm run contrato:demo`), para que o mock do app
 *   e o do portal contem a mesma história com os mesmos números.
 * - **Ser a referência da projeção** para quem for escrever a API: cada decisão de "o que não
 *   chega ao responsável" está escrita aqui, em código que roda e que o teste confere.
 *
 * O que fica de fora, de propósito: boletim retido (e a contagem deles), diagnóstico
 * diferencial, exame físico, mg/kg, prioridade da fila, observação interna da clínica.
 */

import type {
  Agendamento,
  BoletimDaInternacao,
  CanalDeJustificativa,
  ClinicaDoResponsavel,
  ClinicaResumo,
  DadosDaNotificacaoClinica,
  DataHoraIso,
  DataIso,
  DocumentoClinico,
  EntradaNaFila,
  FracaoDeDose,
  HorarioLivre,
  InternacaoNaClinica,
  ItemDaReceita,
  MotivoDeCancelamento,
  MotivoDeFalta as MotivoDeFaltaNoContrato,
  OrigemDeAgendamento,
  PetResumo,
  PreConsulta as PreConsultaNoContrato,
  ProfissionalResumo,
  RespostaDaPreConsulta,
  ResumoDoAtendimento,
  ServicoAgendavel,
  SituacaoDoReforco as SituacaoNoContrato,
  StatusDeAgendamento,
  StatusDeInternacao,
  StatusNaFila,
  TipoDeConsulta,
  TipoDeDocumentoClinico,
  TipoDeServicoClinico,
  VacinaAplicadaNaClinica,
  ViaDeAdministracao,
} from '../contrato/responsavel'
import { TEXTOS_PT_DAS_NOTIFICACOES, urlDaNotificacaoClinica } from '../contrato/responsavel'
import {
  addDays,
  createClinicClock,
  epochToWall,
  wallToIso,
  weekdayOf,
} from '../domain/clinic-time'
import { materializarBloqueios } from '../domain/conflicts'
import { CAPACIDADE_MINUTOS_POR_PROFISSIONAL } from '../domain/load'
import {
  cancelarAte,
  janelaDaPreConsulta,
  podeCancelarPeloApp,
  podeConfirmarPresenca,
  situacaoDaPreConsulta,
} from '../domain/politica'
import {
  fracionar,
  gerarCodigoVerificador,
  VALIDADE_EM_DIAS,
  type Fracionamento,
} from '../domain/receita'
import { slotsLivres } from '../domain/slots'
import { JANELA_DE_AVISO_EM_DIAS, situacaoDoReforco } from '../domain/vacinacao'
import { posicoesDaFila } from '../domain/waitlist'

import {
  appointmentTypesFixture,
  CLINIC_UTC_OFFSET,
  examCatalogFixture,
  medicationsFixture,
  professionalsFixture,
  roomsFixture,
  vacinasFixture,
} from './fixtures'
import type { SeedResult } from './seed'
import type {
  AplicacaoVacina,
  Appointment,
  AppointmentOrigin,
  AppointmentStatus,
  AppointmentTypeKind,
  BoletimAoTutor,
  CanalDeContato,
  CancelReason,
  Encounter,
  ISODateTime,
  Internacao,
  MotivoDeFalta,
  PreConsulta,
  PrescriptionRoute,
  SituacaoDoReforco,
  WaitlistEntry,
  WaitlistStatus,
} from './types'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

/** `iso` mais tantos minutos, na parede da clínica — atravessa a meia-noite sem quebrar. */
function somarMinutos(iso: ISODateTime, minutos: number): ISODateTime {
  return wallToIso(
    epochToWall(Date.parse(iso) + minutos * 60_000, clock.utcOffset),
    clock.utcOffset,
  )
}

// ---------------------------------------------------------------------------
// De um vocabulário para o outro
// ---------------------------------------------------------------------------

const STATUS: Record<AppointmentStatus, StatusDeAgendamento> = {
  agendado: 'AGENDADO',
  confirmado: 'CONFIRMADO',
  aguardando: 'AGUARDANDO',
  'em-atendimento': 'EM_ATENDIMENTO',
  finalizado: 'FINALIZADO',
  falta: 'FALTA',
  cancelado: 'CANCELADO',
}

const ORIGEM: Record<AppointmentOrigin, OrigemDeAgendamento> = {
  recepcao: 'RECEPCAO',
  app: 'APP',
  telefone: 'TELEFONE',
  encaixe: 'ENCAIXE',
  retorno: 'RETORNO',
  fila: 'FILA',
}

const SERVICO: Record<AppointmentTypeKind, TipoDeServicoClinico> = {
  consulta: 'CONSULTA',
  retorno: 'RETORNO',
  vacina: 'VACINA',
  exame: 'EXAME',
  cirurgia: 'CIRURGIA',
  banho: 'BANHO',
  emergencia: 'EMERGENCIA',
}

/** Banho não é consulta; o atendimento de banho não vira `Consulta` — cai no mais próximo. */
const CONSULTA: Record<AppointmentTypeKind, TipoDeConsulta> = {
  consulta: 'CONSULTA',
  retorno: 'RETORNO',
  vacina: 'VACINA',
  exame: 'EXAME',
  cirurgia: 'CIRURGIA',
  banho: 'CONSULTA',
  emergencia: 'EMERGENCIA',
}

const CANCELAMENTO: Record<CancelReason, MotivoDeCancelamento> = {
  'responsavel-desmarcou': 'RESPONSAVEL_DESMARCOU',
  'clinica-remarcou': 'CLINICA_REMARCOU',
  'paciente-indisponivel': 'PACIENTE_INDISPONIVEL',
  duplicado: 'DUPLICADO',
  outro: 'OUTRO',
}

const FALTA: Record<MotivoDeFalta, MotivoDeFaltaNoContrato> = {
  esqueceu: 'ESQUECEU',
  imprevisto: 'IMPREVISTO',
  transporte: 'TRANSPORTE',
  'paciente-melhorou': 'PACIENTE_MELHOROU',
  emergencia: 'EMERGENCIA',
  custo: 'CUSTO',
  insatisfacao: 'INSATISFACAO',
  obito: 'OBITO',
  outro: 'OUTRO',
}

const CANAL: Record<CanalDeContato, CanalDeJustificativa> = {
  telefone: 'TELEFONE',
  whatsapp: 'WHATSAPP',
  presencial: 'PRESENCIAL',
  'sem-resposta': 'SEM_RESPOSTA',
  app: 'APP',
}

const FILA: Record<WaitlistStatus, StatusNaFila> = {
  aguardando: 'AGUARDANDO',
  ofertado: 'OFERTADO',
  aceito: 'ACEITO',
  expirado: 'EXPIRADO',
  removido: 'REMOVIDO',
}

const VIA: Record<PrescriptionRoute, ViaDeAdministracao> = {
  oral: 'ORAL',
  subcutanea: 'SUBCUTANEA',
  intramuscular: 'INTRAMUSCULAR',
  intravenosa: 'INTRAVENOSA',
  topica: 'TOPICA',
  otologica: 'OTOLOGICA',
}

const FRACAO: Record<Fracionamento['kind'], FracaoDeDose> = {
  inteiro: 'INTEIRO',
  meio: 'MEIO',
  'um-e-meio': 'UM_E_MEIO',
  quarto: 'QUARTO',
  'tres-quartos': 'TRES_QUARTOS',
  multiplo: 'MULTIPLO',
  aproximado: 'APROXIMADO',
}

const SITUACAO: Record<SituacaoDoReforco, SituacaoNoContrato> = {
  'em-dia': 'EM_DIA',
  proximo: 'PROXIMO',
  vencido: 'VENCIDO',
  'serie-incompleta': 'SERIE_INCOMPLETA',
}

const INTERNACAO: Record<Internacao['status'], StatusDeInternacao> = {
  internado: 'INTERNADO',
  alta: 'ALTA',
  obito: 'OBITO',
  transferido: 'TRANSFERIDO',
}

// ---------------------------------------------------------------------------
// Contexto
// ---------------------------------------------------------------------------

/** O texto em português que a projeção precisa e que mora nos catálogos de idioma do portal. */
export type TextosDaProjecao = {
  /** Sufixo do diagnóstico presuntivo: "Gastroenterite aguda (em investigação)". */
  emInvestigacao: string
  sinaisDeAlerta: string
  tituloDoDocumento: Record<'RECEITUARIO' | 'ORIENTACOES' | 'PEDIDO_EXAME', string>
}

export type ContextoDaProjecao = {
  dataset: SeedResult
  tutorId: string
  agora: ISODateTime
  textos: TextosDaProjecao
}

/**
 * Da chave do portal para a lista do app (`consultaForm.especialidades`). O que não está na lista
 * vai por extenso, no idioma da clínica — é a regra do contrato para `especialidade`.
 */
const ESPECIALIDADE: Record<string, string> = {
  clinicaGeral: 'CLINICO_GERAL',
  cirurgia: 'CIRURGIA',
  dermatologia: 'DERMATOLOGIA',
  cardiologia: 'CARDIOLOGIA',
  anestesiologia: 'Anestesiologia',
}

function profissional(id: string): ProfissionalResumo {
  const encontrado = professionalsFixture.find((item) => item.id === id)
  const especialidade = encontrado?.especialidade ?? ''

  return {
    id,
    nome: encontrado?.nome ?? '',
    especialidade: especialidade ? (ESPECIALIDADE[especialidade] ?? especialidade) : null,
    fotoUrl: null,
  }
}

function petResumo(ctx: ContextoDaProjecao, petId: string): PetResumo {
  return {
    id: petId,
    nome: ctx.dataset.pets.find((pet) => pet.id === petId)?.nome ?? '',
    fotoUrl: null,
  }
}

function clinicaResumo(ctx: ContextoDaProjecao): ClinicaResumo {
  const { clinic } = ctx.dataset

  return {
    id: clinic.id,
    nome: clinic.nome,
    telefone: clinic.telefone,
    utcOffset: clinic.utcOffset,
  }
}

function tipoDo(typeId: string) {
  return appointmentTypesFixture.find((item) => item.id === typeId) ?? appointmentTypesFixture[0]!
}

/** Tipos que o responsável marca sozinho. Cirurgia e emergência passam pela clínica. */
const AGENDAVEIS_PELO_APP: AppointmentTypeKind[] = [
  'consulta',
  'retorno',
  'vacina',
  'exame',
  'banho',
]
const COM_PRE_CONSULTA: AppointmentTypeKind[] = ['consulta', 'retorno', 'exame']

function servico(typeId: string): ServicoAgendavel {
  const tipo = tipoDo(typeId)

  return {
    id: tipo.id,
    nome: tipo.nome,
    tipo: SERVICO[tipo.kind],
    duracaoMinutos: tipo.duracaoMinutos,
    temPreConsulta: COM_PRE_CONSULTA.includes(tipo.kind),
  }
}

function petsDoResponsavel(ctx: ContextoDaProjecao): string[] {
  return ctx.dataset.pets.filter((pet) => pet.tutorId === ctx.tutorId).map((pet) => pet.id)
}

// ---------------------------------------------------------------------------
// Projeções
// ---------------------------------------------------------------------------

export function projetarClinica(ctx: ContextoDaProjecao): ClinicaDoResponsavel {
  const { clinic, politica, consentimentos, appointments } = ctx.dataset
  const meusPets = new Set(petsDoResponsavel(ctx))
  const consentimento = consentimentos.find((item) => item.tutorId === ctx.tutorId)

  return {
    ...clinicaResumo(ctx),
    fotoUrl: null,
    telefoneSecundario: null,
    enderecoResumo: clinic.endereco,
    aceitaAgendamentoPeloApp: true,
    politica: { ...politica },
    /* O vínculo nasce em qualquer contato com a clínica — a Pipoca entrou pela internação. */
    petIds: [
      ...new Set(
        [...appointments, ...ctx.dataset.internacao.internacoes, ...ctx.dataset.aplicacoesDeVacina]
          .map((item) => item.petId)
          .filter((petId) => meusPets.has(petId)),
      ),
    ],
    consentimento: {
      diarioCompleto: consentimento?.diarioCompleto ?? false,
      peso: consentimento?.peso ?? false,
      notas: consentimento?.notas ?? false,
      atualizadoEm: consentimento?.atualizadoEm ?? null,
    },
    podeAlterarConsentimento: true,
  }
}

export function projetarServicos(): ServicoAgendavel[] {
  return appointmentTypesFixture
    .filter((tipo) => AGENDAVEIS_PELO_APP.includes(tipo.kind))
    .map((tipo) => servico(tipo.id))
}

export function projetarAgendamento(
  appointment: Appointment,
  ctx: ContextoDaProjecao,
): Agendamento {
  const { politica, encounters } = ctx.dataset
  const encounter = encounters.find((item) => item.appointmentId === appointment.id) ?? null
  const temPreConsulta = COM_PRE_CONSULTA.includes(tipoDo(appointment.typeId).kind)
  const janela = janelaDaPreConsulta(appointment, politica, clock.utcOffset)
  const podeCancelar = podeCancelarPeloApp(appointment, politica, ctx.agora, clock.utcOffset)

  return {
    id: appointment.id,
    clinica: clinicaResumo(ctx),
    pet: petResumo(ctx, appointment.petId),
    servico: servico(appointment.typeId),
    profissional: profissional(appointment.professionalId),
    inicio: appointment.inicio,
    fim: appointment.fim,
    status: STATUS[appointment.status],
    origem: ORIGEM[appointment.origem],
    /* A observação da clínica é interna; só a que o responsável escreveu volta para ele. */
    observacao: appointment.origem === 'app' ? appointment.observacao : '',
    criadoEm: appointment.criadoEm,
    canceladoEm: appointment.canceladoEm,
    motivoCancelamento: appointment.motivoCancelamento
      ? CANCELAMENTO[appointment.motivoCancelamento]
      : null,
    podeConfirmar: podeConfirmarPresenca(appointment, ctx.agora),
    podeCancelar,
    podeRemarcar: podeCancelar,
    cancelarAte: cancelarAte(appointment, politica, clock.utcOffset),
    preConsulta: temPreConsulta
      ? {
          situacao: situacaoDaPreConsulta(
            appointment,
            encounter?.preConsulta ?? null,
            politica,
            ctx.agora,
            clock.utcOffset,
          ),
          abreEm: janela.abreEm,
          fechaEm: janela.fechaEm,
          respondidaEm: encounter?.preConsulta?.respondidoEm ?? null,
        }
      : null,
    falta:
      appointment.status === 'falta'
        ? {
            motivo: appointment.justificativaDeFalta
              ? FALTA[appointment.justificativaDeFalta.motivo]
              : null,
            canal: appointment.justificativaDeFalta
              ? CANAL[appointment.justificativaDeFalta.canal]
              : null,
          }
        : null,
    atendimentoId: encounter?.resumoLiberadoEm ? encounter.id : null,
  }
}

/**
 * A pré-consulta, com a sugestão montada do diário dos últimos três dias.
 *
 * A sugestão é o último valor de cada campo nesse período e os sintomas registrados nele — o
 * formulário abre preenchido, e o responsável confere em vez de digitar.
 */
export function projetarPreConsulta(
  appointment: Appointment,
  ctx: ContextoDaProjecao,
): PreConsultaNoContrato {
  const { politica, encounters, diario, pesagensDeCasa } = ctx.dataset
  const encounter = encounters.find((item) => item.appointmentId === appointment.id) ?? null
  const janela = janelaDaPreConsulta(appointment, politica, clock.utcOffset)
  const tresDiasAtras = Date.parse(ctx.agora) - 3 * 24 * 60 * 60 * 1000
  const recentes = diario
    .filter(
      (registro) =>
        registro.petId === appointment.petId &&
        Date.parse(registro.data) >= tresDiasAtras &&
        Date.parse(registro.data) <= Date.parse(ctx.agora),
    )
    .sort((a, b) => Date.parse(b.data) - Date.parse(a.data))
  const pesagem = pesagensDeCasa.find((item) => item.petId === appointment.petId) ?? null

  const primeiro = <K extends 'alimentacao' | 'hidratacao' | 'fezes' | 'urina' | 'vitalidade'>(
    campo: K,
  ) => recentes.find((registro) => registro[campo] !== null)?.[campo] ?? null

  const sugestao =
    recentes.length > 0 || pesagem
      ? {
          alimentacao: primeiro('alimentacao'),
          hidratacao: primeiro('hidratacao'),
          fezes: primeiro('fezes'),
          urina: primeiro('urina'),
          vitalidade: primeiro('vitalidade'),
          sintomas: [...new Set(recentes.flatMap((registro) => registro.sintomas))].slice(0, 5),
          pesoKg: pesagem?.pesoKg ?? null,
          pesadoEm: pesagem ? clock.dateOf(pesagem.data) : null,
        }
      : null

  const resposta = encounter?.preConsulta ?? null

  return {
    agendamentoId: appointment.id,
    situacao: situacaoDaPreConsulta(appointment, resposta, politica, ctx.agora, clock.utcOffset),
    abreEm: janela.abreEm,
    fechaEm: janela.fechaEm,
    respondidaEm: resposta?.respondidoEm ?? null,
    resposta: resposta ? respostaDoResponsavel(resposta) : null,
    sugestao,
  }
}

/** A resposta como o app a mandou, sem as chaves que só o portal guarda. */
function respostaDoResponsavel(preConsulta: PreConsulta): RespostaDaPreConsulta {
  return {
    motivo: preConsulta.motivo,
    queixaPrincipal: preConsulta.queixaPrincipal,
    sintomas: preConsulta.sintomas,
    desdeQuando: preConsulta.desdeQuando,
    evolucao: preConsulta.evolucao,
    alimentacao: preConsulta.alimentacao,
    hidratacao: preConsulta.hidratacao,
    fezes: preConsulta.fezes,
    urina: preConsulta.urina,
    vitalidade: preConsulta.vitalidade,
    pesoKg: preConsulta.pesoKg,
    pesadoEm: preConsulta.pesadoEm,
    observacao: preConsulta.observacao,
    fotoIds: preConsulta.fotoIds,
    camposDoDiario: preConsulta.camposDoDiario,
  }
}

export function projetarEntradaNaFila(
  entrada: WaitlistEntry,
  ctx: ContextoDaProjecao,
): EntradaNaFila {
  const posicoes = posicoesDaFila(ctx.dataset.waitlist)
  const tipo = tipoDo(entrada.typeId)
  const professionalDaOferta = entrada.ofertaProfessionalId ?? entrada.professionalId

  return {
    id: entrada.id,
    clinica: clinicaResumo(ctx),
    pet: petResumo(ctx, entrada.petId),
    servico: servico(entrada.typeId),
    profissional: entrada.professionalId ? profissional(entrada.professionalId) : null,
    janelas: entrada.janelas.map((janela) => ({
      diaDaSemana: janela.weekday,
      inicio: janela.inicio,
      fim: janela.fim,
    })),
    status: FILA[entrada.status],
    /* A prioridade não viaja: é triagem da clínica. Só a posição. */
    posicao: posicoes.get(entrada.id) ?? null,
    oferta:
      entrada.status === 'ofertado' && entrada.ofertaSlotInicio && entrada.ofertaExpiraEm
        ? {
            inicio: entrada.ofertaSlotInicio,
            fim: somarMinutos(entrada.ofertaSlotInicio, tipo.duracaoMinutos),
            profissional: profissional(professionalDaOferta ?? ''),
            expiraEm: entrada.ofertaExpiraEm,
          }
        : null,
    observacao: entrada.observacao,
    criadoEm: entrada.criadoEm,
    agendamentoId: entrada.appointmentId ?? null,
  }
}

/** A receita humanizada: quanto dar, de quanto em quanto tempo, por quanto tempo. Sem mg/kg. */
function itensDaReceita(encounter: Encounter): ItemDaReceita[] {
  return encounter.conduta.prescricoes.map((prescricao) => {
    const medicamento = medicationsFixture.find((item) => item.id === prescricao.medicamentoId)
    const unidade = medicamento?.unidadeApresentacao ?? 'comprimido'
    const fracao = fracionar(prescricao.calculo.quantidadeApresentacao, unidade)
    const item: ItemDaReceita = {
      id: prescricao.id,
      medicamento: medicamento?.nome ?? prescricao.medicamentoId,
      quantidade:
        fracao?.quantidade ?? Math.round(prescricao.calculo.quantidadeApresentacao * 100) / 100,
      unidade: unidade === 'ml' ? 'ML' : 'COMPRIMIDO',
      fracao: fracao ? FRACAO[fracao.kind] : null,
      frequenciaHoras: prescricao.calculo.frequenciaHoras,
      via: VIA[prescricao.via],
      instrucoes: prescricao.observacao,
    }

    /* Contínuo é a **ausência** da chave, como no DTO da API — nunca \`null\`, nunca 365. */
    if (prescricao.calculo.duracaoDias !== null) {
      item.duracaoDias = prescricao.calculo.duracaoDias
    }

    return item
  })
}

export function projetarAtendimento(
  encounter: Encounter,
  ctx: ContextoDaProjecao,
): ResumoDoAtendimento {
  const appointment = ctx.dataset.appointments.find((item) => item.id === encounter.appointmentId)
  const tipo = tipoDo(appointment?.typeId ?? 'tipo-consulta')
  const realizadoEm = encounter.finalizadoEm ?? encounter.abertoEm
  const dataDoAtendimento = clock.dateOf(realizadoEm)
  const itens = itensDaReceita(encounter)
  const exames = encounter.conduta.examesSolicitados.map((id) => {
    const exame = examCatalogFixture.find((item) => item.id === id)

    return { nome: exame?.nome ?? id, jejum: exame?.grupo === 'laboratorio', observacao: '' }
  })

  const codigo = gerarCodigoVerificador(
    `${encounter.id}|${encounter.petId}|${encounter.conduta.prescricoes.map((item) => item.medicamentoId).join(',')}`,
  )

  const documento = (
    tipoDoDocumento: 'RECEITUARIO' | 'ORIENTACOES' | 'PEDIDO_EXAME',
  ): DocumentoClinico => ({
    id: `doc-${encounter.id}-${tipoDoDocumento.toLowerCase()}`,
    tipo: tipoDoDocumento satisfies TipoDeDocumentoClinico,
    titulo: ctx.textos.tituloDoDocumento[tipoDoDocumento],
    emitidoEm: realizadoEm,
    codigoVerificador: tipoDoDocumento === 'RECEITUARIO' ? codigo : null,
    url: `mock://documentos/${encounter.id}/${tipoDoDocumento.toLowerCase()}.pdf`,
    urlExpiraEm: somarMinutos(ctx.agora, 15),
    exigeAssinaturaDoResponsavel: false,
    assinadoPeloResponsavelEm: null,
    documentoDoPetId: null,
  })

  const documentos: DocumentoClinico[] = [
    ...(itens.length > 0 ? [documento('RECEITUARIO')] : []),
    ...(itens.length > 0 || encounter.conduta.orientacoes ? [documento('ORIENTACOES')] : []),
    ...(exames.length > 0 ? [documento('PEDIDO_EXAME')] : []),
  ]

  const { retorno } = encounter.conduta

  return {
    id: encounter.id,
    agendamentoId: encounter.appointmentId,
    consultaId: `consulta-${encounter.id}`,
    tipoDeConsulta: CONSULTA[tipo.kind],
    clinica: clinicaResumo(ctx),
    profissional: profissional(encounter.professionalId),
    pet: petResumo(ctx, encounter.petId),
    realizadoEm,
    idioma: 'pt-BR',
    motivo: encounter.anamnese.queixaPrincipal,
    /* Diferencial não chega: é hipótese de trabalho do vet, não informação para casa. */
    diagnostico: encounter.diagnosticos
      .filter((item) => item.kind !== 'diferencial')
      .map((item) =>
        item.kind === 'presuntivo'
          ? `${item.descricao} (${ctx.textos.emInvestigacao})`
          : item.descricao,
      )
      .join('; '),
    orientacoes: encounter.conduta.orientacoes,
    sinaisDeAlerta: ctx.textos.sinaisDeAlerta,
    pesoAferidoKg: encounter.exameFisico.vitais.peso?.valor ?? null,
    receita:
      itens.length > 0
        ? {
            id: `rec-${encounter.id}`,
            codigoVerificador: codigo,
            emitidaEm: realizadoEm,
            validaAte: addDays(dataDoAtendimento, VALIDADE_EM_DIAS),
            controlada: encounter.conduta.prescricoes.some(
              (item) => medicationsFixture.find((med) => med.id === item.medicamentoId)?.controlado,
            ),
            profissional: profissional(encounter.professionalId),
            idioma: 'pt-BR',
            itens,
            documentoId: documentos.find((item) => item.tipo === 'RECEITUARIO')?.id ?? null,
          }
        : null,
    exames,
    retorno:
      retorno.emDias !== null
        ? {
            emDias: retorno.emDias,
            venceEm: addDays(dataDoAtendimento, retorno.emDias),
            servicoId: retorno.typeId ?? 'tipo-retorno',
            profissionalId: encounter.professionalId,
            agendamentoId: retorno.appointmentId,
          }
        : null,
    documentos,
  }
}

export function projetarVacina(
  aplicacao: AplicacaoVacina,
  ctx: ContextoDaProjecao,
): VacinaAplicadaNaClinica {
  const vacina = vacinasFixture.find((item) => item.id === aplicacao.vacinaId)
  const dosesNaSerie = vacina?.dosesNaSerie ?? 1

  return {
    id: aplicacao.id,
    petId: aplicacao.petId,
    clinica: clinicaResumo(ctx),
    profissional: profissional(aplicacao.professionalId),
    vacina: {
      nome: vacina?.nome ?? aplicacao.vacinaId,
      fabricante: vacina?.fabricante ?? '',
      obrigatoria: vacina?.obrigatoria ?? false,
    },
    aplicadaEm: aplicacao.aplicadaEm,
    lote: aplicacao.lote,
    validadeLote: aplicacao.validadeLote,
    dose: aplicacao.dose,
    dosesNaSerie,
    proximaDoseEm: aplicacao.proximaDoseEm,
    situacao:
      SITUACAO[
        situacaoDoReforco(
          aplicacao.proximaDoseEm,
          clock.dateOf(ctx.agora),
          aplicacao.dose < dosesNaSerie,
        )
      ],
    vacinaDaCarteiraId: null,
  }
}

export function projetarInternacao(
  internacao: Internacao,
  ctx: ContextoDaProjecao,
): InternacaoNaClinica {
  const { preferencias, boletins } = ctx.dataset.internacao
  const preferencia = preferencias.find((item) => item.internacaoId === internacao.id)
  const enviados = boletins
    .filter(
      (item) => item.internacaoId === internacao.id && item.status === 'enviado' && item.enviadoEm,
    )
    .sort((a, b) => Date.parse(b.enviadoEm!) - Date.parse(a.enviadoEm!))

  return {
    id: internacao.id,
    pet: petResumo(ctx, internacao.petId),
    clinica: clinicaResumo(ctx),
    status: INTERNACAO[internacao.status],
    entradaEm: internacao.entradaEm,
    motivo: internacao.motivo,
    altaPrevistaEm: internacao.altaPrevistaEm,
    encerradaEm: internacao.altaEm,
    responsavelClinico: profissional(internacao.responsavelId),
    preferencias: {
      frequenciaHoras: preferencia?.frequenciaHoras ?? 6,
      fotoSempre: preferencia?.fotoSempre ?? false,
      silencioNoturno: preferencia?.silencioNoturno ?? true,
    },
    ultimoBoletimEm: enviados[0]?.enviadoEm ?? null,
  }
}

/** Só o que chegou ao celular. Retido e liberado ainda estão na clínica — e não são anunciados. */
export function projetarBoletins(
  internacaoId: string,
  ctx: ContextoDaProjecao,
): BoletimDaInternacao[] {
  return ctx.dataset.internacao.boletins
    .filter(
      (item): item is BoletimAoTutor & { enviadoEm: string } =>
        item.internacaoId === internacaoId && item.status === 'enviado' && item.enviadoEm !== null,
    )
    .sort((a, b) => Date.parse(b.enviadoEm) - Date.parse(a.enviadoEm))
    .map((item) => ({
      id: item.id,
      internacaoId: item.internacaoId,
      tipo: item.tipo === 'alta' ? 'ALTA' : 'ATUALIZACAO',
      texto: item.texto,
      idioma: 'pt-BR',
      fotoUrl: item.foto ? `mock://fotos/${item.id}.jpg` : null,
      fotoLegenda: item.foto ? item.fotoLegenda || null : null,
      enviadoEm: item.enviadoEm,
      aposLigacao: item.ligacaoEm !== null,
    }))
}

/**
 * Horários livres de consulta nos próximos dias úteis, com qualquer profissional — os mesmos que
 * a agenda do portal mostraria sem aviso. Poucos por profissional e por dia: é o suficiente para
 * a tela de horários ter o que mostrar sem virar uma lista de trezentos itens.
 */
export function projetarHorariosLivres(
  ctx: ContextoDaProjecao,
  opcoes: { typeId: string; petId: string; dias: number; porProfissionalPorDia: number },
): HorarioLivre[] {
  const { dataset } = ctx
  const tipo = tipoDo(opcoes.typeId)
  const livres: HorarioLivre[] = []
  const hoje = clock.dateOf(ctx.agora)

  for (let offset = 1; offset <= opcoes.dias; offset += 1) {
    const data = addDays(hoje, offset)
    const horario = dataset.clinic.horarios.find((item) => item.weekday === weekdayOf(data))
    const feriado = dataset.clinic.feriados.find((item) => item.date === data)

    if (!horario || horario.fechado || feriado?.fechado) {
      continue
    }

    for (const professional of professionalsFixture.filter((item) => item.ativo)) {
      const sugestoes = slotsLivres(
        {
          petId: opcoes.petId,
          typeId: tipo.id,
          duracaoMinutos: tipo.duracaoMinutos,
          professionalIds: [professional.id],
          roomIds: [],
          preferenciaMinutos: null,
          data,
        },
        {
          clinic: dataset.clinic,
          clock,
          data,
          atendimentos: dataset.appointments.filter((item) => clock.dateOf(item.inicio) === data),
          bloqueios: materializarBloqueios(dataset.blocks, data, clock),
          tipos: appointmentTypesFixture,
          salas: roomsFixture,
          pets: dataset.pets,
          capacidadeMinutos: CAPACIDADE_MINUTOS_POR_PROFISSIONAL,
        },
        opcoes.porProfissionalPorDia,
      )

      livres.push(
        ...sugestoes.map((sugestao) => ({
          inicio: sugestao.inicio,
          fim: sugestao.fim,
          profissional: profissional(professional.id),
        })),
      )
    }
  }

  return livres.sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))
}

// ---------------------------------------------------------------------------
// Notificações do cenário
// ---------------------------------------------------------------------------

export type NotificacaoDaDemonstracao = {
  id: string
  criadoEm: DataHoraIso
  lidaEm: DataHoraIso | null
  titulo: string
  corpo: string
  dados: DadosDaNotificacaoClinica
}

function renderizar(dados: DadosDaNotificacaoClinica) {
  const texto = TEXTOS_PT_DAS_NOTIFICACOES[dados.tipo] as (dados: DadosDaNotificacaoClinica) => {
    titulo: string
    corpo: string
  }

  return texto(dados)
}

/** Notificação com mais de um dia já foi aberta: a caixa de entrada da demonstração tem uso. */
const LIDA_DEPOIS_DE_MINUTOS = 40

/**
 * As notificações que a Fátima recebeu até agora, montadas do próprio estado do dataset — se o
 * cenário mudar, elas acompanham:
 *
 * - a oferta de vaga aberta e a falta sem justificativa da Brunilda;
 * - o lembrete da véspera da consulta da Pérola (lido: foi por ele que ela confirmou), a
 *   pré-consulta aberta, o resumo da última consulta e o reforço da V4;
 * - um aviso por boletim da Pipoca.
 *
 * `criadoEm` é quando a API mandaria, nunca depois do `agora` da demonstração.
 */
export function projetarNotificacoes(ctx: ContextoDaProjecao): NotificacaoDaDemonstracao[] {
  const { dataset } = ctx
  const meusPets = new Set(petsDoResponsavel(ctx))
  const clinicaNome = dataset.clinic.nome
  const agora = Date.parse(ctx.agora)
  const nomeDoPet = (petId: string) => petResumo(ctx, petId).nome
  const notificacoes: NotificacaoDaDemonstracao[] = []

  const acrescentar = (
    criadoEm: DataHoraIso,
    dados: DadosDaNotificacaoClinica,
    idDoItem: string,
    lidaEm?: DataHoraIso | null,
  ) => {
    if (Date.parse(criadoEm) > agora) {
      return
    }

    const antiga = agora - Date.parse(criadoEm) > 24 * 60 * 60_000

    notificacoes.push({
      id: `notif-${dados.tipo.toLowerCase()}-${idDoItem}`,
      criadoEm,
      lidaEm: lidaEm ?? (antiga ? somarMinutos(criadoEm, LIDA_DEPOIS_DE_MINUTOS) : null),
      ...renderizar(dados),
      dados,
    })
  }

  for (const entrada of dataset.waitlist) {
    if (
      !meusPets.has(entrada.petId) ||
      entrada.status !== 'ofertado' ||
      !entrada.ofertaSlotInicio ||
      !entrada.ofertaExpiraEm
    ) {
      continue
    }

    /* A oferta nasce com o prazo inteiro da política; o push sai nesse instante. */
    const ofertadaEm = somarMinutos(entrada.ofertaExpiraEm, -dataset.politica.ofertaDeVagaMinutos)

    acrescentar(
      ofertadaEm,
      {
        tipo: 'FILA_VAGA_OFERECIDA',
        url: urlDaNotificacaoClinica('FILA_VAGA_OFERECIDA', entrada.petId, entrada.id),
        entradaId: entrada.id,
        petId: entrada.petId,
        petNome: nomeDoPet(entrada.petId),
        clinicaNome,
        inicio: entrada.ofertaSlotInicio,
        expiraEm: entrada.ofertaExpiraEm,
        mensagemDaClinica: null,
        idiomaDaMensagem: null,
      },
      entrada.id,
    )
  }

  for (const appointment of dataset.appointments) {
    if (!meusPets.has(appointment.petId)) {
      continue
    }

    const agendamento = projetarAgendamento(appointment, ctx)
    const comAgendamento = {
      agendamentoId: appointment.id,
      petId: appointment.petId,
      petNome: nomeDoPet(appointment.petId),
      clinicaNome,
      inicio: appointment.inicio,
    }

    if (appointment.status === 'agendado' || appointment.status === 'confirmado') {
      /* A véspera sai às 18h do dia anterior. Quem confirmou pelo app abriu por ela. */
      const vesperaEm = clock.toIso(addDays(clock.dateOf(appointment.inicio), -1), 18 * 60)

      acrescentar(
        vesperaEm,
        {
          tipo: 'AGENDAMENTO_LEMBRETE_VESPERA',
          url: urlDaNotificacaoClinica(
            'AGENDAMENTO_LEMBRETE_VESPERA',
            appointment.petId,
            appointment.id,
          ),
          ...comAgendamento,
        },
        appointment.id,
        appointment.confirmacao?.por === 'app' ? appointment.confirmacao.em : null,
      )
    }

    if (agendamento.preConsulta?.situacao === 'ABERTA') {
      /* Vinte e quatro horas antes, e só para quem ainda não respondeu. */
      acrescentar(
        somarMinutos(appointment.inicio, -24 * 60),
        {
          tipo: 'PRE_CONSULTA_PENDENTE',
          url: urlDaNotificacaoClinica('PRE_CONSULTA_PENDENTE', appointment.petId, appointment.id),
          ...comAgendamento,
          fechaEm: agendamento.preConsulta.fechaEm,
        },
        appointment.id,
      )
    }

    const diasDesde = (agora - Date.parse(appointment.inicio)) / 86_400_000

    if (appointment.status === 'falta' && !appointment.justificativaDeFalta && diasDesde <= 30) {
      acrescentar(
        appointment.fim,
        {
          tipo: 'AGENDAMENTO_FALTA',
          url: urlDaNotificacaoClinica('AGENDAMENTO_FALTA', appointment.petId, appointment.id),
          ...comAgendamento,
          mensagemDaClinica: null,
          idiomaDaMensagem: null,
        },
        appointment.id,
      )
    }
  }

  for (const encounter of dataset.encounters) {
    const liberadoEm = encounter.resumoLiberadoEm

    if (
      !meusPets.has(encounter.petId) ||
      !liberadoEm ||
      agora - Date.parse(liberadoEm) > 60 * 86_400_000
    ) {
      continue
    }

    acrescentar(
      liberadoEm,
      {
        tipo: 'ATENDIMENTO_RESUMO_DISPONIVEL',
        url: urlDaNotificacaoClinica(
          'ATENDIMENTO_RESUMO_DISPONIVEL',
          encounter.petId,
          encounter.id,
        ),
        atendimentoId: encounter.id,
        petId: encounter.petId,
        petNome: nomeDoPet(encounter.petId),
        clinicaNome,
        temReceita: encounter.conduta.prescricoes.length > 0,
      },
      encounter.id,
    )
  }

  for (const aplicacao of dataset.aplicacoesDeVacina) {
    if (!meusPets.has(aplicacao.petId)) {
      continue
    }

    const vacina = projetarVacina(aplicacao, ctx)

    if (vacina.situacao === 'PROXIMO') {
      /* Sai no dia em que o reforço entra na janela de aviso, às 10h. */
      const entrouNaJanela = addDays(aplicacao.proximaDoseEm, -JANELA_DE_AVISO_EM_DIAS)

      acrescentar(
        clock.toIso(entrouNaJanela, 10 * 60),
        {
          tipo: 'VACINA_REFORCO_PROXIMO',
          url: urlDaNotificacaoClinica('VACINA_REFORCO_PROXIMO', aplicacao.petId, aplicacao.id),
          aplicacaoId: aplicacao.id,
          petId: aplicacao.petId,
          petNome: nomeDoPet(aplicacao.petId),
          vacinaNome: vacina.vacina.nome,
          proximaDoseEm: aplicacao.proximaDoseEm,
        },
        aplicacao.id,
      )
    }
  }

  for (const internacao of dataset.internacao.internacoes) {
    if (!meusPets.has(internacao.petId)) {
      continue
    }

    for (const boletim of projetarBoletins(internacao.id, ctx)) {
      const tipo = boletim.tipo === 'ALTA' ? 'INTERNACAO_ALTA' : 'INTERNACAO_BOLETIM'

      acrescentar(
        boletim.enviadoEm,
        {
          tipo,
          url: urlDaNotificacaoClinica(tipo, internacao.petId, internacao.id),
          internacaoId: internacao.id,
          boletimId: boletim.id,
          petId: internacao.petId,
          petNome: nomeDoPet(internacao.petId),
          clinicaNome,
        },
        boletim.id,
      )
    }
  }

  return notificacoes.sort((a, b) => Date.parse(b.criadoEm) - Date.parse(a.criadoEm))
}

// ---------------------------------------------------------------------------
// A demonstração inteira
// ---------------------------------------------------------------------------

/**
 * Tudo o que o mock do app precisa para contar a história da Fátima, gerado do dataset do
 * portal. `hojeDaClinica` é a âncora: o app desloca todas as datas pela diferença entre ela e o
 * dia de hoje, para que "consulta hoje" continue sendo hoje na semana que vem.
 */
export type DemoDoResponsavel = {
  geradoEm: DataHoraIso
  hojeDaClinica: DataIso
  responsavel: { id: string; nome: string; telefone: string }
  pets: Array<PetResumo & { especie: string; raca: string; nascimento: DataIso | null }>
  clinicas: ClinicaDoResponsavel[]
  servicos: ServicoAgendavel[]
  horariosLivres: HorarioLivre[]
  agendamentos: Agendamento[]
  preConsultas: PreConsultaNoContrato[]
  fila: EntradaNaFila[]
  atendimentos: ResumoDoAtendimento[]
  vacinas: VacinaAplicadaNaClinica[]
  internacoes: InternacaoNaClinica[]
  boletins: BoletimDaInternacao[]
  notificacoes: NotificacaoDaDemonstracao[]
}

/** Quanto do passado a demonstração carrega: o bastante para a perda de peso da Pérola. */
const PASSADO_DIAS = 180

export function montarDemoDoResponsavel(ctx: ContextoDaProjecao): DemoDoResponsavel {
  const { dataset } = ctx
  const tutor = dataset.tutores.find((item) => item.id === ctx.tutorId)
  const meusPets = new Set(petsDoResponsavel(ctx))
  const desde = Date.parse(ctx.agora) - PASSADO_DIAS * 86_400_000

  const agendamentos = dataset.appointments
    .filter((item) => meusPets.has(item.petId) && Date.parse(item.inicio) >= desde)
    .sort((a, b) => Date.parse(a.inicio) - Date.parse(b.inicio))

  const internacoes = dataset.internacao.internacoes.filter((item) => meusPets.has(item.petId))
  const primeiroPet = [...meusPets][0] ?? ''

  return {
    geradoEm: ctx.agora,
    hojeDaClinica: dataset.ancora,
    responsavel: { id: ctx.tutorId, nome: tutor?.nome ?? '', telefone: tutor?.telefone ?? '' },
    pets: dataset.pets
      .filter((pet) => meusPets.has(pet.id))
      .map((pet) => ({
        id: pet.id,
        nome: pet.nome,
        fotoUrl: null,
        especie: pet.especie,
        raca: pet.raca,
        nascimento: pet.nascimento,
      })),
    clinicas: [projetarClinica(ctx)],
    servicos: projetarServicos(),
    horariosLivres: projetarHorariosLivres(ctx, {
      typeId: 'tipo-consulta',
      petId: primeiroPet,
      dias: 14,
      porProfissionalPorDia: 3,
    }),
    agendamentos: agendamentos.map((item) => projetarAgendamento(item, ctx)),
    preConsultas: agendamentos
      .filter((item) => Date.parse(item.inicio) >= Date.parse(ctx.agora) - 86_400_000)
      .filter((item) => COM_PRE_CONSULTA.includes(tipoDo(item.typeId).kind))
      .filter((item) => item.status === 'agendado' || item.status === 'confirmado')
      .map((item) => projetarPreConsulta(item, ctx)),
    fila: dataset.waitlist
      .filter((item) => meusPets.has(item.petId) && item.status !== 'removido')
      .map((item) => projetarEntradaNaFila(item, ctx)),
    atendimentos: dataset.encounters
      .filter((item) => meusPets.has(item.petId) && item.resumoLiberadoEm)
      .sort(
        (a, b) =>
          Date.parse(b.finalizadoEm ?? b.abertoEm) - Date.parse(a.finalizadoEm ?? a.abertoEm),
      )
      .map((item) => projetarAtendimento(item, ctx)),
    vacinas: dataset.aplicacoesDeVacina
      .filter((item) => meusPets.has(item.petId))
      .map((item) => projetarVacina(item, ctx)),
    internacoes: internacoes.map((item) => projetarInternacao(item, ctx)),
    boletins: internacoes.flatMap((item) => projetarBoletins(item.id, ctx)),
    notificacoes: projetarNotificacoes(ctx),
  }
}
