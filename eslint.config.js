import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
    { ignores: ["dist/", "coverage/", "node_modules/"] },
    js.configs.recommended,
    ...tseslint.configs.strictTypeChecked,
    ...tseslint.configs.stylisticTypeChecked,
    {
        languageOptions: {
            parserOptions: {
                project: ["./tsconfig.json", "./tsconfig.worker.json", "./tsconfig.node.json"],
                tsconfigRootDir: import.meta.dirname,
            },
        },
        rules: {
            eqeqeq: "error",
            "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
        },
    },
    {
        files: ["src/**"],
        languageOptions: { globals: globals.browser },
    },
    {
        // Hot pixel loops index typed arrays with checked bounds; with
        // noUncheckedIndexedAccess that needs `!`, which is fine there.
        files: ["src/core/**", "test/**"],
        rules: { "@typescript-eslint/no-non-null-assertion": "off" },
    },
    {
        files: ["test/**", "bench/**", "e2e/**", "*.config.*"],
        languageOptions: { globals: { ...globals.node, ...globals.browser } },
    },
    {
        files: ["eslint.config.js"],
        extends: [tseslint.configs.disableTypeChecked],
    },
);
