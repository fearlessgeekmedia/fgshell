import { spawnSync } from "child_process";
import { chmodSync, existsSync, statSync } from "fs";
import { execSync } from "child_process";

// Detect libc type (glibc or musl)
function detectLibc() {
  try {
    const output = execSync('ldd /bin/ls 2>&1 || file /bin/ls', { encoding: 'utf-8' });
    if (output.includes('musl')) {
      return 'musl';
    }
    return 'glibc';
  } catch (e) {
    console.warn('Could not detect libc, assuming glibc');
    return 'glibc';
  }
}

// Check if ptctl needs to be built
function needsBuildPtctl() {
  // Build if libptctl.so doesn't exist
  if (!existsSync('libptctl.so')) {
    return true;
  }
  
  // Also rebuild if src/ptctl.c is newer than libptctl.so
  try {
    const ptctlStat = statSync('libptctl.so');
    const srcStat = statSync('src/ptctl.c');
    return srcStat.mtime > ptctlStat.mtime;
  } catch (e) {
    return true;
  }
}

// Build ptctl.so if needed
function buildPtctl() {
  const libc = detectLibc();
  console.log(`Detected libc: ${libc}`);
  
  // Determine output filename based on platform
  const libName = process.platform === 'darwin' ? 'libptctl.dylib' : 'libptctl.so';
  
  if (!needsBuildPtctl()) {
    console.log(`✓ ${libName} is up to date`);
    return true;
  }
  
  console.log(`Building ${libName}...`);
  
  const result = spawnSync('gcc', [
    '-shared',
    '-fPIC',
    '-o', libName,
    'src/ptctl.c'
  ], {
    cwd: process.cwd(),
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  if (result.error || result.status !== 0) {
    const stderr = result.stderr?.toString();
    if (stderr) console.error(stderr);
    console.error(`Failed to build ${libName}. Make sure gcc is installed.`);
    return false;
  }
  
  try {
    chmodSync(libName, 0o755);
    console.log(`✓ Built ${libName} successfully`);
    return true;
  } catch (e) {
    console.error(`Failed to chmod ${libName}:`, e.message);
    return false;
  }
}

// Build ptctl first if needed
if (!buildPtctl()) {
  console.error('Aborting fgsh build due to ptctl build failure');
  process.exit(1);
}

// Use bun CLI to compile fgsh
console.log('Building fgsh...');
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
