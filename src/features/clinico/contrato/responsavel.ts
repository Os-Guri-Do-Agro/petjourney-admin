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

export const SITUACOES_DO_REFORCO = ['EM_DIA', 'PROXIMO', 'VENCIDO', 'SERIE_INCOMPLETA'] as const
export type SituacaoDoReforco = (typeof SITUACOES_DO_REFORCO)[number]

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
}

export type LembreteCriadoDaReceita = {
  itemId: Cuid
  lembreteSerieId: Cuid
  /** Só no uso contínuo. */
  tratamentoFixoId: Cuid | null
}

// ---------------------------------------------------------------------------
// Vacinas aplicadas na clínica
// ---------------------------------------------------------------------------

export type VacinaAplicadaNaClinica = {
  id: Cuid
  petId: Cuid
  clinica: ClinicaResumo
  profissional: ProfissionalResumo
  vacina: { nome: string; fabricante: string; obrigatoria: boolean }
  aplicadaEm: DataHoraIso
  lote: string
  validadeLote: DataIso
  /** 1 de 3, 2 de 3... */
  dose: number
  dosesNaSerie: number
  proximaDoseEm: DataIso
  situacao: SituacaoDoReforco
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
