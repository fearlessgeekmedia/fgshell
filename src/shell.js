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
  const home = os.homedir();
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
