# fgshell

A Unix shell with modern features like fuzzy history search and interactive file picker—written in JavaScript/Bun because apparently we can.

## What is this?

`fgshell` is a functional Unix shell implementation written in JavaScript/Bun. It has everything you expect from a shell (pipes, redirections, job control, scripting) plus some genuinely useful features that bash/zsh don't have out of the box:

- **Interactive file picker** (Ctrl+N) with live preview
- **Fuzzy history search** (Ctrl+R) with Fuse.js
- **SQLite history database** with timestamps, exit codes, and command duration
- **Customizable prompts** with color support

## Why?

A shell that searches your command history with fuzzy matching, remembers which directory you ran commands in, and lets you visually browse files without leaving the shell—all without installing 50 plugins. It's a shell designed for the 2020s, not the 1970s.

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
- **Shell scripting** with if/while control flow
- **Built-in commands**: `cd`, `pwd`, `echo`, `export`, `unset`, `env`, `history`, `alias`, `unalias`

## Building

### Requirements

- [Bun](https://bun.sh) (JavaScript runtime)
- `make` and `gcc` (for compiling job control FFI bindings)
- Node.js or Bun (for npm/bun package manager)

### Dependencies

The project depends on:
- **bun-pty** - PTY handling for interactive shells
- **enquirer** - Terminal UI for prompts
- **fuse.js** - Fuzzy search for file picker
- **glob** - File pattern matching

### Setup

```bash
# Enter the nix shell (if using NixOS)
nix flake check

# Or install dependencies manually
npm install  # or: bun install

# Compile the native process group control library
./build-ptctl.sh

# Build the shell
bun build-fgsh.js
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
| POSIX compatibility | ✓ | ✓ | ✓ |
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

- [FGSH.md](docs/FGSH.md) - Shell design and implementation details
- [HISTORY.md](docs/HISTORY.md) - Command history system
- [JAVASCRIPT.md](docs/JAVASCRIPT.md) - Why JavaScript was chosen (spoiler: bad reasons)
- [PROMPT.md](docs/PROMPT.md) - Prompt customization

## Known Limitations & Issues

- **Ctrl+Z job suspension**: Terminal state management with tcsetpgrp has edge cases
- **Script features**: Limited to basic if/while blocks, no functions or advanced control flow
- **Performance**: Written in JavaScript/Bun—not as fast as native shells for heavy workloads
- **Portability**: Requires Unix-like OS with proper terminal control (Linux, macOS)
- **POSIX compliance**: Not fully POSIX-compliant; designed for interactive use

## Roadmap

- [ ] Proper Ctrl+Z terminal state handling
- [ ] Shell functions and advanced scripting
- [ ] Plugin system for extending commands
- [ ] Better error messages and debugging output

## License

Probably shouldn't exist, so probably shouldn't be licensed. Use at your own risk.
