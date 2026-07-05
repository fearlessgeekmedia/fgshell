const fs = require('fs');
const path = require('path');
const SHELL = { env: process.env };

function resolveExecutable(cmd) {
  // If absolute or relative path, test it
  if (cmd.startsWith('/') || cmd.startsWith('./') || cmd.startsWith('../')) {
    try {
      fs.accessSync(cmd, fs.constants.X_OK);
      return cmd;
    } catch (e) {
      return null;
    }
  }
  // search PATH
  const PATH = (SHELL.env.PATH || process.env.PATH || '/usr/bin:/bin').split(':');
  for (const p of PATH) {
    const full = path.join(p, cmd);
    try {
      fs.accessSync(full, fs.constants.X_OK);
      return full;
    } catch (e) {}
  }
  return null;
}

console.log('ls:', resolveExecutable('ls'));
console.log('img2sixel:', resolveExecutable('img2sixel'));