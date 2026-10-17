# FGShell Development Roadmap

## Completed Features

### Interactive Features
- [x] Fuzzy history search (Ctrl+R)
- [x] Interactive file picker (Ctrl+N)
- [x] SQLite history database
- [x] Command duration tracking
- [x] Exit code in history

### Output Formatting
- [x] JSON output (`--json` flag)
- [x] YAML output (`--yaml` flag)
- [x] Implemented for: ls, history, jobs, env

### Scripting Features (Recently Completed)
- [x] If/then/else/fi statements
- [x] While loops
- [x] For loops (C-style: `for ((i=0; i<5; i++))`)
- [x] For loops (for-in: `for item in list`)
- [x] Case statements with pattern matching
- [x] Shell functions with parameter passing
- [x] Arrays with indexing (`${arr[i]}`) and expansion (`${arr[@]}`)
- [x] Logical operators (`&&` and `||`)
- [x] Subshells with `()`
- [x] Trap handlers (`trap 'code' SIGNAL`)
- [x] Multi-line block parsing in script mode
- [x] Built-in test command (`[` and `test`)
- [x] Command substitution (`$(...)`)
- [x] Arithmetic expansion (`$((expr))`)
- [x] Variable expansion with proper quoting

### Job Control
- [x] Background execution (`cmd &`)
- [x] Process group management
- [x] TTY handoff with tcsetpgrp
- [x] Signal propagation (SIGINT, SIGTSTP, SIGCONT)
- [x] Job listing and management (jobs, fg, bg)

### Standard Features
- [x] Pipes (`|`)
- [x] Input/output redirection (`>`, `>>`, `<`)
- [x] Environment variables
- [x] Aliases
- [x] Tab completion
- [x] Custom Bun-native line editor (raw-mode input, history, ghost text)

## In Progress

- [ ] Here-documents (`<<EOF`) - works whenever the input comes from a file (scripts, `source`, `.fgshrc`); interactive/`-c` input, quoted delimiters, and body expansion pending
- [ ] Logical operators in test conditionals (`-a`, `-o`, and `!` negation are not yet handled by `test`/`[`; unquoted `!=` is mangled by history expansion — quote it: `test "$a" "!=" "$b"`)
- [ ] Additional builtins (grep, sed, awk as optimized shell commands)

## TODO - High Priority

### Scripting Improvements
- [x] Better error messages with line numbers in scripts
  - Script parser now tracks line numbers for all blocks
  - Error messages show file:line-end format with source snippet
  - Examples: `script.sh:12-14: error: if: syntax error - expected "then"`
- [x] Fix line diplucation and distortion when terminal windows are smaller or
      the fuzzy search is too large. Preferrably, we need a set size that doesn't
      fluctuate based on the command's length.
  - `src/line-editor.js` now repaints from a tracked anchor (painted rows /
    cursor row) instead of from the raw cursor position, so wrapped lines no
    longer leave a copy of the prompt behind, and stale wrapped rows are
    cleared when the line shrinks
  - The fuzzy menu box is drawn below the anchor with a fixed cap
    (`min(10, rows-6)`), independent of the command's length, and erased
    with scroll-consistent movement
  - Character widths come from terminal-measured cell counts, not string
    length. U+200B (the zero-width space the powerline fgsh-prompt ends
    with) paints in **zero** cells — verified in a real tmux pane
    (2026-10-09: print A+ZWSP+B, read the cursor back → 2 cells). An
    earlier attempt counted it as one cell (reasoning from font .notdef
    glyphs, which terminals do not consult for cursor math); that put the
    edit cursor one cell past the painted text and, on narrow windows,
    made each repaint drift a row — stacking copies of the prompt
    (duplication-bug.png)
  - Because terminals genuinely disagree about these codepoints (kitty /
    zellij hosts kept reproducing the stack even with a correct table),
    the editor now **calibrates against the live terminal**: every
    `prompt()` brackets its first paint with two cursor-position reports
    (`ESC[6n`) and adopts the reported width (`_beginPromptProbe` in
    `src/line-editor.js`); no answer within 250ms falls back to the table.
    Adversarial coverage: `zwsp_disagreement_session()` runs the cursor
    session against a terminal that paints U+200B in one cell (the
    editor's table says zero) — it fails without calibration and passes
    with it
  - Follow-up fix (2026-10-10): width alone is not enough at the exact
    wrap boundary. When the prompt's last cell lands on the row boundary,
    some emulators (pyte measured; kitty/zellij reports match) let the
    trailing U+200B **resolve the pending wrap** and drop the cursor a
    row, while the width probe still reports a plausible value ("55 ==
    55") — every repaint then erased one row short and stacked a copy of
    the prompt. The probe now also adopts the reply's **row delta**
    (`_rowEndShift` in `src/line-editor.js`) and applies it to
    boundary-ending paints, so the anchor matches the real terminal.
    Verified in a pyte emulator with a realistic CPR-answering pty
    harness: 55-cell prompt on a 55-column window (prompt exactly fills
    the row) went from stacked copies at rows 0/1/3 to a single prompt
    row; the same harness reproduces the stack with the row adoption
    disabled (A/B), and `test-menu-duplication.py` stays at 224/224
  - Regression coverage: `test-menu-duplication.py` `small_window_sessions()`
    (50x40, 100x12, 80x6), `cursor_session()` (ZWSP prompt),
    `zwsp_disagreement_session()`, plus real-terminal verification in tmux
    across 42–100-column panes, including exact wrap boundaries, a
    wrapping powerline prompt, and the ghost-suggestion path with the
    fuzzy menu open
- [x] FreeBSD/GhostBSD fallback for the OpenTUI pickers (Ctrl+R history,
      Ctrl+N file picker) — OpenTUI ships native binaries for
      Linux/macOS/Windows only
  - `loadOpenTUI()` in `src/fgshell.js` probes the import once; on failure
    (or `FGSH_TUI=ansi`) both pickers switch to plain-ANSI implementations
    that draw the same two-pane layout on the alternate screen and read
    keys through the line editor's `keypress` events
  - `FGSH_TUI=opentui` disables the fallback (error instead)
  - Note: the fuzzy completion menu on the command line itself is not an
    OpenTUI component (drawn by `src/line-editor.js`), which is why it
    already worked on FreeBSD/GhostBSD
  - Regression coverage: `test-menu-duplication.py`
    `fallback_history_session()` / `fallback_picker_session()`
- [ ] Improve quote escaping for `js` command and other builtins
  - Currently requires manual escape sequences for nested quotes
  - Consider context-aware quote handling for JavaScript code blocks
  - Could automatically handle quote detection and escaping
  - Investigate whether shell preprocessor can help or if parser needs changes
- [ ] Stack traces for function calls (framework in place, needs integration)
- [ ] Debugging mode with breakpoints
- [ ] Local variables in functions (currently all are global)
- [ ] Return values from functions (beyond exit codes)

### Job Control
- [ ] Ctrl+Z edge cases beyond single foreground commands
  - Basic suspend/resume for single foreground commands works (fixed in commits 01bb6b0, 419b34b)
  - Pipelines/compound commands: the SIGTSTP handler only acts when `currentChild` is set,
    which happens only in the single-command interactive path (src/fgshell.js:4044), so
    Ctrl+Z is effectively a no-op there
  - Stop-detection polls `/proc/<pid>/stat` (src/fgshell.js:910, :4124) — Linux-only;
    on macOS/GhostBSD the shell relies solely on the SIGTSTP signal-handler path
  - Degrades without libptctl.so: signal forwarding still works, terminal handoff doesn't
    (see CTRL_Z_IMPLEMENTATION.md → Known Limitations)
- [ ] More robust signal handling
- [ ] Disown command for detaching jobs

### Testing
- [ ] Comprehensive test suite
- [ ] Regression tests for all scripting features
- [ ] Performance benchmarks

## TODO - Medium Priority

### Features
- [ ] `exec` builtin (like bash: replace the shell process with a command, e.g. `exec vim`;
      must not replace the shell when running in the interactive line-handler loop —
      evaluate whether to support `exec` with builtins/functions or external commands only)
- [ ] Process substitution (`<(cmd)` and `>(cmd)`)
- [ ] Arithmetic conditionals (`((expr))`)
- [ ] String manipulation builtins (substring, pattern replace)
- [ ] More test operators (file existence `-f`, `-d`, etc.)
- [ ] Negation in conditionals

### Builtins
- [ ] sed/grep as optimized builtins
- [ ] bc calculator
- [ ] base64 encoding/decoding

### Interactive Features
- [x] Command preview in Ctrl+R search (two-pane preview: time, exit code, duration, directory)
- [ ] Persistent session state
- [ ] History filtering options

## TODO - Low Priority

### Performance
- [ ] **Optimize fgsh script/`-c` startup speed** — DEFERRED (2026-10-07): other
      issues to tackle first; do not start tonight.
  - Baseline to beat: `fgsh -c 'true'` = 185.5 ms vs `bash -c true` = 7.0 ms
    (same bench loop as "Performance Benchmarks" above)
  - Investigate: lazy/skip loading interactive-only deps (line editor, pickers,
    history DB, OpenTUI) in `-c` and script mode; profile startup to split
    module-import cost from runtime cost
  - Already ruled out: the JS runtime itself (`bun -e ''` = 3.9 ms)
  - Re-benchmark with the same method; record before/after in this file
  - Closing this would also make an `.fgsh`-script prompt viable (~182 ms →
    hopefully under the ~20 ms "invisible" threshold), though in-process
    function capture (see Performance Benchmarks → Prompt context) would
    remove the fork entirely
- [ ] Optimize variable expansion (reduce regex calls)
- [ ] Cache parsed control structures
- [ ] Lazy evaluation improvements
- [ ] Consider moving parser to Rust FFI

### Compatibility
- [ ] POSIX compliance mode
- [ ] bash compatibility layer
- [ ] Bash script translator

### Documentation
- [ ] Video tutorials
- [ ] Interactive tutorial mode
- [ ] Shell comparison guide (fgsh vs bash vs zsh)

### Advanced Features
- [ ] Plugin system for extending commands
- [ ] Module/package system
- [ ] Async/await syntax support
- [ ] Native Promise integration
- [ ] GTK via FFI for GUI scripting (dialogs, dashboards, interactive widgets)

## Known Issues to Fix

1. **Here-documents** - File-based input works (scripts, `source`, `.fgshrc`; content delivered via temp file); interactive/`-c` mode and quoted delimiters still pending
2. **Ctrl+Z handling** - Works for single foreground commands; pipelines and non-Linux
   (/proc-less) platforms still have edge cases (see Job Control above)
3. **sudo password input** - Requires `-S` flag to read from stdin
4. **Performance** - JS/Bun slower than native C shells (quantified 2026-10-07: `fgsh -c` ≈ 27× bash — see "Performance Benchmarks" below)
5. **`SHELL.prompt` is undefined** - src/fgshell.js:5472 calls `rl.setPrompt(SHELL.prompt)`,
   but SHELL (src/shell.js:29-37) has no `prompt` property; `setPrompt` turns it into `''`
   (src/line-editor.js:141) and `prompt()` overwrites it right after, so mostly harmless —
   but it briefly clears the prompt and the line handler relies on an undefined property
6. **`ls -1` scope error** - In the `argv['1']` branch (src/fgshell.js:1222-1225), the
   `for (const name of names)` loop references `f.stat.ino`/`f.stat.size`, but `f` only
   exists inside the earlier `.map`; `ls -1 -i` or `ls -1 -s` throws a ReferenceError
   (plain `ls -1` is fine because the ternary short-circuits)
7. **Stale snapshots** - `src/test-fgshell.js` and `src/test-fgshell2.js` are old copies of
   `src/fgshell.js` (headers still say "SIGINT only after removal of SIGTSTP"), not tests;
   they lag the main file by ~1,600 lines and should be deleted or archived

## Performance Benchmarks (measured 2026-10-07)

Repeated wall-clock runs (N=5–20, `date +%s%N` around the loop; consistent
across two sessions, on this machine):

| what | bash | fgsh | ratio |
|---|---|---|---|
| no-op (`-c 'true'`) | 7.0 ms | 185.5 ms | ~27× |
| trivial (`-c 'echo hi'`) | 7.0 ms | 193.7 ms | ~28× |
| prompt script (per invocation) | 14–22 ms | ~182 ms | ~8–10× |
| interpreter boot alone | `bun -e ''` 3.9 ms / `node -e ''` 67.0 ms | — | — |

**What this means:**

- The cost is *not* the JS runtime (`bun -e` boots in 3.9 ms) — it's fgsh's own
  initialization: the ~101 MB compiled binary loads its full dependency stack
  (history DB, line editor, pickers, …) even in `-c` and script mode.
- It's *startup per invocation*, paid once for the interactive shell — typing
  latency in a running session is a separate, unmeasured thing.
- It only hurts where a process is spawned per event — i.e. the prompt redraw.
  That's why the prompt helper is a bash script (`~/utility-scripts/fgsh-prompt`,
  ~14 ms) instead of an `.fgsh` script (~182 ms would lag visibly after every
  command).

**Prompt context (for whoever picks this up):**

- `~/.fgshrc` does `PS1=$(fgsh-prompt \$?)` (bare assignment — `export` would
  run the `$(...)` once at startup; `\$?` keeps the exit status live until redraw).
- A fully native prompt (`.fgshrc` function, no fork per redraw) is blocked in
  `executeSubshellCommand()` (src/fgshell.js ~2674):
  1. never consults `SHELL_FUNCTIONS` — unknown names resolve to `''`;
  2. builtin output can't be captured (`// For other builtins, we can't
     capture output`) — so `$(echo …)` / `$(js …)` print to the terminal;
  3. no PROMPT_COMMAND-style pre-prompt hook.
- pty harness used to verify prompt behaviour: `/tmp/test-fgsh-prompt.py`
  (14 checks; move it into the repo if it's worth keeping).

## Notes

- Focus on making scripting solid and reliable
- Interactive features are nice-to-have
- Performance is acceptable for interactive use
- POSIX compliance is explicitly not a goal
- JavaScript allows rapid iteration and experimentation

## Recent Improvements

### Error Messages with Line Numbers (Latest)
Scripts now provide helpful error diagnostics with precise location information:

**Implementation:**
- Modified `parseScriptBlocks()` to attach metadata (startLine, endLine, filename) to each block
- Created `formatError()` utility for consistent error message formatting
- Updated all control flow functions to accept and use context parameter:
  - `executeIf()` - if/then/else/fi errors
  - `executeWhile()` - while/do/done errors
  - `executeFor()` - for/do/done errors (both styles)
  - `executeCase()` - case/esac errors
  - `defineFunctionLine()` - function definition errors
- Added call stack infrastructure (CALL_STACK, pushCallFrame, popCallFrame, formatCallStack)
- Updated `callFunction()` to track function invocations for future stack traces

**Features:**
- All script blocks now track starting and ending line numbers (1-indexed)
- Parse errors show `filename:startLine-endLine: error: message`
- Source snippet of the problematic line is included in output
- Control flow functions all report with proper file:line context
- Graceful fallback for interactive mode (no file context)

**Example error output:**
```
script.sh:9-11: error: if: syntax error - expected "then"
  if [ 1 -eq 1 ]
```

**Documentation updates:**
- docs/SCRIPTING.md - Added "Error Messages" section with common errors/fixes
- docs/FGSH.md - Added "Error Handling" section with implementation details
- README.md - Added error messages to feature list, updated roadmap
- IMPROVEMENTS.md - Created detailed changelog

**Files modified:**
- src/fgshell.js (~150 lines changed across multiple functions)
- docs/SCRIPTING.md, docs/FGSH.md, README.md, IMPROVEMENTS.md

**Status:** ✓ Completed and tested
