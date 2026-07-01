export type PasswordRequirementKey =
  | 'minLength'
  | 'hasNumber'
  | 'hasUppercase'
  | 'hasSpecialChar'

export type PasswordRequirementsState = Record<PasswordRequirementKey, boolean>

const SPECIAL_CHAR_PATTERN = /[!@#$%^&*(),.?":{}|<>_\-+=[\]\\/;'`~]/

export function getPasswordRequirements(password: string): PasswordRequirementsState {
  return {
    minLength: password.length >= 6,
    hasNumber: /\d/.test(password),
    hasUppercase: /[A-Z]/.test(password),
    hasSpecialChar: SPECIAL_CHAR_PATTERN.test(password),
  }
}

export function isPasswordValid(password: string) {
  const requirements = getPasswordRequirements(password)

  return Object.values(requirements).every(Boolean)
}
