// FFI bindings for process group control (tcsetpgrp, setpgid, etc)
const { dlopen, FFIType } = require('bun:ffi');
const path = require('path');

let ptctl = null;
let error = null;

try {
  let libPath = path.join(__dirname, '..', 'libptctl.so');
  // On macOS, also try .dylib
  if (process.platform === 'darwin') {
    const dylib = path.join(__dirname, '..', 'libptctl.dylib');
    try {
      require('fs').accessSync(dylib);
      libPath = dylib;
    } catch {}
  }
  ptctl = dlopen(libPath, {
    ptctl_tcsetpgrp: {
      args: ['i32', 'i32'],
      returns: 'i32',
    },
    ptctl_tcgetpgrp: {
      args: ['i32'],
      returns: 'i32',
    },
    ptctl_setpgid: {
      args: ['i32', 'i32'],
      returns: 'i32',
    },
    ptctl_getpgrp: {
      args: [],
      returns: 'i32',
    },
    ptctl_getpgid: {
      args: ['i32'],
      returns: 'i32',
    },
    ptctl_setsid: {
      args: [],
      returns: 'i32',
    },
    ptctl_get_errno: {
      args: [],
      returns: 'i32',
    },
    ptctl_enable_signals: {
      args: ['i32'],
      returns: 'i32',
    },
    ptctl_acquire_tty: {
      args: ['i32'],
      returns: 'i32',
    },
  });
} catch (e) {
  error = e;
  ptctl = null;
}

module.exports = {
  available: ptctl !== null && error === null,
  error,
  
  /**
   * Acquire the terminal as the controlling terminal for the session
   * @param {number} fd - File descriptor (usually 0 for stdin)
   * @returns {number} 0 on success, -1 on error
   */
  acquire_tty(fd) {
    if (!ptctl) throw new Error('ptctl library not loaded: ' + (error ? error.message : 'unknown error'));
    return ptctl.symbols.ptctl_acquire_tty(fd);
  },

  /**
   * Enable signal generation (ISIG), canonical mode (ICANON), and echo on the terminal
   * @param {number} fd - File descriptor (usually 0 for stdin)
   * @returns {number} 0 on success, -1 on error
   */
  enable_signals(fd) {
    if (!ptctl) throw new Error('ptctl library not loaded: ' + (error ? error.message : 'unknown error'));
    return ptctl.symbols.ptctl_enable_signals(fd);
  },

  /**
   * Set the process group associated with terminal fd
   * @param {number} fd - File descriptor (usually 1 for stdout)
   * @param {number} pgid - Process group ID
   * @returns {number} 0 on success, -1 on error
   */
  tcsetpgrp(fd, pgid) {
    if (!ptctl) throw new Error('ptctl library not loaded: ' + (error ? error.message : 'unknown error'));
    return ptctl.symbols.ptctl_tcsetpgrp(fd, pgid);
  },
  
  /**
   * Get the process group associated with terminal fd
   * @param {number} fd - File descriptor (usually 1 for stdout)
   * @returns {number} Process group ID, or -1 on error
   */
  tcgetpgrp(fd) {
    if (!ptctl) throw new Error('ptctl library not loaded: ' + (error ? error.message : 'unknown error'));
    return ptctl.symbols.ptctl_tcgetpgrp(fd);
  },
  
  /**
   * Set process group ID for a process
   * @param {number} pid - Process ID (0 for current process)
   * @param {number} pgid - Process group ID
   * @returns {number} 0 on success, -1 on error
   */
  setpgid(pid, pgid) {
    if (!ptctl) throw new Error('ptctl library not loaded: ' + (error ? error.message : 'unknown error'));
    return ptctl.symbols.ptctl_setpgid(pid, pgid);
  },
  
  /**
   * Get current process group ID
   * @returns {number} Process group ID
   */
  getpgrp() {
    if (!ptctl) throw new Error('ptctl library not loaded: ' + (error ? error.message : 'unknown error'));
    return ptctl.symbols.ptctl_getpgrp();
  },
  
  /**
   * Get process group ID for a process
   * @param {number} pid - Process ID (0 for current process)
   * @returns {number} Process group ID
   */
  getpgid(pid) {
    if (!ptctl) throw new Error('ptctl library not loaded: ' + (error ? error.message : 'unknown error'));
    return ptctl.symbols.ptctl_getpgid(pid);
  },
  
  /**
   * Create a new session (make this process a session leader)
   * @returns {number} Session ID on success, -1 on error
   */
  setsid() {
    if (!ptctl) throw new Error('ptctl library not loaded: ' + (error ? error.message : 'unknown error'));
    return ptctl.symbols.ptctl_setsid();
  },
  
  /**
   * Get errno value
   * @returns {number} errno
   */
  get_errno() {
    if (!ptctl) return -1;
    return ptctl.symbols.ptctl_get_errno();
  },
};
