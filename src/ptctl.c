#include <sys/ioctl.h>
#include <unistd.h>
#include <errno.h>

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
 * Get errno value (needed because FFI can't easily access errno directly)
 */
int ptctl_get_errno(void) {
  return errno;
}
