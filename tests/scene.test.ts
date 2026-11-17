import { expect, test } from 'claude-code/testing'

import { SCENES, sceneOf } from '../hooks/backdrop'
import { SCENE_IDS } from '../hooks/look'
import { PALETTES, PALETTE_IDS } from '../hooks/palettes'
import { buildGlyphSea } from '../hooks/scenes/glyph-sea'
import { sceneProblems } from './scene-rules'

test('every scene in every palette gets past the engine, the sanitizer and the frame', () => {
  for (const scene of SCENE_IDS) {
    for (const id of PALETTE_IDS) {
      const { source, alt } = sceneOf(scene, PALETTES[id])

      expect(sceneProblems(source)).toEqual([])
      expect(alt.length).toBeGreaterThan(10)
    }
  }
})

test('a scene is the same text each time it is built', () => {
  // The surface keeps its frame only while the text stays the same, and a
  // reload builds it again.
  const input = { ink: '#e9e7e3', accent: '#a3b6dc', ground: '#121212' }

  expect(buildGlyphSea(input)).toBe(buildGlyphSea(input))
  expect(sceneOf('glyph-sea', PALETTES.ink).source).toBe(buildGlyphSea(input))

  for (const scene of SCENE_IDS) {
    expect(SCENES[scene].build(PALETTES.tavern)).toBe(SCENES[scene].build(PALETTES.tavern))
    // and a palette's scene is built once: the same value, not only the same text
    expect(sceneOf(scene, PALETTES.tavern)).toBe(sceneOf(scene, PALETTES.tavern))
    expect(sceneOf(scene, PALETTES.tavern).source).not.toBe(sceneOf(scene, PALETTES.midnight).source)
  }
})

test('a scene wears its palette', () => {
  for (const id of PALETTE_IDS) {
    const palette = PALETTES[id]
    const sea = sceneOf('glyph-sea', palette).source
    const night = sceneOf('pixel-night', palette).source

    expect(sea).toContain(`fill="${palette.canvas}"`)
    expect(sea).toContain(`color="${palette.textPrimary}"`)
    expect(sea).toContain(`stroke="${palette.accent}"`)
    // the night's ground, its stars, its lit windows and the tavern's sign
    expect(night).toContain(`fill="${palette.canvas}"`)
    expect(night).toContain(`fill="${palette.textPrimary}"`)
    expect(night).toContain(`fill="${palette.warning}"`)
    expect(night).toContain(`fill="${palette.accent}"`)
  }
})

test('the ripples come when asked', () => {
  const quick = buildGlyphSea({ ink: '#fff', accent: '#f80', ground: '#000', ripple: { first: 1, every: 7 } })

  // Three origins take turns: each begins `every` after the one before and
  // comes round again after all three.
  expect(quick).toContain('begin="1s;npw0.begin+21s"')
  expect(quick).toContain('begin="8s;npw1.begin+21s"')
  expect(quick).toContain('begin="15s;npw2.begin+21s"')
})

test("the pixel night's events take turns, a minute apart", () => {
  const night = SCENES['pixel-night'].build(PALETTES.ink)

  // a shooting star, the bat, the other shooting star, the bat: round again after all four
  expect(night).toContain('begin="8s;npe0.begin+240s"')
  expect(night).toContain('begin="68s;npe1.begin+240s"')
  expect(night).toContain('begin="128s;npe2.begin+240s"')
  expect(night).toContain('begin="188s;npe3.begin+240s"')

  const quick = SCENES['pixel-night'].build(PALETTES.ink, true)

  expect(quick).toContain('begin="1s;npe0.begin+36s"')
  expect(quick).toContain('begin="10s;npe1.begin+36s"')
})

test('between its events the pixel night moves in steps alone', () => {
  const night = SCENES['pixel-night'].build(PALETTES.ink)

  // A step draws once and waits; a loop that never ends, or a stylesheet's
  // animation, would have the whole window drawn again on every frame.
  expect(night).not.toContain('repeatCount="indefinite"')
  expect(night).not.toContain('@keyframes')
  expect(night).not.toContain('animation:')
  // what does glide, the shooting stars and the bat, begins with an event and ends
  const glides = night.match(/<animate(Transform)? [^>]*>/g) ?? []

  expect(glides.length).toBeGreaterThan(0)
  for (const glide of glides) {
    expect(glide).toMatch(/begin="[^"]*npe\d\.begin/)
  }
})

test('the rules a scene is held to do catch what they name', () => {
  const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`

  expect(sceneProblems(svg('<rect width="1" height="1"/>'))).toEqual([])
  expect(sceneProblems(svg('<script>1</script>'))).toContain('a <script>')
  expect(sceneProblems(svg('<use href="https://example.com/a.svg#b"/>'))).toContain('an href that is not "#id"')
  expect(sceneProblems(svg('<rect id="title"/>'))).toContain('id "title" without the np prefix')
  expect(sceneProblems(svg('<set attributeName="x" to="1" begin="np-a.begin"/>'))).toContain('begin "np-a.begin" waits on an id with a hyphen')
  expect(sceneProblems(svg('<style>a{b:"<c"}</style>'))).toContain('a < inside <style>')
})
