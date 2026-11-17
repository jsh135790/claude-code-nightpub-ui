import { expect, test } from 'claude-code/testing'

import { sceneOf } from '../hooks/backdrop'
import { LOOKS, LOOK_IDS } from '../hooks/looks'
import { buildGlyphSea } from '../hooks/scenes/glyph-sea'
import { sceneProblems } from './scene-rules'

test("every look's scene gets past the engine, the sanitizer and the frame", () => {
  for (const id of LOOK_IDS) {
    expect(sceneProblems(sceneOf(LOOKS[id]).source)).toEqual([])
  }
})

test('a scene is the same text each time it is built', () => {
  // The surface keeps its frame only while the text stays the same, and a
  // reload builds it again.
  const input = { ink: '#e9e7e3', accent: '#a3b6dc', ground: '#121212' }

  expect(buildGlyphSea(input)).toBe(buildGlyphSea(input))
  expect(sceneOf(LOOKS.ink).source).toBe(buildGlyphSea(input))
})

test('a scene wears its look: the ground, the ink and the accent', () => {
  for (const id of LOOK_IDS) {
    const { palette } = LOOKS[id]
    const { source, alt } = sceneOf(LOOKS[id])

    expect(source).toContain(`fill="${palette.canvas}"`)
    expect(source).toContain(`color="${palette.textPrimary}"`)
    expect(source).toContain(`stroke="${palette.accent}"`)
    expect(alt.length).toBeGreaterThan(10)
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

test('the rules a scene is held to do catch what they name', () => {
  const svg = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg">${body}</svg>`

  expect(sceneProblems(svg('<rect width="1" height="1"/>'))).toEqual([])
  expect(sceneProblems(svg('<script>1</script>'))).toContain('a <script>')
  expect(sceneProblems(svg('<use href="https://example.com/a.svg#b"/>'))).toContain('an href that is not "#id"')
  expect(sceneProblems(svg('<rect id="title"/>'))).toContain('id "title" without the np prefix')
  expect(sceneProblems(svg('<set attributeName="x" to="1" begin="np-a.begin"/>'))).toContain('begin "np-a.begin" waits on an id with a hyphen')
  expect(sceneProblems(svg('<style>a{b:"<c"}</style>'))).toContain('a < inside <style>')
})
