# nightpub-ui

NightPub's dark look for Claude Code and Claude Desktop, with a live usage panel that wears it: three palettes, two animated backgrounds, a side pane for context, cost, rate limits and activity, a live band above the prompt, and a matching status line. Everything is chosen on the pane's settings page.

English | [简体中文](README.zh-CN.md)

![The panel with the palette off, in Catppuccin Mocha](docs/screenshot.png)

*The panel with the palette off, as it looked before 0.5.0.*

This plugin was called `capsule-panel` up to 0.4.1. See [Upgrading from capsule-panel](#upgrading-from-capsule-panel).

## The look

**Palette**: `ink` (墨与纸), `tavern` (酒馆暖光), `midnight` (午夜靛蓝), or `off`. A palette colours Claude Desktop's whole window, the panel, the band and the status line. With `off`, the plugin sets no theme and the panel is drawn in Catppuccin Mocha, as it was before 0.5.0.

**Background** (Claude Desktop): what moves behind the conversation.

- `glyph sea`: faint glyphs drifting slowly. Now and then a ripple crosses them and lights the NightPub mark in the corner
- `pixel night`: a few stars, a moon in the top right corner and a town along the bottom edge with some windows lit. About once a minute a shooting star falls or a bat crosses the moon, in turn, and the tavern sign lights up
- `none`: the palette's ground alone

Both are drawn without a script, a font or a picture, and between their events they move a step at a time, so an idle window costs next to nothing. With reduced motion on in the system settings, Claude Desktop shows them as still pictures.

**In a terminal** the plugin cannot repaint Claude Code itself, so it ships the three palettes as themes: pick `NightPub · 墨与纸` (or the palette you chose) in `/theme`. The panel, the band and the status line follow the palette by themselves, and while Claude works a short wave of the background's glyphs runs before the spinner's word.

The palette and the background are one choice for every surface and session. A new install starts in `ink` over the `glyph sea`.

## The panel

A side pane, one page. Each section hides itself while it has nothing to say, and each has a switch on the settings page. A new install shows the short version; the lines marked *off by default* are there when you want them.

- **Header**: whether Claude is working. The model and effort in use are *off by default*, since a status line usually shows them
- **CONTEXT**: how full the context window is, split by category, with a marker where auto-compact kicks in. Below it, how many turns are left before auto-compact at the recent rate of growth, and a **compact now** button while Claude is idle (press it twice within 3 seconds; after a compaction the line shows how far it shrank the context). The legend naming the largest categories is *off by default*
- **CACHE** (*off by default*): prompt-cache hit rate and how long the cache stays warm (seconds in its last minute, then `cold`); tokens read and written with a further switch
- **TOKENS / COST**: tokens in and out (updated after every request, subagents included, and restored when a session is resumed), session cost and $/hour
- **SPEND**: what every Claude Code session on this machine has spent today and this week (from Monday). It adds up the session cost Claude Code reports, an estimate at API prices, kept in the plugin's own store. A bar for each of the last seven days is *off by default*
- **LIMITS**: each plan rate-limit window with its reset countdown, and a forecast of whether you'll hit it before it resets. Rate limits are only reported on a Claude subscription; without them this section hides and COST shows tokens per hour instead. When the forecast says a window will run out before its reset, a toast says so once per window, whether or not the section is shown
- **ACTIVITY**: the last three tool calls with their time and outcome (five, three or none), and running subagents. The tok/s sparkline is *off by default*
- **GIT**: branch, commits ahead/behind, lines added/removed, and the files Claude edited this session, newest three first with their lines changed (five, three or none; `new` for an untracked file). Outside a repository it still lists the edited files
- **TODO** (*off by default*): the current todo list's progress and the step under way
- **Footer**: the settings button. The Claude Code and Claude Desktop versions are *off by default*

While Claude works, a new activity row lights up and fades within a second, and any figure at 80% or more (context, a rate limit) breathes red. Idle, the pane holds still.

Plus a one-line band above the prompt while Claude is working: a capsule naming the phase or the tool, what it is doing and for how long, then tok/s, running subagents and the turn's time. It takes no space when idle.

When a turn completes, a short tone plays where the platform has a player. When a turn that ran a minute or more completes, a notification says so: on Windows, a toast in the corner of the screen; elsewhere, Claude Code's own notification channel. Both are on in the terminal and off in Claude Desktop, which chimes and notifies by itself.

## Requirements

- Claude Code 2.1.325 or later, in the terminal or in Claude Desktop
- In the terminal, a [Nerd Font](https://www.nerdfonts.com/) for the icons (developed with MartianMono Nerd Font in Windows Terminal). Without one, set Icons to `unicode` on the Look page and the pane draws plain symbols instead
- Claude Desktop needs nothing: it draws the icons and capsules as vector shapes automatically

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install nightpub-ui --marketplace jsh135790/claude-code-nightpub-ui
```

Answer `y` to add the marketplace, then press Enter to install for your user. It's active right away.

In Claude Desktop: click + next to the prompt box, then Plugins, add the marketplace `jsh135790/claude-code-nightpub-ui`, then add the plugin.

## Usage

- In the terminal, the pane opens by itself when the window is at least 144 columns wide
- In Claude Desktop, the pane opens by itself when a conversation starts
- `/panel` opens or closes it at any width
- **settings** at the bottom of the pane opens its settings page; **← back** returns to the dashboard

## Settings

The settings page has three pages, **Look**, **Panel** and **Alerts**, and lists every option with a button that steps through its values. A detail is indented under its section and waits dimmed while the section is off.

The palette and the background are shared by every surface. Everything else is kept once for the terminal and once for Claude Desktop: a change applies to the surface you make it on. All of it is in the plugin's own store, not in `settings.json`, so a tool that rewrites `settings.json` (a provider switcher, say) leaves it alone.

### Look

| Setting | Values | Default |
| --- | --- | --- |
| Palette | ink, tavern, midnight, off | ink |
| Background | glyph sea, pixel night, none | glyph sea |
| Icons (terminal only) | nerd, unicode | nerd |
| Spinner wave (terminal only) | on, off | on |

- **Palette** `off` takes the plugin's theme off the screen at once. The background you chose is kept for when a palette comes back
- **Icons**: Claude Desktop always draws vector icons
- **Spinner wave**: runs the background's glyphs, so it needs a background chosen

### Panel

| Setting | Values | Default |
| --- | --- | --- |
| Model & effort | on, off | off |
| Context | on, off | on |
| · legend | on, off | off |
| · compact forecast | on, off | on |
| Cache | on, off | off |
| · countdown | on, off | on |
| · TTL | auto, 5m, 1h | auto |
| · read / write | on, off | off |
| Tokens | on, off | on |
| Cost | on, off | on |
| Spend | on, off | on |
| · 7-day bars | on, off | off |
| Limits | on, off | on |
| Activity | on, off | on |
| · tok/s sparkline | on, off | off |
| · recent calls | 5, 3, off | 3 |
| Git | on, off | on |
| · changed files | 5, 3, off | 3 |
| Todo | on, off | off |
| Versions | on, off | off |

- **compact forecast**: the turns-left line and the **compact now** button
- **TTL**: how long the prompt cache lasts. `auto` follows Claude Code's own rule: an hour on a Claude subscription, 5 minutes when an API key or token is set in the environment, or whatever `CLAUDE_CODE_PROMPT_CACHE_TTL` or the `promptCacheTtl` setting says

### Alerts

| Setting | Values | Terminal | Claude Desktop |
| --- | --- | --- | --- |
| Activity band | on, off | on | on |
| Completion sound | on, off | on | off |
| Long-turn notification | on, off | on | off |
| · after | 30s, 60s, 120s, 300s | 60s | 60s |

- **Completion sound**: macOS plays it with `afplay`; a Windows or Linux terminal has no player and stays silent

## Optional: matching status line

`extras/statusline/statusline-command.sh` is a status line in the same capsule style: model and effort, directory, git branch, context %, cost and vim mode. It needs `bash` 4 or later and `jq`; `git` is optional. It respects `NO_COLOR`.

Copy it to `~/.claude/statusline-command.sh` and add this to `~/.claude/settings.json`:

```json
"statusLine": {
  "type": "command",
  "command": "bash \"$HOME/.claude/statusline-command.sh\""
}
```

It follows the palette. The plugin keeps the palette's colours as one line of text in `nightpub-ui/palette` under the Claude configuration directory (`~/.claude`, or `CLAUDE_CONFIG_DIR`), written when a session starts and when the palette changes. The script reads that line, checks that it is nothing but the colours it expects, and otherwise draws in Catppuccin Mocha, as it does with the palette `off` or without the plugin. In a NightPub palette the capsules use fewer hues: the accent for the model, plain capsules for the directory and the cost.

## Upgrading from capsule-panel

`nightpub-ui` 0.5.0 is `capsule-panel` 0.4.1 with the look added, under a new name. Claude Code keeps a plugin's settings and records by its name, so:

- Remove `capsule-panel`, then install `nightpub-ui` as above. Running both draws two panes
- Settings start from the new defaults, which show less than 0.4.1 did. Everything 0.4.1 showed is still there, behind its switch on the Panel page
- The spend history starts again. To keep it, copy the `spend/…` entries from the old plugin's store file into the new one's while no session is running: the files are in `~/.claude/plugins/store/`, one JSON file a plugin, named after it
- If you use the status line, copy the new script over the old one

## Development

```
claude --plugin-dir /path/to/claude-code-nightpub-ui
claude plugin validate .
claude plugin test .
npx -y -p typescript@5 tsc -p .
node scripts/preview.mjs /path/to/an/empty/folder
```

`tsconfig.json` extends `.claude-plugin/types/tsconfig.json`, which Claude Code writes the first time it loads the plugin, so run the plugin once before type-checking. The declarations it lays down are the build's own; type-check against a build that is 2.1.325 or later.

`scripts/preview.mjs` writes a page that shows every background in every palette the way Claude Desktop draws them, with a quick version of each to watch its events without waiting. `scripts/build-terminal-themes.mjs` writes `themes/` from `hooks/palettes.ts`, and `scripts/bake-mark.mjs` bakes the NightPub mark into the cells the backgrounds draw.

## License

[MIT](LICENSE)
