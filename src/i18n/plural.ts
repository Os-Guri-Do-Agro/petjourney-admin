/**
 * Regras de plural do vue-i18n para sérvio e árabe.
 *
 * O vue-i18n só conhece a regra do inglês (singular | plural). Sérvio e árabe têm mais formas,
 * e cada string com ` | ` no catálogo desses idiomas traz uma forma por categoria, nesta ordem:
 *
 * - sr: `one | few | other` (1, 21, 31 / 2-4, 22-24 / 0, 5-20, decimais).
 *   Quando a origem começa por uma forma de zero ("nenhum marcado | …"), 4 formas:
 *   `zero | one | few | other`.
 * - ar: sempre `zero | one | two | few | many | other` (0 / 1 / 2 / 3-10 / 11-99 / 100+).
 *
 * O gate `check:i18n` barra quantidade de formas diferente disso.
 *
 * Sem dependências do projeto: o validador de tradução (Node) importa este arquivo direto.
 */

const SR_CATEGORIES = ['one', 'few', 'other']
const AR_CATEGORIES = ['zero', 'one', 'two', 'few', 'many', 'other']

const srRules = new Intl.PluralRules('sr-Latn')
const arRules = new Intl.PluralRules('ar')

/** Quantidade de formas que uma string plural precisa ter, dada a quantidade no inglês. */
export function expectedPluralForms(lang: 'sr' | 'ar', sourceForms: number): number {
  if (lang === 'ar') {
    return 6
  }
  return sourceForms === 3 ? 4 : 3
}

export function serbianPluralRule(choice: number, choicesLength: number): number {
  const index = Math.max(0, SR_CATEGORIES.indexOf(srRules.select(Math.abs(choice))))

  if (choicesLength === 4) {
    return choice === 0 ? 0 : 1 + index
  }
  if (choicesLength === 3) {
    return index
  }
  // String ainda com 2 formas (o gate não deixa chegar aqui).
  return Math.abs(choice) === 1 ? 0 : Math.min(1, choicesLength - 1)
}

export function arabicPluralRule(choice: number, choicesLength: number): number {
  if (choicesLength === 6) {
    return Math.max(0, AR_CATEGORIES.indexOf(arRules.select(Math.abs(choice))))
  }
  // String fora do formato de 6 formas (o gate não deixa chegar aqui).
  return Math.abs(choice) === 1 ? 0 : Math.min(1, choicesLength - 1)
}

export const PLURAL_RULES = {
  sr: serbianPluralRule,
  ar: arabicPluralRule,
}
