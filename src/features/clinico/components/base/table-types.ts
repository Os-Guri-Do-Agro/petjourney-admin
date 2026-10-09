/**
 * Contrato de coluna da `ClinicDataTable`.
 *
 * Vive fora do SFC porque `<script setup>` não exporta tipo, e quem monta a tabela precisa
 * declarar as colunas com tipagem.
 */

/** Ordem de uma coluna. `null` significa "sem ordenação", que é diferente de crescente. */
export type DirecaoOrdenacao = 'asc' | 'desc'

export type ColunaTabela<T = unknown> = {
  id: string
  rotulo: string
  /** Qualquer unidade válida de `grid-template-columns`. */
  largura?: string
  /** Alinha e aplica numeral tabular — coluna de número não pode dançar na vertical. */
  numerico?: boolean
  alinharAoFim?: boolean
  /** Perde a trilha abaixo de 1024; a informação continua no detalhe da linha. */
  ocultarEmTelaEstreita?: boolean

  /**
   * Valor pelo qual a coluna ordena.
   *
   * É uma função, e não o nome de um campo, porque a célula quase nunca mostra um campo cru:
   * a coluna "paciente" renderiza o nome do pet a partir de um `petId`, e ordenar por `petId`
   * ordenaria por identificador — alfabético em coisa nenhuma.
   *
   * Devolver `null` ou `undefined` joga a linha para o fim em **qualquer** direção: quem não
   * tem valor não compete por posição, e alternar a ordem não deve trazer os vazios para cima.
   *
   * Ausente significa coluna não ordenável — é o padrão, e é o certo para a coluna de ações.
   */
  ordenarPor?: (linha: T) => string | number | null | undefined

  /**
   * Direção do primeiro clique.
   *
   * Texto começa em A→Z; número e data começam do maior, porque "quem tem mais faltas" e "o
   * mais recente" são as perguntas que se faz numa tabela clínica. Padrão: `desc` para coluna
   * numérica, `asc` para as demais.
   */
  ordemInicial?: DirecaoOrdenacao
}

/** Estado de ordenação da tabela. `coluna` nulo é a ordem em que os dados chegaram. */
export type OrdenacaoTabela = {
  coluna: string | null
  direcao: DirecaoOrdenacao
}

/**
 * Ação por linha.
 *
 * Existe como contrato, e não como slot livre, por causa de um detalhe que toda tela errava
 * sozinha: o clique na ação **não pode** disparar a seleção da linha. Resolvido num lugar só.
 */
export type AcaoDeLinha<T = unknown> = {
  id: string
  rotulo: string
  /** Classe do Phosphor (`ph ph-*`). */
  icone?: string
  /** Ação destrutiva ganha tratamento próprio e nunca é a primeira da fila. */
  perigo?: boolean
  /** Some para as linhas em que não faz sentido, em vez de aparecer desabilitada. */
  visivel?: (linha: T) => boolean
  desabilitada?: (linha: T) => boolean
}
