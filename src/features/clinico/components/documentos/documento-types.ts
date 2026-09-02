/**
 * Contrato dos documentos emitidos pelo prontuário. Fora do SFC porque `<script setup>` não
 * exporta tipo.
 *
 * A lista cresceu para cobrir o que uma clínica realmente emite depois do atendimento. Três
 * famílias, e a distinção importa para quem assina:
 *
 * - **Declarações** — o profissional afirma um fato (atestado, declaração de óbito). Assinatura
 *   só dele.
 * - **Termos** — o responsável autoriza, recusa ou toma ciência. Precisam de **duas**
 *   assinaturas, e a do responsável é a que dá valor ao papel.
 * - **Recortes do prontuário** — pedido de exame, orientações, encaminhamento. Não afirmam nada
 *   novo: reorganizam o que já está registrado para a pessoa certa poder levar embora.
 */
export type DocumentoId =
  // recortes do prontuário
  | 'prontuario'
  | 'receituario'
  | 'pedido-exame'
  | 'orientacoes'
  | 'encaminhamento'
  | 'relatorio-plano'
  // declarações do profissional
  | 'atestado-saude'
  | 'atestado-comparecimento'
  | 'atestado-viagem'
  | 'declaracao-obito'
  | 'comprovante-vacinacao'
  // termos assinados pelo responsável
  | 'termo-consentimento'
  | 'termo-recusa'
  | 'termo-eutanasia'
  // administrativo
  | 'orcamento'

/**
 * Termos que o responsável assina.
 *
 * Compartilham a mesma estrutura — texto declaratório, o que está sendo autorizado ou recusado,
 * e duas assinaturas — e por isso um componente só os atende. O que muda é a gravidade do texto,
 * e ela vem do `kind`.
 */
export type TermoKind = 'consentimento' | 'recusa' | 'eutanasia'
