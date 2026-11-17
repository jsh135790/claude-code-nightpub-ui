import { PALETTES } from './palettes'
import type { Palette } from './palettes'

/** A backdrop scene by the name `$.theme.set` carries and the Backdrop hook is asked for. */
export type SceneId = 'glyph-sea'

/**
 * One look: a palette, the scene behind the chat, and the glyphs its spinner
 * runs through. A look is data: a new one is a row in `LOOKS`, and a new scene
 * a builder in `scenes/` with its row in `backdrop.ts`. Two looks may wear the
 * same palette.
 */
export type Look = {
  /** What `/look` takes and `$.store` keeps. */
  id: string
  /** What `/look` calls it. */
  label: string
  palette: Palette
  scene: SceneId
  /** Faint to heavy; the spinner's wave climbs and falls through it. */
  spinnerRamp: string
  /** The terminal theme that goes with it, as `/theme` lists it. */
  terminalTheme: string
}

/** NightPub's glyph ramp without its leading blank. */
export const GLYPH_RAMP = '·:-=+*#%@'

/** The glyph sea in one of NightPub's palettes, named after the palette. */
function glyphSea(palette: Palette): Look {
  return {
    id: palette.id,
    label: palette.label,
    palette,
    scene: 'glyph-sea',
    spinnerRamp: GLYPH_RAMP,
    terminalTheme: `NightPub · ${palette.label}`,
  }
}

/** Every look, in the order `/look` lists them. */
export const LOOKS = {
  ink: glyphSea(PALETTES.ink),
  tavern: glyphSea(PALETTES.tavern),
  midnight: glyphSea(PALETTES.midnight),
} satisfies Record<string, Look>

export type LookId = keyof typeof LOOKS

/** What `/look` keeps across sessions: a look's id, or `off`. */
export type Choice = LookId | 'off'

export const LOOK_IDS = Object.keys(LOOKS) as LookId[]

export const DEFAULT_LOOK: LookId = 'ink'

export function isLookId(value: unknown): value is LookId {
  return typeof value === 'string' && (LOOK_IDS as readonly string[]).includes(value)
}

/** What a stored or typed choice comes to; anything unknown is the default look. */
export function toChoice(value: unknown): Choice {
  if (value === 'off') {
    return 'off'
  }

  return isLookId(value) ? value : DEFAULT_LOOK
}
