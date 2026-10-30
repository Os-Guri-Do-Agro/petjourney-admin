/**
 * Receituário: a conta que o vet confere e a instrução que o responsável executa.
 *
 * As duas leituras da mesma prescrição são diferentes e este arquivo produz as duas.
 *
 * O **vet** precisa ver a conta, não o resultado: `12,4 kg × 10 mg/kg = 124 mg`. Um número
 * pronto num campo de formulário não se confere de cabeça, e conferir de cabeça é o que
 * impede o erro de vírgula de virar erro de paciente.
 *
 * O **responsável** precisa da instrução, não da conta: "meio comprimido, de 12 em 12 horas,
 * por 7 dias". "0,5 comprimido" é resultado de divisão, e ninguém parte um comprimido em 0,5.
 */

import type { DoseCalc, Medication } from '../data/types'

// ---------------------------------------------------------------------------
// A conta, para o vet
// ---------------------------------------------------------------------------

export type PassoDaConta = {
  /** `kind` traduzível; a tela monta a frase. */
  kind: 'peso-por-dose' | 'dose-por-concentracao' | 'total'
  params: Record<string, string | number>
}

/**
 * Os passos da conta, na ordem em que se confere.
 *
 * Devolve vazio quando não há o que conferir — sem peso, a conta não existe, e mostrar
 * `0 × 10 = 0` seria pior que não mostrar nada.
 */
export function passosDaConta(calculo: DoseCalc, medicamento: Medication): PassoDaConta[] {
  if (calculo.pesoKg <= 0 || calculo.mgPorKg <= 0) {
    return []
  }

  const passos: PassoDaConta[] = [
    {
      kind: 'peso-por-dose',
      params: {
        peso: calculo.pesoKg,
        mgPorKg: calculo.mgPorKg,
        mg: calculo.mgPorAdministracao,
      },
    },
  ]

  /*
   * O segundo passo é o que converte miligrama em coisa que existe na mão: mililitro ou
   * comprimido. É onde o erro de concentração aparece — 124 mg de um xarope de 50 mg/mL são
   * 2,5 mL, e de um de 250 mg/mL são 0,5 mL.
   */
  if (medicamento.concentracao > 0) {
    passos.push({
      kind: 'dose-por-concentracao',
      params: {
        mg: calculo.mgPorAdministracao,
        concentracao: medicamento.concentracao,
        unidade: medicamento.unidadeApresentacao,
        quantidade: calculo.quantidadeApresentacao,
      },
    })
  }

  /** Uso contínuo não tem total: somar administrações de algo sem fim não significa nada. */
  if (calculo.duracaoDias !== null && calculo.totalAdministracoes > 0) {
    passos.push({
      kind: 'total',
      params: {
        porDia: 24 / calculo.frequenciaHoras,
        dias: calculo.duracaoDias,
        total: calculo.totalAdministracoes,
      },
    })
  }

  return passos
}

// ---------------------------------------------------------------------------
// O fracionamento, para o responsável
// ---------------------------------------------------------------------------

/**
 * Como a quantidade é dita a quem vai dar o remédio.
 *
 * `fracao` traz o texto que a pessoa reconhece — "meio", "um e meio", "um quarto" —, e
 * `aproximado` marca quando a conta não cai numa fração que dê para partir na mão.
 */
export type NomeDaFracao = 'inteiro' | 'meio' | 'um-e-meio' | 'quarto' | 'tres-quartos' | 'multiplo'

export type Fracionamento = {
  /** `kind` traduzível da fração. */
  kind: NomeDaFracao | 'aproximado'
  /**
   * Como dizer a `quantidade` partível, também quando a conta foi arredondada: 0,66 vira
   * "três quartos" (com a marca de aproximado), e não "0,75 comprimidos". O `kind` continua
   * dizendo `aproximado` para quem decide pela marca (a projeção do app, por exemplo).
   */
  nome: NomeDaFracao
  /** Número de comprimidos inteiros, quando faz sentido dizer. */
  inteiros: number
  quantidade: number
  /**
   * `true` quando a conta não bate numa fração partível e foi arredondada.
   *
   * Não é detalhe: 0,37 comprimido não existe no mundo. Ou a apresentação muda, ou alguém
   * decide arredondar — e essa decisão é do vet, não do algoritmo. A marca serve para a tela
   * cobrar essa decisão em vez de imprimir um número impossível.
   */
  aproximado: boolean
}

/**
 * As frações que um comprimido sulcado admite de verdade: metade e quarto, nada além disso. O
 * inteiro de baixo e o de cima também contam: 0,99 é um comprimido, não três quartos.
 */
const FRACOES_PARTIVEIS = [0, 0.25, 0.5, 0.75, 1]
/** Tolerância do arredondamento: 5% da dose, abaixo do que muda efeito clínico. */
const TOLERANCIA = 0.05

/** "meio", "um e meio", "três quartos"... A partir de dois comprimidos, o número diz. */
function nomeDaQuantidade(inteiros: number, fracao: number): NomeDaFracao {
  if (fracao === 0) {
    return 'inteiro'
  }

  if (fracao === 0.5) {
    return inteiros === 0 ? 'meio' : inteiros === 1 ? 'um-e-meio' : 'multiplo'
  }

  if (inteiros > 0) {
    return 'multiplo'
  }

  return fracao === 0.25 ? 'quarto' : 'tres-quartos'
}

export function fracionar(quantidade: number, unidade: Medication['unidadeApresentacao']): Fracionamento | null {
  /* Líquido não se fraciona: mede-se. 2,37 mL é um número que a seringa mostra. */
  if (unidade !== 'comprimido' || quantidade <= 0) {
    return null
  }

  /**
   * `quantidade` devolvida é sempre a **partível**, não a calculada: a mais próxima da conta.
   *
   * Nomear "dois e meio" e devolver 2,48 faria a instrução e o número se contradizerem na
   * mesma linha da receita. Quem lê para dar o remédio segue a palavra; quem confere segue o
   * número; os dois têm de dizer a mesma coisa. A dose calculada continua no `DoseCalc`, para
   * o vet conferir a conta original. Zero comprimido não é dose: fica fora das candidatas.
   */
  const base = Math.floor(quantidade)
  const alvo = FRACOES_PARTIVEIS.map((fracao) => base + fracao)
    .filter((candidata) => candidata > 0)
    .reduce((melhor, candidata) =>
      Math.abs(quantidade - candidata) < Math.abs(quantidade - melhor) ? candidata : melhor,
    )
  const inteiros = Math.floor(alvo)
  const nome = nomeDaQuantidade(inteiros, alvo - inteiros)

  return {
    /*
     * Longe de qualquer fração partível é o caso que o requisito chama de "dose que exige
     * fracionar comprimido": a tela precisa dizer isso ao vet, não esconder num decimal.
     */
    kind: Math.abs(quantidade - alvo) <= TOLERANCIA ? nome : 'aproximado',
    nome,
    inteiros,
    quantidade: alvo,
    aproximado: Math.abs(quantidade - alvo) > 0.001,
  }
}

// ---------------------------------------------------------------------------
// Validade e assinatura
// ---------------------------------------------------------------------------

/**
 * Dias de validade da receita.
 *
 * Trinta dias para as duas, comum e de controle especial. A diferença do controlado não está
 * no prazo e sim na retenção da via pela farmácia — que o documento já trata.
 */
export const VALIDADE_EM_DIAS = 30

/**
 * Código verificador.
 *
 * Determinístico a partir do conteúdo: a mesma receita produz o mesmo código, receitas
 * diferentes produzem códigos diferentes. No protótipo é um resumo simples; na API real vira
 * assinatura criptográfica. O formato — quatro grupos de quatro — é o que se dita ao telefone
 * sem errar, e é essa a forma que a tela precisa exercitar agora.
 */
export function gerarCodigoVerificador(semente: string): string {
  let a = 0x811c9dc5

  for (let i = 0; i < semente.length; i += 1) {
    a ^= semente.charCodeAt(i)
    a = Math.imul(a, 0x01000193) >>> 0
  }

  const alfabeto = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  let saida = ''

  for (let i = 0; i < 16; i += 1) {
    a = Math.imul(a ^ (a >>> 15), 0x2545f491) >>> 0
    saida += alfabeto[a % alfabeto.length]
  }

  return saida.replace(/(.{4})(?=.)/g, '$1-')
}
