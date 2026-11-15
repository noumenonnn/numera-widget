import { build, defineConfig } from "vite";
import { resolve } from "node:path";
import { readFile, writeFile } from "node:fs/promises";
import { manifestForTarget } from "./scripts/extension-manifest.ts";
export default defineConfig(({ mode }) => {
  const target = mode === "chrome" ? "chrome" : "firefox";
  const outDir = target === "chrome" ? "dist-chrome" : "dist";
  return {
    plugins: [
      {
        name: "extension-manifest",
        async writeBundle() {
          const source = JSON.parse(
            await readFile("public/manifest.json", "utf8"),
          );
          await writeFile(
            resolve(outDir, "manifest.json"),
            JSON.stringify(manifestForTarget(source, target), null, 2) + "\n",
          );
          // Manifest content scripts are classic scripts: bundle separately to avoid
          // shared ESM imports from the popup/background entries.
          await build({
            configFile: false,
            publicDir: false,
            build: {
              outDir,
              emptyOutDir: false,
              target: target === "chrome" ? "chrome120" : "firefox140",
              lib: {
                entry: resolve("src/selection-tooltip.ts"),
                name: "NumeraSelection",
                formats: ["iife"],
                fileName: () => "selection.js",
              },
            },
          });
        },
      },
    ],
    build: {
      outDir,
      target: target === "chrome" ? "chrome120" : "firefox140",
      rolldownOptions: {
        onwarn(warning) {
          // This extension has only client entries; these exact React directives are expected.
          if (
            warning.code === "MODULE_LEVEL_DIRECTIVE" &&
            warning.message.includes('"use client"') &&
            /node_modules[\\/]framer-motion[\\/]dist[\\/]es[\\/]/.test(
              warning.message,
            )
          )
            return;
          throw new Error(`Unexpected build warning: ${warning.message}`);
        },
        input: {
          popup: resolve("popup.html"),
          background: resolve("src/background.ts"),
        },
        output: {
          entryFileNames: "[name].js",
          chunkFileNames: "chunks/[name]-[hash].js",
        },
      },
    },
  };
});
