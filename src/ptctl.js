// FFI bindings for process group control (tcsetpgrp, setpgid, etc)
const { dlopen, FFIType } = require('bun:ffi');
const path = require('path');

let ptctl = null;
let error = null;

try {
  const libPath = path.join(__dirname, '..', 'libptctl.so');
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
    ptctl_get_errno: {
      args: [],
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
   * Get errno value
   * @returns {number} errno
   */
  get_errno() {
    if (!ptctl) return -1;
    return ptctl.symbols.ptctl_get_errno();
  },
};
