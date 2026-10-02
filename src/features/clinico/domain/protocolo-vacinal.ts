/**
 * Protocolo vacinal: a sequência inteira de um paciente, e onde ele está nela.
 *
 * O recall (`vacinacao.ts`) responde "quem chamar". Isto responde a pergunta de dentro do
 * consultório e do celular do responsável: **o que este animal ainda vai tomar, e quando**. Para
 * o adulto é uma linha — o reforço anual. Para o filhote é a parte que importa: três doses de V10
 * com quatro semanas entre elas, a antirrábica que só cabe depois das doze semanas, e o reforço
 * que fecha o primeiro ano.
 *
 * Três regras que o plano precisa acertar:
 *
 * 1. **A série depende da idade em que começou.** Filhote faz a série longa porque o anticorpo
 *    da mãe anula as primeiras doses; o adulto que chega sem carteira faz a curta. O tamanho é
 *    decidido na primeira dose e **congelado na aplicação** (`AplicacaoVacina.dosesNaSerie`) —
 *    senão o "2 de 3" de um filhote viraria "2 de 2" no dia em que ele crescesse.
 * 2. **Antes da idade mínima, a dose não é devida.** Aparece como "a partir de", nunca como
 *    pendente ou atrasada. Uma carteira que cobra antirrábica de um filhote de oito semanas
 *    ensina o responsável a ignorar a carteira.
 * 3. **Opcional não iniciada não é pendência.** Giárdia e gripe canina dependem do estilo de vida;
 *    entram no plano quando alguém começa. Listá-las como pendentes faria todo cão da clínica
 *    parecer atrasado.
 *
 * A dose externa — aplicada em outro lugar — conta para a posição na série do mesmo jeito que a
 * da casa. Quem decide revacinar é o veterinário, não o sistema; o que o plano faz é deixar a
 * diferença visível.
 */

import { INTERVALO_ENTRE_DOSES_DA_SERIE } from '../data/fixtures/vacinas'
import type { AplicacaoVacina, ISODate, ISODateTime, Pet, Vacina } from '../data/types'

import { addDays, diffDays } from './clinic-time'
import { doseAtrasada, JANELA_DE_AVISO_EM_DIAS } from './vacinacao'

/**
 * Até que idade a série começa como **de filhote**: dezesseis semanas.
 *
 * É a idade até a qual o anticorpo materno ainda pode anular uma dose. Quem começa depois disso,
 * sem histórico, é tratado como adulto.
 */
export const LIMITE_DA_SERIE_DE_FILHOTE_EM_DIAS = 112

export type TipoDeSerie = 'filhote' | 'adulto'

/**
 * Em que ponto do plano está uma dose.
 *
 * - `aplicada` — já foi dada (aqui ou fora).
 * - `devida` — a data chegou, ou passou há menos que a carência. É a dose de hoje.
 * - `atrasada` — passou da carência. A mesma marca aparece no app do responsável.
 * - `prevista` — tem data e ela ainda não chegou.
 * - `aguarda-idade` — o animal ainda não tem a idade mínima. A data é a do aniversário da idade.
 * - `pendente` — essencial que nunca começou, num animal que já tem idade. Não tem data prevista
 *   para ter passado, então não é "atrasada": é a primeira dose que ninguém deu.
 */
export type EstadoDaDose =
  | 'aplicada'
  | 'devida'
  | 'atrasada'
  | 'prevista'
  | 'aguarda-idade'
  | 'pendente'

export type DoseNoPlano = {
  /** 1 a `total` na série; o reforço anual leva `total` também (é a série "fechada de novo"). */
  numero: number
  total: number
  tipo: 'serie' | 'reforco'
  estado: EstadoDaDose
  /** Data aplicada, ou a data em que a dose passa a caber. */
  em: ISODate
  /** Dias de hoje até `em`. Negativo quando passou. Nulo na aplicada. */
  dias: number | null
  aplicacao: AplicacaoVacina | null
  /** Horário marcado na agenda para esta dose, quando alguém marcou. */
  agendamento: { id: string; inicio: ISODateTime } | null
}

/** Como está a vacina inteira — é o que decide a cor da linha e o que o app conta. */
export type SituacaoNoPlano =
  | 'em-dia'
  | 'a-vencer'
  | 'devida'
  | 'atrasada'
  | 'aguarda-idade'
  | 'nao-iniciada'

export type VacinaNoPlano = {
  vacina: Vacina
  tipoDeSerie: TipoDeSerie
  /** Doses da série, na ordem, e depois o reforço que fecha o ciclo. */
  doses: DoseNoPlano[]
  /** A dose da vez — onde o animal está na sequência. Nula só se não houver próxima. */
  proxima: DoseNoPlano | null
  situacao: SituacaoNoPlano
  /** Doses da série já dadas. */
  aplicadasNaSerie: number
  total: number
  serieCompleta: boolean
  /** Reforços anuais dados depois da série, do mais antigo ao mais recente. */
  reforcos: AplicacaoVacina[]
}

export type PlanoVacinal = {
  petId: string
  /** Nula quando o nascimento não foi informado. */
  idadeEmDias: number | null
  /** A série que uma vacina nova abriria **hoje**. */
  faixa: TipoDeSerie
  vacinas: VacinaNoPlano[]
  /** Opcionais da espécie que ninguém começou. Aparecem recolhidas, não como pendência. */
  opcionaisNaoIniciadas: Vacina[]
  /** Contagens que os dois lados mostram no topo. */
  atrasadas: number
  devidas: number
}

/** Agendamento mínimo que o plano precisa para dizer "já marcada". */
export type AgendamentoDaDose = { id: string; inicio: ISODateTime; cancelado: boolean }

// ---------------------------------------------------------------------------
// A série de cada paciente
// ---------------------------------------------------------------------------

export function tipoDeSerie(nascimento: ISODate | null, inicio: ISODate): TipoDeSerie {
  /*
   * Sem nascimento, adulto. Não é chute confortável: é a série mais curta, e o veterinário ainda
   * escolhe a dose à mão na aplicação. O contrário — assumir filhote — faria um adulto resgatado
   * sem data voltar três vezes por uma série que ele não precisa.
   */
  if (!nascimento) {
    return 'adulto'
  }

  return diffDays(nascimento, inicio) < LIMITE_DA_SERIE_DE_FILHOTE_EM_DIAS ? 'filhote' : 'adulto'
}

export function dosesDaSerie(vacina: Vacina, tipo: TipoDeSerie): number {
  return tipo === 'filhote' ? vacina.dosesNaSerie : vacina.dosesAdultoSemHistorico
}

/** O dia em que o animal completa a idade mínima desta vacina. */
export function cabeAPartirDe(vacina: Vacina, nascimento: ISODate | null): ISODate | null {
  return nascimento ? addDays(nascimento, vacina.idadeMinimaDias) : null
}

/**
 * A dose que uma aplicação nova registraria agora.
 *
 * Continua a série aberta, se houver; abre uma nova com o tamanho da idade de hoje, se não
 * houver nada; e registra reforço (a série "fechada de novo", como a carteira escreve) quando a
 * série já está completa.
 */
export function doseSeguinte(
  vacina: Vacina,
  nascimento: ISODate | null,
  aplicacoesDaVacina: AplicacaoVacina[],
  hoje: ISODate,
): { dose: number; total: number; tipo: TipoDeSerie; reforco: boolean } {
  const ordenadas = [...aplicacoesDaVacina].sort((a, b) => a.aplicadaEm.localeCompare(b.aplicadaEm))
  const ultima = ordenadas[ordenadas.length - 1]

  if (!ultima) {
    const tipo = tipoDeSerie(nascimento, hoje)

    return { dose: 1, total: dosesDaSerie(vacina, tipo), tipo, reforco: false }
  }

  const tipo = tipoDaSerieAplicada(vacina, nascimento, ordenadas)

  if (ultima.dose < ultima.dosesNaSerie) {
    return { dose: ultima.dose + 1, total: ultima.dosesNaSerie, tipo, reforco: false }
  }

  return { dose: ultima.dosesNaSerie, total: ultima.dosesNaSerie, tipo, reforco: true }
}

/**
 * De que tipo é a série que já está no registro.
 *
 * Sai da idade na **primeira dose** daquela vacina, que é quando a decisão foi tomada. Com o
 * nascimento em branco, o tamanho congelado decide: série longa só existe em filhote.
 */
function tipoDaSerieAplicada(
  vacina: Vacina,
  nascimento: ISODate | null,
  ordenadas: AplicacaoVacina[],
): TipoDeSerie {
  const primeira = ordenadas.find((item) => item.dose === 1) ?? ordenadas[0]!

  if (nascimento) {
    return tipoDeSerie(nascimento, primeira.aplicadaEm.slice(0, 10))
  }

  return primeira.dosesNaSerie > vacina.dosesAdultoSemHistorico ? 'filhote' : 'adulto'
}

// ---------------------------------------------------------------------------
// Estado de cada dose
// ---------------------------------------------------------------------------

function estadoDaProxima(em: ISODate, hoje: ISODate, cabeEm: ISODate | null): EstadoDaDose {
  if (cabeEm && cabeEm > hoje && cabeEm >= em) {
    return 'aguarda-idade'
  }

  const dias = diffDays(hoje, em)

  if (doseAtrasada(dias)) {
    return 'atrasada'
  }

  return dias <= 0 ? 'devida' : 'prevista'
}

function situacaoDaVacina(proxima: DoseNoPlano | null, iniciada: boolean): SituacaoNoPlano {
  if (!proxima) {
    return 'em-dia'
  }

  switch (proxima.estado) {
    case 'atrasada':
      return 'atrasada'
    case 'devida':
      return 'devida'
    case 'aguarda-idade':
      return 'aguarda-idade'
    case 'pendente':
      return 'nao-iniciada'
    default:
      if (!iniciada) {
        return 'nao-iniciada'
      }

      return (proxima.dias ?? Infinity) <= JANELA_DE_AVISO_EM_DIAS ? 'a-vencer' : 'em-dia'
  }
}

function agendamentoValido(
  id: string | null,
  agendamentos: AgendamentoDaDose[],
): { id: string; inicio: ISODateTime } | null {
  if (!id) {
    return null
  }

  const marcado = agendamentos.find((item) => item.id === id && !item.cancelado)

  return marcado ? { id: marcado.id, inicio: marcado.inicio } : null
}

// ---------------------------------------------------------------------------
// O plano
// ---------------------------------------------------------------------------

/**
 * O plano de uma vacina num paciente.
 *
 * `null` quando a vacina é opcional e ninguém começou — ela não pertence ao plano ainda.
 */
export function planoDaVacina(entrada: {
  vacina: Vacina
  nascimento: ISODate | null
  aplicacoes: AplicacaoVacina[]
  agendamentos: AgendamentoDaDose[]
  hoje: ISODate
}): VacinaNoPlano | null {
  const { vacina, nascimento, hoje } = entrada
  const ordenadas = entrada.aplicacoes
    .filter((item) => item.vacinaId === vacina.id)
    .sort((a, b) => a.aplicadaEm.localeCompare(b.aplicadaEm))
  const cabeEm = cabeAPartirDe(vacina, nascimento)

  if (ordenadas.length === 0) {
    if (!vacina.essencial) {
      return null
    }

    return planoNaoIniciado(vacina, nascimento, cabeEm, hoje)
  }

  const ultima = ordenadas[ordenadas.length - 1]!
  const total = ultima.dosesNaSerie
  const tipo = tipoDaSerieAplicada(vacina, nascimento, ordenadas)

  /*
   * A série é a das doses 1..total. Na carteira de um adulto antigo, as doses 1 e 2 muitas vezes
   * nem estão no registro — ele chegou já no reforço. Por isso as doses da série são as que
   * existem, e não uma grade preenchida com buracos que o animal provavelmente não tem.
   */
  const daSerie = new Map<number, AplicacaoVacina>()

  for (const aplicacao of ordenadas) {
    if (!daSerie.has(aplicacao.dose)) {
      daSerie.set(aplicacao.dose, aplicacao)
    }
  }

  const serieCompleta = ultima.dose >= total
  /* Reforço é toda dose "de fechamento" que veio depois da primeira que fechou a série. */
  const primeiraQueFechou = ordenadas.find((item) => item.dose >= item.dosesNaSerie)
  const reforcos = primeiraQueFechou
    ? ordenadas.filter(
        (item) => item.dose >= item.dosesNaSerie && item.aplicadaEm > primeiraQueFechou.aplicadaEm,
      )
    : []

  const doses: DoseNoPlano[] = []

  if (!serieCompleta) {
    /* Série aberta: o que foi dado, a dose da vez, e as que vêm depois dela. */
    for (let numero = 1; numero <= ultima.dose; numero += 1) {
      const aplicacao = daSerie.get(numero)

      if (aplicacao) {
        doses.push(aplicada(aplicacao, numero, total, 'serie'))
      }
    }

    let previstaEm = ultima.proximaDoseEm

    for (let numero = ultima.dose + 1; numero <= total; numero += 1) {
      const eADaVez = numero === ultima.dose + 1

      doses.push({
        numero,
        total,
        tipo: 'serie',
        estado: eADaVez ? estadoDaProxima(previstaEm, hoje, null) : 'prevista',
        em: previstaEm,
        dias: diffDays(hoje, previstaEm),
        aplicacao: null,
        agendamento: eADaVez
          ? agendamentoValido(ultima.agendamentoDaProximaId, entrada.agendamentos)
          : null,
      })
      previstaEm = addDays(previstaEm, numero < total ? INTERVALO_ENTRE_DOSES_DA_SERIE : 0)
    }

    const ultimaPrevista = doses[doses.length - 1]!.em

    doses.push({
      numero: total,
      total,
      tipo: 'reforco',
      estado: 'prevista',
      em: addDays(ultimaPrevista, vacina.intervaloReforcoDias),
      dias: diffDays(hoje, addDays(ultimaPrevista, vacina.intervaloReforcoDias)),
      aplicacao: null,
      agendamento: null,
    })
  } else {
    /* Série fechada: a série como está no registro, os reforços, e o próximo reforço. */
    for (const [numero, aplicacao] of [...daSerie].sort((a, b) => a[0] - b[0])) {
      if (aplicacao === primeiraQueFechou || !reforcos.includes(aplicacao)) {
        doses.push(aplicada(aplicacao, numero, total, 'serie'))
      }
    }

    for (const reforco of reforcos) {
      doses.push(aplicada(reforco, total, total, 'reforco'))
    }

    doses.push({
      numero: total,
      total,
      tipo: 'reforco',
      estado: estadoDaProxima(ultima.proximaDoseEm, hoje, null),
      em: ultima.proximaDoseEm,
      dias: diffDays(hoje, ultima.proximaDoseEm),
      aplicacao: null,
      agendamento: agendamentoValido(ultima.agendamentoDaProximaId, entrada.agendamentos),
    })
  }

  const proxima = doses.find((dose) => dose.estado !== 'aplicada') ?? null

  return {
    vacina,
    tipoDeSerie: tipo,
    doses,
    proxima,
    situacao: situacaoDaVacina(proxima, true),
    aplicadasNaSerie: Math.min(total, ultima.dose),
    total,
    serieCompleta,
    reforcos,
  }
}

function aplicada(
  aplicacao: AplicacaoVacina,
  numero: number,
  total: number,
  tipo: DoseNoPlano['tipo'],
): DoseNoPlano {
  return {
    numero,
    total,
    tipo,
    estado: 'aplicada',
    em: aplicacao.aplicadaEm.slice(0, 10),
    dias: null,
    aplicacao,
    agendamento: null,
  }
}

/**
 * Essencial que ninguém começou.
 *
 * A série inteira aparece — é o que o responsável de um filhote novo precisa ver primeiro —, com
 * a primeira dose no dia em que ela passa a caber: hoje, para quem já tem idade; o aniversário da
 * idade mínima, para quem ainda não tem.
 */
function planoNaoIniciado(
  vacina: Vacina,
  nascimento: ISODate | null,
  cabeEm: ISODate | null,
  hoje: ISODate,
): VacinaNoPlano {
  const tipo = tipoDeSerie(nascimento, cabeEm && cabeEm > hoje ? cabeEm : hoje)
  const total = dosesDaSerie(vacina, tipo)
  const primeiraEm = cabeEm && cabeEm > hoje ? cabeEm : hoje
  const doses: DoseNoPlano[] = []
  let em = primeiraEm

  for (let numero = 1; numero <= total; numero += 1) {
    doses.push({
      numero,
      total,
      tipo: 'serie',
      estado: numero === 1 ? (cabeEm && cabeEm > hoje ? 'aguarda-idade' : 'pendente') : 'prevista',
      em,
      dias: diffDays(hoje, em),
      aplicacao: null,
      agendamento: null,
    })
    em = addDays(em, numero < total ? INTERVALO_ENTRE_DOSES_DA_SERIE : 0)
  }

  const reforcoEm = addDays(doses[doses.length - 1]!.em, vacina.intervaloReforcoDias)

  doses.push({
    numero: total,
    total,
    tipo: 'reforco',
    estado: 'prevista',
    em: reforcoEm,
    dias: diffDays(hoje, reforcoEm),
    aplicacao: null,
    agendamento: null,
  })

  const proxima = doses[0]!

  return {
    vacina,
    tipoDeSerie: tipo,
    doses,
    proxima,
    situacao: situacaoDaVacina(proxima, false),
    aplicadasNaSerie: 0,
    total,
    serieCompleta: false,
    reforcos: [],
  }
}

/** Ordem de leitura: o que pede ação primeiro, e dentro disso a ordem do catálogo. */
const ORDEM_DA_SITUACAO: Record<SituacaoNoPlano, number> = {
  atrasada: 0,
  devida: 1,
  'a-vencer': 2,
  'nao-iniciada': 3,
  'aguarda-idade': 4,
  'em-dia': 5,
}

export function montarPlanoVacinal(entrada: {
  pet: Pick<Pet, 'id' | 'especie' | 'nascimento'>
  vacinas: Vacina[]
  aplicacoes: AplicacaoVacina[]
  agendamentos: AgendamentoDaDose[]
  hoje: ISODate
}): PlanoVacinal {
  const { pet, hoje } = entrada
  const daEspecie = entrada.vacinas.filter((vacina) => vacina.especies.includes(pet.especie))
  const aplicacoes = entrada.aplicacoes.filter((item) => item.petId === pet.id)

  const vacinas: VacinaNoPlano[] = []
  const opcionaisNaoIniciadas: Vacina[] = []

  for (const vacina of daEspecie) {
    const plano = planoDaVacina({
      vacina,
      nascimento: pet.nascimento,
      aplicacoes,
      agendamentos: entrada.agendamentos,
      hoje,
    })

    if (plano) {
      vacinas.push(plano)
    } else {
      opcionaisNaoIniciadas.push(vacina)
    }
  }

  const ordemNoCatalogo = new Map(daEspecie.map((vacina, indice) => [vacina.id, indice]))

  vacinas.sort(
    (a, b) =>
      ORDEM_DA_SITUACAO[a.situacao] - ORDEM_DA_SITUACAO[b.situacao] ||
      ordemNoCatalogo.get(a.vacina.id)! - ordemNoCatalogo.get(b.vacina.id)!,
  )

  return {
    petId: pet.id,
    idadeEmDias: pet.nascimento ? diffDays(pet.nascimento, hoje) : null,
    faixa: tipoDeSerie(pet.nascimento, hoje),
    vacinas,
    opcionaisNaoIniciadas,
    atrasadas: vacinas.filter((item) => item.situacao === 'atrasada').length,
    devidas: vacinas.filter((item) => item.situacao === 'devida').length,
  }
}
