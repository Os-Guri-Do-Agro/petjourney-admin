/**
 * A geração assistida: uma **proposta** de rotina para um hóspede, a ser revista antes de aprovar.
 *
 * ## Não há modelo e não há rede, e isto precisa estar escrito
 *
 * O módulo hotel roda inteiro sobre a camada mocada. O que existe aqui é uma função determinista,
 * pura, que lê os dados que a casa já tem e devolve uma proposta **no formato exato** que a chamada
 * real devolveria. A inteligência é encenada; o fluxo — propor, ler o porquê, discordar, alterar,
 * aprovar — é real, e é ele que se está construindo.
 *
 * A costura para a chamada de verdade está em `data/repositories/rotina-repository.ts`, em
 * `propor()`. Quando ela existir, o corpo vira uma requisição, a resposta passa pelo **mesmo**
 * `validarProposta`, e nem a store nem o diálogo nem a página mudam.
 *
 * ## A regra que separa sugestão de palpite
 *
 * **Toda sugestão cita um registro datado da casa** — uma linha da inspeção de entrada, uma recusa
 * anotada, uma ocorrência, a duração da estadia, a adaptação observada. Palpite de tabela fica
 * fora: nada de "42 kg, logo cinco trocas de água". Num módulo cujo argumento central é que o hotel
 * **não prescreve**, sugerir frequência por peso corporal é prescrever em outra fatia — e a coluna
 * do porquê daria cara de evidência a um número que alguém escreveu num `if`.
 *
 * ## A parede
 *
 * Medicação nunca é composta aqui. Se a estadia tem medicação registrada, ela sai `transcrita`,
 * com horários copiados verbatim da receita, só para aparecer na revisão como contexto. Se não tem,
 * não sai nada e entra uma **recusa escrita** — a ausência calada faria quem aprova supor que a
 * máquina olhou e não achou nada.
 */

import type {
  Adaptacao,
  ClockTime,
  ISODateTime,
  ItemDeRotina,
  MedicacaoDaEstadia,
  PetSpecies,
  TarefaDaCasaKind,
  TarefaKind,
} from '../data/types'

/** De onde uma sugestão tirou a razão dela. Catálogo fechado: a tela traduz, o domínio não redige. */
export type FonteDaSugestao =
  | 'inspecao-de-entrada'
  | 'adaptacao'
  | 'estadia-longa'
  | 'medicacao-registrada'
  | 'plano-alimentar'
  | 'rotina-da-casa'

/** O que a máquina se recusa a propor, e por quê. Aparece sempre, mesmo sem nada atrás. */
export type RecusaKind = 'medicacao-nao-se-propoe' | 'refeicao-combina-com-responsavel'

export type EstadoDaSugestao =
  /** Veio do cadastro da casa. Contexto, não decisão. */
  | 'herdada'
  /** Copiada da ficha, verbatim. Nunca composta. */
  | 'transcrita'
  /** A máquina está propondo mudar. É a única que se aprova. */
  | 'sugerida'

export type SugestaoDeRotina = {
  id: string
  kind: TarefaKind
  horarios: ClockTime[]
  estado: EstadoDaSugestao
  /** O porquê: chave de catálogo mais o dado citado. Nunca frase pronta pela máquina. */
  porque: { fonte: FonteDaSugestao; valor: string }[]
}

export type PropostaDeRotina = {
  hospedagemId: string
  geradaEm: ISODateTime
  /** `simulacao-local` hoje; o nome do modelo depois. A tela mostra qual falou. */
  motor: string
  sugestoes: SugestaoDeRotina[]
  recusas: RecusaKind[]
  /** Quantos itens o validador descartou. Viaja para a tela: a casa fica sabendo que houve. */
  descartadas: number
}

/**
 * O que a proposta lê.
 *
 * Deliberadamente estreita — é o corpo da requisição futura, e é também a fronteira de privacidade.
 * Não leva tutor, telefone de emergência, nem quem retirou o animal.
 */
export type EntradaDaProposta = {
  hospedagemId: string
  especie: PetSpecies | null
  adaptacao: Adaptacao
  inspecaoDeEntrada: string
  /** Quantas noites a estadia inteira tem. */
  noites: number
  passeioAutorizado: boolean
  medicacoes: MedicacaoDaEstadia[]
  horariosDeRefeicao: ClockTime[]
  /** O cadastro da casa, para herdar o que já existe em vez de propor de novo. */
  rotinaDaCasa: ItemDeRotina[]
}

/** Estadia a partir de quantas noites vale pesar no meio do caminho. */
const ESTADIA_LONGA = 5

/**
 * Palavras da inspeção de entrada que pedem um olhar a mais na acomodação.
 *
 * Sujeira é a metade óbvia. A outra é **parasita**: um carrapato encontrado na chegada não é um
 * achado isolado — é um que veio junto com o animal e pode estar na caminha, na coleira e na baia.
 * Olhar a acomodação mais uma vez no dia é a resposta proporcional, e é uma sugestão que uma
 * pessoa razoável pode muito bem recusar, o que é exatamente o ponto de ela ser revisável.
 */
const PEDE_HIGIENE = [
  'sujo',
  'suja',
  'barro',
  'lama',
  'mau cheiro',
  'fezes',
  'carrapato',
  'pulga',
  'parasita',
]

function nova(
  kind: TarefaKind,
  horarios: ClockTime[],
  estado: EstadoDaSugestao,
  porque: { fonte: FonteDaSugestao; valor: string }[],
): SugestaoDeRotina {
  return { id: `sug-${kind}-${estado}`, kind, horarios, estado, porque }
}

/**
 * Monta a proposta.
 *
 * A ordem da saída é a da leitura: primeiro o que a casa já faz, depois o que veio da ficha, e por
 * último o que está sendo proposto. A tela conta com isso.
 *
 * **Algumas sugestões são deliberadamente discutíveis**, e isso é uma decisão de produto, não um
 * descuido. Uma máquina que só propõe o óbvio transforma o passo de revisar num gesto decorativo —
 * e revisar antes de aprovar é justamente o que esta funcionalidade existe para demonstrar. Cada
 * uma continua citando um registro datado; o que varia é se uma pessoa razoável concordaria.
 */
export function proporRotina(entrada: EntradaDaProposta, agora: ISODateTime): PropostaDeRotina {
  const sugestoes: SugestaoDeRotina[] = []
  const recusas: RecusaKind[] = []

  /* ---------------------------------------------------------------- o que a casa já faz */
  for (const item of entrada.rotinaDaCasa) {
    if (!item.ativo || item.horarios.length === 0) continue

    if (item.exigeAutorizacao === 'passeio-externo' && !entrada.passeioAutorizado) continue

    sugestoes.push(
      nova(item.kind, item.horarios, 'herdada', [{ fonte: 'rotina-da-casa', valor: '' }]),
    )
  }

  /* ---------------------------------------------------------------- o que veio da ficha */
  if (entrada.horariosDeRefeicao.length > 0) {
    sugestoes.push(
      nova('refeicao', entrada.horariosDeRefeicao, 'transcrita', [
        { fonte: 'plano-alimentar', valor: '' },
      ]),
    )
  }

  /*
   * Medicação: **transcrita, nunca composta**. Os horários saem da receita registrada, e existem
   * aqui só para que quem revisa veja o dia inteiro. Nenhum deles é editável na revisão.
   */
  const ativas = entrada.medicacoes.filter((item) => !item.suspensaEm)

  for (const medicacao of ativas) {
    sugestoes.push(
      nova('medicacao', medicacao.horarios, 'transcrita', [
        { fonte: 'medicacao-registrada', valor: `${medicacao.descricao} · ${medicacao.doseTexto}` },
      ]),
    )
  }

  recusas.push('medicacao-nao-se-propoe')
  recusas.push('refeicao-combina-com-responsavel')

  /* ---------------------------------------------------------------- o que se propõe mudar */

  const agua = entrada.rotinaDaCasa.find((item) => item.kind === 'agua' && item.ativo)

  /*
   * Água extra para quem está estressado. Discutível de propósito: a adaptação é uma leitura de
   * quem recebeu o animal, e mais uma troca de água não é evidentemente a resposta certa para ela.
   */
  if (entrada.adaptacao === 'estressado' && agua && agua.horarios.length > 0) {
    const comExtra = [...new Set([...agua.horarios, '15:00' as ClockTime])].sort((um, outro) =>
      um.localeCompare(outro),
    )

    sugestoes.push(
      nova('agua', comExtra, 'sugerida', [{ fonte: 'adaptacao', valor: entrada.adaptacao }]),
    )
  }

  /*
   * Passeio a mais para quem ainda está se adaptando.
   *
   * A mais discutível de todas, e de propósito: para um cão ansioso, mais uma saída pode ser o que
   * o acalma **ou** mais um manejo que o estressa. Não há resposta certa no dado — há uma pessoa
   * que conhece o animal e decide. É o caso que melhor explica por que esta tela existe.
   *
   * Só sai para quem tem autorização: sem ela a casa não decide passeio por ninguém.
   */
  const passeio = entrada.rotinaDaCasa.find((item) => item.kind === 'passeio' && item.ativo)
  const seAdaptando = entrada.adaptacao === 'em-adaptacao' || entrada.adaptacao === 'estressado'

  if (seAdaptando && entrada.passeioAutorizado && passeio && passeio.horarios.length > 0) {
    const comExtra = [...new Set([...passeio.horarios, '18:30' as ClockTime])].sort((um, outro) =>
      um.localeCompare(outro),
    )

    sugestoes.push(
      nova('passeio', comExtra, 'sugerida', [{ fonte: 'adaptacao', valor: entrada.adaptacao }]),
    )
  }

  /* Higiene extra quando a inspeção de entrada achou sujeira ou parasita. Cita a frase inteira. */
  const inspecao = entrada.inspecaoDeEntrada.toLowerCase()
  const achado = PEDE_HIGIENE.find((palavra) => inspecao.includes(palavra))
  const higiene = entrada.rotinaDaCasa.find((item) => item.kind === 'higiene' && item.ativo)

  if (achado && higiene) {
    const comExtra = [...new Set(['08:00' as ClockTime, ...higiene.horarios])].sort((um, outro) =>
      um.localeCompare(outro),
    )

    sugestoes.push(
      nova('higiene', comExtra, 'sugerida', [
        { fonte: 'inspecao-de-entrada', valor: entrada.inspecaoDeEntrada },
      ]),
    )
  }

  /*
   * Pesagem no meio da estadia longa. A mais discutível das três, e a que melhor demonstra por que
   * a revisão existe: pesar duas vezes é útil para saber **quando** o animal emagreceu, e é também
   * mais um manejo num animal que pode não gostar de balança. A casa decide.
   */
  if (entrada.noites >= ESTADIA_LONGA) {
    sugestoes.push(
      nova('pesagem', ['07:30' as ClockTime], 'sugerida', [
        { fonte: 'estadia-longa', valor: String(entrada.noites) },
      ]),
    )
  }

  return {
    hospedagemId: entrada.hospedagemId,
    geradaEm: agora,
    motor: 'simulacao-local',
    sugestoes,
    recusas,
    descartadas: 0,
  }
}

/** Os tipos que uma sugestão aprovável pode ter. É o mesmo recorte de `TarefaDaCasaKind`. */
const APROVAVEIS: TarefaDaCasaKind[] = ['agua', 'higiene', 'passeio', 'pesagem']

/**
 * A terceira camada da parede: o validador da volta.
 *
 * Roda sobre a saída de **qualquer** motor, inclusive o nosso — a validação não confia na simulação
 * por ela ser da casa. É a única camada que continua valendo no dia em que a resposta vier de um
 * modelo de verdade, e é por isso que ela existe agora, antes de haver modelo.
 *
 * Descarta em silêncio, e conta: um motor que tentar inventar um fármaco produz **nada**, e o
 * número de descartes viaja até a tela para a casa saber que ele tentou.
 */
export function validarProposta(
  proposta: PropostaDeRotina,
  entrada: EntradaDaProposta,
): PropostaDeRotina {
  const horariosLegitimos = new Set(
    entrada.medicacoes.flatMap((medicacao) => medicacao.horarios.map((hora) => hora as string)),
  )

  let descartadas = 0

  const sugestoes = proposta.sugestoes.filter((sugestao) => {
    const horariosValidos = sugestao.horarios.every((hora) =>
      /^([01]\d|2[0-3]):[0-5]\d$/.test(hora),
    )

    if (!horariosValidos) {
      descartadas += 1

      return false
    }

    /* Medicação só passa transcrita, e só com horários que já constam da receita registrada. */
    if (sugestao.kind === 'medicacao') {
      const legitima =
        sugestao.estado === 'transcrita' &&
        sugestao.horarios.every((hora) => horariosLegitimos.has(hora))

      if (!legitima) descartadas += 1

      return legitima
    }

    /* O que se propõe mudar só pode ser de um tipo que a casa cadastra. */
    if (sugestao.estado === 'sugerida' && !APROVAVEIS.includes(sugestao.kind as TarefaDaCasaKind)) {
      descartadas += 1

      return false
    }

    return true
  })

  return { ...proposta, sugestoes, descartadas: proposta.descartadas + descartadas }
}

/** As que a pessoa pode aprovar. As outras são contexto. */
export function aprovaveis(proposta: PropostaDeRotina): SugestaoDeRotina[] {
  return proposta.sugestoes.filter((sugestao) => sugestao.estado === 'sugerida')
}
