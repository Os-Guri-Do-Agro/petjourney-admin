const brlFormatters = new Map<string, Intl.NumberFormat>()

/**
 * A moeda é sempre BRL; a forma de escrever segue o idioma da tela (`INTL_LOCALE`):
 * pt "R$ 1.234,50", en "R$1,234.50", sr "1.234,50 R$".
 */
function brlFormatter(intlLocale: string) {
  let formatter = brlFormatters.get(intlLocale)

  if (!formatter) {
    formatter = new Intl.NumberFormat(intlLocale, { style: 'currency', currency: 'BRL' })
    brlFormatters.set(intlLocale, formatter)
  }

  return formatter
}

/** Máscara e leitura da digitação ficam em pt-BR, as duas juntas: uma não funciona sem a outra. */
const brlAmountFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCentavosToBrl(centavos: number, intlLocale = 'pt-BR') {
  const texto = brlFormatter(intlLocale).format(centavos / 100)

  /*
   * No árabe a linha corre da direita para a esquerda, e "R$" (o R é letra latina, o $ não tem
   * direção) se partia: a carteira mostrava "$R 0.00". Isolado da linha (LRI … PDI), o valor sai
   * inteiro, "0.00 R$", como o idioma escreve.
   */
  return intlLocale.startsWith('ar') ? `⁦${texto}⁩` : texto
}

/** Máscara de digitação BRL (centavos → `1.234,56`). */
export function maskBrlCurrencyInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)

  if (!digits) {
    return ''
  }

  return brlAmountFormatter.format(Number.parseInt(digits, 10) / 100)
}

export function parseBrlToCentavos(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')

  const parsed = Number.parseFloat(normalized)

  if (!Number.isFinite(parsed)) {
    return null
  }

  return Math.round(parsed * 100)
}
