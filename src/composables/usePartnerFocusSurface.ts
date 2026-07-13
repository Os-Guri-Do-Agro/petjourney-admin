import { computed, type CSSProperties } from 'vue'

import { currentColors, isDarkMode } from '@/theme/color-mode'

/** Tokens do cartão de foco (gradiente sálvia/azulado da visão geral). */
export function usePartnerFocusSurface() {
  const focusSurfaceStyle = computed((): CSSProperties => {
    const colors = currentColors.value
    const dark = isDarkMode.value

    return {
      '--pf-from': dark ? colors.dashboard.primaryDeep : colors.auth.sageStrong,
      '--pf-to': dark ? colors.vet.secondary : colors.dashboard.primaryDeep,
      '--pf-glow-rgb': dark ? '242 248 245' : '255 255 255',
      '--pf-on': dark ? colors.text.primary : colors.auth.white,
      '--pf-on-soft': dark ? 'rgb(242 248 245 / 0.84)' : 'rgb(255 255 255 / 0.88)',
      '--pf-cta-bg': dark ? colors.text.primary : colors.auth.white,
      '--pf-cta-text': dark ? colors.dashboard.primaryDeep : colors.dashboard.primaryStrong,
      '--pf-shadow-rgb': colors.auth.shadowRgb,
      '--pf-chip': dark ? 'rgb(242 248 245 / 0.16)' : 'rgb(255 255 255 / 0.22)',
      '--pf-field': dark ? 'rgb(15 23 20 / 0.28)' : 'rgb(255 255 255 / 0.16)',
      '--pf-line': dark ? 'rgb(242 248 245 / 0.22)' : 'rgb(255 255 255 / 0.28)',
    }
  })

  return { focusSurfaceStyle }
}
