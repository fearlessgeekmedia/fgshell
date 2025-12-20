import { build } from "bun";
import { renameSync, chmodSync, writeFileSync, readFileSync, unlinkSync } from "fs";
import path from "path";

// Read version from package.json
const packageData = JSON.parse(readFileSync('./package.json', 'utf8'));
const version = packageData.version;

// Create a temporary file with the version injected directly
let srcCode = readFileSync('./src/fgshell.js', 'utf8');
// Replace the INJECTED_VERSION constant with the actual version
srcCode = srcCode.replace(
  /let VERSION;\s*try\s*\{\s*VERSION\s*=\s*INJECTED_VERSION;/,
  `let VERSION;\ntry {\n  VERSION = "${version}";`
);
writeFileSync('./src/fgshell.js.tmp', srcCode);
console.log("Temp file created with version:", version);

const result = await build({
  entrypoints: ["./src/fgshell.js.tmp"],
  outdir: ".",
  target: "bun",
  minify: false,
  compile: true,
});

console.log("Build logs:", result.logs);

const compiledBinaryName = result.outputs[0]?.path;
if (!compiledBinaryName) {
  console.error("No output file generated");
  process.exit(1);
}

const finalBinaryName = "fgsh";

try {
  renameSync(compiledBinaryName, finalBinaryName);
  chmodSync(finalBinaryName, 0o755);
  console.log(`✓ Built ${finalBinaryName} successfully`);
} catch (e) {
  console.error(`Failed to rename or chmod ${compiledBinaryName}:`, e.message);
  process.exit(1);
} finally {
  // Clean up temporary file
  try {
    unlinkSync('./src/fgshell.js.tmp');
  } catch (e) {
    // Ignore cleanup errors
  }
}
