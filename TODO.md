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
- [x] Readline integration

## In Progress

- [ ] Here-documents (`<<EOF`) - parsing complete, content delivery pending
- [ ] Arithmetic operators in test conditionals
- [ ] Additional builtins (grep, sed, awk as optimized shell commands)

## TODO - High Priority

### Scripting Improvements
- [x] Better error messages with line numbers in scripts
  - Script parser now tracks line numbers for all blocks
  - Error messages show file:line-end format with source snippet
  - Examples: `script.sh:12-14: error: if: syntax error - expected "then"`
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
- [ ] printf (more formatting options than echo)
- [ ] sed/grep as optimized builtins
- [ ] bc calculator
- [ ] base64 encoding/decoding

### Interactive Features
- [ ] Command preview in Ctrl+R search
- [ ] Persistent session state
- [ ] History filtering options

## TODO - Low Priority

### Performance
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

1. **Here-documents** - Parsed but content not passed to commands
2. **Ctrl+Z handling** - Edge cases with terminal state
3. **sudo password input** - Requires `-S` flag to read from stdin
4. **Performance** - JS/Bun slower than native C shells

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
