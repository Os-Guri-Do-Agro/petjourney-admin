/**
 * O trabalho em campo do protótipo de Saúde pública (17/11/2026): quem a equipe atende no Consultório
 * Móvel do piloto e nas campanhas, com o cadastro do tutor e do pet como no módulo clínico, o
 * resultado de cada procedimento (feito, ou não e por quê) e o lugar (CEP, bairro e região) que
 * alimenta o relatório por bairro, região ou CEP.
 *
 * - **Lugar**: o CEP diz o bairro oficial (tabela de CEPs reais do OpenStreetMap cruzados com os
 *   bairros do IBGE, `mapa/ceps.json`); sem o CEP na tabela, vale o bairro que o ViaCEP devolve, se
 *   ele bater com um dos 74; senão, quem cadastra escolhe. A região sai do bairro.
 * - **Cadastro**: o responsável (tutor ou ONG) com os campos do cliente do módulo clínico, e cada pet
 *   com os campos do paciente. Fica na sessão, como o resto da demonstração.
 * - **Registros**: os dos 90 dias são **ilustrativos**, gerados sempre iguais a partir dos números
 *   que o protótipo já tem (412 atendimentos do piloto e os atendidos de cada campanha encerrada),
 *   com um CEP real do bairro de cada um. Os da sessão entram por cima, e o resultado anotado depois
 *   (o "anotar resultado") vale para os dois.
 * - **Equipe** (17/11/2026, "relatório da equipe"): cada atendimento tem quem atendeu (`equipeId`) e
 *   quem fez o cadastro e a acolhida (`cadastroId`), da `EQUIPE` de exemplo. Nos dos 90 dias, o
 *   sorteio é próprio (pelo id do atendimento), para não mudar os números que já existiam:
 *   castração, consulta e exame com quem é veterinário; vacina, coleira e microchip com auxiliar ou
 *   agente; sempre de quem trabalha naquela frente (Consultório Móvel ou campanhas).
 */
import { computed, ref } from 'vue'

import {
  camposVazios,
  clienteVazio,
  type CamposDoCliente,
  type CamposDoPaciente,
} from '@/components/cadastro/campos'
import {
  BAIRROS,
  CAMPANHAS,
  PILOTO,
  PROCEDIMENTO_DA_CAMPANHA,
  PROCEDIMENTOS,
  REGIOES,
  motivosDo,
  EQUIPE,
  frenteDaOrigem,
  funcao,
  quemAtendeNa,
  quemCadastraNa,
  situacaoDoAtendimento,
  somarDias,
  type AtendimentoDoPiloto,
  type Campanha,
  type IdDaRegiao,
  type FrenteDaEquipe,
  type FuncaoNaEquipe,
  type MotivoDeNaoFeito,
  type PessoaDaEquipe,
  type Procedimento,
  type ResultadoDoProcedimento,
  type SituacaoDoAtendimento,
} from '@/features/saude-publica/dados'
import { useEstadoDoPrototipo } from '@/features/saude-publica/estado'
import ceps from '@/features/saude-publica/mapa/ceps.json'
import type { Especie } from '@/features/saude-publica/serie'

/* =================================================================================== o lugar */

/** Os CEPs reais de cada bairro oficial (73 dos 74; a Chácara dos Poderes não tem endereço). */
export const CEPS_DO_BAIRRO = ceps.bairros as Record<string, string[]>
/** A rua de alguns CEPs, para o endereço dos exemplos. */
const RUA_DO_CEP = ceps.ruas as Record<string, string>

const BAIRRO_DO_CEP = new Map(
  Object.entries(CEPS_DO_BAIRRO).flatMap(([bairro, lista]) => lista.map((cep) => [cep, bairro])),
)

export function digitosDoCep(valor: string | null | undefined) {
  return (valor ?? '').replace(/\D/g, '')
}

/** `79094000` → `79094-000`; prefixo curto fica como está, com o traço depois do quinto. */
export function cepNaTela(valor: string | null | undefined) {
  const d = digitosDoCep(valor)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

const semAcento = (texto: string) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

const NOMES_OFICIAIS = BAIRROS.map((bairro) => ({
  nome: bairro.nome,
  chave: semAcento(bairro.nome),
}))
  /* O nome mais comprido primeiro: "Centro-Oeste" antes de "Centro". */
  .sort((um, outro) => outro.chave.length - um.chave.length)

/**
 * O bairro oficial a partir do nome que o ViaCEP devolve ("Conjunto Aero Rancho", "Vila Nasser",
 * "Jardim Centenário"): o nome oficial que aparece inteiro nele. Nada parecido, `null`.
 */
export function bairroPeloNome(texto: string | null | undefined): string | null {
  const alvo = semAcento(texto ?? '')
  if (!alvo) return null
  const exato = NOMES_OFICIAIS.find((item) => item.chave === alvo)
  if (exato) return exato.nome
  const contido = NOMES_OFICIAIS.find((item) =>
    new RegExp(`(^|[^a-z])${item.chave.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(
      alvo,
    ),
  )
  return contido?.nome ?? null
}

export function bairroDoCep(cep: string | null | undefined): string | null {
  return BAIRRO_DO_CEP.get(digitosDoCep(cep)) ?? null
}

export function regiaoDoBairro(nome: string | null | undefined): IdDaRegiao | null {
  return BAIRROS.find((bairro) => bairro.nome === nome)?.regiao ?? null
}

/** Os 74 bairros oficiais em ordem alfabética, para a escolha à mão. */
export const BAIRROS_EM_ORDEM = BAIRROS.map((bairro) => bairro.nome).sort((um, outro) =>
  um.localeCompare(outro, 'pt'),
)

/** De onde veio o bairro oficial: do CEP, do nome do ViaCEP, ou escolhido por quem cadastrou. */
export type ComoAchouOBairro = 'cep' | 'nome' | 'escolhido'

export type Lugar = {
  /** Só os dígitos. */
  cep: string | null
  bairro: string | null
  regiao: IdDaRegiao | null
  como: ComoAchouOBairro | null
}

/** O lugar de um endereço: o CEP manda; sem ele na tabela, o nome do bairro. */
export function lugarDoEndereco(cep: string, bairroDoViaCep: string): Lugar {
  const digitos = digitosDoCep(cep)
  const peloCep = bairroDoCep(digitos)
  const bairro = peloCep ?? bairroPeloNome(bairroDoViaCep)
  return {
    cep: digitos.length === 8 ? digitos : null,
    bairro,
    regiao: regiaoDoBairro(bairro),
    como: peloCep ? 'cep' : bairro ? 'nome' : null,
  }
}

/* ================================================================================ o cadastro */

/** Quem leva o animal: o tutor, ou uma ONG (com o nome dela e o CNPJ, se informado). */
export type ResponsavelDoCampo = {
  id: string
  quem: 'tutor' | 'ong'
  ong: string
  /** Letras e números, sem máscara (o CNPJ alfanumérico também vale). Opcional. */
  cnpj: string
  /** Os campos do cliente do módulo clínico: nome, CPF, telefone, e-mail e endereço. */
  campos: CamposDoCliente
  lugar: Lugar
}

export type PetDoCampo = {
  id: string
  responsavelId: string
  /** Os campos do paciente do módulo clínico. */
  campos: CamposDoPaciente
}

function exemploDeResponsavel(
  id: string,
  quem: 'tutor' | 'ong',
  nome: string,
  extra: Partial<CamposDoCliente> & { bairro: string; indiceDoCep?: number; ong?: string },
): ResponsavelDoCampo {
  const cep = CEPS_DO_BAIRRO[extra.bairro]?.[extra.indiceDoCep ?? 0] ?? ''
  const campos: CamposDoCliente = {
    ...clienteVazio(),
    nome,
    cep: cepNaTela(cep),
    logradouro: RUA_DO_CEP[cep] ?? '',
    cidade: 'Campo Grande',
    uf: 'MS',
    ...extra,
  }
  return {
    id,
    quem,
    ong: extra.ong ?? '',
    cnpj: '',
    campos,
    lugar: { cep, bairro: extra.bairro, regiao: regiaoDoBairro(extra.bairro), como: 'cep' },
  }
}

function exemploDePet(
  id: string,
  responsavelId: string,
  campos: Partial<CamposDoPaciente>,
): PetDoCampo {
  return { id, responsavelId, campos: { ...camposVazios(), ...campos } }
}

/* Exemplos para a busca do balcão: quem já foi atendido volta sem redigitar. Nomes de exemplo. */
const RESPONSAVEIS_DE_EXEMPLO: ResponsavelDoCampo[] = [
  exemploDeResponsavel('r1', 'tutor', 'Maria Aparecida Souza', {
    bairro: 'Aero Rancho',
    cpf: '529.982.247-25',
    telefone: '(67) 99812-3456',
    numero: '145',
  }),
  exemploDeResponsavel('r2', 'tutor', 'João Pereira Lima', {
    bairro: 'Aero Rancho',
    indiceDoCep: 3,
    telefone: '(67) 99654-2210',
    numero: '38',
  }),
  exemploDeResponsavel('r3', 'ong', 'Ana Ribeiro', {
    bairro: 'Centro-Oeste',
    ong: 'Abrigo Ipê (exemplo)',
    telefone: '(67) 99701-8844',
    numero: '1200',
  }),
]

const PETS_DE_EXEMPLO: PetDoCampo[] = [
  exemploDePet('p1', 'r1', {
    nome: 'Thor',
    especie: 'CACHORRO',
    raca: 'SRD',
    sexo: 'MACHO',
    nascimento: '2022-03-01',
    nascimentoEstimado: true,
    castrado: false,
    porte: 'MEDIO',
    pesoKg: 14,
    pelagem: 'Caramelo',
  }),
  exemploDePet('p2', 'r1', {
    nome: 'Mimi',
    especie: 'GATO',
    raca: 'SRD',
    sexo: 'FEMEA',
    nascimento: '2023-06-01',
    nascimentoEstimado: true,
    castrado: true,
    porte: 'PEQUENO',
    pesoKg: 3.6,
    pelagem: 'Tricolor',
  }),
  exemploDePet('p3', 'r2', {
    nome: 'Faísca',
    especie: 'CACHORRO',
    raca: 'SRD',
    sexo: 'FEMEA',
    castrado: null,
    porte: 'PEQUENO',
    pelagem: 'Preta',
  }),
  exemploDePet('p4', 'r3', {
    nome: 'Bolinha',
    especie: 'CACHORRO',
    raca: 'SRD',
    sexo: 'MACHO',
    castrado: true,
    porte: 'MEDIO',
    pelagem: 'Branca e marrom',
  }),
]

const responsaveis = ref<ResponsavelDoCampo[]>([...RESPONSAVEIS_DE_EXEMPLO])
const pets = ref<PetDoCampo[]>([...PETS_DE_EXEMPLO])

/**
 * A busca do balcão: pelo CPF ou telefone (os dígitos, a partir de 4), pelo CNPJ, ou pelo nome do
 * tutor ou da ONG (a partir de 3 letras).
 */
export function buscarResponsaveis(texto: string): ResponsavelDoCampo[] {
  const digitos = texto.replace(/\D/g, '')
  const palavras = semAcento(texto)
  if (digitos.length < 4 && palavras.length < 3) return []
  return responsaveis.value.filter((item) => {
    if (digitos.length >= 4) {
      const documentos = [item.campos.cpf, item.campos.telefone, item.cnpj].map((valor) =>
        valor.replace(/\D/g, ''),
      )
      if (documentos.some((valor) => valor.includes(digitos))) return true
    }
    return (
      palavras.length >= 3 &&
      [item.campos.nome, item.ong].some((nome) => semAcento(nome).includes(palavras))
    )
  })
}

/* ============================================================================== os registros */

/** De onde veio o atendimento: o Consultório Móvel do piloto, ou uma campanha (o id dela). */
export type OrigemDoRegistro = 'piloto' | string

export type EspecieDoRegistro = 'CACHORRO' | 'GATO' | 'OUTRO'

export type RegistroDeCampo = {
  id: string
  origem: OrigemDoRegistro
  /** `AAAA-MM-DD` */
  data: string
  /** `HH:MM` */
  hora: string
  animal: string
  especie: EspecieDoRegistro
  /** Só as iniciais: o relatório não identifica ninguém. */
  tutor: string
  cep: string | null
  bairro: string | null
  regiao: IdDaRegiao | null
  resultados: ResultadoDoProcedimento[]
  responsavelId?: string
  petId?: string
  /** Quem da equipe atendeu (fez ou tentou os procedimentos). */
  equipeId?: string
  /** Quem da equipe fez o cadastro e a acolhida. */
  cadastroId?: string
}

/* ------------------------------------------------------------------- gerador de exemplos */

/** Sorteio que dá sempre o mesmo resultado para a mesma semente (mulberry32). */
function sorteador(semente: number) {
  let estado = semente >>> 0
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0
    let t = estado
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function sementeDe(texto: string) {
  let h = 2166136261
  for (const ch of texto) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function escolherPesado<T>(sortear: () => number, itens: readonly T[], peso: (item: T) => number) {
  const total = itens.reduce((soma, item) => soma + peso(item), 0)
  let alvo = sortear() * total
  for (const item of itens) {
    alvo -= peso(item)
    if (alvo <= 0) return item
  }
  return itens[itens.length - 1]!
}

const NOMES = [
  'Thor',
  'Mel',
  'Luna',
  'Bob',
  'Nina',
  'Pipoca',
  'Pretinha',
  'Max',
  'Amora',
  'Fred',
  'Belinha',
  'Toby',
  'Lola',
  'Bidu',
  'Frida',
  'Chico',
  'Mia',
  'Zeca',
  'Pandora',
  'Rex',
  'Jade',
  'Paçoca',
  'Bento',
  'Lua',
  'Kiara',
  'Tobias',
  'Maya',
  'Simba',
  'Docinho',
  'Pingo',
  'Fumaça',
  'Sol',
  'Tigrão',
  'Branca',
  'Nego',
  'Princesa',
  'Duque',
  'Flor',
  'Café',
  'Jujuba',
]
const LETRAS = 'ABCDEFGIJLMNPRSTV'

function iniciaisSorteadas(sortear: () => number) {
  const letra = () => LETRAS[Math.floor(sortear() * LETRAS.length)]
  return `${letra()}. ${letra()}.`
}

function horaSorteada(sortear: () => number) {
  const minutos = 8 * 60 + Math.floor(sortear() * (8.5 * 60))
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
}

/** Quanto de cada tipo de campanha dá certo, e por que o resto não deu (pesos ilustrativos). */
const PERFIL_DA_CAMPANHA: Record<
  Procedimento,
  { taxa: number; caes: number; motivos: Partial<Record<MotivoDeNaoFeito, number>> }
> = {
  castracao: {
    taxa: 0.8,
    caes: 0.55,
    motivos: { faltou: 5, 'prenhe-cio': 3, 'sem-jejum': 3, doente: 2, 'idade-peso': 1, recusou: 1 },
  },
  antirrabica: {
    taxa: 0.95,
    caes: 0.65,
    motivos: { 'ja-em-dia': 4, agitado: 3, 'sem-insumo': 2, doente: 1, 'idade-peso': 1 },
  },
  coleira: {
    taxa: 0.93,
    caes: 1,
    motivos: { 'ja-em-dia': 4, 'sem-insumo': 3, agitado: 2, 'idade-peso': 1 },
  },
  exame: {
    taxa: 0.9,
    caes: 1,
    motivos: { agitado: 4, recusou: 2, doente: 1, 'ja-em-dia': 2, 'sem-insumo': 1 },
  },
  consulta: { taxa: 0.97, caes: 0.65, motivos: { agitado: 2, recusou: 1 } },
  microchip: { taxa: 0.96, caes: 0.65, motivos: { agitado: 2, 'sem-insumo': 1 } },
}

function resultadoSorteado(
  sortear: () => number,
  procedimento: Procedimento,
  feito: boolean,
): ResultadoDoProcedimento {
  if (feito) return { procedimento, feito: true }
  const pesos = PERFIL_DA_CAMPANHA[procedimento].motivos
  const validos = motivosDo(procedimento).filter((item) => pesos[item.id])
  const escolhido = escolherPesado(sortear, validos, (item) => pesos[item.id] ?? 0)
  return { procedimento, feito: false, motivo: escolhido.id }
}

function lugarSorteado(
  sortear: () => number,
  bairro: string,
): Pick<RegistroDeCampo, 'cep' | 'bairro' | 'regiao'> {
  const lista = CEPS_DO_BAIRRO[bairro] ?? []
  const cep = lista.length ? lista[Math.floor(sortear() * lista.length)]! : null
  return { cep, bairro, regiao: regiaoDoBairro(bairro) }
}

/**
 * Os atendimentos de cada campanha encerrada: tantas tentativas quanto o número de atendidos pede,
 * com exatamente os atendidos da campanha dando certo; o bairro sai das regiões dela, pesado pelos
 * animais de cada bairro.
 */
function registrosDaCampanhaEncerrada(campanha: Campanha): RegistroDeCampo[] {
  const procedimento = PROCEDIMENTO_DA_CAMPANHA[campanha.tipo]
  const perfil = PERFIL_DA_CAMPANHA[procedimento]
  const sortear = sorteador(sementeDe(campanha.id))
  const feitos = campanha.atendidos ?? 0
  const tentativas = Math.round(feitos / perfil.taxa)
  const bairros = BAIRROS.filter((bairro) => campanha.regioes.includes(bairro.regiao))

  /* Quais tentativas não deram: espalhadas pelo dia, sempre as mesmas. */
  const naoDeu = new Set<number>()
  while (naoDeu.size < tentativas - feitos) naoDeu.add(Math.floor(sortear() * tentativas))

  return Array.from({ length: tentativas }, (_, indice) => {
    const especie: EspecieDoRegistro = sortear() < perfil.caes ? 'CACHORRO' : 'GATO'
    const bairro = escolherPesado(sortear, bairros, (item) =>
      especie === 'GATO' ? item.gatos : item.caes,
    )
    return {
      id: `${campanha.id}-${indice + 1}`,
      origem: campanha.id,
      data: campanha.data,
      hora: horaSorteada(sortear),
      animal: NOMES[Math.floor(sortear() * NOMES.length)]!,
      especie,
      tutor: iniciaisSorteadas(sortear),
      ...lugarSorteado(sortear, bairro.nome),
      resultados: [resultadoSorteado(sortear, procedimento, !naoDeu.has(indice))],
    }
  })
}

/** Os procedimentos de um atendimento do Consultório Móvel: um ou dois, os comuns mais vezes. */
function procedimentosSorteados(sortear: () => number): Procedimento[] {
  const comuns: [Procedimento, number][] = [
    ['antirrabica', 0.55],
    ['castracao', 0.4],
    ['coleira', 0.35],
    ['microchip', 0.2],
    ['consulta', 0.15],
    ['exame', 0.1],
  ]
  const escolhidos = comuns.filter(([, chance]) => sortear() < chance).map(([id]) => id)
  return escolhidos.length ? escolhidos.slice(0, 3) : ['antirrabica']
}

/**
 * Os atendimentos do piloto que não estão na lista da tela: completam os 412 do período, no bairro
 * do piloto, espalhados de 13/01 até a véspera de hoje.
 */
function registrosDoPilotoGerados(quantos: number): RegistroDeCampo[] {
  const sortear = sorteador(sementeDe('piloto'))
  const dias = 46
  return Array.from({ length: quantos }, (_, indice) => {
    const procedimentos = procedimentosSorteados(sortear)
    const especie: EspecieDoRegistro = sortear() < 0.68 ? 'CACHORRO' : 'GATO'
    return {
      id: `piloto-${indice + 1}`,
      origem: 'piloto',
      data: somarDias(PILOTO.inicio, Math.floor(sortear() * dias)),
      hora: horaSorteada(sortear),
      animal: NOMES[Math.floor(sortear() * NOMES.length)]!,
      especie,
      tutor: iniciaisSorteadas(sortear),
      ...lugarSorteado(sortear, PILOTO.bairro),
      resultados: procedimentos.map((id) =>
        resultadoSorteado(sortear, id, sortear() < (id === 'castracao' ? 0.9 : 0.96)),
      ),
    }
  })
}

/* ------------------------------------------------------------------------- a equipe */

/**
 * Os procedimentos que pedem quem é veterinário; o resto, auxiliar ou agente. O exame de
 * leishmaniose (a coleta para o teste rápido) é do agente de zoonoses.
 */
const DO_VETERINARIO: Procedimento[] = ['castracao', 'consulta']

/**
 * Quem atendeu e quem cadastrou, sorteado pelo id do atendimento (sempre igual, e sem mexer no
 * sorteio dos outros campos): da frente certa, e da função que o procedimento pede.
 */
function equipeSorteada(
  registro: Pick<RegistroDeCampo, 'id' | 'origem' | 'resultados'>,
): Pick<RegistroDeCampo, 'equipeId' | 'cadastroId'> {
  const frente = frenteDaOrigem(registro.origem)
  const sortear = sorteador(sementeDe(`${registro.id}:equipe`))
  const quem = quemAtendeNa(frente)
  const pedeVeterinario = registro.resultados.some((item) =>
    DO_VETERINARIO.includes(item.procedimento),
  )
  const certos = quem.filter((pessoa) =>
    pedeVeterinario ? pessoa.funcao === 'veterinario' : pessoa.funcao !== 'veterinario',
  )
  const lista = certos.length ? certos : quem
  const cadastro = quemCadastraNa(frente)
  return {
    equipeId: lista[Math.floor(sortear() * lista.length)]?.id,
    cadastroId: cadastro[Math.floor(sortear() * cadastro.length)]?.id,
  }
}

/** O registro com quem atendeu e quem cadastrou: o que veio gravado vale; o que falta, sorteado. */
function comEquipe(registro: RegistroDeCampo): RegistroDeCampo {
  if (registro.equipeId && registro.cadastroId) return registro
  const sorteada = equipeSorteada(registro)
  return {
    ...registro,
    equipeId: registro.equipeId ?? sorteada.equipeId,
    cadastroId: registro.cadastroId ?? sorteada.cadastroId,
  }
}

/** A última pessoa escolhida em "Quem atendeu", por frente: o registro seguinte já vem com ela. */
const ultimoQueAtendeu = ref<Partial<Record<FrenteDaEquipe, string>>>({})

const {
  atendimentos: atendimentosDoPiloto,
  cadastros,
  atualizarAtendimento,
} = useEstadoDoPrototipo()

const GERADOS: RegistroDeCampo[] = [
  ...CAMPANHAS.filter((campanha) => campanha.situacao === 'encerrada').flatMap(
    registrosDaCampanhaEncerrada,
  ),
  ...registrosDoPilotoGerados(PILOTO.atendimentos - atendimentosDoPiloto.value.length),
].map(comEquipe)

/* --------------------------------------------------------------------------- a sessão */

/** Os atendimentos registrados na apresentação, nas campanhas. */
const daSessao = ref<RegistroDeCampo[]>([])
/** O resultado anotado depois, por id: vale por cima do que o registro trouxe. */
const anotados = ref<Record<string, ResultadoDoProcedimento[]>>({})

/** O atendimento da lista do piloto como registro de campo: o lugar vem do cadastro, se houver. */
function doPiloto(atendimento: AtendimentoDoPiloto): RegistroDeCampo {
  const cadastro = cadastros.value[atendimento.id] as
    | { responsavelId?: string; petId?: string; equipeId?: string }
    | undefined
  const responsavel = responsaveis.value.find((item) => item.id === cadastro?.responsavelId)
  const sortear = sorteador(sementeDe(atendimento.id))
  const lugar = responsavel?.lugar.bairro
    ? {
        cep: responsavel.lugar.cep,
        bairro: responsavel.lugar.bairro,
        regiao: responsavel.lugar.regiao,
      }
    : lugarSorteado(sortear, PILOTO.bairro)
  return {
    id: atendimento.id,
    origem: 'piloto',
    data: atendimento.data,
    hora: horaSorteada(sortear),
    animal: atendimento.animal,
    especie: atendimento.especie,
    tutor: atendimento.tutor,
    ...lugar,
    resultados:
      atendimento.resultados ??
      atendimento.procedimentos.map((procedimento) => ({ procedimento, feito: true })),
    responsavelId: cadastro?.responsavelId,
    petId: cadastro?.petId,
    equipeId: cadastro?.equipeId,
  }
}

/** Todos os atendimentos em campo: os dos 90 dias, os da lista do piloto e os da sessão. */
const registros = computed<RegistroDeCampo[]>(() =>
  [
    ...GERADOS,
    ...atendimentosDoPiloto.value.map((item) => comEquipe(doPiloto(item))),
    ...daSessao.value.map(comEquipe),
  ].map((registro) =>
    anotados.value[registro.id]
      ? { ...registro, resultados: anotados.value[registro.id]! }
      : registro,
  ),
)

export function situacaoDoRegistro(
  registro: Pick<RegistroDeCampo, 'resultados'>,
): SituacaoDoAtendimento {
  return situacaoDoAtendimento(registro.resultados)
}

/* ============================================================================== o relatório */

export type Agrupamento = 'regiao' | 'bairro' | 'cep'

export type FiltroDoRelatorio = {
  /** `null` = todos; `'piloto'`; `'campanhas'` (todas); ou o id de uma campanha. */
  origem: string | null
  /** `AAAA-MM-DD`, os dois inclusive. */
  de: string
  ate: string
  regioes: IdDaRegiao[]
  bairros: string[]
  /** CEP inteiro (8 dígitos) ou o começo dele (de 3 a 7 dígitos: "79094" pega a faixa). */
  ceps: string[]
  especie: Especie
  situacao: SituacaoDoAtendimento | null
  /** Pessoas da equipe: o atendimento entra se uma delas atendeu ou cadastrou. Vazia, todos. */
  equipe?: string[]
}

/** O CEP confere com algum da lista: igual, ou começando pelo prefixo. Lista vazia, todos. */
export function cepConfere(cep: string | null, lista: readonly string[]) {
  if (!lista.length) return true
  if (!cep) return false
  return lista.some((item) => {
    const alvo = digitosDoCep(item)
    return alvo.length === 8 ? cep === alvo : alvo.length >= 3 && cep.startsWith(alvo)
  })
}

export function registrosDoRelatorio(filtro: FiltroDoRelatorio): RegistroDeCampo[] {
  return registros.value.filter((registro) => {
    if (filtro.origem === 'campanhas' && registro.origem === 'piloto') return false
    if (filtro.origem && filtro.origem !== 'campanhas' && registro.origem !== filtro.origem) {
      return false
    }
    if (registro.data < filtro.de || registro.data > filtro.ate) return false
    if (filtro.regioes.length && (!registro.regiao || !filtro.regioes.includes(registro.regiao))) {
      return false
    }
    if (filtro.bairros.length && (!registro.bairro || !filtro.bairros.includes(registro.bairro))) {
      return false
    }
    if (!cepConfere(registro.cep, filtro.ceps)) return false
    if (filtro.especie === 'caes' && registro.especie !== 'CACHORRO') return false
    if (filtro.especie === 'gatos' && registro.especie !== 'GATO') return false
    if (filtro.situacao && situacaoDoRegistro(registro) !== filtro.situacao) return false
    if (
      filtro.equipe?.length &&
      !filtro.equipe.some((id) => id === registro.equipeId || id === registro.cadastroId)
    ) {
      return false
    }
    return true
  })
}

export type ResumoDosRegistros = {
  total: number
  realizados: number
  parciais: number
  naoRealizados: number
  /** Percentual dos atendimentos em que tudo foi feito. */
  taxa: number
  procedimentos: { procedimento: Procedimento; feitos: number; naoFeitos: number }[]
  motivos: { motivo: MotivoDeNaoFeito; vezes: number }[]
}

export function resumirRegistros(lista: readonly RegistroDeCampo[]): ResumoDosRegistros {
  let realizados = 0
  let parciais = 0
  const porProcedimento = new Map<Procedimento, { feitos: number; naoFeitos: number }>()
  const porMotivo = new Map<MotivoDeNaoFeito, number>()

  for (const registro of lista) {
    const situacao = situacaoDoRegistro(registro)
    if (situacao === 'realizado') realizados += 1
    if (situacao === 'parcial') parciais += 1
    for (const resultado of registro.resultados) {
      const conta = porProcedimento.get(resultado.procedimento) ?? { feitos: 0, naoFeitos: 0 }
      if (resultado.feito) conta.feitos += 1
      else conta.naoFeitos += 1
      porProcedimento.set(resultado.procedimento, conta)
      if (!resultado.feito && resultado.motivo) {
        porMotivo.set(resultado.motivo, (porMotivo.get(resultado.motivo) ?? 0) + 1)
      }
    }
  }

  return {
    total: lista.length,
    realizados,
    parciais,
    naoRealizados: lista.length - realizados - parciais,
    taxa: lista.length ? Math.round((realizados / lista.length) * 100) : 0,
    procedimentos: PROCEDIMENTOS.filter((item) => porProcedimento.has(item.id)).map((item) => ({
      procedimento: item.id,
      ...porProcedimento.get(item.id)!,
    })),
    motivos: [...porMotivo.entries()]
      .map(([motivo, vezes]) => ({ motivo, vezes }))
      .sort((um, outro) => outro.vezes - um.vezes),
  }
}

export type LinhaDoRelatorio = ResumoDosRegistros & {
  chave: string
  /** O nome da região, do bairro, ou o CEP na tela. */
  rotulo: string
  /** Onde a linha fica: a região do bairro, ou o bairro e a região do CEP. */
  onde: string
}

/** Uma linha por região, bairro ou CEP, da com mais atendimentos para a com menos. */
export function agruparRegistros(
  lista: readonly RegistroDeCampo[],
  por: Agrupamento,
): LinhaDoRelatorio[] {
  const grupos = new Map<string, RegistroDeCampo[]>()
  for (const registro of lista) {
    const chave =
      por === 'regiao' ? registro.regiao : por === 'bairro' ? registro.bairro : registro.cep
    const certa = chave ?? 'sem'
    grupos.set(certa, [...(grupos.get(certa) ?? []), registro])
  }

  const nomeDaRegiao = (id: IdDaRegiao | null) =>
    REGIOES.find((regiao) => regiao.id === id)?.nome ?? 'Região não informada'

  return [...grupos.entries()]
    .map(([chave, itens]) => {
      const primeiro = itens[0]!
      const semLugar = chave === 'sem'
      const rotulo = semLugar
        ? por === 'cep'
          ? 'Sem CEP'
          : 'Sem bairro informado'
        : por === 'regiao'
          ? nomeDaRegiao(primeiro.regiao)
          : por === 'bairro'
            ? chave
            : cepNaTela(chave)
      const onde =
        semLugar || por === 'regiao'
          ? ''
          : por === 'bairro'
            ? nomeDaRegiao(primeiro.regiao)
            : `${primeiro.bairro ?? 'Bairro não informado'} · ${nomeDaRegiao(primeiro.regiao)}`
      return { chave, rotulo, onde, ...resumirRegistros(itens) }
    })
    .sort((um, outro) => outro.total - um.total || um.rotulo.localeCompare(outro.rotulo, 'pt'))
}

/* ================================================================ o relatório da equipe */

/** A pessoa entrou no atendimento: atendeu, ou fez o cadastro e a acolhida. */
export function participou(pessoa: Pick<PessoaDaEquipe, 'id'>, registro: RegistroDeCampo) {
  return registro.equipeId === pessoa.id || registro.cadastroId === pessoa.id
}

export type LinhaDaEquipe = ResumoDosRegistros & {
  pessoa: PessoaDaEquipe
  /** Onde a pessoa trabalhou no recorte. */
  frentes: FrenteDaEquipe[]
  /** Quantos dias diferentes ela teve atendimento no recorte. */
  dias: number
  /** Atendimentos por dia em campo, com uma casa. */
  mediaPorDia: number
  porOrigem: { origem: string; total: number; realizados: number; taxa: number }[]
  porDia: { data: string; total: number; realizados: number }[]
}

/** Uma linha por pessoa que entrou em algum atendimento do recorte. */
export function resumirEquipe(lista: readonly RegistroDeCampo[]): LinhaDaEquipe[] {
  const porPessoa = new Map<string, RegistroDeCampo[]>()
  for (const registro of lista) {
    for (const id of new Set([registro.equipeId, registro.cadastroId])) {
      if (id) porPessoa.set(id, [...(porPessoa.get(id) ?? []), registro])
    }
  }

  return EQUIPE.filter((pessoa) => porPessoa.has(pessoa.id)).map((pessoa) => {
    const itens = porPessoa.get(pessoa.id)!
    const datas = new Map<string, { total: number; realizados: number }>()
    const origens = new Map<string, { total: number; realizados: number }>()
    for (const registro of itens) {
      const feito = situacaoDoRegistro(registro) === 'realizado'
      const dia = datas.get(registro.data) ?? { total: 0, realizados: 0 }
      dia.total += 1
      dia.realizados += Number(feito)
      datas.set(registro.data, dia)
      const origem = origens.get(registro.origem) ?? { total: 0, realizados: 0 }
      origem.total += 1
      origem.realizados += Number(feito)
      origens.set(registro.origem, origem)
    }
    const frentes = [...new Set(itens.map((registro) => frenteDaOrigem(registro.origem)))]
    return {
      pessoa,
      ...resumirRegistros(itens),
      frentes: (['piloto', 'campanhas'] as const).filter((frente) => frentes.includes(frente)),
      dias: datas.size,
      mediaPorDia: Math.round((itens.length / Math.max(1, datas.size)) * 10) / 10,
      porOrigem: [...origens.entries()]
        .map(([origem, conta]) => ({
          origem,
          ...conta,
          taxa: Math.round((conta.realizados / conta.total) * 100),
        }))
        .sort((uma, outra) => outra.total - uma.total),
      porDia: [...datas.entries()]
        .map(([data, conta]) => ({ data, ...conta }))
        .sort((um, outro) => outro.data.localeCompare(um.data)),
    }
  })
}

export type LinhaDaFuncao = {
  funcao: FuncaoNaEquipe
  pessoas: number
  atendimentos: number
  realizados: number
  taxa: number
}

/** Os totais por função, na ordem das funções. */
export function resumirFuncoes(linhas: readonly LinhaDaEquipe[]): LinhaDaFuncao[] {
  return (['veterinario', 'auxiliar', 'agente', 'cadastro'] as const)
    .map((id) => {
      const daFuncao = linhas.filter((linha) => linha.pessoa.funcao === id)
      const atendimentos = daFuncao.reduce((soma, linha) => soma + linha.total, 0)
      const realizados = daFuncao.reduce((soma, linha) => soma + linha.realizados, 0)
      return {
        funcao: funcao(id).id,
        pessoas: daFuncao.length,
        atendimentos,
        realizados,
        taxa: atendimentos ? Math.round((realizados / atendimentos) * 100) : 0,
      }
    })
    .filter((linha) => linha.pessoas)
}

/* ============================================================================== as ações */

export function useCampo() {
  /** Grava o responsável novo, ou o que mudou num já cadastrado; devolve o id. */
  function salvarResponsavel(dados: Omit<ResponsavelDoCampo, 'id'> & { id?: string }) {
    const id = dados.id ?? `r${responsaveis.value.length + 1}`
    const novo = { ...dados, id }
    responsaveis.value = responsaveis.value.some((item) => item.id === id)
      ? responsaveis.value.map((item) => (item.id === id ? novo : item))
      : [novo, ...responsaveis.value]
    return id
  }

  /** Grava o pet novo, ou o que mudou no cadastro dele; devolve o id. */
  function salvarPet(dados: Omit<PetDoCampo, 'id'> & { id?: string }) {
    const id = dados.id ?? `p${pets.value.length + 1}`
    const novo = { ...dados, id }
    pets.value = pets.value.some((item) => item.id === id)
      ? pets.value.map((item) => (item.id === id ? novo : item))
      : [novo, ...pets.value]
    return id
  }

  function petsDo(responsavelId: string) {
    return pets.value.filter((pet) => pet.responsavelId === responsavelId)
  }

  function responsavel(id: string | undefined) {
    return responsaveis.value.find((item) => item.id === id) ?? null
  }

  function pet(id: string | undefined) {
    return pets.value.find((item) => item.id === id) ?? null
  }

  /**
   * O atendimento da equipe numa campanha, no dia dela: o lugar sai do cadastro do responsável.
   * Devolve o id, para a tela abrir o atendimento.
   */
  function registrarNaCampanha(
    campanha: Campanha,
    dados: {
      responsavelId: string
      petId: string
      resultados: ResultadoDoProcedimento[]
      hora?: string
      /** Quem da equipe atendeu; sem ele, sai do sorteio da frente. */
      equipeId?: string
    },
  ) {
    const dono = responsavel(dados.responsavelId)
    const animal = pet(dados.petId)
    const especie = animal?.campos.especie
    const id = `${campanha.id}-n${daSessao.value.length + 1}`
    const agora = new Date()
    daSessao.value = [
      {
        id,
        origem: campanha.id,
        data: campanha.data,
        hora:
          dados.hora ??
          `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`,
        animal: animal?.campos.nome || 'Sem nome',
        especie: especie === 'CACHORRO' || especie === 'GATO' ? especie : 'OUTRO',
        tutor: iniciaisDe(dono?.quem === 'ong' ? dono.ong : dono?.campos.nome),
        cep: dono?.lugar.cep ?? null,
        bairro: dono?.lugar.bairro ?? null,
        regiao: dono?.lugar.regiao ?? null,
        resultados: dados.resultados,
        responsavelId: dados.responsavelId,
        petId: dados.petId,
        equipeId: dados.equipeId,
        cadastroId: quemCadastraNa('campanhas')[0]?.id,
      },
      ...daSessao.value,
    ]
    return id
  }

  /** Guarda quem atendeu, para o próximo registro da mesma frente já vir com a pessoa. */
  function lembrarQuemAtendeu(frente: FrenteDaEquipe, equipeId: string) {
    ultimoQueAtendeu.value = { ...ultimoQueAtendeu.value, [frente]: equipeId }
  }

  /**
   * O resultado anotado depois do atendimento ("conseguiu ou não, e por quê"). No atendimento da
   * lista do piloto, grava nele (as metas e a ficha leem dali); nos outros, por cima do registro.
   */
  function anotarResultado(id: string, resultados: ResultadoDoProcedimento[]) {
    if (atendimentosDoPiloto.value.some((item) => item.id === id)) {
      atualizarAtendimento(id, { resultados })
      return
    }
    anotados.value = { ...anotados.value, [id]: resultados }
  }

  /** Os atendimentos de uma campanha, do mais recente para o mais antigo. */
  function registrosDaCampanha(id: string) {
    return registros.value
      .filter((registro) => registro.origem === id)
      .sort((um, outro) => outro.hora.localeCompare(um.hora))
  }

  return {
    responsaveis,
    pets,
    registros,
    salvarResponsavel,
    salvarPet,
    petsDo,
    responsavel,
    pet,
    registrarNaCampanha,
    anotarResultado,
    registrosDaCampanha,
    ultimoQueAtendeu,
    lembrarQuemAtendeu,
  }
}

/** "Maria Aparecida Souza" → "M. S.": o tutor na lista sem o nome inteiro. */
export function iniciaisDe(nome: string | null | undefined) {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean)
  if (!partes.length) return '—'
  const primeira = partes[0]![0]!.toUpperCase()
  const ultima = partes.length > 1 ? partes[partes.length - 1]![0]!.toUpperCase() : ''
  return ultima ? `${primeira}. ${ultima}.` : `${primeira}.`
}
