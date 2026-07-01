export function stripCpf(value: string) {
  return value.replace(/\D/g, '')
}

export function formatCpf(value: string) {
  const digits = stripCpf(value).slice(0, 11)

  if (digits.length <= 3) {
    return digits
  }

  if (digits.length <= 6) {
    return `${digits.slice(0, 3)}.${digits.slice(3)}`
  }

  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`
}

function hasRepeatedDigits(digits: string) {
  return /^(\d)\1{10}$/.test(digits)
}

function calculateCheckDigit(digits: string, factor: number) {
  let total = 0

  for (const digit of digits) {
    total += Number(digit) * factor
    factor -= 1
  }

  const remainder = (total * 10) % 11

  return remainder === 10 ? 0 : remainder
}

export function isValidCpf(value: string) {
  const digits = stripCpf(value)

  if (digits.length !== 11 || hasRepeatedDigits(digits)) {
    return false
  }

  const firstCheckDigit = calculateCheckDigit(digits.slice(0, 9), 10)
  const secondCheckDigit = calculateCheckDigit(digits.slice(0, 10), 11)

  return firstCheckDigit === Number(digits[9]) && secondCheckDigit === Number(digits[10])
}
