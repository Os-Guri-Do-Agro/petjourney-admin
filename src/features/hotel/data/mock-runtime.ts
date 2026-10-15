/**
 * Runtime da camada mocada do hotel: latência, falha por operação e sorteio determinístico.
 *
 * O **mecanismo** é o mesmo do módulo clínico e vem de lá — PRNG, latência e envelope de chamada
 * não são propriedade de nenhum dos dois. O que é próprio daqui é a **lista de operações**, e ela
 * precisa ser própria: a granularidade da falha é o que dá sentido ao painel de desenvolvimento.
 * Marcar uma refeição como servida precisa poder falhar sozinha, sem derrubar o mapa junto — é
 * exatamente o cenário que o cuidador vive com o wi-fi do fundo do canil.
 */

import {
  createPrng,
  getMockConfig,
  hashSeed,
  intBetween,
  pickFrom,
} from '@/features/clinico/data/mock-runtime'

export { createPrng, hashSeed, intBetween, pickFrom }

export type HotelOperation =
  | 'catalogo.carregar'
  /** Cadastro de corredor, tabela de preço e temporada — a casa mudando de forma. */
  | 'catalogo.salvar'
  | 'mapa.periodo'
  | 'reserva.listar'
  | 'reserva.abrir'
  | 'reserva.criar'
  | 'reserva.editar'
  | 'reserva.cancelar'
  | 'reserva.confirmar'
  | 'reserva.comprovante'
  | 'reserva.dispensar'
  | 'checkin.executar'
  | 'hospedagem.listar'
  | 'hospedagem.abrir'
  | 'hospedagem.adaptacao'
  | 'hospedagem.checkout'
  | 'rotina.listar'
  | 'rotina.padrao.ler'
  | 'rotina.padrao.publicar'
  | 'rotina.padrao.desfazer'
  | 'rotina.propor'
  | 'rotina.aprovar'
  | 'medicacao.registrar'
  | 'cuidado.registrar'
  | 'servico.acrescentar'
  | 'rotina.marcar'
  | 'diario.registrar'
  | 'ocorrencia.registrar'
  | 'ocorrencia.contato'
  | 'boletim.gerar'
  | 'boletim.enviar'
  | 'turno.passar'
  | 'acomodacao.salvar'
  | 'espera.listar'
  | 'resumo.carregar'
  /*
   * Reserva online. A disponibilidade é do celular do responsável; a resposta é do balcão. Falham
   * separadas, como na clínica.
   */
  | 'pedido.disponibilidade'
  | 'pedido.enviar'
  | 'pedido.listar'
  | 'pedido.responder'

/**
 * Erro da camada mocada.
 *
 * `kind` traduzível, nunca texto pronto de servidor — mesma disciplina do resto do portal. A tela
 * resolve `hotel.erros.<kind>`.
 */
export class HotelMockError extends Error {
  readonly kind: string

  constructor(kind: string, operation: HotelOperation) {
    super(`[mock] ${operation} falhou: ${kind}`)
    this.name = 'HotelMockError'
    this.kind = kind
  }
}

/** Falha por operação do hotel, configurável pelo painel de desenvolvimento. */
const falhaPorOperacao: Partial<Record<HotelOperation, number>> = {}

export function definirFalha(operation: HotelOperation, taxa: number) {
  falhaPorOperacao[operation] = Math.min(1, Math.max(0, taxa))
}

export function limparFalhas() {
  for (const chave of Object.keys(falhaPorOperacao)) {
    delete falhaPorOperacao[chave as HotelOperation]
  }
}

function dormir(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Envelope de toda chamada: paga a latência configurada e sorteia falha conforme a operação.
 *
 * **A latência e o modo offline vêm da configuração do módulo clínico**, e a falha por operação é
 * daqui. Não é inconsistência: latência e "a rede caiu" são propriedades da máquina de quem
 * demonstra, e valem para o portal inteiro; a taxa de erro é por rota, e as rotas são de cada
 * módulo. Um painel que oferecesse `internacao.administrar` ao lado de `rotina.marcar` faria quem
 * demonstra o hotel procurar a linha errada.
 *
 * O `produce` roda **depois** da espera, para que o dado devolvido reflita o estado no momento da
 * "resposta" e não no da chamada.
 */
export async function simularChamada<T>(operation: HotelOperation, produce: () => T): Promise<T> {
  const config = getMockConfig()

  await dormir(config.latenciaMs + Math.random() * config.jitterMs)

  if (config.offline) {
    throw new HotelMockError('offline', operation)
  }

  const taxa = falhaPorOperacao[operation] ?? 0

  if (taxa > 0 && Math.random() < taxa) {
    throw new HotelMockError('falha-servidor', operation)
  }

  return produce()
}
