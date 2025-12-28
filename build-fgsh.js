import { spawnSync } from "child_process";
import { chmodSync } from "fs";

// Use bun CLI to compile the source directly
const result = spawnSync('bun', [
  'build',
  '--compile',
  './src/fgshell.js',
  '--outfile',
  'fgsh'
], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe']
});

if (result.error) {
  console.error('Build failed:', result.error.message);
  process.exit(1);
}

const stdout = result.stdout?.toString();
const stderr = result.stderr?.toString();

if (stdout) console.log(stdout);
if (stderr && result.status !== 0) console.error(stderr);

if (result.status !== 0) {
  console.error(`Build failed with status ${result.status}`);
  process.exit(1);
}

try {
  chmodSync('fgsh', 0o755);
  console.log(`✓ Built fgsh successfully`);
} catch (e) {
  console.error(`Failed to chmod fgsh:`, e.message);
  process.exit(1);
}
