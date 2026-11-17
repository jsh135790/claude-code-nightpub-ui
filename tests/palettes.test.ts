import { expect, test } from 'claude-code/testing'

import { DEFAULT_LOOK, LOOKS, LOOK_IDS, toChoice } from '../hooks/looks'
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

test('every look goes by its own id, and a stray choice falls back to the default', async () => {
  for (const id of LOOK_IDS) {
    // A look is found by its own id: two looks may wear one palette.
    expect(LOOKS[id].id).toBe(id)
    expect(Object.values(PALETTES)).toContain(LOOKS[id].palette)
    expect(toChoice(id)).toBe(id)
  }
  expect(toChoice('off')).toBe('off')
  expect(toChoice(undefined)).toBe(DEFAULT_LOOK)
  expect(toChoice('win98')).toBe(DEFAULT_LOOK)
})
