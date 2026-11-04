import { defineConfig } from "vite";
import { resolve } from "node:path";
export default defineConfig({
  build: {
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
});
