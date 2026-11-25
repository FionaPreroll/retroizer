import { defineConfig } from "vitest/config";

export default defineConfig({
    // Relative asset paths, so the build works on GitHub Pages under /<repo>/.
    base: "./",
    build: {
        target: "es2023",
    },
    worker: {
        format: "es",
    },
    test: {
        include: ["test/**/*.test.ts"],
        coverage: {
            include: ["src/core/**", "src/ui/history.ts"],
        },
    },
});
