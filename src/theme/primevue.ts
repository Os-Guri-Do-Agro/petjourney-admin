import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

import { DarkColors, LightColors } from './colors'

export const PetJourneyPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#EEF3F6',
      100: '#D7E2EA',
      200: '#B2C8D6',
      300: '#86A7BC',
      400: '#5D86A1',
      500: LightColors.primary,
      600: '#172B47',
      700: '#122238',
      800: '#0D1828',
      900: '#080F19',
      950: '#04080D',
    },
    colorScheme: {
      light: {
        primary: {
          color: LightColors.primary,
          contrastColor: LightColors.white,
          hoverColor: LightColors.internacao,
          activeColor: '#122238',
        },
        highlight: {
          background: LightColors.secondary,
          focusBackground: LightColors.gray,
          color: LightColors.primary,
          focusColor: LightColors.primary,
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
          700: LightColors.internacao,
          800: LightColors.primary,
          900: '#14243B',
          950: '#0A1320',
        },
        text: {
          color: LightColors.text.primary,
          hoverColor: LightColors.primary,
          mutedColor: LightColors.text.secondary,
          hoverMutedColor: LightColors.internacao,
        },
        content: {
          background: LightColors.white,
          hoverBackground: LightColors.bg.screen,
          borderColor: LightColors.border.light,
          color: LightColors.text.primary,
          hoverColor: LightColors.primary,
        },
      },
      dark: {
        primary: {
          color: DarkColors.vet.primary,
          contrastColor: DarkColors.text.inverse,
          hoverColor: DarkColors.vet.secondary,
          activeColor: DarkColors.bg.card,
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
          700: DarkColors.internacao,
          800: DarkColors.primary,
          900: '#14243B',
          950: '#0A1320',
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
