const os = require('os');

const SHELL = {
  cwd: process.cwd(),
  env: Object.assign({}, process.env),
  jobs: [], // {id, pids: [], cmdline, status: 'running'|'stopped'|'done'}
  nextJobId: 1,
  lastExitCode: 0,
  history: [],
  aliases: {},
};

// Ensure critical environment variables for login shells
// This fixes issues with sudo and other tools that check for a valid terminal environment
if (process.stdin.isTTY && process.stdout.isTTY) {
  // Set TERM if not already set (needed by sudo, less, and other TUI apps)
  if (!SHELL.env.TERM) {
    SHELL.env.TERM = 'xterm-256color';
  }
}

module.exports = SHELL;
