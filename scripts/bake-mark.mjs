// Bakes the NightPub mark into a table of glyph cells: hooks/scenes/mark-cells.ts.
//
//   node scripts/bake-mark.mjs [rows]
//
// A development script: the engine never loads it. It does what NightPub's
// glyph field does in the browser (`web/src/backdrop/glyph-field.ts#trace`):
// stroke the mark's outline on its 24-unit grid, then ask of every cell how
// much of it the outline covers. With no canvas here, the outline is flattened
// to line segments and a point is inside the stroke when it lies within half
// the stroke's width of one.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

// The mark: `web/src/ui/brand-mark.ts`, a vampire on a 24-unit grid.
const BRAND_PATHS = [
  'M5 12.5V9a7 7 0 0 1 14 0v3.5',
  'M5 8.5C6.4 6 9.2 5.2 12 8c2.8-2.8 5.6-2 7 .5',
  'M2.5 11.5c3.1.8 5.3 2.8 6.2 6.3a8.8 8.8 0 0 0 6.6 0c.9-3.5 3.1-5.5 6.2-6.3L19 20c-4.6 2-9.4 2-14 0Z',
  'M9.25 13.5q2.75 1.7 5.5 0M10 14.05v1.2m4-1.2v1.2',
]
const BRAND_EYES = [
  { cx: 8.75, cy: 10.65 },
  { cx: 15.25, cy: 10.65 },
]
const EYE_RADIUS = 0.8 + 0.1
const MARK_STROKE = 1.05
const UNITS = 24

// The mark's cells are closer set than the sea's: 9 by 13 px.
const CELL_W = 9
const CELL_H = 13
// A cell the outline covers less of than this is not part of the mark.
const FLOOR = 0.14

const rows = Number(process.argv[2] ?? 36)
const size = rows * CELL_H
const cols = Math.round(size / CELL_W)

/** The path's numbers and letters, in order. */
function tokens(d) {
  return d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? []
}

function cubic(p0, p1, p2, p3, out) {
  for (let i = 1; i <= 24; i += 1) {
    const t = i / 24
    const u = 1 - t
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ])
  }
}

function quadratic(p0, p1, p2, out) {
  for (let i = 1; i <= 24; i += 1) {
    const t = i / 24
    const u = 1 - t
    out.push([
      u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0],
      u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1],
    ])
  }
}

/** An elliptical arc by its end points, as SVG gives it, flattened. */
function arc(p0, rx, ry, rotation, large, sweep, p1, out) {
  if (rx === 0 || ry === 0) {
    out.push(p1)

    return
  }
  const phi = (rotation * Math.PI) / 180
  const cos = Math.cos(phi)
  const sin = Math.sin(phi)
  const dx = (p0[0] - p1[0]) / 2
  const dy = (p0[1] - p1[1]) / 2
  const x1 = cos * dx + sin * dy
  const y1 = -sin * dx + cos * dy
  let rxs = Math.abs(rx)
  let rys = Math.abs(ry)
  const lambda = (x1 * x1) / (rxs * rxs) + (y1 * y1) / (rys * rys)

  if (lambda > 1) {
    rxs *= Math.sqrt(lambda)
    rys *= Math.sqrt(lambda)
  }
  const num = rxs * rxs * rys * rys - rxs * rxs * y1 * y1 - rys * rys * x1 * x1
  const den = rxs * rxs * y1 * y1 + rys * rys * x1 * x1
  const k = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den))
  const cx1 = (k * rxs * y1) / rys
  const cy1 = (-k * rys * x1) / rxs
  const cx = cos * cx1 - sin * cy1 + (p0[0] + p1[0]) / 2
  const cy = sin * cx1 + cos * cy1 + (p0[1] + p1[1]) / 2
  const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
  const start = angle(1, 0, (x1 - cx1) / rxs, (y1 - cy1) / rys)
  let delta = angle((x1 - cx1) / rxs, (y1 - cy1) / rys, (-x1 - cx1) / rxs, (-y1 - cy1) / rys)

  if (!sweep && delta > 0) {
    delta -= 2 * Math.PI
  }

  if (sweep && delta < 0) {
    delta += 2 * Math.PI
  }
  const steps = Math.max(8, Math.ceil(Math.abs(delta) / (Math.PI / 48)))

  for (let i = 1; i <= steps; i += 1) {
    const a = start + (delta * i) / steps
    const ex = rxs * Math.cos(a)
    const ey = rys * Math.sin(a)
    out.push([cos * ex - sin * ey + cx, sin * ex + cos * ey + cy])
  }
}

/** The path as polylines, one per subpath. */
function flatten(d) {
  const list = tokens(d)
  const lines = []
  let line = []
  let at = [0, 0]
  let first = [0, 0]
  let command = ''
  let i = 0
  const number = () => Number(list[i++])

  while (i < list.length) {
    if (/[a-zA-Z]/.test(list[i])) {
      command = list[i++]
    }
    const relative = command === command.toLowerCase()
    const point = () => {
      const x = number()
      const y = number()

      return relative ? [at[0] + x, at[1] + y] : [x, y]
    }

    switch (command.toLowerCase()) {
      case 'm': {
        if (line.length > 1) {
          lines.push(line)
        }
        at = point()
        first = at
        line = [at]
        // Pairs after the first are lines.
        command = relative ? 'l' : 'L'
        break
      }
      case 'l': {
        at = point()
        line.push(at)
        break
      }
      case 'h': {
        const x = number()
        at = [relative ? at[0] + x : x, at[1]]
        line.push(at)
        break
      }
      case 'v': {
        const y = number()
        at = [at[0], relative ? at[1] + y : y]
        line.push(at)
        break
      }
      case 'c': {
        const p1 = point()
        const p2 = point()
        const p3 = point()
        cubic(at, p1, p2, p3, line)
        at = p3
        break
      }
      case 'q': {
        const p1 = point()
        const p2 = point()
        quadratic(at, p1, p2, line)
        at = p2
        break
      }
      case 'a': {
        const rx = number()
        const ry = number()
        const rotation = number()
        const large = number() === 1
        const sweep = number() === 1
        const end = point()
        arc(at, rx, ry, rotation, large, sweep, end, line)
        at = end
        break
      }
      case 'z': {
        line.push(first)
        at = first
        break
      }
      default:
        throw new Error(`bake-mark: no "${command}" in this path reader`)
    }
  }

  if (line.length > 1) {
    lines.push(line)
  }

  return lines
}

const segments = []

for (const d of BRAND_PATHS) {
  for (const line of flatten(d)) {
    for (let i = 1; i < line.length; i += 1) {
      segments.push([line[i - 1], line[i]])
    }
  }
}

function distance(x, y, [a, b]) {
  const vx = b[0] - a[0]
  const vy = b[1] - a[1]
  const length = vx * vx + vy * vy
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * vx + (y - a[1]) * vy) / length))

  return Math.hypot(x - (a[0] + t * vx), y - (a[1] + t * vy))
}

/** Whether the mark's ink covers this point of its 24-unit grid, drawn with a line `stroke` wide. */
function inked(x, y, stroke = MARK_STROKE) {
  for (const eye of BRAND_EYES) {
    if (Math.hypot(x - eye.cx, y - eye.cy) <= EYE_RADIUS) {
      return true
    }
  }

  for (const segment of segments) {
    if (distance(x, y, segment) <= stroke / 2) {
      return true
    }
  }

  return false
}

// Many points a cell rather than NightPub's twelve: its twelve read a canvas
// that was already antialiased.
const NX = 6
const NY = 8
const unit = UNITS / size
const table = []
let cells = 0

for (let r = 0; r < rows; r += 1) {
  let row = ''

  for (let c = 0; c < cols; c += 1) {
    let sum = 0

    for (let j = 0; j < NY; j += 1) {
      for (let i = 0; i < NX; i += 1) {
        const x = (c + (i + 0.5) / NX) * CELL_W * unit
        const y = (r + (j + 0.5) / NY) * CELL_H * unit
        sum += inked(x, y) ? 1 : 0
      }
    }
    const cover = sum / (NX * NY)

    if (cover > FLOOR) {
      // Ninths, so one digit a cell: 5 and up is the line's core.
      row += String(Math.max(1, Math.min(9, Math.round(cover * 9))))
      cells += 1
    } else {
      row += '.'
    }
  }
  table.push(row)
}

const source = `// Written by scripts/bake-mark.mjs: run it again, don't edit this.
//
// The NightPub mark as glyph cells, ${cols} by ${rows} of them at ${CELL_W} by ${CELL_H} px. A digit
// is how much of its cell the outline covers, in ninths; a dot is no cell of
// the mark's. 5 and up is the line's core, below it the rim.

export const MARK_CELL = { width: ${CELL_W}, height: ${CELL_H} } as const

export const MARK_COLS = ${cols}

export const MARK_ROWS = ${rows}

export const MARK_COVER: readonly string[] = [
${table.map(row => `  '${row}',`).join('\n')}
]
`
const here = dirname(fileURLToPath(import.meta.url))
const scenes = join(here, '..', 'hooks', 'scenes')
mkdirSync(scenes, { recursive: true })
writeFileSync(join(scenes, 'mark-cells.ts'), source)

console.log(table.map(row => row.replace(/[5-9]/g, '@').replace(/[1-4]/g, '+').replace(/\./g, ' ')).join('\n'))
console.log(`${cols} x ${rows} cells, ${cells} of them the mark's`)

// The mark once more, small, for the pixel night's tavern sign: square
// pixels, each one on or off. So few pixels want a heavier line than the
// mark's own, and only the part of the grid the mark stands in.
const SIGN_PIXELS = Number(process.argv[3] ?? 17)
const SIGN_STROKE = Number(process.argv[4] ?? 1.4)
const SIGN_FLOOR = Number(process.argv[5] ?? 0.4)
const SIGN_FROM = { x: 2, y: 1.6 }
const SIGN_SPAN = 20
const sign = []

for (let r = 0; r < SIGN_PIXELS; r += 1) {
  let row = ''

  for (let c = 0; c < SIGN_PIXELS; c += 1) {
    let sum = 0

    for (let j = 0; j < 6; j += 1) {
      for (let i = 0; i < 6; i += 1) {
        const x = SIGN_FROM.x + ((c + (i + 0.5) / 6) * SIGN_SPAN) / SIGN_PIXELS
        const y = SIGN_FROM.y + ((r + (j + 0.5) / 6) * SIGN_SPAN) / SIGN_PIXELS
        sum += inked(x, y, SIGN_STROKE) ? 1 : 0
      }
    }
    row += sum / 36 >= SIGN_FLOOR ? '#' : '.'
  }
  sign.push(row)
}

writeFileSync(
  join(scenes, 'sign-cells.ts'),
  [
    "// Written by scripts/bake-mark.mjs: run it again, don't edit this.",
    '//',
    `// The NightPub mark as ${SIGN_PIXELS} by ${SIGN_PIXELS} square pixels, for the pixel night's`,
    "// tavern sign: a hash is a pixel of the mark's.",
    '',
    'export const SIGN_ROWS: readonly string[] = [',
    ...sign.map(row => `  '${row}',`),
    ']',
    '',
  ].join(String.fromCharCode(10)),
)
console.log(sign.join(String.fromCharCode(10)))
