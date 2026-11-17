// Writes the terminal themes, themes/nightpub-<id>.json, from hooks/palettes.ts.
//
//   node scripts/build-terminal-themes.mjs
//
// A development script: the engine never loads it. The terminal draws no
// `$.theme.set`; it takes a theme file a person picks once in /theme. These
// files carry NightPub's own values, not the Desktop adjustment.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { PALETTES, PALETTE_IDS } from '../hooks/palettes.ts'

/** `from` moved `amount` of the way to `to`, as #rrggbb. */
function mix(from, to, amount) {
  const channel = at => {
    const a = parseInt(from.slice(at, at + 2), 16)
    const b = parseInt(to.slice(at, at + 2), 16)

    return Math.round(a + (b - a) * amount)
      .toString(16)
      .padStart(2, '0')
  }

  return `#${channel(1)}${channel(3)}${channel(5)}`
}

/** One palette as the terminal's colour tokens. */
function overrides(p) {
  return {
    // Text and accents.
    claude: p.accent,
    claudeShimmer: p.accentHover,
    text: p.textPrimary,
    inverseText: p.textOnAccent,
    inactive: p.textMuted,
    inactiveShimmer: p.textSecondary,
    // NightPub's borders are drawn on its own canvas; a terminal's ground is
    // anyone's, so the two faint tokens stand a little clear of it.
    subtle: mix(p.borderStrong, p.textMuted, 0.35),
    suggestion: p.accent,
    permission: p.accent,
    permissionShimmer: p.accentHover,
    remember: p.info,

    // Status.
    success: p.success,
    error: p.danger,
    warning: p.warning,
    warningShimmer: mix(p.warning, p.textPrimary, 0.4),
    merged: p.info,

    // The input box and its modes.
    promptBorder: mix(p.borderStrong, p.textMuted, 0.5),
    promptBorderShimmer: p.textMuted,
    planMode: p.info,
    autoAccept: p.success,
    bashBorder: p.warning,
    ide: p.info,
    fastMode: p.warning,
    fastModeShimmer: mix(p.warning, p.textPrimary, 0.4),

    // Diffs: the status colours sunk into the canvas, so code stays readable on them.
    diffAdded: mix(p.canvas, p.success, 0.22),
    diffRemoved: mix(p.canvas, p.danger, 0.22),
    diffAddedDimmed: mix(p.canvas, p.success, 0.12),
    diffRemovedDimmed: mix(p.canvas, p.danger, 0.12),
    diffAddedWord: mix(p.canvas, p.success, 0.42),
    diffRemovedWord: mix(p.canvas, p.danger, 0.42),

    // Message grounds.
    userMessageBackground: p.bubbleUserBg,
    userMessageBackgroundHover: p.bubbleUserBorder,
    bashMessageBackgroundColor: p.raised,
    memoryBackgroundColor: p.accentSoft,
    selectionBg: mix(p.canvas, p.accent, 0.3),
    composerSidebarBackground: p.surface,

    // The usage meter and speaker labels.
    rate_limit_fill: p.accent,
    rate_limit_empty: p.borderStrong,
    briefLabelYou: p.info,
    briefLabelClaude: p.accent,
  }
}

const themes = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes')
mkdirSync(themes, { recursive: true })

for (const id of PALETTE_IDS) {
  const palette = PALETTES[id]
  const theme = { name: `NightPub · ${palette.label}`, base: 'dark', overrides: overrides(palette) }
  writeFileSync(join(themes, `nightpub-${id}.json`), `${JSON.stringify(theme, null, 2)}\n`)
  console.log(`themes/nightpub-${id}.json  ${theme.name}`)
}
