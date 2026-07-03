import { hasVeterinarioProfile } from '@/service/auth/auth-session'

export function getDefaultLandingPath() {
  if (hasVeterinarioProfile()) {
    return '/veterinario/agenda'
  }

  return '/parceiro/programas'
}
