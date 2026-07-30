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

export type ParceiroCadastroPayload = {
  nome: string
  categoria?: CategoriaParceiro | null
  cnpj?: string | null
  telefoneComercial?: string | null
  crmv?: string | null
  logoUrl?: string | null
}

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

export type PortalIndicacao = {
  codigoIndicacao: string
  link: string
  /** Identificador do QR no serviço de imagem. */
  qrCode: string | null
  /** URL da imagem PNG/JPG do QR para exibir e exportar. */
  qrImageUrl: string | null
  podeIndicar: boolean
  aviso?: string
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

// ---- Compartilhamentos vinculados (Parte 8: prestador com conta) ----

export type StatusCompartilhamento = 'ATIVO' | 'EXPIRADO' | 'REVOGADO'

export type TipoServicoPrestador = 'BANHO' | 'TOSA' | 'CONSULTA' | 'EXAME' | 'HOTEL' | 'OUTRO'

export type TipoDocumentoAnexo =
  | 'Receita Medica'
  | 'Exame de Sangue'
  | 'Raio-X'
  | 'Ultrassom'
  | 'Outro'

export type ItemSnapshot = {
  titulo: string
  detalhe?: string
  destaque?: boolean
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
  observacoesTutor?: string | null
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
  /** Tipo do acesso: decide quais campos estruturados podem ser enviados. */
  tipoServico: TipoServicoPrestador
  estruturado?: AnotacaoEstruturadaInput
  anexos?: File[]
  /** Mesmo length de `anexos`; `null` = sem classificação. */
  tiposDocumento?: (TipoDocumentoAnexo | null)[]
}
