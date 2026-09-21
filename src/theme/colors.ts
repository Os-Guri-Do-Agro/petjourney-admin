export const LightColors = {
  primary: '#1D3557',
  secondary: '#FFEDD8',
  red: '#F28482',
  danger: '#ff4444',
  success: '#A8DADC',
  white: '#FBFCFB',
  purple: '#BDB2FF',
  gray: '#DCE6E2',
  orange: '#FFB7A1',
  pink: '#FAD2E1',
  brown: '#D5BDAF',
  green: '#84C1B4',
  internacao: '#5B6B8C',
  text: {
    primary: '#1a1a1a',
    secondary: '#5F5F5F',
    muted: '#919191',
    inverse: '#ffffff',
    inverse85: '#ffffffD9',
    inverse20: '#ffffff33',
  },
  bg: {
    light: '#E6EDEA',
    card: '#EDF2F0',
    screen: '#F0F5F3',
  },
  border: {
    light: '#D8E3DF',
    default: '#C6D4CF',
    subtle: '#E3EBE8',
  },
  tutor: {
    primary: '#457B9D',
    secondary: '#6BA3C3',
  },
  vet: {
    primary: '#84C1B4',
    secondary: '#84C1B4',
    /** Teal da marca escurecido (mesmo matiz/saturação de `primary`) para superfície de foco com texto claro. */
    focusFrom: '#3C7B6D',
    focusTo: '#2E6156',
  },
  /*
   * Os tons auxiliares (`muted`, `soft`, `divider`, `faint`, `navIcon`) desceram junto com as
   * superfícies. Contraste é razão, não distância: baixar o fundo de `#F3F7F5` para `#E6EDEA`
   * **reduz** a razão do texto escuro, e o secundário — que já passava raspando em `4,17:1`
   * sobre o fundo do app — cairia para `3,79:1`. Cada tom foi reescurecido no mesmo matiz até
   * recuperar, no mínimo, a razão que tinha antes contra a superfície mais dura; o secundário
   * foi além e agora fecha `4,54:1`, que é o AA que ele nunca tinha tido.
   */
  auth: {
    sageStrong: '#6E9189',
    sageTint: '#E5EEEA',
    text: '#28332F',
    muted: '#606D69',
    soft: '#83928D',
    divider: '#9BA7A3',
    line: '#DFE8E5',
    appBg: '#E6EDEA',
    /** Superfície mais clara do modo — branco quebrado. Branco puro: `text.inverse`. */
    white: '#FBFCFB',
    shadowRgb: '40 51 47',
  },
  /*
   * Superfícies do claro: fundo (`bg`) → cartão (`surface`) → bloco interno (`surfaceSoft`).
   * Os três degraus são espaçados o bastante para se lerem sem sombra, e o cartão é branco
   * quebrado, não branco puro — branco puro em tela inteira ofusca. Tinta branca de verdade
   * (texto/ícone sobre sálvia) sai de `text.inverse`, que não acompanha esse ajuste.
   */
  dashboard: {
    bg: '#E6EDEA',
    surface: '#FBFCFB',
    surfaceSoft: '#F0F5F3',
    line: '#D8E3DF',
    lineSoft: '#E3EBE8',
    text: '#1F2F2B',
    muted: '#606D69',
    faint: '#9BA7A3',
    navIcon: '#75827E',
    primaryDeep: '#5C7E76',
    primaryStrong: '#4F756B',
    successText: '#517D71',
    successBg: '#EAF4F0',
    warm: '#D98E73',
    warmText: '#C5715A',
    warmBg: '#FBEEE8',
    warmSoft: '#FDF8F5',
    warmLine: '#F1E2DA',
    amber: '#C99A4E',
    amberText: '#B68A3E',
    amberBg: '#F7F0E0',
    amberSoft: '#F7EFDC',
    mutedPillBg: '#F0EFEC',
    mutedPillText: '#8A8579',
  },
} as const

export const DarkColors = {
  primary: '#DDEBE7',
  secondary: '#22342E',
  red: '#F2A09E',
  danger: '#FF6B6B',
  success: '#7CC7BC',
  white: '#0F1714',
  purple: '#CFC7FF',
  gray: '#243530',
  orange: '#E7A07F',
  pink: '#EFB8CC',
  brown: '#8C7B70',
  green: '#84C1B4',
  internacao: '#9FAEC9',
  text: {
    primary: '#F2F8F5',
    secondary: '#B9C9C3',
    muted: '#90A29B',
    inverse: '#0F1714',
    inverse85: '#0F1714D9',
    inverse20: '#0F171433',
  },
  bg: {
    light: '#16231F',
    card: '#1A2924',
    screen: '#0B1210',
  },
  border: {
    light: '#2B423A',
    default: '#38524A',
    subtle: '#20322D',
  },
  tutor: {
    primary: '#8AB6D6',
    secondary: '#A8CDE3',
  },
  vet: {
    primary: '#84C1B4',
    secondary: '#244139',
    focusFrom: '#2F6D5F',
    focusTo: '#1F433A',
  },
  auth: {
    sageStrong: '#B6DCD3',
    sageTint: '#20352F',
    text: '#F2F8F5',
    muted: '#B2C4BD',
    soft: '#8A9E96',
    divider: '#39564D',
    line: '#263A33',
    appBg: '#0B1210',
    white: '#121D19',
    shadowRgb: '0 0 0',
  },
  dashboard: {
    bg: '#0B1210',
    surface: '#121D19',
    surfaceSoft: '#182822',
    line: '#263A33',
    lineSoft: '#1E302A',
    text: '#F2F8F5',
    muted: '#B2C4BD',
    faint: '#8A9E96',
    navIcon: '#A0B3AD',
    primaryDeep: '#4E8E80',
    primaryStrong: '#BFE3DB',
    successText: '#A8DEC9',
    successBg: '#17372C',
    warm: '#E38E78',
    warmText: '#F2AE9B',
    warmBg: '#3A211C',
    warmSoft: '#211A17',
    warmLine: '#59342D',
    amber: '#D9AD62',
    amberText: '#F0C77D',
    amberBg: '#372A16',
    amberSoft: '#252014',
    mutedPillBg: '#21332D',
    mutedPillText: '#B9C9C3',
  },
} as const

export const ThemeColors = {
  light: LightColors,
  dark: DarkColors,
} as const

export const Colors = LightColors

export type ThemeMode = keyof typeof ThemeColors
export type ColorPalette = typeof LightColors
