/**
 * Contrato do módulo clínico — visão do responsável.
 *
 * É a forma que os dados têm **no fio**, entre a API e os dois clientes: o portal da clínica
 * (este repositório) e o app do responsável (`petjourney-app`). Os dois protótipos mocados falam
 * exatamente estes tipos, para que ligar a API real seja trocar a fonte, não a forma.
 *
 * **Este arquivo é a fonte.** O app copia o arquivo como está para
 * `src/features/clinica/contrato.ts`; mudança de contrato começa aqui e é recopiada lá. Não
 * existe pacote compartilhado entre os repositórios — ver `docs/clinico/09-*.md`.
 *
 * Regras de forma, todas herdadas da API que já existe:
 *
 * - Ids são `cuid` do Prisma (opacos; o mock pode usar qualquer string estável).
 * - Data e hora em ISO 8601 **com offset** (`2026-09-25T10:00:00-04:00`), no fuso da clínica.
 *   Data sem hora em `YYYY-MM-DD`.
 * - Enum em MAIÚSCULAS_COM_SUBLINHADO. Os do diário são **os mesmos do Prisma** (`SintomaPet`,
 *   `ConsumoDiario`...), copiados literalmente — nada de escala nova onde o app já tem uma.
 * - O enum viaja cru; o rótulo é do cliente (i18n do app). Texto **escrito pela clínica**
 *   (orientação, boletim, mensagem) viaja pronto, no idioma em que foi escrito, e diz qual é.
 * - Lista paginada: `{ data, meta: { proximoCursor } }`, como `GET /parceiro/portal/compartilhamentos`.
 * - Erro: o corpo do `HttpExceptionFilter` mais um `codigo` estável (ver `CodigoDeErroClinico`).
 * - Campo opcional ausente = chave omitida, não `null`, onde o DTO usa `@IsOptional` com teto
 *   (ex.: `duracaoDias` contínuo). Onde o tipo diz `| null`, o `null` é explícito.
 *
 * Quem é quem no banco que já existe:
 *
 * - **A clínica é um `Parceiro`** com `categoria = CLINICA_VETERINARIA` — `clinicaId` é o
 *   `Parceiro.id`. As tabelas `Clinica`, `Veterinario` e `ClinicasPacientes` são legado
 *   dormente; o vínculo clínica ↔ pet deste módulo é novo (ver `docs/clinico/09-*.md`).
 * - **Os campos `pode*` já consideram quem está olhando.** Membro da família com acesso de
 *   leitura recebe tudo, com todos os `pode*` em `false`: vê, não age.
 */

// ---------------------------------------------------------------------------
// Convenções
// ---------------------------------------------------------------------------

export type Cuid = string
/** ISO 8601 com offset do fuso da clínica. */
export type DataHoraIso = string
/** `YYYY-MM-DD`. */
export type DataIso = string
/** `HH:mm`, relógio da clínica. */
export type HoraDoDia = string
/** Idioma de um texto escrito por gente (tag BCP 47): `pt-BR`, `en-US`... */
export type IdiomaDoTexto = string

export type Pagina<T> = {
  data: T[]
  meta: { proximoCursor: string | null }
}

export type ConsultaPaginada = {
  cursor?: string
  /** 1–50, padrão 20. */
  limit?: number
}

/**
 * Códigos que o cliente precisa distinguir para decidir a tela — não para mostrar: a mensagem
 * legível continua vindo em `message`, já no idioma do pedido.
 */
export type CodigoDeErroClinico =
  | 'HORARIO_INDISPONIVEL'
  | 'RESERVA_EXPIRADA'
  | 'FORA_DO_PRAZO_DE_CANCELAMENTO'
  | 'AGENDAMENTO_ENCERRADO'
  | 'PRE_CONSULTA_FECHADA'
  | 'OFERTA_EXPIRADA'
  | 'VAGA_JA_PREENCHIDA'
  | 'CLINICA_NAO_AGENDA_PELO_APP'
  | 'PET_SEM_ACESSO'
  | 'PET_INATIVO'
  /** Membro da família com escopo `LEITURA`: vê o módulo, não age nele. */
  | 'SOMENTE_LEITURA'
  /** Depois de uma queda de plano, até o responsável escolher os pets ativos. */
  | 'SELECAO_PETS_PENDENTE'
  /** Foto da pré-consulta fora do tipo ou do tamanho. */
  | 'FOTO_INVALIDA'

export type ErroDaApi = {
  statusCode: number
  timestamp: DataHoraIso
  path: string
  message: string
  codigo?: CodigoDeErroClinico
}

// ---------------------------------------------------------------------------
// Enums que já existem no Prisma — cópia literal, não editar aqui sem editar lá
// ---------------------------------------------------------------------------

export const SINTOMAS_PET = [
  'FEBRE',
  'VOMITO',
  'DIARREIA',
  'FRAQUEZA',
  'LETARGIA',
  'TREMORES',
  'COCEIRA',
  'ESPIRRO',
  'TOSSE',
  'CONVULSAO',
  'FALTA_DE_AR',
  'SECRECAO_OCULAR',
  'SECRECAO_NASAL',
  'HALITOSE',
  'CLAUDICACAO',
  'SANGRAMENTO',
  'DESIDRATACAO',
  'INCHACO',
  'PERDA_DE_PESO',
  'QUEDA_DE_PELO',
  'LAMBEDURA_EXCESSIVA',
] as const
export type SintomaPet = (typeof SINTOMAS_PET)[number]

export const CONSUMOS_DIARIO = [
  'MUITO',
  'NORMAL',
  'POUCO',
  'NADA',
  'RECUSOU',
  'VOMITOU_APOS',
] as const
export type ConsumoDiario = (typeof CONSUMOS_DIARIO)[number]

export const ASPECTOS_FEZES = [
  'NORMAL',
  'MOLE',
  'PASTOSA',
  'DIARREIA',
  'RESSECADA',
  'COM_SANGUE',
  'COM_MUCO',
  'COM_VERMES',
  'ESCURA',
  'CLARA',
  'NAO_DEFECOU',
] as const
export type AspectoFezes = (typeof ASPECTOS_FEZES)[number]

export const ESTADOS_URINA = [
  'NORMAL',
  'MUITO',
  'POUCO',
  'NADA',
  'COM_SANGUE',
  'ESCURA',
  'COM_DIFICULDADE',
  'COM_ODOR_FORTE',
] as const
export type EstadoUrina = (typeof ESTADOS_URINA)[number]

export const VITALIDADES_PET = [
  'AGITADO',
  'ATIVO',
  'NORMAL',
  'CALMO',
  'SONOLENTO',
  'DESANIMADO',
  'APATICO',
  'LETARGICO',
] as const
export type VitalidadePet = (typeof VITALIDADES_PET)[number]

export const DOENCAS_DIARIO = [
  'GRIPE',
  'ALERGIA',
  'INFECCAO',
  'INFECCAO_URINARIA',
  'VIROSE',
  'INTOXICACAO',
  'VERMINOSE',
  'OTITE',
  'CONJUNTIVITE',
  'DERMATITE',
  'GASTRITE',
  'COLICA',
  'INDIGESTAO',
] as const
export type DoencaDiario = (typeof DOENCAS_DIARIO)[number]

/** `TipoConsulta` do Prisma: é o tipo da `Consulta` que o resumo liberado vira no prontuário do pet. */
export const TIPOS_DE_CONSULTA = [
  'CONSULTA',
  'RETORNO',
  'EXAME',
  'CIRURGIA',
  'EMERGENCIA',
  'VACINA',
] as const
export type TipoDeConsulta = (typeof TIPOS_DE_CONSULTA)[number]

export const MOTIVOS_VISITA = [
  'CHECKUP',
  'SINTOMA',
  'RETORNO',
  'EXAME',
  'VACINA',
  'EMERGENCIA',
  'OUTRO',
] as const
export type MotivoVisita = (typeof MOTIVOS_VISITA)[number]

// ---------------------------------------------------------------------------
// Enums novos deste contrato
// ---------------------------------------------------------------------------

export const TIPOS_DE_SERVICO_CLINICO = [
  'CONSULTA',
  'RETORNO',
  'VACINA',
  'EXAME',
  'CIRURGIA',
  'BANHO',
  'EMERGENCIA',
] as const
export type TipoDeServicoClinico = (typeof TIPOS_DE_SERVICO_CLINICO)[number]

export const STATUS_DE_AGENDAMENTO = [
  'AGENDADO',
  'CONFIRMADO',
  /** Chegou e está na recepção. */
  'AGUARDANDO',
  'EM_ATENDIMENTO',
  'FINALIZADO',
  'FALTA',
  'CANCELADO',
] as const
export type StatusDeAgendamento = (typeof STATUS_DE_AGENDAMENTO)[number]

export const ORIGENS_DE_AGENDAMENTO = [
  'APP',
  'RECEPCAO',
  'TELEFONE',
  'ENCAIXE',
  'RETORNO',
  'FILA',
] as const
export type OrigemDeAgendamento = (typeof ORIGENS_DE_AGENDAMENTO)[number]

export const MOTIVOS_DE_CANCELAMENTO = [
  'RESPONSAVEL_DESMARCOU',
  'CLINICA_REMARCOU',
  'PACIENTE_INDISPONIVEL',
  'DUPLICADO',
  'OUTRO',
] as const
export type MotivoDeCancelamento = (typeof MOTIVOS_DE_CANCELAMENTO)[number]

export const MOTIVOS_DE_FALTA = [
  'ESQUECEU',
  'IMPREVISTO',
  'TRANSPORTE',
  'PACIENTE_MELHOROU',
  'EMERGENCIA',
  'CUSTO',
  'INSATISFACAO',
  /** Encerra o caso: nenhuma oferta de remarcação, nenhum lembrete desta clínica para o pet. */
  'OBITO',
  'OUTRO',
] as const
export type MotivoDeFalta = (typeof MOTIVOS_DE_FALTA)[number]

/** Por onde a justificativa chegou. `APP` é o valor novo: o responsável justificou sozinho. */
export const CANAIS_DE_JUSTIFICATIVA = [
  'TELEFONE',
  'WHATSAPP',
  'PRESENCIAL',
  'SEM_RESPOSTA',
  'APP',
] as const
export type CanalDeJustificativa = (typeof CANAIS_DE_JUSTIFICATIVA)[number]

export const STATUS_NA_FILA = ['AGUARDANDO', 'OFERTADO', 'ACEITO', 'EXPIRADO', 'REMOVIDO'] as const
export type StatusNaFila = (typeof STATUS_NA_FILA)[number]

/**
 * Há quanto tempo. Faixa, não texto livre: "uns dias" não ordena e não traduz. Não existe no
 * app hoje — é campo novo da pré-consulta.
 */
export const DURACOES_DA_QUEIXA = [
  'HOJE',
  'UM_A_DOIS_DIAS',
  'TRES_A_SETE_DIAS',
  'UMA_A_DUAS_SEMANAS',
  'MAIS_DE_DUAS_SEMANAS',
] as const
export type DuracaoDaQueixa = (typeof DURACOES_DA_QUEIXA)[number]

/** Como o quadro anda. Não é `VitalidadePet`: vitalidade é disposição, isto é trajetória. */
export const EVOLUCOES_DA_QUEIXA = ['PIORANDO', 'ESTAVEL', 'MELHORANDO', 'VAI_E_VOLTA'] as const
export type EvolucaoDaQueixa = (typeof EVOLUCOES_DA_QUEIXA)[number]

export const VIAS_DE_ADMINISTRACAO = [
  'ORAL',
  'SUBCUTANEA',
  'INTRAMUSCULAR',
  'INTRAVENOSA',
  'TOPICA',
  'OTOLOGICA',
] as const
export type ViaDeAdministracao = (typeof VIAS_DE_ADMINISTRACAO)[number]

/**
 * Como partir o comprimido. O responsável lê "meio comprimido", nunca "0,5". `null` no item quer
 * dizer que a unidade não se parte (líquido se mede).
 */
export const FRACOES_DE_DOSE = [
  'INTEIRO',
  'MEIO',
  'UM_E_MEIO',
  'QUARTO',
  'TRES_QUARTOS',
  'MULTIPLO',
  'APROXIMADO',
] as const
export type FracaoDeDose = (typeof FRACOES_DE_DOSE)[number]

export const UNIDADES_DE_DOSE = ['COMPRIMIDO', 'ML', 'GOTA', 'APLICACAO'] as const
export type UnidadeDeDose = (typeof UNIDADES_DE_DOSE)[number]

/**
 * `VENCIDO` é **atrasado no sentido do app**: passou da data e da carência de
 * `CARENCIA_DE_ATRASO_DA_VACINA_DIAS`. Entre a data e a carência a dose é `PROXIMO` — é o mesmo
 * relógio do `VACINA_ATRASADA` que o app já recebe.
 */
export const SITUACOES_DO_REFORCO = ['EM_DIA', 'PROXIMO', 'VENCIDO', 'SERIE_INCOMPLETA'] as const
export type SituacaoDoReforco = (typeof SITUACOES_DO_REFORCO)[number]

/**
 * Dias depois da data prevista em que a dose vira atrasada. É o `AJUSTES.vacinaAtrasoDias` da
 * API e o `VACINA_ATRASO_DIAS` do app (`constants/vacina-atraso.ts`) — o mesmo número nos três.
 */
export const CARENCIA_DE_ATRASO_DA_VACINA_DIAS = 3

/**
 * Vias de vacina. Não é `ViaDeAdministracao` (a da receita): vacina não é intravenosa nem
 * otológica, e a traqueobronquite canina é **intranasal**, que receita nenhuma usa.
 */
export const VIAS_DE_VACINA = ['SUBCUTANEA', 'INTRAMUSCULAR', 'INTRANASAL', 'ORAL'] as const
export type ViaDeVacina = (typeof VIAS_DE_VACINA)[number]

/** `EXTERNA` é a dose que a clínica registrou mas **não aplicou**: pet shop, campanha, outra clínica. */
export const ORIGENS_DA_VACINA = ['CLINICA', 'EXTERNA'] as const
export type OrigemDaVacina = (typeof ORIGENS_DA_VACINA)[number]

/** `COMPROVANTE`: a clínica viu o papel. `RELATO`: só a palavra do responsável. */
export const PROCEDENCIAS_DA_VACINA_EXTERNA = ['COMPROVANTE', 'RELATO'] as const
export type ProcedenciaDaVacinaExterna = (typeof PROCEDENCIAS_DA_VACINA_EXTERNA)[number]

export const STATUS_DE_INTERNACAO = ['INTERNADO', 'ALTA', 'OBITO', 'TRANSFERIDO'] as const
export type StatusDeInternacao = (typeof STATUS_DE_INTERNACAO)[number]

export const FREQUENCIAS_DE_BOLETIM = [1, 2, 4, 6, 8, 12, 24] as const
export type FrequenciaDeBoletim = (typeof FREQUENCIAS_DE_BOLETIM)[number]

export const TIPOS_DE_BOLETIM = ['ATUALIZACAO', 'ALTA'] as const
export type TipoDeBoletim = (typeof TIPOS_DE_BOLETIM)[number]

export const TIPOS_DE_DOCUMENTO_CLINICO = [
  'PRONTUARIO',
  'RECEITUARIO',
  'PEDIDO_EXAME',
  'ORIENTACOES',
  'ENCAMINHAMENTO',
  'RELATORIO_PLANO',
  'ATESTADO_SAUDE',
  'ATESTADO_COMPARECIMENTO',
  'ATESTADO_VIAGEM',
  'DECLARACAO_OBITO',
  'COMPROVANTE_VACINACAO',
  'TERMO_CONSENTIMENTO',
  'TERMO_RECUSA',
  'TERMO_EUTANASIA',
  'ORCAMENTO',
] as const
export type TipoDeDocumentoClinico = (typeof TIPOS_DE_DOCUMENTO_CLINICO)[number]

/**
 * Tipos novos para `TipoNotificacao` (categoria `CLINICO`). Cada um precisa de entrada em
 * `ROTA_POR_TIPO` no app — e o `Record` é fechado, então todos entram **na mesma release**.
 */
export const TIPOS_DE_NOTIFICACAO_CLINICA = [
  'AGENDAMENTO_CRIADO_PELA_CLINICA',
  'AGENDAMENTO_LEMBRETE_VESPERA',
  'AGENDAMENTO_REMARCADO',
  'AGENDAMENTO_CANCELADO_PELA_CLINICA',
  'AGENDAMENTO_FALTA',
  'PRE_CONSULTA_PENDENTE',
  'FILA_VAGA_OFERECIDA',
  'ATENDIMENTO_RESUMO_DISPONIVEL',
  'RETORNO_PENDENTE',
  'VACINA_REFORCO_PROXIMO',
  'INTERNACAO_BOLETIM',
  'INTERNACAO_ALTA',
] as const
export type TipoDeNotificacaoClinica = (typeof TIPOS_DE_NOTIFICACAO_CLINICA)[number]

// ---------------------------------------------------------------------------
// Limites (espelham os DTOs; o cliente valida antes, o servidor valida sempre)
// ---------------------------------------------------------------------------

export const LIMITES_CLINICOS = {
  observacaoDoAgendamento: 500,
  queixaPrincipal: 1000,
  observacaoDaPreConsulta: 2000,
  sintomasNaPreConsulta: 5,
  fotosNaPreConsulta: 3,
  pesoMinKg: 0.01,
  pesoMaxKg: 500,
  observacaoDaFila: 500,
  janelasNaFila: 14,
  observacaoDaJustificativa: 500,
  /** Janela máxima de busca de horários, em dias. */
  horizonteDeHorariosDias: 60,
  /** As mesmas regras da foto do diário (`POST /diario-pet/:id/foto`). */
  fotoDaPreConsultaMaxBytes: 8 * 1024 * 1024,
  fotoDaPreConsultaTipos: ['image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  /**
   * `LembreteSerie.intervaloHoras` aceita de 1 a 72. Frequência maior que isso vira
   * `frequencia` semanal, quinzenal ou mensal; o que não couber em nenhuma é recusado.
   */
  intervaloDeLembreteMaxHoras: 72,
} as const

// ---------------------------------------------------------------------------
// Clínica, vínculo e consentimento
// ---------------------------------------------------------------------------

export type PoliticaDaClinica = {
  /** Cancelar ou remarcar pelo app só até tantas horas antes. Depois, só por telefone. */
  cancelarAteHorasAntes: number
  /** Quanto tempo o horário fica segurado enquanto o responsável revisa. */
  reservaMinutos: number
  /** A pré-consulta abre tantas horas antes do horário e fecha no início dele. */
  preConsultaAbreHorasAntes: number
  /** Prazo para responder a uma oferta de vaga da fila. O app nunca fixa este número. */
  ofertaDeVagaMinutos: number
}

export type ClinicaDoResponsavel = {
  /** `Parceiro.id` (categoria `CLINICA_VETERINARIA`). */
  id: Cuid
  nome: string
  fotoUrl: string | null
  telefone: string
  telefoneSecundario: string | null
  enderecoResumo: string
  /** Offset da clínica. Todos os horários desta clínica vêm nele. */
  utcOffset: string
  aceitaAgendamentoPeloApp: boolean
  politica: PoliticaDaClinica
  /**
   * Pets do responsável que esta clínica já atende. O vínculo nasce no primeiro agendamento ou
   * atendimento — é um modelo novo; o `ClinicasPacientes` é legado.
   */
  petIds: Cuid[]
  consentimento: ConsentimentoDaClinica
  /**
   * Só o dono do pet muda o consentimento — como só ele cria compartilhamento hoje. Membro da
   * família vê o que foi liberado, não mexe.
   */
  podeAlterarConsentimento: boolean
}

/**
 * O que o responsável deixa esta clínica ver entre as consultas.
 *
 * `diarioCompleto` é o que alimenta o "Este pet em 30 segundos" do lado da clínica: o diário
 * inteiro, com enum cru, desde a última consulta. O compartilhamento temporário que já existe
 * manda só 15 registros com sintoma, rotulados — não serve para resumir.
 */
export type ConsentimentoDaClinica = {
  diarioCompleto: boolean
  peso: boolean
  /**
   * A `nota` do diário é o campo que o responsável escreve para si. Só vai à clínica com este
   * sim, separado do resto — como o `incluirNotasDiario` do compartilhamento temporário.
   */
  notas: boolean
  atualizadoEm: DataHoraIso | null
}

export type AtualizarConsentimento = Partial<
  Pick<ConsentimentoDaClinica, 'diarioCompleto' | 'peso' | 'notas'>
>

export type ProfissionalResumo = {
  id: Cuid
  nome: string
  /**
   * A mesma regra da `Consulta.veterinarioEspecialidade` da API: a **chave** quando é uma da
   * lista do app (`consultaForm.especialidades`: `CLINICO_GERAL`, `CARDIOLOGIA`...), o texto
   * livre quando não é ("Anestesiologia"). O app traduz a chave; texto livre aparece como veio.
   */
  especialidade: string | null
  fotoUrl: string | null
}

export type PetResumo = {
  id: Cuid
  nome: string
  fotoUrl: string | null
}

export type ClinicaResumo = Pick<ClinicaDoResponsavel, 'id' | 'nome' | 'telefone' | 'utcOffset'>

// ---------------------------------------------------------------------------
// Agendamento
// ---------------------------------------------------------------------------

export type ServicoAgendavel = {
  id: Cuid
  nome: string
  tipo: TipoDeServicoClinico
  duracaoMinutos: number
  /** A clínica pede pré-consulta para este serviço. */
  temPreConsulta: boolean
}

export type HorarioLivre = {
  inicio: DataHoraIso
  fim: DataHoraIso
  profissional: ProfissionalResumo
}

export type BuscarHorarios = {
  servicoId: Cuid
  petId: Cuid
  de: DataIso
  ate: DataIso
  /** Ausente = qualquer profissional. */
  profissionalId?: Cuid
}

export type CriarReserva = {
  clinicaId: Cuid
  servicoId: Cuid
  petId: Cuid
  profissionalId: Cuid
  inicio: DataHoraIso
}

/** Horário segurado enquanto o responsável revisa. Some sozinho em `expiraEm`. */
export type Reserva = {
  id: Cuid
  clinicaId: Cuid
  servicoId: Cuid
  petId: Cuid
  profissionalId: Cuid
  inicio: DataHoraIso
  fim: DataHoraIso
  expiraEm: DataHoraIso
}

export type CriarAgendamento = {
  reservaId: Cuid
  observacao?: string
}

export type ResumoDaPreConsulta = {
  situacao: 'AINDA_NAO_ABRIU' | 'ABERTA' | 'RESPONDIDA' | 'FECHADA'
  abreEm: DataHoraIso
  fechaEm: DataHoraIso
  respondidaEm: DataHoraIso | null
}

export type Agendamento = {
  id: Cuid
  clinica: ClinicaResumo
  pet: PetResumo
  servico: ServicoAgendavel
  profissional: ProfissionalResumo
  inicio: DataHoraIso
  fim: DataHoraIso
  status: StatusDeAgendamento
  origem: OrigemDeAgendamento
  /** O que o responsável escreveu ao marcar. */
  observacao: string
  criadoEm: DataHoraIso
  canceladoEm: DataHoraIso | null
  motivoCancelamento: MotivoDeCancelamento | null
  /**
   * Regras calculadas **no servidor**. O app não recalcula prazo: um relógio só, senão o botão
   * aparece e a API recusa. Já consideram o escopo de quem olha (família em leitura: tudo
   * `false`).
   */
  podeConfirmar: boolean
  podeCancelar: boolean
  podeRemarcar: boolean
  /** Depois deste instante, cancelar só por telefone. `null` quando já não se aplica. */
  cancelarAte: DataHoraIso | null
  preConsulta: ResumoDaPreConsulta | null
  /**
   * Presente quando `status` é `FALTA`. `motivo` e `canal` ficam `null` até alguém justificar
   * — pelo app ou pela clínica —, e é esse `null` que faz a tela pedir a justificativa.
   */
  falta: { motivo: MotivoDeFalta | null; canal: CanalDeJustificativa | null } | null
  /** Aparece depois de `FINALIZADO`, quando a clínica libera o resumo. */
  atendimentoId: Cuid | null
}

export type ListarAgendamentos = ConsultaPaginada & {
  petId?: Cuid
  quando: 'PROXIMOS' | 'PASSADOS'
}

export type CancelarAgendamento = {
  observacao?: string
}

export type RemarcarAgendamento = {
  reservaId: Cuid
}

export type JustificarFalta = {
  motivo: MotivoDeFalta
  observacao?: string
}

// ---------------------------------------------------------------------------
// Lista de espera
// ---------------------------------------------------------------------------

export type JanelaDaFila = {
  /** 0 = domingo. */
  diaDaSemana: 0 | 1 | 2 | 3 | 4 | 5 | 6
  inicio: HoraDoDia
  fim: HoraDoDia
}

export type OfertaDeVaga = {
  inicio: DataHoraIso
  fim: DataHoraIso
  profissional: ProfissionalResumo
  /** Quem manda no prazo é o servidor. O contador do app desce até este instante. */
  expiraEm: DataHoraIso
}

export type EntradaNaFila = {
  id: Cuid
  clinica: ClinicaResumo
  pet: PetResumo
  servico: ServicoAgendavel
  /** `null` = qualquer profissional. */
  profissional: ProfissionalResumo | null
  janelas: JanelaDaFila[]
  status: StatusNaFila
  /**
   * Posição entre quem espera (1 = próximo). `null` fora de `AGUARDANDO`. A **prioridade** que a
   * clínica dá a cada entrada não viaja: é triagem da clínica, e mostrar "urgente" dos outros
   * não é da conta de ninguém.
   */
  posicao: number | null
  oferta: OfertaDeVaga | null
  observacao: string
  criadoEm: DataHoraIso
  /** Preenchido quando a oferta foi aceita: o horário que virou agendamento. */
  agendamentoId: Cuid | null
}

export type EntrarNaFila = {
  clinicaId: Cuid
  petId: Cuid
  servicoId: Cuid
  profissionalId?: Cuid
  janelas: JanelaDaFila[]
  observacao?: string
}

// ---------------------------------------------------------------------------
// Pré-consulta
// ---------------------------------------------------------------------------

/**
 * O que o responsável responde antes do horário.
 *
 * Do lado da clínica chega como **sugestão**: o vet vê, aplica o que quiser na anamnese, e o
 * peso de casa nunca vira peso aferido. Por isso a procedência não se perde — `origem` diz se o
 * valor foi digitado agora ou puxado do diário.
 */
export type RespostaDaPreConsulta = {
  motivo: MotivoVisita
  queixaPrincipal: string
  sintomas: SintomaPet[]
  desdeQuando: DuracaoDaQueixa | null
  evolucao: EvolucaoDaQueixa | null
  alimentacao: ConsumoDiario | null
  hidratacao: ConsumoDiario | null
  fezes: AspectoFezes | null
  urina: EstadoUrina | null
  vitalidade: VitalidadePet | null
  /** Balança de casa. */
  pesoKg: number | null
  pesadoEm: DataIso | null
  observacao: string
  /** Ids de arquivo já enviados pelo upload existente. */
  fotoIds: Cuid[]
  /** Campos que vieram do diário e o responsável não mexeu. */
  camposDoDiario: Array<
    'alimentacao' | 'hidratacao' | 'fezes' | 'urina' | 'vitalidade' | 'pesoKg' | 'sintomas'
  >
}

export type PreConsulta = {
  agendamentoId: Cuid
  situacao: ResumoDaPreConsulta['situacao']
  abreEm: DataHoraIso
  fechaEm: DataHoraIso
  respondidaEm: DataHoraIso | null
  resposta: RespostaDaPreConsulta | null
  /**
   * Sugestões montadas do diário dos últimos 3 dias e do último peso, para o formulário abrir
   * preenchido. `null` quando o pet não tem diário no período.
   */
  sugestao: Partial<Omit<RespostaDaPreConsulta, 'camposDoDiario'>> | null
}

export type ResponderPreConsulta = RespostaDaPreConsulta

// ---------------------------------------------------------------------------
// Diário lido pela clínica — lado do portal, fixado aqui para os dois concordarem
// ---------------------------------------------------------------------------

/** Um registro do `DiarioPet`, cru. A clínica rotula; nada chega traduzido. */
export type EntradaDoDiarioParaClinica = {
  id: Cuid
  data: DataHoraIso
  vitalidade: VitalidadePet | null
  alimentacao: ConsumoDiario | null
  hidratacao: ConsumoDiario | null
  fezes: AspectoFezes | null
  urina: EstadoUrina | null
  sintomas: SintomaPet[]
  sintomasOutros: string | null
  doencas: DoencaDiario[]
  observacoes: string | null
  remedios: string | null
  /** Só quando o responsável liberou notas no consentimento. */
  nota: string | null
  fotoIds: Cuid[]
}

/** Um `PesoRegistro`. */
export type PesoParaClinica = {
  id: Cuid
  data: DataHoraIso
  pesoKg: number
}

/** `GET /parceiro/portal/pacientes/:petId/diario?desde=` — exige `consentimento.diarioCompleto`. */
export type DiarioParaClinica = {
  petId: Cuid
  desde: DataHoraIso
  entradas: EntradaDoDiarioParaClinica[]
  pesos: PesoParaClinica[]
}

// ---------------------------------------------------------------------------
// Depois da consulta
// ---------------------------------------------------------------------------

export type ItemDaReceita = {
  id: Cuid
  /** Nome e apresentação, como na receita impressa. */
  medicamento: string
  /** Quantidade por vez já na unidade que se dá (0,5 comprimido; 2,5 ml). */
  quantidade: number
  unidade: UnidadeDeDose
  /** Como partir. `null` quando a unidade não se parte. */
  fracao: FracaoDeDose | null
  frequenciaHoras: number
  /** Ausente = **uso contínuo**: o lembrete não tem data de fim. Nunca 365. */
  duracaoDias?: number
  via: ViaDeAdministracao
  /** Texto da clínica (ex.: "dar após a refeição"), no idioma `idioma` da receita. */
  instrucoes: string
  /**
   * O tratamento que nasceu deste item quando alguém da casa tocou "Criar lembretes". `null`
   * enquanto não criou — o item mostra o botão; com ele, "Lembrete ativo" leva ao tratamento
   * (seção "Adesão ao tratamento").
   */
  tratamentoId: Cuid | null
}

export type ReceitaParaResponsavel = {
  id: Cuid
  /** `XXXX-XXXX-XXXX-XXXX`, sem I e sem O. É o que a farmácia confere. */
  codigoVerificador: string
  emitidaEm: DataHoraIso
  validaAte: DataIso
  /** Controle especial (Portaria 344/98): a farmácia retém uma via. */
  controlada: boolean
  profissional: ProfissionalResumo
  idioma: IdiomaDoTexto
  itens: ItemDaReceita[]
  documentoId: Cuid | null
}

export type ExameSolicitado = {
  nome: string
  jejum: boolean
  observacao: string
}

export type RetornoSugerido = {
  emDias: number
  venceEm: DataIso
  servicoId: Cuid
  /** Profissional que atendeu: o retorno sugere o mesmo. */
  profissionalId: Cuid
  /** Preenchido quando já foi marcado. */
  agendamentoId: Cuid | null
}

export type DocumentoClinico = {
  id: Cuid
  tipo: TipoDeDocumentoClinico
  titulo: string
  emitidoEm: DataHoraIso
  codigoVerificador: string | null
  /** URL assinada; pedir outra em `GET /tutor/clinica/documentos/:id/url` quando expirar. */
  url: string
  urlExpiraEm: DataHoraIso
  exigeAssinaturaDoResponsavel: boolean
  assinadoPeloResponsavelEm: DataHoraIso | null
  /**
   * O `Documents` do pet criado a partir deste, quando o responsável tocou "Salvar nos
   * documentos". `null` enquanto não salvou — o documento da clínica não é copiado sozinho.
   */
  documentoDoPetId: Cuid | null
}

/** Resposta de `POST /tutor/clinica/documentos/:id/salvar-nos-documentos`. Salvar de novo devolve o mesmo. */
export type DocumentoSalvoNoPet = {
  documentoDoPetId: Cuid
  jaExistia: boolean
}

/**
 * O que o responsável recebe quando a consulta termina. Escrito para quem não é da área: sem
 * mg/kg, sem código de diagnóstico, sem o exame físico.
 */
export type ResumoDoAtendimento = {
  id: Cuid
  agendamentoId: Cuid
  /**
   * A `Consulta` do prontuário do pet que este atendimento virou ao ser liberado — uma só, com
   * vínculo de volta. É ela que aparece na linha do tempo e na lista de consultas do app; esta
   * tela é o detalhe rico dela. Ver "Uma consulta, não duas" no doc.
   */
  consultaId: Cuid | null
  tipoDeConsulta: TipoDeConsulta
  clinica: ClinicaResumo
  profissional: ProfissionalResumo
  pet: PetResumo
  realizadoEm: DataHoraIso
  idioma: IdiomaDoTexto
  motivo: string
  /** Diagnósticos já achatados em frase. Diferencial não entra. */
  diagnostico: string
  orientacoes: string
  /** Sinais para voltar antes do retorno. */
  sinaisDeAlerta: string
  /** Aferido na balança da clínica hoje. */
  pesoAferidoKg: number | null
  receita: ReceitaParaResponsavel | null
  exames: ExameSolicitado[]
  retorno: RetornoSugerido | null
  documentos: DocumentoClinico[]
}

/**
 * Lembretes de dose a partir da receita. Cada item escolhe a hora da primeira dose; as seguintes
 * saem de `frequenciaHoras`.
 *
 * Vira o que o app já tem: uma `LembreteSerie` do tipo `MEDICAMENTO`, recorrente — com
 * `repetirAte` no fim do tratamento, ou sem fim no uso contínuo, que além disso cria um
 * `TratamentoFixo` (é assim que o app já registra remédio contínuo).
 */
export type CriarLembretesDaReceita = {
  itens: Array<{ itemId: Cuid; primeiraDoseEm: DataHoraIso }>
  /**
   * Deixar a clínica que prescreveu ver o que a casa registrar nestes lembretes. A tela de criar
   * diz isso com todas as letras e vem ligada; desligar aqui ou depois não apaga o lembrete, só
   * fecha a janela da clínica (seção "Adesão ao tratamento").
   */
  compartilharComAClinica: boolean
}

export type LembreteCriadoDaReceita = {
  itemId: Cuid
  lembreteSerieId: Cuid
  /** Só no uso contínuo. */
  tratamentoFixoId: Cuid | null
  /** O `TratamentoDoPet` que a casa passa a registrar, dose a dose. */
  tratamentoId: Cuid
}

// ---------------------------------------------------------------------------
// Vacinas aplicadas na clínica
// ---------------------------------------------------------------------------

/**
 * Uma dose **registrada pela clínica** — aplicada nela (`CLINICA`) ou transcrita de fora
 * (`EXTERNA`). O nome ficou do tempo em que só havia a primeira; a segunda chegou com a
 * carteirinha conectada (`docs/clinico/14-*.md`).
 *
 * O selo "Aplicada na {clínica}" é da `CLINICA` e só dela. A `EXTERNA` mostra onde foi aplicada e
 * quem a registrou aqui — nunca o selo: a clínica não pode assinar o que não aplicou.
 */
export type VacinaAplicadaNaClinica = {
  id: Cuid
  petId: Cuid
  /** Quem registrou. Na `CLINICA` é também onde foi aplicada. */
  clinica: ClinicaResumo
  origem: OrigemDaVacina
  /** Quem aplicou. `null` na `EXTERNA`: quem responde por ela é `externa.registradaPor`. */
  profissional: ProfissionalResumo | null
  vacina: { nome: string; fabricante: string; obrigatoria: boolean; essencial: boolean }
  aplicadaEm: DataHoraIso
  /** `null` na `EXTERNA`: a clínica não aplicou e não inventa um código. */
  lote: string | null
  validadeLote: DataIso | null
  /** `null` quando o papel de fora não diz. */
  via: ViaDeVacina | null
  /** 1 de 3, 2 de 3... O total é o da série **deste** pet, congelado quando ela começou. */
  dose: number
  dosesNaSerie: number
  proximaDoseEm: DataIso
  /** O horário que a clínica já marcou para a próxima dose. `null` = a marcar. */
  proximaDoseAgendada: { agendamentoId: Cuid; inicio: DataHoraIso } | null
  situacao: SituacaoDoReforco
  externa: {
    /** Como está no papel: "Pet Shop Amigo Fiel", "Campanha municipal". */
    local: string
    aplicador: string | null
    procedencia: ProcedenciaDaVacinaExterna
    registradaPor: ProfissionalResumo
    registradaEm: DataHoraIso
  } | null
  /**
   * A `Vacina` da carteira do app que esta aplicação fechou, quando havia uma pendente com o
   * mesmo nome. É o que impede a vacina de aparecer duas vezes.
   */
  vacinaDaCarteiraId: Cuid | null
}

// ---------------------------------------------------------------------------
// Internação
// ---------------------------------------------------------------------------

export type PreferenciaDeBoletim = {
  frequenciaHoras: FrequenciaDeBoletim
  fotoSempre: boolean
  /** Das 22h às 7h a clínica junta os boletins num só ao amanhecer. Piora nunca espera. */
  silencioNoturno: boolean
}

/**
 * `NaClinica` no nome porque o app já tem uma `Internacao`: o registro que o próprio
 * responsável escreve, pendurado num lembrete. São coisas diferentes, e a desta tela é da clínica.
 */
export type InternacaoNaClinica = {
  id: Cuid
  pet: PetResumo
  clinica: ClinicaResumo
  status: StatusDeInternacao
  entradaEm: DataHoraIso
  /** Texto da clínica. */
  motivo: string
  /** Sempre estimativa, e a tela diz isso. `null` quando é cedo para arriscar. */
  altaPrevistaEm: DataHoraIso | null
  encerradaEm: DataHoraIso | null
  responsavelClinico: ProfissionalResumo
  preferencias: PreferenciaDeBoletim
  /**
   * **Não existe** contagem de boletins retidos aqui, de propósito: boletim de piora só sai
   * depois que a clínica liga, e um "1 boletim aguardando" no app contaria a notícia antes da
   * ligação.
   */
  ultimoBoletimEm: DataHoraIso | null
}

export type BoletimDaInternacao = {
  id: Cuid
  internacaoId: Cuid
  tipo: TipoDeBoletim
  texto: string
  idioma: IdiomaDoTexto
  fotoUrl: string | null
  fotoLegenda: string | null
  enviadoEm: DataHoraIso
  /** Saiu depois de a clínica ter ligado: o app mostra como registro da conversa. */
  aposLigacao: boolean
}

export type AtualizarPreferenciaDeBoletim = Partial<PreferenciaDeBoletim>

// ---------------------------------------------------------------------------
// Notificações (campo `dados` da `Notificacao`, por tipo)
// ---------------------------------------------------------------------------

/**
 * O que toda notificação clínica carrega, no padrão das que já existem (`DadosLembreteVencido`):
 * o `url` de destino e a marca de quando quem recebe é membro da família, não o dono.
 *
 * Título e corpo **não** estão aqui: saem do catálogo do backend (`NOTIFICACAO_CATALOG`), no
 * idioma do aparelho, como toda notificação do app. `mensagemDaClinica` é o texto que a pessoa
 * da clínica escreveu ou ajustou, no idioma dela — aparece dentro da tela, citado, não no push.
 */
type BaseDaNotificacaoClinica = {
  url: string
  paraMembro?: boolean
}

type ComMensagemDaClinica = {
  mensagemDaClinica: string | null
  idiomaDaMensagem: IdiomaDoTexto | null
}

type ComAgendamento = {
  agendamentoId: Cuid
  petId: Cuid
  petNome: string
  clinicaNome: string
  inicio: DataHoraIso
}

export type DadosDaNotificacaoClinica = BaseDaNotificacaoClinica &
  (
    | ({ tipo: 'AGENDAMENTO_CRIADO_PELA_CLINICA' } & ComAgendamento & ComMensagemDaClinica)
    | ({ tipo: 'AGENDAMENTO_LEMBRETE_VESPERA' } & ComAgendamento)
    | ({ tipo: 'AGENDAMENTO_REMARCADO'; inicioAnterior: DataHoraIso } & ComAgendamento &
        ComMensagemDaClinica)
    | ({
        tipo: 'AGENDAMENTO_CANCELADO_PELA_CLINICA'
        motivo: MotivoDeCancelamento
      } & ComAgendamento &
        ComMensagemDaClinica)
    | ({ tipo: 'AGENDAMENTO_FALTA' } & ComAgendamento & ComMensagemDaClinica)
    | ({ tipo: 'PRE_CONSULTA_PENDENTE'; fechaEm: DataHoraIso } & ComAgendamento)
    | ({
        tipo: 'FILA_VAGA_OFERECIDA'
        entradaId: Cuid
        petId: Cuid
        petNome: string
        clinicaNome: string
        inicio: DataHoraIso
        expiraEm: DataHoraIso
      } & ComMensagemDaClinica)
    | {
        tipo: 'ATENDIMENTO_RESUMO_DISPONIVEL'
        atendimentoId: Cuid
        petId: Cuid
        petNome: string
        clinicaNome: string
        temReceita: boolean
      }
    | {
        tipo: 'RETORNO_PENDENTE'
        atendimentoId: Cuid
        petId: Cuid
        petNome: string
        clinicaNome: string
        venceEm: DataIso
      }
    | {
        tipo: 'VACINA_REFORCO_PROXIMO'
        aplicacaoId: Cuid
        petId: Cuid
        petNome: string
        vacinaNome: string
        proximaDoseEm: DataIso
      }
    | {
        tipo: 'INTERNACAO_BOLETIM'
        internacaoId: Cuid
        boletimId: Cuid
        petId: Cuid
        petNome: string
        clinicaNome: string
      }
    | {
        tipo: 'INTERNACAO_ALTA'
        internacaoId: Cuid
        boletimId: Cuid
        petId: Cuid
        petNome: string
        clinicaNome: string
      }
  )

// ---------------------------------------------------------------------------
// Rotas — referência para o serviço do app e para a API
// ---------------------------------------------------------------------------

/**
 * Todas sob o prefixo do responsável. `:id` sempre `Cuid`. O que retorna está no comentário;
 * erro esperado entre colchetes.
 */
export const ROTAS_DO_RESPONSAVEL = {
  clinicas: 'GET /tutor/clinica/clinicas', // ClinicaDoResponsavel[]
  consentimento: 'PUT /tutor/clinica/clinicas/:clinicaId/consentimento', // AtualizarConsentimento → ConsentimentoDaClinica
  servicos: 'GET /tutor/clinica/clinicas/:clinicaId/servicos?petId=', // ServicoAgendavel[] [CLINICA_NAO_AGENDA_PELO_APP]
  profissionais: 'GET /tutor/clinica/clinicas/:clinicaId/profissionais?servicoId=', // ProfissionalResumo[]
  horarios: 'GET /tutor/clinica/clinicas/:clinicaId/horarios', // BuscarHorarios → HorarioLivre[]
  reservar: 'POST /tutor/clinica/reservas', // CriarReserva → Reserva [HORARIO_INDISPONIVEL]
  liberarReserva: 'DELETE /tutor/clinica/reservas/:id', // 204
  agendar: 'POST /tutor/clinica/agendamentos', // CriarAgendamento → Agendamento [RESERVA_EXPIRADA]
  agendamentos: 'GET /tutor/clinica/agendamentos', // ListarAgendamentos → Pagina<Agendamento>
  agendamento: 'GET /tutor/clinica/agendamentos/:id', // Agendamento
  confirmar: 'POST /tutor/clinica/agendamentos/:id/confirmar', // Agendamento [AGENDAMENTO_ENCERRADO]
  cancelar: 'POST /tutor/clinica/agendamentos/:id/cancelar', // CancelarAgendamento → Agendamento [FORA_DO_PRAZO_DE_CANCELAMENTO]
  remarcar: 'POST /tutor/clinica/agendamentos/:id/remarcar', // RemarcarAgendamento → Agendamento [FORA_DO_PRAZO_DE_CANCELAMENTO, RESERVA_EXPIRADA]
  justificarFalta: 'POST /tutor/clinica/agendamentos/:id/justificar-falta', // JustificarFalta → Agendamento
  preConsulta: 'GET /tutor/clinica/agendamentos/:id/pre-consulta', // PreConsulta
  responderPreConsulta: 'PUT /tutor/clinica/agendamentos/:id/pre-consulta', // ResponderPreConsulta → PreConsulta [PRE_CONSULTA_FECHADA]
  fotoDaPreConsulta: 'POST /tutor/clinica/agendamentos/:id/pre-consulta/fotos', // multipart `file` → { fotoId } [FOTO_INVALIDA, PRE_CONSULTA_FECHADA]
  fila: 'GET /tutor/clinica/fila', // EntradaNaFila[]
  entrarNaFila: 'POST /tutor/clinica/fila', // EntrarNaFila → EntradaNaFila
  sairDaFila: 'DELETE /tutor/clinica/fila/:id', // 204
  aceitarOferta: 'POST /tutor/clinica/fila/:id/oferta/aceitar', // Agendamento [OFERTA_EXPIRADA, VAGA_JA_PREENCHIDA]
  recusarOferta: 'POST /tutor/clinica/fila/:id/oferta/recusar', // EntradaNaFila
  atendimentos: 'GET /tutor/clinica/atendimentos?petId=', // Pagina<ResumoDoAtendimento>
  atendimento: 'GET /tutor/clinica/atendimentos/:id', // ResumoDoAtendimento
  lembretesDaReceita: 'POST /tutor/clinica/atendimentos/:id/receita/lembretes', // CriarLembretesDaReceita → LembreteCriadoDaReceita[]
  urlDoDocumento: 'GET /tutor/clinica/documentos/:id/url', // { url, urlExpiraEm }
  salvarNosDocumentos: 'POST /tutor/clinica/documentos/:id/salvar-nos-documentos', // DocumentoSalvoNoPet
  vacinas: 'GET /tutor/clinica/vacinas?petId=', // VacinaAplicadaNaClinica[]
  internacoes: 'GET /tutor/clinica/internacoes?petId=', // InternacaoNaClinica[]
  internacao: 'GET /tutor/clinica/internacoes/:id', // InternacaoNaClinica
  boletins: 'GET /tutor/clinica/internacoes/:id/boletins', // Pagina<BoletimDaInternacao>, mais recente primeiro
  preferenciaDeBoletim: 'PUT /tutor/clinica/internacoes/:id/preferencias', // AtualizarPreferenciaDeBoletim → PreferenciaDeBoletim
  // Lado do portal, aqui só para os dois concordarem:
  diarioParaClinica: 'GET /parceiro/portal/pacientes/:petId/diario?desde=', // DiarioParaClinica [PET_SEM_ACESSO]
} as const

// ---------------------------------------------------------------------------
// Para onde cada notificação leva
// ---------------------------------------------------------------------------

/**
 * A tela do app que cada notificação abre, no expo-router — o valor que entra no `ROTA_POR_TIPO`
 * da API **e** no do app.
 *
 * As telas de `/screens/clinica/` são novas: o app cria os arquivos com estes nomes, e a API não
 * inventa outro. Rota que não existe cai em "Unmatched Route" — o defeito que o próprio catálogo
 * da API registra ter deixado escapar duas vezes.
 */
export const ROTAS_DAS_NOTIFICACOES_CLINICAS: Record<TipoDeNotificacaoClinica, string> = {
  AGENDAMENTO_CRIADO_PELA_CLINICA: '/screens/clinica/agendamento',
  AGENDAMENTO_LEMBRETE_VESPERA: '/screens/clinica/agendamento',
  AGENDAMENTO_REMARCADO: '/screens/clinica/agendamento',
  AGENDAMENTO_CANCELADO_PELA_CLINICA: '/screens/clinica/agendamento',
  AGENDAMENTO_FALTA: '/screens/clinica/agendamento',
  PRE_CONSULTA_PENDENTE: '/screens/clinica/pre-consulta',
  FILA_VAGA_OFERECIDA: '/screens/clinica/fila',
  ATENDIMENTO_RESUMO_DISPONIVEL: '/screens/clinica/atendimento',
  RETORNO_PENDENTE: '/screens/clinica/atendimento',
  /* A carteira é a que o app já tem: a vacina da clínica aparece dentro dela, não numa tela à parte. */
  VACINA_REFORCO_PROXIMO: '/screens/vacina/lista',
  INTERNACAO_BOLETIM: '/screens/clinica/internacao',
  INTERNACAO_ALTA: '/screens/clinica/internacao',
}

/**
 * A `url` gravada em `dados`: a rota com `petId` e, quando a tela é de um item, o `id` dele.
 * É o `rotaComPet` da API com um parâmetro a mais — sem o `petId`, a tela por pet cai no último
 * pet ativo do aparelho, e "Notícias da Pipoca" abriria a Pérola.
 */
export function urlDaNotificacaoClinica(
  tipo: TipoDeNotificacaoClinica,
  petId: Cuid,
  id?: Cuid,
): string {
  const consulta = `petId=${encodeURIComponent(petId)}`

  return `${ROTAS_DAS_NOTIFICACOES_CLINICAS[tipo]}?${consulta}${id ? `&id=${encodeURIComponent(id)}` : ''}`
}

// ---------------------------------------------------------------------------
// Texto das notificações, em português
// ---------------------------------------------------------------------------

/**
 * Título e corpo de cada notificação clínica, em pt-BR.
 *
 * É o que o backend vai pôr no `NOTIFICACAO_CATALOG` (que renderiza no idioma do aparelho, em
 * quatro idiomas hoje), e é o que o mock do app usa enquanto não há backend. Os outros idiomas
 * são do catálogo da API — o app não traduz texto de notificação, ele mostra o que chega.
 *
 * Regras que todos seguem:
 *
 * - **Sem preposição antes do nome da clínica.** "na PetJourney", "no Hospital", "da Clínica":
 *   o artigo depende de um nome que ninguém controla. A clínica entra com ponto médio.
 * - **Boletim nunca adianta conteúdo.** O push aparece na tela bloqueada, para quem estiver
 *   perto do celular — e é pelo push que uma notícia ruim não pode chegar.
 * - **Horário é o da clínica.** Vem da própria string ISO, sem conversão de fuso.
 */
export const TEXTOS_PT_DAS_NOTIFICACOES: {
  [T in TipoDeNotificacaoClinica]: (dados: Extract<DadosDaNotificacaoClinica, { tipo: T }>) => {
    titulo: string
    corpo: string
  }
} = {
  AGENDAMENTO_CRIADO_PELA_CLINICA: (dados) => ({
    titulo: `Consulta marcada para ${dados.petNome}`,
    corpo: `${diaEHora(dados.inicio)} · ${dados.clinicaNome}`,
  }),
  AGENDAMENTO_LEMBRETE_VESPERA: (dados) => ({
    titulo: `Amanhã, ${hora(dados.inicio)}: ${dados.petNome}`,
    corpo: `${dados.clinicaNome}. Toque para confirmar presença.`,
  }),
  AGENDAMENTO_REMARCADO: (dados) => ({
    titulo: `O horário de ${dados.petNome} mudou`,
    corpo: `Agora é ${diaEHora(dados.inicio)} · ${dados.clinicaNome}`,
  }),
  AGENDAMENTO_CANCELADO_PELA_CLINICA: (dados) => ({
    titulo: `Horário de ${dados.petNome} cancelado pela clínica`,
    corpo: `Era ${diaEHora(dados.inicio)}. Toque para marcar outro.`,
  }),
  AGENDAMENTO_FALTA: (dados) => ({
    titulo: `Sentimos falta de ${dados.petNome}`,
    corpo: `A consulta de ${diaEHora(dados.inicio)} ficou sem ninguém. Conte o que houve e remarque.`,
  }),
  PRE_CONSULTA_PENDENTE: (dados) => ({
    titulo: `Como ${dados.petNome} está?`,
    corpo: `Responda antes da consulta de ${diaEHora(dados.inicio)}. Leva dois minutos.`,
  }),
  FILA_VAGA_OFERECIDA: (dados) => ({
    titulo: `Abriu um horário para ${dados.petNome}`,
    corpo: `${diaEHora(dados.inicio)} · ${dados.clinicaNome}. Responda até ${hora(dados.expiraEm)}.`,
  }),
  ATENDIMENTO_RESUMO_DISPONIVEL: (dados) => ({
    titulo: `Resumo da consulta de ${dados.petNome}`,
    corpo: dados.temReceita
      ? 'As orientações e a receita já estão no app.'
      : 'As orientações já estão no app.',
  }),
  RETORNO_PENDENTE: (dados) => ({
    titulo: `Retorno de ${dados.petNome}`,
    corpo: `O retorno indicado venceu em ${dia(dados.venceEm)}. Toque para marcar.`,
  }),
  VACINA_REFORCO_PROXIMO: (dados) => ({
    titulo: `Reforço de ${dados.vacinaNome} chegando`,
    corpo: `${dados.petNome} deve tomar até ${dia(dados.proximaDoseEm)}. Toque para agendar.`,
  }),
  INTERNACAO_BOLETIM: (dados) => ({
    titulo: `Notícias de ${dados.petNome}`,
    corpo: `Novo boletim · ${dados.clinicaNome}`,
  }),
  INTERNACAO_ALTA: (dados) => ({
    titulo: `${dados.petNome} recebeu alta`,
    corpo: 'Veja as orientações para casa.',
  }),
}

/** `2026-09-25T10:00:00-04:00` → `10:00`, sem conversão: o horário é o da clínica. */
function hora(iso: DataHoraIso): string {
  return iso.slice(11, 16)
}

/** `2026-09-25...` → `25/09`. */
function dia(isoOuData: DataHoraIso | DataIso): string {
  return `${isoOuData.slice(8, 10)}/${isoOuData.slice(5, 7)}`
}

function diaEHora(iso: DataHoraIso): string {
  return `${dia(iso)} às ${hora(iso)}`
}

// ---------------------------------------------------------------------------
// Vínculo proposto pela clínica — a base que veio de outro sistema
// ---------------------------------------------------------------------------

/*
 * Até aqui o vínculo clínica ↔ pet nascia de um gesto do responsável ou de um atendimento: o
 * primeiro agendamento, a primeira consulta. A importação da base (`docs/clinico/11-*.md`) cria o
 * caso inverso — **a clínica já conhece o responsável e o pet antes de o responsável conhecer o
 * app**. O vínculo que sai dela é uma proposta: o app mostra, a pessoa confirma pet a pet, e só
 * então a clínica passa a existir na área do pet. Passo a passo em `docs/clinico/12-*.md`.
 *
 * Nada desta seção entra ainda em `TIPOS_DE_NOTIFICACAO_CLINICA`: aquele `Record` é fechado no app
 * e obriga os tipos a entrar na mesma leva. `VINCULO_PROPOSTO` entra lá quando o app implementar
 * esta tela — até lá vive em `TIPO_DE_NOTIFICACAO_DO_VINCULO`, sem quebrar o build de quem recopiar.
 */

/** De onde nasceu o vínculo. `IMPORTACAO` é o único que chega como proposta. */
export const ORIGENS_DO_VINCULO = ['AGENDAMENTO', 'ATENDIMENTO', 'IMPORTACAO'] as const
export type OrigemDoVinculo = (typeof ORIGENS_DO_VINCULO)[number]

/** A espécie como o cadastro da clínica guarda — é o de-para da importação que a produz. */
export const ESPECIES_NA_CLINICA = ['CANINA', 'FELINA', 'AVE', 'ROEDOR', 'REPTIL', 'EQUINA'] as const
export type EspecieNaClinica = (typeof ESPECIES_NA_CLINICA)[number]

export const SEXOS_NA_CLINICA = ['MACHO', 'FEMEA'] as const
export type SexoNaClinica = (typeof SEXOS_NA_CLINICA)[number]

/** O pet como a clínica o conhece — ainda sem ligação com nenhum pet do app. */
export type PetNaClinica = {
  /** Id do paciente **na clínica**. Não é `Pet.id` do app. */
  id: Cuid
  nome: string
  especie: EspecieNaClinica
  raca: string | null
  /** `null` quando a planilha não dizia: a importação não inventa sexo. */
  sexo: SexoNaClinica | null
  nascimento: DataIso | null
  /**
   * O pet do app que parece ser este: mesmo nome e mesma espécie, do mesmo responsável, sem
   * vínculo com esta clínica. É palpite do servidor para a tela abrir com a escolha certa —
   * **nunca liga sozinho**.
   */
  sugestaoDoApp: PetResumo | null
}

export const SITUACOES_DO_VINCULO_PROPOSTO = ['PENDENTE', 'RESPONDIDO', 'RECUSADO', 'EXPIRADO'] as const
export type SituacaoDoVinculoProposto = (typeof SITUACOES_DO_VINCULO_PROPOSTO)[number]

export type VinculoProposto = {
  id: Cuid
  clinica: ClinicaResumo
  origem: 'IMPORTACAO'
  situacao: SituacaoDoVinculoProposto
  propostoEm: DataHoraIso
  /** O convite vence; o cadastro na clínica, não. Vencido, só um convite novo da clínica. */
  expiraEm: DataHoraIso
  /**
   * Como a clínica tem o responsável. Mascarado (`(11) 9••••-1030`, `ma•••@exemplo.com`): quem
   * abre o convite ainda não provou ser quem a clínica acha que é.
   */
  dadosNaClinica: {
    nome: string
    telefoneMascarado: string | null
    emailMascarado: string | null
  }
  /** Pode vir vazio: responsável importado sem animal ("só contato"). */
  pets: PetNaClinica[]
}

/**
 * Erros próprios da proposta. Separados de `CodigoDeErroClinico` pelo mesmo motivo da
 * notificação: entram lá junto com a tela, sem obrigar ninguém a tratá-los antes.
 */
export type CodigoDeErroDoVinculo = 'VINCULO_INCOMPLETO' | 'VINCULO_EXPIRADO'

export const ACOES_SOBRE_O_PET_NA_CLINICA = ['LIGAR', 'CRIAR', 'NAO_E_MEU'] as const
export type AcaoSobreOPetNaClinica = (typeof ACOES_SOBRE_O_PET_NA_CLINICA)[number]

/**
 * A resposta, pet a pet. Todo pet da proposta precisa de uma ação — a API recusa resposta
 * parcial com `VINCULO_INCOMPLETO`, para não sobrar pet "meio ligado".
 */
export type ResponderVinculo = {
  pets: Array<
    | { petNaClinicaId: Cuid; acao: 'LIGAR'; petId: Cuid }
    | { petNaClinicaId: Cuid; acao: 'CRIAR' }
    | { petNaClinicaId: Cuid; acao: 'NAO_E_MEU' }
  >
  /**
   * O consentimento nasce todo `false`, como em qualquer vínculo. A tela pergunta na mesma
   * resposta; ausente, fica `false` e pode ser mudado depois em "Minhas clínicas".
   */
  consentimento?: AtualizarConsentimento
}

export const MOTIVOS_DE_RECUSA_DO_VINCULO = ['NAO_SOU_EU', 'NAO_QUERO_VINCULO'] as const
export type MotivoDeRecusaDoVinculo = (typeof MOTIVOS_DE_RECUSA_DO_VINCULO)[number]

export type RecusarVinculo = { motivo: MotivoDeRecusaDoVinculo }

/**
 * O responsável viu um dado errado ("meu telefone mudou", "a Mel é fêmea"). O app **não edita**
 * o cadastro da clínica: manda o pedido, e a clínica corrige. Texto livre, até 500 caracteres.
 */
export type PedirCorrecaoAClinica = { mensagem: string }

export const TIPO_DE_NOTIFICACAO_DO_VINCULO = 'VINCULO_PROPOSTO' as const

export type DadosDoVinculoProposto = BaseDaNotificacaoClinica & {
  tipo: typeof TIPO_DE_NOTIFICACAO_DO_VINCULO
  vinculoId: Cuid
  clinicaNome: string
  quantosPets: number
}

export const ROTAS_DO_VINCULO = {
  propostas: 'GET /tutor/clinica/vinculos-propostos', // VinculoProposto[] (só PENDENTE)
  proposta: 'GET /tutor/clinica/vinculos-propostos/:id', // VinculoProposto [VINCULO_EXPIRADO]
  responder: 'POST /tutor/clinica/vinculos-propostos/:id/responder', // ResponderVinculo → ClinicaDoResponsavel [VINCULO_INCOMPLETO, VINCULO_EXPIRADO, PET_SEM_ACESSO]
  recusar: 'POST /tutor/clinica/vinculos-propostos/:id/recusar', // RecusarVinculo → 204
  pedirCorrecao: 'POST /tutor/clinica/vinculos-propostos/:id/correcao', // PedirCorrecaoAClinica → 204
} as const

/** `/screens/clinica/vinculo?id=…` — sem `petId`: a proposta é da pessoa, não de um pet. */
export const ROTA_DA_NOTIFICACAO_DO_VINCULO = '/screens/clinica/vinculo'

export const TEXTO_PT_DA_NOTIFICACAO_DO_VINCULO = (
  dados: DadosDoVinculoProposto,
): { titulo: string; corpo: string } => ({
  titulo: `${dados.clinicaNome} trouxe seu cadastro`,
  corpo:
    dados.quantosPets === 1
      ? 'Confirme o pet que a clínica atende para ver tudo no app.'
      : `Confirme os ${dados.quantosPets} pets que a clínica atende para ver tudo no app.`,
})

// ---------------------------------------------------------------------------
// Carteirinha conectada — o protocolo do pet e a dose que acabou de sair
// ---------------------------------------------------------------------------

/*
 * A clínica aplica, e a carteirinha do app muda na hora: mesma entidade, dois lados. Além da dose
 * (`VacinaAplicadaNaClinica`, acima), o app recebe o **plano** — a sequência inteira que a clínica
 * montou para o pet, por espécie e idade, com onde ele está nela. É o que o responsável de um
 * filhote mais precisa ver e o que ele hoje monta de cabeça. Passo a passo em
 * `docs/clinico/14-*.md`.
 *
 * O plano da clínica **vale mais** que o `intervaloProximaDose` do app (`constants/vacina-protocols.ts`)
 * para as vacinas que ela registrou: a data da próxima dose vem daqui, congelada na aplicação, e o
 * app não recalcula. A tabela do app continua valendo para o que o responsável registra sozinho.
 *
 * A notificação nova vive fora de `TIPOS_DE_NOTIFICACAO_CLINICA`, como a do vínculo: aquele
 * `Record` é fechado no app e obrigaria tudo a entrar na mesma leva.
 */

/** Série de filhote (antes de 16 semanas, mais doses) ou de adulto sem histórico. */
export const TIPOS_DE_SERIE_VACINAL = ['FILHOTE', 'ADULTO'] as const
export type TipoDeSerieVacinal = (typeof TIPOS_DE_SERIE_VACINAL)[number]

/**
 * - `APLICADA` — dada, aqui ou fora (`aplicacaoId` diz qual).
 * - `DEVIDA` — a data chegou, ou passou há menos que a carência. É a dose de hoje.
 * - `ATRASADA` — passou da carência. É o mesmo atraso do `VACINA_ATRASADA`.
 * - `PREVISTA` — tem data, e ela não chegou.
 * - `AGUARDA_IDADE` — o pet ainda não tem a idade mínima; `em` é o dia em que passa a ter.
 * - `PENDENTE` — essencial que ninguém começou, num pet que já tem idade. Não é atraso.
 */
export const ESTADOS_DA_DOSE_NO_PLANO = [
  'APLICADA',
  'DEVIDA',
  'ATRASADA',
  'PREVISTA',
  'AGUARDA_IDADE',
  'PENDENTE',
] as const
export type EstadoDaDoseNoPlano = (typeof ESTADOS_DA_DOSE_NO_PLANO)[number]

export const SITUACOES_NO_PLANO_VACINAL = [
  'EM_DIA',
  'A_VENCER',
  'DEVIDA',
  'ATRASADA',
  'AGUARDA_IDADE',
  'NAO_INICIADA',
] as const
export type SituacaoNoPlanoVacinal = (typeof SITUACOES_NO_PLANO_VACINAL)[number]

export type DoseNoPlanoVacinal = {
  /** 1 a `total` na série. O reforço anual repete `total` e vem com `tipo: 'REFORCO'`. */
  numero: number
  total: number
  tipo: 'SERIE' | 'REFORCO'
  estado: EstadoDaDoseNoPlano
  /** Data aplicada, ou a data em que a dose passa a caber. */
  em: DataIso
  /** A `VacinaAplicadaNaClinica.id`, quando `APLICADA`. */
  aplicacaoId: Cuid | null
  agendamento: { id: Cuid; inicio: DataHoraIso } | null
}

export type VacinaNoPlanoVacinal = {
  vacina: { nome: string; fabricante: string; obrigatoria: boolean; essencial: boolean }
  tipoDeSerie: TipoDeSerieVacinal
  situacao: SituacaoNoPlanoVacinal
  aplicadasNaSerie: number
  total: number
  /** A série, na ordem, e o reforço que fecha o ciclo. */
  doses: DoseNoPlanoVacinal[]
}

export type PlanoVacinalDoPet = {
  petId: Cuid
  /** A clínica que montou o plano. */
  clinica: ClinicaResumo
  /** Quando foi calculado. O plano muda sozinho com o calendário — o app não guarda cópia. */
  geradoEm: DataHoraIso
  /** Ordenadas pelo que pede ação: atrasada, devida, a vencer, não iniciada, aguarda idade, em dia. */
  vacinas: VacinaNoPlanoVacinal[]
  /** Opcionais da espécie que ninguém começou. O app mostra recolhido, nunca como pendência. */
  opcionaisNaoIniciadas: Array<{ nome: string; fabricante: string }>
  atrasadas: number
}

export const ROTAS_DA_CARTEIRINHA = {
  plano: 'GET /tutor/clinica/vacinas/plano?petId=', // PlanoVacinalDoPet [PET_SEM_ACESSO]
} as const

export const TIPO_DE_NOTIFICACAO_DA_VACINA = 'VACINA_REGISTRADA_PELA_CLINICA' as const

/**
 * Sai quando a clínica registra uma dose — é o "na hora" da carteirinha. A **externa** também
 * avisa: o responsável precisa saber que o que ele contou entrou, e como entrou.
 */
export type DadosDaVacinaRegistrada = BaseDaNotificacaoClinica & {
  tipo: typeof TIPO_DE_NOTIFICACAO_DA_VACINA
  aplicacaoId: Cuid
  petId: Cuid
  petNome: string
  clinicaNome: string
  vacinaNome: string
  origem: OrigemDaVacina
  dose: number
  dosesNaSerie: number
  /** Para o corpo dizer "a próxima já está marcada". */
  proximaDoseEm: DataIso
  proximaDoseAgendadaPara: DataHoraIso | null
}

/** A carteira que o app já tem. `id` é a aplicação, para a tela rolar até a linha nova. */
export const ROTA_DA_NOTIFICACAO_DA_VACINA = '/screens/vacina/lista'

export const TEXTO_PT_DA_NOTIFICACAO_DA_VACINA = (
  dados: DadosDaVacinaRegistrada,
): { titulo: string; corpo: string } => {
  const serie = dados.dosesNaSerie > 1 ? ` (dose ${dados.dose} de ${dados.dosesNaSerie})` : ''

  if (dados.origem === 'EXTERNA') {
    return {
      titulo: `${dados.vacinaNome}${serie} na carteirinha de ${dados.petNome}`,
      corpo: `Registrada por ${dados.clinicaNome} como dose de outro local.`,
    }
  }

  /*
   * O reforço anual cai no mesmo dia e mês de hoje, um ano depois: sem o ano, "até 29/09" lê como
   * hoje. Dentro da série, a data é de semanas, e o ano sobraria.
   */
  const fechouASerie = dados.dose >= dados.dosesNaSerie

  return {
    titulo: `${dados.petNome} tomou ${dados.vacinaNome}${serie}`,
    corpo: dados.proximaDoseAgendadaPara
      ? `${dados.clinicaNome}. A próxima já está marcada: ${diaEHora(dados.proximaDoseAgendadaPara)}.`
      : `${dados.clinicaNome}. Próxima dose até ${fechouASerie ? diaComAno(dados.proximaDoseEm) : dia(dados.proximaDoseEm)}.`,
  }
}

/** `2027-09-29` → `29/09/2027`. */
function diaComAno(data: DataIso): string {
  return `${dia(data)}/${data.slice(0, 4)}`
}

// ---------------------------------------------------------------------------
// Adesão ao tratamento — o lembrete da receita, dose a dose
// ---------------------------------------------------------------------------

/*
 * O lembrete da receita (seção "Depois da consulta") ganha o outro lado: cada dose tem registro
 * — dada, ou pulada com motivo — e quem registrou. A clínica que prescreveu lê esses registros,
 * se a casa deixar, e vê no retorno se o tratamento foi feito. Passo a passo em
 * `docs/clinico/16-*.md`.
 *
 * Por baixo continua o que o app já tem: cada dose é uma `LembreteOcorrencia` da série, e "dei" é
 * o `CONCLUIDO` que ela já grava. O que é novo: a dose **pulada** com motivo, **quem** registrou,
 * a dose que fecha sozinha **sem registro**, e o compartilhamento com a clínica.
 *
 * Duas regras atravessam tudo, e são do requisito:
 *
 * - **Sem registro não é dose perdida.** Não existe tela, aviso ou texto que chame de falta a dose
 *   que ninguém marcou. Ela tem estado próprio e fica fora das contas de "deu" e de "não deu".
 * - **A dose não cobra.** Nenhum aviso diz "você esqueceu". A dose que passa sem registro fecha
 *   calada quando chega a hora da seguinte.
 *
 * A notificação da dose é a do lembrete que o app já manda — não é tipo novo de
 * `TipoNotificacao`. O que muda nela está em `REGRAS_DA_DOSE` e `AvisoDeDose`.
 */

/**
 * - `DADA` / `PULADA` — alguém da casa registrou.
 * - `SEM_REGISTRO` — o prazo passou e ninguém marcou. **Não** quer dizer que não deu.
 * - `ABERTA` — é a dose da vez: dá para registrar até a hora da seguinte.
 * - `PREVISTA` — ainda não chegou.
 */
export const SITUACOES_DA_DOSE = ['DADA', 'PULADA', 'SEM_REGISTRO', 'ABERTA', 'PREVISTA'] as const
export type SituacaoDaDose = (typeof SITUACOES_DA_DOSE)[number]

/** Os três motivos do requisito, nessa ordem na tela: um toque, sem texto livre. */
export const MOTIVOS_DA_DOSE_PULADA = ['ESQUECI', 'CUSPIU', 'ACABOU'] as const
export type MotivoDaDosePulada = (typeof MOTIVOS_DA_DOSE_PULADA)[number]

/**
 * As regras dos avisos de dose. O app, o motor de notificações da API e o mock do portal seguem
 * as mesmas — é o que faz remédio de 8 em 8 horas por catorze dias não virar o aviso que se
 * desliga. Ver "Sem virar spam" no doc 16.
 */
export const REGRAS_DA_DOSE = {
  /** O registro abre antes da hora: quem deu às 7h40 a dose das 8h marca na hora. */
  antecedenciaDoRegistroMin: 60,
  /**
   * Segundo aviso (o `reavisadoEm` que a série já tem) só com intervalo de um dia ou mais. De 8 em
   * 8 horas, a próxima dose já é o lembrete — repetir a de agora dobraria os avisos do dia.
   */
  reavisoSoComIntervaloDeHoras: 24,
  /** Doses de qualquer pet da conta dentro desta janela saem num aviso só. */
  agruparDentroDeMin: 15,
  /** A faixa que a sugestão do primeiro horário tenta deixar livre, quando a frequência deixa. */
  madrugada: { de: '00:00', ate: '06:00' },
} as const

/** Quem registrou a dose. `eu` é quem está com este celular — a tela diz "você". */
export type QuemRegistrou = {
  id: Cuid
  nome: string
  eu: boolean
}

export type DoseDoTratamento = {
  /** 1 é a primeira dose do tratamento. É a chave do registro, junto com o tratamento. */
  numero: number
  previstaEm: DataHoraIso
  /** Até quando dá para registrar: a hora da dose seguinte. */
  registravelAte: DataHoraIso
  situacao: SituacaoDaDose
  /** Só em `PULADA`. */
  motivo: MotivoDaDosePulada | null
  registradaEm: DataHoraIso | null
  registradaPor: QuemRegistrou | null
  /** A dose está aberta (ou abre na próxima hora) e quem olha tem acesso de edição. */
  podeRegistrar: boolean
  /** Registro de quem olha, com a janela ainda aberta: o "desfazer" do toque errado. */
  podeDesfazer: boolean
}

export type TratamentoDoPet = {
  id: Cuid
  /** A `LembreteSerie` que faz os avisos. */
  lembreteSerieId: Cuid
  atendimentoId: Cuid | null
  itemDaReceitaId: Cuid | null
  clinica: ClinicaResumo
  profissional: ProfissionalResumo
  medicamento: string
  /** A mesma forma de `ItemDaReceita`: "meio comprimido", nunca "0,5". */
  quantidade: number
  unidade: UnidadeDeDose
  fracao: FracaoDeDose | null
  via: ViaDeAdministracao
  instrucoes: string
  frequenciaHoras: number
  /** Ausente = uso contínuo. */
  duracaoDias?: number
  inicioEm: DataHoraIso
  /** A última dose. Ausente no uso contínuo. */
  ultimaDoseEm?: DataHoraIso
  situacao: 'EM_CURSO' | 'ENCERRADO'
  /** A clínica vê os registros deste lembrete. */
  compartilhadoComAClinica: boolean
  /** Só o dono muda o compartilhamento, como o consentimento do diário. */
  podeAlterarCompartilhamento: boolean
  /** Os avisos, como valem para quem olha. */
  avisos: {
    /** Esta pessoa recebe os avisos deste lembrete. Cada um liga o seu. */
    recebo: boolean
    /** Há segundo aviso? Só com intervalo de 24 h ou mais (`REGRAS_DA_DOSE`). */
    comReaviso: boolean
  }
  /** As doses de hoje e a de ontem que ainda dá para registrar, na ordem do relógio. */
  doses: DoseDoTratamento[]
  /**
   * Os últimos 14 dias, dia a dia — a mesma faixa que a clínica vê, para a casa ver o mesmo que o
   * vet. Mais antigo primeiro; o dia de hoje por último. Para trás disso, `historicoDeDoses`.
   */
  ultimosDias: Array<{
    dia: DataIso
    doses: Array<
      Pick<DoseDoTratamento, 'numero' | 'previstaEm' | 'situacao' | 'motivo' | 'registradaPor'>
    >
  }>
  /** Desde o início, contado. Sem porcentagem e sem nota — a conta é a mesma da clínica. */
  historico: { desde: DataIso; dadas: number; puladas: number; semRegistro: number }
}

/** `GET` dos tratamentos de um pet, do ponto de vista de quem está com o celular. */
export type TratamentosDoPet = {
  pet: PetResumo
  eu: QuemRegistrou & { acesso: 'LEITURA' | 'LEITURA_ESCRITA' }
  /** Em curso primeiro; encerrados dos últimos 30 dias depois. */
  tratamentos: TratamentoDoPet[]
}

export type RegistrarDose = {
  numero: number
  situacao: 'DADA' | 'PULADA'
  /** Obrigatório na `PULADA`, proibido na `DADA`. */
  motivo?: MotivoDaDosePulada
}

/** O "Dei" do aviso agrupado: todas as doses do aviso num toque. */
export type RegistrarDoses = {
  doses: Array<{ tratamentoId: Cuid; numero: number }>
}

export type AtualizarTratamento = {
  compartilhadoComAClinica?: boolean
  receberAvisos?: boolean
}

/**
 * `DOSE_JA_REGISTRADA`: outra pessoa da casa registrou antes — o corpo traz o registro dela, e o
 * app diz "Rafael já deu às 8h05" em vez de registrar de novo. É o que evita a dose dobrada.
 * `DOSE_FORA_DA_JANELA`: a hora da dose seguinte já passou (ou a dose ainda não abriu).
 */
export type CodigoDeErroDaAdesao = 'DOSE_JA_REGISTRADA' | 'DOSE_FORA_DA_JANELA'

export type ErroDaDose = Omit<ErroDaApi, 'codigo'> & {
  codigo: CodigoDeErroDaAdesao
  registroExistente?: DoseDoTratamento
}

export const ROTAS_DA_ADESAO = {
  tratamentos: 'GET /tutor/clinica/tratamentos?petId=', // TratamentosDoPet [PET_SEM_ACESSO]
  historicoDeDoses: 'GET /tutor/clinica/tratamentos/:id/doses?desde=&ate=', // DoseDoTratamento[], mais antiga primeiro (até 90 dias por pedido)
  registrar: 'POST /tutor/clinica/tratamentos/:id/doses', // RegistrarDose → DoseDoTratamento [DOSE_JA_REGISTRADA, DOSE_FORA_DA_JANELA, SOMENTE_LEITURA]
  registrarVarias: 'POST /tutor/clinica/tratamentos/doses', // RegistrarDoses → DoseDoTratamento[] (as já registradas voltam como estão)
  desfazer: 'DELETE /tutor/clinica/tratamentos/:id/doses/:numero', // 204 [DOSE_FORA_DA_JANELA, SOMENTE_LEITURA]
  atualizar: 'PATCH /tutor/clinica/tratamentos/:id', // AtualizarTratamento → TratamentoDoPet [SOMENTE_LEITURA]
  // Lado do portal, aqui só para os dois concordarem:
  paraClinica: 'GET /parceiro/portal/pacientes/:petId/tratamentos', // AdesaoParaClinica[] [PET_SEM_ACESSO]
} as const

/**
 * O que a clínica lê: os registros crus de cada tratamento que ela prescreveu e que a casa
 * compartilha. A grade, a situação de cada dose e o alerta são conta do portal, sobre isto — a
 * API não manda número pronto, para a regra morar num lugar só.
 */
export type AdesaoParaClinica = {
  tratamentoId: Cuid
  itemDaReceitaId: Cuid | null
  inicioEm: DataHoraIso
  frequenciaHoras: number
  duracaoDias?: number
  encerradoEm: DataHoraIso | null
  /** `false`: a clínica sabe que o lembrete existe e mais nada — `registros` vem vazio. */
  compartilhado: boolean
  registros: Array<{
    numero: number
    situacao: 'DADA' | 'PULADA'
    motivo: MotivoDaDosePulada | null
    registradaEm: DataHoraIso
    registradaPor: { id: Cuid; nome: string; papel: 'DONO' | 'FAMILIA' }
  }>
}

// --------------------------------------------------------------- o aviso da dose

/** A categoria da notificação local/push com botões de ação (expo-notifications). */
export const CATEGORIA_DO_AVISO_DE_DOSE = 'DOSE_DO_REMEDIO' as const

/**
 * `DEI` registra todas as doses do aviso sem abrir o app — é o "um toque" do requisito. `ABRIR`
 * leva à tela do tratamento, onde estão "pulei" e o motivo: pular pede uma escolha, e escolha
 * não cabe num botão de notificação.
 */
export const ACOES_DO_AVISO_DE_DOSE = ['DEI', 'ABRIR'] as const
export type AcaoDoAvisoDeDose = (typeof ACOES_DO_AVISO_DE_DOSE)[number]

export type AvisoDeDose = {
  categoria: typeof CATEGORIA_DO_AVISO_DE_DOSE
  /** O horário das doses do aviso — as agrupadas caem dentro de `agruparDentroDeMin`. */
  previstaEm: DataHoraIso
  doses: Array<{
    tratamentoId: Cuid
    numero: number
    petId: Cuid
    petNome: string
    medicamento: string
    quantidade: number
    unidade: UnidadeDeDose
    fracao: FracaoDeDose | null
  }>
  url: string
}

export const ROTA_DO_TRATAMENTO = '/screens/clinica/tratamento'

/**
 * O texto do aviso em português — o que o backend põe no catálogo e o mock usa.
 *
 * Nunca cobra: não há versão de "atrasado" nem de "você esqueceu". Um remédio: o nome e quanto
 * dar. Mais de um no mesmo horário: quantos, e os nomes.
 */
export const TEXTO_PT_DO_AVISO_DE_DOSE = (
  aviso: AvisoDeDose,
): { titulo: string; corpo: string } => {
  const pets = [...new Set(aviso.doses.map((dose) => dose.petNome))]
  const [primeira] = aviso.doses

  if (aviso.doses.length === 1 && primeira) {
    return {
      titulo: `Hora do remédio de ${primeira.petNome}`,
      corpo: `${primeira.medicamento} · ${quantidadeEmTexto(primeira)}`,
    }
  }

  if (pets.length === 1) {
    return {
      titulo: `${aviso.doses.length} remédios de ${pets[0]} às ${hora(aviso.previstaEm)}`,
      corpo: aviso.doses.map((dose) => dose.medicamento).join(', '),
    }
  }

  return {
    titulo: `Remédios das ${hora(aviso.previstaEm)}`,
    corpo: pets
      .map(
        (pet) =>
          `${pet}: ${aviso.doses
            .filter((dose) => dose.petNome === pet)
            .map((dose) => dose.medicamento)
            .join(', ')}`,
      )
      .join(' · '),
  }
}

/** "meio comprimido", "0,12 mL", "2 comprimidos" — como a receita diz, em português. */
export function quantidadeEmTexto(dose: {
  quantidade: number
  unidade: UnidadeDeDose
  fracao: FracaoDeDose | null
}): string {
  const numero = dose.quantidade.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

  if (dose.unidade === 'ML') {
    return `${numero} mL`
  }

  if (dose.unidade === 'GOTA') {
    return `${numero} ${dose.quantidade === 1 ? 'gota' : 'gotas'}`
  }

  if (dose.unidade === 'APLICACAO') {
    return `${numero} ${dose.quantidade === 1 ? 'aplicação' : 'aplicações'}`
  }

  switch (dose.fracao) {
    case 'MEIO':
      return 'meio comprimido'
    case 'QUARTO':
      return 'um quarto de comprimido'
    case 'TRES_QUARTOS':
      return 'três quartos de comprimido'
    case 'UM_E_MEIO':
      return 'um comprimido e meio'
    default:
      return `${numero} ${dose.quantidade === 1 ? 'comprimido' : 'comprimidos'}`
  }
}
