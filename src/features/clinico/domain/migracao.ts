/**
 * Migrador de dados: a base da clínica vinda de outro sistema.
 *
 * Nenhuma clínica troca de sistema se tiver que redigitar quinze anos de pacientes — e nenhuma
 * confia no sistema novo se a importação perder dado calada. As regras daqui existem para as
 * duas coisas ao mesmo tempo: **trazer o máximo** de uma planilha bagunçada, e **dizer o que
 * aconteceu com cada linha**, inclusive com a que não entrou.
 *
 * O caminho tem três tempos, e cada um é uma função pura:
 *
 * 1. `sugerirMapeamento` — o que cada coluna parece ser, pelo nome ou pelo conteúdo, com a
 *    confiança de cada palpite. A tela mostra o palpite e a pessoa corrige.
 * 2. `lerRegistros` — cada linha lida campo a campo. Valor que muda de sentido ao ser lido
 *    (data com ano de dois dígitos, peso em gramas, celular sem o nono dígito) vira **ajuste**
 *    e aparece na linha; valor que só muda de roupa (máscara, vírgula, maiúsculas) é
 *    **padronização** e aparece somado, para não afogar o relatório.
 * 3. `planejar` — responsáveis agrupados, repetidos encontrados, decisões levantadas, e a
 *    situação de cada linha: entra, junta com outro cadastro, entra só como contato, fica de
 *    fora (com motivo) ou espera uma decisão.
 *
 * Três regras de fundo, herdadas do cadastro (`domain/cadastro.ts`):
 *
 * - **Dado errado é pior que dado em branco.** CPF que não fecha os dígitos, e-mail sem domínio
 *   e data no futuro são descartados — o resto da linha entra, e o descarte é dito.
 * - **Nada se inventa para vencer um campo obrigatório.** Sexo em branco entra como não
 *   informado; espécie desconhecida não vira "canina" por padrão — ou alguém escolhe, ou a
 *   linha fica de fora com o motivo.
 * - **Repetido é o defeito mais caro.** A importação é o momento em que mais cadastro repetido
 *   nasce de uma vez, então a semelhança é procurada na planilha e na base, antes de gravar.
 *
 * Nada aqui conhece Vue, i18n ou repositório: tudo sai como `tipo`, e a tela traduz.
 */

import type { EnderecoPostal, ISODate, Pet, PetSex, PetSpecies, Tutor } from '../data/types'

import {
  cpfValido,
  emailValido,
  formatarCep,
  formatarCpf,
  formatarTelefone,
  responsaveisSemelhantes,
  somenteDigitos,
  telefoneValido,
  UFS,
  type MotivoDeSemelhanca,
} from './cadastro'
import { linhaNaPlanilha, type PlanilhaLida } from './planilha'

// ---------------------------------------------------------------------------
// Campos de destino
// ---------------------------------------------------------------------------

export const CAMPOS_DO_RESPONSAVEL = [
  'responsavelNome',
  'telefone',
  'telefone2',
  'email',
  'cpf',
  'cep',
  'endereco',
  'numero',
  'bairro',
  'cidade',
  'uf',
] as const

export const CAMPOS_DO_ANIMAL = [
  'petNome',
  'especie',
  'raca',
  'sexo',
  'castrado',
  'nascimento',
  'idade',
  'peso',
  'microchip',
  'pelagem',
  'alergia',
  'situacao',
] as const

export type CampoDoResponsavel = (typeof CAMPOS_DO_RESPONSAVEL)[number]
export type CampoDoAnimal = (typeof CAMPOS_DO_ANIMAL)[number]
export type CampoDeDestino = CampoDoResponsavel | CampoDoAnimal

/**
 * Sem estes dois não há o que importar: paciente precisa de nome, e paciente sem responsável é
 * paciente que ninguém consegue avisar (a mesma recusa de `patientRepository.criarPaciente`).
 */
export const CAMPOS_OBRIGATORIOS: CampoDeDestino[] = ['petNome', 'responsavelNome']

export function ehDoResponsavel(campo: CampoDeDestino): campo is CampoDoResponsavel {
  return (CAMPOS_DO_RESPONSAVEL as readonly string[]).includes(campo)
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

/** Sem acento, minúsculo, pontuação vira espaço. `"Castrado?"` → `"castrado"`, `"E-mail"` → `"e mail"`. */
export function normalizarRotulo(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e', 'di', 'du', 'van', 'von'])

/**
 * `"MARIA DA SILVA"` → `"Maria da Silva"`.
 *
 * Só mexe em texto que está **inteiro** em maiúsculas ou minúsculas: "João McAllister" foi
 * escrito assim por alguém, e reescrevê-lo seria corrigir o que não estava errado.
 */
export function nomeProprio(texto: string): { valor: string; mudou: boolean } {
  const limpo = texto.replace(/\s+/g, ' ').trim()
  const letras = limpo.replace(/[^\p{L}]/gu, '')

  if (letras.length < 2 || (letras !== letras.toUpperCase() && letras !== letras.toLowerCase())) {
    return { valor: limpo, mudou: false }
  }

  const valor = limpo
    .toLowerCase()
    .split(' ')
    .map((palavra, indice) =>
      indice > 0 && PARTICULAS.has(palavra)
        ? palavra
        : palavra.replace(
            /(^|[-'])(\p{L})/gu,
            (_, antes: string, letra: string) => antes + letra.toUpperCase(),
          ),
    )
    .join(' ')

  return { valor, mudou: valor !== limpo }
}

// ---------------------------------------------------------------------------
// Sugestão de mapeamento
// ---------------------------------------------------------------------------

/** Por onde o palpite veio. A tela diz isso ao lado de cada coluna. */
export type ComoFoiSugerido = 'origem' | 'nome' | 'conteudo' | 'pessoa' | 'nenhum'
export type Confianca = 'certa' | 'provavel' | 'nenhuma'

export type MapeamentoDaColuna = {
  coluna: number
  destino: CampoDeDestino | null
  confianca: Confianca
  como: ComoFoiSugerido
}

/** Nome de coluna que casa exatamente. Tudo já normalizado. */
const SINONIMOS: Record<CampoDeDestino, string[]> = {
  responsavelNome: [
    'nome do responsavel',
    'responsavel',
    'nome responsavel',
    'tutor',
    'nome do tutor',
    'nome tutor',
    'proprietario',
    'nome do proprietario',
    'nome proprietario',
    'cliente',
    'nome do cliente',
    'nome cliente',
    'dono',
    'nome do dono',
  ],
  telefone: [
    'telefone',
    'fone',
    'tel',
    'celular',
    'cel',
    'whatsapp',
    'whats',
    'telefone 1',
    'fone 1',
    'fone1',
    'tel1',
    'telefone1',
    'contato',
    'telefone celular',
    'telefone principal',
  ],
  telefone2: [
    'telefone 2',
    'telefone2',
    'fone 2',
    'fone2',
    'tel 2',
    'tel2',
    'telefone residencial',
    'fone residencial',
    'telefone fixo',
    'fixo',
    'outro telefone',
    'telefone comercial',
    'recado',
    'telefone recado',
    'celular 2',
  ],
  email: ['email', 'e mail', 'correio eletronico', 'mail'],
  cpf: ['cpf', 'cpf cnpj', 'documento', 'doc', 'cpf do cliente', 'cpf do responsavel'],
  cep: ['cep', 'codigo postal'],
  endereco: ['endereco', 'logradouro', 'rua', 'end', 'endereco completo'],
  numero: ['numero', 'num', 'nro', 'n'],
  bairro: ['bairro'],
  cidade: ['cidade', 'municipio'],
  uf: ['uf', 'estado'],
  petNome: [
    'animal',
    'nome do animal',
    'nome animal',
    'pet',
    'nome do pet',
    'nome pet',
    'paciente',
    'nome do paciente',
    'nome paciente',
  ],
  especie: ['especie', 'tipo', 'tipo de animal', 'tipo animal'],
  raca: ['raca'],
  sexo: ['sexo', 'genero'],
  castrado: ['castrado', 'castrada', 'castrado a', 'castracao', 'esterilizado', 'castrado s n'],
  nascimento: [
    'nascimento',
    'data de nascimento',
    'data nascimento',
    'dt nasc',
    'dt nascimento',
    'data nasc',
    'nasc',
    'aniversario',
  ],
  idade: ['idade', 'idade aproximada'],
  peso: ['peso', 'peso kg', 'peso atual', 'ultimo peso', 'peso em kg', 'kg'],
  microchip: ['microchip', 'chip', 'micro chip', 'n microchip', 'numero do chip', 'n do chip'],
  pelagem: ['pelagem', 'cor', 'cor da pelagem', 'cor pelagem', 'pelo', 'cor do pelo'],
  alergia: ['alergia', 'alergias', 'alergico a', 'alergico', 'alergia a'],
  situacao: ['situacao', 'status', 'obito', 'falecido', 'situacao do animal'],
}

/**
 * Palavra dentro do nome da coluna, na ordem em que o mais específico ganha.
 *
 * "Fone do cliente" é telefone, não responsável: por isso os campos de contato vêm antes dos
 * de nome. E "cep do cliente" é CEP pelo mesmo motivo.
 */
const PALAVRAS: Array<[CampoDeDestino, RegExp]> = [
  ['email', /\be ?mail\b/],
  ['cpf', /\bcpf\b/],
  [
    'telefone2',
    /\b(fone|telefone|tel|celular|cel)\s?(2|secundario|residencial|fixo|comercial|recado)\b/,
  ],
  ['telefone', /\b(fone|telefone|tel|celular|cel|whats\w*|zap)\d?\b/],
  ['nascimento', /\b(nasc\w*|aniversario)\b/],
  ['microchip', /\b(micro ?chip|chip)\b/],
  ['peso', /\bpeso\b/],
  ['castrado', /\b(castrad\w*|castracao)\b/],
  ['alergia', /\balergi\w*\b/],
  ['especie', /\bespecie\b/],
  ['raca', /\braca\b/],
  ['sexo', /\bsexo\b/],
  ['pelagem', /\b(pelagem|pelo)\b/],
  ['cep', /\bcep\b/],
  ['bairro', /\bbairro\b/],
  ['cidade', /\b(cidade|municipio)\b/],
  ['endereco', /\b(endereco|logradouro|rua)\b/],
  ['situacao', /\b(situacao|obito|falecid\w*)\b/],
  ['idade', /\bidade\b/],
  ['petNome', /\b(animal|pet|paciente)\b/],
  ['responsavelNome', /\b(responsavel|tutor|proprietario|cliente|dono)\b/],
]

/** Coluna de identificador do sistema antigo: "cod animal" não é o nome do animal. */
const IDENTIFICADOR = /\b(cod|codigo|id|registro|ficha|matricula)\b/

/**
 * Export de sistema que a clínica provavelmente usa hoje.
 *
 * **Os cabeçalhos são presumidos**, montados a partir do que esses sistemas costumam exportar,
 * e precisam ser conferidos com um arquivo real de cada um antes de a lista ir para venda
 * (ver `docs/clinico/11-*.md`). Reconhecer a origem só faz a sugestão nascer certa — as
 * colunas continuam todas à vista para conferir.
 */
export type OrigemConhecida = {
  id: 'simplesvet' | 'vetus'
  nome: string
  /** Cabeçalhos normalizados que precisam estar todos presentes. */
  assinatura: string[]
  mapa: Record<string, CampoDeDestino | null>
}

export const ORIGENS_CONHECIDAS: OrigemConhecida[] = [
  {
    id: 'simplesvet',
    nome: 'SimplesVet',
    assinatura: ['cliente', 'cpf cnpj', 'animal', 'especie', 'data de nascimento'],
    mapa: {
      codigo: null,
      cliente: 'responsavelNome',
      'cpf cnpj': 'cpf',
      celular: 'telefone',
      telefone: 'telefone2',
      'e mail': 'email',
      cep: 'cep',
      endereco: 'endereco',
      numero: 'numero',
      bairro: 'bairro',
      cidade: 'cidade',
      uf: 'uf',
      animal: 'petNome',
      especie: 'especie',
      raca: 'raca',
      sexo: 'sexo',
      castrado: 'castrado',
      'data de nascimento': 'nascimento',
      'peso kg': 'peso',
      pelagem: 'pelagem',
      microchip: 'microchip',
      situacao: 'situacao',
    },
  },
  {
    id: 'vetus',
    nome: 'Vetus',
    assinatura: ['nome proprietario', 'nome animal', 'dt nascimento', 'fone1'],
    mapa: {
      'cod cliente': null,
      'cod animal': null,
      'nome proprietario': 'responsavelNome',
      'cpf proprietario': 'cpf',
      fone1: 'telefone',
      fone2: 'telefone2',
      email: 'email',
      'nome animal': 'petNome',
      especie: 'especie',
      raca: 'raca',
      sexo: 'sexo',
      'dt nascimento': 'nascimento',
      peso: 'peso',
      castrado: 'castrado',
      obito: 'situacao',
    },
  },
]

export function reconhecerOrigem(cabecalhos: string[]): OrigemConhecida | null {
  const presentes = new Set(cabecalhos.map(normalizarRotulo))

  return (
    ORIGENS_CONHECIDAS.find((origem) => origem.assinatura.every((nome) => presentes.has(nome))) ??
    null
  )
}

/** Amostra de valores preenchidos de uma coluna — o que a tela mostra ao lado dela, e o que o palpite por conteúdo lê. */
export function exemplosDaColuna(planilha: PlanilhaLida, coluna: number, quantos = 3): string[] {
  const vistos: string[] = []

  for (const linha of planilha.linhas) {
    const valor = linha[coluna] ?? ''

    if (valor && !vistos.includes(valor)) {
      vistos.push(valor)

      if (vistos.length >= quantos) {
        break
      }
    }
  }

  return vistos
}

/** Quantas células da coluna têm alguma coisa. Coluna ignorada com conteúdo é dado que não vem — a tela avisa. */
export function preenchidasNaColuna(planilha: PlanilhaLida, coluna: number): number {
  return planilha.linhas.filter((linha) => (linha[coluna] ?? '') !== '').length
}

/**
 * O que o conteúdo diz que a coluna é, quando o nome não disse.
 *
 * Só conta quando a maioria concorda (60%): uma coluna "Contato" com metade telefone e metade
 * e-mail não é nenhuma das duas, e palpitar errado é pior que não palpitar. A ordem importa —
 * CPF antes de telefone, porque os dois têm onze dígitos e só o CPF fecha a conta dos
 * verificadores.
 */
function perfilDoConteudo(valores: string[]): CampoDeDestino | null {
  if (valores.length === 0) {
    return null
  }

  const fracao = (teste: (valor: string) => boolean) =>
    valores.filter(teste).length / valores.length

  const hoje = '2100-01-01'

  const testes: Array<[CampoDeDestino, (valor: string) => boolean, number]> = [
    ['email', (valor) => emailValido(valor), 0.6],
    ['cpf', (valor) => lerCpf(valor).valor !== null, 0.6],
    ['microchip', (valor) => /^\d{15}$/.test(somenteDigitos(valor)) && !/[a-z]/i.test(valor), 0.6],
    ['nascimento', (valor) => lerData(valor, { ordem: 'dmy', hoje }).valor !== null, 0.6],
    ['cep', (valor) => /^\d{5}-?\d{3}$/.test(valor.trim()), 0.6],
    ['telefone', (valor) => lerTelefone(valor, '11').numeros.length > 0, 0.6],
    ['uf', (valor) => (UFS as readonly string[]).includes(valor.trim().toUpperCase()), 0.8],
    ['especie', (valor) => lerEspecie(valor).especie !== null, 0.6],
    ['sexo', (valor) => lerSexo(valor).reconhecido && valor.trim() !== '', 0.8],
  ]

  for (const [campo, teste, minimo] of testes) {
    if (fracao(teste) >= minimo) {
      return campo
    }
  }

  return null
}

function amostra(planilha: PlanilhaLida, coluna: number, limite = 40): string[] {
  const valores: string[] = []

  for (const linha of planilha.linhas) {
    const valor = linha[coluna] ?? ''

    if (valor) {
      valores.push(valor)

      if (valores.length >= limite) {
        break
      }
    }
  }

  return valores
}

type Candidato = {
  coluna: number
  destino: CampoDeDestino
  confianca: Confianca
  como: ComoFoiSugerido
  peso: number
}

/**
 * O palpite para todas as colunas de uma vez.
 *
 * Cada campo vai para **uma** coluna só; a disputa é ganha pela confiança maior, e empate fica
 * com a coluna mais à esquerda. A exceção é telefone: a segunda coluna de telefone vira
 * "telefone 2" em vez de ficar sem destino — é o que ela quase sempre é.
 *
 * "Nome" sozinho é o caso ambíguo clássico. Ele é resolvido **depois** dos outros: se já há
 * coluna de animal, é o responsável; se já há responsável, é o animal; sem nenhum dos dois, o
 * primeiro "Nome" é do responsável — planilha de clínica costuma ser de clientes.
 */
export function sugerirMapeamento(planilha: PlanilhaLida): MapeamentoDaColuna[] {
  const origem = reconhecerOrigem(planilha.cabecalhos)
  const candidatos: Candidato[] = []
  const colunasNome: number[] = []

  planilha.cabecalhos.forEach((cabecalho, coluna) => {
    const rotulo = normalizarRotulo(cabecalho)

    if (origem && rotulo in origem.mapa) {
      const destino = origem.mapa[rotulo]

      if (destino) {
        candidatos.push({ coluna, destino, confianca: 'certa', como: 'origem', peso: 4 })
      }

      return
    }

    if (rotulo === 'nome' || rotulo === 'nome completo') {
      colunasNome.push(coluna)

      return
    }

    const exato = (Object.keys(SINONIMOS) as CampoDeDestino[]).find((campo) =>
      SINONIMOS[campo].includes(rotulo),
    )

    if (exato) {
      candidatos.push({ coluna, destino: exato, confianca: 'certa', como: 'nome', peso: 3 })

      return
    }

    if (rotulo && !IDENTIFICADOR.test(rotulo)) {
      const porPalavra = PALAVRAS.find(([, padrao]) => padrao.test(rotulo))

      if (porPalavra) {
        candidatos.push({
          coluna,
          destino: porPalavra[0],
          confianca: 'provavel',
          como: 'nome',
          peso: 2,
        })

        return
      }
    }

    if (IDENTIFICADOR.test(rotulo)) {
      return
    }

    const peloConteudo = perfilDoConteudo(amostra(planilha, coluna))

    if (peloConteudo) {
      candidatos.push({
        coluna,
        destino: peloConteudo,
        confianca: 'provavel',
        como: 'conteudo',
        peso: 1,
      })
    }
  })

  const resultado: MapeamentoDaColuna[] = planilha.cabecalhos.map((_, coluna) => ({
    coluna,
    destino: null,
    confianca: 'nenhuma',
    como: 'nenhum',
  }))
  const usados = new Set<CampoDeDestino>()

  candidatos
    .sort((a, b) => b.peso - a.peso || a.coluna - b.coluna)
    .forEach((candidato) => {
      let destino: CampoDeDestino | null = candidato.destino

      if (usados.has(destino)) {
        destino = destino === 'telefone' && !usados.has('telefone2') ? 'telefone2' : null
      }

      if (!destino) {
        return
      }

      usados.add(destino)
      resultado[candidato.coluna] = {
        coluna: candidato.coluna,
        destino,
        confianca: destino === candidato.destino ? candidato.confianca : 'provavel',
        como: candidato.como,
      }
    })

  for (const coluna of colunasNome) {
    const destino: CampoDeDestino | null = !usados.has('responsavelNome')
      ? 'responsavelNome'
      : !usados.has('petNome')
        ? 'petNome'
        : null

    if (destino) {
      usados.add(destino)
      resultado[coluna] = { coluna, destino, confianca: 'provavel', como: 'nome' }
    }
  }

  return resultado
}

/** O que falta para poder seguir. Vazio = pode. */
export function faltasDoMapeamento(mapeamento: MapeamentoDaColuna[]): CampoDeDestino[] {
  const presentes = new Set(mapeamento.map((item) => item.destino))

  return CAMPOS_OBRIGATORIOS.filter((campo) => !presentes.has(campo))
}

// ---------------------------------------------------------------------------
// Leitura de valores
// ---------------------------------------------------------------------------

/**
 * O que aconteceu com um valor ao ser lido.
 *
 * Os do primeiro grupo **entram**, mas mudaram de sentido ao serem lidos — a pessoa precisa
 * saber, porque pode discordar. Os do segundo grupo **não entram**: o campo fica em branco e o
 * resto da linha segue.
 */
export const AJUSTES_QUE_ENTRAM = [
  'data-ano-curto',
  'data-da-planilha',
  'data-americana',
  'data-sem-dia',
  'nascimento-pela-idade',
  'peso-em-gramas',
  'telefone-nono-digito',
  'telefone-ddd-da-clinica',
  'telefone-dividido',
  'cpf-zeros',
  'cep-zero',
  'especie-pela-raca',
  'especie-escolhida',
  'celula-mesclada',
  'responsavel-da-linha-anterior',
] as const

export const AJUSTES_DESCARTADOS = [
  'data-invalida',
  'data-futura',
  'idade-invalida',
  'peso-invalido',
  'telefone-invalido',
  'cpf-invalido',
  'email-invalido',
  'cep-invalido',
  'uf-invalida',
  'microchip-invalido',
  'microchip-cientifico',
  'nao-reconhecido',
] as const

export type TipoDeAjuste =
  | (typeof AJUSTES_QUE_ENTRAM)[number]
  | (typeof AJUSTES_DESCARTADOS)[number]

export type Ajuste = {
  campo: CampoDeDestino
  tipo: TipoDeAjuste
  /** O que estava na célula. */
  de: string
  /** Como entrou; `null` quando não entrou. */
  para: string | null
}

export function ehDescarte(tipo: TipoDeAjuste): boolean {
  return (AJUSTES_DESCARTADOS as readonly string[]).includes(tipo)
}

/** Mudança só de forma. Somada, não listada por linha. */
export type Padronizacao = 'telefone' | 'documento' | 'data' | 'peso' | 'nome' | 'especie' | 'uf'

export const PADRONIZACOES: Padronizacao[] = [
  'telefone',
  'documento',
  'data',
  'peso',
  'nome',
  'especie',
  'uf',
]

type Leitura<T> = {
  valor: T | null
  ajuste?: TipoDeAjuste
  padronizou?: boolean
}

// ------------------------------------------------------------------- datas

const MESES: Record<string, number> = {
  jan: 1,
  fev: 2,
  feb: 2,
  mar: 3,
  abr: 4,
  apr: 4,
  mai: 5,
  may: 5,
  jun: 6,
  jul: 7,
  ago: 8,
  aug: 8,
  set: 9,
  sep: 9,
  out: 10,
  oct: 10,
  nov: 11,
  dez: 12,
  dec: 12,
}

function mesPorNome(texto: string): number | null {
  return MESES[normalizarRotulo(texto).slice(0, 3)] ?? null
}

function iso(ano: number, mes: number, dia: number): string {
  return `${String(ano).padStart(4, '0')}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

function dataExiste(ano: number, mes: number, dia: number): boolean {
  if (mes < 1 || mes > 12 || dia < 1 || ano < 1900) {
    return false
  }

  const data = new Date(Date.UTC(ano, mes - 1, dia))

  return (
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia
  )
}

/** Ano de dois dígitos: até o ano corrente é 20xx, depois é 19xx. Nascimento de animal não fica no futuro. */
function anoCompleto(ano: string, hoje: ISODate): number {
  if (ano.length === 4) {
    return Number(ano)
  }

  const corrente = Number(hoje.slice(2, 4))
  const curto = Number(ano)

  return curto <= corrente ? 2000 + curto : 1900 + curto
}

export type OrdemDasDatas = 'dmy' | 'mdy'

/**
 * Dia antes do mês, ou mês antes do dia — decidido **pela coluna**, não por célula.
 *
 * `03/04/2019` sozinho não diz nada. Mas se a mesma coluna tem `04/23/2019`, ninguém nasceu no
 * mês 23: a coluna inteira é americana, e o `03/04` é 4 de março. Só vira americana se **nenhuma**
 * célula contradisser; coluna misturada fica no padrão brasileiro, e o que não fecha é ajustado
 * célula a célula.
 */
export function ordemDasDatas(valores: string[]): OrdemDasDatas {
  let brasileiras = 0
  let americanas = 0

  for (const valor of valores) {
    const partes = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})/.exec(valor.trim())

    if (!partes) {
      continue
    }

    const primeiro = Number(partes[1])
    const segundo = Number(partes[2])

    if (primeiro > 12 && segundo <= 12) {
      brasileiras += 1
    } else if (segundo > 12 && primeiro <= 12) {
      americanas += 1
    }
  }

  return americanas > 0 && brasileiras === 0 ? 'mdy' : 'dmy'
}

/** Data serial do Excel: dias desde 30/12/1899 (o erro de 1900 do Lotus já vem embutido nessa âncora). */
export function dataDoExcel(serial: number): ISODate {
  const data = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86_400_000)

  return iso(data.getUTCFullYear(), data.getUTCMonth() + 1, data.getUTCDate())
}

function subtrairIdade(hoje: ISODate, anos: number, meses: number): ISODate {
  const [ano, mes, dia] = hoje.split('-').map(Number) as [number, number, number]
  const total = ano * 12 + (mes - 1) - anos * 12 - meses
  const novoAno = Math.floor(total / 12)
  const novoMes = (total % 12) + 1
  const ultimoDia = new Date(Date.UTC(novoAno, novoMes, 0)).getUTCDate()

  return iso(novoAno, novoMes, Math.min(dia, ultimoDia))
}

/**
 * Idade escrita onde deveria haver data: "3 anos", "2a 4m", "8 meses".
 *
 * Vira nascimento **estimado** e diz que estimou — faixa etária errada muda dose no bulário, e
 * idade nenhuma deixaria o paciente sem faixa. Número sozinho é lido como anos.
 */
export function lerIdade(bruto: string, hoje: ISODate): Leitura<ISODate> {
  const texto = normalizarRotulo(bruto)

  if (!texto) {
    return { valor: null }
  }

  const anos = /(\d{1,2})\s*(anos?|a)\b/.exec(texto)
  const meses = /(\d{1,2})\s*(mes|meses|m)\b/.exec(texto)
  const soNumero = /^\d{1,2}$/.test(texto)

  if (!anos && !meses && !soNumero) {
    return { valor: null, ajuste: 'idade-invalida' }
  }

  const totalAnos = soNumero ? Number(texto) : Number(anos?.[1] ?? 0)
  const totalMeses = Number(meses?.[1] ?? 0)

  if (totalAnos > 60 || totalMeses > 24 || (totalAnos === 0 && totalMeses === 0 && !soNumero)) {
    return { valor: null, ajuste: 'idade-invalida' }
  }

  return { valor: subtrairIdade(hoje, totalAnos, totalMeses), ajuste: 'nascimento-pela-idade' }
}

/**
 * Data de nascimento, em qualquer um dos jeitos que uma planilha de clínica tem.
 *
 * - `2019-03-12` (e com hora colada) — só forma.
 * - `12/03/2019`, `12.03.2019`, `12-03-2019` — só forma.
 * - `12/03/19` — ano de dois dígitos, interpretado.
 * - `43536` — número serial do Excel, de coluna que perdeu a formatação de data.
 * - `12 mar 2019`, `12/mar/19` — mês por extenso.
 * - `mar/2019`, `03/2019`, `2019` — sem dia (e sem mês): vira o primeiro dia e diz que virou.
 * - `3 anos` — idade na coluna de data (`lerIdade`).
 *
 * Data que não existe (31/02) e data no futuro são descartadas.
 */
export function lerData(
  bruto: string,
  contexto: { ordem: OrdemDasDatas; hoje: ISODate },
): Leitura<ISODate> {
  const texto = bruto.trim()

  if (!texto) {
    return { valor: null }
  }

  let ano = 0
  let mes = 0
  let dia = 0
  let ajuste: TipoDeAjuste | undefined

  const isoCompleto = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(texto)
  const numerica = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})(?:\s.*)?$/.exec(texto)
  const serial = /^(\d{5})(?:[.,]\d+)?$/.exec(texto)
  const porExtenso =
    /^(\d{1,2})[\s/.-]*(?:de\s+)?([a-zA-ZçÇ]{3,})\.?[\s/.-]*(?:de\s+)?(\d{2}|\d{4})$/.exec(texto)
  const semDia = /^([a-zA-ZçÇ]{3,})\.?[\s/.-]*(?:de\s+)?(\d{4})$/.exec(texto)
  const mesAno = /^(\d{1,2})[/.-](\d{4})$/.exec(texto)
  const soAno = /^(19|20)\d{2}$/.exec(texto)

  if (isoCompleto) {
    ano = Number(isoCompleto[1])
    mes = Number(isoCompleto[2])
    dia = Number(isoCompleto[3])
  } else if (numerica) {
    const primeiro = Number(numerica[1])
    const segundo = Number(numerica[2])
    /* Célula que só fecha ao contrário da coluna: 04/23/2019 numa coluna brasileira. */
    const americana =
      contexto.ordem === 'mdy' ? !(primeiro > 12 && segundo <= 12) : segundo > 12 && primeiro <= 12

    dia = americana ? segundo : primeiro
    mes = americana ? primeiro : segundo
    ano = anoCompleto(numerica[3]!, contexto.hoje)
    ajuste = americana ? 'data-americana' : numerica[3]!.length === 2 ? 'data-ano-curto' : undefined
  } else if (serial && Number(serial[1]) >= 20_000 && Number(serial[1]) <= 60_000) {
    /* Só a faixa 1954–2064: fora dela, cinco dígitos são um código, não uma data. */
    const convertida = dataDoExcel(Number(serial[1]))

    ;[ano, mes, dia] = convertida.split('-').map(Number) as [number, number, number]
    ajuste = 'data-da-planilha'
  } else if (porExtenso && mesPorNome(porExtenso[2]!)) {
    dia = Number(porExtenso[1])
    mes = mesPorNome(porExtenso[2]!)!
    ano = anoCompleto(porExtenso[3]!, contexto.hoje)
    ajuste = porExtenso[3]!.length === 2 ? 'data-ano-curto' : undefined
  } else if (semDia && mesPorNome(semDia[1]!)) {
    dia = 1
    mes = mesPorNome(semDia[1]!)!
    ano = Number(semDia[2])
    ajuste = 'data-sem-dia'
  } else if (mesAno) {
    dia = 1
    mes = Number(mesAno[1])
    ano = Number(mesAno[2])
    ajuste = 'data-sem-dia'
  } else if (soAno) {
    dia = 1
    mes = 1
    ano = Number(texto)
    ajuste = 'data-sem-dia'
  } else if (/\d/.test(texto) && /(ano|mes|\d\s*a\b|\d\s*m\b)/i.test(normalizarRotulo(texto))) {
    return lerIdade(texto, contexto.hoje)
  } else {
    return { valor: null, ajuste: 'data-invalida' }
  }

  if (!dataExiste(ano, mes, dia)) {
    return { valor: null, ajuste: 'data-invalida' }
  }

  const valor = iso(ano, mes, dia)

  if (valor > contexto.hoje) {
    return { valor: null, ajuste: 'data-futura' }
  }

  return { valor, ajuste, padronizou: !ajuste && valor !== texto }
}

// ---------------------------------------------------------------- telefone

export type LeituraDeTelefone = {
  numeros: string[]
  ajustes: Array<{ tipo: TipoDeAjuste; de: string; para: string | null }>
  padronizou: boolean
}

/**
 * Um ou mais telefones de uma célula.
 *
 * O que uma planilha de balcão tem, e o que se faz com cada coisa:
 *
 * - Máscara de todo jeito, `+55`, `0xx11`, código de operadora — tudo isso é só forma.
 * - **Dois números na mesma célula** ("98765-4321 / 3322-1100"): o segundo vira telefone 2.
 * - **Sem DDD** (8 ou 9 dígitos): ganha o DDD da clínica, e diz que ganhou — é o palpite certo
 *   quase sempre, mas é palpite.
 * - **Celular sem o nono dígito**, anotado antes de 2016: ganha o 9. É o defeito que só
 *   aparece quando a confirmação de véspera não chega (ver `telefoneValido`).
 */
export function lerTelefone(bruto: string, dddDaClinica: string): LeituraDeTelefone {
  const resultado: LeituraDeTelefone = { numeros: [], ajustes: [], padronizou: false }
  const partes = bruto
    .split(/\s*(?:\/|;|\||,|\bou\b|\se\s)\s*/i)
    .map((parte) => parte.trim())
    .filter((parte) => somenteDigitos(parte).length > 0)

  for (const parte of partes) {
    let digitos = somenteDigitos(parte)
    const ajustes: TipoDeAjuste[] = []

    if (digitos.length >= 12 && digitos.startsWith('55')) {
      digitos = digitos.slice(2)
    }

    if (digitos.startsWith('0') && digitos.length >= 11) {
      digitos = digitos.replace(/^0+/, '')

      /* O que sobra com 12 ou 13 dígitos ainda carrega o código da operadora na frente. */
      if (digitos.length === 12 || digitos.length === 13) {
        digitos = digitos.slice(2)
      }
    }

    if (digitos.length === 8 || digitos.length === 9) {
      digitos = dddDaClinica + digitos
      ajustes.push('telefone-ddd-da-clinica')
    }

    /* Os dois podem acontecer juntos: "8888-1234" não tem DDD **e** é celular antigo. */
    if (digitos.length === 10 && /[6-9]/.test(digitos[2]!)) {
      digitos = `${digitos.slice(0, 2)}9${digitos.slice(2)}`
      ajustes.push('telefone-nono-digito')
    }

    if (!telefoneValido(digitos)) {
      resultado.ajustes.push({ tipo: 'telefone-invalido', de: parte, para: null })
      continue
    }

    const formatado = formatarTelefone(digitos)

    if (resultado.numeros.includes(formatado)) {
      continue
    }

    if (ajustes.length > 0) {
      for (const tipo of ajustes) {
        resultado.ajustes.push({ tipo, de: parte, para: formatado })
      }
    } else if (formatado !== parte) {
      resultado.padronizou = true
    }

    resultado.numeros.push(formatado)
  }

  return resultado
}

// -------------------------------------------------------------------- peso

/**
 * Peso em quilos. `4,5`, `4.5 kg`, `4500 g`, `1.250,5`.
 *
 * Grama vira quilo e diz que virou. Peso fora do plausível (acima de 150 kg num animal que não
 * é equino, ou zero) é descartado: dose do bulário sai daqui, e um "350" que era grama viraria
 * dose de cavalo.
 */
export function lerPeso(bruto: string, especie: PetSpecies | null): Leitura<number> {
  const texto = bruto.toLowerCase().replace(/\s+/g, '')

  if (!texto) {
    return { valor: null }
  }

  const emGramas = /\d(g|gr|grs|grama|gramas)$/.test(texto)
  let numero = texto.replace(/(kg|kgs|quilos?|g|gr|grs|gramas?)$/, '')

  if (numero.includes('.') && numero.includes(',')) {
    numero = numero.replace(/\./g, '').replace(',', '.')
  } else {
    numero = numero.replace(',', '.')
  }

  let valor = Number(numero)

  if (!Number.isFinite(valor) || valor <= 0 || !/^\d*\.?\d+$/.test(numero)) {
    return { valor: null, ajuste: 'peso-invalido' }
  }

  if (emGramas) {
    valor /= 1000
  }

  const limite = especie === 'equina' ? 1500 : 150

  if (valor > limite) {
    return { valor: null, ajuste: 'peso-invalido' }
  }

  return {
    valor: Math.round(valor * 100) / 100,
    ajuste: emGramas ? 'peso-em-gramas' : undefined,
    padronizou: !emGramas && texto !== String(valor),
  }
}

// ------------------------------------------------------------------ espécie

const ESPECIES_CERTAS: Record<string, PetSpecies> = {
  cao: 'canina',
  caes: 'canina',
  cachorro: 'canina',
  cachorra: 'canina',
  cadela: 'canina',
  canino: 'canina',
  canina: 'canina',
  can: 'canina',
  dog: 'canina',
  gato: 'felina',
  gata: 'felina',
  felino: 'felina',
  felina: 'felina',
  fel: 'felina',
  cat: 'felina',
  ave: 'ave',
  aves: 'ave',
  passaro: 'ave',
  roedor: 'roedor',
  reptil: 'reptil',
  equino: 'equina',
  equina: 'equina',
  cavalo: 'equina',
  egua: 'equina',
}

/**
 * Nome de bicho que implica a espécie do cadastro. "Provável" porque às vezes a conta é torta:
 * coelho não é roedor, mas é o mais perto que o cadastro tem — e a tela mostra o palpite para
 * alguém discordar.
 */
const ESPECIES_PROVAVEIS: Record<string, PetSpecies> = {
  calopsita: 'ave',
  papagaio: 'ave',
  periquito: 'ave',
  canario: 'ave',
  agapornis: 'ave',
  galinha: 'ave',
  hamster: 'roedor',
  'porquinho da india': 'roedor',
  porquinho: 'roedor',
  chinchila: 'roedor',
  gerbil: 'roedor',
  rato: 'roedor',
  coelho: 'roedor',
  jabuti: 'reptil',
  tartaruga: 'reptil',
  iguana: 'reptil',
  cobra: 'reptil',
  serpente: 'reptil',
  lagarto: 'reptil',
  ponei: 'equina',
  potro: 'equina',
  mula: 'equina',
}

export function lerEspecie(bruto: string): {
  especie: PetSpecies | null
  confianca: Confianca
} {
  const chave = normalizarRotulo(bruto)

  if (ESPECIES_CERTAS[chave]) {
    return { especie: ESPECIES_CERTAS[chave], confianca: 'certa' }
  }

  if (ESPECIES_PROVAVEIS[chave]) {
    return { especie: ESPECIES_PROVAVEIS[chave], confianca: 'provavel' }
  }

  return { especie: null, confianca: 'nenhuma' }
}

/** Raças que só existem numa espécie. SRD fica de fora de propósito: há cão e gato sem raça. */
const RACAS: Array<[PetSpecies, string[]]> = [
  [
    'canina',
    [
      'poodle',
      'shih tzu',
      'yorkshire',
      'labrador',
      'golden',
      'rottweiler',
      'pinscher',
      'lhasa',
      'maltes',
      'bulldog',
      'buldogue',
      'pug',
      'beagle',
      'dachshund',
      'salsicha',
      'border collie',
      'pastor',
      'husky',
      'chow chow',
      'spitz',
      'lulu',
      'schnauzer',
      'boxer',
      'pit bull',
      'pitbull',
      'dobermann',
      'doberman',
      'akita',
      'cocker',
      'basset',
      'chihuahua',
      'jack russell',
      'bichon',
      'weimaraner',
      'dalmata',
      'sao bernardo',
      'fila',
      'bernese',
      'samoieda',
      'shar pei',
      'cane corso',
      'fox paulistinha',
      'terrier',
    ],
  ],
  [
    'felina',
    [
      'siames',
      'persa',
      'maine coon',
      'angora',
      'sphynx',
      'ragdoll',
      'bengal',
      'british',
      'exotico',
      'himalaio',
      'sagrado da birmania',
      'azul russo',
    ],
  ],
  ['ave', ['calopsita', 'periquito', 'papagaio', 'canario', 'agapornis']],
  ['roedor', ['porquinho da india', 'hamster', 'chinchila', 'sirio', 'anao russo']],
  ['reptil', ['jabuti', 'tigre d agua', 'iguana', 'pogona', 'corn snake']],
  ['equina', ['mangalarga', 'crioulo', 'quarto de milha', 'puro sangue', 'campolina']],
]

export function especiePelaRaca(raca: string): PetSpecies | null {
  const alvo = normalizarRotulo(raca)

  if (!alvo) {
    return null
  }

  for (const [especie, nomes] of RACAS) {
    if (nomes.some((nome) => alvo === nome || alvo.startsWith(`${nome} `) || alvo.includes(nome))) {
      return especie
    }
  }

  return null
}

const SEM_RACA = new Set([
  'srd',
  'sem raca',
  'sem raca definida',
  'vira lata',
  'viralata',
  'mestico',
  'misto',
])

function lerRaca(bruto: string): Leitura<string> {
  const texto = bruto.trim()

  if (!texto) {
    return { valor: '' }
  }

  if (SEM_RACA.has(normalizarRotulo(texto))) {
    return { valor: 'SRD', padronizou: texto !== 'SRD' }
  }

  const { valor, mudou } = nomeProprio(texto)

  return { valor, padronizou: mudou }
}

// --------------------------------------------------------------- sexo e sim/não

export function lerSexo(bruto: string): {
  sexo: PetSex | null
  castrado: boolean | null
  reconhecido: boolean
} {
  const texto = normalizarRotulo(bruto)

  if (!texto) {
    return { sexo: null, castrado: null, reconhecido: true }
  }

  const castrado = /castrad|^[mf] ?c$/.test(texto) ? true : null

  if (/^(m|macho|masc|masculino|mc|m c)$/.test(texto) || texto.startsWith('macho')) {
    return { sexo: 'macho', castrado, reconhecido: true }
  }

  if (/^(f|femea|fem|feminino|fc|f c)$/.test(texto) || texto.startsWith('femea')) {
    return { sexo: 'femea', castrado, reconhecido: true }
  }

  return { sexo: null, castrado, reconhecido: false }
}

const SIM = new Set(['sim', 's', 'x', '1', 'true', 'yes', 'y', 'castrado', 'castrada', 'ok', 'v'])
const NAO = new Set(['nao', 'n', '0', 'false', 'no', 'inteiro', 'inteira'])

export function lerSimNao(bruto: string): { valor: boolean | null; reconhecido: boolean } {
  const texto = normalizarRotulo(bruto)

  if (!texto || bruto.trim() === '-') {
    return { valor: null, reconhecido: true }
  }

  if (SIM.has(texto)) {
    return { valor: true, reconhecido: true }
  }

  if (NAO.has(texto)) {
    return { valor: false, reconhecido: true }
  }

  return { valor: null, reconhecido: false }
}

// ------------------------------------------------------ documentos e contato

/**
 * CPF, inclusive o que o Excel estragou.
 *
 * Coluna de CPF salva como número perde o zero da frente: `012.345.678-90` vira `1234567890`,
 * dez dígitos, e é recusado por qualquer validação que conte casas. Os zeros voltam e o CPF é
 * conferido de novo — se fecha os verificadores, era ele.
 */
export function lerCpf(bruto: string): Leitura<string> {
  const digitos = somenteDigitos(bruto)

  if (!digitos) {
    return { valor: null }
  }

  if (digitos.length >= 8 && digitos.length < 11) {
    const completo = digitos.padStart(11, '0')

    return cpfValido(completo)
      ? { valor: formatarCpf(completo), ajuste: 'cpf-zeros' }
      : { valor: null, ajuste: 'cpf-invalido' }
  }

  if (!cpfValido(digitos)) {
    return { valor: null, ajuste: 'cpf-invalido' }
  }

  const valor = formatarCpf(digitos)

  return { valor, padronizou: valor !== bruto.trim() }
}

export function lerCep(bruto: string): Leitura<string> {
  const digitos = somenteDigitos(bruto)

  if (!digitos) {
    return { valor: null }
  }

  if (digitos.length === 7) {
    return { valor: formatarCep(`0${digitos}`), ajuste: 'cep-zero' }
  }

  return digitos.length === 8
    ? { valor: formatarCep(digitos), padronizou: formatarCep(digitos) !== bruto.trim() }
    : { valor: null, ajuste: 'cep-invalido' }
}

export function lerEmail(bruto: string): Leitura<string> {
  const primeiro =
    bruto
      .split(/[;,\s]+/)
      .find(Boolean)
      ?.toLowerCase() ?? ''

  if (!primeiro) {
    return { valor: null }
  }

  return emailValido(primeiro)
    ? { valor: primeiro, padronizou: primeiro !== bruto.trim() }
    : { valor: null, ajuste: 'email-invalido' }
}

/**
 * Número do microchip.
 *
 * O Excel mostra número de quinze dígitos em notação científica (`9,82E+14`) — e, salvo assim
 * em csv, **os últimos dígitos se perdem de verdade**. Não há o que recuperar: o valor é
 * descartado com o motivo, que é também a instrução (exportar a coluna como texto).
 */
export function lerMicrochip(bruto: string): Leitura<string> {
  const texto = bruto.trim()

  if (!texto) {
    return { valor: null }
  }

  if (/\d[.,]?\d*e\+?\d+/i.test(texto)) {
    return { valor: null, ajuste: 'microchip-cientifico' }
  }

  const digitos = somenteDigitos(texto)

  return digitos.length === 15 || digitos.length === 9 || digitos.length === 10
    ? { valor: digitos }
    : { valor: null, ajuste: 'microchip-invalido' }
}

const ESTADOS: Record<string, string> = {
  acre: 'AC',
  alagoas: 'AL',
  amapa: 'AP',
  amazonas: 'AM',
  bahia: 'BA',
  ceara: 'CE',
  'distrito federal': 'DF',
  'espirito santo': 'ES',
  goias: 'GO',
  maranhao: 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  para: 'PA',
  paraiba: 'PB',
  parana: 'PR',
  pernambuco: 'PE',
  piaui: 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  rondonia: 'RO',
  roraima: 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  sergipe: 'SE',
  tocantins: 'TO',
}

export function lerUf(bruto: string): Leitura<string> {
  const texto = bruto.trim()

  if (!texto) {
    return { valor: null }
  }

  const sigla = texto.toUpperCase()

  if ((UFS as readonly string[]).includes(sigla)) {
    return { valor: sigla, padronizou: sigla !== texto }
  }

  const porNome = ESTADOS[normalizarRotulo(texto)]

  return porNome ? { valor: porNome, padronizou: true } : { valor: null, ajuste: 'uf-invalida' }
}

// ------------------------------------------------------ alergia e situação

const SEM_ALERGIA = new Set([
  'nao',
  'n',
  'nenhuma',
  'nenhum',
  'nega',
  'sem alergia',
  'sem alergias',
  'na',
  'n a',
  'nada',
  'nao possui',
  'nao tem',
  'desconhece',
])

export function lerAlergia(bruto: string): string {
  const texto = bruto.trim()

  if (!texto || /^[-–—.]+$/.test(texto) || SEM_ALERGIA.has(normalizarRotulo(texto))) {
    return ''
  }

  return texto
}

/**
 * Animal falecido não entra como paciente.
 *
 * Paciente ativo recebe lembrete de vacina, convite de retorno e mensagem de aniversário — e
 * mandar isso para quem perdeu o animal é o jeito mais rápido de uma importação virar
 * reclamação no primeiro dia.
 */
export function lerFalecido(bruto: string): boolean {
  return /falecid|obito|morto|morta|faleceu|obit|^sim$|^s$/.test(normalizarRotulo(bruto))
}

// ---------------------------------------------------------------------------
// Valores de espécie (o de-para)
// ---------------------------------------------------------------------------

export type ValorDeEspecie = {
  /** Valor normalizado — a chave da escolha. `''` é "em branco". */
  chave: string
  /** Como apareceu pela primeira vez, para a tela mostrar o que a pessoa escreveu. */
  exemplo: string
  ocorrencias: number
  sugestao: PetSpecies | null
  confianca: Confianca
  /** Para o que não foi reconhecido (em branco inclusive): quantas a raça resolve sozinha. */
  pelaRaca: number
}

export type EscolhaDeEspecie = PetSpecies | 'fora'

/**
 * Cada valor diferente da coluna de espécie, com o palpite para ele.
 *
 * É a segunda metade do mapeamento: saber que a coluna é "espécie" não basta se metade dela diz
 * "Hamster" e a outra metade diz "?". Cada valor é decidido uma vez, e vale para todas as
 * linhas que o têm.
 */
export function valoresDeEspecie(
  planilha: PlanilhaLida,
  mapeamento: MapeamentoDaColuna[],
): ValorDeEspecie[] {
  const coluna = mapeamento.find((item) => item.destino === 'especie')?.coluna
  const colunaRaca = mapeamento.find((item) => item.destino === 'raca')?.coluna
  const colunaNome = mapeamento.find((item) => item.destino === 'petNome')?.coluna

  if (coluna === undefined) {
    return []
  }

  const porChave = new Map<string, ValorDeEspecie>()

  for (const linha of planilha.linhas) {
    const bruto = linha[coluna] ?? ''

    /* Linha sem animal nenhum não conta como "espécie em branco". */
    if (!bruto && colunaNome !== undefined && !(linha[colunaNome] ?? '')) {
      continue
    }

    const chave = normalizarRotulo(bruto)
    const existente = porChave.get(chave)

    if (existente) {
      existente.ocorrencias += 1
    } else {
      const lido = lerEspecie(bruto)

      porChave.set(chave, {
        chave,
        exemplo: bruto,
        ocorrencias: 1,
        sugestao: lido.especie,
        confianca: lido.confianca,
        pelaRaca: 0,
      })
    }

    const valor = porChave.get(chave)!

    if (!valor.sugestao && colunaRaca !== undefined && especiePelaRaca(linha[colunaRaca] ?? '')) {
      valor.pelaRaca += 1
    }
  }

  return [...porChave.values()].sort((a, b) => b.ocorrencias - a.ocorrencias)
}

// ---------------------------------------------------------------------------
// Registros: cada linha lida
// ---------------------------------------------------------------------------

export type RascunhoDoResponsavel = {
  nome: string
  telefone: string
  telefoneSecundario: string
  email: string
  documento: string
  endereco: EnderecoPostal | null
}

export type RascunhoDoAnimal = {
  nome: string
  especie: PetSpecies | null
  raca: string
  sexo: PetSex | null
  castrado: boolean
  nascimento: ISODate | null
  pesoKg: number | null
  microchip: string
  pelagem: string
  alergia: string
}

export type RegistroDaLinha = {
  indice: number
  linha: number
  vazia: boolean
  /** `null` quando nenhuma coluna do responsável tem conteúdo nesta linha. */
  responsavel: RascunhoDoResponsavel | null
  /** `null` quando nenhuma coluna do animal tem conteúdo nesta linha. */
  animal: RascunhoDoAnimal | null
  /** A espécie foi mandada para fora pelo de-para (e não só ficou desconhecida). */
  especieFora: boolean
  falecido: boolean
  ajustes: Ajuste[]
}

export type ContextoDaLeitura = {
  hoje: ISODate
  /** DDD da clínica: é o que ganha o telefone anotado sem DDD. */
  ddd: string
  especies: Record<string, EscolhaDeEspecie>
}

export type ResultadoDaLeitura = {
  registros: RegistroDaLinha[]
  padronizacoes: Record<Padronizacao, number>
}

function contadorVazio(): Record<Padronizacao, number> {
  return { telefone: 0, documento: 0, data: 0, peso: 0, nome: 0, especie: 0, uf: 0 }
}

/**
 * Todas as linhas, lidas campo a campo pelo mapeamento.
 *
 * A ordem dentro da linha importa em dois pontos: a espécie vem antes do peso (o teto de peso
 * depende dela) e a data de nascimento antes da idade (idade só entra quando não há data).
 */
export function lerRegistros(
  planilha: PlanilhaLida,
  mapeamento: MapeamentoDaColuna[],
  contexto: ContextoDaLeitura,
): ResultadoDaLeitura {
  const colunaDe = new Map<CampoDeDestino, number>()

  for (const item of mapeamento) {
    if (item.destino) {
      colunaDe.set(item.destino, item.coluna)
    }
  }

  const padronizacoes = contadorVazio()
  const colunaNascimento = colunaDe.get('nascimento')
  const ordem = ordemDasDatas(
    colunaNascimento === undefined
      ? []
      : planilha.linhas.map((linha) => linha[colunaNascimento] ?? ''),
  )

  const registros = planilha.linhas.map((celulas, indice): RegistroDaLinha => {
    const valor = (campo: CampoDeDestino) => {
      const coluna = colunaDe.get(campo)

      return coluna === undefined ? '' : (celulas[coluna] ?? '')
    }
    const veioDeMescla = (campo: CampoDeDestino) => {
      const coluna = colunaDe.get(campo)

      return coluna !== undefined && planilha.mescladas.has(`${indice}:${coluna}`)
    }

    const ajustes: Ajuste[] = []
    const registrar = (
      campo: CampoDeDestino,
      bruto: string,
      leitura: Leitura<unknown>,
      para?: string,
    ) => {
      if (leitura.ajuste) {
        ajustes.push({
          campo,
          tipo: leitura.ajuste,
          de: bruto,
          para: leitura.valor === null ? null : (para ?? String(leitura.valor)),
        })
      }
    }

    const vazia = celulas.every((celula) => celula === '')

    // ------------------------------------------------------------- responsável

    const nomeDoResponsavel = nomeProprio(valor('responsavelNome'))

    if (nomeDoResponsavel.mudou) {
      padronizacoes.nome += 1
    }

    if (veioDeMescla('responsavelNome') && nomeDoResponsavel.valor) {
      ajustes.push({
        campo: 'responsavelNome',
        tipo: 'celula-mesclada',
        de: '',
        para: nomeDoResponsavel.valor,
      })
    }

    const telefones = lerTelefone(valor('telefone'), contexto.ddd)
    const telefones2 = lerTelefone(valor('telefone2'), contexto.ddd)

    for (const [campo, leitura] of [
      ['telefone', telefones],
      ['telefone2', telefones2],
    ] as const) {
      for (const item of leitura.ajustes) {
        ajustes.push({ campo, ...item })
      }

      if (leitura.padronizou) {
        padronizacoes.telefone += 1
      }
    }

    const todos = [
      ...telefones.numeros,
      ...telefones2.numeros.filter((n) => !telefones.numeros.includes(n)),
    ]
    const telefone = todos[0] ?? ''
    const telefoneSecundario = todos[1] ?? ''

    /* O segundo número veio da mesma célula do primeiro, não de uma coluna própria. */
    if (telefones.numeros.length > 1 && telefoneSecundario === telefones.numeros[1]) {
      ajustes.push({
        campo: 'telefone',
        tipo: 'telefone-dividido',
        de: valor('telefone'),
        para: telefoneSecundario,
      })
    }

    const cpf = lerCpf(valor('cpf'))
    registrar('cpf', valor('cpf'), cpf)
    padronizacoes.documento += cpf.padronizou ? 1 : 0

    const email = lerEmail(valor('email'))
    registrar('email', valor('email'), email)

    const cep = lerCep(valor('cep'))
    registrar('cep', valor('cep'), cep)

    const uf = lerUf(valor('uf'))
    registrar('uf', valor('uf'), uf)
    padronizacoes.uf += uf.padronizou ? 1 : 0

    const logradouro = nomeProprio(valor('endereco')).valor
    const bairro = nomeProprio(valor('bairro')).valor
    const cidade = nomeProprio(valor('cidade')).valor
    const numero = valor('numero')

    const temEndereco = Boolean(logradouro || bairro || cidade || cep.valor || uf.valor || numero)
    const endereco: EnderecoPostal | null = temEndereco
      ? {
          cep: cep.valor ?? '',
          logradouro,
          numero,
          complemento: '',
          bairro,
          cidade,
          uf: uf.valor ?? '',
        }
      : null

    /*
     * Responsável é quem tem como ser identificado ou chamado. Cidade e bairro preenchidos
     * sozinhos não são ninguém — são o resto de uma célula mesclada que o csv desfez, e a linha
     * precisa cair na pergunta "é continuação da de cima?" em vez de virar responsável sem nome.
     */
    const temResponsavel = (
      ['responsavelNome', 'telefone', 'telefone2', 'email', 'cpf'] as const
    ).some((campo) => valor(campo) !== '')
    const responsavel: RascunhoDoResponsavel | null = temResponsavel
      ? {
          nome: nomeDoResponsavel.valor,
          telefone,
          telefoneSecundario,
          email: email.valor ?? '',
          documento: cpf.valor ?? '',
          endereco,
        }
      : null

    // ------------------------------------------------------------------ animal

    const nomeDoAnimal = nomeProprio(valor('petNome'))

    if (nomeDoAnimal.mudou) {
      padronizacoes.nome += 1
    }

    const raca = lerRaca(valor('raca'))
    const especieBruta = valor('especie')
    const chaveDaEspecie = normalizarRotulo(especieBruta)
    const escolhida = contexto.especies[chaveDaEspecie]
    const lida = lerEspecie(especieBruta)
    const pelaRaca = especiePelaRaca(raca.valor ?? '')
    let especie: PetSpecies | null = null
    let especieFora = false

    /*
     * A ordem de quem responde pela espécie:
     *
     * - Valor reconhecido na célula ("Cão") — a menos que a pessoa tenha dito outra coisa para
     *   ele no de-para.
     * - A escolha da pessoa para aquele valor ("Bicho" → Canina, ou "?" → deixar de fora).
     * - A raça, quando a célula está em branco ou não diz nada: Poodle só pode ser cão. Vem
     *   **antes** da escolha para o em branco — a escolha é para o que nem a raça resolve.
     */
    if (chaveDaEspecie) {
      if (escolhida === 'fora') {
        especieFora = true
      } else if (escolhida && escolhida !== lida.especie) {
        especie = escolhida
        ajustes.push({
          campo: 'especie',
          tipo: 'especie-escolhida',
          de: especieBruta,
          para: escolhida,
        })
      } else if (lida.especie) {
        especie = lida.especie
        padronizacoes.especie += especieBruta !== especie ? 1 : 0
      }
    }

    if (!especie && !especieFora && pelaRaca) {
      especie = pelaRaca
      ajustes.push({
        campo: 'especie',
        tipo: 'especie-pela-raca',
        de: raca.valor ?? '',
        para: pelaRaca,
      })
    }

    if (!especie && !especieFora && !chaveDaEspecie) {
      const paraOEmBranco = contexto.especies['']

      if (paraOEmBranco === 'fora') {
        especieFora = true
      } else if (paraOEmBranco) {
        especie = paraOEmBranco
        ajustes.push({ campo: 'especie', tipo: 'especie-escolhida', de: '', para: paraOEmBranco })
      }
    }

    const sexo = lerSexo(valor('sexo'))

    if (!sexo.reconhecido) {
      ajustes.push({ campo: 'sexo', tipo: 'nao-reconhecido', de: valor('sexo'), para: null })
    }

    const castradoLido = lerSimNao(valor('castrado'))

    if (!castradoLido.reconhecido) {
      ajustes.push({
        campo: 'castrado',
        tipo: 'nao-reconhecido',
        de: valor('castrado'),
        para: null,
      })
    }

    const nascimento = lerData(valor('nascimento'), { ordem, hoje: contexto.hoje })
    registrar('nascimento', valor('nascimento'), nascimento)
    padronizacoes.data += nascimento.padronizou ? 1 : 0

    let dataDeNascimento = nascimento.valor

    if (!dataDeNascimento && valor('idade')) {
      const idade = lerIdade(valor('idade'), contexto.hoje)
      registrar('idade', valor('idade'), idade)
      dataDeNascimento = idade.valor
    }

    const peso = lerPeso(valor('peso'), especie)
    registrar('peso', valor('peso'), peso, peso.valor === null ? undefined : String(peso.valor))
    padronizacoes.peso += peso.padronizou ? 1 : 0

    const microchip = lerMicrochip(valor('microchip'))
    registrar('microchip', valor('microchip'), microchip)

    const alergia = lerAlergia(valor('alergia'))
    const pelagem = nomeProprio(valor('pelagem')).valor

    const temAnimal = Boolean(
      nomeDoAnimal.valor ||
      especieBruta ||
      raca.valor ||
      valor('sexo') ||
      valor('nascimento') ||
      valor('idade') ||
      valor('peso') ||
      valor('microchip') ||
      pelagem ||
      alergia,
    )

    const animal: RascunhoDoAnimal | null = temAnimal
      ? {
          nome: nomeDoAnimal.valor,
          especie,
          raca: raca.valor ?? '',
          sexo: sexo.sexo,
          /* Sexo "macho castrado" responde pela coluna de castração quando ela não diz nada. */
          castrado: castradoLido.valor ?? sexo.castrado ?? false,
          nascimento: dataDeNascimento,
          pesoKg: peso.valor,
          microchip: microchip.valor ?? '',
          pelagem,
          alergia,
        }
      : null

    return {
      indice,
      linha: linhaNaPlanilha(planilha, indice),
      vazia: vazia || (!responsavel && !animal),
      responsavel,
      animal,
      especieFora,
      falecido: animal !== null && lerFalecido(valor('situacao')),
      ajustes,
    }
  })

  return { registros, padronizacoes }
}

// ---------------------------------------------------------------------------
// O plano: grupos, repetidos, decisões e a situação de cada linha
// ---------------------------------------------------------------------------

export type MotivoDeFora =
  | 'animal-sem-nome'
  | 'animal-sem-responsavel'
  | 'responsavel-sem-nome'
  | 'especie-desconhecida'
  | 'falecido'

export const MOTIVOS_DE_FORA: MotivoDeFora[] = [
  'animal-sem-responsavel',
  'animal-sem-nome',
  'especie-desconhecida',
  'responsavel-sem-nome',
  'falecido',
]

export type TipoDeDecisao =
  | 'responsavel-existente'
  | 'mesma-pessoa'
  | 'orfao'
  | 'animal-repetido'
  | 'animal-existente'

export const TIPOS_DE_DECISAO: TipoDeDecisao[] = [
  'responsavel-existente',
  'mesma-pessoa',
  'animal-existente',
  'animal-repetido',
  'orfao',
]

/**
 * As duas saídas de toda decisão. `juntar` é mesclar (ou, no animal sem responsável, ligar à
 * linha de cima); `manter` é deixar separado (ou, no animal sem responsável, deixar de fora).
 * A tela dá o nome certo a cada uma conforme o tipo.
 */
export type OpcaoDaDecisao = 'juntar' | 'manter'

export type Decisao = {
  id: string
  tipo: TipoDeDecisao
  /**
   * As linhas do lado da planilha — é por elas que a pessoa confere no arquivo. As do outro
   * lado, quando ele também é da planilha, estão em `outro.linhas`.
   */
  linhas: number[]
  motivo: MotivoDeSemelhanca | 'mesmo-nome' | 'linha-anterior' | 'mesmo-animal'
  padrao: OpcaoDaDecisao | null
  escolha: OpcaoDaDecisao | null
  /** O lado da planilha. */
  daPlanilha: { nome: string; telefone: string; documento: string; especie: PetSpecies | null }
  /** O outro lado: o cadastro que já existe, ou o outro grupo/linha da planilha. */
  outro: {
    nome: string
    telefone: string
    documento: string
    especie: PetSpecies | null
    linhas: number[]
    existente: boolean
  }
}

export type SituacaoDaLinha = 'entra' | 'junta' | 'contato' | 'fora' | 'pendente'

export const SITUACOES: SituacaoDaLinha[] = ['entra', 'junta', 'contato', 'pendente', 'fora']

export type AvisoDaLinha = 'sem-contato'

export type ConflitoDaMescla = {
  campo: CampoDeDestino
  mantido: string
  ignorado: string
}

export type Mescla = {
  /** Campos em branco no cadastro que a planilha preenche. */
  preenche: CampoDeDestino[]
  /** Campos em que os dois têm valor e discordam: fica o que já estava. */
  conflitos: ConflitoDaMescla[]
}

export type ItemDoPlano = {
  indice: number
  linha: number
  situacao: SituacaoDaLinha
  /** Grupo de responsável desta linha (a chave é a primeira linha do grupo). */
  grupo: string | null
  /** O responsável como vai entrar — já somado com as outras linhas do mesmo grupo. */
  responsavel: RascunhoDoResponsavel | null
  /**
   * O animal como vai entrar. Na linha principal de um animal repetido, já somado com as
   * repetições; na repetição, os dados da própria linha.
   */
  animal: RascunhoDoAnimal | null
  tutorExistente: { id: string; nome: string } | null
  petExistente: { id: string; nome: string } | null
  /** Este animal é o mesmo da linha indicada, e foi somado a ela. */
  juntaComLinha: number | null
  motivos: MotivoDeFora[]
  ajustes: Ajuste[]
  avisos: AvisoDaLinha[]
  decisoes: string[]
  mesclaDoResponsavel: Mescla | null
  mesclaDoAnimal: Mescla | null
}

export type ContagemDoPlano = {
  linhas: number
  vazias: number
  entram: number
  juntam: number
  contatos: number
  fora: number
  pendentes: number
  comAjuste: number
  comDescarte: number
  responsaveisNovos: number
  responsaveisExistentes: number
  animaisNovos: number
  animaisExistentes: number
}

export type Plano = {
  itens: ItemDoPlano[]
  decisoes: Decisao[]
  contagem: ContagemDoPlano
}

export type BaseAtual = { tutores: Tutor[]; pets: Pet[] }

// ------------------------------------------------------------ união de grupos

class Grupos {
  private pai = new Map<number, number>()

  achar(item: number): number {
    let raiz = item

    while (this.pai.has(raiz) && this.pai.get(raiz) !== raiz) {
      raiz = this.pai.get(raiz)!
    }

    this.pai.set(item, raiz)

    return raiz
  }

  unir(a: number, b: number) {
    const raizA = this.achar(a)
    const raizB = this.achar(b)

    if (raizA !== raizB) {
      /* A raiz é sempre a linha mais antiga: é ela que dá nome ao grupo. */
      this.pai.set(Math.max(raizA, raizB), Math.min(raizA, raizB))
    }
  }
}

function nomeComparavel(nome: string): string {
  return normalizarRotulo(nome)
}

function telefonesDe(responsavel: RascunhoDoResponsavel): string[] {
  return [responsavel.telefone, responsavel.telefoneSecundario].map(somenteDigitos).filter(Boolean)
}

/** Primeiro valor preenchido de cada campo, na ordem das linhas; telefone a mais vira o segundo. */
function somarResponsaveis(rascunhos: RascunhoDoResponsavel[]): RascunhoDoResponsavel {
  const primeiro = (ler: (item: RascunhoDoResponsavel) => string) =>
    rascunhos.map(ler).find((valor) => valor.trim() !== '') ?? ''

  const telefones: string[] = []

  for (const rascunho of rascunhos) {
    for (const numero of [rascunho.telefone, rascunho.telefoneSecundario]) {
      if (numero && !telefones.includes(numero)) {
        telefones.push(numero)
      }
    }
  }

  return {
    nome: primeiro((item) => item.nome),
    telefone: telefones[0] ?? '',
    telefoneSecundario: telefones[1] ?? '',
    email: primeiro((item) => item.email),
    documento: primeiro((item) => item.documento),
    endereco: rascunhos.find((item) => item.endereco)?.endereco ?? null,
  }
}

function textoDoCampoDoAnimal(animal: RascunhoDoAnimal | Pet, campo: CampoDoAnimal): string {
  switch (campo) {
    case 'raca':
      return animal.raca
    case 'sexo':
      return animal.sexo ?? ''
    case 'nascimento':
      return animal.nascimento ?? ''
    case 'peso':
      return animal.pesoKg === null ? '' : String(animal.pesoKg)
    case 'microchip':
      return animal.microchip
    case 'pelagem':
      return animal.pelagem
    default:
      return ''
  }
}

const CAMPOS_QUE_MESCLAM_NO_ANIMAL: CampoDoAnimal[] = [
  'raca',
  'sexo',
  'nascimento',
  'peso',
  'microchip',
  'pelagem',
]

function somarAnimais(
  principal: RascunhoDoAnimal,
  outro: RascunhoDoAnimal,
): {
  animal: RascunhoDoAnimal
  conflitos: ConflitoDaMescla[]
} {
  const conflitos: ConflitoDaMescla[] = []
  const animal = { ...principal }

  for (const campo of CAMPOS_QUE_MESCLAM_NO_ANIMAL) {
    const atual = textoDoCampoDoAnimal(animal, campo)
    const novo = textoDoCampoDoAnimal(outro, campo)

    if (!novo) {
      continue
    }

    if (!atual) {
      if (campo === 'raca') animal.raca = outro.raca
      if (campo === 'sexo') animal.sexo = outro.sexo
      if (campo === 'nascimento') animal.nascimento = outro.nascimento
      if (campo === 'peso') animal.pesoKg = outro.pesoKg
      if (campo === 'microchip') animal.microchip = outro.microchip
      if (campo === 'pelagem') animal.pelagem = outro.pelagem
    } else if (normalizarRotulo(atual) !== normalizarRotulo(novo)) {
      conflitos.push({ campo, mantido: atual, ignorado: novo })
    }
  }

  if (!animal.alergia && outro.alergia) {
    animal.alergia = outro.alergia
  }

  animal.castrado = animal.castrado || outro.castrado

  return { animal, conflitos }
}

/** O que a planilha acrescenta a um paciente que já existe — e onde os dois discordam. */
export function mesclaDoAnimal(existente: Pet, daPlanilha: RascunhoDoAnimal): Mescla {
  const preenche: CampoDeDestino[] = []
  const conflitos: ConflitoDaMescla[] = []

  for (const campo of CAMPOS_QUE_MESCLAM_NO_ANIMAL) {
    const atual = textoDoCampoDoAnimal(existente, campo)
    const novo = textoDoCampoDoAnimal(daPlanilha, campo)

    if (!novo) {
      continue
    }

    if (!atual) {
      preenche.push(campo)
    } else if (normalizarRotulo(atual) !== normalizarRotulo(novo)) {
      conflitos.push({ campo, mantido: atual, ignorado: novo })
    }
  }

  const alergiaNova =
    daPlanilha.alergia &&
    !existente.alertas.some(
      (alerta) =>
        alerta.kind === 'alergia' &&
        normalizarRotulo(alerta.detalhe).includes(normalizarRotulo(daPlanilha.alergia)),
    )

  if (alergiaNova) {
    preenche.push('alergia')
  }

  return { preenche, conflitos }
}

/** O mesmo, para o responsável. Telefone novo não briga com o antigo: vira o segundo, se houver lugar. */
export function mesclaDoResponsavel(existente: Tutor, daPlanilha: RascunhoDoResponsavel): Mescla {
  const preenche: CampoDeDestino[] = []
  const conflitos: ConflitoDaMescla[] = []
  const conhecidos = [existente.telefone, existente.telefoneSecundario].map(somenteDigitos)
  const novos = [daPlanilha.telefone, daPlanilha.telefoneSecundario].filter(
    (numero) => numero && !conhecidos.includes(somenteDigitos(numero)),
  )

  if (novos.length > 0) {
    if (!existente.telefoneSecundario) {
      preenche.push('telefone2')
    } else {
      conflitos.push({ campo: 'telefone', mantido: existente.telefone, ignorado: novos[0]! })
    }
  }

  const pares: Array<[CampoDeDestino, string, string]> = [
    ['email', existente.email, daPlanilha.email],
    ['cpf', existente.documento, daPlanilha.documento],
  ]

  for (const [campo, atual, novo] of pares) {
    if (!novo) {
      continue
    }

    if (!atual) {
      preenche.push(campo)
    } else if (
      somenteDigitos(atual) !== somenteDigitos(novo) &&
      atual.toLowerCase() !== novo.toLowerCase()
    ) {
      conflitos.push({ campo, mantido: atual, ignorado: novo })
    }
  }

  if (!existente.endereco && daPlanilha.endereco) {
    preenche.push('endereco')
  }

  return { preenche, conflitos }
}

type GrupoDeResponsavel = {
  chave: string
  raiz: number
  indices: number[]
  dados: RascunhoDoResponsavel
}

/**
 * O plano inteiro.
 *
 * `escolhas` são as respostas da pessoa, por id de decisão. Decisão sem resposta usa o padrão —
 * e o padrão só existe onde a semelhança é forte (mesmo CPF, mesmo telefone, mesmo animal do
 * mesmo responsável). Onde a semelhança é só o nome, não há padrão: a linha fica **pendente**
 * até alguém olhar, porque juntar duas Marias diferentes mistura prontuários, e separar a mesma
 * Maria parte o histórico em dois.
 */
export function planejar(
  registros: RegistroDaLinha[],
  base: BaseAtual,
  escolhas: Record<string, OpcaoDaDecisao>,
): Plano {
  const decisoes: Decisao[] = []
  const porIndice = new Map(registros.map((registro) => [registro.indice, registro]))
  const motivos = new Map<number, MotivoDeFora[]>()
  const extras = new Map<number, Ajuste[]>()

  const decidir = (decisao: Omit<Decisao, 'escolha'>): OpcaoDaDecisao | null => {
    const escolha = escolhas[decisao.id] ?? decisao.padrao
    decisoes.push({ ...decisao, escolha })

    return escolha
  }

  const marcarFora = (indice: number, motivo: MotivoDeFora) => {
    const lista = motivos.get(indice) ?? []

    if (!lista.includes(motivo)) {
      lista.push(motivo)
    }

    motivos.set(indice, lista)
  }

  const uteis = registros.filter((registro) => !registro.vazia)

  // 1. O que tira a linha antes de qualquer agrupamento.
  for (const registro of uteis) {
    if (registro.animal) {
      if (registro.falecido) {
        marcarFora(registro.indice, 'falecido')
      }

      if (!registro.animal.nome) {
        marcarFora(registro.indice, 'animal-sem-nome')
      }

      if (!registro.animal.especie) {
        marcarFora(registro.indice, 'especie-desconhecida')
      }
    }
  }

  const elegivel = (registro: RegistroDaLinha) => !motivos.has(registro.indice)

  // 2. Responsáveis da planilha que são a mesma pessoa.
  const grupos = new Grupos()
  const comResponsavel = uteis.filter((registro) => registro.responsavel && elegivel(registro))
  const porDocumento = new Map<string, number>()
  const porTelefone = new Map<string, number[]>()
  const porNome = new Map<string, number[]>()

  for (const registro of comResponsavel) {
    const responsavel = registro.responsavel!
    const documento = somenteDigitos(responsavel.documento)
    const nome = nomeComparavel(responsavel.nome)

    grupos.achar(registro.indice)

    if (documento) {
      const anterior = porDocumento.get(documento)

      if (anterior !== undefined) {
        grupos.unir(anterior, registro.indice)
      } else {
        porDocumento.set(documento, registro.indice)
      }
    }

    for (const telefone of telefonesDe(responsavel)) {
      for (const anterior of porTelefone.get(telefone) ?? []) {
        const outro = porIndice.get(anterior)!.responsavel!
        const outroNome = nomeComparavel(outro.nome)

        /* Mesmo telefone só junta se o nome também bate — ou se um dos dois nem tem nome. Casal com o fixo da casa são duas pessoas. */
        if (!nome || !outroNome || nome === outroNome) {
          grupos.unir(anterior, registro.indice)
        }
      }

      porTelefone.set(telefone, [...(porTelefone.get(telefone) ?? []), registro.indice])
    }

    /* Só nome, sem contato para desempatar: junta, mas só nome de duas palavras ou mais. "Ana" é meia clínica. */
    if (nome.split(' ').length >= 2) {
      for (const anterior of porNome.get(nome) ?? []) {
        const outro = porIndice.get(anterior)!.responsavel!
        const semContatoParaComparar =
          telefonesDe(outro).length === 0 || telefonesDe(responsavel).length === 0
        const documentosBrigam =
          outro.documento && responsavel.documento && outro.documento !== responsavel.documento

        if (semContatoParaComparar && !documentosBrigam) {
          grupos.unir(anterior, registro.indice)
        }
      }

      porNome.set(nome, [...(porNome.get(nome) ?? []), registro.indice])
    }
  }

  const montarGrupos = () => {
    const mapa = new Map<number, number[]>()

    for (const registro of comResponsavel) {
      const raiz = grupos.achar(registro.indice)
      mapa.set(raiz, [...(mapa.get(raiz) ?? []), registro.indice])
    }

    return mapa
  }

  /* Decisões presas a linhas, e não a um grupo — as do "mesma pessoa?" valem para os dois lados. */
  const decisoesPorIndice = new Map<number, string[]>()
  const prender = (indices: number[], id: string) => {
    for (const indice of indices) {
      decisoesPorIndice.set(indice, [...(decisoesPorIndice.get(indice) ?? []), id])
    }
  }

  // 2b. Mesmo nome, contatos diferentes: só a pessoa sabe.
  {
    const raizesPorNome = new Map<string, number[]>()
    let atuais = montarGrupos()

    for (const [raiz, indices] of atuais) {
      const dados = somarResponsaveis(indices.map((indice) => porIndice.get(indice)!.responsavel!))
      const nome = nomeComparavel(dados.nome)

      /* Nome de uma palavra só ("Ana") não basta nem para perguntar. */
      if (nome.split(' ').length < 2) {
        continue
      }

      raizesPorNome.set(nome, [...(raizesPorNome.get(nome) ?? []), raiz])
    }

    for (const raizes of raizesPorNome.values()) {
      const [primeira, ...outras] = raizes.sort((a, b) => a - b)

      for (const outra of outras) {
        const indicesA = atuais.get(grupos.achar(primeira!)) ?? []
        const indicesB = atuais.get(grupos.achar(outra)) ?? []
        const a = somarResponsaveis(indicesA.map((indice) => porIndice.get(indice)!.responsavel!))
        const b = somarResponsaveis(indicesB.map((indice) => porIndice.get(indice)!.responsavel!))
        const linhaDe = (indice: number) => porIndice.get(indice)!.linha
        const id = `mesma-pessoa:${linhaDe(primeira!)}:${linhaDe(outra)}`

        prender([...indicesA, ...indicesB], id)

        const escolha = decidir({
          id,
          tipo: 'mesma-pessoa',
          /* Na ordem da planilha: o grupo que aparece primeiro é o "de cá", o outro vem depois. */
          linhas: indicesA.map(linhaDe),
          motivo: 'mesmo-nome',
          padrao: null,
          daPlanilha: { nome: a.nome, telefone: a.telefone, documento: a.documento, especie: null },
          outro: {
            nome: b.nome,
            telefone: b.telefone,
            documento: b.documento,
            especie: null,
            linhas: indicesB.map(linhaDe),
            existente: false,
          },
        })

        if (escolha === 'juntar') {
          grupos.unir(primeira!, outra)
          atuais = montarGrupos()
        }
      }
    }
  }

  // 3. Grupos finais, e cada um contra a base.
  const grupoDe = new Map<number, GrupoDeResponsavel>()
  const tutorExistenteDoGrupo = new Map<string, Tutor>()
  const decisoesDoGrupo = new Map<string, string[]>()

  for (const [raiz, indices] of montarGrupos()) {
    const ordenados = [...indices].sort((a, b) => a - b)
    const dados = somarResponsaveis(ordenados.map((indice) => porIndice.get(indice)!.responsavel!))
    const grupo: GrupoDeResponsavel = {
      chave: `g${porIndice.get(raiz)!.linha}`,
      raiz,
      indices: ordenados,
      dados,
    }

    for (const indice of ordenados) {
      grupoDe.set(indice, grupo)
    }

    if (!dados.nome) {
      for (const indice of ordenados) {
        marcarFora(indice, 'responsavel-sem-nome')
      }

      continue
    }

    const semelhantes = responsaveisSemelhantes(base.tutores, {
      nome: dados.nome,
      telefone: dados.telefone,
      documento: dados.documento,
    })
    /* O segundo número da planilha também pode ser o primeiro do cadastro. */
    const peloSegundo =
      semelhantes.length === 0 && dados.telefoneSecundario
        ? responsaveisSemelhantes(base.tutores, {
            nome: '',
            telefone: dados.telefoneSecundario,
            documento: '',
          })
        : []
    const achado = semelhantes[0] ?? peloSegundo[0]

    if (!achado) {
      continue
    }

    const linhas = ordenados.map((indice) => porIndice.get(indice)!.linha)
    const id = `responsavel-existente:${grupo.chave}:${achado.tutor.id}`
    const escolha = decidir({
      id,
      tipo: 'responsavel-existente',
      linhas,
      motivo: achado.motivo,
      padrao: achado.motivo === 'nome' ? null : 'juntar',
      daPlanilha: {
        nome: dados.nome,
        telefone: dados.telefone,
        documento: dados.documento,
        especie: null,
      },
      outro: {
        nome: achado.tutor.nome,
        telefone: achado.tutor.telefone,
        documento: achado.tutor.documento,
        especie: null,
        linhas: [],
        existente: true,
      },
    })

    decisoesDoGrupo.set(grupo.chave, [id])

    if (escolha === 'juntar') {
      tutorExistenteDoGrupo.set(grupo.chave, achado.tutor)
    }
  }

  // 4. Animal sem responsável: continuação da linha de cima, ou fora.
  const orfaos = new Map<number, string>()

  for (const registro of uteis) {
    if (!registro.animal || registro.responsavel || !elegivel(registro)) {
      continue
    }

    /* Sobe pelas linhas órfãs seguidas até achar quem tem responsável — é a forma de uma célula mesclada que o csv desfez. */
    let anterior = registro.indice - 1

    while (anterior >= 0) {
      const candidato = porIndice.get(anterior)

      if (!candidato || candidato.vazia) {
        anterior = -1
        break
      }

      if (candidato.responsavel) {
        break
      }

      if (!candidato.animal) {
        anterior = -1
        break
      }

      anterior -= 1
    }

    const grupo = anterior >= 0 ? grupoDe.get(anterior) : undefined

    if (!grupo || !grupo.dados.nome) {
      marcarFora(registro.indice, 'animal-sem-responsavel')
      continue
    }

    const id = `orfao:${registro.linha}`
    const escolha = decidir({
      id,
      tipo: 'orfao',
      linhas: [registro.linha],
      motivo: 'linha-anterior',
      padrao: null,
      daPlanilha: {
        nome: registro.animal.nome,
        telefone: '',
        documento: '',
        especie: registro.animal.especie,
      },
      outro: {
        nome: grupo.dados.nome,
        telefone: grupo.dados.telefone,
        documento: grupo.dados.documento,
        especie: null,
        linhas: [porIndice.get(anterior)!.linha],
        existente: false,
      },
    })

    if (escolha === 'juntar') {
      grupoDe.set(registro.indice, grupo)
      orfaos.set(registro.indice, id)
      extras.set(registro.indice, [
        {
          campo: 'responsavelNome',
          tipo: 'responsavel-da-linha-anterior',
          de: '',
          para: grupo.dados.nome,
        },
      ])
    } else if (escolha === 'manter') {
      marcarFora(registro.indice, 'animal-sem-responsavel')
    } else {
      orfaos.set(registro.indice, id)
    }
  }

  // 5. Animais: repetidos dentro do grupo, e contra os pacientes do responsável que já existe.
  const principalDe = new Map<number, number>()
  const animalSomado = new Map<number, RascunhoDoAnimal>()
  const conflitosDaRepeticao = new Map<number, ConflitoDaMescla[]>()
  const petExistenteDe = new Map<number, Pet>()
  const decisoesDoAnimal = new Map<number, string[]>()

  const comAnimal = uteis
    .filter((registro) => registro.animal && elegivel(registro) && grupoDe.has(registro.indice))
    .sort((a, b) => a.indice - b.indice)

  const porGrupoENome = new Map<string, number[]>()

  for (const registro of comAnimal) {
    const grupo = grupoDe.get(registro.indice)!
    const chave = `${grupo.chave}|${nomeComparavel(registro.animal!.nome)}`
    const anteriores = porGrupoENome.get(chave) ?? []
    const mesmo = anteriores.find(
      (indice) => porIndice.get(indice)!.animal!.especie === registro.animal!.especie,
    )

    if (mesmo !== undefined) {
      const principal = porIndice.get(mesmo)!
      const id = `animal-repetido:${principal.linha}:${registro.linha}`
      const escolha = decidir({
        id,
        tipo: 'animal-repetido',
        linhas: [principal.linha, registro.linha],
        motivo: 'mesmo-animal',
        padrao: 'juntar',
        daPlanilha: {
          nome: registro.animal!.nome,
          telefone: grupo.dados.telefone,
          documento: '',
          especie: registro.animal!.especie,
        },
        outro: {
          nome: principal.animal!.nome,
          telefone: grupo.dados.telefone,
          documento: '',
          especie: principal.animal!.especie,
          linhas: [principal.linha],
          existente: false,
        },
      })

      decisoesDoAnimal.set(registro.indice, [id])

      if (escolha === 'juntar') {
        principalDe.set(registro.indice, mesmo)
        const somado = somarAnimais(animalSomado.get(mesmo) ?? principal.animal!, registro.animal!)
        animalSomado.set(mesmo, somado.animal)
        conflitosDaRepeticao.set(registro.indice, somado.conflitos)
        continue
      }
    }

    porGrupoENome.set(chave, [...anteriores, registro.indice])
  }

  for (const registro of comAnimal) {
    if (principalDe.has(registro.indice)) {
      continue
    }

    const grupo = grupoDe.get(registro.indice)!
    const tutor = tutorExistenteDoGrupo.get(grupo.chave)

    if (!tutor) {
      continue
    }

    const animal = animalSomado.get(registro.indice) ?? registro.animal!
    const existente = base.pets.find(
      (pet) =>
        pet.tutorId === tutor.id &&
        nomeComparavel(pet.nome) === nomeComparavel(animal.nome) &&
        pet.especie === animal.especie,
    )

    if (!existente) {
      continue
    }

    const id = `animal-existente:${registro.linha}:${existente.id}`
    const escolha = decidir({
      id,
      tipo: 'animal-existente',
      linhas: [registro.linha],
      motivo: 'mesmo-animal',
      padrao: 'juntar',
      daPlanilha: {
        nome: animal.nome,
        telefone: grupo.dados.telefone,
        documento: '',
        especie: animal.especie,
      },
      outro: {
        nome: existente.nome,
        telefone: tutor.telefone,
        documento: '',
        especie: existente.especie,
        linhas: [],
        existente: true,
      },
    })

    decisoesDoAnimal.set(registro.indice, [...(decisoesDoAnimal.get(registro.indice) ?? []), id])

    if (escolha === 'juntar') {
      petExistenteDe.set(registro.indice, existente)
    }
  }

  // 6. A situação de cada linha.
  const escolhaDe = new Map(decisoes.map((decisao) => [decisao.id, decisao.escolha]))
  const itens: ItemDoPlano[] = []
  const primeiraLinhaDoGrupo = new Set<string>()

  for (const registro of uteis) {
    const grupo = grupoDe.get(registro.indice) ?? null
    const tutor = grupo ? (tutorExistenteDoGrupo.get(grupo.chave) ?? null) : null
    const motivosDaLinha = motivos.get(registro.indice) ?? []
    const principal = principalDe.get(registro.indice)
    const pet = petExistenteDe.get(principal ?? registro.indice) ?? null
    const idsDasDecisoes = [
      ...(decisoesPorIndice.get(registro.indice) ?? []),
      ...(grupo ? (decisoesDoGrupo.get(grupo.chave) ?? []) : []),
      ...(decisoesDoAnimal.get(registro.indice) ?? []),
      ...(orfaos.has(registro.indice) ? [orfaos.get(registro.indice)!] : []),
    ]
    /* Qualquer decisão sem resposta que toque a linha a segura — inclusive a do grupo inteiro. */
    const pendente =
      motivosDaLinha.length === 0 && idsDasDecisoes.some((id) => escolhaDe.get(id) === null)

    let situacao: SituacaoDaLinha

    if (motivosDaLinha.length > 0) {
      situacao = 'fora'
    } else if (pendente) {
      situacao = 'pendente'
    } else if (!registro.animal) {
      situacao = 'contato'
    } else if (principal !== undefined || pet) {
      situacao = 'junta'
    } else {
      situacao = 'entra'
    }

    const responsavel = grupo?.dados ?? registro.responsavel
    const avisos: AvisoDaLinha[] = []

    if (
      situacao !== 'fora' &&
      responsavel &&
      !tutor &&
      !responsavel.telefone &&
      !responsavel.telefoneSecundario &&
      !responsavel.email
    ) {
      avisos.push('sem-contato')
    }

    let mesclaResponsavel: Mescla | null = null

    if (grupo && tutor && situacao !== 'fora' && !primeiraLinhaDoGrupo.has(grupo.chave)) {
      primeiraLinhaDoGrupo.add(grupo.chave)
      mesclaResponsavel = mesclaDoResponsavel(tutor, grupo.dados)
    }

    let mesclaAnimal: Mescla | null = null

    if (principal !== undefined) {
      mesclaAnimal = { preenche: [], conflitos: conflitosDaRepeticao.get(registro.indice) ?? [] }
    } else if (pet) {
      mesclaAnimal = mesclaDoAnimal(pet, animalSomado.get(registro.indice) ?? registro.animal!)
    }

    itens.push({
      indice: registro.indice,
      linha: registro.linha,
      situacao,
      grupo: grupo?.chave ?? null,
      responsavel,
      animal:
        principal !== undefined
          ? registro.animal
          : (animalSomado.get(registro.indice) ?? registro.animal),
      tutorExistente: tutor ? { id: tutor.id, nome: tutor.nome } : null,
      petExistente: pet ? { id: pet.id, nome: pet.nome } : null,
      juntaComLinha: principal !== undefined ? porIndice.get(principal)!.linha : null,
      motivos: motivosDaLinha,
      ajustes: [...(extras.get(registro.indice) ?? []), ...registro.ajustes],
      avisos,
      decisoes: idsDasDecisoes,
      mesclaDoResponsavel: mesclaResponsavel,
      mesclaDoAnimal: mesclaAnimal,
    })
  }

  return { itens, decisoes, contagem: contar(itens, registros) }
}

function contar(itens: ItemDoPlano[], registros: RegistroDaLinha[]): ContagemDoPlano {
  const dentro = itens.filter((item) => item.situacao !== 'fora' && item.situacao !== 'pendente')
  const gruposNovos = new Set<string>()
  const gruposExistentes = new Set<string>()

  for (const item of dentro) {
    if (!item.grupo) {
      continue
    }

    ;(item.tutorExistente ? gruposExistentes : gruposNovos).add(item.grupo)
  }

  return {
    linhas: itens.length,
    vazias: registros.filter((registro) => registro.vazia).length,
    entram: itens.filter((item) => item.situacao === 'entra').length,
    juntam: itens.filter((item) => item.situacao === 'junta').length,
    contatos: itens.filter((item) => item.situacao === 'contato').length,
    fora: itens.filter((item) => item.situacao === 'fora').length,
    pendentes: itens.filter((item) => item.situacao === 'pendente').length,
    comAjuste: dentro.filter((item) => item.ajustes.some((ajuste) => !ehDescarte(ajuste.tipo)))
      .length,
    comDescarte: dentro.filter((item) => item.ajustes.some((ajuste) => ehDescarte(ajuste.tipo)))
      .length,
    responsaveisNovos: gruposNovos.size,
    responsaveisExistentes: gruposExistentes.size,
    animaisNovos: dentro.filter((item) => item.situacao === 'entra').length,
    animaisExistentes: new Set(
      dentro.filter((item) => item.petExistente).map((item) => item.petExistente!.id),
    ).size,
  }
}

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------

/** As linhas que ficaram de fora, agrupadas pelo motivo — a pessoa corrige por motivo, não por linha. */
export function agruparPorMotivo(
  itens: ItemDoPlano[],
): Array<{ motivo: MotivoDeFora; linhas: number[] }> {
  return MOTIVOS_DE_FORA.map((motivo) => ({
    motivo,
    linhas: itens.filter((item) => item.motivos.includes(motivo)).map((item) => item.linha),
  })).filter((grupo) => grupo.linhas.length > 0)
}

/** Os valores que não entraram, agrupados pelo que houve com eles. */
export function agruparDescartes(
  itens: ItemDoPlano[],
): Array<{ tipo: TipoDeAjuste; campo: CampoDeDestino; linhas: number[] }> {
  const grupos = new Map<string, { tipo: TipoDeAjuste; campo: CampoDeDestino; linhas: number[] }>()

  for (const item of itens) {
    if (item.situacao === 'fora') {
      continue
    }

    for (const ajuste of item.ajustes) {
      if (!ehDescarte(ajuste.tipo)) {
        continue
      }

      const chave = `${ajuste.tipo}|${ajuste.campo}`
      const grupo = grupos.get(chave) ?? { tipo: ajuste.tipo, campo: ajuste.campo, linhas: [] }

      if (!grupo.linhas.includes(item.linha)) {
        grupo.linhas.push(item.linha)
      }

      grupos.set(chave, grupo)
    }
  }

  return [...grupos.values()].sort((a, b) => b.linhas.length - a.linhas.length)
}

/**
 * As linhas originais de volta, com uma coluna a mais dizendo o que houve.
 *
 * É o que torna o "ficou de fora" acionável: a pessoa abre o arquivo no Excel, corrige ali
 * mesmo — onde ela já sabe trabalhar — e importa só essas linhas de novo. As colunas são as do
 * arquivo original, na mesma ordem, para a segunda importação cair no mesmo mapeamento.
 */
export function linhasParaRevisar(
  planilha: PlanilhaLida,
  itens: ItemDoPlano[],
  rotulos: { linha: string; oQueHouve: string },
  explicar: (item: ItemDoPlano) => string,
): string[][] {
  return [
    [rotulos.linha, rotulos.oQueHouve, ...planilha.cabecalhos],
    ...itens.map((item) => [
      String(item.linha),
      explicar(item),
      ...(planilha.linhas[item.indice] ?? []),
    ]),
  ]
}
