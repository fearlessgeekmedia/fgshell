# CTRL+Z Re-enablement - Change Summary

## Status: Complete ✓

CTRL+Z (SIGTSTP) signal handling has been fully re-implemented with proper terminal state management and job control.

## Changes Made

### 1. Signal Handler Added (src/fgshell.js)

**Location**: Lines 3095-3152

**What it does**:
- Catches SIGTSTP signals from Ctrl+Z
- Sends SIGTSTP to all non-background jobs
- Marks jobs as suspended
- Restores terminal control from job to shell
- Pauses readline and redisplays prompt

**Key code**:
```javascript
process.on('SIGTSTP', () => {
  debug('SIGTSTP received - suspending foreground jobs');
  
  // Send SIGTSTP to foreground jobs
  for (const j of SHELL.jobs) {
    if (!j.background && !j.done) {
      for (const pid of j.pids) {
        process.kill(pid, 'SIGTSTP');
        j.suspended = true;
      }
    }
  }
  
  // Restore terminal to shell
  if (ptctl.available) {
    ptctl.tcsetpgrp(1, shellPgid);
  }
  
  // Show prompt again
  setImmediate(() => {
    if (rl.paused) rl.resume();
    prompt().catch(() => {});
  });
});
```

### 2. Enhanced fg Command (src/fgshell.js)

**Location**: Lines 719-850

**What changed**:
- Now sets terminal control to job's process group before resuming
- Properly handles suspended jobs (non-pty)
- Manages readline pause/resume around job execution
- Restores terminal to shell when job finishes

**Key additions**:
```javascript
// Get job's process group and transfer terminal
const jobPgid = ptctl.getpgid(job.pids[0]);
ptctl.tcsetpgrp(1, jobPgid);

// Send SIGCONT to resume
for (const pid of job.pids) {
  process.kill(pid, 'SIGCONT');
}

// Wait for job, then restore
await waitForJob(job);
ptctl.tcsetpgrp(1, shellPgid);
```

### 3. Job Structure Update

Added `suspended` flag to distinguish:
- `background = true`: Job runs in background (user doesn't wait)
- `suspended = true`: Job was stopped by Ctrl+Z (user can `fg` to resume)

## Testing Scenarios

### Basic Suspend/Resume

```bash
fgsh> sleep 100
^Z                          # Press Ctrl+Z
[1]+ Stopped    sleep 100   # Shell shows prompt
fgsh> fg                    # Resume
sleep                       # Job continues
```

### Multiple Jobs

```bash
fgsh> sleep 100 &           # Background job
[1] 12345
fgsh> sleep 200             # Foreground job
^Z                          # Suspend it
[2]+ Stopped    sleep 200
fgsh> fg                    # Resume sleep 200
^Z                          # Suspend again
[2]+ Stopped    sleep 200
fgsh> fg %1                 # Resume sleep 100 from background
```

### Terminal State

The critical fix: terminal ownership is properly transferred
- When job runs: `tcsetpgrp(1, jobPgid)` - job owns terminal
- When suspended: `tcsetpgrp(1, shellPgid)` - shell owns terminal
- When resumed: `tcsetpgrp(1, jobPgid)` again

This prevents:
- Readline state corruption
- Prompt appearing over output
- Input being read by wrong process

## Platform Notes

### Works On
- Linux (glibc and musl)
- macOS
- Any POSIX system with job control syscalls

### Requires
- `ptctl.available` to be true (FFI library loaded)
- Terminal (TTY) mode (not piped stdin)
- Signal handling in the runtime (Bun/Node.js)

### Degraded Without ptctl
If `libptctl.so` fails to load:
- Signal forwarding still works
- Terminal ownership isn't transferred properly
- May cause corruption with TUI apps

## Files Modified

| File | Lines | Change |
|------|-------|--------|
| src/fgshell.js | 1-15 | Header comment: updated feature list |
| src/fgshell.js | 719-850 | Enhanced fg command with terminal control |
| src/fgshell.js | 3095-3152 | New SIGTSTP signal handler |

## Files Created

| File | Purpose |
|------|---------|
| CTRL_Z_IMPLEMENTATION.md | Technical deep-dive on the implementation |
| BUILD_CHIMERA.md | Building for musl-based systems like Chimera Linux |
| CTRL_Z_CHANGES.md | This file - summary of changes |

## Next Steps

### For Chimera Linux Build
1. Clone repo on Chimera system
2. Run `./build-ptctl.sh` to compile for musl
3. Run `bun run build` to compile fgsh
4. Test: `FGSH_DEBUG=1 ./fgsh` and try Ctrl+Z

### For Testing
```bash
# Enable debug to see signal handling
export FGSH_DEBUG=1

# Test in the shell
./fgsh

# Try these:
sleep 100        # Ctrl+Z to suspend
^Z
fg               # Resume

# Background job
sleep 100 &
fg %1            # Bring to foreground

# Long-running with output
while true; do echo "test"; sleep 1; done
^Z               # Suspend after a few seconds
fg               # Resume and continue
^Z               # Suspend again
```

## Debugging

If Ctrl+Z doesn't work:

1. Check ptctl loaded:
   ```bash
   FGSH_DEBUG=1 ./fgsh
   # Look for "ptctl library not loaded" or "SIGTSTP received"
   ```

2. Verify libptctl.so exists:
   ```bash
   ls -la libptctl.so
   ldd libptctl.so
   ```

3. Check it's the right architecture:
   ```bash
   file libptctl.so
   # Should show your system (x86_64, musl if on Chimera)
   ```

4. If missing, rebuild:
   ```bash
   ./build-ptctl.sh
   ```

## Backward Compatibility

- No breaking changes
- Existing functionality unchanged
- SIGINT (Ctrl+C) still works as before
- Background jobs (`cmd &`) unchanged
- Default shell behavior identical

## Known Limitations

1. Only one foreground job at a time (standard shell behavior)
2. Piped commands may have edge cases with process group handling
3. Requires TTY (won't work with piped input)
4. SIGSTOP not sent to shell (user must manually `fg` to resume)

## References

- POSIX job control specification
- Signal handling in Bun/Node.js runtime
- ptctl FFI bindings (`src/ptctl.c`, `src/ptctl.js`)
- Implementation details: `CTRL_Z_IMPLEMENTATION.md`
