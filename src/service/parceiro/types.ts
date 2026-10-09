export type StatusAuditoriaParceiro = 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'SUSPENSO'

export type PapelParceiro = 'DONO' | 'OPERADOR'

export type StatusModoParceiro =
  | 'NAO_SOLICITADO'
  | 'SOLICITADO'
  | 'ATIVO'
  | 'REJEITADO'
  | 'SUSPENSO'

export type ModoParticipacao = 'afiliado' | 'participativo'

export type CategoriaParceiro =
  | 'CLINICA_VETERINARIA'
  | 'PET_SHOP'
  | 'BANHO_TOSA'
  | 'ADESTRAMENTO'
  | 'HOTEL_CRECHE'
  | 'FARMACIA'
  | 'OUTRO'

/** Reasons estáveis do funil de parceiro (Parte 9). Rotear UX por eles, nunca pela message. */
export type ParceiroFunilReason =
  | 'PARCEIRO_CADASTRO_JA_EXISTE'
  | 'PARCEIRO_CADASTRO_SUSPENSO'
  | 'PARCEIRO_CADASTRO_NOME_EM_USO'
  | 'PARCEIRO_CADASTRO_CNPJ_EM_USO'
  | 'PARCEIRO_MODO_JA_SOLICITADO'
  | 'PARCEIRO_MODO_SUSPENSO'

export type CupomCategoria = 'PETSHOP' | 'VETERINARIO' | 'FARMACIA' | 'BANHO_TOSA' | 'NUTRICAO'

export type CanalResgate = 'QR' | 'CODIGO_MANUAL'

export type TipoTransacaoParceiro = 'CREDITO_COMISSAO' | 'ESTORNO' | 'DEBITO_SAQUE' | 'AJUSTE'

export type OrigemComissao = 'INITIAL_PURCHASE' | 'RENEWAL' | 'UPGRADE' | 'REFUND'

export type PeriodicidadeComissao = 'MENSAL' | 'ANUAL'

export type StatusSaque = 'PENDENTE' | 'PAGO' | 'FALHA'

export type ParceiroResumo = {
  id: string
  nome: string
  logoUrl?: string | null
  statusAuditoria: StatusAuditoriaParceiro
  motivoAuditoria?: string | null
  cnpj?: string | null
}

export type PortalDashboard = {
  parceiro: ParceiroResumo
  papel: PapelParceiro
  totais: {
    cuponsAtivos: number
    resgatesTotal: number
    resgatesUltimos30d: number
  }
}

/** Bloco por modo do `GET /status` (Parte 9). `podeSolicitar` vem calculado do backend. */
export type ModoStatusBloco = {
  status: StatusModoParceiro
  motivo: string | null
  decididoEm: string | null
  podeSolicitar: boolean
}

export type PortalStatus = {
  statusAuditoria: StatusAuditoriaParceiro
  motivoAuditoria?: string
  auditadoEm?: string
  podeOperar: boolean
  afiliado: ModoStatusBloco
  participativo: ModoStatusBloco
  /** Legado (pré Parte 9): use os blocos `afiliado`/`participativo`. */
  statusAfiliado: StatusModoParceiro
  statusParticipativo: StatusModoParceiro
}

/**
 * Body do `POST /parceiro/portal/cadastro`. **Semântica replace**: campo opcional
 * ausente vira nulo, então o reenvio manda o formulário inteiro, não um delta.
 */
export type ParceiroCadastroPayload = {
  nome: string
  categoria?: CategoriaParceiro | null
  cnpj?: string | null
  telefoneComercial?: string | null
  crmv?: string | null
  logoUrl?: string | null
  /**
   * Programas declarados junto do credenciamento, para o admin decidir tudo de uma vez.
   * Omitir (ou `[]` no reenvio) significa nenhum programa e cancela o que estava só pedido.
   */
  programas?: ModoParticipacao[]
}

/** O PATCH é parcial de verdade e **não aceita `programas`** (400): programa muda por POST ou pela rota de solicitar. */
export type ParceiroCadastroPatchPayload = Partial<Omit<ParceiroCadastroPayload, 'programas'>>

export type ParceiroCadastro = {
  parceiroId: string
  nome: string
  categoria: CategoriaParceiro | null
  cnpj: string | null
  telefoneComercial: string | null
  crmv: string | null
  logoUrl: string | null
  statusAuditoria: StatusAuditoriaParceiro
  /** Motivo da recusa/suspensão do CADASTRO (não confundir com motivo dos modos). */
  motivoAuditoria: string | null
}

/**
 * `GET /parceiro/portal/indicacao`.
 *
 * Gate composto: parceiro não operável (pendente/rejeitado/suspenso/inativo,
 * 2026-07-29) **ou** sem Programa de Afiliados ATIVO (2026-08-19) recebe **tudo
 * `null`** com `podeIndicar: false` e um `aviso` por status. Indicar é o
 * instrumento do programa e segue a mesma máquina da Carteira, então os quatro
 * campos são nuláveis e a tela mostra estado de espera com o `aviso` como veio,
 * sem copy própria.
 */
export type PortalIndicacao = {
  codigoIndicacao: string | null
  link: string | null
  /** Identificador do QR no serviço de imagem. */
  qrCode: string | null
  /** URL da imagem PNG/JPG do QR para exibir e exportar. */
  qrImageUrl: string | null
  podeIndicar: boolean
  aviso?: string
}

/** Um dia da série de leituras do QR. `day` é `YYYY-MM-DD`. */
export type IndicacaoScanPorDia = {
  day: string
  count: number
}

/** Leitura recente. Sem IP por LGPD: o backend não envia. */
export type IndicacaoScanRecente = {
  at: string
  userAgent: string | null
}

/** `GET /parceiro/portal/indicacao/metricas`. 409 = parceiro não operável;
 *  503 (`QR_INDISPONIVEL`) = serviço de QR fora do ar. */
export type IndicacaoMetricas = {
  qrCode: string
  scanCount: number
  byDay: IndicacaoScanPorDia[]
  recent: IndicacaoScanRecente[]
}

export type CupomParceiro = {
  id: string
  codigo: string
  titulo: string
  descontoPercentual: number
  categoria: CupomCategoria
  validoAte: string
  ativo: boolean
  usoUnico: boolean
  usosRestantes?: number
  totalResgates: number
}

export type ResgateParceiro = {
  resgateId: string
  cupomCodigo: string
  canal: CanalResgate
  descontoPercentualSnapshot?: number
  resgatadoEm: string
}

/** Resultado de `POST /parceiro/portal/cupons/validar` (resgate já efetivado). */
export type ValidarCupomResultado = {
  valido: true
  resgateId: string
  canal: CanalResgate
  cupom: {
    id: string
    codigo: string
    titulo: string
    descontoPercentual: number
  }
  tutorPrimeiroNome: string | null
}

export type ValidarCupomPayload = {
  codigo: string
  canal: CanalResgate
}

export type Carteira = {
  saldoTotalCentavos: number
  saldoSacavelCentavos: number
  chavePix: string | null
  totalSacadoCentavos: number
  bloqueadoParaSaque: boolean
}

export type TransacaoCarteira = {
  id: string
  tipo: TipoTransacaoParceiro
  valorCentavos: number
  periodicidade: PeriodicidadeComissao | null
  origem: OrigemComissao | null
  createdAt: string
}

export type SaqueResumo = {
  id: string
  valorCentavos: number
  status: StatusSaque
  createdAt: string
  liquidadoEm: string | null
  motivoFalha: string | null
}

export type SaqueDetalhe = SaqueResumo & {
  chavePixSnapshot: string
  comprovante: string | null
}

// ---- Questionário depois do saque ----
// Spec da API: docs/specs/2026/q4/q4-1/questionario-feedback-saque-parceiro.md.
// Os enums espelham o backend e só ganham valores, nunca perdem.

export type StatusFeedbackSaque = 'RESPONDIDO' | 'DISPENSADO'

export type PontoPositivoFeedback =
  | 'FACILIDADE_INDICAR'
  | 'ACOMPANHAR_INDICADOS'
  | 'CLAREZA_CARTEIRA'
  | 'RAPIDEZ_SAQUE'
  | 'VALOR_PARTICIPACAO'
  | 'APP_GERAL'

export type IncentivoIndicacaoFeedback =
  | 'MATERIAL_DIVULGACAO'
  | 'PARTICIPACAO_MAIOR'
  | 'TUTORES_ENGAJADOS'
  | 'FERRAMENTAS_NEGOCIO'
  | 'ENTENDER_PROGRAMA'

export type FeedbackSaqueElegibilidade = {
  exibir: boolean
}

/** Em `DISPENSADO` bastam `saqueId`, `status` e `versaoQuestionario`; a API ignora o resto. */
export type RegistrarFeedbackSaquePayload = {
  saqueId: string
  status: StatusFeedbackSaque
  versaoQuestionario: number
  /** Obrigatória em `RESPONDIDO`, de 0 a 10. */
  notaRecomendacao?: number
  pontosPositivos?: PontoPositivoFeedback[]
  incentivos?: IncentivoIndicacaoFeedback[]
  /** Até 1000 caracteres; a API faz o trim. */
  sugestao?: string
}

export type FeedbackSaqueRegistrado = {
  id: string
  status: StatusFeedbackSaque
  createdAt: string
}

// ---- Compartilhamentos vinculados (Parte 8: prestador com conta) ----

export type StatusCompartilhamento = 'ATIVO' | 'EXPIRADO' | 'REVOGADO'

/** `ENCERRADO` é virtual: agrupa EXPIRADO + REVOGADO num cursor só, no servidor. */
export type StatusFiltroCompartilhamento = StatusCompartilhamento | 'ENCERRADO'

export type EspeciePet = 'CACHORRO' | 'GATO' | 'AVE' | 'ROEDOR' | 'COELHO' | 'PEIXE' | 'REPTIL'

export type OrdenacaoPacientes = 'recentes' | 'nome' | 'expiraEm'

export type TipoServicoPrestador = 'BANHO' | 'TOSA' | 'CONSULTA' | 'EXAME' | 'HOTEL' | 'OUTRO'

/** Filtros de `GET /parceiro/portal/compartilhamentos`. Busca alcança só o nome
 *  do pet: a listagem não expõe dado do responsável. */
export type CompartilhamentosQuery = {
  status?: StatusFiltroCompartilhamento
  q?: string
  especie?: EspeciePet | null
  tipoServico?: TipoServicoPrestador | null
  ordenarPor?: OrdenacaoPacientes
  /** Só acessos com prontuário junto (DIARIO ou DOCUMENTOS consentidos). */
  comProntuario?: boolean
  /** ISO 8601, inclusivo, sobre `vinculadoEm`. */
  vinculadoDe?: string
  vinculadoAte?: string
  cursor?: string
  limit?: number
}

/** Teto do backend (`MAX_BUSCA_PACIENTES`); acima disso a request volta 400.
 *  O `limit` da mesma rota é `@Min(1) @Max(50)`. */
export const MAX_BUSCA_PACIENTES = 80

export type TipoDocumentoAnexo =
  | 'Receita Medica'
  | 'Exame de Sangue'
  | 'Raio-X'
  | 'Ultrassom'
  | 'Outro'

/**
 * Parte 15: `titulo` e `detalhe` chegam **traduzidos in-place** no locale da request
 * (diagnósticos e comportamento no título, categoria de alergia no detalhe). Não existe
 * campo de label separado: quem manda o `Accept-Language` certo já recebe o texto pronto.
 * Em alergia o `titulo` é o gatilho escrito pelo responsável e nunca é traduzido.
 */
export type ItemSnapshot = {
  titulo: string
  detalhe?: string
  destaque?: boolean
}

/** Entrada de diário com anormalidade registrada. Labels já chegam localizados:
 *  o portal nunca recebe enum cru aqui. */
export type EntradaDiarioCompartilhada = {
  data: string
  sintomas: string[]
  doencas: string[]
  sintomasOutros?: string | null
  doencasOutras?: string | null
  vitalidade?: string | null
  alimentacao?: string | null
  hidratacao?: string | null
  fezes?: string | null
  urina?: string | null
  cicloCio?: string | null
  observacoes?: string | null
  remedios?: string | null
  /** Só com opt-in do responsável: é caixa de texto que ele escreve para si. */
  nota?: string | null
  /** Ids de arquivo do cofre, como em `DocumentoCompartilhado.arquivoIds`. */
  fotoIds?: string[]
}

/**
 * Por que um bloco de categoria compartilhada veio vazio (Parte 15).
 *
 * - `SEM_REGISTRO`: o responsável não tem registro nessa categoria.
 * - `FILTRADO_JANELA`: há registro, mas nenhum caiu na janela compartilhada.
 * - `REMOVIDO_PELO_TUTOR`: **havia** e o responsável tirou depois de conceder o acesso.
 *
 * O terceiro é o que não pode virar o primeiro. Um bloco retirado indistinguível de um que
 * nunca teve dado faz quem atende concluir que o pet não tem vacina, quando o que ele perdeu
 * foi a permissão de ver. É gravado no snapshot no instante da subtração — o helper que monta
 * o snapshot é puro e não conhece histórico, então quem não gravar na hora perde a informação
 * para sempre.
 */
export type MotivoBlocoVazio = 'SEM_REGISTRO' | 'FILTRADO_JANELA' | 'REMOVIDO_PELO_TUTOR'

/**
 * Tratamento contínuo do pet (Parte 16), em bloco próprio.
 *
 * Não é um `ItemSnapshot` com campos a mais: o que separa os dois não é layout,
 * é o dano de não cumprir. "Toma 1 comprimido todo dia" e "tomou dipirona uma
 * vez em março" não podem pesar igual para quem vai cuidar do pet uma semana.
 * Posologia, motivo, diagnóstico, "desde quando" e observação vêm separados
 * porque é o que torna o tratamento executável por quem não convive com ele.
 */
export type ItemTratamentoContinuo = {
  /** Nome do medicamento, texto livre do responsável. O backend não traduz. */
  titulo: string
  /** Posologia numa linha: "2 mg · 1x ao dia · oral". */
  detalhe?: string | null
  /**
   * Mesma linha com os termos traduzidos. Hoje sai igual a `detalhe` (é tudo
   * texto livre) e existe por simetria: quando dose, frequência ou via virarem
   * enum, a tradução entra lá e a tela não muda. Leia `detalheLabel ?? detalhe`.
   */
  detalheLabel?: string | null
  /** Sempre `true` vindo da API: é o item cuja falha tem dano imediato. */
  destaque: boolean
  /** Para que serve, texto livre do responsável ("para a dor"). */
  motivo?: string | null
  /**
   * Diagnóstico vinculado, já localizado ("Hepática", nunca `HEPATICA`). Campo
   * PRÓPRIO e não fallback de `motivo`: o caso comum é os dois preenchidos, e
   * mostrar só um entrega ao parceiro menos do que o responsável viu.
   */
  diagnostico?: string | null
  /** ISO 8601 da data de início. O "desde quando". */
  desde?: string | null
  /** Observação do responsável ("dar junto com a comida"). */
  observacoes?: string | null
}

export type BlocoSnapshot =
  | 'alergias'
  | 'vacinas'
  | 'medicamentos'
  | 'comportamento'
  | 'diagnosticos'
  | 'tratamentosContinuos'
  | 'diario'
  | 'documentos'

export type MotivosSnapshot = Partial<Record<BlocoSnapshot, MotivoBlocoVazio>>

/** Documento que o responsável liberou item a item. `arquivoIds` são ids do cofre
 *  do acesso — nunca URL: cada abertura pede uma signed URL nova. */
export type DocumentoCompartilhado = {
  /** Id do documento de origem no prontuário. Rastro, não endereço de leitura. */
  origemId: string
  nome: string
  tipo: string
  dataEmissao?: string | null
  dataExpiracao?: string | null
  arquivoIds: string[]
}

/** Snapshot congelado na criação, já filtrado pelas categorias que o responsável escolheu.
 *  Campo ausente = categoria não compartilhada (não renderizar a seção). */
export type SnapshotPetCompartilhado = {
  pesoKg?: number | null
  alergias?: ItemSnapshot[]
  vacinas?: ItemSnapshot[]
  medicamentos?: ItemSnapshot[]
  comportamento?: ItemSnapshot[]
  diagnosticos?: ItemSnapshot[]
  /**
   * Tratamento contínuo em bloco próprio (Parte 16).
   *
   * A AUSÊNCIA da chave carrega significado: acesso criado antes da Parte 16 não
   * a tem, e é assim que a tela sabe que não deve abrir o bloco (naquele acesso
   * o tratamento sai fundido dentro de `medicamentos`, como sempre esteve).
   * `[]` diz outra coisa: o acesso fala sobre tratamento e não há nenhum em
   * curso.
   *
   * Por isso nunca escreva `snapshot.tratamentosContinuos ?? []`: isso funde os
   * dois casos e esconde o remédio de todo dia de todo acesso anterior ao
   * deploy. Quem decide é `estadoTratamentosContinuos`, que recebe a chave crua.
   */
  tratamentosContinuos?: ItemTratamentoContinuo[]
  observacoesTutor?: string | null
  /** Vazio quando a categoria DIARIO não foi liberada. */
  diario?: EntradaDiarioCompartilhada[]
  /** Vazio quando a categoria DOCUMENTOS não foi liberada. */
  documentos?: DocumentoCompartilhado[]
  /** Parte 15. Ausente = acesso anterior ao contrato: não inferir motivo. */
  motivos?: MotivosSnapshot
}

export type AnexoAnotacao = {
  id: string
  tipoDocumento: string | null
  nome: string
  mimeType: string
  tamanhoBytes: number
  salvoNosDocumentos: boolean
  documentoId: string | null
}

export type AnotacaoPrescricaoItem = {
  id: string
  nome: string
  dose: string | null
  unidade: string | null
  /** Sem frequência o responsável não consegue derivar Medicamento do pet na importação. */
  frequencia: string | null
  duracaoDias: number | null
  instrucoes: string | null
}

export type AnotacaoExameSolicitado = {
  id: string
  nome: string
  observacao: string | null
}

/** Bloco estruturado da anotação. Sempre presente na leitura: anotação antiga vem
 *  com todos os escalares `null` e as listas vazias, sem branch por versão. */
export type AnotacaoEstruturada = {
  motivo: string | null
  diagnostico: string | null
  pesoKg: number | null
  tipoExame: string | null
  laudoTexto: string | null
  dataResultado: string | null
  produtos: string | null
  condicaoPele: string | null
  comportamento: string | null
  dataEntrada: string | null
  dataSaida: string | null
  alimentacao: string | null
  intercorrencias: string | null
  prescricaoItens: AnotacaoPrescricaoItem[]
  examesSolicitados: AnotacaoExameSolicitado[]
}

export type Anotacao = AnotacaoEstruturada & {
  id: string
  empresaNome: string
  profissionalNome: string | null
  /**
   * Área do profissional: a CHAVE do enum quando é uma das opções da lista, ou o texto
   * livre quando ele escolheu "Outra". Quem traduz é a tela, nunca o backend, então nunca
   * imprima este valor cru (ver `rotuloEspecialidade`).
   *
   * Ausente em anotação criada antes do campo existir, e é por isso que o tipo admite
   * `undefined` além de `null`.
   */
  profissionalEspecialidade?: string | null
  servicoRealizado: string
  texto: string
  criadaEm: string
  anexos: AnexoAnotacao[]
}

export type CompartilhamentoResumo = {
  id: string
  petNome: string
  especie: string
  /** Já traduzido pelo Accept-Language. */
  especieLabel: string
  petFoto: string | null
  tipoServico: TipoServicoPrestador
  servicoOutroLabel: string | null
  status: StatusCompartilhamento
  expiraEm: string
  vinculadoEm: string
  criadoEm: string
  totalAnotacoes: number
  /** Quantos documentos o responsável liberou item a item. `0` = nenhum. */
  totalDocumentos: number
  /**
   * Há diário no acesso. Booleano, e não contagem: a quantidade de entradas só
   * existe dentro do snapshot, que a listagem não carrega de propósito.
   */
  temDiario: boolean
  /** Resumo regerado depois da entrega. `null` = ainda vale o carimbo de `criadoEm`. */
  snapshotAtualizadoEm: string | null
}

export type CompartilhamentoDetalhe = {
  id: string
  codigo: string
  petNome: string
  especie: string
  especieLabel: string
  petFoto: string | null
  petCastrado?: boolean | null
  tipoServico: TipoServicoPrestador
  servicoOutroLabel: string | null
  /** Texto livre que o responsável digitou ao criar. */
  empresaNome: string | null
  mensagemTutor?: string | null
  categorias?: string[]
  criadoEm: string
  expiraEm: string
  revogadoEm?: string | null
  vinculadoEm: string
  status: StatusCompartilhamento
  /** Parte 15: quando o responsável mexeu no resumo depois de entregar.
   *  `null`/ausente = o resumo é o da criação, vale `criadoEm`. */
  snapshotAtualizadoEm?: string | null
  /** null quando EXPIRADO/REVOGADO: o dado clínico morre com o acesso. */
  snapshot: SnapshotPetCompartilhado | null
  anotacoes: Anotacao[]
}

export type AnotacaoPrescricaoItemInput = {
  nome: string
  dose?: string
  unidade?: string
  frequencia?: string
  duracaoDias?: number
  instrucoes?: string
}

export type AnotacaoExameSolicitadoInput = {
  nome: string
  observacao?: string
}

/** Campos estruturados prontos para o multipart. Só entram as chaves preenchidas
 *  e aceitas pelo `tipoServico` do acesso — campo no tipo errado é 400. */
export type AnotacaoEstruturadaInput = {
  motivo?: string
  diagnostico?: string
  pesoKg?: number
  tipoExame?: string
  laudoTexto?: string
  dataResultado?: string
  produtos?: string
  condicaoPele?: string
  comportamento?: string
  dataEntrada?: string
  dataSaida?: string
  alimentacao?: string
  intercorrencias?: string
  prescricaoItens?: AnotacaoPrescricaoItemInput[]
  examesSolicitados?: AnotacaoExameSolicitadoInput[]
}

export type NovaAnotacaoPayload = {
  servicoRealizado: string
  texto: string
  profissionalNome?: string
  /**
   * Chave do enum ou texto livre, no máximo 60 caracteres. Ausente quando o parceiro não
   * escolheu área: string vazia diria que a área é "".
   */
  profissionalEspecialidade?: string
  /** Tipo do acesso: decide quais campos estruturados podem ser enviados. */
  tipoServico: TipoServicoPrestador
  estruturado?: AnotacaoEstruturadaInput
  anexos?: File[]
  /** Mesmo length de `anexos`; `null` = sem classificação. */
  tiposDocumento?: (TipoDocumentoAnexo | null)[]
}
