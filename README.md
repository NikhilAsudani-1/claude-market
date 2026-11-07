# claude-market

A small collection of plugins for [Claude Code](https://claude.com/claude-code), by Nikhil Asudani.

Each plugin here changes how the prompt box or the chat behaves. They are installed straight from this repository, with one command each.

| Plugin | What it does |
| --- | --- |
| [inline-refiner](plugins/inline-refiner) | Fixes typos, spacing, capitals and punctuation in your prompt **right in the prompt box**, before it reaches Claude. No copy-pasting into another tool. |

## Install

Type these two commands **in your terminal** (PowerShell, bash, or the terminal inside your editor), **not** in the Claude Code chat. They have no leading slash:

```
claude plugin marketplace add NikhilAsudani-1/claude-market
claude plugin install inline-refiner@claude-market
```

Then **restart Claude Code**. It is on by default; type `/refine` in a chat to toggle it off or on.

The form is `plugin@marketplace`: `inline-refiner` is the plugin and `claude-market` is this repository's marketplace name.

Notes:
- Slash commands such as `/plugin install ...` only work inside a Claude Code chat session, and not in every environment (for example, some hosted or embedded versions answer "/plugin isn't available in this environment"). The terminal commands above work everywhere `claude` is installed.
- Newer versions also accept a one-step form: `claude plugin install inline-refiner --marketplace NikhilAsudani-1/claude-market`. Older versions do not have the `--marketplace` flag, so use the two commands above.
- In the desktop app you can instead click **+** next to the prompt box, then **Plugins**, then **Add marketplace** and enter `NikhilAsudani-1/claude-market`, then **Add plugin**.
- To check it loaded, run `claude plugin list` in the terminal.

## inline-refiner

You type fast and make mistakes. Most "prompt improver" tools make you paste your text into another window, then copy the result back. This one works **inside the prompt box**: send the message as it is, and the plugin fixes it on the way to Claude.

- Fixes spelling, missing or extra spaces, capitals and punctuation, and nothing else.
- Keeps your words and meaning. If a fix would change the idea of your message, your original is sent unchanged.
- Leaves code, file paths, URLs, commands, `@mentions`, numbers and quoted text exactly as written.
- Works on messages you send while Claude is busy (queued messages) as well as normal ones.
- A side pane lists the words it changed.

### Commands

| Command | What it does |
| --- | --- |
| `/refine` | Toggle on or off |
| `/refine on` / `/refine off` | Switch on or off |
| `/refine pane` | Reopen the changed-words pane |
| `/refine clear` | Empty the changed-words pane |

Messages that start with `/` are never changed.

### Good to know

- **Cost and privacy:** every message you send is also sent to Claude Haiku, through your own session, to be fixed. That is billed to your session like any other model call. Bigger rewrites trigger a second, tiny Haiku call that checks the meaning is unchanged.
- **Fails safe:** if the model is slow (over 8 seconds), errors, or the reply looks wrong, your original message is sent.
- **Real-word typos** such as `form` for `from` are left alone, because a real word cannot be told apart from a typo.
- **Long messages:** the pane skips messages over 500 words. Very long pastes may be sent unchanged if fixing takes too long.

### How it works

The plugin hooks two events: a message you send (`prompt.submit`) and a message you type while Claude is busy, which Claude Code delivers as a queued attachment (`prompt.attachment`). It asks Claude Haiku to fix only the typos, then checks the reply before using it:

1. Small letter-level fixes are accepted as they are.
2. Anything bigger (a word added or dropped, a stretch reworded) is accepted only if a second short Haiku call says the message still means the same thing.
3. If that check says the meaning changed, or any call fails, your original text is sent.

### Development

The plugin has 8 automated tests covering the changed-words pane, queued messages, `/refine` on, off and clear, and the safety checks.

```
cd plugins/inline-refiner
claude plugin validate .
claude plugin test .
```

## License

MIT, see [LICENSE](LICENSE).
