/*
 * A paleta em JS — a que vai para `style` inline (`--partner-*`, `--auth-*`, `--prog-*`…) e para o
 * preset do PrimeVue.
 *
 * Desde 19/10/2026 ela é a do Trilha (`theme/trilha/trilha-tokens.css`, design system "PetJourney
 * Admin"): cada papel daqui recebe o valor do token que faz o mesmo trabalho lá, em hex, porque há
 * quem faça conta com a cor (gráficos). Mudou um token do Trilha, muda aqui também.
 *
 * A paleta anterior, o linho, continua inteira logo abaixo (`LinhoLightColors`, `LinhoDarkColors`),
 * com as justificativas de cada tom.
 */
export const LightColors = {
  primary: '#142721',
  secondary: '#eef6f3',
  red: '#c54e45',
  danger: '#9d2e29',
  success: '#4a925c',
  white: '#fbfbf8',
  purple: '#b8acf0',
  gray: '#dbe7e3',
  orange: '#d78a3f',
  pink: '#fee9e6',
  brown: '#d5dfdb',
  green: '#84a59d',
  internacao: '#005982',
  text: {
    primary: '#142721',
    secondary: '#40524b',
    muted: '#5e6d67',
    inverse: '#fbfbf8',
    inverse85: '#fbfbf8D9',
    inverse20: '#fbfbf833',
  },
  bg: {
    light: '#e7f0ed',
    card: '#fbfbf8',
    screen: '#eef6f3',
  },
  border: {
    light: '#d5dfdb',
    default: '#798983',
    subtle: '#dbe7e3',
  },
  tutor: {
    primary: '#1c7db0',
    secondary: '#7dc0ec',
  },
  vet: {
    primary: '#2b5f51',
    secondary: '#d8eee6',
    focusFrom: '#2b5f51',
    focusTo: '#16312a',
  },
  auth: {
    sageStrong: '#2b5f51',
    sageTint: '#d8eee6',
    text: '#142721',
    muted: '#40524b',
    soft: '#5e6d67',
    divider: '#798983',
    line: '#d5dfdb',
    appBg: '#e7f0ed',
    white: '#fbfbf8',
    shadowRgb: '20 39 33',
  },
  dashboard: {
    bg: '#e7f0ed',
    surface: '#fbfbf8',
    surfaceSoft: '#eef6f3',
    line: '#d5dfdb',
    lineSoft: '#d5dfdb',
    lineStrong: '#798983',
    text: '#142721',
    muted: '#40524b',
    faint: '#5e6d67',
    navIcon: '#40524b',
    primaryDeep: '#2b5f51',
    primaryStrong: '#2b5f51',
    successText: '#266b3a',
    successBg: '#d8f2dc',
    warm: '#c54e45',
    warmText: '#9d2e29',
    warmBg: '#fee9e6',
    warmSoft: '#fee9e6',
    warmLine: '#fee9e6',
    amber: '#d78a3f',
    amberText: '#905204',
    amberBg: '#fdebdc',
    amberSoft: '#fdebdc',
    mutedPillBg: '#dde4e1',
    mutedPillText: '#4f5854',
  },
} as const

export const DarkColors = {
  primary: '#ebf2ef',
  secondary: '#1e2724',
  red: '#ef8b80',
  danger: '#ffbfb6',
  success: '#82bb8d',
  white: '#161e1c',
  purple: '#b8acf0',
  gray: '#26302d',
  orange: '#da9c64',
  pink: '#45221f',
  brown: '#2e3834',
  green: '#84c1b4',
  internacao: '#a8d5f3',
  text: {
    primary: '#ebf2ef',
    secondary: '#bac8c3',
    muted: '#95a49f',
    inverse: '#081e18',
    inverse85: '#081e18D9',
    inverse20: '#081e1833',
  },
  bg: {
    light: '#0d1412',
    card: '#161e1c',
    screen: '#1e2724',
  },
  border: {
    light: '#2e3834',
    default: '#697873',
    subtle: '#26302d',
  },
  tutor: {
    primary: '#6cb4e1',
    secondary: '#7dc0ec',
  },
  vet: {
    primary: '#96dbc7',
    secondary: '#16342c',
    focusFrom: '#96dbc7',
    focusTo: '#060d0a',
  },
  auth: {
    sageStrong: '#96dbc7',
    sageTint: '#16342c',
    text: '#ebf2ef',
    muted: '#bac8c3',
    soft: '#95a49f',
    divider: '#697873',
    line: '#2e3834',
    appBg: '#0d1412',
    white: '#161e1c',
    shadowRgb: '0 0 0',
  },
  dashboard: {
    bg: '#0d1412',
    surface: '#161e1c',
    surfaceSoft: '#1e2724',
    line: '#2e3834',
    lineSoft: '#2e3834',
    lineStrong: '#697873',
    text: '#ebf2ef',
    muted: '#bac8c3',
    faint: '#95a49f',
    navIcon: '#bac8c3',
    primaryDeep: '#96dbc7',
    primaryStrong: '#96dbc7',
    successText: '#b8dcbe',
    successBg: '#1f3323',
    warm: '#ef8b80',
    warmText: '#ffbfb6',
    warmBg: '#45221f',
    warmSoft: '#45221f',
    warmLine: '#45221f',
    amber: '#da9c64',
    amberText: '#f1c8a6',
    amberBg: '#3e2815',
    amberSoft: '#3e2815',
    mutedPillBg: '#292f2d',
    mutedPillText: '#bdc7c3',
  },
} as const

export const LinhoLightColors = {
  primary: '#1D3557',
  secondary: '#FFEDD8',
  red: '#F28482',
  /*
   * Tinta de perigo — o tom que se **escreve** ou se desenha, não o coral da marca.
   *
   * `red` (#F28482) é pastel: 37% de luminância, quase a mesma do sálvia do trilho (46%). Um
   * ícone coral sobre um chip coral-sobre-sálvia dava 1,03:1 — o botão de sair era invisível,
   * e mexer na proporção da mistura não resolvia, porque hue sem diferença de brilho não vira
   * contraste. Este tom é a terracota de risco (matiz 36°) levada ao escuro até fechar 4,5:1
   * no pior estado do chip.
   */
  danger: '#752712',
  success: '#A8DADC',
  white: '#FBF7F4',
  purple: '#BDB2FF',
  gray: '#E6DFD6',
  orange: '#FFB7A1',
  pink: '#FAD2E1',
  brown: '#D5BDAF',
  green: '#84C1B4',
  internacao: '#5B6B8C',
  text: {
    primary: '#1F2F2B',
    secondary: '#5E6563',
    muted: '#79817F',
    inverse: '#ffffff',
    inverse85: '#ffffffD9',
    inverse20: '#ffffff33',
  },
  bg: {
    light: '#F0EAE3',
    card: '#F5F0EC',
    screen: '#F5F0EC',
  },
  border: {
    light: '#DDCDC4',
    default: '#C8B5A8',
    subtle: '#EADFD8',
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
   * Tinta auxiliar. Contraste é razão, não distância: baixar a superfície **reduz** a razão do
   * texto escuro, então descer as superfícies sem descer a tinta junto reprova tudo. Estes tons
   * foram resolvidos ao contrário — partindo do piso de contraste que cada papel exige contra a
   * página (a superfície mais dura), no matiz da família:
   *
   *   muted 4,5  ·  navIcon 4,0  ·  soft 3,6  ·  divider/faint 3,1
   *
   * Antes deste passe, `soft`, `faint` e o placeholder estavam em 2,1–2,7:1 — abaixo de
   * qualquer piso, inclusive o de componente. Era metade do motivo de a tela cansar: não é só
   * que o fundo brilhava, é que o que estava escrito em cima dele quase não existia.
   */
  auth: {
    sageStrong: '#6E9189',
    sageTint: '#E5EEEA',
    text: '#28332F',
    muted: '#616C69',
    soft: '#727B79',
    divider: '#7D8583',
    line: '#DDCDC4',
    appBg: '#F0EAE3',
    /** Superfície mais clara do modo — branco quebrado. Branco puro: `text.inverse`. */
    white: '#FBF7F4',
    shadowRgb: '40 51 47',
  },
  /*
   * Escada de superfícies do claro: página (`bg`) → bloco interno (`surfaceSoft`) → cartão
   * (`surface`). Os degraus são iguais em OKLCH, que é perceptualmente uniforme — passos iguais
   * em hexadecimal não se leem iguais no olho.
   *
   * O número que resolve a queixa de ofuscamento é o **pico**: a maior área clara da tela caiu
   * de 97,1% para 93,8% de luminância. Claro continua claro; o que sumiu foi a chapa de branco
   * puro. Tinta branca de verdade (texto/ícone sobre sálvia) sai de `text.inverse`, que não
   * acompanha essa escada.
   *
   * As linhas vêm junto e não por acaso. Antes deste passe, `line` ficava em 1,28:1 contra o
   * cartão e `lineSoft` em 1,18:1 — ou seja, não existiam. Com as bordas ausentes, a única
   * coisa que separava um bloco do outro era o salto de brilho, e a tela precisava ser
   * ofuscante para ser legível. Com linha de verdade, o brilho pode baixar.
   */
  dashboard: {
    /*
     * Quem pinta a página do parceiro é este, não `--clinic-bg` — que tem um único consumidor em
     * todo o `src`. Os dois espelham o mesmo degrau e precisam andar juntos: ver a justificativa
     * do giro de matiz no `clinic-tokens.css`.
     */
    bg: '#F0EAE3',
    surface: '#FBF7F4',
    surfaceSoft: '#F5F0EC',
    line: '#C8B5A8',
    lineSoft: '#DDCDC4',
    /** Linha com intenção: tracejado de estado vazio, régua estrutural. 2,5:1 no cartão. */
    lineStrong: '#84A59D',
    text: '#1F2F2B',
    muted: '#616C69',
    faint: '#7D8583',
    navIcon: '#6B7371',
    primaryDeep: '#5C7E76',
    primaryStrong: '#4F756B',
    successText: '#4B776B',
    successBg: '#EAF4F0',
    warm: '#D98E73',
    warmText: '#A2503A',
    warmBg: '#FBEEE8',
    warmSoft: '#F6EDE8',
    warmLine: '#F1E2DA',
    amber: '#C99A4E',
    amberText: '#856112',
    amberBg: '#F7F0E0',
    amberSoft: '#F7EFDC',
    mutedPillBg: '#F0EFEC',
    mutedPillText: '#716C61',
  },
} as const

export const LinhoDarkColors = {
  primary: '#DDEBE7',
  secondary: '#22342E',
  red: '#F2A09E',
  /** Mesmo papel do claro, do outro lado: tinta clara para chip escuro. 4,3:1 no pior caso. */
  danger: '#F2AE9B',
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
    /** Mesmo papel do claro. Acompanha o `--clinic-line-strong` do dark, para não haver dois. */
    lineStrong: '#335046',
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
