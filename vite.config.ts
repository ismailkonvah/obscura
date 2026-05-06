import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const browserCryptoShim = fileURLToPath(new URL("./src/lib/browserCryptoShim.ts", import.meta.url));
const browserFsShim = fileURLToPath(new URL("./src/lib/browserFsShim.ts", import.meta.url));
const bufferShim = fileURLToPath(new URL("./node_modules/buffer/index.js", import.meta.url));
const srcDir = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [tanstackStart(), nitro(), react(), tsconfigPaths(), tailwindcss()],
  resolve: {
    alias: {
      "@": srcDir,
      ...(isSsrBuild
        ? {}
        : {
            crypto: browserCryptoShim,
            fs: browserFsShim,
            buffer: bufferShim,
            "buffer/": bufferShim,
            "node:buffer": bufferShim,
          }),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 8080,
    strictPort: true,
  },
  preview: {
    host: "127.0.0.1",
    port: 8080,
    strictPort: true,
  },
}));
