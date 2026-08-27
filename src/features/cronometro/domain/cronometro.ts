/**
 * Cronômetro de atendimento: a conta que transforma tempo em cobrança.
 *
 * O modelo é o de serviço profissional cobrado por tempo, que é como veterinária funciona nos
 * países onde o profissional recebe pelo relógio — e como advocacia e consultoria funcionam em
 * todo lugar. Três regras vêm de fora e não são escolha nossa:
 *
 * 1. **A consulta é vendida em bloco.** O preço de tabela cobre uma duração — a RVC, por
 *    exemplo, publica a consulta padrão como "20 minutos de tempo de veterinário" e a estendida
 *    como 40. O bloco não é meta: é o que já está pago.
 * 2. **O que passa do bloco é cobrado em incrementos, arredondados para cima.** A unidade
 *    padrão de serviço profissional é o décimo de hora — 6 minutos —; a clínica veterinária
 *    costuma trabalhar em 15. Um minuto além do bloco consome uma unidade inteira, e é
 *    exatamente por isso que quem cobra por tempo precisa **ver a virada chegando**, não
 *    descobrir depois.
 * 3. **Tempo faturável não é tempo passado.** Sair da sala, atender o telefone, almoçar: nada
 *    disso é atendimento. Sem pausa, o cronômetro mede permanência, não trabalho — e um número
 *    que mede a coisa errada é pior que nenhum número, porque parece confiável.
 *
 * Duas decisões de implementação que valem dizer em voz alta:
 *
 * - **A medição é por relógio de parede, nunca por soma de tiques.** Guardamos o instante em
 *   que o trecho começou e subtraímos. Contador que soma `setInterval` atrasa quando a aba vai
 *   para segundo plano — o navegador estrangula o temporizador — e a conta erra justamente no
 *   atendimento longo, que é o que mais vale.
 * - **A primeira unidade nasce consumida.** Começar o relógio já compromete um incremento: é a
 *   regra do modelo ("mesmo consultas curtas"), e mostrá-la desde o primeiro segundo evita a
 *   surpresa de ver 1 unidade aparecer sozinha aos seis minutos.
 *
 * Nada aqui arredonda o tempo mostrado. O decorrido aparece cru ao lado das unidades, sempre:
 * quem cobra precisa poder justificar o número, e número faturável sem o tempo real ao lado é
 * como o modelo vira abuso.
 */

const MS_POR_MINUTO = 60_000

/**
 * Incrementos que a interface oferece.
 *
 * 6 minutos é o décimo de hora do serviço profissional; 15 é o passo usual da clínica
 * veterinária; 10 e 30 aparecem em tabela de especialidade e de procedimento longo. Abaixo de 6
 * o registro vira burocracia sem ganho — é o consenso do setor, não um limite técnico.
 */
export const INCREMENTOS_MINUTOS = [6, 10, 15, 30] as const

/** Blocos de consulta usuais: rápida, padrão, estendida, procedimento. */
export const BLOCOS_MINUTOS = [10, 15, 20, 30, 40, 60] as const

export const PREFERENCIAS_PADRAO = {
  /** 15 min: a consulta padrão mais comum em pequenos animais. */
  blocoMinutos: 15,
  /** 15 min: o passo em que a clínica veterinária costuma medir tempo faturável. */
  incrementoMinutos: 15,
}

/** Antecedência do aviso de fim de bloco: tempo de fechar a conversa, não de correr. */
const AVISO_DE_BLOCO_MS = 2 * MS_POR_MINUTO

/**
 * A partir daqui a sessão é tratada como esquecida.
 *
 * Ninguém atende o mesmo paciente por quatro horas seguidas sem pausar. O que acontece de
 * verdade é o profissional fechar o notebook com o relógio correndo — e um cronômetro que
 * ninguém parou infla a fatura de alguém. A interface passa a duvidar do número em vez de
 * apagá-lo sozinha: apagar destruiria tempo real de quem de fato atendeu quatro horas.
 */
export const LIMITE_DE_SESSAO_ESQUECIDA_MS = 4 * 60 * MS_POR_MINUTO

export type SessaoCronometro = {
  /** Atendimento cronometrado. Sem ele o tempo não tem a quem ser cobrado. */
  encounterId: string | null
  /** O que a pessoa lê no cabeçalho: nome do paciente, ou um rótulo livre. */
  rotulo: string
  /** Instante em que o trecho em curso começou. Nulo enquanto pausado. */
  correndoDesde: number | null
  /** Milissegundos dos trechos já fechados por pausa. */
  acumuladoMs: number
  iniciadaEm: number
  blocoMinutos: number
  incrementoMinutos: number
}

export type EstadoDaSessao = 'dentro' | 'no-limite' | 'excedido'

export type MedicaoDaSessao = {
  decorridoMs: number
  correndo: boolean
  /** Unidades de cobrança consumidas — arredondadas para cima, mínimo de uma. */
  unidades: number
  minutosCobraveis: number
  /** Minutos além do bloco contratado; zero enquanto dentro dele. */
  excedenteMs: number
  /** Unidades que existem só por causa do excedente. */
  unidadesExcedentes: number
  estado: EstadoDaSessao
  /** Milissegundos até virar a próxima unidade de cobrança. */
  ateProximaUnidadeMs: number
  /** Quanto do bloco já foi consumido, de 0 a 1. Satura em 1 para servir de barra. */
  fracaoDoBloco: number
  esquecida: boolean
}

export type ResumoDaSessao = {
  id: string
  encounterId: string | null
  rotulo: string
  iniciadaEm: number
  encerradaEm: number
  decorridoMs: number
  unidades: number
  minutosCobraveis: number
  excedenteMs: number
  blocoMinutos: number
  incrementoMinutos: number
}

/**
 * Unidades de cobrança consumidas por uma duração.
 *
 * Sempre para cima, sempre pelo menos uma: é a regra do modelo. Incremento zero ou negativo
 * devolve zero em vez de dividir por zero — configuração inválida não pode virar `Infinity` no
 * meio de uma fatura.
 */
export function unidadesCobraveis(decorridoMs: number, incrementoMinutos: number): number {
  if (incrementoMinutos <= 0) {
    return 0
  }

  return Math.max(1, Math.ceil(Math.max(0, decorridoMs) / (incrementoMinutos * MS_POR_MINUTO)))
}

export function medirSessao(sessao: SessaoCronometro, agora: number): MedicaoDaSessao {
  const correndo = sessao.correndoDesde !== null
  const emCurso = correndo ? Math.max(0, agora - (sessao.correndoDesde ?? agora)) : 0
  const decorridoMs = Math.max(0, sessao.acumuladoMs + emCurso)

  const blocoMs = Math.max(0, sessao.blocoMinutos) * MS_POR_MINUTO
  const incrementoMs = Math.max(0, sessao.incrementoMinutos) * MS_POR_MINUTO

  const unidades = unidadesCobraveis(decorridoMs, sessao.incrementoMinutos)
  const excedenteMs = Math.max(0, decorridoMs - blocoMs)

  /*
   * O excedente conta as unidades **acima das que o bloco já cobria**, e não as unidades do
   * excedente isolado. Bloco de 15 com incremento de 15: aos 16 minutos são duas unidades no
   * total, uma delas excedente — contar o minuto solto daria uma unidade e esconderia que a
   * segunda inteira já foi comprada.
   */
  const unidadesDoBloco = blocoMs > 0 ? unidadesCobraveis(blocoMs, sessao.incrementoMinutos) : 0
  const unidadesExcedentes = excedenteMs > 0 ? Math.max(0, unidades - unidadesDoBloco) : 0

  const restanteDoBloco = blocoMs - decorridoMs

  /** Sem bloco configurado não existe "estourar o bloco" — só o relógio correndo. */
  const estado: EstadoDaSessao =
    blocoMs <= 0
      ? 'dentro'
      : restanteDoBloco <= 0
        ? 'excedido'
        : restanteDoBloco <= AVISO_DE_BLOCO_MS
          ? 'no-limite'
          : 'dentro'

  /*
   * A unidade em curso termina em `unidades × incremento` — a unidade 1 cobre de zero a um
   * incremento cheio. Daí o tempo até a virada ser essa borda menos o decorrido, e não o resto
   * da divisão: no instante exato do incremento o resto é zero e a conta pelo resto anunciaria
   * uma virada inteira de folga bem quando ela está acontecendo.
   */
  const ateProximaUnidadeMs =
    incrementoMs > 0 ? Math.max(0, unidades * incrementoMs - decorridoMs) : 0

  return {
    decorridoMs,
    correndo,
    unidades,
    minutosCobraveis: unidades * Math.max(0, sessao.incrementoMinutos),
    excedenteMs,
    unidadesExcedentes,
    estado,
    ateProximaUnidadeMs,
    fracaoDoBloco: blocoMs > 0 ? Math.min(1, decorridoMs / blocoMs) : 0,
    /** Só uma sessão em curso pode estar esquecida: pausada, alguém já mexeu nela. */
    esquecida: correndo && decorridoMs >= LIMITE_DE_SESSAO_ESQUECIDA_MS,
  }
}

export function pausarSessao(sessao: SessaoCronometro, agora: number): SessaoCronometro {
  if (sessao.correndoDesde === null) {
    return sessao
  }

  return {
    ...sessao,
    acumuladoMs: sessao.acumuladoMs + Math.max(0, agora - sessao.correndoDesde),
    correndoDesde: null,
  }
}

export function retomarSessao(sessao: SessaoCronometro, agora: number): SessaoCronometro {
  return sessao.correndoDesde === null ? { ...sessao, correndoDesde: agora } : sessao
}

export function encerrarSessao(
  sessao: SessaoCronometro,
  agora: number,
  id: string,
): ResumoDaSessao {
  const medicao = medirSessao(sessao, agora)

  return {
    id,
    encounterId: sessao.encounterId,
    rotulo: sessao.rotulo,
    iniciadaEm: sessao.iniciadaEm,
    encerradaEm: agora,
    decorridoMs: medicao.decorridoMs,
    unidades: medicao.unidades,
    minutosCobraveis: medicao.minutosCobraveis,
    excedenteMs: medicao.excedenteMs,
    blocoMinutos: sessao.blocoMinutos,
    incrementoMinutos: sessao.incrementoMinutos,
  }
}

/**
 * Relógio do cabeçalho: `mm:ss` até a primeira hora, `h:mm:ss` depois.
 *
 * Segundos aparecem porque a virada de unidade acontece num segundo específico e a pessoa
 * precisa vê-la chegar. A hora só entra quando existe — `00:07:12` num atendimento de sete
 * minutos gasta um campo de leitura para dizer zero.
 */
export function formatarDuracao(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const horas = Math.floor(total / 3600)
  const minutos = Math.floor((total % 3600) / 60)
  const segundos = total % 60
  const doisDigitos = (valor: number) => String(valor).padStart(2, '0')

  return horas > 0
    ? `${horas}:${doisDigitos(minutos)}:${doisDigitos(segundos)}`
    : `${doisDigitos(minutos)}:${doisDigitos(segundos)}`
}

/** Soma faturável de um conjunto de sessões — o total do dia do profissional. */
export function totalDeMinutosCobraveis(sessoes: ResumoDaSessao[]): number {
  return sessoes.reduce((soma, sessao) => soma + sessao.minutosCobraveis, 0)
}

export function totalDecorridoMs(sessoes: ResumoDaSessao[]): number {
  return sessoes.reduce((soma, sessao) => soma + sessao.decorridoMs, 0)
}
