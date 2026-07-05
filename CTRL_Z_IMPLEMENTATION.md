# CTRL+Z (SIGTSTP) Implementation

## Overview

CTRL+Z support has been re-enabled in fgshell with proper terminal state management and job suspension/resumption.

## What Changed

### 1. Added SIGTSTP Signal Handler (src/fgshell.js:3095-3152)

The shell now catches `SIGTSTP` signals (Ctrl+Z) and:
- Suspends all foreground jobs by sending them `SIGTSTP`
- Restores terminal control from the job back to the shell
- Pauses the readline interface
- Displays the shell prompt again

### 2. Enhanced fg (Foreground) Command (src/fgshell.js:719-850)

The `fg` command now:
- Sets terminal control back to the job's process group before resuming
- Sends `SIGCONT` to resume the suspended process
- Waits for the job to complete or get suspended again
- Restores terminal control to the shell when the job finishes
- Properly manages readline pause/resume state

### 3. Job Structure Enhancement

Jobs now track a `suspended` flag to distinguish between background and suspended states.

## How It Works

### Suspending a Job (Ctrl+Z)

```
User presses Ctrl+Z
    ↓
Process receives SIGTSTP
    ↓
Shell's SIGTSTP handler executes:
  1. Send SIGTSTP to all foreground job PIDs
  2. Restore terminal to shell process group (ptctl.tcsetpgrp)
  3. Pause readline
  4. Show prompt again
    ↓
Job is now stopped: [N]+ Stopped    command
```

### Resuming a Job (fg %N)

```
User types: fg %N
    ↓
fg command:
  1. Get job's process group ID
  2. Set terminal to job's PGID (ptctl.tcsetpgrp)
  3. Send SIGCONT to job PIDs
  4. Pause readline
  5. Wait for job to finish or suspend again
  6. Restore terminal to shell
  7. Resume readline
    ↓
Job continues executing
```

## Terminal State Management

The implementation uses `ptctl` (process group control FFI bindings) to:

- **tcsetpgrp(fd, pgid)**: Transfer terminal ownership between process groups
- **getpgid(pid)**: Get the process group of a job to restore proper terminal control

Without proper terminal handoff:
- Child processes would receive terminal control even when suspended
- Readline input would be corrupted
- Shell prompt wouldn't appear after Ctrl+Z

## Building for Different Systems

### On glibc Systems (Linux, Arch Linux)

```bash
./build-ptctl.sh    # Builds libptctl.so (glibc-linked)
bun run build       # Compiles fgsh
```

### On musl Systems (Alpine, Chimera Linux, etc.)

The glibc binary won't work. You must rebuild natively on the musl system:

```bash
# On Chimera Linux:
gcc -shared -fPIC -o libptctl.so src/ptctl.c
bun run build
```

Or with the build script:
```bash
./build-ptctl.sh    # Automatically detects musl and builds correctly
bun run build
```

## Known Limitations

1. **Requires ptctl library**: Ctrl+Z works best with the FFI bindings. Without them, signal forwarding still works but terminal state management is degraded.

2. **Terminal ownership**: The implementation assumes a single foreground job. Multiple job groups in a pipeline may have edge cases.

3. **Readline state**: The readline interface must be properly paused before giving terminal control to a child, and resumed after restoration.

## Testing

Test Ctrl+Z with various commands:

```bash
# Simple long-running command
sleep 100
# (Press Ctrl+Z)
# [1]+ Stopped    sleep 100

# Resume with fg
fg
# sleep resumes and counts down

# Background job
sleep 100 &
# [1] 12345

# List jobs
jobs

# Bring background job to foreground and suspend
fg %1
# (Press Ctrl+Z)
```

## Debugging

Enable debug output with:

```bash
FGSH_DEBUG=1 ./fgsh
```

This will show:
- SIGTSTP signal receipt
- Process group transfers (tcsetpgrp calls)
- Job suspension/resumption
- Terminal ownership changes

Look for log output like:
```
[DEBUG] SIGTSTP received - suspending foreground jobs
[DEBUG] Child process group: 12345
[DEBUG] Terminal foreground process group: 12345
[DEBUG] Restoring terminal to shell PGID: 12340
```

## Files Modified

- `src/fgshell.js`: Added SIGTSTP handler and enhanced fg command
- Header comment: Updated to reflect SIGTSTP support
