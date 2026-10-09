# fgshell

A modern Unix shell with fuzzy history search, an interactive file picker, and inline command prediction — written in JavaScript on the Bun runtime. Runs on Linux, macOS, and GhostBSD/FreeBSD.

## What is this?

`fgshell` is a functional Unix shell implementation written mostly in JavaScript/Bun, with a tiny bit of C. It has many things you expect from a shell (pipes, redirections, job control, scripting) plus some genuinely useful features that bash/zsh don't have out of the box:

- **Interactive file picker** (Ctrl+N) with live preview and Kitty image support
- **Fuzzy history search** (Ctrl+R) with Fuse.js and an OpenTUI two-pane preview UI
- **Inline command prediction** with ghost text and a fuzzy completion menu
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
- **📂 Interactive file picker** (Ctrl+N) — visually browse files and directories with live preview (includes high-quality image previews in Kitty terminals)
- **🔍 Fuzzy history search** (Ctrl+R) — two-pane UI (list plus full-command preview with time, exit code and directory), fuzzy-matching powered by Fuse.js, rendered with OpenTUI
- **💾 SQLite history database** — persistent history with timestamps, exit codes, and execution duration
- **🎨 Customizable prompts** — full color support and variable expansion
- **⚡ Inline command prediction** — ghost text plus a bordered, scrollable menu that completes paths as you type (`cat ~/` lists your home), shows each command's full path on the right, with an optional mtime column (`export FGSH_MENU_MTIME=1` in `~/.fgshrc`)
- **💻 Embedded JavaScript REPL** — `js` command for quick JavaScript evaluation
- **📜 History expansion** — `!!` (last command), `!$` (last argument), `!^` (first argument), `!n`, and `!?text` (search)
- **📦 Structured output** — `--json` and `--yaml` flags on `ls`, `history`, `jobs`, and `env`

### Standard Shell Features
- **Command execution** with proper process spawning
- **Pipes and redirection**: `|`, `>`, `>>`, `<`
- **Background jobs**: `cmd &` and `jobs`, `fg`, `bg` builtins
- **Environment variables**: `$VAR` and `${VAR}` expansion
- **Command substitution**: `$(command)` and arithmetic `$((expr))`
- **Tab completion** for files and directories
- **Interactive line editing** with a custom Bun-native line editor (raw-mode input, history, and inline ghost text)
- **Aliases**: `alias name=command` syntax
- **Shell scripting** with full control flow: if/else, while, for (C-style and for-in), case statements
- **Shell functions** with parameter passing
- **Arrays** with indexing and expansion (`${arr[@]}`, `${arr[i]}`)
- **Logical operators**: `&&` and `||` for command chaining
- **Subshells** with `()`
- **Here-documents** with `<<EOF` (in scripts, files loaded with `source`, and `~/.fgshrc`)
- **Signal traps** with `trap` command
- **Sourcing**: `source file` to run a script in the current shell
- **Built-in commands**: `cd`, `mkcd`, `pwd`, `clear`, `echo`, `ls`, `cat`, `printf`, `export`, `unset`, `env`, `history`, `alias`, `unalias`, `source`, `declare`, `read`, `test`/`[`, `trap`, `jobs`, `fg`, `bg`, `true`, `false`, `exit`, `js`
- **Helpful error messages** with file:line references and source code snippets in scripts

## Building

### Platform Support

**fgshell runs on Linux, macOS, and GhostBSD/FreeBSD.** It requires:
- POSIX-compliant system with proper terminal control (Linux, macOS, GhostBSD/FreeBSD)
- [Bun](https://bun.sh) runtime — official builds for Linux and macOS; a community FreeBSD x64 build (works on GhostBSD and other FreeBSD systems) is available via the [SourceForge mirror](https://sourceforge.net/projects/bun.mirror/files/)
- Not available on Windows

GhostBSD/FreeBSD users: see [BUILD_GHOSTBSD.md](BUILD_GHOSTBSD.md) for a detailed build guide.

### Requirements

- [Bun](https://bun.sh) (JavaScript runtime) - Linux x64, Linux ARM64, macOS (x64 and ARM64), FreeBSD x64 (community build via SourceForge)
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

#### Option 4: GhostBSD/FreeBSD

fgshell builds natively on GhostBSD and FreeBSD. The job control code (`ptctl.c`) uses standard POSIX interfaces (termios, `tcsetpgrp`, `TIOCSCTTY`) that FreeBSD provides, so no code changes are needed.

**Prerequisites:**

```bash
# Install the build toolchain
sudo pkg install gcc make git unzip
```

**Get Bun:** FreeBSD builds of Bun are not yet on bun.sh directly — download the community build from the [SourceForge mirror](https://sourceforge.net/projects/bun.mirror/files/):

```bash
# Download bun-freebsd-x64.zip, then:
unzip bun-freebsd-x64.zip
sudo cp bun-freebsd-x64/bun /usr/local/bin/
bun --version  # verify it runs
```

**Build:**

```bash
bun install
./build-ptctl.sh
bun run build
```

See [BUILD_GHOSTBSD.md](BUILD_GHOSTBSD.md) for the full guide, including troubleshooting.

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
| Kitty terminal image support | ✓ | ✗ | ✗ (with plugins) |
| SQLite history database | ✓ | ✗ | ✗ |
| Command duration tracking | ✓ | ✗ | ✓ (with plugins) |
| Exit code in history | ✓ | ✗ | ✗ |
| Inline command prediction (ghost text + menu) | ✓ | ✗ | ✓ (with plugins) |
| JSON/YAML output from builtins | ✓ | ✗ | ✗ |
| Basic shell features | ✓ | ✓ | ✓ |
| POSIX compatibility | ✗ | ✓ | ✓ |
| Cross-platform (Linux/macOS/FreeBSD) | ✓ | ✓ | ✓ |

## Architecture

- **src/fgshell.js** - Main shell implementation with command parsing, execution, and job control
- **src/line-editor.js** - Custom line editor: raw-mode key handling, prompt rendering, ghost text, and the completion menu
- **src/shell.js** - Shell state (environment, current directory, aliases, jobs)
- **src/ptctl.js** - FFI bindings for Unix process group control (tcsetpgrp, setpgid, etc)
- **src/ptctl.c** - C library exposing terminal control syscalls
- **src/history-db.js** - SQLite-backed command history
- **src/output-formatter.js** - JSON/YAML output formatting for builtins

## Job Control Notes

fgshell uses FFI bindings to access low-level job control syscalls that aren't exposed by Node.js/Bun. This allows proper terminal handoff to child processes.

## Documentation

- [SCRIPTING.md](docs/SCRIPTING.md) - Complete scripting language guide with examples
- [FGSH.md](docs/FGSH.md) - Shell design, architecture, and implementation details
- [HISTORY.md](docs/HISTORY.md) - Command history system
- [PROMPT.md](docs/PROMPT.md) - Prompt customization
- [JAVASCRIPT.md](docs/JAVASCRIPT.md) - Using JavaScript from the shell with the `js` builtin
- [BUILD_GHOSTBSD.md](BUILD_GHOSTBSD.md) - Building on GhostBSD/FreeBSD
- [BUILD_CHIMERA.md](BUILD_CHIMERA.md) - Building on Chimera Linux (musl)

## Known Limitations & Issues

- **Platform support**: Linux, macOS, and GhostBSD/FreeBSD. Not available on Windows. On FreeBSD, Bun comes from a community build rather than an official bun.sh release, so it may lag behind the latest version
- **sudo TTY access**: `sudo` without the `-S` flag fails to read passwords interactively when run inside `fgshell`, regardless of whether `fgshell` is the default shell or a subshell. Workaround: use `sudo -S` to read password from stdin
- **Ctrl+Z job suspension**: Works for single foreground commands; edge cases remain for pipelines/compound commands, and stop-detection polls `/proc` (Linux-only), so behavior is less robust on macOS/GhostBSD (tracked in TODO.md)
- **Performance**: Written in JavaScript/Bun—not as fast as native shells for heavy workloads
- **POSIX compliance**: Not fully POSIX-compliant; designed for interactive use
- **Here-documents**: Work whenever the input comes from a file — scripts, files loaded with `source`, and `~/.fgshrc` (content is delivered through a temporary file) — but not yet in interactive mode or with `-c`. Quoted delimiters (`<<'EOF'`) and variable expansion inside the body are not supported yet

## Roadmap

- [x] Ctrl+Z job suspension with terminal state management (fixed for single foreground commands; pipeline and non-Linux edge cases tracked in TODO.md)
- [x] Here-documents in scripts, `source`, and `~/.fgshrc` (content delivery complete)
- [ ] Here-documents in interactive mode and `-c`, with quoted delimiters and variable expansion
- [ ] Plugin system for extending commands
- [x] Better error messages with line numbers (completed)
- [ ] Stack traces for function calls
- [ ] Debugging mode with breakpoints
- [ ] Arithmetic operators in test conditions

## License

fgshell is distributed under the MIT license — see [LICENSE](LICENSE).
