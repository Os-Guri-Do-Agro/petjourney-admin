export function stripCnpj(value: string) {
  return value.replace(/\D/g, '')
}

export function formatCnpj(value: string) {
  const digits = stripCnpj(value).slice(0, 14)

  if (digits.length <= 2) {
    return digits
  }

  if (digits.length <= 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`
  }

  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`
  }

  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`
}

function hasRepeatedDigits(digits: string) {
  return /^(\d)\1{13}$/.test(digits)
}

/** Módulo 11 do CNPJ: pesos de 2 a 9, cíclicos da direita para a esquerda. */
function calculateCheckDigit(digits: string) {
  let factor = 2
  let total = 0

  for (let i = digits.length - 1; i >= 0; i -= 1) {
    total += Number(digits[i]) * factor
    factor = factor === 9 ? 2 : factor + 1
  }

  const remainder = total % 11

  return remainder < 2 ? 0 : 11 - remainder
}

export function isValidCnpj(value: string) {
  const digits = stripCnpj(value)

  if (digits.length !== 14 || hasRepeatedDigits(digits)) {
    return false
  }

  const firstCheckDigit = calculateCheckDigit(digits.slice(0, 12))
  const secondCheckDigit = calculateCheckDigit(digits.slice(0, 13))

  return firstCheckDigit === Number(digits[12]) && secondCheckDigit === Number(digits[13])
}
