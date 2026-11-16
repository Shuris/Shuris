/**
 * Design tokens do LOL Insight.
 * Tema escuro: preto/grafite, azul elétrico como acento e dourado discreto.
 */
export const colors = {
  bg: '#07090D',
  surface: '#0E1218',
  surfaceAlt: '#141922',
  surfaceHigh: '#1B222D',
  border: '#1F2733',
  borderSoft: '#171D27',

  text: '#F1F3F6',
  textSecondary: '#A7B0BE',
  textMuted: '#6C7687',

  accent: '#2F7DFF',
  accentSoft: '#5C9BFF',
  accentDim: 'rgba(47,125,255,0.14)',
  gold: '#C9A45C',
  goldDim: 'rgba(201,164,92,0.14)',

  win: '#3D8BFF',
  winDim: 'rgba(61,139,255,0.14)',
  loss: '#E5606A',
  lossDim: 'rgba(229,96,106,0.13)',

  // Séries categóricas dos gráficos (ordem fixa, validada para superfície escura)
  series1: '#3987E5',
  series2: '#C98500',

  good: '#2FB380',
  warning: '#D9A441',
  grid: 'rgba(255,255,255,0.06)',
  overlay: 'rgba(3,5,8,0.72)',
} as const;

/**
 * Pacote "Piltover elegante":
 * - title: Marcellus SC, para títulos, nomes de elo e a marca (versaletes clássicos).
 * - display/displayBold: Rajdhani, para números e valores curtos.
 * - body*: Manrope, para textos corridos e rótulos.
 */
export const fonts = {
  title: 'MarcellusSC_400Regular',
  display: 'Rajdhani_600SemiBold',
  displayBold: 'Rajdhani_700Bold',
  body: 'Manrope_500Medium',
  bodySemi: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 } as const;
export const radius = { sm: 8, md: 12, lg: 16, xl: 22, pill: 999 } as const;

export const type = {
  h1: { fontFamily: fonts.title, fontSize: 25, color: colors.text, letterSpacing: 0.2 },
  h2: { fontFamily: fonts.title, fontSize: 18, color: colors.text, letterSpacing: 0.2 },
  h3: { fontFamily: fonts.bodyBold, fontSize: 14, color: colors.text },
  body: { fontFamily: fonts.body, fontSize: 14, color: colors.text },
  bodySm: { fontFamily: fonts.body, fontSize: 12.5, color: colors.textSecondary },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 10.5,
    color: colors.textMuted,
    letterSpacing: 0.9,
    textTransform: 'uppercase' as const,
  },
  /** Tag do Riot ID (#BR1) ao lado de um título: em Marcellus o "1" se confunde com "I". */
  tag: { fontFamily: fonts.display, color: colors.textMuted, letterSpacing: 0.3 },
  number: { fontFamily: fonts.displayBold, fontSize: 23, color: colors.text, letterSpacing: 0 },
} as const;
