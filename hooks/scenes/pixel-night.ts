import { SIGN_ROWS } from './sign-cells'

/**
 * The pixel night: a sparse sky of stars that blink, a moon in the top right
 * corner, a low town along the bottom edge with a few windows lit, and a
 * tavern in the bottom right corner whose sign is the NightPub mark. About
 * once a minute something crosses it, a shooting star or a bat, and the sign
 * lights for a moment.
 *
 * One SVG that runs no script and needs no font or picture: everything is a
 * box on a 4 px grid, except the stars and the sign, which are finer.
 */
export type PixelNightInput = {
  /** What the night lies on: the look's page colour. */
  ground: string
  /** The stars, the moon and the shooting stars: the look's text colour. */
  star: string
  /** The town's roofs, and the bat: a step lighter than the ground. */
  town: string
  /** The tavern: a step lighter than the town. */
  tavern: string
  /** Lit windows and the door lamp: the look's warm colour. */
  light: string
  /** The mark on the sign: the look's accent. */
  sign: string
  /** The tavern's door and the sign's board: darker than the ground. */
  dark: string
  /** Chimney smoke. */
  smoke: string
  /** Seconds to the first event and between events. */
  event?: { first: number; every: number }
}

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

/** A box as path data, so many boxes are one path. */
function box(x: number, y: number, width: number, height: number): string {
  return `M${num(x)} ${num(y)}h${num(width)}v${num(height)}h${num(-width)}z`
}

/** A small picture of `#` pixels as path data, its top left at (x, y). */
function sprite(rows: readonly string[], x: number, y: number, pixel: number): string {
  let d = ''

  rows.forEach((row, r) => {
    let start = -1

    for (let c = 0; c <= row.length; c += 1) {
      const isOn = row[c] === '#'

      if (isOn && start === -1) {
        start = c
      }

      if (!isOn && start !== -1) {
        d += box(x + start * pixel, y + r * pixel, (c - start) * pixel, pixel)
        start = -1
      }
    }
  })

  return d
}

/** The same numbers every time: the sky is drawn once and must not change between two builds. */
function sequence(seed: number): () => number {
  let state = seed

  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── the sky ───────────────────────────────────────────────────────────────

const STARS = 64
const STILL_LEVELS = ['.14', '.2', '.28', '.36'] as const
// A star that blinks is bright, then dim for `dim` seconds of every `seconds`.
// Each kind keeps its own time, so the sky never blinks as one.
const BLINKS = [
  { clock: 'npba', seconds: 5.2, dim: 2.3, first: 1.4 },
  { clock: 'npbb', seconds: 7.6, dim: 3.1, first: 4.2 },
  { clock: 'npbc', seconds: 11.4, dim: 4.4, first: 2.6 },
  { clock: 'npbd', seconds: 9.2, dim: 3.6, first: 6.8 },
  { clock: 'npbe', seconds: 13.8, dim: 5.2, first: 9.5 },
] as const

/**
 * The stars, placed by percent so they fill a window of any size. A blinking
 * star is a step, not a fade: between two steps nothing is drawn again.
 */
function stars(): string {
  const random = sequence(0x4e50)
  const still = new Map<string, string>()
  const started = new Set<string>()
  let blinking = ''

  for (let i = 0; i < STARS; i += 1) {
    const x = num(1 + random() * 98)
    // Above the town, whatever the window's height.
    const y = num(2 + random() * 74)
    const size = random() < 0.2 ? 4 : 2
    const place = `x="${x}%" y="${y}%" width="${size}" height="${size}"`
    const pick = random()

    if (pick < 0.34) {
      const blink = BLINKS[Math.floor(random() * BLINKS.length)] ?? BLINKS[0]
      // The first star of a kind is its clock; the rest wait on it.
      const isFirst = !started.has(blink.clock)
      const id = isFirst ? ` id="${blink.clock}"` : ''
      const begin = isFirst ? `${blink.first}s;${blink.clock}.begin+${blink.seconds}s` : `${blink.clock}.begin`
      started.add(blink.clock)
      blinking += `<rect ${place} fill-opacity=".4"><set${id} attributeName="fill-opacity" to=".13" begin="${begin}" dur="${blink.dim}s"/></rect>`
    } else {
      const level = STILL_LEVELS[Math.floor(random() * STILL_LEVELS.length)] ?? STILL_LEVELS[0]
      still.set(level, `${still.get(level) ?? ''}<rect ${place}/>`)
    }
  }

  return [...still.entries()].map(([level, rects]) => `<g fill-opacity="${level}">${rects}</g>`).join('') + blinking
}

// The moon: a disc of 4 px steps, 56 by 48, this far from the right and top edges.
const MOON = { width: 56, height: 48, right: 72, top: 40 }
const MOON_DISC =
  box(16, 0, 24, 4) + box(8, 4, 40, 4) + box(4, 8, 48, 8) + box(0, 16, 56, 16) + box(4, 32, 48, 8) + box(8, 40, 40, 4) + box(16, 44, 24, 4)
const MOON_CRATERS = box(12, 16, 8, 8) + box(36, 30, 8, 4) + box(28, 8, 4, 4)

const BAT_UP = ['#.....#', '##.#.##', '.#####.']
const BAT_DOWN = ['...#...', '.#####.', '##...##']
// The bat's way, in px from the top right corner: in from past the edge,
// across the moon's face, and on. Its seconds on the way, and a wingbeat.
const BAT_FROM = { x: 40, y: 70 }
const BAT_TO = { x: -430, y: 42 }
const BAT_SECONDS = 7
const BAT_BEAT = 0.36
const BAT_BEATS = Math.ceil(BAT_SECONDS / BAT_BEAT)

// A shooting star falls this far each way, a step at a time, in this long.
const FALL = 168
const FALL_STEP = 8
const FALL_SECONDS = 0.9
const SHOTS = [
  { x: 26, y: 9, side: 1 },
  { x: 60, y: 15, side: -1 },
] as const

/** The steps of a fall as `animateTransform` values: whole pixels, one after another. */
function fallSteps(side: number): string {
  const steps: string[] = []

  for (let d = 0; d <= FALL; d += FALL_STEP) {
    steps.push(`${side * d} ${d}`)
  }

  return steps.join(';')
}

// ── the town ──────────────────────────────────────────────────────────────

type House = {
  x: number
  width: number
  height: number
  /** A narrower storey on top: its inset from the house's left, its width and height. */
  roof?: readonly [number, number, number]
  /** On the roof: its inset from the house's left, its width and height. */
  chimney?: readonly [number, number, number]
}

/** A lit window: its left, how far its top is above the ground, its size, and whether it wavers. */
type Pane = { x: number; top: number; size: number; wavers: boolean }

// One block of town, 640 px of it. The town is this block and its mirror
// image by turns, so no two neighbours along the edge are alike.
const BLOCK = 640
const BLOCKS = 6
const HOUSES: readonly House[] = [
  { x: 0, width: 56, height: 48, roof: [8, 40, 8] },
  { x: 56, width: 40, height: 32 },
  { x: 96, width: 48, height: 64, roof: [8, 32, 8], chimney: [32, 8, 12] },
  { x: 144, width: 64, height: 40 },
  { x: 208, width: 40, height: 56, roof: [8, 24, 8] },
  { x: 248, width: 72, height: 28 },
  { x: 320, width: 48, height: 52, roof: [8, 32, 8] },
  { x: 368, width: 56, height: 36 },
  { x: 424, width: 40, height: 60, roof: [8, 24, 8], chimney: [16, 8, 8] },
  { x: 464, width: 48, height: 32 },
  { x: 512, width: 56, height: 44, roof: [8, 40, 8] },
  { x: 568, width: 72, height: 36 },
]
const PANES: readonly Pane[] = [
  { x: 12, top: 36, size: 8, wavers: false },
  { x: 32, top: 36, size: 8, wavers: true },
  { x: 108, top: 52, size: 8, wavers: false },
  { x: 124, top: 32, size: 8, wavers: false },
  { x: 172, top: 28, size: 8, wavers: true },
  { x: 220, top: 44, size: 8, wavers: false },
  { x: 332, top: 40, size: 8, wavers: false },
  { x: 436, top: 48, size: 8, wavers: true },
  { x: 524, top: 32, size: 8, wavers: false },
  { x: 600, top: 24, size: 8, wavers: true },
]
// A wavering window goes dim for a moment every so many seconds, each group
// in its own time. The last one is the tavern's.
const WAVERS = [
  { clock: 'npwa', seconds: 9, first: 7.7 },
  { clock: 'npwb', seconds: 13, first: 3.2 },
  { clock: 'npwc', seconds: 17, first: 11.9 },
  { clock: 'npwd', seconds: 23, first: 16.4 },
] as const
const TAVERN_WAVER = { clock: 'npwe', seconds: 19, first: 5.5 } as const
const WAVER_SECONDS = 0.7

/** The town's roofs as one path, and its windows: the steady ones, then each wavering group. */
function town(): { roofs: string; steady: string; wavering: string[] } {
  let roofs = ''
  let steady = ''
  const wavering = WAVERS.map(() => '')

  for (let k = 0; k < BLOCKS; k += 1) {
    const isMirrored = k % 2 === 1
    // Where a box of the block stands in this copy of it.
    const at = (x: number, width: number) => k * BLOCK + (isMirrored ? BLOCK - x - width : x)

    for (const house of HOUSES) {
      roofs += box(at(house.x, house.width), -house.height, house.width, house.height)
      let top = house.height

      if (house.roof !== undefined) {
        const [inset, width, height] = house.roof
        top += height
        roofs += box(at(house.x + inset, width), -top, width, height)
      }

      if (house.chimney !== undefined) {
        const [inset, width, height] = house.chimney
        roofs += box(at(house.x + inset, width), -top - height, width, height)
      }
    }

    PANES.forEach((pane, i) => {
      const d = box(at(pane.x, pane.size), -pane.top, pane.size, pane.size)

      if (pane.wavers) {
        const group = (i + k) % WAVERS.length
        wavering[group] = `${wavering[group] ?? ''}${d}`
      } else {
        steady += d
      }
    })
  }

  return { roofs, steady, wavering }
}

/** A light that goes dim for a moment and comes back, over and over: two steps, nothing between. */
function waver(light: { clock: string; seconds: number; first: number }): string {
  return `<set id="${light.clock}" attributeName="fill-opacity" to=".25" begin="${light.first}s;${light.clock}.begin+${light.seconds}s" dur="${WAVER_SECONDS}s"/>`
}

// The tavern, in px from the bottom right corner: its wall, three steps of
// roof, a chimney, two windows, a door with a lamp, and a sign on a bracket
// on the side nearer the corner, where nothing of the app stands before it.
const TAVERN = { right: 104, width: 136, height: 80 }
const SIGN_PIXEL = 2
const SIGN_PAD = 4
// Smoke: seven places up from the chimney, thinner the higher. Every third
// one shows, and which third moves on a place every PUFF_SECONDS, so the
// puffs climb a step at a time.
const PUFF_PLACES = 7
const PUFF_TURNS = 3
const PUFF_SECONDS = 2
// The sign's glow: how bright it rests, the half step, and how long an
// event's light lasts, a step up at its start and a step down at its end.
const GLOW = { rest: '.55', half: '.78', seconds: 5, step: 0.35 } as const

// ── the scene ─────────────────────────────────────────────────────────────

/** The whole scene for one palette. The same input gives the same text. */
export function buildPixelNight(input: PixelNightInput): string {
  const { first, every } = input.event ?? { first: 8, every: 60 }
  // Four events a round: a shooting star, the bat, the other shooting star, the bat.
  const cycle = 4 * every
  // A clock's id has no hyphen: in a begin value a hyphen starts a negative offset.
  const clock = (k: number) => `npe${k}`
  const starts = (k: number) => `${num(first + k * every, 2)}s;${clock(k)}.begin+${cycle}s`
  const anyEvent = [0, 1, 2, 3].map(k => `${clock(k)}.begin`).join(';')
  const glowFull = [0, 1, 2, 3].map(k => `${clock(k)}.begin+${GLOW.step}s`).join(';')

  // In a narrow box the moon and the tavern would stand behind the words.
  const style = '@media (max-width:760px){.np-far{display:none}}'

  const shots = SHOTS.map((shot, i) => {
    const k = i * 2
    const tail = [0, 1, 2, 3, 4]
      .map(n => `<rect x="${-shot.side * n * 4}" y="${-n * 4}" width="4" height="4" opacity="${num(0.8 * 0.55 ** n, 2)}"/>`)
      .join('')

    return (
      `<svg x="${shot.x}%" y="${shot.y}%" width="1" height="1" overflow="visible">` +
      `<g fill="${input.star}" opacity="0">` +
      `<animate id="${clock(k)}" attributeName="opacity" values="0;1;1;0" keyTimes="0;.12;.7;1" dur="${FALL_SECONDS}s" begin="${starts(k)}"/>` +
      `<animateTransform attributeName="transform" type="translate" calcMode="discrete" values="${fallSteps(shot.side)}" dur="${FALL_SECONDS}s" begin="${clock(k)}.begin"/>` +
      tail +
      `</g></svg>`
    )
  }).join('')

  const flap = (frame: readonly string[], values: string, isShown: boolean) =>
    `<path d="${sprite(frame, 0, 0, 4)}" visibility="${isShown ? 'visible' : 'hidden'}">` +
    `<animate attributeName="visibility" values="${values}" calcMode="discrete" dur="${BAT_BEAT}s" repeatCount="${BAT_BEATS}" begin="${clock(1)}.begin;${clock(3)}.begin"/>` +
    `</path>`
  const moonLeft = -(MOON.right + MOON.width)
  const moon =
    `<svg class="np-far" x="100%" y="0" width="1" height="1" overflow="visible">` +
    `<g transform="translate(${moonLeft} ${MOON.top})">` +
    // The ground first, so no star shows through the moon.
    `<path fill="${input.ground}" d="${MOON_DISC}"/>` +
    `<path fill="${input.star}" fill-opacity=".32" d="${MOON_DISC}"/>` +
    `<path fill="${input.ground}" fill-opacity=".35" d="${MOON_CRATERS}"/>` +
    `</g>` +
    `<g fill="${input.town}" visibility="hidden" transform="translate(${BAT_FROM.x} ${BAT_FROM.y})">` +
    `<set id="${clock(1)}" attributeName="visibility" to="visible" begin="${starts(1)}" dur="${BAT_SECONDS}s"/>` +
    `<set id="${clock(3)}" attributeName="visibility" to="visible" begin="${starts(3)}" dur="${BAT_SECONDS}s"/>` +
    `<animateTransform attributeName="transform" type="translate" values="${BAT_FROM.x} ${BAT_FROM.y};${BAT_TO.x} ${BAT_TO.y}" dur="${BAT_SECONDS}s" begin="${clock(1)}.begin;${clock(3)}.begin"/>` +
    flap(BAT_UP, 'visible;hidden', true) +
    flap(BAT_DOWN, 'hidden;visible', false) +
    `</g>` +
    `</svg>`

  const { roofs, steady, wavering } = town()
  const houses =
    `<svg x="0" y="100%" width="100%" height="1" overflow="visible">` +
    `<path fill="${input.town}" d="${roofs}"/>` +
    `<g fill="${input.light}" fill-opacity=".7">` +
    `<path d="${steady}"/>` +
    wavering.map((d, i) => `<path fill-opacity=".7" d="${d}">${waver(WAVERS[i] ?? WAVERS[0])}</path>`).join('') +
    `</g>` +
    `</svg>`

  const left = -(TAVERN.right + TAVERN.width)
  const wall =
    box(left, -TAVERN.height, TAVERN.width, TAVERN.height) +
    box(left - 8, -TAVERN.height - 8, TAVERN.width + 16, 8) +
    box(left + 8, -TAVERN.height - 16, TAVERN.width - 16, 8) +
    box(left + 24, -TAVERN.height - 24, TAVERN.width - 48, 8) +
    box(left + 96, -TAVERN.height - 44, 12, 20) +
    // The bracket the sign hangs from.
    box(left + TAVERN.width, -72, 48, 4)
  const side = SIGN_ROWS.length * SIGN_PIXEL + 2 * SIGN_PAD
  const boardLeft = left + TAVERN.width + 6
  const boardTop = -62
  const board = box(boardLeft, boardTop, side, side) + box(boardLeft + 8, -68, 2, 6) + box(boardLeft + side - 10, -68, 2, 6)
  const face = box(boardLeft + 2, boardTop + 2, side - 4, side - 4)
  // A plain house behind the sign. The town is laid from the left and the
  // tavern from the right, so which of the town's windows would stand half
  // behind the board changes with the window's width: this one has none.
  const backing = box(left + TAVERN.width, -56, side + 10, 56)
  const smokeLeft = left + 100
  const smokeTop = -TAVERN.height - 52
  const turnSeconds = PUFF_TURNS * PUFF_SECONDS
  const puffs = Array.from({ length: PUFF_PLACES }, (_, i) => {
    const turn = i % PUFF_TURNS
    const clockId = `nps${turn}`
    // A turn's first place is its clock. The first turn has none: it is what
    // stands when nothing moves, and hides while the others show.
    const id = i < PUFF_TURNS ? ` id="${clockId}"` : ''
    const begin = i < PUFF_TURNS ? `${turn * PUFF_SECONDS}s;${clockId}.begin+${turnSeconds}s` : `${clockId}.begin`
    const step =
      turn === 0
        ? `<set attributeName="visibility" to="hidden" begin="nps1.begin" dur="${(PUFF_TURNS - 1) * PUFF_SECONDS}s"/>`
        : `<set${id} attributeName="visibility" to="visible" begin="${begin}" dur="${PUFF_SECONDS}s"/>`

    return (
      `<rect x="${num(smokeLeft + Math.floor(i / 2) * 4)}" y="${num(smokeTop - i * 4)}" width="4" height="4" fill-opacity="${num(0.32 * (1 - i / PUFF_PLACES), 2)}" visibility="${turn === 0 ? 'visible' : 'hidden'}">` +
      step +
      `</rect>`
    )
  }).join('')
  const tavern =
    `<svg class="np-far" x="100%" y="100%" width="1" height="1" overflow="visible">` +
    `<path fill="${input.town}" d="${backing}"/>` +
    `<path fill="${input.tavern}" d="${wall}${board}"/>` +
    `<path fill="${input.dark}" d="${box(left + 60, -40, 20, 40)}${face}"/>` +
    `<g fill="${input.light}" fill-opacity=".7">` +
    `<path d="${box(left + 16, -60, 16, 16)}"/>` +
    `<path fill-opacity=".7" d="${box(left + 104, -60, 16, 16)}">${waver(TAVERN_WAVER)}</path>` +
    `</g>` +
    // The sign and the door lamp glow low, and light up when something crosses
    // the sky: up two steps and down two, the later step over the earlier.
    `<g fill-opacity="${GLOW.rest}">` +
    `<set attributeName="fill-opacity" to="${GLOW.half}" begin="${anyEvent}" dur="${GLOW.seconds}s"/>` +
    `<set attributeName="fill-opacity" to="1" begin="${glowFull}" dur="${num(GLOW.seconds - 2 * GLOW.step, 2)}s"/>` +
    `<path fill="${input.sign}" d="${sprite(SIGN_ROWS, boardLeft + SIGN_PAD, boardTop + SIGN_PAD, SIGN_PIXEL)}"/>` +
    `<path fill="${input.light}" d="${box(left + 84, -48, 4, 4)}"/>` +
    `</g>` +
    `<g fill="${input.smoke}">${puffs}</g>` +
    `</svg>`

  return (
    // Every edge is a pixel's: none of them is smoothed.
    `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" color="${input.star}" shape-rendering="crispEdges">` +
    `<style>${style}</style>` +
    `<rect width="100%" height="100%" fill="${input.ground}"/>` +
    `<g fill="${input.star}">${stars()}</g>` +
    shots +
    moon +
    houses +
    tavern +
    `</svg>`
  )
}
