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
  - Regression coverage: `test-menu-duplication.py` `small_window_sessions()`
    (50x40, 100x12, 80x6)
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
- [ ] Proper Ctrl+Z terminal state handling (edge cases remain)
- [ ] More robust signal handling
- [ ] Disown command for detaching jobs

### Testing
- [ ] Comprehensive test suite
- [ ] Regression tests for all scripting features
- [ ] Performance benchmarks

## TODO - Medium Priority

### Features
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
2. **Ctrl+Z handling** - Edge cases with terminal state
3. **sudo password input** - Requires `-S` flag to read from stdin
4. **Performance** - JS/Bun slower than native C shells (quantified 2026-10-07: `fgsh -c` ≈ 27× bash — see "Performance Benchmarks" below)

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
