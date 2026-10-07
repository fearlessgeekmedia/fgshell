#include <sys/ioctl.h>
#include <unistd.h>
#include <errno.h>
#include <termios.h>
#include <signal.h>

/**
 * Ignore SIGTTOU the way interactive shells do before touching terminal
 * attributes from a background process group.
 * A *caught* handler (e.g. Node's process.on('SIGTTOU')) is NOT sufficient:
 * with a caught disposition, tcsetpgrp() from the shell's background process
 * group fails with ENOTTY and the terminal stays owned by the dead child's
 * process group, after which tcsetattr() (setRawMode) fails with EIO and the
 * shell dies.  Only SIG_IGN makes the restore succeed.
 * SIGTTIN is left alone so children keep default job-control behaviour
 * (a caught handler is reset to default on exec, an ignored one is not).
 * Returns 0 on success.
 */
int ptctl_ignore_job_signals(void) {
  if (signal(SIGTTOU, SIG_IGN) == SIG_ERR) return -1;
  return 0;
}

/**
 * Enable signal generation (ISIG), canonical mode (ICANON), and echo (ECHO) on the terminal
 * Returns 0 on success, -1 on error
 */
int ptctl_enable_signals(int fd) {
  struct termios t;
  if (tcgetattr(fd, &t) < 0) return -1;
  t.c_lflag |= ISIG;   // Enable signals (Ctrl+C, Ctrl+Z)
  t.c_lflag |= ICANON; // Enable canonical mode
  t.c_lflag |= ECHO;   // Enable echo
  return tcsetattr(fd, TCSANOW, &t);
}

/**
 * Acquire the terminal as the controlling terminal for the session
 * Returns 0 on success, -1 on error
 */
int ptctl_acquire_tty(int fd) {
#ifdef TIOCSCTTY
  return ioctl(fd, TIOCSCTTY, 0);
#else
  return -1;
#endif
}

/**
 * Set the process group associated with the terminal
 * Returns 0 on success, -1 on error
 */
int ptctl_tcsetpgrp(int fd, int pgrp) {
  return tcsetpgrp(fd, pgrp);
}

/**
 * Get the process group associated with the terminal
 * Returns the process group ID on success, -1 on error
 */
int ptctl_tcgetpgrp(int fd) {
  return tcgetpgrp(fd);
}

/**
 * Set process group ID
 * Returns 0 on success, -1 on error
 */
int ptctl_setpgid(int pid, int pgid) {
  return setpgid(pid, pgid);
}

/**
 * Get process group ID
 * Returns the process group ID
 */
int ptctl_getpgrp(void) {
  return getpgrp();
}

/**
 * Get the process group ID of a process
 * Returns the process group ID
 */
int ptctl_getpgid(int pid) {
  return getpgid(pid);
}

/**
 * Create a new session (session leader)
 * Returns the new session ID on success, -1 on error
 */
pid_t ptctl_setsid(void) {
  return setsid();
}

/**
 * Get errno value (needed because FFI can't easily access errno directly)
 */
int ptctl_get_errno(void) {
  return errno;
}
