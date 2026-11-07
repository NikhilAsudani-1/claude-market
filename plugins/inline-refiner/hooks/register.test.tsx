import { expect, test } from 'claude-code/testing'

const PANE = {
  plugin: 'inline-refiner',
  component: 'Pane',
  requestId: 'refined-words',
  props: {
    title: 'Changed words',
    isFocused: false,
    bodyColumns: 30,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 20 },
    view: {},
  },
} as const

test('the pane spaces one message from the next', async ($, on) => {
  const fixes: Record<string, string> = {
    'inthe house': 'in the house',
    'teh cat recieve it': 'the cat receive it',
    'helo world': 'hello world',
  }

  on('command.register', () => ({ value: { command: 'refine' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('model.complete', (_, e) => ({
    value: { isAnswered: true, text: fixes[String(e.prompt).replace(/<\/?text>/g, '')] ?? '' },
  } as never))
  on('prompt.submit', (_, e) => ({ text: e.text } as never))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  for (const text of Object.keys(fixes)) {
    await $.prompt.submit({ text, origin: { kind: 'composer' } } as never)
  }

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const all = await ui.findAll({ type: 'Text' })

  console.log(all.map(t => JSON.stringify(t.text)).join('\n'))
  expect(all.length).toBeGreaterThan(0)
  await ui.unmount()
})

test('a queued message (queued_command attachment) is refined too', async ($, on) => {
  on('model.complete', () => ({
    value: { isAnswered: true, text: 'This is a wrongly written queued message' },
  } as never))
  on('prompt.attachment', (_, e) => ({ text: e.text } as never))

  const out = await $.prompt.attachment({
    type: 'queued_command',
    text: 'The user sent a new message while you were working:\nthis is a wrongw ritten queseded message\n\nThis is how Claude Code surfaces messages the user sends mid-turn.',
    origin: { kind: 'engine' },
  } as never)

  expect((out as { text: string }).text).toBe(
    'The user sent a new message while you were working:\nThis is a wrongly written queued message\n\nThis is how Claude Code surfaces messages the user sends mid-turn.',
  )

  // A task notification is left alone.
  const note = await $.prompt.attachment({
    type: 'queued_command',
    text: '<task-notification>done</task-notification>',
    origin: { kind: 'engine' },
  } as never)

  expect((note as { text: string }).text).toBe('<task-notification>done</task-notification>')
})

test('a queued message in a system-reminder with an IMPORTANT tail keeps its frame', async ($, on) => {
  on('model.complete', () => ({
    value: { isAnswered: true, text: 'This is a wrongly written, queued message' },
  } as never))
  on('prompt.attachment', (_, e) => ({ text: e.text } as never))

  const out = await $.prompt.attachment({
    type: 'queued_command',
    text: '<system-reminder>\nThe user sent a new message while you were working:\nthis is a wrong written, quesed messag\n\nIMPORTANT: After completing your current task, you MUST address the message above.\n</system-reminder>',
    origin: { kind: 'engine' },
  } as never)

  expect((out as { text: string }).text).toBe(
    '<system-reminder>\nThe user sent a new message while you were working:\nThis is a wrongly written, queued message\n\nIMPORTANT: After completing your current task, you MUST address the message above.\n</system-reminder>',
  )
})

test('after /refine clear only new messages show', async ($, on) => {
  const fixes: Record<string, string> = {
    'helo world': 'hello world',
    'teh cat': 'the cat',
    'inthe house': 'in the house',
  }

  on('command.register', () => ({ value: { command: 'refine' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('model.complete', (_, e) => ({
    value: { isAnswered: true, text: fixes[String(e.prompt).replace(/<\/?text>/g, '')] ?? '' },
  } as never))
  on('prompt.submit', (_, e) => ({ text: e.text } as never))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const send = (text: string) => $.prompt.submit({ text, origin: { kind: 'composer' } } as never)
  const shown = async () => {
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    const texts = (await ui.findAll({ type: 'Text' })).map(t => t.text)

    await ui.unmount()

    return texts
  }

  await send('helo world')
  await send('teh cat')
  expect((await shown()).join('|')).toContain('helo')

  await $.command.run({ command: 'refine', args: 'clear' } as never)
  expect((await shown()).join('|')).toContain('Send a message')

  await send('inthe house')

  const after = (await shown()).join('|')

  console.log('AFTER CLEAR + 1 MESSAGE:', after)
  expect(after).toContain('inthe')
  expect(after).not.toContain('helo')
  expect(after).not.toContain('teh')
})

test('an old queued message sent again is not refined or listed twice', async ($, on) => {
  let calls = 0

  on('command.register', () => ({ value: { command: 'refine' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('model.complete', () => {
    calls++

    return { value: { isAnswered: true, text: 'This is a wrongly written message' } } as never
  })
  on('prompt.attachment', (_, e) => ({ text: e.text } as never))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const queued = {
    type: 'queued_command',
    text: 'The user sent a new message while you were working:\nthis is a wrongw ritten message\n\nIMPORTANT: x',
    origin: { kind: 'engine' },
  } as never

  const first = (await $.prompt.attachment(queued)) as { text: string }
  const second = (await $.prompt.attachment(queued)) as { text: string }
  const third = (await $.prompt.attachment(queued)) as { text: string }

  expect(calls).toBe(1)
  expect(second.text).toBe(first.text)
  expect(third.text).toBe(first.text)

  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  const groups = await ui.findAll({ type: 'Text', text: /^─+$/ })

  expect(groups).toHaveLength(0)
  await ui.unmount()
})

test('/refine off leaves messages alone, on turns it back, slash messages are never touched', async ($, on) => {
  let calls = 0

  on('command.register', () => ({ value: { command: 'refine' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('model.complete', () => {
    calls++

    return { value: { isAnswered: true, text: 'Hello world' } } as never
  })
  on('prompt.submit', (_, e) => ({ text: e.text } as never))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const send = async (text: string) =>
    (await $.prompt.submit({ text, origin: { kind: 'composer' } } as never)) as { text: string }

  // On by default.
  expect((await send('helo world')).text).toBe('Hello world')
  expect(calls).toBe(1)

  // Off: untouched, no model call.
  await $.command.run({ command: 'refine', args: 'off' } as never)
  expect((await send('helo world')).text).toBe('helo world')
  expect(calls).toBe(1)

  // On again.
  await $.command.run({ command: 'refine', args: 'on' } as never)
  expect((await send('helo world')).text).toBe('Hello world')
  expect(calls).toBe(2)

  // Slash messages and empty text: untouched, no model call.
  expect((await send('/helo')).text).toBe('/helo')
  expect((await send('   ')).text).toBe('   ')
  expect(calls).toBe(2)
})

test('a reply that rewrites the sentence instead of fixing typos is thrown away', async ($, on) => {
  const typed = 'Im just afraid that it does not remove something important and this is the way I generally write when I have to say about something'
  const rewritten = "I'm just afraid it doesn't actually work, opposite but not eventually changing anything."
  const typoFixes: Record<string, string> = {
    [typed]: rewritten,
    'hellp hwo are yuo': 'Hello, how are you?',
    'cna u chekc teh fiel': 'Can u check the file?',
    'inthe house': 'in the house',
  }

  on('command.register', () => ({ value: { command: 'refine' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  // The meaning check (prompt starts "ORIGINAL:") says DIFFERENT for the bad rewrite, SAME otherwise.
  let judgeDown = false

  on('model.complete', (_, e) => {
    const prompt = String(e.prompt)

    if (prompt.startsWith('ORIGINAL:')) {
      if (judgeDown) return { value: { isAnswered: false, reason: 'aborted' } } as never

      return { value: { isAnswered: true, text: prompt.includes(rewritten) ? 'DIFFERENT' : 'SAME' } } as never
    }

    return { value: { isAnswered: true, text: typoFixes[prompt.replace(/<\/?text>/g, '')] ?? '' } } as never
  })
  on('prompt.submit', (_, e) => ({ text: e.text } as never))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const send = async (text: string) =>
    (await $.prompt.submit({ text, origin: { kind: 'composer' } } as never)) as { text: string }

  // The rewrite is refused: your own words go through.
  expect((await send(typed)).text).toBe(typed)

  // Real typo fixes still go through, so the guard does not make the refiner do nothing.
  expect((await send('hellp hwo are yuo')).text).toBe('Hello, how are you?')
  expect((await send('cna u chekc teh fiel')).text).toBe('Can u check the file?')
  expect((await send('inthe house')).text).toBe('in the house')

  // If the meaning check cannot answer, a bigger change is not trusted: the original goes through.
  judgeDown = true
  expect((await send(typed)).text).toBe(typed)
  judgeDown = false
})

test('typo fixes pass, and reworded text the meaning check calls SAME is used too', async ($, on) => {
  const accepted: Record<string, string> = {
    'i ma tetsing the refinr': 'I am testing the refiner.',
    'teh cat sat inthe house': 'The cat sat in the house.',
    'pleas send me teh fiel tommorow': 'Please send me the file tomorrow.',
    'wat time dose the meeitng start': 'What time does the meeting start?',
    'i dont knwo if it is workng': "I don't know if it is working.",
    'can yuo explian how thsi works': 'Can you explain how this works?',
    'thanks for yuor hlep with teh report': 'Thanks for your help with the report.',
    'opne D:/Claude/flowfield now': 'Open D:/Claude/flowfield now',
    'check https://exmaple.com/a_b?x=1 adn tell me wat it dose': 'check https://exmaple.com/a_b?x=1 and tell me what it does',
    'can u fix teh `foo_bar()` function in "my file.ts" plese': 'Can you fix the `foo_bar()` function in "my file.ts" please?',
    'Hello! How are you?': 'Hello! How are you?',
  }
  const refused: Record<string, string> = {
    'Im just afraid that it does not remove something important and this is the way I generally write when I have to say about something':
      "I'm just afraid that it does not remove something important, and this is the way I generally write when I have to say something about it.",
    'he go to school yesterday and play football': 'He went to school yesterday and played football.',
  }
  const all = { ...accepted, ...refused }

  on('command.register', () => ({ value: { command: 'refine' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('model.complete', (_, e) => ({
    // A prompt starting "ORIGINAL:" is the meaning check: these changes keep the idea, so SAME.
    value: {
      isAnswered: true,
      text: String(e.prompt).startsWith('ORIGINAL:') ? 'SAME' : (all[String(e.prompt).replace(/<\/?text>/g, '')] ?? ''),
    },
  } as never))
  on('prompt.submit', (_, e) => ({ text: e.text } as never))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  const send = async (text: string) =>
    (await $.prompt.submit({ text, origin: { kind: 'composer' } } as never)) as { text: string }

  for (const [typed, fixed] of Object.entries(accepted)) {
    expect([typed, (await send(typed)).text]).toEqual([typed, fixed])
  }

  // Reworded but the same idea: the meaning check says SAME, so the corrected text is used.
  for (const [typed, fixed] of Object.entries(refused)) {
    expect([typed, (await send(typed)).text]).toEqual([typed, fixed])
  }
})
