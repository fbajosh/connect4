import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src",
  build: {
    emptyOutDir: true,
    outDir: "../dist",
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), "src/index.html"),
        legacy: resolve(process.cwd(), "src/legacy/index.html"),
      },
    },
  },
});
