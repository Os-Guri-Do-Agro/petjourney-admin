import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

import { Colors } from './colors'

export const PetJourneyPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#EEF3F6',
      100: '#D7E2EA',
      200: '#B2C8D6',
      300: '#86A7BC',
      400: '#5D86A1',
      500: Colors.primary,
      600: '#172B47',
      700: '#122238',
      800: '#0D1828',
      900: '#080F19',
      950: '#04080D',
    },
    colorScheme: {
      light: {
        primary: {
          color: Colors.primary,
          contrastColor: Colors.white,
          hoverColor: Colors.internacao,
          activeColor: '#122238',
        },
        highlight: {
          background: Colors.secondary,
          focusBackground: Colors.gray,
          color: Colors.primary,
          focusColor: Colors.primary,
        },
        surface: {
          0: Colors.white,
          50: Colors.bg.screen,
          100: Colors.bg.light,
          200: Colors.gray,
          300: Colors.border.light,
          400: Colors.border.default,
          500: Colors.text.muted,
          600: Colors.text.secondary,
          700: Colors.internacao,
          800: Colors.primary,
          900: '#14243B',
          950: '#0A1320',
        },
        text: {
          color: Colors.text.primary,
          hoverColor: Colors.primary,
          mutedColor: Colors.text.secondary,
          hoverMutedColor: Colors.internacao,
        },
        content: {
          background: Colors.white,
          hoverBackground: Colors.bg.screen,
          borderColor: Colors.border.light,
          color: Colors.text.primary,
          hoverColor: Colors.primary,
        },
      },
      dark: {
        primary: {
          color: Colors.secondary,
          contrastColor: Colors.primary,
          hoverColor: Colors.white,
          activeColor: Colors.gray,
        },
        highlight: {
          background: 'color-mix(in srgb, #FFEDD8 18%, transparent)',
          focusBackground: 'color-mix(in srgb, #FFEDD8 24%, transparent)',
          color: Colors.white,
          focusColor: Colors.white,
        },
        surface: {
          0: Colors.primary,
          50: '#F7F4EF',
          100: '#E8E0D6',
          200: '#D4C8BA',
          300: '#AFA193',
          400: '#7A716A',
          500: '#5B6B8C',
          600: '#3D4C69',
          700: '#293B59',
          800: '#1D3557',
          900: '#14243B',
          950: '#0A1320',
        },
        text: {
          color: Colors.text.inverse,
          hoverColor: Colors.secondary,
          mutedColor: Colors.text.inverse85,
          hoverMutedColor: Colors.white,
        },
        content: {
          background: '#14243B',
          hoverBackground: '#1D3557',
          borderColor: 'color-mix(in srgb, #FAF9F6 20%, transparent)',
          color: Colors.text.inverse,
          hoverColor: Colors.secondary,
        },
      },
    },
  },
})
