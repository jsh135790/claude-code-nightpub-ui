import type { On, RenderPropsOf, RenderSurface, ThemeSetArgs, TurnUsage, UiPane } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

const PANE_PROPS: RenderPropsOf['Pane'] = {
  title: 'Usage',
  isFocused: false,
  bodyColumns: 46,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

const BAND_PROPS: RenderPropsOf['AbovePrompt'] = {
  hasSurvey: false,
  isCollapsed: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 100,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
}

const PANE = { plugin: 'capsule-panel', component: 'Pane', props: PANE_PROPS, requestId: 'capsule-panel' } as const
const BAND = { plugin: 'capsule-panel', component: 'AbovePrompt', props: BAND_PROPS } as const
const WORKING_BAND = { ...BAND, props: { ...BAND_PROPS, isWorking: true } } as const

const GREEN = '#a6e3a1'
const RED = '#f38ba8'
const MAUVE = '#cba6f7'
const BLUE = '#89b4fa'
const TEAL = '#94e2d5'
const YELLOW = '#f9e2af'
const MINUTE = 60_000

// Nerd Font glyphs live in the private use areas; nothing else here does.
const PUA = new RegExp(
  `[${String.fromCharCode(0xe000)}-${String.fromCharCode(0xf8ff)}]|[${String.fromCodePoint(0xf0000)}-${String.fromCodePoint(0xffffd)}]`,
  'u',
)
// block elements: sparkline bars and pixel art, none of which the band draws now
const BLOCKS = /[▀-▟]/

// Every section and every detail, as 0.4.1 drew them before any could be
// turned off, and no look: the panel in its own colours. The tests written
// for that run with these on both surfaces; a test of what a new install
// shows passes `fresh`.
const NO_LOOK = { palette: 'off', scene: 'none' } as const
const EVERYTHING = {
  modelLine: true,
  legend: true,
  cache: true,
  cacheDetail: true,
  spendBars: true,
  sparkline: true,
  recentCalls: 5,
  changedFiles: 5,
  todo: true,
  versions: true,
} as const

type EngineOptions = {
  /** A new install: nothing stored, so the panel's own defaults. */
  fresh?: boolean
  /** `git status --porcelain=v2 --branch` output; no repository when not given. */
  git?: string
  /** `git diff --numstat HEAD` output. */
  numstat?: string
  /** What the plugin's store holds at the start. */
  store?: Record<string, unknown>
  env?: Record<string, string>
  /** The files there are at the start, by path. */
  files?: Record<string, string>
  surfaces?: RenderSurface[]
  /** The auto-compact threshold the context breakdown reports. */
  threshold?: number
  /** What `$.session.id()` answers; `s1` when not given. */
  sessionId?: string
}

// Hooks beneath the plugin that stand for the engine, so every event the
// plugin passes on with next(e) settles in the test host.
const engine = (on: On, panes: UiPane[] = [], opts: EngineOptions = {}) => {
  const closed: string[] = []
  const toasts: string[] = []
  const played: string[] = []
  const runs: string[][] = []
  const notes: { text: string; title?: string }[] = []
  const compacts: string[] = []
  const store: Record<string, unknown> = { ...opts.store }
  const env = opts.env ?? {}
  // what each next turn.step's response reports as its usage, in order
  const steps: TurnUsage[] = []
  const session = { id: opts.sessionId ?? 's1' }
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('turn.step', async function* ($, e) {
    const usage = steps.shift() ?? null
    yield { kind: 'stop' as const, stopReason: 'end_turn' as const, usage }
    return { turnId: e.turnId, index: e.index, answer: '', toolUses: [], stopReason: 'end_turn' as const, usage }
  })
  on('session.id', () => ({ value: session.id }))
  on('session.end', ($, e) => ({ sessionId: e.sessionId }))
  on('session.compact', ($, e) => {
    // the kit raises a plugin's compaction with the call's own arguments: no trigger, no messages
    compacts.push(String(e.trigger))
    return {
      messages: [{ role: 'user', text: 'Summary of the conversation so far.', toolUses: [] }],
      tokensBefore: 180_000,
      tokensAfter: 32_000,
    }
  })
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: {
        window: 1_000_000,
        breakdown:
          opts.threshold === undefined ? undefined : ({ categories: [], autoCompactThreshold: opts.threshold } as never),
      },
      rateLimits: [],
    },
  }))
  on('session.model', () => ({ value: 'claude-test-1' }))
  on('session.cwd', () => ({ value: 'C:/work' }))
  on('session.surfaces', () => ({ value: opts.surfaces ?? ['terminal'] }))
  on('session.version', () => ({ value: { version: '2.1.317', base: '2.1.317' } }))
  on('agent.list', () => ({ value: [] }))
  on('env.get', ($, e) => ({ value: env[e.name] }))
  // the files there are, and each path the plugin wrote, in order
  const files: Record<string, string> = { ...opts.files }
  const writes: string[] = []
  // the engine hands over a path in the system's own spelling: kept here with forward slashes
  const slashed = (path: string) => path.split(String.fromCharCode(92)).join('/')
  on('fs.read', ($, e) => {
    const text = files[slashed(e.path)]
    return text === undefined ? { deny: `ENOENT: ${e.path}` } : { value: text }
  })
  on('fs.write', ($, e) => {
    files[slashed(e.path)] = e.text
    writes.push(slashed(e.path))
    return { value: undefined }
  })
  // what stands in the store where the test put nothing: EVERYTHING, unless fresh
  const seeds: Record<string, unknown> =
    opts.fresh === true ? {} : { 'settings.terminal': EVERYTHING, 'settings.desktop': EVERYTHING, look: NO_LOOK }
  for (const key of ['settings.terminal', 'settings.desktop']) {
    if (key in seeds && key in store) store[key] = { ...EVERYTHING, ...(store[key] as object) }
  }
  on('store.get', ($, e) => ({ value: e.key in store ? store[e.key] : seeds[e.key] }))
  // a test that never starts the session reads the settings before any were loaded
  on('state.get', { plugin: 'capsule-panel', key: 'settings' }, async ($, e, next) => {
    const got = await next(e)
    if (opts.fresh === true || got.value === undefined || got.value.version !== 0) return got
    return { value: { value: { terminal: EVERYTHING, desktop: EVERYTHING }, version: 0 } }
  })
  on('state.get', { plugin: 'capsule-panel', key: 'look' }, async ($, e, next) => {
    const got = await next(e)
    if (opts.fresh === true || got.value === undefined || got.value.version !== 0) return got
    return { value: { value: NO_LOOK, version: 0 } }
  })
  // a client that draws themes, and what the plugin asked of it
  const theme = { sets: [] as ThemeSetArgs[], clears: 0 }
  on('theme.set', ($, e) => {
    theme.sets.push(e)
    return { value: { isDrawn: true, requestId: 'backdrop' } }
  })
  on('theme.clear', () => {
    theme.clears += 1
    return { value: { isDrawn: false, reason: 'cleared' } }
  })
  // the engine's own spinner: the words it is handed
  on('ui.render', { component: 'Spinner' }, ($, e) => ({ type: 'Text', children: [e.props.message ?? e.props.word] }))
  on('store.set', ($, e) => {
    store[e.key] = e.value
    return { value: undefined }
  })
  on('store.delete', ($, e) => {
    delete store[e.key]
    return { value: undefined }
  })
  on('store.keys', () => ({ value: Object.keys(store) }))
  on('ui.notify', ($, e) => {
    notes.push({ text: e.text, title: e.title })
    return { value: { isSent: true, channel: 'kitty' } }
  })
  on('process.run', ($, e) => {
    runs.push([...e.argv])
    const ok = (stdout: string) => ({ exitCode: 0, stdout, stderr: '', isStdoutTruncated: false, isStderrTruncated: false })
    if (e.argv[0] !== 'git') return { value: ok('') }
    if (opts.git === undefined) {
      return {
        value: { exitCode: 128, stdout: '', stderr: 'not a git repository', isStdoutTruncated: false, isStderrTruncated: false },
      }
    }
    return { value: ok(e.argv.includes('status') ? opts.git : (opts.numstat ?? '')) }
  })
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'test' } }))
  on('ui.panes', () => ({ value: panes }))
  on('ui.close', ($, e) => {
    closed.push(e.id)
    return { value: undefined }
  })
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('audio.play', ($, e) => {
    played.push(e.clip.asset ?? e.clip.url ?? 'bytes')
    return { value: undefined }
  })
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box' }))
  return { closed, toasts, played, runs, notes, compacts, store, steps, session, theme, files, writes }
}

/** A call left running: the test ends with it under way, and what its teardown makes of it is nobody's to handle. */
const running = (call: Promise<unknown>): void => {
  call.catch(() => {})
}

/** Local noon (or the given hour and minute) on a day of November 2026. */
const nov = (day: number, hour = 12, minute = 0) => new Date(2026, 10, day, hour, minute).getTime()

const measure = (percent: number, extra: { costUsd?: number; limits?: { pct: number; resetsAt: string }[] } = {}) => ({
  context: { tokens: percent * 10_000, window: 1_000_000, percent },
  rateLimits: (extra.limits ?? []).map(l => ({ kind: 'five_hour', percentUsed: l.pct, resetsAt: l.resetsAt })),
  cost: extra.costUsd === undefined ? undefined : { usd: extra.costUsd },
  changed: ['context' as const],
})

const usage = (input: number, output: number, read = 0, write = 0): TurnUsage => ({
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: read,
  cache_creation_input_tokens: write,
  model: 'claude-test-1',
})

/** One request of turn `turnId` that reports `u` as it ends, read to its end. */
const step = async ($: Engine, steps: TurnUsage[], u: TurnUsage, turnId = 't1', agentId?: string) => {
  steps.push(u)
  const stream = $.turn.step({
    turnId,
    index: 0,
    model: 'claude-test-1',
    messageCount: 1,
    ...(agentId === undefined ? {} : { agentId }),
  })
  for await (const _ of stream) {
    // drained
  }
  await stream.result
}

const complete = (turnId: string) => ({
  answer: '',
  durationMs: 1000,
  isAborted: false,
  turnId,
  reason: 'answer' as const,
  usage: {
    input_tokens: 10,
    output_tokens: 20,
    cache_read_input_tokens: 0,
    cache_creation_input_tokens: 0,
    model: 'claude-test-1',
  },
})

test('the pane draws its sections on every surface it is placed on', async ($, on) => {
  engine(on)
  mock.clock(on, { now: 1_000_000 })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface, viewport: { columns: 160, rows: 40, isFullscreen: true } })
    const title = surface === 'terminal' ? await ui.find({ type: 'Text', text: /USAGE/ }) : await ui.find({ type: 'Svg' })
    expect(title).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /CONTEXT/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /no activity yet/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /LIMITS/ })).toBeUndefined()
    await ui.unmount()
  }
})

test('the terminal gets Nerd Font glyphs and the desktop vector icons', async ($, on) => {
  engine(on)
  mock.clock(on, { now: 1_000_000 })
  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await terminal.findAll({ type: 'Text' })).some(t => PUA.test(t.text))).toBe(true)
  await terminal.unmount()

  const desktop = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await desktop.findAll({ type: 'Text' })).some(t => PUA.test(t.text))).toBe(false)
  expect((await desktop.findAll({ type: 'Text' })).some(t => /[◧☰⇅◷∿»◈⎇☑]/.test(t.text))).toBe(false)
  expect(await desktop.find({ type: 'Text', text: /^ CONTEXT$/ })).toBeDefined()
  const icons = (await desktop.findAll({ type: 'Svg' })).filter(s => s.props.width === 12)
  expect(icons.map(s => s.props.alt)).toEqual(['context', 'cache', 'tokens', 'cost', 'activity'])
  expect(String(icons[0]?.props.source)).toMatch(/viewBox="0 0 24 24" fill="none" stroke="#6c7086" stroke-width="3\.2"/)
  await desktop.unmount()
})

test('the desktop branch icon stands upright, as a shape', async ($, on) => {
  engine(on, [], {
    git: '# branch.oid abc\n# branch.head main\n# branch.ab +1 -0\n1 .M N... 100644 100644 100644 a b src/x.ts\n',
  })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/work', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const branch = (await ui.findAll({ type: 'Svg' })).find(s => s.props.alt === 'branch')
  // a vertical trunk, not the sideways ⎇ every font draws
  expect(String(branch?.props.source)).toMatch(/<path d="M6 3V15"\/>/)
  expect(await ui.find({ type: 'Text', text: /^ main$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /⎇/ })).toBeUndefined()
  await ui.unmount()
})

test('the desktop draws each capsule as an SVG with round ends', async ($, on) => {
  engine(on)
  mock.clock(on, { now: 1_000_000 })
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const capsule = await ui.find({ type: 'Svg' })
  expect(capsule?.props.alt).toBe('USAGE')
  expect(capsule?.props.height).toBe(17)
  const source = String(capsule?.props.source)
  expect(source).toMatch(/<rect [^>]*rx="8.5" fill="#cba6f7"/)
  expect(source).toMatch(/font-size="12"/)
  expect(source).toMatch(/>USAGE<\/text>/)
  // the icon is a shape, not a glyph from whatever font the surface has
  expect(source).toMatch(/<path d="M5 0\.5L6\.1/)
  expect(source).not.toMatch(/✦/)
  expect(capsule?.props.isInteractive).toBe(false)
  await ui.unmount()
})

test('the terminal icon setting can drop the Nerd Font glyphs', async ($, on) => {
  engine(on, [], { store: { 'settings.terminal': { icons: 'unicode' } } })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.findAll({ type: 'Text' })).some(t => PUA.test(t.text))).toBe(false)
  expect(await ui.find({ type: 'Text', text: /^◧$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ CONTEXT$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^☰$/ })).toBeDefined()
  await ui.unmount()
})

test('the context figure follows the thresholds once the count-up settles', async ($, on) => {
  engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.measure(measure(43))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /^43%$/ }))?.props.color).toBe(GREEN)

  await $.session.measure(measure(92))
  await clock.advance(1_000)
  await ui.redraw()
  expect((await ui.find({ type: 'Text', text: /^92%$/ }))?.props.color).toBe(RED)
  await ui.unmount()
})

test('each request adds up tokens and the cache hit rate while the turn runs', async ($, on) => {
  const { steps } = engine(on)
  mock.clock(on, { now: 1_000_000 })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await step($, steps, usage(1000, 500, 91_000, 8_000))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  // no turn.complete yet: a long turn's figures move as it runs
  expect(await ui.find({ type: 'Text', text: /^91% hit$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /↑ 1k {2}↓ 500/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /1 turn$/ })).toBeDefined()

  await step($, steps, usage(1000, 500, 91_000, 8_000))
  // the turn's end reports the same requests again: they are not counted twice
  await $.turn.complete({ ...complete('t1'), usage: usage(2000, 1000, 182_000, 16_000) })
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /↑ 2k {2}↓ 1k/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /R 182k {2}W 16k/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /1 turn$/ })).toBeDefined()
  await ui.unmount()
})

test("a subagent's requests count toward the tokens but not the turns or the live state", async ($, on) => {
  const { steps } = engine(on)
  mock.clock(on, { now: 1_000_000 })
  await $.turn.start({ text: 'look around', turnId: 'a-t1', agentId: 'a1' })
  await step($, steps, usage(300, 200), 'a-t1', 'a1')
  await $.turn.complete({ ...complete('a-t1'), agentId: 'a1' })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /↑ 300 {2}↓ 200/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /0 turns$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ idle$/ })).toBeDefined()
  await ui.unmount()
})

test('the totals are saved under the session id as the turn ends', async ($, on) => {
  const { steps, store } = engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await step($, steps, usage(4000, 1500, 50_000, 2_000))
  await $.turn.complete(complete('t1'))
  await clock.settle()
  expect(store['totals/s1']).toMatchObject({ input: 4000, output: 1500, cacheRead: 50_000, cacheWrite: 2_000, turns: 1 })
})

test('a resumed session starts from what its last run saved, and old entries go', async ($, on) => {
  const now = 40 * 24 * 60 * MINUTE
  const { store } = engine(on, [], {
    store: {
      'totals/s1': { input: 4000, output: 1500, cacheRead: 50_000, cacheWrite: 2_000, turns: 3, savedAt: now - MINUTE },
      'totals/old': { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, turns: 1, savedAt: 1 },
    },
  })
  const clock = mock.clock(on, { now })
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /↑ 4k {2}↓ 1\.5k/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /3 turns$/ })).toBeDefined()
  await ui.unmount()
  expect(store['totals/old']).toBeUndefined()
  expect(store['totals/s1']).toBeDefined()
})

test('a reload keeps the counts it has instead of the saved ones', async ($, on) => {
  const { steps } = engine(on, [], {
    store: { 'totals/s1': { input: 9000, output: 9000, cacheRead: 0, cacheWrite: 0, turns: 9, savedAt: 900_000 } },
  })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await step($, steps, usage(100, 100))
  // a reload runs session.start again over the same state
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /↑ 9\.1k {2}↓ 9\.1k/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /10 turns$/ })).toBeDefined()
  await ui.unmount()
})

test('/clear saves the ending session and starts the new one from zero', async ($, on) => {
  const eng = engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await step($, eng.steps, usage(700, 300))
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: {} as never })
  eng.session.id = 's2'
  expect(eng.store['totals/s1']).toMatchObject({ input: 700, output: 300, turns: 1 })

  await $.turn.start({ text: 'again', turnId: 't2' })
  await step($, eng.steps, usage(50, 20), 't2')
  await $.turn.complete(complete('t2'))
  await clock.settle()
  expect(eng.store['totals/s2']).toMatchObject({ input: 50, output: 20, turns: 1 })
  expect(eng.store['totals/s1']).toMatchObject({ input: 700, output: 300, turns: 1 })
})

test('a /resume inside the process loads the other session and drops this one', async ($, on) => {
  const eng = engine(on, [], {
    store: { 'totals/s9': { input: 5000, output: 2500, cacheRead: 0, cacheWrite: 0, turns: 4, savedAt: 900_000 } },
  })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await step($, eng.steps, usage(700, 300))
  await $.turn.complete(complete('t1'))
  await $.session.end({ reason: 'resume', sessionId: 's1', resume: {} as never })
  eng.session.id = 's9'
  await clock.advance(1_000)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /↑ 5k {2}↓ 2\.5k/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /4 turns$/ })).toBeDefined()
  await ui.unmount()
  expect(eng.store['totals/s1']).toMatchObject({ input: 700, output: 300, turns: 1 })
})

test('without rate limits the cost row shows the hourly burn instead', async ($, on) => {
  engine(on)
  const clock = mock.clock(on, { now: 0 })
  await $.session.measure(measure(10, { costUsd: 1 }))
  await clock.set(30 * MINUTE)
  await $.session.measure(measure(12, { costUsd: 2 }))
  await clock.advance(1_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^\$2\.00$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /\$4\.00\/h/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /LIMITS/ })).toBeUndefined()
  await ui.unmount()
})

test('a limit burning faster than its window warns how long is left', async ($, on) => {
  engine(on)
  const clock = mock.clock(on, { now: 0 })
  const farReset = new Date(5 * 60 * MINUTE).toISOString()
  await $.session.measure(measure(10, { limits: [{ pct: 10, resetsAt: farReset }] }))
  await clock.set(10 * MINUTE)
  await $.session.measure(measure(10, { limits: [{ pct: 20, resetsAt: farReset }] }))
  await clock.advance(1_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /LIMITS/ })).toBeDefined()
  // 10 points in 10 minutes leaves 80 points: 1h20m, well before the reset
  expect((await ui.find({ type: 'Text', text: /~1h20m/ }))?.props.color).toBe(RED)
  await ui.unmount()
})

test('that forecast also raises one toast, and only one, per window', async ($, on) => {
  const { toasts } = engine(on)
  const clock = mock.clock(on, { now: 0 })
  const farReset = new Date(5 * 60 * MINUTE).toISOString()
  await $.session.measure(measure(10, { limits: [{ pct: 10, resetsAt: farReset }] }))
  await clock.settle()
  expect(toasts).toEqual([])

  await clock.set(10 * MINUTE)
  await $.session.measure(measure(10, { limits: [{ pct: 20, resetsAt: farReset }] }))
  await clock.settle()
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toMatch(/5h limit on pace to run out in ~1h20m, before it resets in 4h50m/)

  await clock.set(20 * MINUTE)
  await $.session.measure(measure(10, { limits: [{ pct: 30, resetsAt: farReset }] }))
  await clock.settle()
  expect(toasts.length).toBe(1)
})

test('a limit that resets before it fills is marked safe', async ($, on) => {
  const { toasts } = engine(on)
  const clock = mock.clock(on, { now: 0 })
  const soonReset = new Date(30 * MINUTE).toISOString()
  await $.session.measure(measure(10, { limits: [{ pct: 10, resetsAt: soonReset }] }))
  await clock.set(10 * MINUTE)
  await $.session.measure(measure(10, { limits: [{ pct: 20, resetsAt: soonReset }] }))
  await clock.advance(1_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /✓/ }))?.props.color).toBe(GREEN)
  expect(await ui.find({ type: 'Text', text: /~1h20m/ })).toBeUndefined()
  expect(toasts).toEqual([])
  await ui.unmount()
})

test('tool calls land in the activity list with their time and outcome', async ($, on) => {
  engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  on('tool.call', async ($, e) => {
    if (e.tool === 'Bash') {
      await clock.sleep(1_500)
      return { isError: true, result: 'exit 1', text: 'exit 1' }
    }
    return { result: { ok: true }, text: 'ok' }
  })

  const pending = $.tool.call({ tool: 'Bash', command: 'npm test', description: 'run tests' })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /npm test/ })).toBeDefined()

  await clock.advance(1_500)
  await pending
  await $.tool.call({ tool: 'Read', file_path: 'C:/work/src/register.tsx' })
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /^register\.tsx$/ })).toBeDefined()
  expect((await ui.find({ type: 'Text', text: /^✗ $/ }))?.props.color).toBe(RED)
  expect(await ui.find({ type: 'Text', text: /1\.5s/ })).toBeDefined()
  await ui.unmount()
})

test('a todo list shows its progress and the step under way', async ($, on) => {
  engine(on)
  mock.clock(on, { now: 1_000_000 })
  on('tool.call', () => ({ result: {}, text: 'ok' }))
  await $.tool.call({
    tool: 'TodoWrite',
    todos: [
      { content: 'Write types', status: 'completed', activeForm: 'Writing types' },
      { content: 'Write tests', status: 'in_progress', activeForm: 'Writing tests' },
      { content: 'Ship it', status: 'pending', activeForm: 'Shipping it' },
    ],
  })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /1\/3/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /→ Writing tests/ })).toBeDefined()
  await ui.unmount()
})

test('the band stays out of the way until a turn is working', async ($, on) => {
  engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  on('tool.call', async () => {
    await clock.sleep(5_000)
    return { result: {}, text: 'ok' }
  })

  const idle = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await idle.find({ type: 'Text', text: /tok\/s|thinking|Bash/ })).toBeUndefined()
  await idle.unmount()

  await $.turn.start({ text: 'go', turnId: 't1' })
  running($.tool.call({ tool: 'Bash', command: 'npm run build' }))
  await clock.advance(240)
  const ui = await $.ui.mount({ ...WORKING_BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /Bash/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /npm run build/ })).toBeDefined()
  await ui.unmount()
})

test('the band leads with the phase pill and draws no pixel art', async ($, on) => {
  engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await clock.advance(240)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...WORKING_BAND, surface })
    expect((await ui.findAll({ type: 'Text' })).some(t => BLOCKS.test(t.text))).toBe(false)
    if (surface === 'terminal') {
      expect(await ui.find({ type: 'Text', text: /thinking/ })).toBeDefined()
    } else {
      expect((await ui.findAll({ type: 'Text' })).some(t => PUA.test(t.text))).toBe(false)
      const capsule = await ui.find({ type: 'Svg' })
      expect(capsule?.props.alt).toBe('thinking')
      expect(String(capsule?.props.source)).toMatch(new RegExp(`fill="${MAUVE}"[^]*>thinking<`))
    }
    await ui.unmount()
  }
})

test('the band capsule fits its label, and its spinner frame never changes', async ($, on) => {
  engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  on('tool.call', async () => {
    await clock.sleep(5_000)
    return { result: {}, text: 'ok' }
  })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await clock.advance(240)
  const terminal = await $.ui.mount({ ...WORKING_BAND, surface: 'terminal' })
  const desktop = await $.ui.mount({ ...WORKING_BAND, surface: 'desktop' })
  const terminalCapsule = async () =>
    (await terminal.findAll({ type: 'Text' })).find(t => t.props.backgroundColor !== undefined)?.text ?? ''
  const capsule = async () => (await desktop.findAll({ type: 'Svg' })).find(s => s.props.isInteractive !== true)
  const spinner = async () => (await desktop.findAll({ type: 'Svg' })).find(s => s.props.isInteractive === true)

  const thinkingWidth = Number((await capsule())?.props.width)
  expect(await spinner()).toBeUndefined()

  running($.tool.call({ tool: 'Bash', command: 'npm run build' }))
  await clock.advance(120)
  await terminal.redraw()
  await desktop.redraw()
  const first = await terminalCapsule()
  // nothing pads the label, so it sits centered between the caps
  expect(first).toMatch(/ Bash$/)
  const bash = await capsule()
  expect(bash?.props.alt).toBe('Bash')
  expect(Number(bash?.props.width)).toBeLessThan(thinkingWidth)
  // the capsule leaves its icon slot empty: the spinner is a frame laid over it
  expect(String(bash?.props.source)).not.toMatch(/animateTransform/)
  const frame = await spinner()
  expect(frame?.props.alt).toBe('working')
  expect(String(frame?.props.source)).toMatch(/<animateTransform attributeName="transform" type="rotate"/)
  expect(String(frame?.props.source)).toMatch(/ color="#1e1e2e" font-family="monospace"/)

  await clock.advance(120)
  await terminal.redraw()
  await desktop.redraw()
  // the terminal steps its glyph; the desktop's frame turns by itself
  expect(await terminalCapsule()).not.toBe(first)

  // a new tool changes the capsule's label and width beneath the frame, never
  // the frame: Claude Desktop keeps a frame only while it stays byte for byte the same
  running($.tool.call({ tool: 'Glob', pattern: '**/*.ts' }))
  await clock.advance(120)
  await desktop.redraw()
  expect((await capsule())?.props.alt).toBe('Glob')
  const again = await spinner()
  expect(again?.props.source).toBe(frame?.props.source)
  expect(again?.props.width).toBe(frame?.props.width)
  expect(again?.props.height).toBe(frame?.props.height)
  expect(again?.props.alt).toBe(frame?.props.alt)
  await terminal.unmount()
  await desktop.unmount()
})

test('the band keeps to one line: only the detail gives way', async ($, on) => {
  engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  on('tool.call', async () => {
    await clock.sleep(5_000)
    return { result: {}, text: 'ok' }
  })
  await $.turn.start({ text: 'go', turnId: 't1' })
  running($.tool.call({ tool: 'Bash', command: `npm run build -- ${'--flag '.repeat(20)}` }))
  await clock.advance(240)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...WORKING_BAND, props: { ...BAND_PROPS, isWorking: true, bodyColumns: 60 }, surface })
    // the engine stacks the band's rows in a column of its own: the row is the first box laid as a row
    const root = (await ui.findAll({ type: 'Box' })).find(box => box.props.flexDirection === 'row')
    expect(root?.props.width).toBe(surface === 'terminal' ? 60 : '100%')
    const parts = (root?.children ?? []).filter(
      (c): c is { type: string; props: Record<string, unknown> } => typeof c === 'object' && c !== null && 'props' in c,
    )
    // capsule, detail, figures: only the detail may shrink
    expect(parts.length).toBe(3)
    expect(parts.map(p => p.props.flexShrink)).toEqual([0, 1, 0])
    expect(parts[1]?.props.minWidth).toBe(0)
    expect((await ui.find({ type: 'Text', text: /npm run build/ }))?.props.wrap).toBe('truncate-end')
    for (const t of await ui.findAll({ type: 'Text', text: /\d+s$/ })) expect(t.props.wrap).toBe('truncate-end')
    await ui.unmount()
  }
})

test('the settings page changes one surface, and the store keeps it', async ($, on) => {
  const { store } = engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pane.press({ key: 'open-settings' })
  await pane.redraw()
  // a whole page of its own: the dashboard steps aside
  expect(await pane.find({ type: 'Text', text: /CONTEXT/ })).toBeUndefined()
  // it opens on Look, where the terminal's own icon set is; the rest is a page away
  expect(await pane.find({ key: 'set-icons' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /the terminal only/ })).toBeDefined()
  expect(await pane.find({ key: 'set-band' })).toBeUndefined()
  await pane.press({ key: 'tab-panel' })
  await pane.redraw()
  expect((await pane.find({ key: 'set-cacheTtl' }))?.props.label).toBe('auto (1h)')
  expect(await pane.find({ key: 'set-icons' })).toBeUndefined()
  await pane.press({ key: 'tab-alerts' })
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^Activity band$/ })).toBeDefined()
  expect((await pane.find({ key: 'set-band' }))?.props.label).toBe('on')

  await pane.press({ key: 'set-band' })
  await pane.press({ key: 'set-notifyAfterS' })
  await clock.settle()
  await pane.redraw()
  expect((await pane.find({ key: 'set-band' }))?.props.label).toBe('off')
  expect((await pane.find({ key: 'set-notifyAfterS' }))?.props.label).toBe('120s')
  expect(store['settings.terminal']).toEqual(expect.objectContaining({ band: false, notifyAfterS: 120 }))
  expect(store['settings.desktop']).toBeUndefined()

  await pane.press({ key: 'settings-back' })
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /CONTEXT/ })).toBeDefined()
  await pane.unmount()

  // the band goes in the terminal and stays on the desktop
  await $.turn.start({ text: 'go', turnId: 't1' })
  await clock.advance(240)
  const terminal = await $.ui.mount({ ...WORKING_BAND, surface: 'terminal' })
  expect(await terminal.find({ type: 'Text', text: /thinking/ })).toBeUndefined()
  await terminal.unmount()
  const desktop = await $.ui.mount({ ...WORKING_BAND, surface: 'desktop' })
  expect((await desktop.find({ type: 'Svg' }))?.props.alt).toBe('thinking')
  const settings = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await settings.press({ key: 'open-settings' })
  await settings.press({ key: 'tab-look' })
  await settings.redraw()
  expect(await settings.find({ key: 'set-icons' })).toBeUndefined()
  // the look is everyone's; the other two pages are this surface's own
  expect(await settings.find({ type: 'Text', text: /the same on every surface/ })).toBeDefined()
  await settings.press({ key: 'tab-panel' })
  await settings.redraw()
  expect(await settings.find({ type: 'Text', text: /Claude Desktop only/ })).toBeDefined()
  await desktop.unmount()
  await settings.unmount()
})

test('Claude Desktop starts with the sound and the notification off', async ($, on) => {
  const { played, runs } = engine(on, [], { surfaces: ['desktop'], env: { OS: 'Windows_NT' } })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/work', surface: 'desktop', isInteractive: true })
  await clock.settle()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete({ ...complete('t1'), durationMs: 5 * MINUTE })
  await clock.settle()
  expect(played).toEqual([])
  expect(runs.some(argv => argv[0] === 'powershell')).toBe(false)

  const pane = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await pane.press({ key: 'open-settings' })
  await pane.press({ key: 'tab-alerts' })
  await pane.redraw()
  expect((await pane.find({ key: 'set-sound' }))?.props.label).toBe('off')
  expect((await pane.find({ key: 'set-notify' }))?.props.label).toBe('off')
  await pane.unmount()
})

test('a stored setting comes back in the next session', async ($, on) => {
  const { played } = engine(on, [], { surfaces: ['desktop'], store: { 'settings.desktop': { sound: true } } })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/work', surface: 'desktop', isInteractive: true })
  await clock.settle()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete(complete('t1'))
  await clock.settle()
  expect(played).toEqual(['assets/done.wav'])
})

test('a completed turn plays the done sound', async ($, on) => {
  const { played } = engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete(complete('t1'))
  await clock.settle()
  expect(played).toEqual(['assets/done.wav'])
})

test('the sound setting turned off keeps a completed turn quiet', async ($, on) => {
  const { played } = engine(on, [], { store: { 'settings.terminal': { sound: false } } })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete(complete('t1'))
  await clock.settle()
  expect(played).toEqual([])
})

test('/panel opens the pane, and closes it once it is up', async ($, on) => {
  const placed: UiPane = { id: 'capsule-panel', title: 'Usage', isShown: true, isFocused: false, isPlaced: true }
  const { closed } = engine(on, [placed])
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const run = () =>
    $.command.run({
      command: 'panel',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: true, columns: 160 },
    })
  expect((await run()).text).toMatch(/closed/)
  expect(closed).toEqual(['capsule-panel'])
})

test('/panel opens the pane while it is not up', async ($, on) => {
  const { closed } = engine(on, [])
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const result = await $.command.run({
    command: 'panel',
    args: '',
    origin: { kind: 'composer' },
    presentation: { isFullscreen: true, columns: 120 },
  })
  expect(result.text).toMatch(/opened/)
  expect(closed).toEqual([])
})

test('a /clear resets the figures to placeholders', async ($, on) => {
  engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.measure(measure(43))
  await clock.advance(1_000)
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } })
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /— \/ —/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^43%$/ })).toBeUndefined()
  await ui.unmount()
})

test('the header names the model and effort, the footer the versions', async ($, on) => {
  engine(on, [], { env: { CLAUDE_EFFORT: 'xhigh', CLAUDE_CODE_DESKTOP_APP_VERSION: '4.23118.0' } })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/work', surface: 'desktop', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ type: 'Text', text: /^ test-1 · xhigh$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^CC 2\.1\.317 · Desktop 4\.23118\.0$/ })).toBeDefined()

  await ui.press({ key: 'open-settings' })
  await ui.press({ key: 'tab-panel' })
  await ui.redraw()
  await ui.press({ key: 'set-versions' })
  await ui.press({ key: 'settings-back' })
  await clock.settle()
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /^CC / })).toBeUndefined()
  await ui.unmount()
})

test('the cache row counts down to cold', async ($, on) => {
  // no key in the environment: a subscriber, whose cache lasts an hour
  engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /warm|cold/ })).toBeUndefined()

  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete(complete('t1'))
  await clock.advance(1_000)
  await ui.redraw()
  expect((await ui.find({ type: 'Text', text: /^ {2}warm 1h00m$/ }))?.props.color).toBe(TEAL)

  await clock.advance(59 * MINUTE + 29_000)
  await ui.redraw()
  expect((await ui.find({ type: 'Text', text: /^ {2}warm 0:30$/ }))?.props.color).toBe(YELLOW)

  await clock.advance(MINUTE)
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /^ {2}cold$/ })).toBeDefined()
  await ui.unmount()
})

test('a key in the environment makes the cache 5 minutes, and the TTL setting overrides it', async ($, on) => {
  engine(on, [], { env: { ANTHROPIC_AUTH_TOKEN: 'test-token' } })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete(complete('t1'))
  await clock.advance(1_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^ {2}warm 5m$/ })).toBeDefined()

  await ui.press({ key: 'open-settings' })
  await ui.press({ key: 'tab-panel' })
  await ui.redraw()
  expect((await ui.find({ key: 'set-cacheTtl' }))?.props.label).toBe('auto (5m)')
  await ui.press({ key: 'set-cacheTtl' })
  await ui.press({ key: 'set-cacheTtl' })
  await clock.settle()
  await ui.redraw()
  expect((await ui.find({ key: 'set-cacheTtl' }))?.props.label).toBe('1h')
  await ui.press({ key: 'settings-back' })
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /^ {2}warm 1h00m$/ })).toBeDefined()
  await ui.unmount()
})

test('spend adds up every session today and this week, and turns over at midnight', async ($, on) => {
  const { store } = engine(on, [], {
    store: {
      'spend/2026-11-11/other': 3,
      'spend/2026-11-10/other': 2,
      // last Sunday: in the last seven days, not in this week
      'spend/2026-11-08/other': 4,
      // past the two weeks kept
      'spend/2026-10-20/old': 9,
    },
  })
  // a Wednesday, ten minutes to midnight
  const clock = mock.clock(on, { now: nov(11, 23, 50) })
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  expect(store['spend/2026-10-20/old']).toBeUndefined()

  await $.session.measure(measure(10, { costUsd: 1.5 }))
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^today \$4\.50$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ {2}wk \$6\.50 {2}$/ })).toBeDefined()
  const mine = () =>
    Object.entries(store)
      .filter(([k]) => /^spend\/2026-11-1[12]\//.test(k) && !k.endsWith('/other'))
      .map(([k, v]) => `${k.slice(6, 16)} ${String(v)}`)
  expect(mine()).toEqual(['2026-11-11 1.5'])

  // past midnight the session's cost books to the new day, from what it had spent
  await clock.set(nov(12, 0, 10))
  await $.session.measure(measure(10, { costUsd: 2 }))
  await clock.settle()
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /^today \$0\.50$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ {2}wk \$7\.00 {2}$/ })).toBeDefined()
  expect(mine()).toEqual(['2026-11-11 1.5', '2026-11-12 0.5'])
  await ui.unmount()
})

test('the forecast counts turns to the auto-compact, and compact now takes two presses', async ($, on) => {
  const { compacts } = engine(on, [], { threshold: 160_000 })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  // 40k, 60k, 80k: 20k a turn, with 80k left before 160k
  for (const [i, pct] of [4, 6, 8].entries()) {
    await $.session.measure(measure(pct))
    await $.turn.complete(complete(`t${i}`))
  }
  await clock.advance(1_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^≈4 turns to auto-compact$/ })).toBeDefined()
  const label = async () => (await ui.find({ key: 'compact' }))?.props.label
  expect(await label()).toBe('compact now')

  // one press arms it for a few seconds, and lapses
  await ui.press({ key: 'compact' })
  await ui.redraw()
  expect(await label()).toBe('press again to compact')
  await clock.advance(3_500)
  await ui.redraw()
  expect(await label()).toBe('compact now')
  expect(compacts).toEqual([])

  await ui.press({ key: 'compact' })
  await ui.press({ key: 'compact' })
  await clock.settle()
  await ui.redraw()
  expect(compacts.length).toBe(1)
  expect(await ui.find({ type: 'Text', text: /^compacted 180k → 32k$/ })).toBeDefined()

  await clock.advance(16 * MINUTE)
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /compacted/ })).toBeUndefined()
  await ui.unmount()
})

test('a long turn raises a Windows toast, and a short one nothing', async ($, on) => {
  const { runs, notes } = engine(on, [], { env: { OS: 'Windows_NT' } })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const toasts = () => runs.filter(argv => argv[0] === 'powershell')

  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete({ ...complete('t1'), answer: 'quick', durationMs: 5_000 })
  await clock.settle()
  expect(toasts()).toEqual([])

  await $.turn.start({ text: 'go', turnId: 't2' })
  await $.turn.complete({ ...complete('t2'), answer: "All 31 tests pass. It's done.", durationMs: 90_000 })
  await clock.settle()
  expect(toasts().length).toBe(1)
  const argv = toasts()[0] ?? []
  expect(argv.slice(0, 4)).toEqual(['powershell', '-NoProfile', '-NonInteractive', '-Command'])
  expect(argv[4]).toMatch(/CreateTextNode\('Claude Code · work'\)/)
  // a single quote doubles inside PowerShell's single-quoted string
  expect(argv[4]).toMatch(/CreateTextNode\('done in 1m30s · All 31 tests pass\. It''s done\.'\)/)
  expect(argv[4]).toMatch(/ToastText02/)

  // an interrupted turn is no news
  await $.turn.start({ text: 'go', turnId: 't3' })
  await $.turn.complete({ ...complete('t3'), isAborted: true, reason: 'aborted' as const, durationMs: 90_000 })
  await clock.settle()
  expect(toasts().length).toBe(1)
  expect(notes).toEqual([])
})

test('off Windows the notification goes through the notification channel', async ($, on) => {
  const { runs, notes } = engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete({ ...complete('t1'), answer: 'Done.', durationMs: 2 * MINUTE })
  await clock.settle()
  expect(notes).toEqual([{ text: 'done in 2m00s · Done.', title: 'Claude Code · work' }])
  expect(runs.some(argv => argv[0] === 'powershell')).toBe(false)
})

test('changed files list the newest five with their lines, then a count', async ($, on) => {
  engine(on, [], {
    git: '# branch.oid abc\n# branch.head main\n1 .M N... 100644 100644 100644 a b src/a.ts\n? src/new.ts\n',
    numstat: '3\t1\tsrc/a.ts\n',
  })
  const clock = mock.clock(on, { now: 1_000_000 })
  on('tool.call', () => ({ result: {}, text: 'ok' }))
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  for (const name of ['b1', 'b2', 'b3', 'b4', 'b5', 'new', 'a']) {
    await $.tool.call({ tool: 'Edit', file_path: `C:\\work\\src\\${name}.ts`, old_string: 'x', new_string: 'y' })
  }
  // an edit made twice is listed once, as the newest
  await $.tool.call({ tool: 'Write', file_path: 'C:/work/src/a.ts', content: 'z' })
  await clock.advance(2_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const rows = (await ui.findAll({ type: 'Text', text: /^ {2}\S+\.ts$/ })).map(t => t.text.trim())
  expect(rows).toEqual(['a.ts', 'new.ts', 'b5.ts', 'b4.ts', 'b3.ts'])
  expect(await ui.find({ type: 'Text', text: /^ \+3$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ −1$/ })).toBeDefined()
  // the row's outer Text holds the same words: the coloured one is inside it
  expect((await ui.findAll({ type: 'Text', text: /^ new$/ })).some(t => t.props.color === GREEN)).toBe(true)
  expect(await ui.find({ type: 'Text', text: /^ {2}\+2 more$/ })).toBeDefined()
  await ui.unmount()
})

test('outside a repository the edits still count, and the git setting hides them', async ($, on) => {
  engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  on('tool.call', () => ({ result: {}, text: 'ok' }))
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  await $.tool.call({ tool: 'Write', file_path: 'C:/work/notes.md', content: 'z' })
  await clock.advance(2_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ type: 'Text', text: /^ 1 file edited$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ {2}notes\.md$/ })).toBeDefined()

  await ui.press({ key: 'open-settings' })
  await ui.press({ key: 'tab-panel' })
  await ui.redraw()
  await ui.press({ key: 'set-git' })
  await ui.press({ key: 'settings-back' })
  await clock.settle()
  await ui.redraw()
  // the activity row keeps its own note of the write
  expect(await ui.find({ type: 'Text', text: /^ {2}notes\.md$|file edited/ })).toBeUndefined()
  await ui.unmount()
})

test('a new activity row lights up and fades within a second', async ($, on) => {
  engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  on('tool.call', () => ({ result: {}, text: 'ok' }))
  await $.turn.start({ text: 'go', turnId: 't1' })
  await clock.advance(240)
  await $.tool.call({ tool: 'Read', file_path: 'C:/work/a.ts' })
  await clock.advance(240)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const color = async () => (await ui.find({ type: 'Text', text: /^Read {4}$/ }))?.props.color
  expect(await color()).not.toBe(BLUE)
  await clock.advance(1_200)
  await ui.redraw()
  expect(await color()).toBe(BLUE)
  await ui.unmount()
})

test('a figure at 80% or more breathes red while Claude works, and holds still after', async ($, on) => {
  engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.session.measure(measure(92))
  await clock.advance(1_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const color = async () => String((await ui.find({ type: 'Text', text: /^92%$/ }))?.props.color)
  const seen = new Set<string>()
  for (let i = 0; i < 8; i++) {
    await clock.advance(120)
    await ui.redraw()
    seen.add(await color())
  }
  expect(seen.size).toBeGreaterThan(2)

  await $.turn.complete(complete('t1'))
  await clock.advance(1_000)
  await ui.redraw()
  expect(await color()).toBe(RED)
  await ui.unmount()
})

// ── what a new install shows, and the switches ────────────────────────────

/** The changed files the pane lists, top to bottom. */
const fileRows = async (ui: { findAll: (query: { type: string; text: RegExp }) => Promise<{ text: string }[]> }) =>
  (await ui.findAll({ type: 'Text', text: /^ {2}\S+\.ts$/ })).map(t => t.text.trim())

test('a new install shows the short panel: the sections most sessions want, their details folded', async ($, on) => {
  engine(on, [], { fresh: true, env: { CLAUDE_EFFORT: 'xhigh' }, git: '# branch.oid abc\n# branch.head main\n' })
  const clock = mock.clock(on, { now: 1_000_000 })
  on('tool.call', () => ({ result: {}, text: 'ok' }))
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const resetsAt = new Date(1_000_000 + 60 * MINUTE).toISOString()
  await $.session.measure(measure(42, { costUsd: 1.5, limits: [{ pct: 30, resetsAt }] }))
  for (const name of ['a', 'b', 'c', 'd', 'e']) {
    await $.tool.call({ tool: 'Edit', file_path: `C:/work/src/${name}.ts`, old_string: 'x', new_string: 'y' })
  }
  await $.tool.call({ tool: 'TodoWrite', todos: [{ content: 'Ship it', status: 'in_progress', activeForm: 'Shipping it' }] })
  await clock.advance(2_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  for (const shown of [/CONTEXT/, /TOKENS/, /COST/, /SPEND/, /LIMITS/, /ACTIVITY/, /^ main$/]) {
    expect(await ui.find({ type: 'Text', text: shown })).toBeDefined()
  }
  // a switch away, each of them
  for (const folded of [/CACHE/, /TODO/, /Shipping it/, /^CC /, /test-1/, /xhigh/]) {
    expect(await ui.find({ type: 'Text', text: folded })).toBeUndefined()
  }
  // the lists show three: the newest files, the last calls
  expect(await fileRows(ui)).toEqual(['e.ts', 'd.ts', 'c.ts'])
  expect(await ui.find({ type: 'Text', text: /^ {2}\+2 more$/ })).toBeDefined()
  expect((await ui.findAll({ type: 'Text', text: /^✓ $/ })).length).toBe(3)
  // the week's spend is a figure, with no bars after it
  expect((await ui.findAll({ type: 'Text' })).some(t => BLOCKS.test(t.text))).toBe(false)
  await ui.unmount()
})

test("a section's switch takes the section away, and leaves no gap behind", async ($, on) => {
  const { store } = engine(on, [], { fresh: true })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'open-settings' })
  await ui.press({ key: 'tab-panel' })
  await ui.redraw()
  for (const id of ['context', 'tokens', 'cost', 'activity']) await ui.press({ key: `set-${id}` })
  await ui.press({ key: 'settings-back' })
  await clock.settle()
  await ui.redraw()
  for (const gone of [/CONTEXT/, /TOKENS/, /COST/, /ACTIVITY/, /no activity yet/, /compact now/]) {
    expect(await ui.find({ type: 'Text', text: gone })).toBeUndefined()
  }
  expect(await ui.find({ key: 'compact' })).toBeUndefined()
  // the header, one blank line, the footer
  expect((await ui.findAll({ type: 'Text' })).filter(t => t.text === ' ').length).toBe(1)
  expect(await ui.find({ key: 'open-settings' })).toBeDefined()
  // the store keeps what was changed, and nothing else
  expect(store['settings.terminal']).toEqual({ context: false, tokens: false, cost: false, activity: false })
  await ui.unmount()
})

test('a detail comes back with its switch, and a list steps 3, off, 5', async ($, on) => {
  engine(on, [], { fresh: true })
  const clock = mock.clock(on, { now: 1_000_000 })
  on('tool.call', () => ({ result: {}, text: 'ok' }))
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  for (const name of ['a', 'b', 'c', 'd', 'e']) {
    await $.tool.call({ tool: 'Edit', file_path: `C:/work/src/${name}.ts`, old_string: 'x', new_string: 'y' })
  }
  await clock.advance(2_000)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await fileRows(ui)).toEqual(['e.ts', 'd.ts', 'c.ts'])

  await ui.press({ key: 'open-settings' })
  await ui.press({ key: 'tab-panel' })
  await ui.redraw()
  // a detail of a section that is off is dim: it shows nothing until the section does
  expect((await ui.find({ key: 'set-cacheDetail' }))?.props.dimColor).toBe(true)
  await ui.press({ key: 'set-cache' })
  await ui.press({ key: 'set-cacheDetail' })
  expect((await ui.find({ key: 'set-changedFiles' }))?.props.label).toBe('3')
  await ui.press({ key: 'set-changedFiles' })
  await ui.redraw()
  expect((await ui.find({ key: 'set-changedFiles' }))?.props.label).toBe('off')
  expect((await ui.find({ key: 'set-cacheDetail' }))?.props.dimColor).toBe(false)
  await ui.press({ key: 'settings-back' })
  await clock.settle()
  await ui.redraw()
  expect(await ui.find({ type: 'Text', text: /CACHE/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /^ {2}R 0 {2}W 0$/ })).toBeDefined()
  // the list is gone, and the count of what was edited stays
  expect(await fileRows(ui)).toEqual([])
  expect(await ui.find({ type: 'Text', text: /^ 5 files edited$/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /more$/ })).toBeUndefined()

  await ui.press({ key: 'open-settings' })
  await ui.press({ key: 'set-changedFiles' })
  await ui.press({ key: 'settings-back' })
  await clock.settle()
  await ui.redraw()
  expect(await fileRows(ui)).toEqual(['e.ts', 'd.ts', 'c.ts', 'b.ts', 'a.ts'])
  await ui.unmount()
})

test('what 0.4.1 stored reads back over the new defaults', async ($, on) => {
  const stored = {
    band: false,
    sound: true,
    notify: true,
    notifyAfterS: 120,
    git: true,
    cacheTimer: true,
    cacheTtl: '5m',
    spend: true,
    compactForecast: true,
    versions: true,
    icons: 'unicode',
  }
  engine(on, [], { fresh: true, store: { 'settings.terminal': stored } })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'C:/work', surface: 'terminal', isInteractive: true })
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  // what was stored stands: the versions it kept on, the icons it chose
  expect(await ui.find({ type: 'Text', text: /^CC 2\.1\.317$/ })).toBeDefined()
  expect((await ui.findAll({ type: 'Text' })).some(t => PUA.test(t.text))).toBe(false)
  // what it never knew takes the new default
  expect(await ui.find({ type: 'Text', text: /CACHE/ })).toBeUndefined()
  await ui.press({ key: 'open-settings' })
  await ui.press({ key: 'tab-alerts' })
  await ui.redraw()
  expect((await ui.find({ key: 'set-band' }))?.props.label).toBe('off')
  expect((await ui.find({ key: 'set-notifyAfterS' }))?.props.label).toBe('120s')
  await ui.press({ key: 'tab-panel' })
  await ui.redraw()
  expect((await ui.find({ key: 'set-cacheTtl' }))?.props.label).toBe('5m')
  expect((await ui.find({ key: 'set-recentCalls' }))?.props.label).toBe('3')
  await ui.unmount()
})

// ── the look ──────────────────────────────────────────────────────────────

const BACKDROP = {
  plugin: 'capsule-panel',
  component: 'Backdrop',
  requestId: 'backdrop',
  props: { scene: 'glyph-sea', plugin: 'capsule-panel', glass: { blur: 16, opacity: 0.6 } },
} as const

const SPINNER = {
  plugin: 'capsule-panel',
  component: 'Spinner',
  requestId: 'spinner',
  props: { word: 'Working', message: null, suffix: '…', mode: 'responding' },
} as const

const DESKTOP_START = { cwd: 'C:/work', surface: 'desktop', isInteractive: true } as const
const TERMINAL_START = { cwd: 'C:/work', surface: 'terminal', isInteractive: true } as const

// ink and paper, as NightPub ships it
const INK = { canvas: '#121212', accent: '#a3b6dc', info: '#7dbcb4', success: '#80b98b' }

/** Every colour a drawing names, lowercased: its Text colours and what its SVGs are filled and stroked with. */
const coloursOf = async (ui: { findAll: (query: { type: string }) => Promise<{ props: Record<string, unknown> }[]> }) => {
  const found = new Set<string>()
  for (const text of await ui.findAll({ type: 'Text' })) {
    for (const name of ['color', 'backgroundColor']) {
      if (typeof text.props[name] === 'string') found.add(String(text.props[name]).toLowerCase())
    }
  }
  for (const svg of await ui.findAll({ type: 'Svg' })) {
    for (const hex of String(svg.props.source).match(/#[0-9a-f]{6}/gi) ?? []) found.add(hex.toLowerCase())
  }
  return found
}

test('a new install starts in ink over the glyph sea, and the panel wears it', async ($, on) => {
  const { theme } = engine(on, [], { fresh: true, surfaces: ['desktop'] })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start(DESKTOP_START)
  await clock.settle()
  expect(theme.sets.length).toBe(1)
  expect(theme.sets[0]?.backdrop).toEqual({ scene: 'glyph-sea' })
  expect(theme.sets[0]?.colors).toBeDefined()
  expect(theme.clears).toBe(0)

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const colours = await coloursOf(ui)
  // the capsule in the accent with the ground's ink on it, and none of Catppuccin left
  expect(colours.has(INK.accent)).toBe(true)
  expect(colours.has(INK.canvas)).toBe(true)
  for (const mocha of [MAUVE, BLUE, TEAL, GREEN, YELLOW, RED, '#1e1e2e', '#6c7086', '#a6adc8', '#cdd6f4']) {
    expect(colours.has(mocha)).toBe(false)
  }
  await ui.unmount()
})

test('the backdrop is the scene chosen, in the palette chosen, where a surface draws one', async ($, on) => {
  engine(on, [], { fresh: true, surfaces: ['desktop'], store: { look: { palette: 'tavern', scene: 'pixel-night' } } })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start(DESKTOP_START)
  await clock.settle()
  const night = { ...BACKDROP, props: { ...BACKDROP.props, scene: 'pixel-night' } }
  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...night, surface })
    const svg = await ui.find({ type: 'Svg' })
    expect(String(svg?.props.source)).toContain('fill="#d9a55a"')
    expect(String(svg?.props.alt)).toMatch(/pixel night/)
    await ui.unmount()
  }
  // another scene, another mod's scene, a surface with no backdrop: not this hook's to draw
  for (const other of [
    { ...BACKDROP, surface: 'desktop' as const },
    { ...night, props: { ...night.props, plugin: 'someone-else' }, surface: 'desktop' as const },
    { ...night, surface: 'terminal' as const },
  ]) {
    const ui = await $.ui.mount(other)
    expect(await ui.find({ type: 'Svg' })).toBeUndefined()
    await ui.unmount()
  }
})

test('the Look page changes the palette and the background for every surface', async ($, on) => {
  const { store, theme } = engine(on, [], { fresh: true, surfaces: ['desktop'] })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start(DESKTOP_START)
  await clock.settle()
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'open-settings' })
  await ui.redraw()
  expect((await ui.find({ key: 'set-palette' }))?.props.label).toBe('ink')
  expect((await ui.find({ key: 'set-scene' }))?.props.label).toBe('glyph sea')
  expect(await ui.find({ type: 'Text', text: /the same on every surface/ })).toBeDefined()
  // the desktop has no icon set and no spinner wave of its own
  expect(await ui.find({ key: 'set-icons' })).toBeUndefined()
  expect(await ui.find({ key: 'set-spinnerWave' })).toBeUndefined()

  await ui.press({ key: 'set-palette' })
  await ui.press({ key: 'set-scene' })
  await clock.settle()
  await ui.redraw()
  expect((await ui.find({ key: 'set-palette' }))?.props.label).toBe('tavern')
  expect((await ui.find({ key: 'set-scene' }))?.props.label).toBe('pixel night')
  // one key for every surface, beside the settings each surface keeps
  expect(store.look).toEqual({ palette: 'tavern', scene: 'pixel-night' })
  expect(store['settings.desktop']).toBeUndefined()
  expect(theme.sets.at(-1)?.backdrop).toEqual({ scene: 'pixel-night' })

  // no background: the palette's colours with nothing behind them
  await ui.press({ key: 'set-scene' })
  await clock.settle()
  await ui.redraw()
  expect((await ui.find({ key: 'set-scene' }))?.props.label).toBe('none')
  expect(theme.sets.at(-1)?.colors).toBeDefined()
  expect(theme.sets.at(-1)?.backdrop).toBeUndefined()
  expect(theme.clears).toBe(0)
  await ui.unmount()

  // the terminal's pane shows the same look, and its own two rows
  const terminal = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await terminal.redraw()
  expect((await terminal.find({ key: 'set-palette' }))?.props.label).toBe('tavern')
  expect(await terminal.find({ key: 'set-icons' })).toBeDefined()
  expect(await terminal.find({ key: 'set-spinnerWave' })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: /pick "NightPub · 酒馆暖光"/ })).toBeDefined()
  await terminal.unmount()
})

test('the palette turned off clears the theme once, and the next start sets none', async ($, on) => {
  const { store, theme } = engine(on, [], { fresh: true, surfaces: ['desktop'], store: { look: { palette: 'midnight', scene: 'glyph-sea' } } })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start(DESKTOP_START)
  await clock.settle()
  expect(theme.sets.length).toBe(1)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'open-settings' })
  await ui.redraw()
  // midnight is the last palette: the next step is off
  await ui.press({ key: 'set-palette' })
  await clock.settle()
  await ui.redraw()
  expect((await ui.find({ key: 'set-palette' }))?.props.label).toBe('off')
  expect(theme.clears).toBe(1)
  expect(theme.sets.length).toBe(1)
  // the background is kept for when a palette comes back, and waits dim
  expect(store.look).toEqual({ palette: 'off', scene: 'glyph-sea' })
  expect((await ui.find({ key: 'set-scene' }))?.props.dimColor).toBe(true)
  // the panel is back in its own colours
  await ui.press({ key: 'settings-back' })
  await ui.redraw()
  expect((await coloursOf(ui)).has(MAUVE)).toBe(true)
  await ui.unmount()

  // a start with the look off sets nothing and clears nothing: the theme on screen may be another mod's
  await $.session.start(DESKTOP_START)
  await clock.settle()
  expect(theme.sets.length).toBe(1)
  expect(theme.clears).toBe(1)
})

test('a look changed in another session is followed at the next heartbeat', async ($, on) => {
  const { store, theme } = engine(on, [], { fresh: true, surfaces: ['desktop'] })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start(DESKTOP_START)
  await clock.settle()
  expect(theme.sets.length).toBe(1)
  store.look = { palette: 'midnight', scene: 'pixel-night' }
  await clock.advance(31_000)
  expect(theme.sets.length).toBe(2)
  expect(theme.sets[1]?.backdrop).toEqual({ scene: 'pixel-night' })
  // turned off over there: the theme this session set is its own to clear
  store.look = { palette: 'off', scene: 'pixel-night' }
  await clock.advance(31_000)
  expect(theme.clears).toBe(1)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await coloursOf(ui)).has(MAUVE)).toBe(true)
  await ui.unmount()
})

test('a terminal is told once where its colours come from', async ($, on) => {
  const { toasts } = engine(on, [], { fresh: true })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start(TERMINAL_START)
  await $.session.start(TERMINAL_START)
  await clock.settle()
  expect(toasts.length).toBe(1)
  expect(toasts[0]).toContain('NightPub · 墨与纸')
})

test("a terminal's spinner keeps its word behind a run of the background's glyphs", async ($, on) => {
  const { store } = engine(on, [], { fresh: true })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start(TERMINAL_START)
  await clock.settle()
  const shown = async (surface: 'terminal' | 'desktop' | 'vscode' = 'terminal', message: string | null = null) => {
    const ui = await $.ui.mount({ ...SPINNER, surface, props: { ...SPINNER.props, message } })
    const text = (await ui.find({ type: 'Text' }))?.text
    await ui.unmount()
    return text
  }
  // an app's row is a sentence, and is left as it is
  expect(await shown('desktop')).toBe('Working')
  expect(await shown('vscode')).toBe('Working')
  expect(await shown()).toMatch(/^[·:\-=+*#%@]{6} Working$/)
  expect(await shown('terminal', 'Compacting')).toMatch(/^[·:\-=+*#%@]{6} Compacting$/)

  // the glyphs run while the main loop's turn does
  const still = await shown()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await clock.advance(600)
  expect(await shown()).not.toBe(still)
  await $.turn.complete(complete('t1'))
  await clock.advance(2_000)
  const rested = await shown()
  await clock.advance(2_000)
  expect(await shown()).toBe(rested)

  // the pixel night runs blocks; no background, or the wave's own switch off, and the word stands alone
  const pane = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await pane.press({ key: 'open-settings' })
  await pane.redraw()
  await pane.press({ key: 'set-scene' })
  await clock.settle()
  expect(await shown()).toMatch(/^[░▒▓█]{6} Working$/)
  await pane.press({ key: 'set-spinnerWave' })
  await clock.settle()
  expect(await shown()).toBe('Working')
  expect(store['settings.terminal']).toEqual({ spinnerWave: false })
  await pane.press({ key: 'set-spinnerWave' })
  await pane.redraw()
  await pane.press({ key: 'set-scene' })
  await clock.settle()
  await pane.redraw()
  expect((await pane.find({ key: 'set-scene' }))?.props.label).toBe('none')
  expect((await pane.find({ key: 'set-spinnerWave' }))?.props.dimColor).toBe(true)
  expect(await shown()).toBe('Working')
  await pane.unmount()
})

test('the band and the context bar wear the palette too', async ($, on) => {
  engine(on, [], { fresh: true, surfaces: ['desktop'] })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start(DESKTOP_START)
  await clock.settle()
  await $.turn.start({ text: 'go', turnId: 't1' })
  await clock.advance(240)
  const band = await $.ui.mount({ ...WORKING_BAND, surface: 'desktop' })
  const colours = await coloursOf(band)
  expect(colours.has(INK.accent)).toBe(true)
  for (const mocha of [MAUVE, BLUE, TEAL, '#fab387', '#1e1e2e']) expect(colours.has(mocha)).toBe(false)
  await band.unmount()
})

// ── the status line ───────────────────────────────────────────────────────

const PALETTE_FILE = 'C:/cfg/nightpub-ui/palette'
const CONFIG = { CLAUDE_CONFIG_DIR: 'C:/cfg' }
// ink and paper: canvas, strong border, accent, strong border, primary text, success, warning, danger, info
const INK_LINE =
  'nightpub-ui/1 ink 18;18;18 58;58;58 163;182;220 58;58;58 233;231;227 128;185;139 216;163;92 226;106;97 125;188;180 end\n'

test('the status line is left the palette in a file, one line it can check', async ($, on) => {
  const { files, writes } = engine(on, [], { fresh: true, surfaces: ['desktop'], env: CONFIG })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start(DESKTOP_START)
  await clock.settle()
  expect(files[PALETTE_FILE]).toBe(INK_LINE)
  expect(writes).toEqual([PALETTE_FILE])

  // the palette changed on the Look page: the file follows, and a new background writes nothing
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'open-settings' })
  await ui.redraw()
  await ui.press({ key: 'set-palette' })
  await ui.press({ key: 'set-scene' })
  await clock.settle()
  expect(files[PALETTE_FILE]).toMatch(/^nightpub-ui\/1 tavern (\d{1,3};\d{1,3};\d{1,3} ){9}end\n$/)
  expect(writes.length).toBe(2)

  // midnight, then off: the script goes back to its own colours
  await ui.press({ key: 'set-palette' })
  await ui.press({ key: 'set-palette' })
  await clock.settle()
  expect(files[PALETTE_FILE]).toBe('nightpub-ui/1 off end\n')
  await ui.unmount()
})

test('a palette file that already says so is left alone, and off leaves none where none was', async ($, on) => {
  // no CLAUDE_CONFIG_DIR: the file is under the home directory's .claude
  const home = 'C:/Users/me/.claude/nightpub-ui/palette'
  const { files, writes, store } = engine(on, [], {
    fresh: true,
    surfaces: ['desktop'],
    env: { USERPROFILE: 'C:/Users/me' },
    files: { [home]: INK_LINE },
    store: { look: { palette: 'ink', scene: 'none' } },
  })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start(DESKTOP_START)
  await clock.settle()
  expect(writes).toEqual([])

  // changed in another session, and the file gone missing since: this one writes it at its heartbeat
  delete files[home]
  store.look = { palette: 'midnight', scene: 'none' }
  await clock.advance(31_000)
  expect(files[home]).toMatch(/^nightpub-ui\/1 midnight /)
  expect(writes).toEqual([home])
})

test('with the look off and no file, nothing is written', async ($, on) => {
  const off = engine(on, [], { fresh: true, env: CONFIG, store: { look: { palette: 'off', scene: 'glyph-sea' } } })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start(TERMINAL_START)
  await clock.settle()
  expect(off.writes).toEqual([])
  expect(off.files[PALETTE_FILE]).toBeUndefined()
})

test('where no configuration directory is known, the palette goes nowhere', async ($, on) => {
  const { writes } = engine(on, [], { fresh: true })
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.session.start(TERMINAL_START)
  await clock.settle()
  expect(writes).toEqual([])
})
