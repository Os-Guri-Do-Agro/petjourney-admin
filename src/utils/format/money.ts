const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const brlAmountFormatter = new Intl.NumberFormat('pt-BR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatCentavosToBrl(centavos: number) {
  return brlFormatter.format(centavos / 100)
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
