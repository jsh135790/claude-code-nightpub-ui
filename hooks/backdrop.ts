import type { SceneId } from './look'
import type { Palette } from './palettes'
import { buildGlyphSea } from './scenes/glyph-sea'
import { buildPixelNight } from './scenes/pixel-night'

/** What the Backdrop hook hands the surface: the scene's SVG and its words for a screen reader. */
export type Scene = { source: string; alt: string }

type SceneKind = {
  /** What the settings page calls it. */
  label: string
  /** Faint to heavy: the glyphs the terminal's spinner wave climbs and falls through. */
  ramp: string
  alt: string
  /** The scene's SVG in a palette. `isQuick` brings its events round every few seconds, to watch one in the preview. */
  build: (palette: Palette, isQuick?: boolean) => string
}

// A new scene is a builder in `scenes/`, a row here and its id in `look.ts`.
export const SCENES: Record<SceneId, SceneKind> = {
  'glyph-sea': {
    label: 'glyph sea',
    ramp: '·:-=+*#%@',
    alt: 'The glyph sea: faint glyphs drifting slowly on a dark ground. Now and then a ripple crosses them and lights the NightPub mark in the corner.',
    build: (palette, isQuick = false) =>
      buildGlyphSea({
        ink: palette.textPrimary,
        accent: palette.accent,
        ground: palette.canvas,
        ...(isQuick ? { ripple: { first: 1, every: 7 } } : {}),
      }),
  },
  'pixel-night': {
    label: 'pixel night',
    ramp: '░▒▓█',
    alt: 'A pixel night: a few stars, a moon, and a town along the bottom edge with its windows lit. Now and then a shooting star falls or a bat crosses the moon, and the tavern sign lights up.',
    build: (palette, isQuick = false) =>
      buildPixelNight({
        ground: palette.canvas,
        star: palette.textPrimary,
        town: palette.raised,
        tavern: palette.overlay,
        light: palette.warning,
        sign: palette.accent,
        dark: palette.sunken,
        smoke: palette.textSecondary,
        ...(isQuick ? { event: { first: 1, every: 9 } } : {}),
      }),
  },
}

const drawn = new Map<string, Scene>()

/**
 * A scene in a palette. Built once for each pair: the surface keeps its frame
 * only while the text it is handed stays the same to the letter.
 */
export function sceneOf(id: SceneId, palette: Palette): Scene {
  const key = `${id}/${palette.id}`
  let scene = drawn.get(key)

  if (scene === undefined) {
    scene = { source: SCENES[id].build(palette), alt: SCENES[id].alt }
    drawn.set(key, scene)
  }

  return scene
}
