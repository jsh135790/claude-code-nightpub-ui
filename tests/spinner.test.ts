import { expect, test } from 'claude-code/testing'

import { GLYPH_RAMP } from '../hooks/looks'
import { wave } from '../hooks/spinner'

test('the wave keeps its width, stays on the ramp and moves', async () => {
  const frames = Array.from({ length: 40 }, (_, tick) => wave(GLYPH_RAMP, tick))

  for (const frame of frames) {
    expect([...frame].length).toBe(6)
    expect([...frame].every(glyph => GLYPH_RAMP.includes(glyph))).toBe(true)
  }
  expect(new Set(frames).size).toBeGreaterThan(8)
  expect(frames.some(frame => frame.includes('@'))).toBe(true)
  expect(frames.some(frame => frame.includes('·'))).toBe(true)
})
