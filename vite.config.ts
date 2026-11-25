import { defineConfig } from "vitest/config";
import { collectBuildInfo } from "./build/build-info.ts";
import { collectThirdParty, licenseTexts, thirdPartyLicensesPlugin } from "./build/third-party.ts";

export default defineConfig({
    // Relative asset paths, so the build works on GitHub Pages under /<repo>/.
    base: "./",
    define: {
        __BUILD_INFO__: JSON.stringify(collectBuildInfo()),
        __THIRD_PARTY__: JSON.stringify(collectThirdParty()),
    },
    plugins: [
        thirdPartyLicensesPlugin(),
        {
            name: "retroizer-dev-licenses",
            apply: "serve",
            configureServer(server) {
                server.middlewares.use("/third-party-licenses.txt", (_request, response) => {
                    response.setHeader("Content-Type", "text/plain; charset=utf-8");
                    response.end(licenseTexts());
                });
            },
        },
    ],
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
