import type {
  Anotacao,
  AnotacaoEstruturadaInput,
  AnotacaoExameSolicitadoInput,
  AnotacaoPrescricaoItemInput,
  TipoServicoPrestador,
} from '@/service/parceiro/types'

/**
 * Espelho do contrato de anotação estruturada do backend
 * (`dto/anotacao-estruturada.dto.ts` + `helpers/anotacao-estruturada.helper.ts`).
 *
 * Regra que justifica este arquivo: campo enviado para o tipo de serviço errado é
 * rejeitado com 400, nunca ignorado. Quem monta o multipart precisa filtrar pelo
 * `tipoServico` do acesso, e essa decisão mora aqui, num lugar só, testada.
 */

/** Escalares do multipart, em ordem estável de escrita e de leitura. */
export const CAMPOS_ESCALARES = [
  'motivo',
  'diagnostico',
  'pesoKg',
  'tipoExame',
  'laudoTexto',
  'dataResultado',
  'produtos',
  'condicaoPele',
  'comportamento',
  'dataEntrada',
  'dataSaida',
  'alimentacao',
  'intercorrencias',
] as const

export type CampoEscalar = (typeof CAMPOS_ESCALARES)[number]

/** Listas 1:N; viajam como JSON string num campo de texto do multipart. */
export const CAMPOS_LISTA = ['prescricaoItens', 'examesSolicitados'] as const

export type CampoLista = (typeof CAMPOS_LISTA)[number]

export type CampoEstruturado = CampoEscalar | CampoLista

/** Teto de itens por lista (backend: `MAX_ITENS_ANOTACAO`). */
export const MAX_ITENS_LISTA = 10

export const PESO_MIN_KG = 0.01
export const PESO_MAX_KG = 500

export const DURACAO_MIN_DIAS = 1
export const DURACAO_MAX_DIAS = 3650

/** `@MaxLength` de cada campo no DTO do backend. Aceitar aqui o que lá é recusado vira 400. */
export const LIMITES_ESCALARES: Record<
  Exclude<CampoEscalar, 'pesoKg' | 'dataResultado' | 'dataEntrada' | 'dataSaida'>,
  number
> = {
  motivo: 1000,
  diagnostico: 10000,
  tipoExame: 200,
  laudoTexto: 10000,
  produtos: 1000,
  condicaoPele: 1000,
  comportamento: 1000,
  alimentacao: 1000,
  intercorrencias: 1000,
}

export const LIMITES_PRESCRICAO = {
  nome: 200,
  dose: 200,
  unidade: 200,
  frequencia: 200,
  instrucoes: 1000,
} as const

export const LIMITES_EXAME_SOLICITADO = {
  nome: 200,
  observacao: 1000,
} as const

/** Campos livres que já existiam; ganharam teto no backend (`LIMITES_CAMPOS_LIVRES`). */
export const LIMITES_CAMPOS_LIVRES = {
  profissionalNome: 200,
  servicoRealizado: 1000,
  texto: 10000,
} as const

/**
 * Campos aceitos por tipo de serviço do acesso. Cópia literal do
 * `CAMPOS_POR_TIPO_SERVICO` do backend — divergir aqui produz 400 em produção.
 * `comportamento` serve estética e hospedagem, por isso aparece nos três.
 */
export const CAMPOS_POR_TIPO_SERVICO: Record<TipoServicoPrestador, readonly CampoEstruturado[]> = {
  CONSULTA: ['motivo', 'diagnostico', 'pesoKg', 'prescricaoItens', 'examesSolicitados'],
  EXAME: ['tipoExame', 'laudoTexto', 'dataResultado'],
  BANHO: ['produtos', 'condicaoPele', 'comportamento'],
  TOSA: ['produtos', 'condicaoPele', 'comportamento'],
  HOTEL: ['dataEntrada', 'dataSaida', 'alimentacao', 'comportamento', 'intercorrencias'],
  // OUTRO segue só com o formulário livre.
  OUTRO: [],
}

export function camposDoTipo(tipo: TipoServicoPrestador): readonly CampoEstruturado[] {
  return CAMPOS_POR_TIPO_SERVICO[tipo] ?? []
}

export function tipoAceitaCampo(tipo: TipoServicoPrestador, campo: CampoEstruturado): boolean {
  return camposDoTipo(tipo).includes(campo)
}

export function tipoAceitaEstruturado(tipo: TipoServicoPrestador): boolean {
  return camposDoTipo(tipo).length > 0
}

// ------------------------------------------------------------------ formulário

export type PrescricaoItemForm = {
  nome: string
  dose: string
  unidade: string
  frequencia: string
  duracaoDias: number | null
  instrucoes: string
}

export type ExameSolicitadoForm = {
  nome: string
  observacao: string
}

/** Estado do formulário: strings vazias (não `null`) para casar com os inputs. */
export type AnotacaoEstruturadaForm = {
  motivo: string
  diagnostico: string
  pesoKg: number | null
  tipoExame: string
  laudoTexto: string
  /** `YYYY-MM-DD` do `input[type=date]`. */
  dataResultado: string
  produtos: string
  condicaoPele: string
  comportamento: string
  /** `YYYY-MM-DDTHH:mm` do `input[type=datetime-local]`. */
  dataEntrada: string
  dataSaida: string
  alimentacao: string
  intercorrencias: string
  prescricaoItens: PrescricaoItemForm[]
  examesSolicitados: ExameSolicitadoForm[]
}

export function criarPrescricaoItemForm(): PrescricaoItemForm {
  return { nome: '', dose: '', unidade: '', frequencia: '', duracaoDias: null, instrucoes: '' }
}

export function criarExameSolicitadoForm(): ExameSolicitadoForm {
  return { nome: '', observacao: '' }
}

export function criarAnotacaoEstruturadaForm(): AnotacaoEstruturadaForm {
  return {
    motivo: '',
    diagnostico: '',
    pesoKg: null,
    tipoExame: '',
    laudoTexto: '',
    dataResultado: '',
    produtos: '',
    condicaoPele: '',
    comportamento: '',
    dataEntrada: '',
    dataSaida: '',
    alimentacao: '',
    intercorrencias: '',
    prescricaoItens: [],
    examesSolicitados: [],
  }
}

// ------------------------------------------------------------------ datas

/**
 * `YYYY-MM-DD` → ISO 8601. Constrói a data no fuso local de propósito:
 * `new Date('2026-07-30')` é meia-noite **UTC** e viraria dia 29 para quem lê em
 * BRT. Montando local, o instante volta como o mesmo dia na tela do responsável.
 */
export function dataLocalParaIso(valor: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor.trim())

  if (!match) {
    return null
  }

  const data = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))

  return Number.isNaN(data.getTime()) ? null : data.toISOString()
}

/** `YYYY-MM-DDTHH:mm` → ISO 8601, também no fuso local. */
export function dataHoraLocalParaIso(valor: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(valor.trim())

  if (!match) {
    return null
  }

  const data = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    Number(match[6] ?? 0),
  )

  return Number.isNaN(data.getTime()) ? null : data.toISOString()
}

// ------------------------------------------------------------------ validação

export type ChaveErroEstruturado =
  | 'obrigatorio'
  | 'maxLength'
  | 'pesoFaixa'
  | 'duracaoFaixa'
  | 'maxItens'
  | 'dataInvalida'
  | 'intervaloData'

export type ErroEstruturado = {
  /** Id do campo no formulário: `motivo`, `prescricaoItens.0.nome`. */
  id: string
  /** Chave sob `atendimentos.estruturada.erros`. */
  chave: ChaveErroEstruturado
  params?: Record<string, string | number>
}

function excedeu(valor: string, max: number): boolean {
  return valor.trim().length > max
}

/**
 * Valida o que o backend recusaria, para o erro aparecer no campo certo em vez de
 * voltar como 400 genérico. Campo vazio nunca é erro: tudo aqui é opcional.
 */
export function validarAnotacaoEstruturada(
  tipo: TipoServicoPrestador,
  form: AnotacaoEstruturadaForm,
): ErroEstruturado[] {
  const erros: ErroEstruturado[] = []
  const aceita = (campo: CampoEstruturado) => tipoAceitaCampo(tipo, campo)

  for (const [campo, max] of Object.entries(LIMITES_ESCALARES) as [
    keyof typeof LIMITES_ESCALARES,
    number,
  ][]) {
    if (aceita(campo) && excedeu(form[campo], max)) {
      erros.push({ id: campo, chave: 'maxLength', params: { max } })
    }
  }

  if (aceita('pesoKg') && form.pesoKg != null) {
    if (form.pesoKg < PESO_MIN_KG || form.pesoKg > PESO_MAX_KG) {
      erros.push({
        id: 'pesoKg',
        chave: 'pesoFaixa',
        params: { min: PESO_MIN_KG, max: PESO_MAX_KG },
      })
    }
  }

  if (
    aceita('dataResultado') &&
    form.dataResultado.trim() &&
    !dataLocalParaIso(form.dataResultado)
  ) {
    erros.push({ id: 'dataResultado', chave: 'dataInvalida' })
  }

  const entrada =
    aceita('dataEntrada') && form.dataEntrada.trim() ? dataHoraLocalParaIso(form.dataEntrada) : null
  const saida =
    aceita('dataSaida') && form.dataSaida.trim() ? dataHoraLocalParaIso(form.dataSaida) : null

  if (aceita('dataEntrada') && form.dataEntrada.trim() && !entrada) {
    erros.push({ id: 'dataEntrada', chave: 'dataInvalida' })
  }

  if (aceita('dataSaida') && form.dataSaida.trim() && !saida) {
    erros.push({ id: 'dataSaida', chave: 'dataInvalida' })
  }

  if (entrada && saida && new Date(saida).getTime() < new Date(entrada).getTime()) {
    erros.push({ id: 'dataSaida', chave: 'intervaloData' })
  }

  if (aceita('prescricaoItens')) {
    const itens = form.prescricaoItens.filter(itemPrescricaoPreenchido)

    if (itens.length > MAX_ITENS_LISTA) {
      erros.push({ id: 'prescricaoItens', chave: 'maxItens', params: { max: MAX_ITENS_LISTA } })
    }

    form.prescricaoItens.forEach((item, indice) => {
      if (!itemPrescricaoPreenchido(item)) {
        return
      }

      if (!item.nome.trim()) {
        erros.push({ id: `prescricaoItens.${indice}.nome`, chave: 'obrigatorio' })
      }

      for (const [campo, max] of Object.entries(LIMITES_PRESCRICAO) as [
        keyof typeof LIMITES_PRESCRICAO,
        number,
      ][]) {
        if (excedeu(item[campo], max)) {
          erros.push({
            id: `prescricaoItens.${indice}.${campo}`,
            chave: 'maxLength',
            params: { max },
          })
        }
      }

      if (
        item.duracaoDias != null &&
        (!Number.isInteger(item.duracaoDias) ||
          item.duracaoDias < DURACAO_MIN_DIAS ||
          item.duracaoDias > DURACAO_MAX_DIAS)
      ) {
        erros.push({
          id: `prescricaoItens.${indice}.duracaoDias`,
          chave: 'duracaoFaixa',
          params: { min: DURACAO_MIN_DIAS, max: DURACAO_MAX_DIAS },
        })
      }
    })
  }

  if (aceita('examesSolicitados')) {
    const itens = form.examesSolicitados.filter(itemExamePreenchido)

    if (itens.length > MAX_ITENS_LISTA) {
      erros.push({ id: 'examesSolicitados', chave: 'maxItens', params: { max: MAX_ITENS_LISTA } })
    }

    form.examesSolicitados.forEach((item, indice) => {
      if (!itemExamePreenchido(item)) {
        return
      }

      if (!item.nome.trim()) {
        erros.push({ id: `examesSolicitados.${indice}.nome`, chave: 'obrigatorio' })
      }

      for (const [campo, max] of Object.entries(LIMITES_EXAME_SOLICITADO) as [
        keyof typeof LIMITES_EXAME_SOLICITADO,
        number,
      ][]) {
        if (excedeu(item[campo], max)) {
          erros.push({
            id: `examesSolicitados.${indice}.${campo}`,
            chave: 'maxLength',
            params: { max },
          })
        }
      }
    })
  }

  return erros
}

/** Item em branco é linha que o prestador abriu e não usou: descartada, não é erro. */
function itemPrescricaoPreenchido(item: PrescricaoItemForm): boolean {
  return Boolean(
    item.nome.trim() ||
    item.dose.trim() ||
    item.unidade.trim() ||
    item.frequencia.trim() ||
    item.instrucoes.trim() ||
    item.duracaoDias != null,
  )
}

function itemExamePreenchido(item: ExameSolicitadoForm): boolean {
  return Boolean(item.nome.trim() || item.observacao.trim())
}

// ------------------------------------------------------------------ montagem

function textoOuUndefined(valor: string): string | undefined {
  const limpo = valor.trim()

  return limpo || undefined
}

/**
 * Monta o payload que vai para o multipart, filtrado pelo tipo do acesso.
 * Devolve `null` quando nada estruturado foi preenchido — nesse caso nenhum campo
 * novo entra no form e o backend segue o caminho legado.
 *
 * Garantia central: nenhuma chave fora de `CAMPOS_POR_TIPO_SERVICO[tipo]` sai daqui.
 */
export function montarAnotacaoEstruturada(
  tipo: TipoServicoPrestador,
  form: AnotacaoEstruturadaForm | undefined,
): AnotacaoEstruturadaInput | null {
  if (!form) {
    return null
  }

  const aceita = (campo: CampoEstruturado) => tipoAceitaCampo(tipo, campo)
  const payload: AnotacaoEstruturadaInput = {}

  if (aceita('motivo')) payload.motivo = textoOuUndefined(form.motivo)
  if (aceita('diagnostico')) payload.diagnostico = textoOuUndefined(form.diagnostico)
  if (aceita('tipoExame')) payload.tipoExame = textoOuUndefined(form.tipoExame)
  if (aceita('laudoTexto')) payload.laudoTexto = textoOuUndefined(form.laudoTexto)
  if (aceita('produtos')) payload.produtos = textoOuUndefined(form.produtos)
  if (aceita('condicaoPele')) payload.condicaoPele = textoOuUndefined(form.condicaoPele)
  if (aceita('comportamento')) payload.comportamento = textoOuUndefined(form.comportamento)
  if (aceita('alimentacao')) payload.alimentacao = textoOuUndefined(form.alimentacao)
  if (aceita('intercorrencias')) payload.intercorrencias = textoOuUndefined(form.intercorrencias)

  if (aceita('pesoKg') && form.pesoKg != null) {
    payload.pesoKg = form.pesoKg
  }

  if (aceita('dataResultado') && form.dataResultado.trim()) {
    payload.dataResultado = dataLocalParaIso(form.dataResultado) ?? undefined
  }

  if (aceita('dataEntrada') && form.dataEntrada.trim()) {
    payload.dataEntrada = dataHoraLocalParaIso(form.dataEntrada) ?? undefined
  }

  if (aceita('dataSaida') && form.dataSaida.trim()) {
    payload.dataSaida = dataHoraLocalParaIso(form.dataSaida) ?? undefined
  }

  if (aceita('prescricaoItens')) {
    const itens = form.prescricaoItens
      .filter(itemPrescricaoPreenchido)
      .filter((item) => item.nome.trim())
      .map<AnotacaoPrescricaoItemInput>((item) => ({
        nome: item.nome.trim(),
        dose: textoOuUndefined(item.dose),
        unidade: textoOuUndefined(item.unidade),
        frequencia: textoOuUndefined(item.frequencia),
        duracaoDias: item.duracaoDias ?? undefined,
        instrucoes: textoOuUndefined(item.instrucoes),
      }))

    if (itens.length) {
      payload.prescricaoItens = itens
    }
  }

  if (aceita('examesSolicitados')) {
    const itens = form.examesSolicitados
      .filter(itemExamePreenchido)
      .filter((item) => item.nome.trim())
      .map<AnotacaoExameSolicitadoInput>((item) => ({
        nome: item.nome.trim(),
        observacao: textoOuUndefined(item.observacao),
      }))

    if (itens.length) {
      payload.examesSolicitados = itens
    }
  }

  // Chave com `undefined` é campo não preenchido: sai fora para o backend
  // distinguir "não mandou" de "mandou vazio".
  for (const chave of Object.keys(payload) as (keyof AnotacaoEstruturadaInput)[]) {
    if (payload[chave] === undefined) {
      delete payload[chave]
    }
  }

  return Object.keys(payload).length ? payload : null
}

/**
 * Última barreira antes do fio: derruba qualquer chave que o `tipoServico` não
 * aceite. `montarAnotacaoEstruturada` já filtra, mas quem serializa o multipart
 * não deveria confiar em quem chamou — campo no tipo errado é 400 na cara do
 * prestador, com a anotação inteira perdida.
 */
export function filtrarEstruturadoPorTipo(
  tipo: TipoServicoPrestador,
  estruturado: AnotacaoEstruturadaInput | undefined,
): AnotacaoEstruturadaInput | null {
  if (!estruturado) {
    return null
  }

  const permitidos = camposDoTipo(tipo)
  const saida: AnotacaoEstruturadaInput = {}

  for (const campo of permitidos) {
    const valor = estruturado[campo]

    if (valor == null || (Array.isArray(valor) && valor.length === 0)) {
      continue
    }

    Object.assign(saida, { [campo]: valor })
  }

  return Object.keys(saida).length ? saida : null
}

// ------------------------------------------------------------------ leitura

/** Campos estruturados preenchidos numa anotação já salva, na ordem de exibição. */
export function escalaresPreenchidos(
  anotacao: Anotacao,
): { campo: CampoEscalar; valor: string | number }[] {
  return CAMPOS_ESCALARES.flatMap((campo) => {
    const valor = anotacao[campo]

    if (valor == null || (typeof valor === 'string' && !valor.trim())) {
      return []
    }

    return [{ campo, valor }]
  })
}

export function temEstruturados(anotacao: Anotacao): boolean {
  return (
    escalaresPreenchidos(anotacao).length > 0 ||
    (anotacao.prescricaoItens?.length ?? 0) > 0 ||
    (anotacao.examesSolicitados?.length ?? 0) > 0
  )
}
