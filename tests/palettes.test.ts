import { expect, test } from 'claude-code/testing'

import { DEFAULT_LOOK, PALETTE_CHOICES, SCENE_CHOICES, isSameLook, sceneIn, toLook } from '../hooks/look'
import { PALETTES, PALETTE_IDS, desktopColors } from '../hooks/palettes'

test('Desktop paints every palette', async () => {
  for (const id of PALETTE_IDS) {
    const { problems } = desktopColors(PALETTES[id])
    const unpainted = problems.filter(line => line.startsWith("Desktop won't paint"))

    expect(unpainted).toEqual([])
  }
})

test('Desktop gets muted text brighter than NightPub ships it', async () => {
  for (const id of PALETTE_IDS) {
    const palette = PALETTES[id]

    expect(palette.desktop.textMuted).not.toBe(palette.textMuted)
  }
})

test('a new install wears ink and paper over the glyph sea', async () => {
  expect(DEFAULT_LOOK).toEqual({ palette: 'ink', scene: 'glyph-sea' })
  expect(toLook(undefined)).toEqual(DEFAULT_LOOK)
})

test('a stored look is read field by field, and a stray value is the default', async () => {
  for (const palette of PALETTE_CHOICES) {
    for (const scene of SCENE_CHOICES) {
      expect(toLook({ palette, scene })).toEqual({ palette, scene })
    }
  }
  // what an earlier version or another hand may have left there
  expect(toLook('ink')).toEqual(DEFAULT_LOOK)
  expect(toLook({ palette: 'win98', scene: 'none' })).toEqual({ palette: 'ink', scene: 'none' })
  expect(toLook({ palette: 'off', scene: 'lagoon' })).toEqual({ palette: 'off', scene: 'glyph-sea' })
  expect(isSameLook(toLook({ palette: 'off' }), { palette: 'off', scene: 'glyph-sea' })).toBe(true)
})

test('a look draws a scene only while its palette is on', async () => {
  expect(sceneIn({ palette: 'tavern', scene: 'pixel-night' })).toBe('pixel-night')
  expect(sceneIn({ palette: 'tavern', scene: 'none' })).toBeUndefined()
  // the scene is kept for when the palette comes back
  expect(sceneIn({ palette: 'off', scene: 'pixel-night' })).toBeUndefined()
})
