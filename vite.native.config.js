import { defineConfig } from "vite";
export default defineConfig({
  configFile: false,
  build: {
    outDir: "www/assets",
    emptyOutDir: false,
    minify: true,
    rollupOptions: {
      input: "native-entry.js",
      output: {
        entryFileNames: "native-entry.js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]"
      }
    }
  }
});
