import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripTypeScriptTypes } from "node:module";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(rootDir, "..");
const sourceDir = path.join(projectDir, "src");
const outputDir = path.join(projectDir, "dist");

await rm(outputDir, { force: true, recursive: true });
await buildDirectory(sourceDir, outputDir);

async function buildDirectory(inputDir, targetDir) {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(inputDir);

  for (const entry of entries) {
    const sourcePath = path.join(inputDir, entry);
    const outputPath = path.join(targetDir, entry);
    const metadata = await stat(sourcePath);

    if (metadata.isDirectory()) {
      await buildDirectory(sourcePath, outputPath);
      continue;
    }

    if (sourcePath.endsWith(".ts")) {
      const source = await readFile(sourcePath, "utf8");
      const transformed = stripTypeScriptTypes(source, { mode: "transform" });
      await writeFile(outputPath.replace(/\.ts$/, ".js"), transformed);
      continue;
    }

    const raw = await readFile(sourcePath);
    await writeFile(outputPath, raw);
  }
}
