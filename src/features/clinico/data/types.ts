/**
 * Contratos de domínio do módulo clínico.
 *
 * Estes tipos são a forma da API futura: a camada mocada em `data/` os produz e os
 * repositórios os devolvem com a mesma assinatura que o backend terá. Componente nenhum
 * conhece `fixtures` — só estes contratos.
 *
 * Terminologia: `tutorId` / `Tutor` sobrevivem como identificador de código e campo de API.
 * Em texto visível em português o termo é sempre "responsável".
 *
 * O que cruza com o app do responsável (diário, pré-consulta, consentimento) não é redeclarado
 * aqui: vem de `contrato/responsavel.ts`, que é a forma no fio para os dois lados.
 */

import type {
  ConsentimentoDaClinica,
  EntradaDoDiarioParaClinica,
  PesoParaClinica,
  RespostaDaPreConsulta,
} from '../contrato/responsavel'

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

/**
 * Endereço do responsável.
 *
 * Não é dado de cobrança — é exigência de receita. O receituário de controle especial
 * (Portaria SVS/MS 344/98) identifica o **comprador** por nome, documento e endereço, e a
 * farmácia recusa a retenção sem os três. Guardar o endereço no cadastro é a diferença entre
 * imprimir a receita e mandar o responsável voltar em casa buscar uma conta de luz.
 *
 * Campo em branco é resposta honesta: quem marca por telefone raramente dita o CEP. O que não
 * pode é não haver onde escrever quando alguém dita.
 */
export type EnderecoPostal = {
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  /** Sigla de duas letras, sempre em maiúsculas. */
  uf: string
}

/**
 * Por onde a clínica fala com o responsável.
 *
 * Existe porque o módulo **liga**: o boletim de internação exige ligação antes do envio
 * (`exigeLigacao`), a vaga que abre na fila precisa de resposta em minutos e a confirmação de
 * véspera sai por um canal só. Sem este campo, quem está de plantão às onze da noite decide no
 * chute entre ligar e mandar mensagem — e erra com quem nunca atende o telefone.
 */
export type ContatoPreferido = 'whatsapp' | 'ligacao' | 'email'

export type Tutor = {
  id: string
  nome: string
  telefone: string
  /**
   * Segundo número, para quando o primeiro não atende.
   *
   * A internação transforma "não consegui falar" em problema clínico: o boletim fica retido, a
   * alta espera e alguém precisa autorizar procedimento. Um número só é ponto único de falha num
   * fluxo que não tolera espera.
   */
  telefoneSecundario: string
  email: string
  /** CPF do responsável. Vazio quando ninguém informou; quando preenchido, é validado. */
  documento: string
  preferenciaContato: ContatoPreferido
  /** `null` enquanto ninguém informou — ver `EnderecoPostal`. */
  endereco: EnderecoPostal | null
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
  /**
   * Medicação de uso contínuo.
   *
   * O terceiro alerta que o vet precisa ver **sem clicar**, ao lado de alergia e comorbidade —
   * e o que decide interação na hora de prescrever. Um paciente em enalapril não recebe
   * anti-inflamatório sem que alguém pense duas vezes.
   */
  | 'medicacao-continua'
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
  /**
   * Nulo quando ninguém informou.
   *
   * O cadastro daqui sempre pergunta, mas a base que chega de outro sistema nem sempre sabe: a
   * planilha de balcão tem a coluna em branco em boa parte das linhas. Escolher um sexo para
   * vencer o campo seria inventar o dado que o atestado imprime — o mesmo motivo do nascimento
   * logo abaixo. Quem mostra escreve "sexo não informado".
   */
  sexo: PetSex | null
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
  /**
   * Número do transponder, sem formatação.
   *
   * É a única identificação do paciente que não depende de alguém reconhecer o animal — e a que
   * documento assinado pede. O atestado de óbito tem campo de microchip desde sempre; até agora
   * ele saía em branco porque o cadastro não perguntava, e a clínica preenchia à mão um número
   * que já estava na ficha de papel.
   */
  microchip: string
  /**
   * Cor e tipo de pelagem, como a clínica descreveria para alguém reconhecer o animal.
   *
   * Identificação, não estética: é o que separa dois SRD pretos do mesmo porte no mapa de leitos,
   * e o que o atestado de óbito exige junto de espécie, raça e sexo.
   */
  pelagem: string
  tutorId: string
  alertas: PetAlert[]
  /** Iniciais para o avatar, usadas quando não há retrato. */
  iniciais: string
  /**
   * O retrato do animal.
   *
   * Vazio em toda a camada mocada, e de propósito: povoar o repositório de fotos inventadas
   * criaria retratos falsos que alguém acabaria tomando por dado real. O campo existe para que a
   * interface já fale a língua da API — `PetAvatar` mostra a foto quando ela chega e desenha o
   * avatar de iniciais enquanto não chega.
   */
  fotoUrl: string
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

/**
 * Por que o paciente não veio.
 *
 * Cancelamento e falta são coisas diferentes, e por isso não compartilham a lista de motivos.
 * Cancelar é um aviso — alguém decidiu antes e a clínica pôde reaproveitar o horário. Falta é
 * um horário queimado, e o motivo dela só existe **depois**, quando a clínica liga para
 * perguntar. É por isso que a justificativa pode não existir: ela nasce de uma conversa que
 * ainda não aconteceu.
 *
 * `kind`, nunca texto livre. É o que permite contar "quantas faltas foram esquecimento" — que é
 * a pergunta que muda a política — e traduzir nos seis idiomas do portal.
 */
export type MotivoDeFalta =
  /** Esqueceu, ou errou o dia. O motivo mais comum, e o único que lembrete resolve. */
  | 'esqueceu'
  | 'imprevisto'
  | 'transporte'
  /** Achou que não precisava mais: o bicho melhorou sozinho. */
  | 'paciente-melhorou'
  /** Piorou e foi para outro lugar — plantão, emergência. */
  | 'emergencia'
  | 'custo'
  | 'insatisfacao'
  /**
   * O paciente morreu.
   *
   * Não é "mais um motivo da lista", e o código trata isso em voz alta: é o único que **encerra**
   * a conversa em vez de continuá-la. Registrado, a clínica para de oferecer remarcação para
   * aquele horário e para de tratar a ausência como algo a cobrar.
   *
   * Precisa existir justamente porque a alternativa é pior: sem ele, a falta de um animal que
   * morreu fica para sempre como "sem justificativa", e a recepção liga para um responsável de
   * luto perguntando por que ele não apareceu. Ver `domain/faltas.ts`.
   */
  | 'obito'
  | 'outro'

/**
 * Como a clínica chegou ao responsável.
 *
 * `sem-resposta` é o valor que faz esta lista valer a pena: registra a tentativa que não deu em
 * nada. Sem ele, a recepção não distingue "ninguém ligou ainda" de "ligamos três vezes e não
 * atenderam" — e liga de novo para quem já foi procurado.
 *
 * `app` é o único que a recepção não escolhe: é o responsável justificando sozinho, pelo app
 * (`POST /tutor/clinica/agendamentos/:id/justificar-falta`). Ele não aparece no diálogo da
 * falta, só no histórico — e é a falta que ninguém precisou ligar para entender.
 */
export type CanalDeContato = 'telefone' | 'whatsapp' | 'presencial' | 'sem-resposta' | 'app'

/**
 * A justificativa de uma falta.
 *
 * Guarda **quem registrou e quando** junto com o motivo, porque o valor dela é ser prova de que
 * a clínica procurou o responsável. Sem isso, "sem justificativa" e "ninguém tentou" viram a
 * mesma linha na tela, e a segunda é a única que pede trabalho.
 */
export type JustificativaDeFalta = {
  motivo: MotivoDeFalta
  canal: CanalDeContato
  /** Detalhe livre: só o que o `kind` não cobre. Entra no histórico, nunca em contagem. */
  observacao: string
  professionalId: string
  registradaEm: ISODateTime
}

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
  /**
   * Por que o paciente não veio. `null` enquanto ninguém falou com o responsável.
   *
   * Nulo é um estado de verdade, e não um dado faltando: a falta é marcada na hora em que o
   * horário passa, e o motivo só aparece quando alguém liga. O painel de faltas existe em boa
   * parte para essa fila — as que ainda estão sem justificativa.
   */
  justificativaDeFalta: JustificativaDeFalta | null
  encounterId: string | null
  /** Atendimentos ligados (mesma cirurgia em duas salas) compartilham o grupo. */
  linkedGroupId: string | null
  criadoEm: ISODateTime
  atualizadoEm: ISODateTime
  /**
   * Presença confirmada, e por onde. Ausente ou `null`: ninguém confirmou.
   *
   * O status `confirmado` sozinho não dizia quem confirmou — e "o responsável tocou Confirmar
   * no app ontem à noite" e "a recepção ligou e alguém atendeu" pesam diferente na hora de
   * decidir se vale ligar de novo.
   */
  confirmacao?: ConfirmacaoDePresenca | null
}

export type ConfirmacaoDePresenca = {
  em: ISODateTime
  por: 'app' | 'recepcao'
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
  /**
   * Com quem é a vaga oferecida. Ausente nas ofertas antigas, que caem no profissional pedido.
   *
   * Sem ele, o aceite não sabia em que coluna marcar: a entrada pede "qualquer profissional", e
   * a vaga que abriu é de alguém.
   */
  ofertaProfessionalId?: string | null
  observacao: string
  /** O atendimento que o aceite criou. É o que fecha a fila: aceitar vira horário marcado. */
  appointmentId?: string | null
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
export type PreConsulta = RespostaDaPreConsulta & {
  appointmentId: string
  /** Quando o responsável respondeu. Resposta de duas semanas atrás vale menos. */
  respondidoEm: ISODateTime
}

// ---------------------------------------------------------------------------
// Diário do responsável
// ---------------------------------------------------------------------------

/**
 * Um registro do Diário Pet, na forma em que a clínica o recebe (`EntradaDoDiarioParaClinica`,
 * do contrato), guardado junto do pet a que pertence.
 *
 * É o dado que só este produto tem: o que aconteceu em casa entre uma consulta e outra. É
 * **leitura** para a clínica — nenhum campo daqui é editado do lado de cá —, e os enums são os
 * do `DiarioPet` do app, literais. Ver `contrato/responsavel.ts`.
 */
export type RegistroDoDiario = EntradaDoDiarioParaClinica & { petId: string }

/** Um `PesoRegistro` do app: balança de casa. Tendência vale, grama não. */
export type PesagemDeCasa = PesoParaClinica & { petId: string }

/**
 * O que o responsável deixa a clínica ver do diário, entre as consultas.
 *
 * É ele, e não a existência do diário, que decide se o "Este pet em 30 segundos" mostra o que
 * aconteceu em casa. Diário sem consentimento é diário que a clínica não lê.
 */
export type ConsentimentoDoResponsavel = ConsentimentoDaClinica & { tutorId: string }

// ---------------------------------------------------------------------------
// O que foi feito no paciente
// ---------------------------------------------------------------------------

export type AtoClinicoKind = 'medicamento' | 'procedimento'

/**
 * De onde o ato veio — e, por consequência, quem manda nele.
 *
 * Só `clinica` e `avulso` são **gravados** como ato. Vacina e internação já têm registro
 * próprio, mais rico que este: a aplicação de vacina carrega lote e validade porque a
 * farmacovigilância os exige, e a administração de internação carrega o plantão em que caiu a
 * execução. Copiá-los para cá criaria duas versões do mesmo fato, que divergem no primeiro
 * acerto feito em um lado só. Eles entram na história **derivados**, na leitura.
 *
 * `avulso` é o que o responsável conta e a clínica não viu acontecer: castração feita em outro
 * serviço, vermífugo dado em casa. Vale registrar — o vet precisa saber —, e vale dizer que a
 * clínica não presenciou.
 */
export type OrigemDoAto = 'clinica' | 'internacao' | 'vacina' | 'avulso'

/**
 * Um ato clínico **executado** no paciente, com a hora em que foi executado.
 *
 * É a diferença entre o que foi mandado fazer e o que de fato aconteceu — e é a segunda coisa
 * que o módulo não guardava fora da internação. Receita de consulta diz o que o responsável deve
 * dar em casa; não diz que a dipirona foi aplicada na veia ali mesmo, nem que o curativo foi
 * trocado, nem quando. Sem isso, "o que este animal já recebeu?" só tinha resposta em quem
 * lembrava.
 *
 * `realizadoEm` é obrigatório e é o ponto do registro: ato sem hora não responde à pergunta que
 * faz alguém procurá-lo — se a reação começou antes ou depois da aplicação.
 */
export type AtoClinico = {
  id: string
  petId: string
  kind: AtoClinicoKind
  origem: OrigemDoAto
  /** Atendimento em que aconteceu, quando aconteceu em um. É o elo para o prontuário. */
  encounterId: string | null
  internacaoId: string | null
  /** Só em `kind: 'medicamento'` que saiu do bulário; procedimento não tem catálogo. */
  medicamentoId: string | null
  /** O que foi feito, na frase que quem leu o prontuário vai encontrar. */
  descricao: string
  via: PrescriptionRoute | null
  doseTexto: string
  realizadoEm: ISODateTime
  /** Quem executou. Vazio em `avulso`: a clínica não viu acontecer. */
  professionalId: string
  observacao: string
}

// ---------------------------------------------------------------------------
// Vacinação
// ---------------------------------------------------------------------------

/**
 * Vacina do catálogo da clínica.
 *
 * Existe separado do `AppointmentType` porque "vacina" como tipo de agendamento responde
 * *quanto tempo reservar*; isto aqui responde *o que foi aplicado*. Sem este catálogo, o
 * comprovante saía com o campo do produto em branco e não servia para viagem nem condomínio —
 * que são as duas situações em que ele é pedido.
 */
export type Vacina = {
  id: string
  nome: string
  fabricante: string
  especies: PetSpecies[]
  /** Doses da série inicial. Filhote toma três de V10; adulto toma uma. */
  dosesNaSerie: number
  /** Dias até o reforço. É daqui que sai o recall — a recorrência que sustenta a clínica. */
  intervaloReforcoDias: number
  /** Obrigatória por lei ou por exigência de viagem. Muda a insistência do lembrete. */
  obrigatoria: boolean
  /**
   * Doses abaixo das quais a clínica precisa comprar.
   *
   * É por vacina, e não um número único da clínica, porque o que define o piso é o **giro**:
   * antirrábica sai toda semana e precisa de fôlego; FeLV sai uma vez por mês e um piso alto
   * só serviria para deixar frasco vencendo na geladeira.
   */
  estoqueMinimo: number
}

/**
 * Por que uma dose saiu do estoque sem entrar em paciente.
 *
 * Separado em três de propósito: os três se corrigem de formas diferentes. `quebra` é manuseio,
 * `temperatura` é equipamento — a mais cara, porque leva o lote inteiro junto — e `vencimento` é
 * compra mal dimensionada. Um número só de "perdas" não diz qual conversa ter.
 */
export type MotivoDePerda = 'quebra' | 'temperatura' | 'vencimento'

export type PerdaDeLote = {
  em: ISODate
  quantidade: number
  motivo: MotivoDePerda
}

/**
 * Um lote de vacina na geladeira.
 *
 * **O que saiu não é campo deste tipo.** As doses consumidas são contadas a partir das
 * aplicações que citam o `codigo` — a mesma string que já vai na carteira do animal. Guardar um
 * contador aqui criaria uma segunda verdade sobre o mesmo fato, e as duas divergiriam no
 * primeiro registro de aplicação que falhasse no meio.
 */
export type LoteDeVacina = {
  id: string
  vacinaId: string
  /** O código impresso no frasco. É a chave que liga a aplicação ao lote. */
  codigo: string
  fornecedor: string
  recebidoEm: ISODate
  validade: ISODate
  quantidadeRecebida: number
  /** Custo unitário em **centavos**. Dinheiro em inteiro, nunca em ponto flutuante. */
  custoUnitario: number
  perdas: PerdaDeLote[]
}

/**
 * Uma aplicação registrada.
 *
 * `lote` e `validadeLote` não são burocracia: é o que a farmacovigilância exige rastrear se
 * houver reação adversa em lote, e o que a companhia aérea confere no balcão.
 */
export type AplicacaoVacina = {
  id: string
  petId: string
  vacinaId: string
  professionalId: string
  aplicadaEm: ISODateTime
  lote: string
  validadeLote: ISODate
  /** Qual dose da série. 1 de 3, 2 de 3… */
  dose: number
  via: PrescriptionRoute
  /** Data calculada do reforço, congelada na aplicação. */
  proximaDoseEm: ISODate
  observacao: string
}

/** Situação do reforço de um paciente. Recalculada, nunca persistida. */
export type SituacaoDoReforco = 'em-dia' | 'proximo' | 'vencido' | 'serie-incompleta'

export type ReforcoPendente = {
  petId: string
  vacinaId: string
  /** A última aplicação desta vacina neste paciente. */
  ultimaEm: ISODateTime
  proximaDoseEm: ISODate
  situacao: SituacaoDoReforco
  /** Negativo quando já venceu. É o número que ordena a lista de recall. */
  diasParaVencer: number
  /** Dose seguinte da série, quando a série ainda não fechou. */
  doseSeguinte: number | null
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
  /**
   * Quando o resumo do atendimento foi liberado para o responsável ver no app. Ausente ou
   * `null`: ainda não foi.
   *
   * É um passo separado de finalizar, de propósito. Finalizar fecha o prontuário, que é da
   * clínica; liberar entrega ao responsável o que ele precisa levar para casa — e o vet pode
   * querer revisar a orientação antes de ela chegar num celular.
   */
  resumoLiberadoEm?: ISODateTime | null
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
  /**
   * Quantas destas faltas ainda não têm motivo registrado.
   *
   * É a fila de trabalho do painel. Reincidência diz com quem **conversar**; este número diz
   * quem ainda nem foi procurado — e são perguntas diferentes: um responsável com cinco faltas
   * todas justificadas por transporte não precisa de ligação, precisa de outro horário.
   */
  semJustificativa: number
}

export type SlotSugestao = {
  professionalId: string
  inicio: ISODateTime
  fim: ISODateTime
  conflitos: Conflict[]
  /** Menor é melhor: distância em minutos da preferência original. */
  distanciaMinutos: number
}

// ---------------------------------------------------------------------------
// Internação
// ---------------------------------------------------------------------------

/**
 * Um leito nomeado dentro de uma sala de internação.
 *
 * A sala já existe (`Room` de kind `internacao`), e não basta: a clínica interna **por leito**,
 * não por sala. "Recuperação" comporta seis animais, e a pergunta da recepção ao telefone é
 * "tem vaga?" — que só tem resposta se a unidade de ocupação for o leito.
 *
 * `kind` não é decoração: gato ao lado de cão late a noite inteira e não come, e paciente com
 * parvovirose não divide ar com pós-cirúrgico. Um mapa que ignore isso oferece a vaga errada.
 */
export type LeitoKind = 'geral' | 'felino' | 'isolamento' | 'uti'

/**
 * Por que um leito saiu de operação.
 *
 * `kind`, e não texto livre, pela mesma razão que o motivo de cancelamento da agenda: é o que
 * permite contar quantos leitos a clínica perde por reforma num trimestre, e traduzir nos quatro
 * idiomas. O texto que descreve o caso concreto vai no `detalheInativo`, ao lado.
 */
export type LeitoInativoMotivo =
  | 'manutencao'
  | 'desinfeccao'
  | 'reforma'
  | 'equipamento'
  | 'outro'

/**
 * Um leito da clínica.
 *
 * **O sistema não adivinha quantos leitos existem.** Quem monta a internação é a clínica: ela
 * cadastra os leitos que tem, dá nome a eles, e mexe nesse número quando cresce ou reforma. Por
 * isso o leito é dado editável, e não constante de código.
 */
export type Leito = {
  id: string
  nome: string
  roomId: string
  kind: LeitoKind
  /** Fora de operação por manutenção ou desinfecção — ocupa espaço no mapa e não recebe. */
  ativo: boolean
  /** Só faz sentido com `ativo: false`. Nulo enquanto o leito está em operação. */
  motivoInativo: LeitoInativoMotivo | null
  /** O caso concreto: "trocar a grade", "aguardando peça". Vazio quando o motivo basta. */
  detalheInativo: string
  /**
   * Desde quando está parado.
   *
   * É o que transforma "em manutenção" em informação: um leito parado há duas horas é uma
   * manutenção; parado há três semanas é uma vaga que a clínica esqueceu que tinha.
   */
  inativoDesde: ISODateTime | null
}

/**
 * Gravidade do paciente internado, no julgamento de quem está de plantão.
 *
 * É o eixo que ordena o mapa de leitos e o **único** dado do módulo que muda o comportamento do
 * boletim: piorar não é uma cor diferente na tela, é uma regra de comunicação (ver
 * `domain/internacao.ts`).
 */
export type GravidadeClinica = 'estavel' | 'atencao' | 'critico'

export type InternacaoStatus = 'internado' | 'alta' | 'obito' | 'transferido'

/**
 * Uma internação.
 *
 * Dura dias e **não é um `Appointment`**: agendamento tem começo e fim na grade, internação tem
 * entrada e uma alta que ninguém sabe quando será. Forçá-la na agenda produziria um atendimento
 * de 72 horas atravessando três colunas de profissional — e a agenda perderia a única coisa que
 * ela faz bem, que é caber num dia.
 *
 * Nasce de uma decisão dentro de uma consulta: por isso `encounterId` aponta para o atendimento
 * que a originou, e é `null` quando o animal chegou internado de outro serviço.
 */
export type Internacao = {
  id: string
  petId: string
  tutorId: string
  leitoId: string
  /** Veterinário responsável pelo caso — não é quem está de plantão agora. */
  responsavelId: string
  encounterId: string | null
  motivo: string
  /** Diagnóstico de trabalho, em texto: a internação começa antes de ele fechar. */
  diagnostico: string
  entradaEm: ISODateTime
  /**
   * Previsão de alta, sempre um chute e sempre exibida como tal.
   *
   * Existe porque é a primeira pergunta do responsável e porque o mapa de leitos precisa
   * projetar vaga. `null` quando é cedo demais para arriscar.
   */
  altaPrevistaEm: ISODateTime | null
  altaEm: ISODateTime | null
  status: InternacaoStatus
  gravidade: GravidadeClinica
  /** Peso na entrada. Toda dose do plantão é recalculada sobre ele, não sobre o cadastro. */
  pesoEntradaKg: number
  observacao: string
}

/**
 * O que foi prescrito para o plantão executar.
 *
 * Deliberadamente **não** é `Prescription`: aquela é receita para o responsável dar em casa, com
 * duração em dias e assinatura para a farmácia. Esta é ordem de serviço interna, medida em
 * horários, e metade dela nem é medicamento — "aferir temperatura 4/4 h" e "fluidoterapia a 60
 * mL/h" são prescrição de internação e não cabem em nenhuma receita.
 */
export type ItemDePrescricaoKind =
  | 'medicamento'
  | 'fluido'
  | 'monitoramento'
  | 'alimentacao'
  | 'procedimento'

export type PrescricaoDeInternacao = {
  id: string
  internacaoId: string
  kind: ItemDePrescricaoKind
  /** Preenchido só quando `kind` é `medicamento`; o resto do bulário não descreve. */
  medicamentoId: string | null
  /** O que a enfermagem lê no checklist. Para medicamento, a dose já calculada. */
  descricao: string
  via: PrescriptionRoute | null
  doseTexto: string
  /** De quantas em quantas horas. 24 é uma vez ao dia. */
  frequenciaHoras: number
  /**
   * Fluido em bomba não tem horário: corre.
   *
   * Contínuo entra no checklist como **conferência** de horário em horário, não como
   * administração — e é por isso que precisa ser um campo, não uma frequência inventada.
   */
  continuo: boolean
  primeiroHorario: ISODateTime
  /** `null` é "até segunda ordem" — que é o normal em internação. */
  encerraEm: ISODateTime | null
  prescritoPor: string
  prescritoEm: ISODateTime
  suspensaEm: ISODateTime | null
  /** Motivo da suspensão, em texto: quem lê o checklist amanhã precisa saber por quê. */
  motivoSuspensao: string
  observacao: string
}

/**
 * Situação **persistida** de uma administração.
 *
 * `atrasada` não está aqui de propósito: atraso é uma leitura do relógio contra o horário
 * previsto, e gravá-lo produziria um registro que envelhece errado — a dose marcada como
 * atrasada às 14h continuaria atrasada depois de dada às 14h10. Ver
 * `situacaoDaAdministracao()`.
 */
export type AdministracaoStatus = 'pendente' | 'feita' | 'pulada' | 'recusada' | 'suspensa'

/** O que a leitura devolve, já cruzada com o relógio. */
export type SituacaoDaAdministracao =
  | 'futura'
  | 'na-janela'
  | 'atrasada'
  | 'feita'
  | 'pulada'
  | 'recusada'
  | 'suspensa'

/**
 * Um horário concreto de uma prescrição.
 *
 * Materializado no momento da prescrição, e não derivado na leitura, porque **o registro de
 * quem executou precisa de uma linha para morar**. Derivar os horários faria "dado por Helena
 * às 14h05" pendurar em nada; e suspender a prescrição amanhã apagaria as doses de ontem, que
 * é justamente o que a auditoria de um óbito vai procurar.
 */
export type AdministracaoAgendada = {
  id: string
  internacaoId: string
  prescricaoId: string
  previstaPara: ISODateTime
  status: AdministracaoStatus
  executadaEm: ISODateTime | null
  /** Quem executou. Não é quem prescreveu, e a diferença é o ponto do registro. */
  executadaPor: string | null
  /** Plantão em que caiu a execução — pode não ser o plantão da previsão. */
  plantaoId: string | null
  observacao: string
}

export type PlantaoKind = 'manha' | 'tarde' | 'noite'

/**
 * Um plantão.
 *
 * A passagem de turno é o momento em que a informação mais se perde numa internação, e o
 * protótipo a trata como registro, não como conversa: `entregueEm` e `recebidoPor` existem para
 * que exista uma resposta à pergunta "quem estava com o paciente às 3 da manhã".
 */
export type Plantao = {
  id: string
  kind: PlantaoKind
  inicio: ISODateTime
  fim: ISODateTime
  responsavelId: string
  /** Nulo enquanto o plantão está aberto. */
  entregueEm: ISODateTime | null
  recebidoPor: string | null
  notaDePassagem: string
  /**
   * Administrações que o plantão **não** fechou e passou adiante, congeladas na entrega.
   *
   * Congeladas porque a lista precisa dizer o que estava pendente **naquele instante**;
   * recalculada depois, ela mostraria a pendência já resolvida pelo turno seguinte e a
   * passagem perderia o sentido.
   */
  pendenciasEntregues: string[]
}

/**
 * Evolução de um plantão sobre um paciente.
 *
 * Uma por plantão e por paciente — não uma por turno inteiro. O que interessa a quem assume às
 * 19h é "como o Bento passou a tarde", e uma nota única do turno misturaria seis pacientes num
 * parágrafo que ninguém relê.
 */
export type EvolucaoDeInternacao = {
  id: string
  internacaoId: string
  plantaoId: string
  professionalId: string
  registradoEm: ISODateTime
  /** Vitais do turno. Mesmo `Measurement` do prontuário: `naoAferido` continua sendo informação. */
  vitais: Record<VitalKey, Measurement>
  /** O que o animal fez: comeu, urinou, dormiu. É o que o responsável quer ouvir. */
  observado: string
  /** Leitura clínica do turno. */
  avaliacao: string
  /** O que o próximo plantão precisa fazer. */
  plano: string
  gravidade: GravidadeClinica
}

/**
 * Frequência com que o responsável recebe boletim.
 *
 * `1` existe porque o requisito o pede — o responsável que quer notícia de hora em hora. Não é
 * um capricho a ser negado: é o mesmo responsável que hoje liga quatro vezes por dia, e cada
 * ligação custa mais à recepção do que um boletim automático.
 */
export type FrequenciaDeBoletim = 1 | 2 | 4 | 6 | 8 | 12 | 24

export type PreferenciaDeBoletim = {
  internacaoId: string
  frequenciaHoras: FrequenciaDeBoletim
  /** Foto em todo boletim. O responsável quase sempre quer; a clínica nem sempre pode. */
  fotoSempre: boolean
  /**
   * Silêncio noturno.
   *
   * Boletim de hora em hora às 3 da manhã acorda o responsável para dizer que o animal dorme.
   * Quando ligado, a madrugada acumula e sai num boletim só ao amanhecer — salvo piora, que
   * nunca espera.
   */
  silencioNoturno: boolean
}

/**
 * Situação de um boletim.
 *
 * `retido` é o estado que dá razão a este tipo existir. Um boletim de piora **não sai sozinho**:
 * fica retido até alguém da clínica ligar para o responsável. Notícia grave chegando por
 * notificação de aplicativo, sem voz humana antes, é a forma mais rápida de transformar um
 * diferencial de produto num processo.
 */
export type BoletimStatus = 'rascunho' | 'retido' | 'liberado' | 'enviado'

export type BoletimOrigem = 'automatico' | 'manual'

export type BoletimAoTutor = {
  id: string
  internacaoId: string
  /**
   * Boletim de alta é a mensagem que encerra a conversa, e o app a mostra diferente. Ausente
   * vale `atualizacao`.
   */
  tipo?: 'atualizacao' | 'alta'
  origem: BoletimOrigem
  status: BoletimStatus
  /** Gravidade no instante em que o boletim foi composto — o texto fala dela. */
  gravidade: GravidadeClinica
  texto: string
  /** Iniciais que o mock desenha no lugar da foto; a API trará a URL. */
  foto: string | null
  fotoLegenda: string
  geradoEm: ISODateTime
  /** Quem compôs ou revisou. `null` em boletim automático que ninguém tocou. */
  autorId: string | null
  enviadoEm: ISODateTime | null
  /**
   * Ligação exigida antes do envio, e o instante em que foi feita.
   *
   * Duas informações e não uma: `exigeLigacao` sem `ligacaoEm` é o boletim travado, e é esse
   * par que a tela precisa mostrar para que o travamento seja compreensível em vez de parecer
   * um bug.
   */
  exigeLigacao: boolean
  ligacaoEm: ISODateTime | null
  ligacaoPor: string | null
}

// ---------------------------------------------------------------------------
// Escuta da consulta (anamnese por voz)
// ---------------------------------------------------------------------------

/**
 * Quem falou um trecho da conversa.
 *
 * `nao-identificado` é o estado honesto do reconhecimento ao vivo, que não separa vozes: ele
 * entrega texto, não autoria. Trecho de duas vozes ao mesmo tempo também cai aqui — a
 * interferência diz o resto.
 */
export type FalanteDaEscuta = 'veterinario' | 'responsavel' | 'acompanhante' | 'nao-identificado'

/**
 * O que atrapalhou a escuta de um trecho.
 *
 * É o que a clínica tem de sobra e o reconhecimento de voz não sabe resolver sozinho: cachorro
 * latindo na recepção, duas pessoas respondendo ao mesmo tempo, porta, secador. O trecho
 * atrapalhado continua na conversa — apagá-lo esconderia de onde o erro veio —, mas tudo que
 * nasce dele chega à revisão marcado.
 */
export type InterferenciaDaEscuta = 'latido' | 'fala-sobreposta' | 'ruido'

/**
 * Um trecho da conversa, como o reconhecimento de voz o entrega: texto final, sem o áudio.
 *
 * **O áudio não é guardado em lugar nenhum.** O que fica é este texto, e é ele que a revisão
 * cita. Por isso o trecho é imutável: corrigir a transcrição apagaria a prova de que um campo
 * veio do que foi dito — quem corrige é o campo, nunca a conversa.
 */
export type TrechoDaConversa = {
  id: string
  falante: FalanteDaEscuta
  /** Vazio quando o trecho é só a interferência — um latido sem fala por cima. */
  texto: string
  /** Milissegundos desde o começo da gravação. */
  emMs: number
  /** Confiança do reconhecimento, de 0 a 1. */
  confianca: number
  interferencia: InterferenciaDaEscuta | null
}
