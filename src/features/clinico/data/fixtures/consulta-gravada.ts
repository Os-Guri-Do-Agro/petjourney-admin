/**
 * A consulta de demonstração da anamnese por voz.
 *
 * É **conversa, não gabarito**: o motor de `domain/escuta.ts` lê este texto como leria o
 * microfone, e o que ele propõe sai da leitura — nada aqui diz qual campo cada frase preenche.
 * O roteiro só foi escrito para que os casos difíceis aconteçam de verdade diante de quem
 * assiste:
 *
 * - **O latido cobre um número.** A responsável diz "dois dias"; com o cachorro da recepção
 *   latindo por cima, a transcrição ouve "dez". A proposta sai errada — 10 dias — e sai marcada.
 * - **Duas vozes ao mesmo tempo.** A responsável diz que o cocô está normal; a filha, junto,
 *   diz que está mole. O trecho chega embaralhado e a proposta mostra as duas versões.
 * - **A máquina deduz.** "A vacina da raiva ela tomou em março" vira "vacinação em dia" — marcado
 *   como dedução, porque ninguém disse "em dia", e uma vacina não é a carteira inteira.
 * - **A hipótese fica com quem decide.** O veterinário pensa alto — "pode ser uma
 *   gastroenterite" — e o motor não preenche diagnóstico: anota que ouviu.
 * - **O peso de casa não vira vital.** "Tá com uns seis quilos" é informação do responsável.
 *
 * O texto se ajusta ao paciente aberto: nome, responsável e a concordância de gênero — `{a|o}`
 * escolhe a forma feminina ou masculina pelo sexo do animal. Uma demonstração que chama o Thor
 * de "ela" faz a plateia desconfiar de todo o resto.
 */

import type { FalanteDaEscuta, InterferenciaDaEscuta, PetSex, TrechoDaConversa } from '../types'

type FalaDoRoteiro = {
  falante: FalanteDaEscuta
  emMs: number
  confianca: number
  interferencia?: InterferenciaDaEscuta
  texto: string
}

const ROTEIRO: FalaDoRoteiro[] = [
  {
    falante: 'veterinario',
    emMs: 0,
    confianca: 0.97,
    texto: 'Oi, {resp}, tudo bem? Me conta, o que aconteceu com {a|o} {pet}?',
  },
  {
    falante: 'responsavel',
    emMs: 5200,
    confianca: 0.94,
    texto: '{Ela|Ele} tá vomitando. Vomitou três vezes ontem e hoje de manhã de novo.',
  },
  {
    falante: 'veterinario',
    emMs: 13100,
    confianca: 0.96,
    texto: 'E desde quando {ela|ele} tá assim?',
  },
  /* O cachorro da recepção. Trecho sem fala: só a interferência, que a conversa mostra. */
  { falante: 'nao-identificado', emMs: 16400, confianca: 0, interferencia: 'latido', texto: '' },
  /* Foi dito "dois". O latido cobriu, e o reconhecimento ouviu o que pôde. */
  {
    falante: 'responsavel',
    emMs: 17000,
    confianca: 0.46,
    interferencia: 'latido',
    texto: 'Começou faz dez dias, mais ou menos.',
  },
  { falante: 'veterinario', emMs: 21500, confianca: 0.95, texto: 'Hum. E {ela|ele} tá comendo?' },
  {
    falante: 'responsavel',
    emMs: 24000,
    confianca: 0.93,
    texto: 'Não, recusou a ração hoje cedo. Nem tocou no pote.',
  },
  {
    falante: 'responsavel',
    emMs: 29600,
    confianca: 0.91,
    texto:
      'E tá bem quietinh{a|o}, só deitad{a|o}. Hoje tá pior, vomitou duas vezes antes de a gente sair.',
  },
  {
    falante: 'veterinario',
    emMs: 39800,
    confianca: 0.95,
    texto: '{Ela|Ele} comeu alguma coisa diferente nos últimos dias?',
  },
  {
    falante: 'responsavel',
    emMs: 44300,
    confianca: 0.92,
    texto: 'Domingo teve churrasco lá em casa e {ela|ele} pegou um osso de frango do lixo.',
  },
  { falante: 'veterinario', emMs: 52000, confianca: 0.96, texto: 'Entendi. E o xixi, o cocô?' },
  { falante: 'responsavel', emMs: 55200, confianca: 0.93, texto: 'O xixi tá normal.' },
  /* A responsável e a filha respondem juntas, e discordam. Sem autoria: são duas vozes. */
  {
    falante: 'nao-identificado',
    emMs: 57600,
    confianca: 0.55,
    interferencia: 'fala-sobreposta',
    texto: 'O cocô tá normal, fez hoje cedo fez mole mãe fez mole',
  },
  {
    falante: 'veterinario',
    emMs: 63500,
    confianca: 0.96,
    texto: 'E vacina, vermífugo, como estão?',
  },
  {
    falante: 'responsavel',
    emMs: 66800,
    confianca: 0.91,
    texto: 'A vacina da raiva {ela|ele} tomou em março. Vermífugo tá em dia, dei mês passado.',
  },
  {
    falante: 'veterinario',
    emMs: 75400,
    confianca: 0.95,
    texto: '{Ela|Ele} tem alguma alergia? Toma algum remédio?',
  },
  {
    falante: 'responsavel',
    emMs: 79000,
    confianca: 0.93,
    texto: 'É alérgic{a|o} a dipirona. Remédio não toma nenhum. Foi castrad{a|o} ano passado.',
  },
  {
    falante: 'veterinario',
    emMs: 87600,
    confianca: 0.95,
    texto: 'E em casa, {ela|ele} fica mais dentro ou tem quintal?',
  },
  {
    falante: 'responsavel',
    emMs: 91200,
    confianca: 0.94,
    texto: 'A gente mora em apartamento. Pesei {ela|ele} em casa, tá com uns seis quilos.',
  },
  {
    falante: 'veterinario',
    emMs: 99000,
    confianca: 0.97,
    texto:
      'Pelo que você conta, pode ser uma gastroenterite. Mas vou examinar {ela|ele} antes de fechar qualquer coisa.',
  },
]

export type ContextoDaConsultaGravada = {
  /** Nome do paciente aberto no prontuário. */
  pet: string
  sexo: PetSex
  /** Primeiro nome do responsável: é assim que se fala com alguém na sala. */
  responsavel: string
}

function ajustar(texto: string, contexto: ContextoDaConsultaGravada): string {
  return texto
    .replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, feminino: string, masculino: string) =>
      contexto.sexo === 'femea' ? feminino : masculino,
    )
    .split('{pet}')
    .join(contexto.pet)
    .split('{resp}')
    .join(contexto.responsavel)
}

export function consultaGravada(contexto: ContextoDaConsultaGravada): TrechoDaConversa[] {
  return ROTEIRO.map((fala, indice) => ({
    id: `demo-${String(indice + 1).padStart(2, '0')}`,
    falante: fala.falante,
    texto: ajustar(fala.texto, contexto),
    emMs: fala.emMs,
    confianca: fala.confianca,
    interferencia: fala.interferencia ?? null,
  }))
}
