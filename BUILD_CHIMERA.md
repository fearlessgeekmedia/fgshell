# Building fgshell for Chimera Linux

This guide explains how to build fgshell for Chimera Linux and other musl-based systems.

## Why a Separate Guide?

Chimera Linux uses:
- **musl libc** (not glibc)
- **BSD userland** (not GNU coreutils)
- Different binary compatibility

Pre-built binaries won't work across libc boundaries. You must build natively on Chimera.

## Prerequisites

On Chimera Linux, install:

```bash
pkg install bun        # JavaScript runtime
pkg install gcc        # C compiler for ptctl.c
pkg install make       # Build automation
```

Or for dev toolchain:
```bash
pkg install base-devel
```

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

This installs Node.js packages (Fuse.js, glob, minimist, etc.).

### 3. Compile ptctl (Process Group Control Library)

The critical FFI binding for job control:

```bash
gcc -shared -fPIC -o libptctl.so src/ptctl.c
```

This creates `libptctl.so` linked against musl. Verify:

```bash
ldd libptctl.so
# Should show musl libc, not glibc
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
# fgsh> echo "Hello from Chimera"
Hello from Chimera
# fgsh> exit
```

## Automated Build

Use the build script:

```bash
./build-ptctl.sh  # Compiles ptctl for musl
bun run build     # Compiles fgsh
```

The scripts use native tools, so they automatically build for your system.

## One-Liner Build

```bash
bun install && ./build-ptctl.sh && bun run build && chmod +x fgsh
```

## Installation

Copy to a location in your PATH:

```bash
sudo cp fgsh /usr/local/bin/
# or
sudo cp fgsh /opt/local/bin/
```

Or set as your login shell:

```bash
chsh -s /path/to/fgsh
```

## Troubleshooting

### "gcc: command not found"

Install the C compiler:
```bash
pkg install gcc
```

### "libptctl.so: not found" at runtime

The FFI binding failed to load. Check:

```bash
ls -l libptctl.so
# Should exist and be readable

file libptctl.so
# Should show "ELF 64-bit LSB shared object"

ldd libptctl.so
# Should show musl libc
```

If missing, rebuild:
```bash
./build-ptctl.sh
```

### Job control not working (Ctrl+Z has no effect)

This means ptctl.so didn't load. Check:

```bash
FGSH_DEBUG=1 ./fgsh
# Look for: "Failed to load ptctl: ..."
```

Verify the library exists in the repo root:
```bash
ls -la libptctl.so
```

### "ptctl library not loaded" errors

This is a warning that FFI bindings are unavailable. Job control will be limited:
- Ctrl+C still works
- Ctrl+Z won't work properly
- Terminal state may corrupt with long-running TUI apps

Rebuild ptctl and ensure it's in the repo root.

## Cross-Compilation (Advanced)

If building on another system for Chimera:

```bash
# Install musl tools
pkg install musl-tools
# or on glibc systems
apt install musl-tools  # Debian/Ubuntu
pacman -S musl           # Arch Linux
dnf install musl-libc-devel  # Fedora

# Build with musl
gcc -target x86_64-musl -shared -fPIC -o libptctl.so src/ptctl.c

# Cross-compile Bun is more complex - native build recommended
```

## Platform Notes

### Chimera Linux Specific

Chimera uses:
- `pkg` package manager
- BSD-style init/userland
- musl standard library

All standard POSIX features used by fgshell (fork, execve, signal handling, TTY control) are available.

### Other musl Systems

This build process works for:
- Alpine Linux
- Void Linux  
- OpenWrt
- Any musl-based Linux

Just replace `pkg` with your system's package manager.

### Testing on Docker

```dockerfile
FROM chimera:latest

RUN pkg install -y bun gcc make git

WORKDIR /src
COPY . .

RUN bun install && \
    ./build-ptctl.sh && \
    bun run build && \
    chmod +x fgsh

ENTRYPOINT ["./fgsh"]
```

Build and run:
```bash
docker build -t fgsh-chimera .
docker run -it fgsh-chimera
```

## Verification

After successful build, verify the binary:

```bash
# Check binary type
file fgsh
# Should show: ELF 64-bit LSB executable

# Check dependencies
ldd fgsh
# Should show musl libc

# Quick test
./fgsh -c "echo 'CTRL+Z support ready!'"

# Interactive test
./fgsh
# Try: sleep 100
# Then: Ctrl+Z
# Then: fg
```

## Contributing

If you're testing on Chimera and hit issues:

1. Enable debug output: `FGSH_DEBUG=1 ./fgsh`
2. Note the error messages
3. File an issue with:
   - Chimera Linux version
   - Bun version (`bun --version`)
   - GCC version (`gcc --version`)
   - Error output

## See Also

- [Main README](README.md) - Overall project info
- [CTRL_Z_IMPLEMENTATION.md](CTRL_Z_IMPLEMENTATION.md) - Job control details
- [docs/FGSH.md](docs/FGSH.md) - Architecture and implementation
