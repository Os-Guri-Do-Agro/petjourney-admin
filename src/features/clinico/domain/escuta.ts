/**
 * Escuta da consulta: o que foi dito vira proposta de anamnese — e cada proposta sabe de onde
 * veio.
 *
 * ## O que este motor é, e o que não é
 *
 * É um **motor local de regras**, sem modelo de linguagem e sem rede: expressões do português
 * falado no consultório ("tá vomitando desde ontem", "recusou a ração", "o xixi tá normal")
 * ligadas aos campos da anamnese. Entende pouco, e a tela diz isso. O que ele faz bem — e que um
 * modelo de verdade teria de fazer igual — é a outra metade do trabalho:
 *
 * - **Toda proposta carrega a citação**: o trecho, e onde nele começa e termina o que foi dito.
 *   É o que deixa o veterinário confiar no que vê — ele não precisa acreditar no campo, pode
 *   conferir a frase.
 * - **Dedução se diz dedução.** "A vacina da raiva ela tomou em março" não é "vacinação em
 *   dia"; o motor pode propor, mas a proposta chega marcada como deduzida. É assim que se vê o
 *   que a máquina inventou.
 * - **Trecho atrapalhado contamina o que sai dele.** Latido, duas vozes, confiança baixa: a
 *   proposta chega marcada, com a interferência nomeada.
 * - **Duas versões não viram uma em silêncio.** Quando a conversa diz duas coisas para o mesmo
 *   campo, a proposta escolhe uma e mostra a outra.
 *
 * Trocar este motor por um modelo é trocar `extrairDaConversa`. A verificação
 * (`alertasDaProposta`, `ancorarCitacao`) continua valendo, porque é ela que pega a citação que
 * não existe na conversa — o jeito mais comum de um modelo inventar.
 *
 * ## O que ele se recusa a preencher
 *
 * Diagnóstico e conduta. Uma hipótese dita em voz alta ("pode ser uma gastroenterite") é ouvida
 * e **não** vira campo: aparece como nota, para lembrar que ela existe e que a decisão é do
 * veterinário, na etapa dele. O mesmo vale para o peso que o responsável diz de cabeça, que o
 * prontuário já trata como informação de casa e nunca como vital aferido.
 *
 * ## Quem falou
 *
 * Na demonstração cada trecho tem autor. Fala do veterinário não produz fato — "e ela tá
 * comendo?" é pergunta, não relato. Ao vivo, o reconhecimento do navegador não separa vozes; aí
 * o motor descarta o que tem cara de pergunta e segue, e a tela avisa que a autoria é incerta.
 */

import type { Anamnese, AntecedenteKind, TrechoDaConversa } from '../data/types'

// ------------------------------------------------------------------ tipos

/** Os campos da anamnese que a escuta preenche, na ordem do formulário — que é a da revisão. */
export const CAMPOS_DA_ESCUTA = [
  'queixaPrincipal',
  'duracaoSintomas',
  'evolucao',
  'historia',
  'apetite',
  'evacuacao',
  'miccao',
  'ambiente',
  'vacinacaoEmDia',
  'vermifugacaoEmDia',
  'antecedente',
] as const

export type CampoDaEscuta = (typeof CAMPOS_DA_ESCUTA)[number]

/** Como o valor é editado na revisão. */
export type FormaDoCampo = 'texto' | 'texto-longo' | 'opcao' | 'sim-nao' | 'antecedente'

export const FORMA_DO_CAMPO: Record<CampoDaEscuta, FormaDoCampo> = {
  queixaPrincipal: 'texto',
  duracaoSintomas: 'texto',
  evolucao: 'opcao',
  historia: 'texto-longo',
  apetite: 'opcao',
  evacuacao: 'opcao',
  miccao: 'opcao',
  ambiente: 'opcao',
  vacinacaoEmDia: 'sim-nao',
  vermifugacaoEmDia: 'sim-nao',
  antecedente: 'antecedente',
}

/**
 * As opções dos campos de escolha, exatamente as da anamnese.
 *
 * A correção da revisão só oferece o que o campo aceita: um valor fora da lista entraria no
 * prontuário como texto que nenhuma tela sabe traduzir.
 */
export const OPCOES_DA_ESCUTA = {
  evolucao: ['piorando', 'estavel', 'melhorando', 'intermitente'],
  apetite: ['normal', 'aumentado', 'reduzido', 'ausente'],
  evacuacao: ['normal', 'diarreia', 'constipacao'],
  miccao: ['normal', 'aumentada', 'reduzida', 'disuria'],
  ambiente: ['domiciliar', 'externo', 'misto'],
} as const satisfies {
  evolucao: readonly Exclude<Anamnese['evolucao'], ''>[]
  apetite: readonly Exclude<Anamnese['apetite'], ''>[]
  evacuacao: readonly Exclude<Anamnese['evacuacao'], ''>[]
  miccao: readonly Exclude<Anamnese['miccao'], ''>[]
  ambiente: readonly Exclude<Anamnese['ambiente'], ''>[]
}

export type CampoDeOpcao = keyof typeof OPCOES_DA_ESCUTA

/** Onde, na conversa, a proposta se apoia. `inicio` e `fim` são posições no texto do trecho. */
export type CitacaoDaEscuta = { trechoId: string; inicio: number; fim: number }

/**
 * `dito`: o valor está na frase. `deduzido`: a máquina concluiu a partir dela — e é isso que a
 * revisão precisa mostrar como o que a máquina pôs de si.
 */
export type ModoDaProposta = 'dito' | 'deduzido'

export type ValorDaEscuta = string | boolean

export type PropostaDaEscuta = {
  /** Estável de uma extração para a próxima: o campo, e no antecedente, o tipo e o que é. */
  id: string
  campo: CampoDaEscuta
  /** Na forma que o campo guarda: texto, opção ou sim/não. No antecedente, a descrição. */
  valor: ValorDaEscuta
  /** Só no antecedente. */
  tipo: AntecedenteKind | null
  /** Só no antecedente: "ano passado", "filhote". Vazio quando a conversa não disse. */
  quando: string
  modo: ModoDaProposta
  citacoes: CitacaoDaEscuta[]
  /** O que mais a conversa disse para o mesmo campo, e não entrou. */
  divergencias: { valor: ValorDaEscuta; citacao: CitacaoDaEscuta }[]
}

/**
 * O que foi ouvido e **de propósito** não vira campo.
 *
 * - `hipotese`: diagnóstico dito em voz alta. É do veterinário, na etapa de diagnóstico.
 * - `peso-informado`: o peso que o responsável diz de cabeça. Orienta, não é vital.
 * - `medida`: número de exame dito em voz alta. Entra pelo exame físico, aferido.
 */
export type NotaDaEscutaKind = 'hipotese' | 'peso-informado' | 'medida'

export type NotaDaEscuta = {
  id: string
  kind: NotaDaEscutaKind
  valor: string
  citacao: CitacaoDaEscuta
}

export type ResultadoDaEscuta = {
  propostas: PropostaDaEscuta[]
  notas: NotaDaEscuta[]
}

/**
 * Por que uma proposta pede um segundo olhar. A ordem é a de gravidade: a citação que não existe
 * vem antes de tudo, porque ela significa que ninguém disse aquilo.
 *
 * O tipo sai da lista, e não o contrário: uma interferência nova em `InterferenciaDaEscuta` que
 * não entrar aqui vira erro de compilação em `alertasDaProposta`, em vez de um alerta que some.
 */
export const ALERTAS_DA_PROPOSTA = [
  'sem-origem',
  'fala-sobreposta',
  'latido',
  'ruido',
  'baixa-confianca',
  'divergencia',
  'deduzido',
] as const

export type AlertaDaProposta = (typeof ALERTAS_DA_PROPOSTA)[number]

/**
 * Abaixo disto o reconhecimento está chutando.
 *
 * O Chrome devolve confiança entre 0,7 e 0,95 para fala limpa em português; abaixo de 0,7 o
 * trecho costuma ter palavra trocada — é o "dez" no lugar de "dois" que o latido cobriu.
 */
export const LIMIAR_DE_CONFIANCA = 0.7

// ------------------------------------------------------------------ texto

/**
 * Minúsculas e sem acento, **caractere a caractere**.
 *
 * O comprimento não muda, e é isso que importa: a expressão casa no texto normalizado e a
 * citação sai do original pelas mesmas posições — "tá vomitando" continua com acento na tela.
 */
export function normalizar(texto: string): string {
  let saida = ''

  for (let indice = 0; indice < texto.length; indice += 1) {
    const caractere = texto.charAt(indice)
    const simples = caractere.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

    saida += simples.length === 1 ? simples : caractere
  }

  return saida
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

const NUMEROS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  quatorze: 14,
  catorze: 14,
  quinze: 15,
  vinte: 20,
  trinta: 30,
}

/** Número por extenso ou em algarismo — o reconhecimento entrega os dois, conforme a frase. */
const NUMERO = `(\\d+(?:[.,]\\d+)?|${Object.keys(NUMEROS).join('|')})`

function lerNumero(palavra: string): number | null {
  if (/^\d+(?:[.,]\d+)?$/.test(palavra)) {
    return Number(palavra.replace(',', '.'))
  }

  return NUMEROS[palavra] ?? null
}

function numeroEmTexto(numero: number): string {
  return String(numero).replace('.', ',')
}

const UNIDADES: Record<string, [singular: string, plural: string]> = {
  hora: ['hora', 'horas'],
  dia: ['dia', 'dias'],
  semana: ['semana', 'semanas'],
  mes: ['mês', 'meses'],
  ano: ['ano', 'anos'],
}

function unidade(palavra: string): [string, string] | null {
  const raiz = palavra === 'meses' ? 'mes' : palavra.replace(/s$/, '')

  return UNIDADES[raiz] ?? null
}

/** Palavras que o reconhecimento cola no fim de um nome e que não fazem parte dele. */
const PALAVRAS_DE_ARRASTO = new Set([
  'ne',
  'e',
  'mas',
  'tambem',
  'que',
  'sim',
  'ai',
  'entao',
  'so',
  'isso',
  'dai',
  'ta',
  'viu',
  'doutor',
  'doutora',
  'ja',
  'nao',
  'faz',
  'desde',
  'ha',
])

// ------------------------------------------------------------------ regras

type Leitura = {
  valor: ValorDaEscuta
  modo: ModoDaProposta
  tipo?: AntecedenteKind
  quando?: string
  /** Quando a citação é só um pedaço do que casou — o nome da alergia, não a frase inteira. */
  inicio?: number
  fim?: number
}

type Regra = {
  campo: CampoDaEscuta
  padrao: RegExp
  /** `null` descarta o que casou: a frase parecia, mas não era. */
  ler: (casamento: RegExpExecArray, original: string) => Leitura | null
  /** Descarta quando vem logo depois de "não" — "não é castrada" não é castração. */
  recusaNegacao?: boolean
}

function fixo(valor: ValorDaEscuta, modo: ModoDaProposta = 'dito') {
  return () => ({ valor, modo })
}

/**
 * O pedaço do texto original que o grupo casou, com acento.
 *
 * Todo grupo que as regras leem é o **último** pedaço do casamento — o nome da alergia, o dia do
 * "desde", o termo da hipótese —, então a última ocorrência do texto dele dentro do casamento é
 * a posição dele. O normalizado tem o mesmo comprimento do original, e a posição vale nos dois.
 */
function grupo(casamento: RegExpExecArray, original: string, indice: number) {
  const texto = casamento[indice]

  if (!texto) {
    return null
  }

  const inicio = casamento.index + casamento[0].lastIndexOf(texto)
  const fim = inicio + texto.length

  return { texto: original.slice(inicio, fim), inicio, fim }
}

/** Tira do fim as palavras de arrasto: "dipirona né" vira "dipirona". */
function aparar(texto: string): { texto: string; tamanho: number } {
  const palavras = texto.split(/\s+/).filter(Boolean)

  while (
    palavras.length > 1 &&
    PALAVRAS_DE_ARRASTO.has(normalizar(palavras[palavras.length - 1] ?? ''))
  ) {
    palavras.pop()
  }

  const aparado = palavras.join(' ')

  return { texto: aparado, tamanho: aparado.length }
}

const SINTOMAS: [rotulo: string, padrao: RegExp][] = [
  [
    'Vômito',
    /\b(?:vomit\w*|vomiu|vomitos?|golfand\w*|regurgit\w*|botando (?:tudo )?(?:pra|para) fora)\b/g,
  ],
  ['Diarreia', /\b(?:diarreia|caganeira)\b/g],
  [
    'Apatia',
    /\b(?:apatic[oa]|quiet(?:o|a|inho|inha)|prostrad[oa]|desanimad[oa]|abatid[oa]|sem energia|caidinh[oa]|tristinh[oa]|so deitad[oa]|so dormindo|(?:ta|esta|anda) (?:mole|molinh[oa]))\b/g,
  ],
  ['Tosse', /\b(?:tosse|tossindo|tossiu|tossir)\b/g],
  ['Espirros', /\bespirr\w+\b/g],
  [
    'Prurido',
    /\b(?:coceira|se cocando|cocando|se coca|coca (?:muito|demais)|prurido|lambendo (?:muito|a pata|as patas))\b/g,
  ],
  ['Claudicação', /\b(?:mancando|manca|mancou|claudic\w+|nao apoia a pata|puxando a perna)\b/g],
  ['Dor', /\b(?:sentindo dor|com dor|dolorid[oa]|gemendo|chorando de dor|grita quando)\b/g],
  ['Convulsão', /\b(?:convuls\w+|teve um ataque)\b/g],
  ['Tremores', /\b(?:tremendo|tremedeira|tremores)\b/g],
  ['Ferida', /\b(?:ferida|machucad[oa]|machucou)\b/g],
  ['Secreção ocular', /\b(?:remela|olho (?:vermelho|inchado|lacrimejando)|lacrimejando)\b/g],
  ['Balança a cabeça', /\b(?:balancando a cabeca|sacudindo a cabeca|cocando a orelha)\b/g],
  ['Sede aumentada', /\b(?:bebendo (?:muita|mais) agua|bebe muita agua|muita sede)\b/g],
  ['Perda de peso', /\b(?:emagreceu|emagrecendo|perdeu peso|perdendo peso)\b/g],
  ['Sangramento', /\b(?:sangrando|sangramento)\b/g],
]

const DIA_OU_REFERENCIA =
  '(ontem|anteontem|domingo|segunda|terca|quarta|quinta|sexta|sabado|semana passada|fim de semana|final de semana)'

const REGRAS: Regra[] = [
  // -------------------------------------------------------------- queixa principal
  ...SINTOMAS.map(
    ([rotulo, padrao]): Regra => ({
      campo: 'queixaPrincipal',
      padrao,
      ler: fixo(rotulo),
      recusaNegacao: true,
    }),
  ),

  // -------------------------------------------------------------- há quanto tempo
  {
    campo: 'duracaoSintomas',
    padrao: new RegExp(
      `\\b(?:faz|fazem|ha|tem|desde)\\s+(?:uns |umas |quase |mais de |mais ou menos )?${NUMERO}\\s+(horas?|dias?|semanas?|mes|meses|anos?)\\b`,
      'g',
    ),
    ler: (casamento) => {
      const numero = lerNumero(casamento[1] ?? '')
      const nomes = unidade(casamento[2] ?? '')

      if (numero === null || !nomes) {
        return null
      }

      return {
        valor: `${numeroEmTexto(numero)} ${numero === 1 ? nomes[0] : nomes[1]}`,
        modo: 'dito',
      }
    },
  },
  {
    campo: 'duracaoSintomas',
    padrao: new RegExp(`\\b${NUMERO}\\s+(dias|semanas|meses)\\s+(?:que|ja)\\b`, 'g'),
    ler: (casamento) => {
      const numero = lerNumero(casamento[1] ?? '')
      const nomes = unidade(casamento[2] ?? '')

      return numero === null || !nomes
        ? null
        : { valor: `${numeroEmTexto(numero)} ${numero === 1 ? nomes[0] : nomes[1]}`, modo: 'dito' }
    },
  },
  {
    campo: 'duracaoSintomas',
    padrao: new RegExp(
      `\\b(?:desde|comecou)\\s+(?:no |na |o |a )?${DIA_OU_REFERENCIA}(?:-feira)?\\b`,
      'g',
    ),
    ler: (casamento, original) => {
      const referencia = grupo(casamento, original, 1)

      if (!referencia) {
        return null
      }

      const chave = normalizar(referencia.texto)

      if (chave === 'semana passada') {
        return { valor: 'Desde a semana passada', modo: 'dito' }
      }

      if (chave.endsWith('de semana')) {
        return { valor: 'Desde o fim de semana', modo: 'dito' }
      }

      return { valor: `Desde ${referencia.texto.toLowerCase()}`, modo: 'dito' }
    },
  },

  // -------------------------------------------------------------- evolução
  {
    campo: 'evolucao',
    padrao: /\b(?:piorando|piorou|(?:esta|ta|ficou|fica|foi) pior|cada vez pior|so piora\w*)\b/g,
    ler: fixo('piorando'),
  },
  {
    campo: 'evolucao',
    padrao: /\b(?:melhorando|melhorou|(?:esta|ta|ficou) melhor)\b/g,
    ler: fixo('melhorando'),
  },
  {
    campo: 'evolucao',
    padrao:
      /\b(?:do mesmo jeito|(?:esta|ta) igual|nao mudou|nao (?:melhorou|piorou)|mesma coisa|estavel)\b/g,
    ler: fixo('estavel'),
  },
  {
    campo: 'evolucao',
    padrao:
      /\b(?:vai e volta|as vezes|de vez em quando|volta e meia|para e volta|dia sim dia nao)\b/g,
    ler: fixo('intermitente'),
  },

  // -------------------------------------------------------------- apetite
  {
    campo: 'apetite',
    padrao:
      /\b(?:nao (?:esta |ta )?(?:comendo|come|comeu|quer comer|quis comer)(?: nada)?|parou de comer|recus\w+ (?:a |o )?(?:racao|comida|petisco|pote)|nem (?:tocou|encostou|chegou perto) (?:na|no) (?:racao|comida|pote)|sem comer|comeu nada)\b/g,
    ler: fixo('ausente'),
  },
  {
    campo: 'apetite',
    padrao:
      /\b(?:(?:esta |ta )?comendo (?:menos|pouco|pouquinho|mal)|come (?:menos|pouco|pouquinho|mal)|comeu (?:pouco|pouquinho|menos)|so belisc\w+|beliscando|pouco apetite|menos apetite|nao (?:esta |ta )?comendo (?:bem|direito|normal))\b/g,
    ler: fixo('reduzido'),
  },
  {
    campo: 'apetite',
    padrao:
      /\b(?:comendo (?:demais|muito mais|mais que o normal)|come (?:demais|muito mais)|faminto|faminta|com muita fome|fome o tempo todo)\b/g,
    ler: fixo('aumentado'),
  },
  {
    campo: 'apetite',
    padrao:
      /\b(?:(?:esta |ta )?comendo (?:normal|bem|direitinho|normalmente)|come (?:normal|bem|direitinho)|comeu (?:normal|bem|direitinho|tudo)|apetite (?:normal|bom))\b/g,
    ler: fixo('normal'),
  },

  // -------------------------------------------------------------- evacuação
  {
    campo: 'evacuacao',
    padrao:
      /\b(?:diarreia|caganeira|intestino solto|coco (?:ta |esta |tava |estava )?(?:mole|molinho|pastoso|liquido|com sangue)|fezes (?:moles|pastosas|liquidas|com sangue)|fez (?:coco )?mole)\b/g,
    ler: fixo('diarreia'),
  },
  {
    campo: 'evacuacao',
    padrao:
      /\b(?:nao (?:fez|faz|esta fazendo|ta fazendo) coco|sem fazer coco|intestino preso|constipad\w+|forca (?:pra|para) fazer coco)\b/g,
    ler: fixo('constipacao'),
  },
  {
    campo: 'evacuacao',
    padrao:
      /\b(?:coco (?:ta |esta |tava |estava )?normal|fezes normais|intestino normal|(?:faz|fez|fazendo) coco normal)\b/g,
    ler: fixo('normal'),
  },

  // -------------------------------------------------------------- micção
  {
    campo: 'miccao',
    padrao:
      /\b(?:dor (?:pra|para|ao|na hora de) fazer xixi|chora (?:pra|para|ao) fazer xixi|xixi com sangue|sangue no xixi|urina com sangue|forca (?:pra|para) fazer xixi|xixi (?:em )?gotinhas?|pingando xixi)\b/g,
    ler: fixo('disuria'),
  },
  {
    campo: 'miccao',
    padrao:
      /\b(?:fazendo (?:muito|mais) xixi|xixi (?:demais|toda hora|o tempo todo|muitas vezes)|urinando (?:muito|demais|mais))\b/g,
    ler: fixo('aumentada'),
  },
  {
    campo: 'miccao',
    padrao:
      /\b(?:fazendo (?:pouco|menos) xixi|quase nao (?:faz|fez) xixi|urinando pouco|pouco xixi|nao (?:fez|faz) xixi)\b/g,
    ler: fixo('reduzida'),
  },
  {
    campo: 'miccao',
    padrao:
      /\b(?:xixi (?:ta |esta |tava )?(?:normal|ok|tranquilo)|urina (?:ta |esta )?normal|urinando normal|(?:faz|fez|fazendo) xixi normal)\b/g,
    ler: fixo('normal'),
  },

  // -------------------------------------------------------------- ambiente
  {
    campo: 'ambiente',
    padrao:
      /\b(?:apartamento|so (?:fica )?dentro de casa|nao sai de casa|fica (?:so )?dentro de casa|vive dentro de casa)\b/g,
    ler: fixo('domiciliar'),
  },
  {
    campo: 'ambiente',
    padrao:
      /\b(?:quintal|sitio|chacara|fazenda|fica solt[oa]|vive solt[oa]|anda solt[oa]|fica na rua)\b/g,
    ler: fixo('externo'),
  },
  {
    campo: 'ambiente',
    padrao: /\b(?:dentro e fora|sai (?:pra|para) (?:rua|passear) sozinh[oa])\b/g,
    ler: fixo('misto'),
  },

  // -------------------------------------------------------------- vacinação
  {
    campo: 'vacinacaoEmDia',
    padrao:
      /\b(?:vacinas? (?:ta |esta |estao |tao )?(?:em dia|atualizadas?)|vacinacao (?:ta |esta )?em dia|carteirinha (?:ta |esta )?em dia|tomou todas as vacinas|(?:ta |esta )?vacinad[oa])\b/g,
    ler: fixo(true),
  },
  {
    campo: 'vacinacaoEmDia',
    padrao:
      /\b(?:vacinas? (?:ta |esta |estao |tao )?(?:atrasadas?|vencidas?)|nao (?:ta |esta |e )?vacinad[oa]|nunca (?:tomou|foi) vacin\w*|nao tomou (?:a |as |nenhuma )?vacinas?|faltou (?:a |as )?vacinas?)\b/g,
    ler: fixo(false),
  },
  /*
   * A dedução que a revisão existe para pegar: uma vacina tomada não quer dizer carteira em dia.
   * Proposta, sim — é o que o responsável quis dizer na maioria das vezes —, mas marcada.
   */
  {
    campo: 'vacinacaoEmDia',
    padrao:
      /\b(?:vacina (?:da|de|contra) \w+ (?:ele |ela )?(?:tomou|ja tomou|foi)|tomou (?:a )?(?:vacina )?(?:da|de|contra) (?:raiva|v\d+|polivalente|gripe|giardia|leishmaniose))\b/g,
    ler: fixo(true, 'deduzido'),
    recusaNegacao: true,
  },

  // -------------------------------------------------------------- vermifugação
  {
    campo: 'vermifugacaoEmDia',
    padrao: /\b(?:vermifug\w* (?:ta |esta )?em dia|vermifugad[oa])\b/g,
    ler: fixo(true),
    recusaNegacao: true,
  },
  {
    campo: 'vermifugacaoEmDia',
    padrao: /\b(?:dei|deu|demos|tomou) (?:o )?vermifugo\b/g,
    ler: fixo(true, 'deduzido'),
    recusaNegacao: true,
  },
  {
    campo: 'vermifugacaoEmDia',
    padrao:
      /\b(?:vermifug\w* (?:ta |esta )?atrasad[oa]|nao (?:dei|deu|tomou|toma) (?:o )?vermifugo|faz (?:tempo|muito tempo|anos) (?:que nao|sem) (?:dou |da |dar |toma |tomar )?(?:o )?vermifugo|nunca (?:tomou|dei|deu) vermifugo)\b/g,
    ler: fixo(false),
  },

  // -------------------------------------------------------------- antecedentes
  {
    campo: 'antecedente',
    padrao: /\b(?:alergic[oa]|alergia)\s+(?:a|ao|de|com)\s+([a-z]+(?:\s+[a-z]+)?)/g,
    ler: (casamento, original) => {
      const nome = grupo(casamento, original, 1)

      if (!nome) {
        return null
      }

      const aparado = aparar(nome.texto)

      return {
        valor: capitalizar(aparado.texto),
        modo: 'dito',
        tipo: 'alergia',
        inicio: nome.inicio,
        fim: nome.inicio + aparado.tamanho,
      }
    },
    recusaNegacao: true,
  },
  {
    campo: 'antecedente',
    padrao:
      /\b(?:toma|tomando|usa|usando|dou|damos)\s+(?:o |a |um |uma )?([a-z]{4,})\s+(?:todo dia|todos os dias|diariamente|de uso continuo|todo santo dia)\b/g,
    ler: (casamento, original) => {
      const nome = grupo(casamento, original, 1)

      if (!nome) {
        return null
      }

      /*
       * "Toma remédio todo dia" sem o nome ainda é antecedente — e dos que mudam a prescrição.
       * Entra dizendo que o nome faltou, para o veterinário perguntar.
       */
      const generico = ['remedio', 'medicamento', 'comprimido'].includes(normalizar(nome.texto))

      return {
        valor: generico ? 'Remédio de uso diário (nome não dito)' : capitalizar(nome.texto),
        modo: 'dito',
        tipo: 'medicacao-continua',
      }
    },
    recusaNegacao: true,
  },
  {
    campo: 'antecedente',
    padrao:
      /\b(?:castrad[oa]|castrou|castracao)\b(?:[^.!?]{0,30}?\b(ano passado|esse ano|este ano|quando (?:era )?filhote|ha \w+ anos?|em (?:19|20)\d\d))?/g,
    ler: (casamento, original) => {
      const quando = grupo(casamento, original, 1)

      return {
        valor: 'Castração',
        modo: 'dito',
        tipo: 'cirurgia',
        quando: quando?.texto ?? '',
      }
    },
    recusaNegacao: true,
  },
  {
    campo: 'antecedente',
    padrao:
      /\b(?:operou|foi operad[oa]|fez (?:uma )?cirurgia)(?: (?:de|do|da|no|na|nos|nas|o|a))? ([a-z]{4,})/g,
    ler: (casamento, original) => {
      const parte = grupo(casamento, original, 1)

      return parte
        ? { valor: `Cirurgia de ${parte.texto.toLowerCase()}`, modo: 'dito', tipo: 'cirurgia' }
        : null
    },
    recusaNegacao: true,
  },
  {
    campo: 'antecedente',
    padrao:
      /\b(?:tem|teve|tinha|trata|tratou)\s+(?:um |uma )?(diabetes|epilepsia|cardiopatia|sopro(?: no coracao)?|doenca renal|insuficiencia renal|problema (?:no|de|nos) (?:coracao|rim|rins|figado|tireoide)|hipotireoidismo|cancer|tumor|dermatite|leishmaniose|erliquiose|doenca do carrapato|artrose|displasia)\b/g,
    ler: (casamento, original) => {
      const doenca = grupo(casamento, original, 1)

      return doenca
        ? { valor: capitalizar(doenca.texto), modo: 'dito', tipo: 'doenca-previa' }
        : null
    },
    recusaNegacao: true,
  },

  // -------------------------------------------------------------- história clínica
  /*
   * A história não é redigida: cada relato entra como a frase que o responsável disse, curta.
   * "A IA preenche campos, não escreve um textão" — e um resumo escrito pela máquina é
   * exatamente o texto que ninguém confere.
   */
  {
    campo: 'historia',
    padrao:
      /\b(?:comeu|engoliu|pegou|roeu|mastigou)\s+(?:um |uma |uns |umas |o |a |os |as )?(?:pedaco de )?(?:osso|ossinho|ossos|lixo|meia|brinquedo|planta|chocolate|uvas?|cebola|alho|remedio|veneno|corda|pano|plastico|pilha)(?:\s+de\s+[a-z]+)?(?:\s+(?:no|na|do|da|em)\s+[a-z]+(?:\s+de\s+[a-z]+)?)?/g,
    ler: (casamento, original) => {
      const frase = original.slice(casamento.index, casamento.index + casamento[0].length)

      return { valor: `${capitalizar(frase)}.`, modo: 'dito' }
    },
    recusaNegacao: true,
  },
  {
    campo: 'historia',
    padrao: /\b(?:troc\w+ (?:a |de )?racao|mud\w+ (?:a |de )?racao|racao nova)\b/g,
    ler: fixo('Troca de ração recente.'),
    recusaNegacao: true,
  },
]

// ------------------------------------------------------------------ notas

const HIPOTESE =
  /\b(?:pode ser|deve ser|suspeito de|suspeita de|hipotese de|provavelmente (?:e|seja)|acho que (?:e|seja))\s+(?:um quadro de |uma |um |de )?([a-z]+(?:\s+[a-z]+)?)/g

/** Termo com cara de diagnóstico. Sem isto, "pode ser que ela coma" viraria hipótese. */
const TERMO_CLINICO =
  /(?:ite|ose|oma|patia|ia|cao|virose|estranho|parasita|infeccao|fratura|luxacao|obstrucao|trauma|alergia)$/

const PESO = new RegExp(
  `\\b(?:pesando|pesa|pesou|peso de|(?:ta|esta) com)\\s+(?:uns |umas |quase |mais ou menos |cerca de )?${NUMERO}\\s*(?:quilos?|kg|kilos?)\\b`,
  'g',
)

const TEMPERATURA =
  /\b(?:temperatura (?:de |ta |esta |e )?(\d{2}(?:[.,]\d)?)|(\d{2}[.,]\d) graus)\b/g

function notasDoTrecho(trecho: TrechoDaConversa, normalizado: string): NotaDaEscuta[] {
  const notas: NotaDaEscuta[] = []
  const citar = (inicio: number, fim: number): CitacaoDaEscuta => ({
    trechoId: trecho.id,
    inicio,
    fim,
  })

  for (const casamento of normalizado.matchAll(HIPOTESE)) {
    const termo = grupo(casamento, trecho.texto, 1)

    if (!termo) {
      continue
    }

    const aparado = aparar(termo.texto)
    const primeira = normalizar(aparado.texto.split(/\s+/)[0] ?? '')

    if (!TERMO_CLINICO.test(primeira)) {
      continue
    }

    notas.push({
      id: `hipotese:${trecho.id}:${casamento.index}`,
      kind: 'hipotese',
      valor: aparado.texto,
      citacao: citar(casamento.index, termo.inicio + aparado.tamanho),
    })
  }

  for (const casamento of normalizado.matchAll(PESO)) {
    const numero = lerNumero(casamento[1] ?? '')

    if (numero === null) {
      continue
    }

    notas.push({
      id: `peso:${trecho.id}:${casamento.index}`,
      kind: trecho.falante === 'veterinario' ? 'medida' : 'peso-informado',
      valor: `${numeroEmTexto(numero)} kg`,
      citacao: citar(casamento.index, casamento.index + casamento[0].length),
    })
  }

  for (const casamento of normalizado.matchAll(TEMPERATURA)) {
    const valor = casamento[1] ?? casamento[2]

    if (!valor) {
      continue
    }

    notas.push({
      id: `temperatura:${trecho.id}:${casamento.index}`,
      kind: 'medida',
      valor: `${valor.replace('.', ',')} °C`,
      citacao: citar(casamento.index, casamento.index + casamento[0].length),
    })
  }

  return notas
}

// ------------------------------------------------------------------ extração

type Achado = {
  campo: CampoDaEscuta
  leitura: Leitura
  trecho: TrechoDaConversa
  /** Posição do trecho na conversa: desempata a favor de quem falou por último. */
  ordem: number
  inicio: number
  fim: number
}

/**
 * Parece pergunta?
 *
 * Só importa no ao vivo, em que o motor não sabe quem falou. O ponto de interrogação resolve
 * quando o reconhecimento o escreve; quando não escreve, sobra o começo da frase.
 */
export function pareceePergunta(texto: string): boolean {
  if (texto.trim().endsWith('?')) {
    return true
  }

  const normalizado = normalizar(texto.trim())

  if (
    /^(?:como|quando|desde quando|quanto|quantas|quantos|qual|quais|o que|por que|sera que|me conta|me fala|me diz|voce|voces)\b/.test(
      normalizado,
    )
  ) {
    return true
  }

  return /^e (?:o|a|os|as)\b/.test(normalizado) && normalizado.split(/\s+/).length <= 5
}

/** Fato só sai de quem relata. Pergunta do veterinário não é resposta do responsável. */
function relata(trecho: TrechoDaConversa): boolean {
  return trecho.falante !== 'veterinario' && !pareceePergunta(trecho.texto)
}

function negado(normalizado: string, inicio: number): boolean {
  return /\b(?:nao|nunca)\s+(?:e\s+|foi\s+|ta\s+|esta\s+)?$/.test(
    normalizado.slice(Math.max(0, inicio - 12), inicio),
  )
}

function achadosDoTrecho(trecho: TrechoDaConversa, ordem: number, normalizado: string): Achado[] {
  const achados: Achado[] = []

  for (const regra of REGRAS) {
    for (const casamento of normalizado.matchAll(regra.padrao)) {
      if (regra.recusaNegacao && negado(normalizado, casamento.index)) {
        continue
      }

      const leitura = regra.ler(casamento, trecho.texto)

      if (!leitura) {
        continue
      }

      achados.push({
        campo: regra.campo,
        leitura,
        trecho,
        ordem,
        inicio: casamento.index,
        fim: casamento.index + casamento[0].length,
      })
    }
  }

  /*
   * Casamento contido em outro mais longo do mesmo campo sai: "não está comendo bem" casa
   * "comendo bem" (normal) e "não está comendo" (ausente), e só a frase inteira diz o que foi
   * dito — apetite reduzido.
   */
  const porTamanho = [...achados].sort((a, b) => b.fim - b.inicio - (a.fim - a.inicio))
  const aceitos: Achado[] = []

  for (const achado of porTamanho) {
    const encobre = aceitos.some(
      (outro) =>
        outro.campo === achado.campo && achado.inicio < outro.fim && outro.inicio < achado.fim,
    )

    if (!encobre) {
      aceitos.push(achado)
    }
  }

  return aceitos.sort((a, b) => a.inicio - b.inicio)
}

function citacaoDe(achado: Achado): CitacaoDaEscuta {
  return {
    trechoId: achado.trecho.id,
    inicio: achado.leitura.inicio ?? achado.inicio,
    fim: achado.leitura.fim ?? achado.fim,
  }
}

/**
 * O quanto o trecho merece crédito, em degraus e não em decimais.
 *
 * Degrau, porque confiança 0,94 contra 0,91 não é informação — e se fosse, a correção que o
 * responsável faz no fim da conversa ("não, peraí, foram dois dias") perderia para a frase
 * errada do começo por três centésimos. Dentro do mesmo degrau, vence quem falou por último.
 */
function credito(trecho: TrechoDaConversa): number {
  if (trecho.interferencia) {
    return 0
  }

  return trecho.confianca < LIMIAR_DE_CONFIANCA ? 1 : 2
}

/** Qual valor vence: o de mais crédito e, entre iguais, o dito por último. */
function melhorPrimeiro(a: Achado, b: Achado): number {
  return credito(b.trecho) - credito(a.trecho) || b.ordem - a.ordem || b.inicio - a.inicio
}

/**
 * Em que ordem as citações de um mesmo valor aparecem: a de mais crédito primeiro — é ela que
 * sustenta o valor —, e entre iguais, na ordem em que foram ditas, que é a ordem de leitura.
 */
function paraLeitura(a: Achado, b: Achado): number {
  return credito(b.trecho) - credito(a.trecho) || a.ordem - b.ordem || a.inicio - b.inicio
}

/** A mesma frase dita duas vezes no mesmo trecho ("fez mole, mãe, fez mole") é uma citação. */
function citacoesSemRepetir(achados: Achado[], limite: number): CitacaoDaEscuta[] {
  const vistas = new Set<string>()
  const citacoes: CitacaoDaEscuta[] = []

  for (const achado of achados) {
    const citacao = citacaoDe(achado)
    const chave = `${citacao.trechoId}:${normalizar(achado.trecho.texto.slice(citacao.inicio, citacao.fim))}`

    if (!vistas.has(chave)) {
      vistas.add(chave)
      citacoes.push(citacao)
    }
  }

  return citacoes.slice(0, limite)
}

function chaveDoValor(valor: ValorDaEscuta): string {
  return typeof valor === 'boolean' ? String(valor) : normalizar(valor)
}

function escolher(campo: CampoDaEscuta, achados: Achado[]): PropostaDaEscuta {
  const porValor = new Map<string, Achado[]>()

  for (const achado of achados) {
    const chave = chaveDoValor(achado.leitura.valor)

    porValor.set(chave, [...(porValor.get(chave) ?? []), achado])
  }

  const melhorDe = (lista: Achado[]) => [...lista].sort(melhorPrimeiro)[0] as Achado
  const grupos = [...porValor.values()].sort((a, b) => melhorPrimeiro(melhorDe(a), melhorDe(b)))
  const [vencedor = [], ...outros] = grupos

  return {
    id: campo,
    campo,
    valor: melhorDe(vencedor).leitura.valor,
    tipo: null,
    quando: '',
    modo: vencedor.some((achado) => achado.leitura.modo === 'dito') ? 'dito' : 'deduzido',
    citacoes: citacoesSemRepetir([...vencedor].sort(paraLeitura), 3),
    divergencias: outros.map((lista) => ({
      valor: melhorDe(lista).leitura.valor,
      citacao: citacaoDe(melhorDe(lista)),
    })),
  }
}

/** Queixa e história somam: cada sintoma e cada relato, uma vez, na ordem em que apareceram. */
function combinar(campo: 'queixaPrincipal' | 'historia', achados: Achado[]): PropostaDaEscuta {
  const vistos = new Map<string, Achado>()

  for (const achado of [...achados].sort((a, b) => a.ordem - b.ordem || a.inicio - b.inicio)) {
    const chave = chaveDoValor(achado.leitura.valor)

    if (!vistos.has(chave)) {
      vistos.set(chave, achado)
    }
  }

  const unicos = [...vistos.values()]
  const textos = unicos.map((achado) => String(achado.leitura.valor))
  const valor =
    campo === 'queixaPrincipal'
      ? textos.map((texto, indice) => (indice === 0 ? texto : texto.toLowerCase())).join(', ')
      : textos.join(' ')

  return {
    id: campo,
    campo,
    valor,
    tipo: null,
    quando: '',
    modo: unicos.every((achado) => achado.leitura.modo === 'dito') ? 'dito' : 'deduzido',
    citacoes: unicos.map(citacaoDe),
    divergencias: [],
  }
}

function antecedentes(achados: Achado[]): PropostaDaEscuta[] {
  const porChave = new Map<string, Achado[]>()

  for (const achado of achados) {
    const chave = `${achado.leitura.tipo ?? 'outro'}:${chaveDoValor(achado.leitura.valor)}`

    porChave.set(chave, [...(porChave.get(chave) ?? []), achado])
  }

  return [...porChave.entries()].map(([chave, lista]) => {
    const ordenada = [...lista].sort((a, b) => a.ordem - b.ordem || a.inicio - b.inicio)
    const primeiro = ordenada[0] as Achado

    return {
      id: `antecedente:${chave}`,
      campo: 'antecedente' as const,
      valor: primeiro.leitura.valor,
      tipo: primeiro.leitura.tipo ?? 'outro',
      quando: ordenada.find((achado) => achado.leitura.quando)?.leitura.quando ?? '',
      modo: 'dito' as const,
      citacoes: citacoesSemRepetir(ordenada, 2),
      divergencias: [],
    }
  })
}

/**
 * A conversa inteira, lida de novo a cada trecho que chega.
 *
 * Ler tudo de novo, e não só o trecho novo, é o que permite a uma frase do fim corrigir uma do
 * começo. Custa nada: uma consulta tem dezenas de trechos, não milhares.
 */
export function extrairDaConversa(trechos: TrechoDaConversa[]): ResultadoDaEscuta {
  const achados: Achado[] = []
  const notas: NotaDaEscuta[] = []

  trechos.forEach((trecho, ordem) => {
    if (!trecho.texto.trim()) {
      return
    }

    const normalizado = normalizar(trecho.texto)

    notas.push(...notasDoTrecho(trecho, normalizado))

    if (relata(trecho)) {
      achados.push(...achadosDoTrecho(trecho, ordem, normalizado))
    }
  })

  const propostas: PropostaDaEscuta[] = []

  for (const campo of CAMPOS_DA_ESCUTA) {
    const doCampo = achados.filter((achado) => achado.campo === campo)

    if (doCampo.length === 0) {
      continue
    }

    if (campo === 'queixaPrincipal' || campo === 'historia') {
      propostas.push(combinar(campo, doCampo))
    } else if (campo === 'antecedente') {
      propostas.push(...antecedentes(doCampo))
    } else {
      propostas.push(escolher(campo, doCampo))
    }
  }

  return { propostas, notas }
}

// ------------------------------------------------------------------ verificação

function citacaoCabe(citacao: CitacaoDaEscuta, trecho: TrechoDaConversa): boolean {
  return (
    Number.isInteger(citacao.inicio) &&
    Number.isInteger(citacao.fim) &&
    citacao.inicio >= 0 &&
    citacao.fim > citacao.inicio &&
    citacao.fim <= trecho.texto.length
  )
}

/** O que a citação diz, com acento. Vazio quando ela não aponta para lugar nenhum. */
export function textoDaCitacao(
  citacao: CitacaoDaEscuta,
  trechos: ReadonlyMap<string, TrechoDaConversa>,
): string {
  const trecho = trechos.get(citacao.trechoId)

  return trecho && citacaoCabe(citacao, trecho)
    ? trecho.texto.slice(citacao.inicio, citacao.fim)
    : ''
}

/**
 * Acha uma frase na conversa e devolve a citação dela — ou `null`, se ninguém disse aquilo.
 *
 * É a porta para um motor que devolve **frases** em vez de posições, como um modelo de linguagem
 * devolveria. A busca ignora acento e caixa, porque o modelo cita "ta vomitando" onde a
 * transcrição tem "tá vomitando"; e não ignora mais nada, porque uma frase parecida não é a frase.
 */
export function ancorarCitacao(
  trechos: TrechoDaConversa[],
  frase: string,
  trechoId?: string,
): CitacaoDaEscuta | null {
  const procurada = normalizar(frase.trim())

  if (!procurada) {
    return null
  }

  for (const trecho of trechos) {
    if (trechoId && trecho.id !== trechoId) {
      continue
    }

    const inicio = normalizar(trecho.texto).indexOf(procurada)

    if (inicio >= 0) {
      return { trechoId: trecho.id, inicio, fim: inicio + procurada.length }
    }
  }

  return null
}

/**
 * O que a revisão precisa saber sobre a proposta antes de alguém aceitá-la.
 *
 * `sem-origem` é o alerta que um motor de regras nunca dispara — ele só cita o que casou — e que
 * um modelo dispara quando inventa: a citação que ele devolveu não existe na conversa.
 *
 * Em campo de valor único, só a citação que sustenta o valor conta para interferência: se o
 * "xixi normal" foi dito limpo uma vez, um segundo "xixi normal" no meio de um latido não torna
 * a proposta suspeita. Em queixa e história, que somam pedaços, qualquer pedaço atrapalhado conta.
 */
export function alertasDaProposta(
  proposta: PropostaDaEscuta,
  trechos: ReadonlyMap<string, TrechoDaConversa>,
): AlertaDaProposta[] {
  const alertas = new Set<AlertaDaProposta>()

  if (proposta.citacoes.length === 0) {
    alertas.add('sem-origem')
  }

  const soma = proposta.campo === 'queixaPrincipal' || proposta.campo === 'historia'

  proposta.citacoes.forEach((citacao, indice) => {
    const trecho = trechos.get(citacao.trechoId)

    if (!trecho || !citacaoCabe(citacao, trecho)) {
      alertas.add('sem-origem')

      return
    }

    if (!soma && indice > 0) {
      return
    }

    if (trecho.interferencia) {
      alertas.add(trecho.interferencia)
    } else if (trecho.confianca < LIMIAR_DE_CONFIANCA) {
      alertas.add('baixa-confianca')
    }
  })

  if (proposta.divergencias.length > 0) {
    alertas.add('divergencia')
  }

  if (proposta.modo === 'deduzido') {
    alertas.add('deduzido')
  }

  return ALERTAS_DA_PROPOSTA.filter((alerta) => alertas.has(alerta))
}

// ------------------------------------------------------------------ aplicação

/** O que o veterinário decidiu levar para o prontuário: o proposto ou o que ele corrigiu. */
export type EscolhaDaRevisao = {
  campo: CampoDaEscuta
  valor: ValorDaEscuta
  tipo: AntecedenteKind | null
  quando: string
}

function opcaoValida<C extends CampoDeOpcao>(
  campo: C,
  valor: ValorDaEscuta,
): (typeof OPCOES_DA_ESCUTA)[C][number] | null {
  const opcoes = OPCOES_DA_ESCUTA[campo] as readonly string[]

  return typeof valor === 'string' && opcoes.includes(valor)
    ? (valor as (typeof OPCOES_DA_ESCUTA)[C][number])
    : null
}

/**
 * O patch da anamnese a partir das escolhas.
 *
 * Três regras, todas para não destruir o que já estava lá:
 *
 * - **Campo simples é substituído** — a revisão mostrou o valor atual ao lado, e escolher a
 *   proposta foi escolher trocar.
 * - **História soma.** É relato, e relato novo não apaga o anterior.
 * - **Antecedente soma, sem repetir.** Alergia a dipirona já registrada não entra duas vezes.
 */
export function patchDaEscuta(
  atual: Anamnese,
  escolhas: EscolhaDaRevisao[],
  novoId: () => string,
): Partial<Anamnese> {
  const patch: Partial<Anamnese> = {}
  const lista = [...atual.antecedentes]
  let historia = atual.historia

  for (const escolha of escolhas) {
    const { campo, valor } = escolha

    switch (campo) {
      case 'queixaPrincipal':
      case 'duracaoSintomas': {
        const texto = String(valor).trim()

        if (texto) {
          patch[campo] = texto
        }

        break
      }

      case 'historia': {
        const texto = String(valor).trim()

        if (texto) {
          historia = historia.trim() ? `${historia.trim()}\n${texto}` : texto
          patch.historia = historia
        }

        break
      }

      case 'evolucao':
      case 'apetite':
      case 'evacuacao':
      case 'miccao':
      case 'ambiente': {
        const opcao = opcaoValida(campo, valor)

        if (opcao) {
          Object.assign(patch, { [campo]: opcao })
        }

        break
      }

      case 'vacinacaoEmDia':
      case 'vermifugacaoEmDia': {
        if (typeof valor === 'boolean') {
          patch[campo] = valor
        }

        break
      }

      case 'antecedente': {
        const descricao = String(valor).trim()
        const kind = escolha.tipo ?? 'outro'

        if (!descricao) {
          break
        }

        const repetido = lista.some(
          (item) =>
            item.kind === kind && normalizar(item.descricao.trim()) === normalizar(descricao),
        )

        if (!repetido) {
          lista.push({ id: novoId(), kind, descricao, quando: escolha.quando.trim() })
          patch.antecedentes = [...lista]
        }

        break
      }
    }
  }

  return patch
}
