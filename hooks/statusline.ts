import type { EngineInterface } from 'claude-code'

import type { PaletteChoice } from './look'
import { PALETTES } from './palettes'
import type { Palette } from './palettes'

// The status line is a shell script the terminal runs on its own: it cannot
// read the store. So the palette is left where one `read` finds it, in
// `<config>/nightpub-ui/palette`, as one line:
//
//   nightpub-ui/1 <palette id> <nine R;G;B colours> end
//   nightpub-ui/1 off end
//
// The script takes the colours only from a line that reads exactly so, and
// keeps its own for any other line or no file.
const MAGIC = 'nightpub-ui/1'
const FILE = 'nightpub-ui/palette'

/**
 * The nine colours, in the order the script reads them: the text on a
 * capsule, the quiet text beside it, the accent, the plain capsule, the text
 * on a plain capsule, success, warning, danger, info.
 */
const inks = (p: Palette): string[] => [
  p.canvas,
  p.borderStrong,
  p.accent,
  p.borderStrong,
  p.textPrimary,
  p.success,
  p.warning,
  p.danger,
  p.info,
]

/** `#rrggbb` as the `R;G;B` an SGR colour takes. */
const triplet = (hex: string): string => [1, 3, 5].map(at => Number.parseInt(hex.slice(at, at + 2), 16)).join(';')

/** The file's whole content for a palette. */
export const paletteLine = (choice: PaletteChoice): string =>
  choice === 'off' ? `${MAGIC} off end\n` : `${MAGIC} ${choice} ${inks(PALETTES[choice]).map(triplet).join(' ')} end\n`

/** Where the file is: under the configuration directory, the one the status line script looks in. */
async function paletteFile($: EngineInterface): Promise<string | undefined> {
  // each name a literal: the engine lists the variables a module reads
  const config = await $.env.get('CLAUDE_CONFIG_DIR').catch(() => undefined)
  if (config !== undefined && config !== '') return `${config}/${FILE}`
  const profile = await $.env.get('USERPROFILE').catch(() => undefined)
  const home = profile !== undefined && profile !== '' ? profile : await $.env.get('HOME').catch(() => undefined)
  return home === undefined || home === '' ? undefined : `${home}/.claude/${FILE}`
}

/**
 * Leaves the palette for the status line script. Writes only what differs
 * from the file, and leaves no file to say `off` where none was.
 */
export async function tellStatusline($: EngineInterface, choice: PaletteChoice): Promise<void> {
  try {
    const path = await paletteFile($)
    if (path === undefined) return
    const line = paletteLine(choice)
    const current = await $.fs.read(path).catch(() => undefined)
    if (current === line || (current === undefined && choice === 'off')) return
    await $.fs.write(path, line)
  } catch {
    // the status line keeps its own colours
  }
}
