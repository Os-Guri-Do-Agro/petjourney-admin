import { computed, type CSSProperties } from 'vue'

import { currentColors, isDarkMode } from '@/theme/color-mode'

/** Tokens do cartão de foco (gradiente do teal da marca, `vet.primary`, escurecido para texto claro). */
export function usePartnerFocusSurface() {
  const focusSurfaceStyle = computed((): CSSProperties => {
    const colors = currentColors.value
    const dark = isDarkMode.value

    return {
      '--pf-from': colors.vet.focusFrom,
      '--pf-to': colors.vet.focusTo,
      '--pf-glow-rgb': dark ? '242 248 245' : '255 255 255',
      '--pf-on': dark ? colors.text.primary : colors.auth.white,
      '--pf-on-soft': dark ? 'rgb(242 248 245 / 0.84)' : 'rgb(255 255 255 / 0.88)',
      '--pf-cta-bg': dark ? colors.text.primary : colors.auth.white,
      '--pf-cta-text': dark ? colors.vet.focusFrom : colors.vet.focusTo,
      '--pf-shadow-rgb': colors.auth.shadowRgb,
      '--pf-chip': dark ? 'rgb(242 248 245 / 0.16)' : 'rgb(255 255 255 / 0.22)',
      '--pf-field': dark ? 'rgb(15 23 20 / 0.28)' : 'rgb(255 255 255 / 0.16)',
      '--pf-line': dark ? 'rgb(242 248 245 / 0.22)' : 'rgb(255 255 255 / 0.28)',
    }
  })

  return { focusSurfaceStyle }
}
