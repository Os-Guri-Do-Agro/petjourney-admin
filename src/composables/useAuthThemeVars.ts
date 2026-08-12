import { computed, type CSSProperties } from 'vue'

import { currentColors, isDarkMode } from '@/theme/color-mode'

/**
 * Tokens de auth alinhados ao dashboard.
 * No dark: formulário com tipografia clara sobre a arte escura de fundo.
 */
export function useAuthThemeVars() {
  return computed((): CSSProperties => {
    const colors = currentColors.value
    const dark = isDarkMode.value

    const pageBg = dark ? colors.dashboard.bg : colors.auth.white
    const fieldBg = dark ? colors.dashboard.surface : colors.auth.white

    return {
      '--auth-sage': colors.vet.primary,
      '--auth-sage-strong': colors.auth.sageStrong,
      '--auth-sage-soft': colors.vet.secondary,
      '--auth-sage-tint': colors.auth.sageTint,

      '--auth-text': colors.dashboard.text,
      // Tipografia auxiliar: no dark sobe um degrau para não parecer apagada
      '--auth-muted': dark ? colors.text.secondary : colors.dashboard.muted,
      '--auth-soft': dark ? colors.dashboard.muted : colors.dashboard.faint,
      '--auth-divider': dark ? colors.dashboard.muted : colors.dashboard.faint,

      '--auth-line': colors.dashboard.line,
      '--auth-border': dark ? colors.border.default : colors.dashboard.line,
      '--auth-app-bg': colors.dashboard.bg,
      '--auth-page-bg': pageBg,
      '--auth-field-bg': fieldBg,

      // Tinta clara sobre marca (painel / ícones em chip sálvia)
      '--auth-on-brand': dark ? colors.text.primary : colors.auth.white,

      // CTA principal: no dark, superfície clara + tinta escura (como focus cards)
      '--auth-cta-bg': dark ? colors.text.primary : colors.vet.primary,
      '--auth-cta-text': dark ? colors.dashboard.bg : colors.auth.white,
      '--auth-cta-bg-hover': dark ? colors.dashboard.primaryStrong : colors.auth.sageStrong,

      '--auth-shadow-rgb': colors.auth.shadowRgb,
      '--auth-danger': colors.red,
      '--auth-link': dark ? colors.vet.primary : colors.auth.sageStrong,
      '--auth-focus': colors.vet.primary,
      '--auth-focus-ring': colors.vet.secondary,
    }
  })
}
