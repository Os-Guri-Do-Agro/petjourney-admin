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

/**
 * Porte do paciente.
 *
 * Existe porque **faixa de referência por espécie sozinha erra**: um cão de 3 kg tem
 * frequência cardíaca muito acima de um de 60 kg, e uma faixa única marcaria como alterado o
 * que é normal para o porte — ensinando o profissional a ignorar o destaque, que é o pior
 * desfecho possível para o realce de valor fora da faixa.
 *
 * É campo do paciente, e **não conta a partir do peso**: filhote de dogue alemão pesa 10 kg e
 * é gigante. Nulo significa não informado — aí o peso serve de estimativa, com a ressalva de
 * que é palpite (ver `domain/porte.ts`).
 */
export type PetPorte = 'mini' | 'pequeno' | 'medio' | 'grande' | 'gigante'

/** Faixa etária clínica. Derivada do nascimento e do porte, nunca digitada. */
export type FaixaEtaria = 'filhote' | 'adulto' | 'idoso'

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
  /** Porte informado pela clínica. `null` cai na estimativa por peso. */
  porte: PetPorte | null
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

/**
 * Faixa de referência de um sinal vital.
 *
 * `porte` e `faixaEtaria` são **qualificadores opcionais**, e é isso que faz o modelo
 * funcionar: a faixa sem qualificador nenhum vale para a espécie inteira, e a que traz um ou
 * os dois vence quando o paciente casa com ela. Assim o catálogo cresce por onde importa —
 * cão, onde porte muda tudo — sem exigir uma linha por combinação em espécies onde não muda.
 *
 * A resolução do mais específico para o mais geral está em `domain/ranges.ts`.
 */
export type ReferenceRange = {
  vital: VitalKey
  especie: PetSpecies
  /** Ausente: vale para qualquer porte. */
  porte?: PetPorte
  /** Ausente: vale para qualquer idade. */
  faixaEtaria?: FaixaEtaria
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

/**
 * Como o quadro vem se comportando desde que começou.
 *
 * É o eixo que decide urgência, e o único que permite comparar dois atendimentos do mesmo
 * quadro. "Dor há três dias" não diz nada sozinho; "dor há três dias, piorando" é outra
 * consulta. Vazio significa não perguntado — que é diferente de estável.
 */
export type EvolucaoDoQuadro = 'piorando' | 'estavel' | 'melhorando' | 'intermitente' | ''

/**
 * Antecedente do paciente: o que já aconteceu e ainda pesa na decisão de hoje.
 *
 * Estruturado por `kind` porque é isto que o vet varre antes de prescrever — e varrer um
 * parágrafo de texto livre à procura de "já fez cirurgia?" é como a informação se perde
 * justamente na consulta em que ela importa.
 */
export type AntecedenteKind =
  | 'cirurgia'
  | 'doenca-previa'
  | 'alergia'
  | 'medicacao-continua'
  | 'reacao-vacinal'
  | 'trauma'
  | 'outro'

export type Antecedente = {
  id: string
  kind: AntecedenteKind
  descricao: string
  /** Ano aproximado, livre: "2023", "filhote", "há 2 anos". Data exata quase nunca existe. */
  quando: string
}

export type Anamnese = {
  queixaPrincipal: string
  historia: string
  duracaoSintomas: string
  evolucao: EvolucaoDoQuadro
  antecedentes: Antecedente[]
  apetite: 'normal' | 'aumentado' | 'reduzido' | 'ausente' | ''
  evacuacao: 'normal' | 'diarreia' | 'constipacao' | ''
  miccao: 'normal' | 'aumentada' | 'reduzida' | 'disuria' | ''
  ambiente: 'domiciliar' | 'externo' | 'misto' | ''
  vacinacaoEmDia: boolean | null
  vermifugacaoEmDia: boolean | null
}

/**
 * Coloração das mucosas.
 *
 * Achado que muda conduta sozinho: mucosa pálida é hemorragia ou anemia até prova em
 * contrário, ictérica manda olhar fígado, cianótica é urgência respiratória. Não tem faixa
 * numérica e por isso não cabe em `vitais` — mas é exame físico, não conversa.
 */
export type MucosaStatus =
  | 'normocoradas'
  | 'palidas'
  | 'ictericas'
  | 'cianoticas'
  | 'congestas'
  | 'nao-avaliado'

/**
 * Grau de desidratação estimado no exame.
 *
 * Morava na anamnese, que era o lugar errado: desidratação se estima por turgor cutâneo,
 * mucosas e enoftalmia — coisas que se veem com o paciente na mesa, não que o responsável
 * relate por telefone. Vazio é "ainda não avaliado".
 */
export type HidratacaoGrau = 'normal' | 'leve' | 'moderada' | 'grave' | ''

export type ExameFisico = {
  vitais: Record<VitalKey, Measurement>
  mucosas: MucosaStatus
  hidratacao: HidratacaoGrau
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
  /**
   * Duração em dias, ou `null` para **uso contínuo**.
   *
   * Contínuo não é "duração muito longa": é a ausência de data de fim. Representá-lo como 365
   * dias faria a receita vencer sozinha e o lembrete do responsável parar num dia arbitrário —
   * num anti-hipertensivo, parar é o efeito adverso.
   */
  duracaoDias: number | null
  /** Zero quando o uso é contínuo: não há total a somar. */
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

/**
 * O que o responsável respondeu no app **antes** da consulta.
 *
 * É onde o diferencial do produto aterrissa no prontuário: o mesmo caminho pelo qual o
 * agendamento nasce no app e cai na agenda, aplicado ao conteúdo clínico. Chega como
 * **sugestão**, nunca como valor preenchido — quem assina o prontuário é o veterinário, e um
 * campo que já vem escrito é um campo que ninguém relê.
 *
 * Por isso a procedência viaja junto: um peso informado pelo responsável e um peso aferido na
 * balança da clínica não têm o mesmo valor, e a tela precisa poder dizer qual é qual.
 */
export type PreConsulta = {
  appointmentId: string
  /** Quando o responsável respondeu. Resposta de duas semanas atrás vale menos. */
  respondidoEm: ISODateTime
  queixaPrincipal: string
  duracaoSintomas: string
  evolucao: EvolucaoDoQuadro
  apetite: Anamnese['apetite']
  evacuacao: Anamnese['evacuacao']
  miccao: Anamnese['miccao']
  /** Peso informado em casa. Sugestão de partida, não medição. */
  pesoInformadoKg: number | null
  /** Texto livre do responsável, na íntegra e sem edição. */
  observacao: string
}

// ---------------------------------------------------------------------------
// Receituário
// ---------------------------------------------------------------------------

/**
 * Assinatura eletrônica da receita.
 *
 * Nome e conselho são **congelados no momento da assinatura**, e não lidos do cadastro na hora
 * de exibir. A receita é documento: se o profissional trocar de conselho ou sair da clínica no
 * ano que vem, o papel emitido hoje continua tendo de dizer quem assinou hoje.
 */
export type AssinaturaEletronica = {
  professionalId: string
  nome: string
  /** CRMV, como estava no cadastro no instante da assinatura. */
  conselho: string
  assinadoEm: ISODateTime
  /**
   * Código verificador. É o que a farmácia confere e o que o responsável vê no app.
   *
   * No protótipo é derivado de forma determinística; na API real será o resumo criptográfico
   * do documento assinado. A forma na tela é a mesma, e é o que importa agora.
   */
  codigo: string
}

export type ReceitaStatus = 'rascunho' | 'assinada' | 'enviada'

export type Receita = {
  id: string
  encounterId: string
  petId: string
  tutorId: string
  /** Cópia das prescrições no instante da emissão — a receita não muda se a conduta mudar. */
  prescricoes: Prescription[]
  status: ReceitaStatus
  emitidaEm: ISODateTime
  /**
   * Validade da receita.
   *
   * Receita comum vale 30 dias; a de controle especial (Portaria 344/98) também, mas com
   * retenção da via na farmácia. Sem validade impressa, a farmácia recusa — e o responsável
   * volta à clínica por um papel, não por um atendimento.
   */
  validaAte: ISODate
  /** `true` quando qualquer item é controlado: muda a folha e a retenção. */
  controlada: boolean
  assinatura: AssinaturaEletronica | null
  /** Quando foi entregue ao responsável no app. */
  enviadaEm: ISODateTime | null
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
  /** Respostas do responsável no app, quando houve. Sugestão, nunca valor aplicado. */
  preConsulta: PreConsulta | null
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
  /**
   * Grafias do princípio ativo em todos os idiomas do catálogo — *Amoxicilina*,
   * *Amoxicillin*.
   *
   * Existe por causa da alergia: ela é registrada como **texto livre** no alerta do paciente
   * ("Alergia a amoxicilina"), e o cruzamento com a prescrição é por palavra. Com o bulário
   * traduzido, comparar só com `principioAtivo` faria o aviso desaparecer assim que a tela
   * mudasse de idioma — o alerta continua em português, o princípio ativo não. É o tipo de
   * silêncio que só aparece depois de a receita sair impressa.
   *
   * Preenchido pela camada de tradução; ausente significa "só a grafia de `principioAtivo`".
   */
  sinonimosDoPrincipio?: string[]
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
  /** Internação: o requisito a nomeia ao lado de consultas, vacinas e exames. */
  | 'internacao'
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

/**
 * Ocupação de um profissional num dia, quebrada por período.
 *
 * O agregado do dia esconde exatamente a resposta que a recepção precisa dar: "a agenda da Ana
 * cheia e a do Caio vazia" somam 50% e não dizem a quem oferecer. E a pergunta no balcão nunca
 * é sobre o dia inteiro — é "tem alguma coisa **de manhã** na terça?".
 */
export type CargaDoProfissional = {
  professionalId: string
  agendados: number
  ocupadoMinutos: number
  /** 0..n do dia inteiro. Acima de 1, o profissional está vendido além do expediente. */
  ocupacao: number
  /** Ocupação só da manhã e só da tarde, na mesma escala. */
  ocupacaoManha: number
  ocupacaoTarde: number
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
  /** Por profissional ativo, na ordem da equipe. Vazio quando a clínica não abre. */
  porProfissional: CargaDoProfissional[]
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
