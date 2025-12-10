import { build } from "bun";
import { renameSync, chmodSync, writeFileSync } from "fs";
import path from "path";

const result = await build({
  entrypoints: ["./src/fgshell.js"],
  outdir: ".",
  target: "bun",
  minify: true,
  compile: true,
});

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
}
