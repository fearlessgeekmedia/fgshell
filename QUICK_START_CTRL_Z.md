# Quick Start: CTRL+Z Support

## What Was Done

Re-enabled full CTRL+Z (SIGTSTP) job suspension with proper terminal state management.

## Important: Testing on Native Hardware

Job control requires `tcsetpgrp()` syscall which needs proper process group permissions. **This doesn't work in containers** due to permission restrictions (the processes run as unprivileged users). Test on native hardware or a properly configured system.

## For Chimera Linux (Native Host)

### 1. Build on Chimera

```bash
cd fgshell
bun install
./build-ptctl.sh
bun run build
```

### 2. Test

```bash
# Start shell
./fgsh

# Try suspending a job
sleep 100
# Press Ctrl+Z → [1]+ Stopped    sleep 100

# Resume it
fg
# Job continues

# Exit
exit
```

## Changes at a Glance

| What | Where | Lines |
|------|-------|-------|
| SIGTSTP handler | src/fgshell.js | 3095-3152 |
| Enhanced fg command | src/fgshell.js | 719-850 |
| Header docs | src/fgshell.js | 1-15 |

## Key Features

- **Ctrl+Z** suspends foreground jobs
- **fg** resumes suspended jobs
- **Terminal ownership** properly transferred via ptctl
- **Readline state** correctly managed
- **Works with** non-pty processes (standard shell spawns)

## Debugging

Enable debug output to see signal handling:

```bash
FGSH_DEBUG=1 ./fgsh
```

Look for messages like:
- `SIGTSTP received - suspending foreground jobs`
- `Terminal foreground process group: XXXX`
- `Restoring terminal to shell PGID: XXXX`

## Documentation Files

| File | Purpose |
|------|---------|
| **CTRL_Z_IMPLEMENTATION.md** | How it works technically |
| **BUILD_CHIMERA.md** | Building for musl systems |
| **CTRL_Z_CHANGES.md** | Complete change summary |

## Troubleshooting

### Ctrl+Z doesn't work

1. Check if ptctl loaded:
   ```bash
   FGSH_DEBUG=1 ./fgsh
   # Should see "SIGTSTP received" on Ctrl+Z
   ```

2. Verify libptctl.so exists:
   ```bash
   ls -la libptctl.so
   ```

3. Rebuild if missing:
   ```bash
   ./build-ptctl.sh
   bun run build
   ```

### Shell prompt disappears after Ctrl+Z

This is the terminal ownership issue (libptctl.so not working). The signal is caught but terminal isn't restored. Either:
- Rebuild ptctl: `./build-ptctl.sh`
- Or type `fg` blind and press Enter (job will resume)

## Testing Cases

```bash
# Basic suspend/resume
sleep 100
# Ctrl+Z
fg

# Multiple jobs
sleep 100 &
sleep 200
# Ctrl+Z
fg %1

# Long-running output
while true; do echo "x"; sleep 1; done
# Ctrl+Z after a few iterations
fg

# Nested suspend
sleep 100
# Ctrl+Z
fg
# Ctrl+Z
fg
```

## git Status

```bash
# Check what changed
git diff src/fgshell.js

# New files created
git status | grep "CTRL_Z\|BUILD_CHIMERA\|QUICK"
```

## Next: Commit and Test

When ready to test on Chimera:

```bash
# On Chimera Linux
git clone <repo>
cd fgshell
./build-ptctl.sh
bun run build
FGSH_DEBUG=1 ./fgsh
# Try Ctrl+Z
```

## Questions?

See full implementation details in CTRL_Z_IMPLEMENTATION.md
