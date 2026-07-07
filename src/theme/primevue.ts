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
          contrastColor: DarkColors.text.inverse,
          hoverColor: DarkColors.auth.sageStrong,
          activeColor: DarkColors.dashboard.primaryDeep,
        },
        highlight: {
          background: 'color-mix(in srgb, #FFEDD8 18%, transparent)',
          focusBackground: 'color-mix(in srgb, #FFEDD8 24%, transparent)',
          color: DarkColors.text.primary,
          focusColor: DarkColors.text.primary,
        },
        surface: {
          0: DarkColors.auth.white,
          50: DarkColors.bg.screen,
          100: DarkColors.bg.light,
          200: DarkColors.bg.card,
          300: DarkColors.border.light,
          400: DarkColors.border.default,
          500: DarkColors.text.muted,
          600: DarkColors.text.secondary,
          700: DarkColors.dashboard.primaryDeep,
          800: DarkColors.vet.primary,
          900: '#2A3F39',
          950: '#1A2824',
        },
        text: {
          color: DarkColors.text.primary,
          hoverColor: DarkColors.vet.primary,
          mutedColor: DarkColors.text.secondary,
          hoverMutedColor: DarkColors.text.primary,
        },
        content: {
          background: DarkColors.auth.white,
          hoverBackground: DarkColors.auth.sageTint,
          borderColor: 'color-mix(in srgb, #FAF9F6 20%, transparent)',
          color: DarkColors.text.primary,
          hoverColor: DarkColors.vet.primary,
        },
      },
    },
  },
})
