# Building fgshell for GhostBSD/FreeBSD

This guide explains how to build fgshell for GhostBSD and FreeBSD.

## Why a Separate Guide?

GhostBSD is a desktop OS built on FreeBSD, and both share the same userland,
kernel interfaces, and `pkg` package manager — but they are **not Linux**:

- Different system calls and userland from Linux (though all the POSIX ones
  fgshell uses — fork, execve, termios, `tcsetpgrp`, `TIOCSCTTY` — are present)
- Linux binaries do not run natively (the Linuxulator compatibility layer is
  not a good fit for a compiled shell binary)
- Bun does not yet ship official FreeBSD builds on bun.sh, so you install a
  community FreeBSD build instead

You must build natively on GhostBSD/FreeBSD.

## Prerequisites

Install the build toolchain from packages:

```bash
sudo pkg install gcc make git unzip
```

## Getting Bun

Bun is not yet available as an official bun.sh download for FreeBSD. A
community-built FreeBSD x64 binary is mirrored on SourceForge:

1. Download `bun-freebsd-x64.zip` from the
   [Bun mirror on SourceForge](https://sourceforge.net/projects/bun.mirror/files/)
2. Extract and install it:

```bash
unzip bun-freebsd-x64.zip
sudo cp bun-freebsd-x64/bun /usr/local/bin/
```

Verify it runs:

```bash
bun --version
```

> **Note:** Because this is a community build, it may lag behind the latest
> Bun release. fgshell works with recent versions, but if you hit a runtime
> oddity, check which Bun version you have before filing an issue.

## Build Steps

### 1. Clone/Prepare Source

```bash
git clone https://github.com/fearlessgeekmedia/fgshell.git
cd fgshell
```

### 2. Install JavaScript Dependencies

```bash
bun install
```

This installs the Node.js packages (Fuse.js, glob, minimist, etc.).

### 3. Compile ptctl (Process Group Control Library)

The critical FFI binding for job control:

```bash
gcc -shared -fPIC -o libptctl.so src/ptctl.c
```

This creates `libptctl.so`. FreeBSD uses the `.so` shared library extension,
so no renaming is needed (unlike macOS, which needs `.dylib`). Verify:

```bash
ldd libptctl.so
```

### 4. Compile fgsh Binary

```bash
bun run build
# or
bun build --compile ./src/fgshell.js --outfile fgsh
```

This produces the `fgsh` executable.

### 5. Test

```bash
./fgsh
# fgsh> echo "Hello from GhostBSD"
Hello from GhostBSD
# fgsh> exit
```

## Automated Build

Use the build script:

```bash
./build-ptctl.sh  # Compiles ptctl
bun run build     # Compiles fgsh
```

The scripts use native tools, so they automatically build for your system.

## One-Liner Build

```bash
bun install && ./build-ptctl.sh && bun run build && chmod +x fgsh
```

## Installation

Copy to a location in your PATH (FreeBSD convention is `/usr/local/bin`):

```bash
sudo cp fgsh /usr/local/bin/
```

Or set as your login shell:

```bash
chsh -s /path/to/fgsh
```

## Troubleshooting

### "pkg: command not found" or package not found

You're probably not on GhostBSD/FreeBSD. On GhostBSD/FreeBSD, `pkg` is the
FreeBSD package manager (the ports tree is also available under
`/usr/ports`).

### "bun: command not found"

Make sure you copied the extracted binary to a directory in your `PATH`:

```bash
sudo cp bun-freebsd-x64/bun /usr/local/bin/
hash -r
bun --version
```

### "libptctl.so: not found" at runtime

The FFI binding failed to load. Check:

```bash
ls -l libptctl.so
# Should exist and be readable

file libptctl.so
# Should show "ELF 64-bit LSB shared object"

ldd libptctl.so
```

If missing, rebuild:

```bash
./build-ptctl.sh
```

### Job control not working (Ctrl+Z has no effect)

This means libptctl.so didn't load. Check:

```bash
FGSH_DEBUG=1 ./fgsh
# Look for: "Failed to load ptctl: ..."
```

Verify the library exists in the repo root:

```bash
ls -la libptctl.so
```

### "ptctl library not loaded" errors

This is a warning that FFI bindings are unavailable. Job control will be
limited:
- Ctrl+C still works
- Ctrl+Z won't work properly
- Terminal state may corrupt with long-running TUI apps

Rebuild ptctl and ensure it's in the repo root.

## Platform Notes

### FreeBSD Specific

All standard POSIX features used by fgshell (fork, execve, signal handling,
TTY control via termios/`tcsetpgrp`/`TIOCSCTTY`) are available on FreeBSD —
`src/ptctl.c` compiles unchanged.

### GhostBSD Specific

GhostBSD uses FreeBSD releases with a desktop-focused configuration and the
same `pkg` repositories, so the instructions above apply directly.

## Verification

After a successful build, verify the binary:

```bash
# Check binary type
file fgsh
# Should show: ELF 64-bit LSB executable

# Check dependencies
ldd fgsh

# Quick test
./fgsh -c "echo 'GhostBSD/FreeBSD support ready!'"

# Interactive test
./fgsh
# Try: sleep 100
# Then: Ctrl+Z
# Then: fg
```

## Contributing

If you're testing on GhostBSD/FreeBSD and hit issues:

1. Enable debug output: `FGSH_DEBUG=1 ./fgsh`
2. Note the error messages
3. File an issue with:
   - GhostBSD or FreeBSD version (`freebsd-version`)
   - Bun version (`bun --version`)
   - GCC version (`gcc --version`)
   - Error output

## See Also

- [Main README](README.md) - Overall project info
- [BUILD_CHIMERA.md](BUILD_CHIMERA.md) - Building for musl-based systems
- [CTRL_Z_IMPLEMENTATION.md](CTRL_Z_IMPLEMENTATION.md) - Job control details
- [docs/FGSH.md](docs/FGSH.md) - Architecture and implementation
