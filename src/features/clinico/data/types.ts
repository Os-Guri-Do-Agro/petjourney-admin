/**
 * Contratos de domínio do módulo clínico.
 *
 * Estes tipos são a forma da API futura: a camada mocada em `data/` os produz e os
 * repositórios os devolvem com a mesma assinatura que o backend terá. Componente nenhum
 * conhece `fixtures` — só estes contratos.
 *
 * Terminologia: `tutorId` / `Tutor` sobrevivem como identificador de código e campo de API.
 * Em texto visível em português o termo é sempre "responsável".
 */

/** `YYYY-MM-DD` na parede da clínica. */
export type ISODate = string
/** `HH:mm` na parede da clínica. */
export type ClockTime = string
/** `YYYY-MM-DDTHH:mm:ss-04:00` — sempre com o offset da clínica explícito. */
export type ISODateTime = string

// ---------------------------------------------------------------------------
// Clínica
// ---------------------------------------------------------------------------

export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6

export type WorkingWindow = {
  inicio: ClockTime
  fim: ClockTime
}

export type WeekdayHours = {
  weekday: WeekdayIndex
  fechado: boolean
  expediente: WorkingWindow
  /** Intervalo de almoço: não bloqueia, mas gera aviso de sobreposição. */
  almoco: WorkingWindow | null
}

export type Holiday = {
  date: ISODate
  nome: string
  /** Feriado fechado é o único conflito `blocking` do módulo — e ainda assim contornável. */
  fechado: boolean
}

export type Clinic = {
  id: string
  nome: string
  /**
   * Endereço e telefone do prescritor.
   *
   * Não é enfeite de cabeçalho: o receituário de controle especial (Portaria 344/98) exige o
   * endereço completo de quem prescreve, e sem ele a farmácia recusa a retenção.
   */
  endereco: string
  telefone: string
  /** Offset fixo da parede da clínica. Toda conversão de tempo passa por aqui. */
  utcOffset: string
  horarios: WeekdayHours[]
  feriados: Holiday[]
  /** Granularidade da grade, em minutos. */
  slotMinutos: number
}

export type Professional = {
  id: string
  nome: string
  iniciais: string
  conselho: string
  especialidade: string
  /** Índice na escala de cores de coluna (0..5). Nunca uma cor literal. */
  corIndice: number
  salaPadraoId: string | null
  ativo: boolean
}

export type RoomKind = 'consultorio' | 'cirurgia' | 'banho' | 'internacao' | 'exame'

export type Room = {
  id: string
  nome: string
  kind: RoomKind
}

export type AppointmentTypeKind =
  | 'consulta'
  | 'retorno'
  | 'vacina'
  | 'exame'
  | 'cirurgia'
  | 'banho'
  | 'emergencia'

export type AppointmentType = {
  id: string
  nome: string
  duracaoMinutos: number
  kind: AppointmentTypeKind
  /** Salas compatíveis; lista vazia significa qualquer sala. */
  salasCompativeis: RoomKind[]
  permiteEncaixe: boolean
}

// ---------------------------------------------------------------------------
// Pessoas e pacientes
// ---------------------------------------------------------------------------

export type Tutor = {
  id: string
  nome: string
  telefone: string
  email: string
  documento: string
}

export type PetSpecies = 'canina' | 'felina' | 'ave' | 'roedor' | 'reptil' | 'equina'
export type PetSex = 'macho' | 'femea'

export type PetAlertKind =
  | 'alergia'
  | 'agressivo'
  | 'cronico'
  | 'imunossuprimido'
  | 'gestante'
  | 'inadimplente'

export type AlertSeverity = 'info' | 'atencao' | 'risco'

export type PetAlert = {
  id: string
  kind: PetAlertKind
  severidade: AlertSeverity
  /** Detalhe já digitado pela clínica (ex.: princípio ativo da alergia). */
  detalhe: string
}

export type Pet = {
  id: string
  nome: string
  especie: PetSpecies
  raca: string
  sexo: PetSex
  /**
   * Nulo quando ninguém informou.
   *
   * Marcar consulta por telefone quase nunca tem a data exata na mão, e exigi-la faria a recepção
   * inventar um valor — que depois vira "filhote" ou "idoso" num aviso do bulário.
   */
  nascimento: ISODate | null
  castrado: boolean
  pesoKg: number | null
  tutorId: string
  alertas: PetAlert[]
  /** Iniciais para o avatar; o módulo não carrega foto no mock. */
  iniciais: string
}

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------

export type AppointmentStatus =
  | 'agendado'
  | 'confirmado'
  | 'aguardando'
  | 'em-atendimento'
  | 'finalizado'
  | 'falta'
  | 'cancelado'

export type AppointmentOrigin = 'recepcao' | 'app' | 'telefone' | 'encaixe' | 'retorno' | 'fila'

export type CancelReason =
  | 'responsavel-desmarcou'
  | 'clinica-remarcou'
  | 'paciente-indisponivel'
  | 'duplicado'
  | 'outro'

export type Appointment = {
  id: string
  petId: string
  tutorId: string
  professionalId: string
  /** Mais de uma sala para o atendimento que ocupa duas (cirurgia + recuperação). */
  roomIds: string[]
  typeId: string
  inicio: ISODateTime
  fim: ISODateTime
  status: AppointmentStatus
  origem: AppointmentOrigin
  encaixe: boolean
  observacao: string
  chegadaEm: ISODateTime | null
  iniciadoEm: ISODateTime | null
  finalizadoEm: ISODateTime | null
  canceladoEm: ISODateTime | null
  /** `kind` de motivo, nunca texto pronto: a tela traduz. */
  motivoCancelamento: CancelReason | null
  encounterId: string | null
  /** Atendimentos ligados (mesma cirurgia em duas salas) compartilham o grupo. */
  linkedGroupId: string | null
  criadoEm: ISODateTime
  atualizadoEm: ISODateTime
}

export type BlockReason =
  | 'almoco'
  | 'reuniao'
  | 'ferias'
  | 'manutencao'
  | 'bloqueio-pessoal'
  | 'feriado'

export type BlockRecurrence = {
  kind: 'weekly'
  /** Dias da semana em que a ocorrência se repete. */
  weekdays: WeekdayIndex[]
  ate: ISODate | null
}

export type Block = {
  id: string
  professionalId: string | null
  roomId: string | null
  inicio: ISODateTime
  fim: ISODateTime
  motivo: BlockReason
  detalhe: string
  recorrencia: BlockRecurrence | null
  /** Id da ocorrência original quando esta foi materializada para um dia pedido. */
  materializadoDe: string | null
}

/** Reserva provisória de 5 minutos durante a confirmação de um agendamento. */
export type Hold = {
  id: string
  professionalId: string
  inicio: ISODateTime
  fim: ISODateTime
  expiraEm: ISODateTime
}

// ---------------------------------------------------------------------------
// Conflitos e avisos
// ---------------------------------------------------------------------------

export type ConflictKind =
  | 'professional-overlap'
  | 'room-overlap'
  | 'pet-double-book'
  | 'block-invasion'
  | 'outside-hours'
  | 'lunch-overlap'
  | 'holiday-closed'
  | 'over-capacity'
  | 'type-room-mismatch'

export type ConflictSeverity = 'info' | 'warning' | 'blocking'

/**
 * Conflito viaja como `kind` + `params`, nunca texto pronto: o portal tem quatro idiomas e
 * a tradução é responsabilidade da apresentação (`clinico.conflitos.<kind>`).
 */
export type Conflict = {
  kind: ConflictKind
  severity: ConflictSeverity
  params: Record<string, string | number>
}

// ---------------------------------------------------------------------------
// Fila de espera
// ---------------------------------------------------------------------------

export type WaitlistStatus = 'aguardando' | 'ofertado' | 'aceito' | 'expirado' | 'removido'
export type WaitlistPriority = 'normal' | 'preferencial' | 'urgente'

export type WaitlistWindow = {
  weekday: WeekdayIndex
  inicio: ClockTime
  fim: ClockTime
}

export type WaitlistEntry = {
  id: string
  petId: string
  tutorId: string
  typeId: string
  professionalId: string | null
  prioridade: WaitlistPriority
  /** Janelas aceitas pelo responsável, por dia da semana. */
  janelas: WaitlistWindow[]
  status: WaitlistStatus
  criadoEm: ISODateTime
  ofertaExpiraEm: ISODateTime | null
  ofertaSlotInicio: ISODateTime | null
  observacao: string
}

// ---------------------------------------------------------------------------
// Prontuário
// ---------------------------------------------------------------------------

/**
 * Medição clínica. `naoAferido` é informação, não ausência: distingue "o profissional
 * decidiu não medir" de "ninguém preencheu ainda".
 */
export type Measurement = {
  valor: number | null
  naoAferido: boolean
}

export type VitalKey =
  | 'peso'
  | 'temperatura'
  | 'frequenciaCardiaca'
  | 'frequenciaRespiratoria'
  | 'tempoPreenchimentoCapilar'
  | 'escoreCorporal'
  | 'pressaoSistolica'

export type ReferenceRange = {
  vital: VitalKey
  especie: PetSpecies
  min: number
  max: number
  unidade: string
  /** Casas decimais na exibição do valor clínico. */
  precisao: number
}

/** Recalculado a cada render a partir do valor e da faixa. Nunca digitado, nunca persistido. */
export type RangeStatus = 'abaixo' | 'dentro' | 'acima' | 'sem-referencia' | 'nao-aferido'

export type SystemKey =
  | 'cardiovascular'
  | 'respiratorio'
  | 'digestorio'
  | 'urinario'
  | 'tegumentar'
  | 'locomotor'
  | 'neurologico'
  | 'linfonodos'

export type SystemFinding = {
  status: 'normal' | 'alterado' | 'nao-avaliado'
  nota: string
}

export type Anamnese = {
  queixaPrincipal: string
  historia: string
  duracaoSintomas: string
  apetite: 'normal' | 'aumentado' | 'reduzido' | 'ausente' | ''
  hidratacao: 'normal' | 'leve' | 'moderada' | 'grave' | ''
  evacuacao: 'normal' | 'diarreia' | 'constipacao' | ''
  miccao: 'normal' | 'aumentada' | 'reduzida' | 'disuria' | ''
  ambiente: 'domiciliar' | 'externo' | 'misto' | ''
  vacinacaoEmDia: boolean | null
  vermifugacaoEmDia: boolean | null
}

export type ExameFisico = {
  vitais: Record<VitalKey, Measurement>
  sistemas: Record<SystemKey, SystemFinding>
  observacao: string
}

export type DiagnosisKind = 'presuntivo' | 'definitivo' | 'diferencial'

export type Diagnosis = {
  id: string
  codigo: string
  descricao: string
  kind: DiagnosisKind
}

export type PrescriptionRoute =
  | 'oral'
  | 'subcutanea'
  | 'intramuscular'
  | 'intravenosa'
  | 'topica'
  | 'otologica'

export type DoseCalc = {
  medicamentoId: string
  /** Dose por quilo prescrita pelo profissional. */
  mgPorKg: number
  pesoKg: number
  /** Resultado por administração. */
  mgPorAdministracao: number
  /** Volume ou número de comprimidos, conforme a apresentação. */
  quantidadeApresentacao: number
  frequenciaHoras: number
  duracaoDias: number
  totalAdministracoes: number
}

export type Prescription = {
  id: string
  medicamentoId: string
  via: PrescriptionRoute
  calculo: DoseCalc
  observacao: string
  /** Confirmação explícita quando o pet tem alergia registrada ao princípio ativo. */
  alergiaConfirmada: boolean
}

export type CarePlan = {
  orientacoes: string
  prescricoes: Prescription[]
  examesSolicitados: string[]
  retorno: {
    emDias: number | null
    typeId: string | null
    appointmentId: string | null
  }
}

export type EncounterStatus = 'rascunho' | 'finalizado'

export type EncounterLock = {
  deviceId: string
  deviceLabel: string
  desde: ISODateTime
}

export type Encounter = {
  id: string
  appointmentId: string
  petId: string
  tutorId: string
  professionalId: string
  status: EncounterStatus
  abertoEm: ISODateTime
  finalizadoEm: ISODateTime | null
  anamnese: Anamnese
  exameFisico: ExameFisico
  diagnosticos: Diagnosis[]
  conduta: CarePlan
  /** Incrementa a cada gravação; a comparação campo a campo do segundo dispositivo usa isto. */
  versao: number
  /** Quem detém a edição. Segundo dispositivo entra em leitura. */
  lock: EncounterLock | null
}

export type EncounterPatch = Partial<
  Pick<Encounter, 'anamnese' | 'exameFisico' | 'diagnosticos' | 'conduta'>
>

/** Rascunho local do prontuário, espelhado em `localStorage`. */
export type EncounterDraft = {
  encounterId: string
  salvoEm: ISODateTime
  versaoBase: number
  patch: EncounterPatch
}

// ---------------------------------------------------------------------------
// Catálogos
// ---------------------------------------------------------------------------

/** Classe farmacológica — é por ela que o bulário agrupa e filtra. */
export type MedicationClass =
  | 'antibiotico'
  | 'anti-inflamatorio'
  | 'analgesico'
  | 'corticoide'
  | 'antiemetico'
  | 'gastroprotetor'
  | 'antiparasitario'
  | 'sedativo'
  | 'cardiologico'
  | 'dermatologico'

/**
 * Situação do paciente que **cobra atenção** antes de prescrever.
 *
 * Cada uma casa com um alerta do prontuário ou com um dado do próprio paciente. Não é
 * proibição: a tela cobra leitura consciente, como já faz com alergia.
 */
export type MedicationCaution =
  | 'gestante'
  | 'lactante'
  | 'filhote'
  | 'idoso'
  | 'renal'
  | 'hepatico'
  | 'cardiaco'
  | 'gastrico'

/** Faixa de dose usual por espécie: gato **não** é cachorro pequeno. */
export type MedicationDose = {
  especie: PetSpecies
  mgPorKg: { min: number; max: number }
  frequenciaHoras: number
  duracaoUsualDias: number
  /** Espécie em que o princípio ativo é contraindicado — a faixa não deve ser usada. */
  proibido?: boolean
  nota?: string
}

export type Medication = {
  id: string
  nome: string
  principioAtivo: string
  /** mg/mL para líquidos, mg por comprimido para sólidos. */
  concentracao: number
  unidadeApresentacao: 'ml' | 'comprimido'
  /** Faixa de referência geral; a da espécie do paciente tem precedência. */
  doseUsualMgKg: { min: number; max: number }
  viasPermitidas: PrescriptionRoute[]

  // --- Bulário ------------------------------------------------------------
  classe: MedicationClass
  /** Receituário de controle especial (Portaria 344/98). */
  controlado: boolean
  apresentacao: string
  indicacoes: string[]
  contraindicacoes: string[]
  efeitosAdversos: string[]
  interacoes: string[]
  cuidados: MedicationCaution[]
  doses: MedicationDose[]
  observacao: string
}

export type DiagnosisCatalogItem = {
  codigo: string
  descricao: string
  sistema: SystemKey | null
}

export type ExamCatalogItem = {
  id: string
  nome: string
  grupo: 'laboratorio' | 'imagem' | 'outros'
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

export type TimelineEventKind =
  | 'consulta'
  | 'vacina'
  | 'exame'
  | 'cirurgia'
  | 'prescricao'
  | 'falta'
  | 'observacao'

export type TimelineEvent = {
  id: string
  petId: string
  kind: TimelineEventKind
  em: ISODateTime
  titulo: string
  resumo: string
  encounterId: string | null
  appointmentId: string | null
}

// ---------------------------------------------------------------------------
// Envelopes de listagem
// ---------------------------------------------------------------------------

export type AgendaDia = {
  data: ISODate
  clinicaFechada: boolean
  feriado: Holiday | null
  expediente: WorkingWindow
  almoco: WorkingWindow | null
  profissionais: Professional[]
  atendimentos: Appointment[]
  bloqueios: Block[]
}

export type DiaCarga = {
  data: ISODate
  agendados: number
  capacidadeMinutos: number
  ocupadoMinutos: number
  /** 0..1 — a barra mostra isto, e o número em texto ao lado. */
  ocupacao: number
  faltas: number
  encaixes: number
}

export type NoShowSummary = {
  tutorId: string
  petId: string
  faltas: number
  /** O painel mostra quantas **e quanto**: minutos de agenda perdidos. */
  minutosPerdidos: number
  ultimaFaltaEm: ISODateTime | null
  reincidente: boolean
}

export type SlotSugestao = {
  professionalId: string
  inicio: ISODateTime
  fim: ISODateTime
  conflitos: Conflict[]
  /** Menor é melhor: distância em minutos da preferência original. */
  distanciaMinutos: number
}
