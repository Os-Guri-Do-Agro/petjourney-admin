/**
 * Regras R3 e R4 — o que trava o turno e o que trava o check-out.
 *
 * As duas existem pelo mesmo motivo e têm o mesmo formato: um estado derivado que **impede uma
 * ação** enquanto alguém não fizer algo no mundo real. Nenhuma delas pode viver na tela, porque
 * regra que vive na tela é contornada pela próxima tela.
 *
 * - **R3**: ocorrência grave exige contato por voz com o responsável antes do fim do turno.
 *   Notícia ruim que chega por notificação de aplicativo, sem voz humana antes, transforma um
 *   diferencial de produto num processo.
 * - **R4**: o que entrou tem que sair. Pertence perdido é a reclamação mais barata de evitar —
 *   custa uma linha no check-in — e a mais cara de resolver.
 */

import { dataDe, diffDays } from './hotel-time'

import type {
  Adaptacao,
  Boletim,
  GravidadeDaOcorrencia,
  Hospedagem,
  ISODateTime,
  Ocorrencia,
  Pertence,
} from '../data/types'

// ---------------------------------------------------------------------------
// R3 · ocorrência grave exige contato
// ---------------------------------------------------------------------------

/**
 * Esta ocorrência trava alguma coisa?
 *
 * A gravidade é escolhida por quem registra, e é deliberadamente a **única** entrada da regra: um
 * `kind` não decide sozinho — uma briga pode ser dois latidos ou um ponto no lábio, e quem estava
 * lá sabe a diferença. Derivar a gravidade do tipo tiraria o julgamento de quem o tem.
 */
export function exigeContato(gravidade: GravidadeDaOcorrencia): boolean {
  return gravidade === 'grave'
}

/** Ocorrências graves ainda sem contato registrado. É a lista que trava a passagem de turno. */
export function ocorrenciasTravadas(ocorrencias: Ocorrencia[]): Ocorrencia[] {
  return ocorrencias.filter((item) => item.exigeContato && !item.contatoEm)
}

/**
 * O boletim pode sair?
 *
 * Um boletim que carrega ocorrência grave nasce `retido` e só é liberado depois da ligação. Note
 * que a regra olha para as ocorrências **do período do boletim**, não para as da estadia inteira:
 * a briga de segunda, já comunicada, não pode prender o boletim de quinta.
 */
export function boletimPodeSair(boletim: Pick<Boletim, 'exigeContato' | 'contatoEm'>): boolean {
  return !boletim.exigeContato || Boolean(boletim.contatoEm)
}

// ---------------------------------------------------------------------------
// R4 · o que entrou tem que sair
// ---------------------------------------------------------------------------

/**
 * Pertences que ainda não foram resolvidos.
 *
 * "Resolvido" não é "devolvido": um pertence não devolvido **com observação** também está
 * resolvido — a coleira que se perdeu, e alguém escreveu que se perdeu. O que trava é o item em
 * branco, porque é o único estado que significa "ninguém olhou".
 */
export function pertencesPendentes(pertences: Pertence[]): Pertence[] {
  return pertences.filter((item) => !item.devolvido && !item.observacao.trim())
}

/**
 * Por que o check-out não fecha.
 *
 * Lista de `kind`, e não um booleano, porque uma recusa sem motivo numa tela de balcão faz a
 * recepção tentar de novo exatamente do mesmo jeito.
 */
export type ImpedimentoDeSaida = 'pertences' | 'ocorrencia-sem-contato' | 'peso-de-saida'

export function impedimentosDeSaida(entrada: {
  pertences: Pertence[]
  ocorrencias: Ocorrencia[]
  pesoSaidaKg: number | null
}): ImpedimentoDeSaida[] {
  const impedimentos: ImpedimentoDeSaida[] = []

  if (pertencesPendentes(entrada.pertences).length > 0) {
    impedimentos.push('pertences')
  }

  if (ocorrenciasTravadas(entrada.ocorrencias).length > 0) {
    impedimentos.push('ocorrencia-sem-contato')
  }

  /*
   * A pesagem de saída trava porque é a única prova do que aconteceu com o animal, e porque ela
   * deixa de existir no instante em que o carro sai. Diferente das outras duas, esta se resolve no
   * próprio balcão em trinta segundos — e é justamente por ser fácil que ela é a mais esquecida.
   */
  if (entrada.pesoSaidaKg === null) {
    impedimentos.push('peso-de-saida')
  }

  return impedimentos
}

// ---------------------------------------------------------------------------
// Leitura da estadia
// ---------------------------------------------------------------------------

/**
 * Quantas noites o hóspede já passou na casa.
 *
 * Noite é **meia-noite atravessada**, não bloco de 24 horas. A diferença apareceu na tela: quem
 * entrou ontem às 14h e está aqui à 1h da manhã dormiu uma noite, e a conta por horas mostrava
 * zero — enquanto a grade de ocupação, que conta por data, mostrava a barra ocupando aquela noite.
 * Duas contas diferentes para a mesma palavra é como um sistema perde a confiança de quem o usa.
 */
export function noitesNaCasa(hospedagem: Hospedagem, agora: ISODateTime): number {
  const fim = hospedagem.saidaEm ?? agora

  return Math.max(0, diffDays(dataDe(hospedagem.entradaEm), dataDe(fim)))
}

/** Quanto falta para a saída prevista, em minutos. Negativo significa que já passou. */
export function minutosAteASaida(hospedagem: Hospedagem, agora: ISODateTime): number {
  return Math.round((Date.parse(hospedagem.saidaPrevistaEm) - Date.parse(agora)) / 60_000)
}

export function saiHoje(hospedagem: Hospedagem, hoje: string): boolean {
  return hospedagem.status === 'hospedado' && hospedagem.saidaPrevistaEm.slice(0, 10) === hoje
}

/**
 * Quanto o hóspede perdeu ou ganhou, em percentual do peso de entrada.
 *
 * Percentual e não quilos: 400 g é irrelevante num são-bernardo e é sinal de alerta num yorkshire,
 * e uma tela que mostre os dois com o mesmo destaque ensina a ignorar o destaque.
 */
export function variacaoDePeso(hospedagem: Hospedagem): number | null {
  if (hospedagem.pesoSaidaKg === null || hospedagem.pesoEntradaKg <= 0) {
    return null
  }

  return (hospedagem.pesoSaidaKg - hospedagem.pesoEntradaKg) / hospedagem.pesoEntradaKg
}

/**
 * Perda de peso que merece conversa.
 *
 * Cinco por cento: abaixo disso cabe na diferença entre duas balanças e no fato de o animal ter
 * acabado de comer. Acima, é a estadia que não correu bem — e o responsável vai perguntar.
 */
export const PERDA_RELEVANTE = 0.05

export function perdeuPesoRelevante(hospedagem: Hospedagem): boolean {
  const variacao = variacaoDePeso(hospedagem)

  return variacao !== null && variacao <= -PERDA_RELEVANTE
}

/**
 * Como o hóspede está se dando, no tom da escada do portal.
 *
 * `em-adaptacao` mapeia para atenção e não para risco de propósito: no primeiro dia é o normal, e
 * pintar de vermelho o que é esperado ensina a clínica — e o hotel — a não olhar para a cor.
 */
export function tomDaAdaptacao(adaptacao: Adaptacao): 'neutro' | 'atencao' | 'risco' {
  if (adaptacao === 'estressado') {
    return 'risco'
  }

  return adaptacao === 'em-adaptacao' ? 'atencao' : 'neutro'
}

export function tomDaGravidade(gravidade: GravidadeDaOcorrencia): 'neutro' | 'atencao' | 'risco' {
  if (gravidade === 'grave') {
    return 'risco'
  }

  return gravidade === 'moderada' ? 'atencao' : 'neutro'
}
