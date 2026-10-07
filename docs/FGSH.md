# fgsh - Design & Implementation

fgsh is a modern Unix shell implementation written in JavaScript/Bun with comprehensive scripting support. This document covers the architecture, design decisions, and implementation details.

## Overview

fgsh provides:
- **Interactive shell** with modern features (fuzzy history, file picker)
- **Full scripting language** with control flow, functions, and arrays
- **Job control** with background/foreground process management
- **Command execution** with pipes, redirection, and process groups
- **Built-in commands** for common operations
- **SQLite history** with timestamps and exit codes

## Architecture

### Core Components

```
src/
  fgshell.js      - Main shell implementation (3800+ lines)
  shell.js        - Shell state and context
  history-db.js   - SQLite history database
  ptctl.js        - FFI bindings for process group control
  ptctl.c         - C library for tcsetpgrp/setpgid/killpg
  output-formatter.js - JSON/YAML formatting
```

### Execution Flow

1. **Initialization** (`fgshell.js` start)
   - Load rc file if it exists
   - Set up readline/PTY handling
   - Initialize job control

2. **Interactive Mode**
   - Read line from user
   - Parse and execute with `runLine()`
   - Handle job control signals (Ctrl+Z, Ctrl+C)
   - Display prompt

3. **Script Mode**
   - Parse script into blocks with `parseScriptBlocks()`
   - Execute each block with `executeControlFlow()`
   - Exit with appropriate code

4. **Command Mode** (`-c` flag)
   - Execute single command with `runLine()`
   - Exit immediately

## Scripting Architecture

### Control Flow Execution

The scripting system is built on a layered architecture:

```
executeControlFlow(line)
├── Detects multi-line control structures
│   ├── if/then/fi
│   ├── while/do/done
│   ├── for/do/done
│   └── case/esac
├── Parses logical operators (&&, ||)
├── Handles command sequences (;)
└── Delegates to runSingle() for basic commands
```

### Multi-line Block Parsing

Script mode uses `parseScriptBlocks()` to group multi-line structures before execution:

```javascript
// Input script lines
for i in 1 2 3; do
  echo "i=$i"
done

// Parsed as single block
[
  'for i in 1 2 3; do\n  echo "i=$i"\ndone'
]

// Executed with executeControlFlow()
```

This allows proper handling of multi-line constructs that would fail if processed line-by-line.

### Control Structure Implementation

Each control structure (`if`, `while`, `for`, `case`) has a dedicated async function:

- **executeIf()** - Parse condition, then-body, else-body; execute conditionally
- **executeWhile()** - Evaluate condition repeatedly, execute body while true
- **executeFor()** - Support both C-style (`for ((i=0; i<5; i++))`) and for-in syntax
- **executeCase()** - Match expression against patterns with fallthrough support
- **defineFunctionLine()** / **callFunction()** - Function definition and invocation
- **executeSubshell()** - Isolated command execution

### Function Storage

Functions are stored in `SHELL_FUNCTIONS` object:

```javascript
SHELL_FUNCTIONS = {
  'greet': 'function greet() { echo "Hello"; }',
  'add': 'function add() { echo $(($1 + $2)); }'
}
```

When a command matches a function name, `callFunction()` is invoked with arguments.

### Array Support

Arrays are stored in `SHELL_ARRAYS` object:

```javascript
SHELL_ARRAYS = {
  'numbers': ['1', '2', '3'],
  'words': ['apple', 'banana']
}
```

Array expansion is handled in `expandVars()`:
- `${arr[@]}` - expand all elements
- `${arr[i]}` - expand element at index i
- `arr=(1 2 3)` - assignment in runSingle()

## Command Execution

### Parsing Pipeline

```
runSingle(line)
├── Check for array assignment (arr=(vals))
├── Check for variable assignment (VAR=val)
├── Expand command substitutions
├── Tokenize the line
├── Check for user functions
├── Expand aliases and globs
├── Split into command pipeline
└── Execute pipeline or builtin
```

### Builtin Commands

Builtins are implemented as functions in the `builtins` object (L475):

```javascript
builtins = {
  echo: function(args) { ... },
  cd: function(args) { ... },
  export: function(args) { ... },
  // ... etc
}
```

Builtins have special handling:
- Direct execution without spawning a subprocess
- Can modify shell state (cd, export)
- Support output formatting (--json, --yaml for env, history, jobs)

Available builtins:
- `echo` - output text
- `cd` / `pwd` - directory management
- `export` / `unset` / `env` - environment variables
- `declare` - display arrays/variables
- `alias` / `unalias` - command shortcuts
- `history` - command history
- `read` - user input
- `test` / `[` - conditionals
- `jobs` / `fg` / `bg` - job control
- `trap` - signal handling
- `true` / `false` - test commands
- `js` - JavaScript evaluation

### Pipeline Execution

External commands are executed through `executePipeline()`:

1. Resolve executable path
2. Check for script interpreter (shebang)
3. Spawn child process with inherited stdio
4. Handle job control (TCSetPGRP for interactive commands)
5. Wait for process completion
6. Capture exit code

## Variable Expansion

### Expansion Order

Variables are expanded in this sequence:

1. **Command substitution** - `$(...)` → recursively execute and capture output
2. **Arithmetic expansion** - `$((expr))` → evaluate math expression
3. **Variable expansion** - `$VAR`, `${VAR}` → substitute environment variables
4. **Array expansion** - `${arr[@]}`, `${arr[i]}` → expand array elements
5. **Alias expansion** - expand command aliases
6. **Glob expansion** - `*.txt` → expand file patterns

### Implementation Details

```javascript
expandVars(str) - Main expansion function
expandCommandSubstitution(str) - Handle $(...)
expandArithmetic(expr) - Evaluate $((expr))
expandGlobs(args) - Pattern matching with glob.js
```

## Job Control

fgsh uses FFI bindings (`ptctl.js`) to access Unix job control syscalls:

```c
// ptctl.c - C FFI library
int setpgid(int pid, int pgid);      // Set process group
int tcsetpgrp(int fd, int pgid);    // Set terminal pgrp
int killpg(int pgid, int sig);       // Send signal to process group
```

Job control flow:
1. Child spawned in new process group
2. Parent calls `tcsetpgrp` to give child terminal access
3. Parent waits for child
4. Parent calls `tcsetpgrp` again to regain terminal
5. Job tracking via `/proc` filesystem

## Signal Handling

fgsh handles terminal signals:

- **SIGINT** (Ctrl+C) - propagate to child process
- **SIGTSTP** (Ctrl+Z) - suspend child, move to background
- **SIGCONT** - resume suspended job
- **SIGCHLD** - reap finished child processes

Signal handlers registered with Node.js event system, actual signal delivery through OS.

## History System

See [HISTORY.md](HISTORY.md) for detailed information.

Quick overview:
- SQLite database in `~/.fgshell_history`
- Records: command, directory, exit code, timestamp, duration
- Fuzzy search with Fuse.js
- JSON/YAML export support

## Interactive Features

### Fuzzy History Search (Ctrl+R)

A two-pane search UI over the SQLite history, built with
[OpenTUI](https://opentui.com) (`@opentui/core`) and Fuse.js:
1. User presses Ctrl+R — the picker takes over the screen in the
   alternate buffer, so the prompt and scrollback are untouched
2. Left pane lists commands (newest first) with timestamp and exit code;
   the right pane previews the selection: full command, time, exit code,
   duration and directory
3. Typing fuzzy-filters the list (Fuse.js, substring fallback)
4. Up/Down move the selection; the mouse wheel/click work too
5. Enter inserts the selected command into the prompt line; Escape or
   Ctrl+C cancels without changing the line (Enter with no matches just
   closes the picker)

The OpenTUI core is loaded lazily the first time Ctrl+R is pressed, and
works in the compiled `./fgsh` binary (its native library is embedded by
`bun build --compile`).

### File Picker (Ctrl+N)

Custom file browser:
1. User presses Ctrl+N
2. Display directory tree
3. Show live preview of selected file
4. Navigate with arrow keys: Up/Down move the list, Left goes to the
   parent directory, Right enters the highlighted directory (the picker
   browses on its own — it never changes the shell's working directory)
5. Enter selects the highlighted entry — a file **or a directory** — and
   closes the picker. The selected path is inserted relative to the
   shell's cwd (`docs/notes.md` when picked inside `docs/`, a bare
   `notes.md` when picked in the cwd itself, or the absolute path when the
   file lives outside the cwd)
6. Ctrl+F opens filter mode: typed text fuzzy-filters the list, Enter
   selects the best match

### Command Prediction Menu

The fuzzy prediction box drawn below the prompt while typing:

1. Matches commands/history at the start of a line — each command row
   shows the executable's full path on the right of the box — path/file
   candidates for the current token after a space (tilde-expanded, so
   `cat ~/` lists the home directory), and long options after `--`
2. Draws a bordered box with a scrollbar once more than 10 entries match
3. Up/Down move the selection and Tab accepts it; Enter runs the line as
   you typed it, so `ls` + Enter always runs `ls` — Enter only accepts a
   menu entry after you picked it with Up/Down (or when the menu holds a
   single candidate). Escape dismisses
4. Accepting replaces only the current token: `cat ~/` + `.fgshrc` becomes
   `cat ~/.fgshrc`; accepting a directory reopens the menu inside it
5. Inline ghost text previews the best candidate after the cursor

Optional behavior is configured through environment variables set in
`~/.fgshrc`. To show a right-aligned relative modification time next to
each file entry (as in Flyline):

```sh
export FGSH_MENU_MTIME=1
```

The age column is display-only — accepting an entry inserts the path, never
the age. Off by default.

## Performance Considerations

### Bottlenecks

1. **JavaScript interpretation** - All parsing/evaluation in JS (vs native C)
2. **Subprocess spawning** - Every external command creates new process
3. **Array operations** - Naive linear scans for array matching
4. **String manipulation** - Lots of regex matching during expansion

### Optimizations

1. **Lazy evaluation** - Variables only expanded when needed
2. **Caching** - Resolved executables cached to avoid repeated stat() calls
3. **Minimal allocation** - Reuse objects where possible
4. **Early termination** - Stop parsing on errors

## Testing

Test scripts in root directory:
- `test_control.sh` - if/while/for statements
- `test_case.sh` - case statement matching
- `test_func.sh` - function definition and calls
- `test_array_*.sh` - array operations
- `test_advanced.sh` - comprehensive feature test

Run with:
```bash
./fgsh test_*.sh
```

## Debugging

Enable debug output:
```bash
DEBUG=1 ./fgsh script.sh
```

This logs:
- Command tokenization
- Variable expansion
- Function calls
- Process spawning
- Signal handling

## Error Handling

fgsh provides detailed error messages with line numbers and source context for script debugging:

### Error Reporting System

- **Line number tracking**: All script blocks track start/end line numbers
- **Error format**: `filename:startLine-endLine: error: description`
- **Source snippets**: First line of problematic code shown for context
- **Call stack framework**: Infrastructure in place for function trace support (future)

### Implementation Details

```javascript
// Error context structure
{
  startLine: 12,           // 1-indexed line number
  endLine: 14,             // Range for multi-line blocks
  filename: 'script.sh',   // Full path to script
  content: 'if ...'        // Source code text
}

// formatError() generates user-friendly messages
formatError('if: syntax error - expected "then"', context, showSnippet)
// Output: script.sh:12-14: error: if: syntax error - expected "then"
//           if [ 1 -eq 1 ]
```

### Current Coverage

- ✓ if/then/else/fi statements
- ✓ while/do/done loops  
- ✓ for/do/done loops (both C-style and for-in)
- ✓ case/esac statements
- ✓ function definitions
- ○ Redirection operator parsing (future)
- ○ Command substitution errors (future)

## Future Improvements

1. **Complete here-document support** - Pass content to commands
2. **Process substitution** - `<(cmd)` and `>(cmd)` syntax
3. **Arithmetic conditionals** - `((expr))` syntax
4. **More builtins** - grep, sed, awk as builtins
5. **Stack traces for function calls** - Show call chain in errors
6. **Performance** - Consider Rust for parsing layer

## Related Documentation

- [SCRIPTING.md](SCRIPTING.md) - Complete scripting language guide
- [HISTORY.md](HISTORY.md) - History system details
- [PROMPT.md](PROMPT.md) - Prompt customization
