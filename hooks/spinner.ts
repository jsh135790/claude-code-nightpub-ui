/**
 * A run of `width` glyphs off a look's ramp, set before the spinner's word: a
 * swell that travels left to right as `tick` counts up, each cell climbing the
 * ramp to its heaviest glyph and falling back. Always `width` glyphs long, so
 * the word after it stands still.
 */
export function wave(ramp: string, tick: number, width = 6): string {
  const glyphs = [...ramp]
  const top = glyphs.length - 1
  let run = ''

  for (let i = 0; i < width; i += 1) {
    const height = 0.5 + 0.5 * Math.sin(i * 0.9 - tick * 0.6)
    run += glyphs[Math.round(height * top)] ?? ''
  }

  return run
}
