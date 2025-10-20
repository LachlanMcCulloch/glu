import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    typecheck: {
      tsconfig: "./tests/tsconfig.json",
    },
    globals: true,
    environment: "node",
    testTimeout: 30000, // 30 seconds for git operations
    hookTimeout: 30000,
    teardownTimeout: 30000,
    include: ["tests/**/*.test.ts", "src/**/*.test.ts", "src/**/*.int.test.ts"],
    exclude: ["node_modules", "dist", "test-repo"],
    reporters: ["verbose"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["tests/**", "dist/**", "node_modules/**"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@/commands": path.resolve(__dirname, "./src/commands"),
      "@tests": path.resolve(__dirname, "./tests"),
    },
    extensions: [".ts", ".js", ".json"],
  },
  esbuild: {
    target: "node14",
  },
})
