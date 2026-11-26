/**
 * Os campos do animal da ONG (guia 2.2): o que a gaveta edita, a validação de cada passo e o corpo
 * que vai para a API. Sem Vue: o teste chama direto.
 *
 * - Nome, espécie, dia de chegada e origem da entrada são obrigatórios; "Outra espécie" pede qual.
 * - O corpo nunca leva `tutorId`, `responsavel*` nem `parceiroId` (a API recusa com 400).
 * - Editar manda só o que mudou; a espécie não muda (o PATCH não a aceita).
 */
import type {
  AnimalDaOng,
  AvisoDeManejo,
  EdicaoDoAnimalDaOng,
  NovoAnimalDaOng,
  OrigemDaEntrada,
} from '@/service/parceiro/ong-service'

type Especie = NovoAnimalDaOng['especiePet']
type Sexo = NonNullable<NovoAnimalDaOng['sexo']>
type Porte = NonNullable<NovoAnimalDaOng['porte']>

export type CamposDoAnimal = {
  nome: string
  especie: Especie | null
  especieOutra: string
  sexo: Sexo | null
  castrado: boolean | null
  raca: string
  cor: string
  porte: Porte | null
  /** `AAAA-MM-DD` ou vazio. */
  nascimento: string
  microchip: string
  avisosDeManejo: AvisoDeManejo[]
  /** `AAAA-MM-DD`. */
  entradaEm: string
  origemDaEntrada: OrigemDaEntrada | null
  observacaoInterna: string
  observacaoParaAdotante: string
}

export type ParteDoAnimal = 'animal' | 'chegada' | 'observacoes'

export type ErrosDoAnimal = Partial<Record<keyof CamposDoAnimal, string>>

/** Os campos de cada passo do cadastro, para o erro da API voltar ao passo certo. */
export const CAMPOS_DA_PARTE: Record<ParteDoAnimal, readonly (keyof CamposDoAnimal)[]> = {
  animal: ['nome', 'especie', 'especieOutra', 'sexo', 'castrado', 'raca', 'cor', 'porte'],
  chegada: ['entradaEm', 'origemDaEntrada', 'nascimento', 'microchip', 'avisosDeManejo'],
  observacoes: ['observacaoInterna', 'observacaoParaAdotante'],
}

/** O campo da API com o nome da tela: `dataNascimento` é o `nascimento`, `especiePet` a `especie`. */
const CAMPO_DA_API: Record<string, keyof CamposDoAnimal> = {
  dataNascimento: 'nascimento',
  especiePet: 'especie',
}

export function campoDaTela(campo: string | undefined): keyof CamposDoAnimal | undefined {
  if (!campo) return undefined
  const traduzido = CAMPO_DA_API[campo] ?? campo

  return traduzido in camposVazios('') ? (traduzido as keyof CamposDoAnimal) : undefined
}

export function parteDoCampo(campo: keyof CamposDoAnimal): ParteDoAnimal {
  return (
    (Object.keys(CAMPOS_DA_PARTE) as ParteDoAnimal[]).find((parte) =>
      CAMPOS_DA_PARTE[parte].includes(campo),
    ) ?? 'animal'
  )
}

/** O cadastro novo: a chegada é hoje, que é o caso de quase todo resgate registrado na hora. */
export function camposVazios(hoje: string): CamposDoAnimal {
  return {
    nome: '',
    especie: null,
    especieOutra: '',
    sexo: null,
    castrado: null,
    raca: '',
    cor: '',
    porte: null,
    nascimento: '',
    microchip: '',
    avisosDeManejo: [],
    entradaEm: hoje,
    origemDaEntrada: null,
    observacaoInterna: '',
    observacaoParaAdotante: '',
  }
}

export function camposDoAnimal(animal: AnimalDaOng): CamposDoAnimal {
  const identidade = animal.identidade

  return {
    nome: animal.nome,
    especie: animal.especie,
    especieOutra: animal.especieOutra ?? '',
    sexo: animal.sexo,
    castrado: identidade?.castrado ?? null,
    raca: identidade?.raca ?? '',
    cor: identidade?.cor ?? '',
    porte: identidade?.porte ?? null,
    nascimento: animal.nascimento ?? '',
    microchip: identidade?.microchip ?? '',
    avisosDeManejo: [...(identidade?.avisosDeManejo ?? [])],
    entradaEm: animal.entradaEm,
    origemDaEntrada: animal.origemDaEntrada,
    observacaoInterna: animal.observacaoInterna ?? '',
    observacaoParaAdotante: animal.observacaoParaAdotante ?? '',
  }
}

type Traduzir = (chave: string) => string

/** Os erros de uma parte (ou de todas). Só o obrigatório: o resto a API confere. */
export function validarAnimal(
  campos: CamposDoAnimal,
  t: Traduzir,
  parte?: ParteDoAnimal,
): ErrosDoAnimal {
  const erros: ErrosDoAnimal = {}
  const vale = (p: ParteDoAnimal) => !parte || parte === p

  if (vale('animal')) {
    if (!campos.nome.trim()) erros.nome = t('ong.campos.nomeObrigatorio')
    if (!campos.especie) erros.especie = t('ong.campos.especieObrigatoria')
    if (campos.especie === 'OUTRO' && !campos.especieOutra.trim()) {
      erros.especieOutra = t('ong.campos.especieOutraObrigatoria')
    }
  }

  if (vale('chegada')) {
    if (!campos.entradaEm) erros.entradaEm = t('ong.campos.entradaObrigatoria')
    if (!campos.origemDaEntrada) erros.origemDaEntrada = t('ong.campos.origemObrigatoria')
  }

  return erros
}

const ouNulo = (texto: string) => texto.trim() || null

/** O corpo do `POST`: opcional vazio não vai. */
export function paraCadastrar(campos: CamposDoAnimal): NovoAnimalDaOng {
  const corpo: NovoAnimalDaOng = {
    nome: campos.nome.trim(),
    especiePet: campos.especie as Especie,
    entradaEm: campos.entradaEm,
    origemDaEntrada: campos.origemDaEntrada as OrigemDaEntrada,
  }

  if (campos.especie === 'OUTRO' && campos.especieOutra.trim()) {
    corpo.especieOutra = campos.especieOutra.trim()
  }
  if (campos.sexo) corpo.sexo = campos.sexo
  if (campos.castrado !== null) corpo.castrado = campos.castrado
  if (campos.porte) corpo.porte = campos.porte
  if (campos.nascimento) corpo.dataNascimento = campos.nascimento
  if (campos.avisosDeManejo.length) corpo.avisosDeManejo = [...campos.avisosDeManejo]

  for (const chave of [
    'raca',
    'cor',
    'microchip',
    'observacaoInterna',
    'observacaoParaAdotante',
  ] as const) {
    const valor = ouNulo(campos[chave])
    if (valor) corpo[chave] = valor
  }

  return corpo
}

/** O corpo do `PATCH`: só o que mudou; o opcional apagado vai `null`. */
export function paraEditar(antes: CamposDoAnimal, depois: CamposDoAnimal): EdicaoDoAnimalDaOng {
  const edicao: EdicaoDoAnimalDaOng = {}

  if (depois.nome.trim() !== antes.nome.trim()) edicao.nome = depois.nome.trim()
  if (depois.especie === 'OUTRO' && depois.especieOutra.trim() !== antes.especieOutra.trim()) {
    edicao.especieOutra = ouNulo(depois.especieOutra)
  }
  if (depois.sexo !== antes.sexo) edicao.sexo = depois.sexo
  if (depois.castrado !== antes.castrado) edicao.castrado = depois.castrado
  if (depois.porte !== antes.porte) edicao.porte = depois.porte
  if (depois.nascimento !== antes.nascimento) edicao.dataNascimento = depois.nascimento || null
  if (depois.entradaEm !== antes.entradaEm && depois.entradaEm) edicao.entradaEm = depois.entradaEm
  if (depois.origemDaEntrada !== antes.origemDaEntrada && depois.origemDaEntrada) {
    edicao.origemDaEntrada = depois.origemDaEntrada
  }
  if ([...depois.avisosDeManejo].sort().join(',') !== [...antes.avisosDeManejo].sort().join(',')) {
    edicao.avisosDeManejo = [...depois.avisosDeManejo]
  }

  for (const chave of [
    'raca',
    'cor',
    'microchip',
    'observacaoInterna',
    'observacaoParaAdotante',
  ] as const) {
    if (depois[chave].trim() !== antes[chave].trim()) edicao[chave] = ouNulo(depois[chave])
  }

  return edicao
}
