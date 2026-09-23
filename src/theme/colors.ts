export const LightColors = {
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

export const DarkColors = {
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
