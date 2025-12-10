# fgshell

A shell written in JavaScript that probably shouldn't exist, but does.

## What is this?

`fgshell` is a functional Unix shell implementation written mostly in JavaScript/Bun. It includes pipes, redirections, job control, aliases, history, file picker, and more. It's designed to be a usable interactive shell despite the obvious architectural absurdity of writing one in JavaScript.

## Why?

Because why not? Some projects are born from necessity. This one was born from the question "could we?"

## Features

- **Command execution** with proper process spawning
- **Pipes and redirection**: `|`, `>`, `>>`, `<`
- **Background jobs**: `cmd &` and `jobs`, `fg`, `bg` builtins
- **Environment variables**: `$VAR` and `${VAR}` expansion
- **Command substitution**: `$(command)` and arithmetic `$((expr))`
- **Tab completion** for files and directories
- **Interactive line editing** with readline
- **Command history** with full-text search (Ctrl+R)
- **File picker** (Ctrl+N) for visual file/directory navigation
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

## Known Limitations

- **Ctrl+Z**: Suspending jobs is not yet fully functional (tcsetpgrp challenges)
- **Script features**: Limited to basic if/while blocks
- **Performance**: It's JavaScript, so... don't benchmark it
- **Portability**: Requires Unix-like OS with proper terminal control

## License

Probably shouldn't exist, so probably shouldn't be licensed. Use at your own risk.
