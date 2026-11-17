import { MARK_CELL, MARK_COLS, MARK_COVER, MARK_ROWS } from './mark-cells'

/**
 * The glyph sea, NightPub's landing backdrop (`web/src/backdrop/glyph-field.ts`),
 * as one SVG that runs no script: a field of faint glyphs that drifts, a
 * ripple that crosses it now and then, and the NightPub mark, which stands
 * hidden in a corner until a ripple lights it.
 *
 * What makes it possible without a script: NightPub's drift,
 * `sin(c·0.31 + 0.5t) · cos(r·0.47 − 0.37t)`, is one fixed texture sliding
 * left and down, so the sea is that texture as a pattern whose origin steps a
 * cell at a time. The cells stay put and their glyphs change.
 *
 * Nothing here needs a font: every glyph is drawn as strokes, so the sea is
 * the same on every machine.
 */
export type GlyphSeaInput = {
  /** The sea's glyphs and its ripples': the look's text colour. */
  ink: string
  /** The mark's glyphs: the look's accent. */
  accent: string
  /** What the sea lies on: the look's page colour. */
  ground: string
  /** Seconds to the first ripple and between ripples. */
  ripple?: { first: number; every: number }
}

// The sea's grid: loose cells, a glyph with air beside it.
const CW = 14
const CH = 18
// One period of the drift each way, in cells: 2π / 0.31 and 2π / 0.47.
const COLS = 20
const ROWS = 13
const TILE_W = COLS * CW
// Two periods tall, so the tile is whole device pixels at 125%, 150% and 175%.
const TILE_H = 2 * ROWS * CH
// Seconds a cell: the texture crosses a period in 2π / 0.5 and 2π / 0.37 seconds.
const STEP_X = 0.63
const STEP_Y = 1.31

// A ripple: its crest travels SPEED px a second, is exp(-d² / BAND) thick and
// loses FADE of itself a second, as an exponent, until LIFE.
const SPEED = 340
const BAND = 1800
const FADE = 0.6
const LIFE = 4.5
// How much of NightPub's brightness a ripple keeps. There a press asks for
// it; here it comes unasked, behind words someone is reading.
const WAVE_GAIN = 0.6

// Where the mark stands: its glyphs end this far past the scene's right and
// bottom edges, so it looks in from the corner.
const MARK_OUT = { x: 70, y: 40 }
const MARK_GAIN = 0.85
// How long the mark stays lit once the ripple has crossed all of it, and how
// long it takes to go.
const MARK_HOLD = 0.5
const MARK_DIM = 2.6

type Point = readonly [number, number]
/** A glyph as strokes; a stroke of one point is a dot. */
type Glyph = readonly (readonly Point[])[]

function ring(cx: number, cy: number, rx: number, ry = rx, from = 0, to = 360, steps = 12): Point[] {
  const points: Point[] = []

  for (let i = 0; i <= steps; i += 1) {
    const angle = ((from + ((to - from) * i) / steps) * Math.PI) / 180
    points.push([cx + rx * Math.cos(angle), cy + ry * Math.sin(angle)])
  }

  return points
}

/** NightPub's ramp, ` ·:-=+*#%@`, drawn for a 13 px face around a cell's centre. */
export const GLYPHS = {
  dot: [[[0, 0]]],
  colon: [[[0, -2.7]], [[0, 2.7]]],
  dash: [
    [
      [-2.8, 0],
      [2.8, 0],
    ],
  ],
  equals: [
    [
      [-3, -1.7],
      [3, -1.7],
    ],
    [
      [-3, 1.7],
      [3, 1.7],
    ],
  ],
  plus: [
    [
      [-3, 0],
      [3, 0],
    ],
    [
      [0, -3],
      [0, 3],
    ],
  ],
  star: [
    [
      [0, -3.1],
      [0, 3.1],
    ],
    [
      [-2.7, -1.55],
      [2.7, 1.55],
    ],
    [
      [-2.7, 1.55],
      [2.7, -1.55],
    ],
  ],
  hash: [
    [
      [-1, -4.3],
      [-2, 4.3],
    ],
    [
      [2, -4.3],
      [1, 4.3],
    ],
    [
      [-3.3, -1.5],
      [3.5, -1.5],
    ],
    [
      [-3.5, 1.5],
      [3.3, 1.5],
    ],
  ],
  percent: [
    [
      [2.9, -4.3],
      [-2.9, 4.3],
    ],
    ring(-2.2, -2.9, 1.3, 1.3, 0, 360, 8),
    ring(2.2, 2.9, 1.3, 1.3, 0, 360, 8),
  ],
  // An open ring that turns in at the right and runs down into the bowl.
  at: [
    [...ring(0, 0.1, 3.7, 4.6, 50, 355), [3.7, 1.1], [3.2, 2.2], [2.4, 2.2], [2, 1.4]],
    ring(0.5, 0.2, 1.5, 1.9, 0, 360, 10),
  ],
} satisfies Record<string, Glyph>

/** A number as short as SVG takes it: one decimal, no leading zero. */
function num(value: number, digits = 1): string {
  let text = value.toFixed(digits)

  if (text.includes('.')) {
    text = text.replace(/0+$/, '').replace(/\.$/, '')
  }

  if (text === '-0') {
    return '0'
  }

  return text.replace(/^(-?)0\./, '$1.')
}

/** A glyph's path data, its centre at (cx, cy). */
export function trace(glyph: Glyph, cx: number, cy: number, scale = 1): string {
  let d = ''

  for (const stroke of glyph) {
    const [first, ...rest] = stroke

    if (first === undefined) {
      continue
    }
    d += `M${num(cx + first[0] * scale)} ${num(cy + first[1] * scale)}`
    // A stroke of no length draws its round cap: a dot.
    d += rest.length === 0 ? 'h.01' : rest.map(point => ` ${num(cx + point[0] * scale)} ${num(cy + point[1] * scale)}`).join('')
  }

  return d
}

/**
 * The sea's texture, two periods tall: each cell's glyph and weight are how
 * high NightPub's drift stands there, at their brightest. The patterns that
 * show it set how bright that is.
 */
function seaGlyphs(): string {
  const dots = new Map<number, string>()
  const dashes = new Map<number, string>()

  for (let r = 0; r < 2 * ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const drift = 0.5 + 0.5 * Math.sin((2 * Math.PI * c) / COLS) * Math.cos((2 * Math.PI * r) / ROWS)
      const step = Math.floor(drift * 2.4 + 1)
      // NightPub's 0.07 to 0.17, in six levels.
      const level = Math.round((0.07 + drift * 0.1) * 50)
      const cx = c * CW + CW / 2
      const cy = r * CH + CH / 2

      if (step >= 3) {
        dashes.set(level, (dashes.get(level) ?? '') + trace(GLYPHS.dash, cx, cy))
      } else {
        dots.set(level, (dots.get(level) ?? '') + trace(step === 2 ? GLYPHS.colon : GLYPHS.dot, cx, cy))
      }
    }
  }
  const brightest = Math.max(...dots.keys(), ...dashes.keys())
  const paths = (levels: Map<number, string>, width: string) =>
    [...levels.entries()]
      .sort(([a], [b]) => a - b)
      .map(([level, d]) => `<path stroke-width="${width}" stroke-opacity="${num(level / brightest, 2)}" d="${d}"/>`)
      .join('')

  return `<g id="np-g" fill="none" stroke="currentColor" stroke-linecap="round">${paths(dots, '1.9')}${paths(dashes, '1.3')}</g>`
}

/** The steps of one axis of the drift: the pattern's origin, moved a cell at a time. */
function driftSteps(axis: 'x' | 'y', steps: number, cell: number, seconds: number): string {
  // A clock's id has no hyphen: in a begin value a hyphen starts a negative
  // offset, so Chromium reads `np-cx.begin` as `np` minus something.
  const clock = `npc${axis}`
  const period = num(steps * seconds, 2)
  let sets = `<set id="${clock}" attributeName="${axis}" to="0" begin="0s;${clock}.begin+${period}s" dur="${period}s"/>`

  // Each step holds to the end of the period, and the one begun last wins.
  for (let k = 1; k < steps; k += 1) {
    sets += `<set attributeName="${axis}" to="${k * cell}" begin="${clock}.begin+${num(k * seconds, 2)}s" dur="${num((steps - k) * seconds, 2)}s"/>`
  }

  return sets
}

/** A tile of heavier glyphs for a ripple's crest, on the ground so it covers the sea under it. */
function crestTile(id: string, rows: readonly (readonly Glyph[])[], ground: string, alpha: number): string {
  const width = (rows[0]?.length ?? 0) * CW
  const height = rows.length * CH
  const d = rows.map((row, r) => row.map((glyph, c) => trace(glyph, c * CW + CW / 2, r * CH + CH / 2)).join('')).join('')

  return (
    `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" fill="${ground}"/>` +
    `<path fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${num(alpha, 2)}" d="${d}"/>` +
    `</pattern>`
  )
}

/** One of the mark's glyphs as a tile its cells are filled with. */
function markTile(id: string, glyph: Glyph, input: GlyphSeaInput): string {
  const { width, height } = MARK_CELL
  // The mark is set in an 11 px face, the sea in 13.
  const scale = 11 / 13
  const weight = glyph === GLYPHS.colon ? 1.6 : 1.15

  return (
    `<pattern id="${id}" patternUnits="userSpaceOnUse" width="${width}" height="${height}">` +
    `<rect width="${width}" height="${height}" fill="${input.ground}"/>` +
    `<path fill="none" stroke="${input.accent}" stroke-width="${weight}" stroke-linecap="round" stroke-linejoin="round" d="${trace(glyph, width / 2, height / 2, scale)}"/>` +
    `</pattern>`
  )
}

/** The mark's cells of one kind, as whole-cell boxes: runs along a row are one box. */
function markCells(isWanted: (cover: number) => boolean): string {
  const { width, height } = MARK_CELL
  let d = ''

  MARK_COVER.forEach((row, r) => {
    let start = -1

    for (let c = 0; c <= row.length; c += 1) {
      const cover = Number(row[c])
      const wanted = Number.isFinite(cover) && isWanted(cover)

      if (wanted && start === -1) {
        start = c
      }

      if (!wanted && start !== -1) {
        const run = (c - start) * width
        d += `M${start * width} ${r * height}h${run}v${height}h-${run}z`
        start = -1
      }
    }
  })

  return d
}

/** The values of a SMIL animation sampled at `times`, with their key times over `dur`. */
function keys(times: readonly number[], dur: number, value: (t: number) => number, digits = 1): string {
  return `values="${times.map(t => num(value(t), digits)).join(';')}" keyTimes="${times.map(t => num(t / dur, 4)).join(';')}"`
}

/** How wide the part of a ripple above `floor` is at age `t`, in px; 0 once it has sunk under it. */
function bandWidth(floor: number, t: number): number {
  const room = -FADE * t - Math.log(floor)

  return room <= 0 ? 0 : 2 * Math.sqrt(BAND * room)
}

/** The ages a band is sampled at: evenly to the moment it is gone, then the ripple's end. */
function bandTimes(floor: number, samples: number): number[] {
  const gone = Math.min(LIFE, -Math.log(floor) / FADE)
  const times = Array.from({ length: samples + 1 }, (_, i) => (gone * i) / samples)

  return gone < LIFE ? [...times, LIFE] : times
}

/** The whole scene for one look. The same input gives the same text. */
export function buildGlyphSea(input: GlyphSeaInput): string {
  const { first, every } = input.ripple ?? { first: 6, every: 60 }
  const markWidth = MARK_COLS * MARK_CELL.width
  const markHeight = MARK_ROWS * MARK_CELL.height
  // The mark's own box against the scene's bottom right corner.
  const markLeft = -(markWidth - 4 * MARK_CELL.width - MARK_OUT.x)
  const markTop = -(markHeight - 3 * MARK_CELL.height - MARK_OUT.y)
  // Where the ripples start, in px from that corner, so each one's way to the
  // mark is the same in every window: from the mark's own face, then from
  // further off, where it arrives weaker and lights the mark less.
  const origins: readonly Point[] = [
    [markLeft + markWidth / 2, markTop + markHeight / 2],
    [-900, -520],
    [-560, -800],
  ]
  const cycle = origins.length * every
  const corners: readonly Point[] = [
    [markLeft + 4 * MARK_CELL.width, markTop + 2 * MARK_CELL.height],
    [markLeft + markWidth - 4 * MARK_CELL.width, markTop + 2 * MARK_CELL.height],
    [markLeft + 4 * MARK_CELL.width, markTop + markHeight - 3 * MARK_CELL.height],
    [markLeft + markWidth - 4 * MARK_CELL.width, markTop + markHeight - 3 * MARK_CELL.height],
  ]

  const style =
    origins.map(([x, y], k) => `.np-o${k}{cx:calc(100% - ${num(-x)}px);cy:calc(100% - ${num(-y)}px)}`).join('') +
    // In a narrow box the mark would stand behind the words.
    '@media (max-width:760px){.np-mark{display:none}}'

  const heavyTimes = bandTimes(0.7, 5)
  const midTimes = bandTimes(0.4, 5)
  const lightTimes = bandTimes(0.05, 6)
  let ripples = ''
  let marks = ''
  let reveals = ''

  origins.forEach(([x, y], k) => {
    const clock = `npw${k}`
    const begin = `${clock}.begin`
    const grow = `attributeName="r" values="0;${SPEED * LIFE}" dur="${LIFE}s"`
    const circle = (tile: string, body: string) =>
      `<circle class="np-o${k}" r="0" fill="none" stroke="url(#${tile})" stroke-width="0">${body}</circle>`

    ripples +=
      `<g visibility="hidden"><set attributeName="visibility" to="visible" begin="${begin}" dur="${LIFE}s"/>` +
      // The ripple's skirt is the sea itself, lit: the same glyphs in the same cells.
      circle(
        'np-lit',
        `<animate id="${clock}" ${grow} begin="${num(first + k * every, 2)}s;${begin}+${cycle}s"/>` +
          `<animate attributeName="stroke-width" ${keys(lightTimes, LIFE, t => bandWidth(0.05, t))} dur="${LIFE}s" begin="${begin}"/>` +
          `<animate attributeName="stroke-opacity" ${keys(lightTimes, LIFE, t => WAVE_GAIN * Math.exp(-FADE * t), 2)} dur="${LIFE}s" begin="${begin}"/>`,
      ) +
      circle(
        'np-mid',
        `<animate ${grow} begin="${begin}"/>` +
          `<animate attributeName="stroke-width" ${keys(midTimes, LIFE, t => bandWidth(0.4, t))} dur="${LIFE}s" begin="${begin}"/>`,
      ) +
      circle(
        'np-heavy',
        `<animate ${grow} begin="${begin}"/>` +
          `<animate attributeName="stroke-width" ${keys(heavyTimes, LIFE, t => bandWidth(0.7, t))} dur="${LIFE}s" begin="${begin}"/>`,
      ) +
      `</g>`

    // The mark takes its light from the ripple as it arrives: the further the
    // ripple has come, the weaker, and under 0.6 the outline is set lighter.
    const reach = corners.map(([cx, cy]) => Math.hypot(cx - x, cy - y))
    const far = Math.max(...reach) / SPEED
    const near = k === 0 ? 0 : Math.min(...reach) / SPEED
    const light = Math.min(1, 2.2 * Math.exp((-FADE * (near + far)) / 2))
    const lit = far + MARK_HOLD
    const span = lit + MARK_DIM
    const core = light > 0.6 ? 'np-m-at' : light > 0.45 ? 'np-m-hash' : 'np-m-plus'
    const rim = light > 0.36 ? 'np-m-plus' : 'np-m-colon'

    marks +=
      `<g opacity="0"><animate attributeName="opacity" values="${num(light * MARK_GAIN, 2)};${num(light * MARK_GAIN, 2)};0" keyTimes="0;${num(lit / span, 4)};1" dur="${num(span, 2)}s" begin="${begin}"/>` +
      `<use href="#np-core" fill="url(#${core})"/><use href="#np-rim" fill="url(#${rim})" fill-opacity=".75"/></g>`
    reveals += `<circle class="np-o${k}" r="0"><animate attributeName="r" values="0;${num(SPEED * span)}" dur="${num(span, 2)}s" begin="${begin}"/></circle>`
  })

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" color="${input.ink}">` +
    `<style>${style}</style>` +
    `<defs>` +
    seaGlyphs() +
    // The drift lives on one pattern; the two that show the sea take their origin from it.
    `<pattern id="np-grid" patternUnits="userSpaceOnUse" x="0" y="0" width="${TILE_W}" height="${TILE_H}">` +
    driftSteps('x', COLS, -CW, STEP_X) +
    driftSteps('y', ROWS, CH, STEP_Y) +
    `</pattern>` +
    `<pattern id="np-sea" href="#np-grid"><use href="#np-g" opacity=".18"/></pattern>` +
    `<pattern id="np-lit" href="#np-grid"><use href="#np-g" opacity=".8"/></pattern>` +
    crestTile(
      'np-mid',
      [
        [GLYPHS.equals, GLYPHS.plus, GLYPHS.star],
        [GLYPHS.plus, GLYPHS.star, GLYPHS.equals],
        [GLYPHS.star, GLYPHS.equals, GLYPHS.plus],
      ],
      input.ground,
      0.55 * WAVE_GAIN,
    ) +
    crestTile(
      'np-heavy',
      [
        [GLYPHS.at, GLYPHS.at, GLYPHS.percent],
        [GLYPHS.hash, GLYPHS.at, GLYPHS.at],
        [GLYPHS.at, GLYPHS.percent, GLYPHS.at],
      ],
      input.ground,
      0.85 * WAVE_GAIN,
    ) +
    markTile('np-m-at', GLYPHS.at, input) +
    markTile('np-m-hash', GLYPHS.hash, input) +
    markTile('np-m-plus', GLYPHS.plus, input) +
    markTile('np-m-colon', GLYPHS.colon, input) +
    `<path id="np-core" d="${markCells(cover => cover >= 5)}"/>` +
    `<path id="np-rim" d="${markCells(cover => cover < 5)}"/>` +
    `<clipPath id="np-reveal">${reveals}</clipPath>` +
    `</defs>` +
    `<rect width="100%" height="100%" fill="${input.ground}"/>` +
    `<rect width="100%" height="100%" fill="url(#np-sea)"/>` +
    ripples +
    `<g class="np-mark" clip-path="url(#np-reveal)">` +
    `<svg x="100%" y="100%" width="1" height="1" overflow="visible"><g transform="translate(${markLeft} ${markTop})">${marks}</g></svg>` +
    `</g>` +
    `</svg>`
  )
}
