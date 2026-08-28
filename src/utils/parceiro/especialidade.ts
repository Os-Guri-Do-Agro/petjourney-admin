/**
 * Área de atuação de quem escreveu a anotação (`profissionalEspecialidade`).
 *
 * O valor guardado é a CHAVE do enum quando o profissional escolhe uma das opções da
 * lista, e o TEXTO LIVRE quando escolhe "Outra". Não é enum fechado no banco, e isso é
 * decisão: "Fisioterapia" e "Acupuntura" são casos legítimos, e um enum transformaria
 * cada um deles num 400.
 *
 * Quem traduz é o CLIENTE, no locale do leitor. O backend nunca sabe o rótulo, então
 * `CARDIOLOGIA` jamais pode chegar cru na tela.
 */

export const ESPECIALIDADES = [
  'CLINICO_GERAL',
  'CARDIOLOGIA',
  'DERMATOLOGIA',
  'ORTOPEDIA',
  'OFTALMOLOGIA',
  'ODONTOLOGIA',
  'NEUROLOGIA',
  'ONCOLOGIA',
  'ENDOCRINOLOGIA',
  'GASTROENTEROLOGIA',
  'CIRURGIA',
  'ANIMAIS_EXOTICOS',
] as const

export type EspecialidadeConhecida = (typeof ESPECIALIDADES)[number]

/** Marcador só do formulário: "Outra" nunca é gravado, o texto livre é. */
export const ESPECIALIDADE_OUTRA = 'OUTRA'

/** Escolha possível no formulário: uma da lista, "Outra", ou nada. */
export type EscolhaEspecialidade = EspecialidadeConhecida | typeof ESPECIALIDADE_OUTRA | null

export function isEspecialidadeConhecida(valor: string): valor is EspecialidadeConhecida {
  return (ESPECIALIDADES as readonly string[]).includes(valor)
}

/**
 * O que vai no fio. `undefined` quando não há nada a mandar, para o campo NÃO entrar no
 * multipart: mandar string vazia diria ao backend que a área é "".
 */
export function valorEspecialidade(
  escolha: EscolhaEspecialidade,
  textoLivre: string,
  limite: number,
): string | undefined {
  if (escolha === null) {
    return undefined
  }

  if (escolha !== ESPECIALIDADE_OUTRA) {
    return escolha
  }

  return textoLivre.trim().slice(0, limite) || undefined
}

/**
 * Rótulo para a tela. Chave conhecida vira texto traduzido; qualquer outra coisa é o
 * texto livre do profissional e sai como ele escreveu.
 *
 * Devolve `null` quando não há área, e é assim que a linha do autor sai sem parênteses
 * em anotação antiga, em vez de com "(null)".
 */
export function rotuloEspecialidade(
  valor: string | null | undefined,
  traduzir: (chave: EspecialidadeConhecida) => string,
): string | null {
  const bruto = valor?.trim()

  if (!bruto) {
    return null
  }

  return isEspecialidadeConhecida(bruto) ? traduzir(bruto) : bruto
}

/**
 * O servidor guardou a área?
 *
 * A rota de anotação é multipart e NÃO passa pela `ValidationPipe`, então campo
 * desconhecido é ignorado em silêncio: não existe 400 para escutar. O único jeito de
 * saber é comparar o que foi mandado com o que voltou na resposta do POST, e a API
 * devolve o campo justamente para isso.
 *
 * Sem esta conferência, contra um servidor antigo o parceiro preenche a área, vê a
 * anotação salva e nunca descobre que ela não foi guardada.
 */
export function servidorGuardouEspecialidade(
  enviado: string | undefined,
  recebido: string | null | undefined,
): boolean {
  if (!enviado) {
    return true
  }

  return (recebido ?? '').trim() === enviado.trim()
}
