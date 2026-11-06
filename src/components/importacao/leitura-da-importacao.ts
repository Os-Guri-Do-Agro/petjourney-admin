/**
 * Os códigos do migrador em frases (guia e2, seção 4.5): "as frases são do portal, a partir dos
 * códigos, nos 6 idiomas". O ajuste que a demonstração já sabia dizer usa a frase dela
 * (`clinico.migracao.ajuste.*`, com o "de" e o "para"); o que a v0.3 trouxe de novo mora em
 * `importacao.*`. Todo código tem também um título curto (`importacao.codigo.*`), para quando os
 * detalhes já foram apagados (30 dias depois do fim) e para as contagens do resumo.
 */
import type {
  AjusteDaLinha,
  CampoDaLinha,
  CodigoDaLinha,
  StatusDaImportacao,
} from '@/service/parceiro/importacao-service'

/** O código da API na chave da frase da demonstração (com `{de}` e `{para}`). */
const AJUSTE_DA_DEMONSTRACAO: Partial<Record<CodigoDaLinha, string>> = {
  DATA_ANO_CURTO: 'data-ano-curto',
  DATA_DA_PLANILHA: 'data-da-planilha',
  DATA_AMERICANA: 'data-americana',
  DATA_SEM_DIA: 'data-sem-dia',
  NASCIMENTO_PELA_IDADE: 'nascimento-pela-idade',
  PESO_EM_GRAMAS: 'peso-em-gramas',
  TELEFONE_NONO_DIGITO: 'telefone-nono-digito',
  TELEFONE_SEM_DDD_CORRIGIDO: 'telefone-ddd-da-clinica',
  TELEFONE_DIVIDIDO: 'telefone-dividido',
  CPF_ZEROS: 'cpf-zeros',
  CEP_ZERO: 'cep-zero',
  ESPECIE_PELA_RACA: 'especie-pela-raca',
  ESPECIE_ESCOLHIDA: 'especie-escolhida',
  CELULA_MESCLADA: 'celula-mesclada',
  RESPONSAVEL_DA_LINHA_ANTERIOR: 'responsavel-da-linha-anterior',
  DATA_INVALIDA: 'data-invalida',
  DATA_FUTURA: 'data-futura',
  IDADE_INVALIDA: 'idade-invalida',
  PESO_INVALIDO: 'peso-invalido',
  TELEFONE_INVALIDO: 'telefone-invalido',
  CPF_INVALIDO: 'cpf-invalido',
  EMAIL_INVALIDO: 'email-invalido',
  CEP_INVALIDO: 'cep-invalido',
  UF_INVALIDA: 'uf-invalida',
  MICROCHIP_INVALIDO: 'microchip-invalido',
  MICROCHIP_CIENTIFICO: 'microchip-cientifico',
  SEXO_NAO_RECONHECIDO: 'nao-reconhecido',
  CASTRADO_NAO_RECONHECIDO: 'nao-reconhecido',
}

/** O motivo de fora na chave da demonstração (`clinico.migracao.motivo.*`, com título e ação). */
const FORA_DA_DEMONSTRACAO: Partial<Record<CodigoDaLinha, string>> = {
  ANIMAL_SEM_RESPONSAVEL: 'animal-sem-responsavel',
  ANIMAL_SEM_NOME: 'animal-sem-nome',
  ESPECIE_DESCONHECIDA: 'especie-desconhecida',
  RESPONSAVEL_SEM_NOME: 'responsavel-sem-nome',
  ANIMAL_FALECIDO: 'falecido',
}

/** Por que a linha não entra. */
export const CODIGOS_DE_FORA: readonly CodigoDaLinha[] = [
  'ANIMAL_SEM_RESPONSAVEL',
  'ANIMAL_SEM_NOME',
  'ESPECIE_DESCONHECIDA',
  'RESPONSAVEL_SEM_NOME',
  'ANIMAL_FALECIDO',
  'DEIXADA_DE_FORA',
  'ALVO_INDISPONIVEL',
  'LINHA_EM_BRANCO',
]

/** O valor não entrou e o campo ficou em branco: a linha entra faltando algo. */
export const CODIGOS_DE_DESCARTE: readonly CodigoDaLinha[] = [
  'DATA_INVALIDA',
  'DATA_FUTURA',
  'IDADE_INVALIDA',
  'PESO_INVALIDO',
  'TELEFONE_INVALIDO',
  'CPF_INVALIDO',
  'EMAIL_INVALIDO',
  'CEP_INVALIDO',
  'UF_INVALIDA',
  'MICROCHIP_INVALIDO',
  'MICROCHIP_CIENTIFICO',
  'SEXO_NAO_RECONHECIDO',
  'CASTRADO_NAO_RECONHECIDO',
  'TEXTO_LONGO',
  'TELEFONE_DE_ENCHIMENTO',
  'TELEFONES_A_MAIS',
  'CPF_DE_OUTRO_CADASTRO',
  'ALERTAS_NO_LIMITE',
]

export type Frase = { chave: string; params: Record<string, string | number> }

export type TomDoCodigo = 'fora' | 'descarte' | 'ajuste' | 'aviso'

export function tomDoCodigo(codigo: CodigoDaLinha): TomDoCodigo {
  if (CODIGOS_DE_FORA.includes(codigo)) return 'fora'
  if (CODIGOS_DE_DESCARTE.includes(codigo)) return 'descarte'
  if (codigo === 'SEM_CONTATO' || codigo.startsWith('DIVERGE_')) return 'aviso'
  return 'ajuste'
}

/** O ajuste com o valor de antes e o de depois. `campo` já vem como rótulo. */
export function fraseDoAjuste(
  ajuste: AjusteDaLinha,
  rotulos: { campo: string; para: string },
): Frase {
  const params = { de: ajuste.de, para: rotulos.para, campo: rotulos.campo }

  if (ajuste.tipo === 'ESPECIE_ESCOLHIDA' && !ajuste.de.trim()) {
    return { chave: 'clinico.migracao.ajuste.especie-escolhida-branco', params }
  }

  const daDemonstracao = AJUSTE_DA_DEMONSTRACAO[ajuste.tipo]
  if (daDemonstracao) return { chave: `clinico.migracao.ajuste.${daDemonstracao}`, params }

  return { chave: `importacao.ajuste.${ajuste.tipo}`, params }
}

/** O título curto de qualquer código: para o relatório sem detalhe e para as contagens. */
export function tituloDoCodigo(codigo: CodigoDaLinha): string {
  const fora = FORA_DA_DEMONSTRACAO[codigo]
  return fora ? `clinico.migracao.motivo.${fora}.titulo` : `importacao.codigo.${codigo}`
}

/** Os campos que a demonstração não tinha (o código do sistema anterior e o complemento). */
const CAMPOS_NOVOS: readonly CampoDaLinha[] = ['complemento', 'codigoCliente', 'codigoAnimal']

export function chaveDoCampo(campo: CampoDaLinha): string {
  return CAMPOS_NOVOS.includes(campo)
    ? `importacao.campo.${campo}`
    : `clinico.migracao.campo.${campo}`
}

const ESPECIES = new Set([
  'CACHORRO',
  'GATO',
  'AVE',
  'ROEDOR',
  'COELHO',
  'PEIXE',
  'REPTIL',
  'OUTRO',
])

/**
 * O "para" vem como a API guarda (o enum da espécie, a data ISO, só os dígitos do telefone, do CPF
 * e do CEP, o peso com ponto): vira o que a ficha mostra.
 */
export function paraLegivel(
  para: string | null | undefined,
  campo: CampoDaLinha,
  formatos: {
    especie: (valor: string) => string
    data: (iso: string) => string
    telefone: (digitos: string) => string
    peso: (quilos: number) => string
  },
): string {
  if (!para) return ''
  if (ESPECIES.has(para)) return formatos.especie(para)
  if (/^\d{4}-\d{2}-\d{2}$/.test(para)) return formatos.data(para)
  if ((campo === 'telefone' || campo === 'telefone2') && /^\d{10,13}$/.test(para)) {
    return formatos.telefone(para)
  }
  if (campo === 'cpf' && /^\d{11}$/.test(para)) {
    return para.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
  }
  if (campo === 'cep' && /^\d{8}$/.test(para)) return para.replace(/^(\d{5})(\d{3})$/, '$1-$2')
  if (campo === 'peso' && /^\d+(\.\d+)?$/.test(para)) return formatos.peso(Number(para))
  return para
}

/** Os status que a tela agrupa: o servidor trabalhando sozinho, parado à espera, ou acabado. */
export function faseDoStatus(
  status: StatusDaImportacao,
): 'recebendo' | 'duvidas' | 'pronta' | 'andando' | 'parada' | 'fim' {
  switch (status) {
    case 'RECEBENDO_LINHAS':
      return 'recebendo'
    case 'COM_DUVIDAS':
      return 'duvidas'
    case 'PRONTA':
      return 'pronta'
    case 'PROCESSANDO':
    case 'DESFAZENDO':
      return 'andando'
    case 'PAUSADA':
    case 'FALHOU':
      return 'parada'
    default:
      return 'fim'
  }
}

/** O erro do job que veio do desfazer: o "continuar" retoma o desfazer, não a gravação. */
export function erroDoDesfazer(ultimoErro: string | null | undefined) {
  return Boolean(ultimoErro?.startsWith('DESFAZER_'))
}
