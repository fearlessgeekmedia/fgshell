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

module.exports = SHELL;
