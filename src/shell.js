const os = require('os');
const fs = require('fs');
const path = require('path');

let initialCwd = process.cwd();

// Check if the initial working directory is accessible
// If not, fall back to home directory or /tmp
try {
  fs.accessSync(initialCwd);
} catch (e) {
  // Can't access current directory, try home
  // Use environment variables first to avoid spawning hostname
  const home = process.env.HOME || process.env.USERPROFILE || '/tmp';
  try {
    fs.accessSync(home);
    initialCwd = home;
  } catch (e2) {
    // Can't access home either, try /tmp
    try {
      fs.accessSync('/tmp');
      initialCwd = '/tmp';
    } catch (e3) {
      // Give up and use root
      initialCwd = '/';
    }
  }
}

const SHELL = {
  cwd: initialCwd,
  env: Object.assign({}, process.env),
  jobs: [], // {id, pids: [], cmdline, status: 'running'|'stopped'|'done'}
  nextJobId: 1,
  lastExitCode: 0,
  history: [],
  aliases: {},
};

// Ensure HOME is set - look it up from /etc/passwd if needed
if (!SHELL.env.HOME) {
  let username = SHELL.env.USER || SHELL.env.LOGNAME;
  
  // If username not in env, try to get it from current uid
  if (!username) {
    try {
      const uid = process.getuid();
      const passwdContent = fs.readFileSync('/etc/passwd', 'utf8');
      const lines = passwdContent.split('\n');
      for (const line of lines) {
        const parts = line.split(':');
        if (parseInt(parts[2]) === uid) {
          username = parts[0];
          break;
        }
      }
    } catch (e) {
      // Ignore
    }
  }
  
  if (username) {
    try {
      const passwdContent = fs.readFileSync('/etc/passwd', 'utf8');
      const lines = passwdContent.split('\n');
      for (const line of lines) {
        const parts = line.split(':');
        if (parts[0] === username) {
          SHELL.env.HOME = parts[5]; // 6th field is home directory
          break;
        }
      }
    } catch (e) {
      // Fall back to /tmp if passwd lookup fails
    }
  }
  // Final fallback if still not set
  if (!SHELL.env.HOME) {
    SHELL.env.HOME = '/tmp';
  }
}

// Ensure PATH is set - use sensible default if missing
if (!SHELL.env.PATH || SHELL.env.PATH.trim() === '') {
  SHELL.env.PATH = '/run/wrappers/bin:/run/current-system/sw/bin:/nix/var/nix/profiles/default/bin:/nix/profile/bin:/usr/local/bin:/usr/bin:/bin';
}

// Ensure critical environment variables for login shells
// This fixes issues with sudo and other tools that check for a valid terminal environment
if (process.stdin.isTTY && process.stdout.isTTY) {
  // Set TERM if not already set (needed by sudo, less, and other TUI apps)
  if (!SHELL.env.TERM) {
    SHELL.env.TERM = 'xterm-256color';
  }
}

module.exports = SHELL;
