// Builds a page that shows each look's scene the way the desktop app would:
// through the same sanitizer, inside the same sandboxed frame.
//
//   node scripts/preview.mjs <out folder>
//
// A development script: the engine never loads it. The page wants DOMPurify
// beside it as purify.min.js (the desktop app uses 3.4.17):
//
//   npm pack dompurify@3.4.17, then copy package/dist/purify.min.js there
//
// Open <out folder>/index.html in a Chromium browser.

import { mkdirSync, writeFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { join, resolve } from 'node:path'

// The mod's files import each other without a suffix, as the engine reads them.
registerHooks({
  resolve(specifier, context, next) {
    try {
      return next(specifier, context)
    } catch (error) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/.test(specifier)) {
        return next(`${specifier}.ts`, context)
      }
      throw error
    }
  },
})

const { GLYPHS, buildGlyphSea, trace } = await import('../hooks/scenes/glyph-sea.ts')
const { PALETTES, PALETTE_IDS } = await import('../hooks/palettes.ts')
const { sceneProblems } = await import('../tests/scene-rules.ts')

const out = resolve(process.argv[2] ?? 'preview')
mkdirSync(out, { recursive: true })

const { buildPixelNight } = await import('../hooks/scenes/pixel-night.ts')

// Each scene from a palette; `quick` is the same scene with its event every
// few seconds, to watch one without waiting.
const SCENES = [
  {
    id: 'glyph-sea',
    label: '字符海',
    build: (palette, quick) =>
      buildGlyphSea({
        ink: palette.textPrimary,
        accent: palette.accent,
        ground: palette.canvas,
        ...(quick ? { ripple: { first: 1, every: 7 } } : {}),
      }),
  },
  {
    id: 'pixel-night',
    label: '像素夜景',
    build: (palette, quick) =>
      buildPixelNight({
        ground: palette.canvas,
        star: palette.textPrimary,
        town: palette.raised,
        tavern: palette.overlay,
        light: palette.warning,
        sign: palette.accent,
        dark: palette.sunken,
        smoke: palette.textSecondary,
        ...(quick ? { event: { first: 1, every: 9 } } : {}),
      }),
  },
]

const looks = SCENES.flatMap(item =>
  PALETTE_IDS.map(id => {
    const palette = PALETTES[id]
    const scene = item.build(palette, false)
    const quick = item.build(palette, true)
    const problems = sceneProblems(scene)
    writeFileSync(join(out, `scene-${item.id}-${id}.svg`), scene)
    console.log(`${item.id} ${id}: ${scene.length} characters${problems.length === 0 ? '' : `\n  ${problems.join('\n  ')}`}`)

    return { id: `${item.id}-${id}`, label: `${item.label} · ${palette.label}`, palette, scene, quick, problems }
  }),
)

// Every glyph large, in its cell, to judge the drawing.
const sheet =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Object.keys(GLYPHS).length * 14} 18" width="${Object.keys(GLYPHS).length * 84}" height="108" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">` +
  Object.values(GLYPHS)
    .map((glyph, i) => `<rect x="${i * 14 + 0.25}" y=".25" width="13.5" height="17.5" stroke-width=".1" stroke-opacity=".4"/><path d="${trace(glyph, i * 14 + 7, 9)}"/>`)
    .join('') +
  `</svg>`

const page = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>nightpub-looks preview</title>
<style>
  html, body { margin: 0; height: 100%; font: 14px/1.6 system-ui, sans-serif; color: var(--text); background: var(--canvas); }
  #backdrop { position: fixed; inset: 0; width: 100%; height: 100%; border: 0; pointer-events: none; }
  #inline { position: fixed; inset: 0; pointer-events: none; }
  #inline > svg { display: block; width: 100%; height: 100%; }
  #bar { position: fixed; top: 8px; right: 8px; z-index: 5; display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; max-width: 70vw; font-size: 12px; }
  #bar button, #bar label { background: var(--raised); color: var(--text); border: 1px solid var(--border); border-radius: 6px; padding: 3px 8px; cursor: pointer; }
  #bar button[aria-pressed="true"] { border-color: var(--accent); color: var(--accent); }
  #info { position: fixed; left: 8px; bottom: 8px; z-index: 5; font: 11px/1.4 ui-monospace, monospace; color: var(--muted); max-width: 60vw; white-space: pre-wrap; }
  .panel { background: color-mix(in srgb, var(--surface) 60%, transparent); backdrop-filter: blur(16px); border: 1px solid var(--border); border-radius: 12px; }
  #side { position: fixed; left: 8px; top: 8px; bottom: 8px; width: 260px; padding: 14px; box-sizing: border-box; color: var(--muted); }
  #main { position: relative; margin-left: 276px; height: 100%; display: flex; flex-direction: column; align-items: center; }
  #thread { flex: 1; width: min(740px, calc(100% - 48px)); padding-top: 56px; overflow: hidden; }
  #thread .you { margin: 0 0 18px auto; width: fit-content; max-width: 70%; padding: 8px 14px; }
  #thread pre { padding: 12px 14px; font: 12px/1.5 ui-monospace, monospace; overflow: hidden; }
  #composer { width: min(740px, calc(100% - 48px)); margin: 0 0 20px; padding: 14px; box-sizing: border-box; color: var(--muted); }
  body.bare #side, body.bare #main { display: none; }
  #sheet { position: fixed; left: 8px; top: 8px; z-index: 6; background: var(--canvas); border: 1px solid var(--border); padding: 8px; display: none; }
  body.sheet #sheet { display: block; }
</style>
<body>
<iframe id="backdrop" sandbox="" inert aria-hidden="true"></iframe>
<div id="inline"></div>
<div id="side" class="panel">New chat<br>Projects<br>Artifacts<br><br>Recents<br>A panel like the sidebar: the sea shows through it, frosted.</div>
<div id="main">
  <div id="thread">
    <div class="you panel">Does the sea stay out of the way of the words?</div>
    <p>The conversation has no panel of its own, so this text sits straight on the backdrop. The glyphs behind it are NightPub's: a middle dot, a colon or a hyphen in each cell, between 7% and 17% of the text colour.</p>
    <p>A ripple crosses now and then. Its crest climbs the ramp to its heaviest glyphs, and it fades as it travels. When it reaches the corner, the mark lights.</p>
    <pre class="panel">const drift = 0.5 + 0.5 * Math.sin(c * 0.31 + t * 0.5) * Math.cos(r * 0.47 - t * 0.37)
const step = drift * 2.4 + 1</pre>
    <p>Long paragraphs are the test: if the eye keeps being pulled off the line, the sea is too loud.</p>
  </div>
  <div id="composer" class="panel">Reply to Claude…</div>
</div>
<div id="sheet">${sheet}</div>
<div id="bar"></div>
<div id="info"></div>
<script src="purify.min.js"></script>
<script>
const LOOKS = ${JSON.stringify(looks).replace(/</g, '\\u003c')}
// The desktop app's own wrapper, sanitizer settings and policy (5.11492.5).
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; font-src data:; script-src 'none'; form-action 'none'"
const FRAME_CSS = ':root{color-scheme:light dark}html,body{margin:0;height:100%;background:transparent;overflow:hidden}body>svg{display:block;width:100%;height:100%}'
const state = { look: 0, quick: false, bare: false, still: false, raw: false, sheet: false, inline: false }

function sanitize(source) {
  if (source.length > 131072) return { svg: null, removed: ['over 131,072 characters'] }
  const purify = DOMPurify(window)
  purify.addHook('uponSanitizeAttribute', (node, data) => {
    const name = data.attrName
    const animated = data.attrValue.trim().toLowerCase().split(':').at(-1) ?? ''
    const keep = name.startsWith('on') ? false
      : name === 'href' || name === 'xlink:href' ? data.attrValue.trim().startsWith('#')
      : name !== 'attributename' || (animated !== '' && animated !== 'href' && !animated.startsWith('on'))
    if (!keep) data.keepAttr = false
  })
  const nodes = Array.from(purify.sanitize(source, {
    USE_PROFILES: { svg: true, svgFilters: true }, ADD_TAGS: ['animate', 'set', 'use'], ADD_ATTR: ['from', 'to', 'calcMode'],
    FORBID_TAGS: ['script', 'foreignObject', 'image', 'a', 'iframe'], ALLOW_DATA_ATTR: false, ALLOW_UNKNOWN_PROTOCOLS: false,
    FORCE_BODY: true, RETURN_DOM_FRAGMENT: true,
  }).childNodes).filter(node => node.nodeType !== Node.TEXT_NODE || node.textContent?.trim())
  const removed = purify.removed.map(item => item.element ? '<' + item.element.nodeName + '>' : item.attribute ? item.attribute.name + ' on <' + item.from.nodeName + '>' : '?')
  const [root] = nodes
  const ok = nodes.length === 1 && root instanceof Element && root.localName === 'svg'
  return { svg: ok ? root.outerHTML : null, removed }
}

function draw() {
  const look = LOOKS[state.look]
  const source = state.quick ? look.quick : look.scene
  let { svg, removed } = state.raw ? { svg: source, removed: [] } : sanitize(source)
  if (svg !== null && state.still) {
    // What the app does under reduced motion or software compositing.
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml')
    doc.querySelectorAll('animate, set, animateTransform, animateMotion').forEach(node => node.remove())
    const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style')
    style.textContent = '*{animation:none!important}'
    doc.documentElement.prepend(style)
    svg = new XMLSerializer().serializeToString(doc)
  }
  const palette = look.palette
  const root = document.documentElement.style
  root.setProperty('--canvas', palette.canvas)
  root.setProperty('--surface', palette.surface)
  root.setProperty('--raised', palette.raised)
  root.setProperty('--border', palette.borderStrong)
  root.setProperty('--text', palette.textPrimary)
  root.setProperty('--muted', palette.textMuted)
  root.setProperty('--accent', palette.accent)
  document.body.classList.toggle('bare', state.bare)
  document.body.classList.toggle('sheet', state.sheet)
  // Inline is for looking inside with the page's own tools; the frame is what the app does.
  document.getElementById('inline').innerHTML = state.inline && svg !== null ? svg : ''
  document.getElementById('backdrop').srcdoc = svg === null || state.inline ? '' : '<!doctype html><meta http-equiv="Content-Security-Policy" content="' + CSP + '"><style>' + FRAME_CSS + '</style>' + svg
  document.getElementById('info').textContent =
    look.label + ': ' + source.length + ' characters in, ' + (svg === null ? 'REFUSED' : svg.length + ' drawn') +
    '\\nsanitizer removed ' + removed.length + (removed.length ? ': ' + [...new Set(removed)].slice(0, 12).join(', ') : '') +
    (look.problems.length ? '\\nrules broken: ' + look.problems.join('; ') : '\\nno rule broken')
  const bar = document.getElementById('bar')
  bar.textContent = ''
  const button = (label, pressed, press) => {
    const node = document.createElement('button')
    node.textContent = label
    node.setAttribute('aria-pressed', String(pressed))
    node.onclick = () => { press(); draw() }
    bar.append(node)
  }
  LOOKS.forEach((item, i) => button(item.label, state.look === i, () => { state.look = i }))
  button("event every few s", state.quick, () => { state.quick = !state.quick })
  button('scene only', state.bare, () => { state.bare = !state.bare })
  button('reduced motion', state.still, () => { state.still = !state.still })
  button('unsanitized', state.raw, () => { state.raw = !state.raw })
  button('glyph sheet', state.sheet, () => { state.sheet = !state.sheet })
  button('inline', state.inline, () => { state.inline = !state.inline })
  button('restart', false, () => {})
}
for (const [key, value] of new URLSearchParams(location.search)) {
  if (key in state) state[key] = key === 'look' ? Number(value) : value !== '0'
}
draw()
</script>
</body>
</html>
`
writeFileSync(join(out, 'index.html'), page)
console.log(`wrote ${join(out, 'index.html')}`)
