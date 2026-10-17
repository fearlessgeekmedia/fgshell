# fgsh `ui` Builtin: TUI Spec

Goal: make quick, beautiful terminal dashboards and interactive tools easy to write in fgsh scripts. Built on OpenTUI (already used by `showHistoryPicker` in `fgshell.js`).

## Design principles

1. **Render to the TTY, return results on stdout.** Every interactive command draws via OpenTUI on the terminal (stderr or `/dev/tty`) and writes only its *result* to stdout, so `x=$(ui select ...)` works.
2. **Exit codes carry meaning.** `0` = user confirmed/submitted. `1` = user cancelled (Esc / Ctrl+C); print nothing to stdout. `2` = usage error. Otherwise, pass through the wrapped command's exit code (spinner, box).
3. **One namespace.** A single `ui` builtin with subcommands: one help entry, one completion list, easy to extend. Subcommand help via `ui <sub> --help`, matching the existing `help` object pattern.
4. **Reuse existing conventions.** `--json` / `--yaml` via `output-formatter.js`; fuzzy matching via Fuse.js (same as the pickers); `#!/usr/bin/env bash` style scripting, nothing exotic.
5. **No parser changes in Tiers 1-2.** Commands that wrap another command take it after `--`.

## Prerequisite: builtin output capture

`executeSubshellCommand()` currently returns `''` for builtins, so `$(ui ...)` cannot capture them. Fix first:

- Reuse the `process.stdout.write` swap already in `executePipeline`'s builtin branch (buffer chunks, restore in `finally`).
- `ui` builtins must draw to the terminal through OpenTUI's own output (not `process.stdout.write`), so the capture sees only the result.
- Also make `expandCommandSubstitution`'s regex handle nested parens (currently `\$\(([^(][^)]*)\)`).
- Builtins that are async must be awaited in `executeSubshellCommand`.

## Lifecycle contract (all interactive subcommands)

- Pause the line editor (`rl.pause()`; `rl.ensureRawMode()` as the pickers do), create an OpenTUI renderer with `exitOnCtrlC: false`, `useKittyKeyboard: null`.
- Always tear down the renderer in a `finally` and `rl.resume()`. Follow `showHistoryPicker`'s `finish()` pattern (single settle, destroy renderer, clear `isFilePickerActive`).
- Share the `isFilePickerActive` guard so two TUIs never run at once.
- If stdin/stdout is not a TTY, degrade: `prompt` reads one line, `select` prints the first match or errors, `confirm` returns 1, `spinner` just runs the command, `progress` passes through.

## Tier 1: core commands (no parser changes)

| Command | Behavior |
|---|---|
| `ui prompt [--mask[=CHAR]] [--placeholder TEXT] [--default TEXT] "label"` | Single-line input. Prints the value. |
| `ui select [--placeholder TEXT] [--multi] [--limit N] [ITEM...]` | Items from args, or stdin lines if none. Fuzzy filter as you type (Fuse, same config as the pickers). Prints selection (one per line with `--multi`). |
| `ui confirm [--default yes\|no] "Delete?"` | Yes/no. No stdout; exit 0 for yes, 1 for no/cancel. |
| `ui spinner [--title TEXT] -- COMMAND...` | Animated spinner while COMMAND runs; COMMAND's stdout/stderr is captured and replayed after (or shown with `--show-output`). Exit code = COMMAND's. |
| `ui progress [--title TEXT] [--total N]` | Reads integers 0-100 (or `current/total`) from stdin, one per line; draws a gauge; exits when stdin closes. |
| `ui pager [--title TEXT] [--follow] [FILE]` | Scrollable viewer for FILE or stdin. `--follow` keeps appending and auto-scrolls. j/k/arrows/PgUp/PgDn, `/` to search, `q` to quit. |

Examples:

```bash
#!/usr/bin/env bash
name=$(ui prompt --placeholder "your name" "Who are you?") || exit 1
svc=$(systemctl list-units --type=service | awk '{print $1}' | ui select --placeholder "Restart which?") || exit 1
ui confirm "Restart $svc?" && ui spinner --title "Restarting $svc" -- sudo systemctl restart "$svc"

for i in $(seq 1 100); do echo $i; sleep 0.05; done | ui progress --title "Downloading"
tail -f production.log | ui pager --follow --title "Live Logs"
```

## Tier 2: forms (flags, not blocks)

```bash
ui form --title "Network Configuration" \
  IP="192.168.1.50" Gateway="192.168.1.1" \
  --toggle DHCP=off \
  --json > config.json
```

- Each `NAME=default` is a text field; `--toggle NAME=on|off` is a checkbox; `--choice NAME=a,b,c` is a dropdown.
- Tab / Shift+Tab move between fields, Enter submits, Esc cancels (exit 1, no output).
- Default output: `NAME=value` lines (safe to quote for `eval`). `--json` / `--yaml` use `output-formatter.js`.

## Tier 3: layout (needs parser work, or flat form first)

**Flat form (no parser change):**

```bash
ui layout row 30% "ui menu Status Logs Config" 70% "ui box --title Monitor -- top -n 1"
```

Each pane's command streams into its own OpenTUI box via flexbox (`flexDirection`, `width: '30%'`).

**Block form (after brace-block support):**

```bash
ui row {
  ui col 30% { ui menu Status Logs Config }
  ui col 70% { ui box --title "System Monitor" -- top -n 1 }
}
```

Parser work required: a generic `{ ... }` block in `splitStatements`, `countBraces`, `hasOpenBlock`, and `collectBlock` (currently braces are only understood for function definitions). Defer until Tiers 1-2 are solid.

## Tier 4: refresh instead of reactivity

```bash
ui box --title "Clock" --every 1s -- date +%H:%M:%S
```

Re-runs the command on an interval and repaints just that box. Covers most dashboard needs without a reactive-variable engine. (If reactivity is wanted later: wrap `SHELL.env` in a Proxy that marks dependent boxes dirty.)

## Deferred / cut

- **`ui toast`**: non-blocking notifications fight the line editor for the terminal while the shell is idle. Hardest item, least necessary. Revisit after layout.
- **Separate `tui-view`**: covered by `ui pager`.
- **Reactive `TUI_*` variables**: replaced by Tier 4 `--every`.

## Implementation plan

1. Builtin output capture + nested `$()` fix (prerequisite).
2. New file `src/ui.js` exporting `ui(args)`; register in `builtins` and add a `help.ui` entry; add `ui` subcommands to `getCommandOptions` for `--` completion.
3. Shared OpenTUI helper (`withRenderer(fn)`) implementing the lifecycle contract above.
4. Implement in order: `confirm`, `prompt`, `select`, `spinner`, `progress`, `pager`.
5. `form`, then `layout` (flat), then `box --every`.
6. Brace-block parser support, then block-form `row`/`col`.

## Testing notes

- Test non-TTY degradation with piped stdin (the shell already runs scripts via `fgsh script.sh` and `-c`).
- Verify Esc/Ctrl+C returns exit 1 and leaves the terminal in a sane state (raw mode off, cursor visible, no leftover alt-screen).
- Verify Ctrl+Z during `ui spinner` does not corrupt the renderer (job control + `ptctl` handoff).
- Verify `$(ui ...)` captures only the result, never UI escape codes.
