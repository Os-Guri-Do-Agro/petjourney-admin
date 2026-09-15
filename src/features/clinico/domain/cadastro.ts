/**
 * Cadastro de paciente e de responsável: o que vale, o que já existe e o que falta.
 *
 * O módulo tinha um cadastro só — o de balcão, feito no meio de um agendamento, que pede o
 * mínimo para o atendimento acontecer. Ele continua certo para o que faz. O que faltava era o
 * outro momento: o responsável **na frente do balcão**, com documento na mão, quando a clínica
 * pode perguntar tudo de uma vez e não vai ter outra chance tão boa.
 *
 * Três regras moram aqui porque nenhuma delas é de tela:
 *
 * - **Documento errado é pior que documento em branco.** Um CPF inválido no cadastro só aparece
 *   na hora de emitir a nota, semanas depois, com o responsável longe. Os dígitos verificadores
 *   são conferidos aqui, e só quando alguém preencheu: exigir CPF de quem liga para marcar é
 *   ensinar a recepção a digitar `111.111.111-11`.
 * - **Cadastro repetido é o defeito mais caro deste fluxo.** Cliente antigo com bicho novo que
 *   vira segundo responsável leva junto o histórico partido em dois: as faltas não somam, a
 *   vacina vencida fica no cadastro errado e a cobrança sai duplicada. Por isso a semelhança é
 *   procurada **antes** de salvar, por documento, telefone e nome.
 * - **Alerta tem gravidade padrão, e ela não é opinião.** Alergia medicamentosa e paciente
 *   imunossuprimido nascem em risco; comorbidade e uso contínuo, em atenção. Quem cadastra pode
 *   mudar — mas o padrão certo é o que faz o alerta existir no dia corrido.
 *
 * Nada aqui conhece Vue, i18n ou repositório: o erro sai como `kind`, e a tela traduz.
 */

import type { AlertSeverity, PetAlertKind, Tutor } from '../data/types'

/** Estados brasileiros. Lista fechada porque UF livre vira `sp`, `S.P.` e `São Paulo`. */
export const UFS = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
] as const

export type UF = (typeof UFS)[number]

/**
 * Gravidade com que cada alerta nasce.
 *
 * O cadastro pode subir ou descer — dipirona em cão que teve reação leve não é o mesmo caso de
 * anafilaxia por amoxicilina, e o módulo guarda os dois como `alergia`. O que o padrão garante é
 * que ninguém precise **decidir** gravidade para registrar uma alergia com pressa.
 */
export const SEVERIDADE_PADRAO: Record<PetAlertKind, AlertSeverity> = {
  alergia: 'risco',
  agressivo: 'risco',
  imunossuprimido: 'risco',
  cronico: 'atencao',
  'medicacao-continua': 'atencao',
  gestante: 'atencao',
  inadimplente: 'info',
}

/** Ordem em que os alertas aparecem no cadastro: os que mudam conduta primeiro. */
export const ALERTAS_DO_CADASTRO: PetAlertKind[] = [
  'alergia',
  'medicacao-continua',
  'cronico',
  'imunossuprimido',
  'agressivo',
  'gestante',
  'inadimplente',
]

export function somenteDigitos(valor: string): string {
  return valor.replace(/\D/g, '')
}

function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

// ---------------------------------------------------------------------------
// Formatação — sempre sobre o que já foi digitado, nunca adivinhando o resto
// ---------------------------------------------------------------------------

/**
 * Máscara progressiva: formata o que existe e não inventa o que falta.
 *
 * Máscara que completa com zeros, ou que trava o cursor no fim do campo, atrapalha justamente
 * quem está corrigindo o meio de um número ditado por telefone.
 */
export function formatarTelefone(valor: string): string {
  const digitos = somenteDigitos(valor).slice(0, 11)

  if (digitos.length <= 2) {
    return digitos
  }

  /* Até 10 dígitos o prefixo tem 4; o nono dígito do celular empurra o corte para 5. */
  const corte = digitos.length <= 10 ? 6 : 7
  const ddd = `(${digitos.slice(0, 2)})`
  const prefixo = digitos.slice(2, corte)
  const sufixo = digitos.slice(corte)

  return sufixo ? `${ddd} ${prefixo}-${sufixo}` : `${ddd} ${prefixo}`
}

export function formatarCpf(valor: string): string {
  const digitos = somenteDigitos(valor).slice(0, 11)
  const corpo = [digitos.slice(0, 3), digitos.slice(3, 6), digitos.slice(6, 9)]
    .filter(Boolean)
    .join('.')
  const verificador = digitos.slice(9)

  return verificador ? `${corpo}-${verificador}` : corpo
}

export function formatarCep(valor: string): string {
  const digitos = somenteDigitos(valor).slice(0, 8)

  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos
}

// ---------------------------------------------------------------------------
// Validação
// ---------------------------------------------------------------------------

/**
 * CPF pelos dígitos verificadores.
 *
 * Os onze dígitos iguais passam na conta dos verificadores e são recusados à parte — é a
 * sequência que alguém digita justamente para vencer um campo obrigatório.
 */
export function cpfValido(valor: string): boolean {
  const digitos = somenteDigitos(valor)

  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) {
    return false
  }

  const verificador = (ate: number) => {
    let soma = 0

    for (let i = 0; i < ate; i += 1) {
      soma += Number(digitos[i]) * (ate + 1 - i)
    }

    const resto = (soma * 10) % 11

    return resto === 10 ? 0 : resto
  }

  return verificador(9) === Number(digitos[9]) && verificador(10) === Number(digitos[10])
}

/**
 * Telefone brasileiro: fixo com 10 dígitos, celular com 11 e nono dígito `9`.
 *
 * O que a contagem sozinha não pega, e esta função pega: **o celular anotado sem o nono dígito**.
 * Ele fica com 10 dígitos e passa por fixo em qualquer validação que só conte casas — e só
 * aparece semanas depois, quando a confirmação de véspera sai por mensagem e não chega a lugar
 * nenhum. A diferença está no primeiro dígito do número: assinante fixo começa em 2 a 5, celular
 * começa em 9.
 */
export function telefoneValido(valor: string): boolean {
  const digitos = somenteDigitos(valor)
  const primeiroDoNumero = Number(digitos[2])

  if (digitos[0] === '0') {
    return false
  }

  if (digitos.length === 10) {
    return primeiroDoNumero >= 2 && primeiroDoNumero <= 5
  }

  return digitos.length === 11 && digitos[2] === '9'
}

export function emailValido(valor: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(valor.trim())
}

export function cepValido(valor: string): boolean {
  return somenteDigitos(valor).length === 8
}

// ---------------------------------------------------------------------------
// Semelhança — o cadastro repetido que já existe
// ---------------------------------------------------------------------------

/** Por que dois cadastros parecem a mesma pessoa. O motivo vai junto: a tela precisa dizê-lo. */
export type MotivoDeSemelhanca = 'documento' | 'telefone' | 'nome'

export type ResponsavelSemelhante = {
  tutor: Tutor
  motivo: MotivoDeSemelhanca
}

/**
 * Quem já está cadastrado e parece ser esta pessoa.
 *
 * A ordem dos motivos é a ordem da confiança: **documento** é identidade, **telefone** é quase,
 * e **nome** é só indício — dois "Ana Paula Souza" numa clínica de bairro acontecem. Por isso o
 * nome sozinho nunca bloqueia nada: ele existe para a tela perguntar, não para decidir.
 *
 * O telefone compara os dígitos do número inteiro, já que `(11) 98422-1030` e `11984221030` são
 * o mesmo número escrito por duas pessoas diferentes — e olha também o número secundário, que é
 * onde o telefone da casa costuma estar nos dois cadastros.
 */
export function responsaveisSemelhantes(
  tutores: Tutor[],
  rascunho: { nome: string; telefone: string; documento: string },
): ResponsavelSemelhante[] {
  const nome = semAcento(rascunho.nome)
  const telefone = somenteDigitos(rascunho.telefone)
  const documento = somenteDigitos(rascunho.documento)

  const achados: ResponsavelSemelhante[] = []

  for (const tutor of tutores) {
    let motivo: MotivoDeSemelhanca | null = null

    if (documento.length === 11 && somenteDigitos(tutor.documento) === documento) {
      motivo = 'documento'
    } else if (
      telefone.length >= 10 &&
      [tutor.telefone, tutor.telefoneSecundario].map(somenteDigitos).includes(telefone)
    ) {
      motivo = 'telefone'
    } else if (nome.length >= 4 && semAcento(tutor.nome) === nome) {
      motivo = 'nome'
    }

    if (motivo) {
      achados.push({ tutor, motivo })
    }
  }

  const peso: Record<MotivoDeSemelhanca, number> = { documento: 0, telefone: 1, nome: 2 }

  return achados.sort((a, b) => peso[a.motivo] - peso[b.motivo])
}

// ---------------------------------------------------------------------------
// O rascunho inteiro
// ---------------------------------------------------------------------------

/** Campo com problema, e qual é o problema. A frase é da tela. */
export type ErroDeCadastro = 'obrigatorio' | 'documento' | 'telefone' | 'email' | 'cep' | 'futuro'

export type CampoDoCadastro =
  | 'nome'
  | 'nascimento'
  | 'responsavelEscolhido'
  | 'responsavelNome'
  | 'telefone'
  | 'telefoneSecundario'
  | 'documento'
  | 'email'
  | 'cep'

export type RascunhoDeCadastro = {
  nome: string
  nascimento: string
  /**
   * O cadastro aceita dois caminhos, e só dois: responsável novo, ou paciente novo pendurado em
   * alguém que já existe. `false` é o segundo — e aí nada dos dados da pessoa é validado de
   * novo, porque o cadastro que está lá é o que vale.
   */
  responsavelNovo: boolean
  /** Quem foi escolhido da lista. Vazio com `responsavelNovo: false` é o caminho pela metade. */
  responsavelId: string
  responsavelNome: string
  telefone: string
  telefoneSecundario: string
  documento: string
  email: string
  cep: string
  /** Hoje na parede da clínica, para recusar nascimento no futuro sem inventar relógio aqui. */
  hoje: string
}

/**
 * Tudo o que está errado, de uma vez.
 *
 * Validar campo a campo na saída do foco faz o formulário acusar o primeiro erro e esconder os
 * outros três: quem preenche descobre um de cada vez e desiste no terceiro. O mapa completo
 * também é o que permite ao botão dizer *por que* está desligado.
 *
 * Opcional preenchido **é** validado. O cadastro não guarda um telefone que não existe só porque
 * ninguém era obrigado a informá-lo.
 */
export function validarCadastro(
  rascunho: RascunhoDeCadastro,
): Map<CampoDoCadastro, ErroDeCadastro> {
  const erros = new Map<CampoDoCadastro, ErroDeCadastro>()

  if (!rascunho.nome.trim()) {
    erros.set('nome', 'obrigatorio')
  }

  if (rascunho.nascimento && rascunho.nascimento > rascunho.hoje) {
    erros.set('nascimento', 'futuro')
  }

  /*
   * Escolher "já cadastrado" e não escolher ninguém é o buraco que o seletor antigo não tinha —
   * lá, "nenhum selecionado" *significava* responsável novo. Com os dois caminhos explícitos, o
   * meio do caminho passou a existir, e um paciente sem responsável é um paciente que ninguém
   * consegue avisar.
   */
  if (!rascunho.responsavelNovo) {
    if (!rascunho.responsavelId.trim()) {
      erros.set('responsavelEscolhido', 'obrigatorio')
    }

    return erros
  }

  if (!rascunho.responsavelNome.trim()) {
    erros.set('responsavelNome', 'obrigatorio')
  }

  if (!rascunho.telefone.trim()) {
    erros.set('telefone', 'obrigatorio')
  } else if (!telefoneValido(rascunho.telefone)) {
    erros.set('telefone', 'telefone')
  }

  if (rascunho.telefoneSecundario.trim() && !telefoneValido(rascunho.telefoneSecundario)) {
    erros.set('telefoneSecundario', 'telefone')
  }

  if (rascunho.documento.trim() && !cpfValido(rascunho.documento)) {
    erros.set('documento', 'documento')
  }

  if (rascunho.email.trim() && !emailValido(rascunho.email)) {
    erros.set('email', 'email')
  }

  if (rascunho.cep.trim() && !cepValido(rascunho.cep)) {
    erros.set('cep', 'cep')
  }

  return erros
}
