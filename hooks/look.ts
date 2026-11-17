import type { LookChoice } from '../types'
import { PALETTE_IDS } from './palettes'

export type { LookChoice }

/** A NightPub palette by its id, or `off`: the panel in its own colours and no theme set. */
export type PaletteChoice = LookChoice['palette']

/** A backdrop scene by its id, or `none`: the palette's ground alone. */
export type SceneChoice = LookChoice['scene']

/** A scene by the name `$.theme.set` carries and the Backdrop hook is asked for. */
export type SceneId = Exclude<SceneChoice, 'none'>

export const SCENE_IDS: readonly SceneId[] = ['glyph-sea', 'pixel-night']

/** What the settings page steps through, in this order. */
export const PALETTE_CHOICES: readonly PaletteChoice[] = [...PALETTE_IDS, 'off']
export const SCENE_CHOICES: readonly SceneChoice[] = [...SCENE_IDS, 'none']

/** A new install: ink and paper over the glyph sea. */
export const DEFAULT_LOOK: LookChoice = { palette: 'ink', scene: 'glyph-sea' }

/**
 * A stored look read field by field: a palette or a scene this version does
 * not have is the default's, so a store written by a later version is safe.
 */
export function toLook(value: unknown): LookChoice {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_LOOK
  }
  const { palette, scene } = value as Record<string, unknown>

  return {
    palette: PALETTE_CHOICES.find(choice => choice === palette) ?? DEFAULT_LOOK.palette,
    scene: SCENE_CHOICES.find(choice => choice === scene) ?? DEFAULT_LOOK.scene,
  }
}

export function isSameLook(a: LookChoice, b: LookChoice): boolean {
  return a.palette === b.palette && a.scene === b.scene
}

/** The scene a look draws: none while its palette is off, whatever scene it keeps for later. */
export function sceneIn(look: LookChoice): SceneId | undefined {
  return look.palette === 'off' || look.scene === 'none' ? undefined : look.scene
}
