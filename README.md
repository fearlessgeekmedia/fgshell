# fgshell

A Unix shell with modern features like fuzzy history search and interactive file picker—written in JavaScript/Bun because apparently we can. It probably shouldn't exist. You probably shouldn't use it. But here it is if you really want to use it. 

## What is this?

`fgshell` is a functional Unix shell implementation written mostly in JavaScript/Bun, with a tiny bit of C. It has many things you expect from a shell (pipes, redirections, job control, scripting) plus some genuinely useful features that bash/zsh don't have out of the box:

- **Interactive file picker** (Ctrl+N) with live preview
- **Fuzzy history search** (Ctrl+R) with Fuse.js
- **SQLite history database** with timestamps, exit codes, and command duration
- **Customizable prompts** with color support

## Why?

A shell that searches your command history with fuzzy matching, remembers which directory you ran commands in, and lets you visually browse files without leaving the shell—all without installing 50 plugins. It's a shell designed for the 2020s, not the 1970s.

### Design Philosophy

**fgshell is intentionally not POSIX-compliant.** It prioritizes:
- **Interactive usability** over compatibility with 50-year-old standards
- **Modern JavaScript integration** for logic and data manipulation
- **Developer experience** with fuzzy search, visual file picking, and a better history system
- **Fast iteration** and experimentation (written in JavaScript, not C)

If you need POSIX compliance, use bash or sh. fgshell is for developers who want a better interactive shell for the modern era.

## Features

### The Cool Stuff
- **📂 Interactive file picker** (Ctrl+N) — visually browse files and directories with live preview
- **🔍 Fuzzy history search** (Ctrl+R) — search commands by any part of the command, powered by Fuse.js
- **💾 SQLite history database** — persistent history with timestamps, exit codes, and execution duration
- **🎨 Customizable prompts** — full color support and variable expansion
- **💻 Embedded JavaScript REPL** — `js` command for quick JavaScript evaluation

### Standard Shell Features
- **Command execution** with proper process spawning
- **Pipes and redirection**: `|`, `>`, `>>`, `<`
- **Background jobs**: `cmd &` and `jobs`, `fg`, `bg` builtins
- **Environment variables**: `$VAR` and `${VAR}` expansion
- **Command substitution**: `$(command)` and arithmetic `$((expr))`
- **Tab completion** for files and directories
- **Interactive line editing** with readline
- **Aliases**: `alias name=command` syntax
- **Shell scripting** with full control flow: if/else, while, for (C-style and for-in), case statements
- **Shell functions** with parameter passing
- **Arrays** with indexing and expansion (`${arr[@]}`, `${arr[i]}`)
- **Logical operators**: `&&` and `||` for command chaining
- **Subshells** with `()`
- **Here-documents** with `<<EOF`
- **Signal traps** with `trap` command
- **Built-in commands**: `cd`, `pwd`, `echo`, `export`, `unset`, `env`, `history`, `alias`, `unalias`, `declare`
- **Helpful error messages** with file:line references and source code snippets in scripts

## Building

### Platform Support

**fgshell currently only works on Linux and macOS.** It requires:
- POSIX-compliant system with proper terminal control (Linux, macOS)
- [Bun](https://bun.sh) runtime, which is available for Linux and macOS only
- Not available on Windows or BSD systems (except macOS)

### Requirements

- [Bun](https://bun.sh) (JavaScript runtime) - Linux x64, Linux ARM64, macOS (x64 and ARM64)
- `make` and `gcc` (for compiling job control FFI bindings)
- Node.js 18+ or Bun (for package management)

### Installation & Setup

#### Option 1: NixOS with Flakes (Recommended)

If you're using NixOS with flakes enabled:

```bash
# Build with NixOS/Nix
nix build . --no-sandbox

# Or disable sandbox globally in /etc/nixos/configuration.nix:
# nix.settings.sandbox = false;
```

#### Option 2: Using Nix on Non-NixOS Systems

If you have Nix installed on Linux or macOS (but not using NixOS):

```bash
# Enter a development environment with all dependencies
nix develop

# Then follow manual setup below
npm install
./build-ptctl.sh
bun run build
```

#### Option 3: Manual Setup (Linux/macOS)

If you don't have Nix, ensure you have the dependencies installed:

**Prerequisites:**
- Bun: Install from https://bun.sh
- gcc and make: `apt-get install build-essential` (Ubuntu/Debian) or `brew install gcc make` (macOS)
- Node.js 18+ or Bun (for npm/bun)

**Build:**

```bash
# Install JavaScript dependencies
npm install  # or: bun install

# Compile the native process group control library
./build-ptctl.sh

# Build the shell binary
bun run build
```

### Running

```bash
./fgsh                    # Interactive shell
./fgsh script.sh          # Execute a script
./fgsh -c "echo hello"    # Run a command
```

## Quick Comparison: fgshell vs bash/zsh

| Feature | fgshell | bash | zsh |
|---------|---------|------|-----|
| Fuzzy history search (Ctrl+R) | ✓ | ✗ | ✓ (with plugins) |
| Interactive file picker (Ctrl+N) | ✓ | ✗ | ✗ (with plugins) |
| SQLite history database | ✓ | ✗ | ✗ |
| Command duration tracking | ✓ | ✗ | ✓ (with plugins) |
| Exit code in history | ✓ | ✗ | ✗ |
| Basic shell features | ✓ | ✓ | ✓ |
| POSIX compatibility | ✗ | ✓ | ✓ |
| Cross-platform (Unix/Linux/macOS) | ✓ | ✓ | ✓ |

## Architecture

- **src/fgshell.js** - Main shell implementation with command parsing, execution, and job control
- **src/shell.js** - Shell state (environment, current directory, aliases, jobs)
- **src/ptctl.js** - FFI bindings for Unix process group control (tcsetpgrp, setpgid, etc)
- **src/ptctl.c** - C library exposing terminal control syscalls
- **src/history-db.js** - SQLite-backed command history

## Job Control Notes

fgshell uses FFI bindings to access low-level job control syscalls that aren't exposed by Node.js/Bun. This allows proper terminal handoff to child processes.

## Documentation

- [SCRIPTING.md](docs/SCRIPTING.md) - Complete scripting language guide with examples
- [FGSH.md](docs/FGSH.md) - Shell design, architecture, and implementation details
- [HISTORY.md](docs/HISTORY.md) - Command history system
- [PROMPT.md](docs/PROMPT.md) - Prompt customization
- [JAVASCRIPT.md](docs/JAVASCRIPT.md) - Why JavaScript was chosen (spoiler: bad reasons)

## Known Limitations & Issues

- **Platform support**: Linux and macOS only. Bun is not available on other Unix systems (BSD, etc.)
- **sudo TTY access**: `sudo` without the `-S` flag fails to read passwords interactively when run inside `fgshell`, regardless of whether `fgshell` is the default shell or a subshell. Workaround: use `sudo -S` to read password from stdin
- **Ctrl+Z job suspension**: Terminal state management with tcsetpgrp has edge cases
- **Performance**: Written in JavaScript/Bun—not as fast as native shells for heavy workloads
- **POSIX compliance**: Not fully POSIX-compliant; designed for interactive use
- **Here-documents**: Parsed but content isn't yet passed to commands

## Roadmap

- [ ] Proper Ctrl+Z terminal state handling
- [ ] Complete here-document support
- [ ] Plugin system for extending commands
- [x] Better error messages with line numbers (completed)
- [ ] Stack traces for function calls
- [ ] Debugging mode with breakpoints
- [ ] Arithmetic operators in test conditions

## License

Probably shouldn't exist, so probably shouldn't be licensed. Use at your own risk. Regardless, it's under the MIT license anyway.
