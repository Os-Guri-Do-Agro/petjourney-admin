/**
 * Os leitos com que a clínica **começa**.
 *
 * Fixture é ponto de partida, não verdade: o sistema não tem como adivinhar quantos leitos uma
 * clínica tem, então esta lista é só o estado inicial do protótipo. A partir daqui quem manda é
 * o gerenciamento — a clínica cadastra, renomeia, tira de operação e devolve leitos (ver
 * `internacao-repository.ts`).
 *
 * Oito, e não vinte: o número precisa ser pequeno o bastante para o mapa caber numa tela e grande
 * o bastante para a ocupação apertar durante a demonstração. Com quatro leitos livres sobrando,
 * "onde ponho o gato?" nunca vira pergunta — e é essa pergunta que o mapa existe para responder.
 *
 * A distribuição é a de uma clínica de bairro de verdade: a maioria é leito geral, o felino é uma
 * ilha separada, o isolamento tem dois e a UTI tem um só. Clínica com UTI de quatro leitos é
 * hospital, e não é o cliente deste produto.
 */

import type { Leito } from '../types'

/** Em operação: o caso comum, sem motivo nem data de parada. */
function emOperacao(
  id: string,
  nome: string,
  roomId: string,
  kind: Leito['kind'],
): Leito {
  return {
    id,
    nome,
    roomId,
    kind,
    ativo: true,
    motivoInativo: null,
    detalheInativo: '',
    inativoDesde: null,
  }
}

export const leitosFixture: Leito[] = [
  emOperacao('leito-r1', 'R1', 'sala-recuperacao', 'geral'),
  emOperacao('leito-r2', 'R2', 'sala-recuperacao', 'geral'),
  emOperacao('leito-r3', 'R3', 'sala-recuperacao', 'geral'),
  /*
   * Os felinos ficam juntos e longe da porta. Gato internado ao lado de cão não come, e um gato
   * que não come em 48 h desenvolve lipidose hepática — o leito errado vira diagnóstico novo.
   */
  emOperacao('leito-f1', 'F1', 'sala-recuperacao', 'felino'),
  emOperacao('leito-f2', 'F2', 'sala-recuperacao', 'felino'),
  /**
   * A UTI é um leito só, e é o gargalo de propósito.
   *
   * É onde o mapa dói: com o paciente crítico dentro, o próximo crítico não tem para onde ir, e a
   * clínica precisa decidir na tela. Um protótipo em que sempre há vaga não demonstra nada.
   */
  emOperacao('leito-uti', 'UTI', 'sala-recuperacao', 'uti'),
  emOperacao('leito-i1', 'I1', 'sala-isolamento', 'isolamento'),
  /*
   * Fora de operação, com motivo declarado.
   *
   * Some da conta de vagas sem sumir da tela — um leito que desaparece durante a desinfecção faz
   * o mapa mudar de tamanho, e quem lê o mapa por posição perde a referência. O motivo viaja como
   * `kind`; o texto ao lado é o caso concreto.
   */
  {
    id: 'leito-i2',
    nome: 'I2',
    roomId: 'sala-isolamento',
    kind: 'isolamento',
    ativo: false,
    motivoInativo: 'manutencao',
    detalheInativo: 'Troca da grade e do ralo.',
    /* Preenchido pelo seed, que é quem conhece o relógio do dataset. */
    inativoDesde: null,
  },
]
