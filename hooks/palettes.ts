import type { ThemeColors } from 'claude-code'

import { makeColors } from './make-colors.js'

export type PaletteId = 'ink' | 'tavern' | 'midnight'

/**
 * One NightPub dark theme: its tokens as NightPub ships them
 * (`web/src/theme/built-in-themes.ts`, `web/src/styles/tokens.css`).
 */
export type Palette = {
  id: PaletteId
  label: string
  canvas: string
  surface: string
  raised: string
  overlay: string
  sunken: string
  borderSubtle: string
  borderStrong: string
  textPrimary: string
  textSecondary: string
  textMuted: string
  textOnAccent: string
  accent: string
  accentHover: string
  accentSoft: string
  danger: string
  warning: string
  success: string
  info: string
  bubbleUserBg: string
  bubbleUserBorder: string
  /**
   * What Desktop draws in place of two tokens. Its contrast check wants muted
   * text brighter than NightPub's on every fill, so the menu layer folds into
   * `raised` and muted text moves a third of the way toward secondary. The
   * terminal themes keep NightPub's values.
   */
  desktop: { surface3: string; textMuted: string }
}

export const PALETTES: Record<PaletteId, Palette> = {
  ink: {
    id: 'ink',
    label: '墨与纸',
    canvas: '#121212',
    surface: '#181818',
    raised: '#202020',
    overlay: '#272727',
    sunken: '#0b0b0b',
    borderSubtle: '#272727',
    borderStrong: '#3a3a3a',
    textPrimary: '#e9e7e3',
    textSecondary: '#a9a7a2',
    textMuted: '#797773',
    textOnAccent: '#111a2b',
    accent: '#a3b6dc',
    accentHover: '#bccbe7',
    accentSoft: '#222a38',
    danger: '#e26a61',
    warning: '#d8a35c',
    success: '#80b98b',
    info: '#7dbcb4',
    bubbleUserBg: '#1e1f21',
    bubbleUserBorder: '#2c2e31',
    desktop: { surface3: '#202020', textMuted: '#8c8a86' },
  },
  tavern: {
    id: 'tavern',
    label: '酒馆暖光',
    canvas: '#13110e',
    surface: '#1a1713',
    raised: '#221e19',
    overlay: '#2a251f',
    sunken: '#0d0b09',
    borderSubtle: '#2c2620',
    borderStrong: '#40382e',
    textPrimary: '#ede5d8',
    textSecondary: '#b3a794',
    textMuted: '#827663',
    textOnAccent: '#201507',
    accent: '#d9a55a',
    accentHover: '#e7ba78',
    accentSoft: '#3a2d1b',
    danger: '#e2675a',
    warning: '#e88a4c',
    success: '#97bf74',
    info: '#82a9cb',
    bubbleUserBg: '#2a231b',
    bubbleUserBorder: '#3b3126',
    desktop: { surface3: '#221e19', textMuted: '#918572' },
  },
  midnight: {
    id: 'midnight',
    label: '午夜靛蓝',
    canvas: '#0f1020',
    surface: '#15172b',
    raised: '#1c1e37',
    overlay: '#232643',
    sunken: '#0a0b17',
    borderSubtle: '#252845',
    borderStrong: '#373b60',
    textPrimary: '#e8e7f3',
    textSecondary: '#a8a7c4',
    textMuted: '#777694',
    textOnAccent: '#2b1508',
    accent: '#eaa97c',
    accentHover: '#f2bd97',
    accentSoft: '#382937',
    danger: '#ee6f80',
    warning: '#e6c66c',
    success: '#76c79f',
    info: '#8ea6f2',
    bubbleUserBg: '#202342',
    bubbleUserBorder: '#2e3259',
    desktop: { surface3: '#1c1e37', textMuted: '#8685a2' },
  },
}

export const PALETTE_IDS: readonly PaletteId[] = ['ink', 'tavern', 'midnight']

const made = new Map<PaletteId, { theme: ThemeColors; problems: string[] }>()

/** The palette as Desktop's colours, and what its check still says about them. */
export function desktopColors(palette: Palette): { theme: ThemeColors; problems: string[] } {
  const known = made.get(palette.id)

  if (known !== undefined) {
    return known
  }

  const colors = makeColors({
    label: `NightPub · ${palette.label}`,
    only: 'dark',
    roles: {
      accent: palette.accent,
      danger: palette.danger,
      success: palette.success,
      warning: palette.warning,
      pro: palette.info,
    },
    dark: {
      gray: {
        anchors: {
          'surface-0': palette.canvas,
          'surface-1': palette.surface,
          'surface-2': palette.raised,
          'surface-3': palette.desktop.surface3,
          'text-primary': palette.textPrimary,
          'text-secondary': palette.textSecondary,
          'text-muted': palette.desktop.textMuted,
        },
      },
    },
  })
  made.set(palette.id, colors)

  return colors
}
