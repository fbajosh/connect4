import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig } from "vite";

function emitRouteEntrypoints() {
  let outputDirectory = "";

  return {
    configResolved(config) {
      outputDirectory = resolve(config.root, config.build.outDir);
    },
    name: "emit-route-entrypoints",
    async writeBundle() {
      const indexHtml = await readFile(resolve(outputDirectory, "index.html"), "utf8");

      for (const route of ["training", "freeplay", "practice"]) {
        const routeDirectory = resolve(outputDirectory, route);
        await mkdir(routeDirectory, { recursive: true });
        await writeFile(resolve(routeDirectory, "index.html"), indexHtml, "utf8");
      }

      await writeFile(resolve(outputDirectory, "404.html"), indexHtml, "utf8");
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [emitRouteEntrypoints()],
  root: "src",
  base: command === "build" ? "/connect4/" : "/",
  build: {
    emptyOutDir: true,
    outDir: "../dist",
  },
}));
