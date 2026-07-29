import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

import { DarkColors, LightColors } from './colors'

/** Escala primária sálvia — alinhada ao design system (AuthButton, dashboard, vet). */
const lightPrimaryScale = {
  50: LightColors.auth.sageTint,
  100: '#E4F0E9',
  200: LightColors.vet.secondary,
  300: '#9BB5AF',
  400: LightColors.vet.primary,
  500: LightColors.vet.primary,
  600: LightColors.auth.sageStrong,
  700: LightColors.dashboard.primaryStrong,
  800: '#3D5A52',
  900: '#2A3F39',
  950: '#1A2824',
} as const

export const PetJourneyPreset = definePreset(Aura, {
  semantic: {
    primary: lightPrimaryScale,
    colorScheme: {
      light: {
        primary: {
          color: LightColors.vet.primary,
          contrastColor: LightColors.auth.white,
          hoverColor: LightColors.auth.sageStrong,
          activeColor: LightColors.dashboard.primaryStrong,
        },
        highlight: {
          background: LightColors.vet.secondary,
          focusBackground: LightColors.auth.sageTint,
          color: LightColors.dashboard.primaryStrong,
          focusColor: LightColors.dashboard.primaryStrong,
        },
        surface: {
          0: LightColors.white,
          50: LightColors.bg.screen,
          100: LightColors.bg.light,
          200: LightColors.gray,
          300: LightColors.border.light,
          400: LightColors.border.default,
          500: LightColors.text.muted,
          600: LightColors.text.secondary,
          700: LightColors.dashboard.primaryDeep,
          800: LightColors.dashboard.primaryStrong,
          900: '#2A3F39',
          950: '#1A2824',
        },
        text: {
          color: LightColors.text.primary,
          hoverColor: LightColors.dashboard.primaryStrong,
          mutedColor: LightColors.text.secondary,
          hoverMutedColor: LightColors.auth.sageStrong,
        },
        content: {
          background: LightColors.white,
          hoverBackground: LightColors.bg.screen,
          borderColor: LightColors.border.light,
          color: LightColors.text.primary,
          hoverColor: LightColors.dashboard.primaryStrong,
        },
      },
      dark: {
        primary: {
          color: DarkColors.vet.primary,
          /** Texto sobre botão sálvia: branco no dark (não tinta escura). */
          contrastColor: LightColors.auth.white,
          hoverColor: DarkColors.auth.sageStrong,
          activeColor: DarkColors.dashboard.primaryDeep,
        },
        highlight: {
          background: 'color-mix(in srgb, #FFEDD8 18%, transparent)',
          focusBackground: 'color-mix(in srgb, #FFEDD8 24%, transparent)',
          color: DarkColors.text.primary,
          focusColor: DarkColors.text.primary,
        },
        /**
         * No dark do Aura a escala surface sobe do mais escuro (0) ao mais claro (950).
         * 900/950 precisam ser texto claro — senão InputText/Select ficam ilegíveis.
         */
        surface: {
          0: DarkColors.dashboard.surface,
          50: DarkColors.bg.screen,
          100: DarkColors.bg.light,
          200: DarkColors.bg.card,
          300: DarkColors.border.subtle,
          400: DarkColors.border.light,
          500: DarkColors.border.default,
          600: DarkColors.dashboard.faint,
          700: DarkColors.dashboard.muted,
          800: DarkColors.text.secondary,
          900: DarkColors.text.primary,
          950: DarkColors.text.primary,
        },
        text: {
          color: DarkColors.text.primary,
          hoverColor: DarkColors.vet.primary,
          mutedColor: DarkColors.text.secondary,
          hoverMutedColor: DarkColors.text.primary,
        },
        content: {
          background: DarkColors.dashboard.surface,
          hoverBackground: DarkColors.auth.sageTint,
          borderColor: DarkColors.dashboard.line,
          color: DarkColors.text.primary,
          hoverColor: DarkColors.vet.primary,
        },
      },
    },
  },
})
