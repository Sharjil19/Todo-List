import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  cacheDir: join(tmpdir(), "todo-list-vite-cache"),
  envDir: "..",
  plugins: [react()],
});
