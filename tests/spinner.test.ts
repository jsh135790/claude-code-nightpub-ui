import { expect, test } from 'claude-code/testing'

import { SCENES } from '../hooks/backdrop'
import { SCENE_IDS } from '../hooks/look'
import { wave } from '../hooks/spinner'

test("the wave keeps its width, stays on its scene's ramp and moves", async () => {
  for (const scene of SCENE_IDS) {
    const { ramp } = SCENES[scene]
    const glyphs = [...ramp]
    const frames = Array.from({ length: 40 }, (_, tick) => wave(ramp, tick))

    for (const frame of frames) {
      expect([...frame].length).toBe(6)
      expect([...frame].every(glyph => glyphs.includes(glyph))).toBe(true)
    }
    expect(new Set(frames).size).toBeGreaterThan(8)
    // it climbs to the heaviest glyph and falls back to the faintest
    expect(frames.some(frame => frame.includes(glyphs[glyphs.length - 1] ?? ''))).toBe(true)
    expect(frames.some(frame => frame.includes(glyphs[0] ?? ''))).toBe(true)
  }
})

test('the two scenes run different glyphs', async () => {
  expect(SCENES['glyph-sea'].ramp).toBe('·:-=+*#%@')
  expect(SCENES['pixel-night'].ramp).toBe('░▒▓█')
})
