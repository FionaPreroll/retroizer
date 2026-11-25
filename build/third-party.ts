/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

/*
 * Third-party material that ends up in (or is used by) the built app.
 * Versions and licence ids are read from node_modules at build time, and the
 * full licence texts are emitted as third-party-licenses.txt next to the app.
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { Plugin } from "vite";
import type { ThirdPartyEntry } from "../src/build-info.ts";

interface Source {
    readonly name: string;
    readonly purpose: string;
    readonly url: string;
    /** npm package that ships it; absent for material loaded at runtime. */
    readonly package?: string;
    readonly license?: string;
    readonly licenseText?: string;
}

const SOURCES: readonly Source[] = [
    {
        name: "Press Start 2P",
        package: "@fontsource/press-start-2p",
        purpose: "Pixel font of the status display, readouts and wordmark (self-hosted).",
        url: "https://fonts.google.com/specimen/Press+Start+2P",
    },
    {
        name: "IBM Plex Mono",
        package: "@fontsource/ibm-plex-mono",
        purpose: "Interface font for labels, buttons and text (self-hosted).",
        url: "https://github.com/IBM/plex",
    },
    {
        name: "Sample cat photo by Cassidy James Blaede",
        license: "Unsplash License",
        purpose: "Loaded from Unsplash only when you press “Sample image”.",
        url: "https://unsplash.com/photos/TA22tc6YyMw",
        licenseText: "Unsplash License: https://unsplash.com/license",
    },
];

const require = createRequire(import.meta.url);

function packageDir(name: string): string {
    return dirname(require.resolve(`${name}/package.json`));
}

export function collectThirdParty(): ThirdPartyEntry[] {
    return SOURCES.map((source) => {
        if (!source.package) {
            return {
                name: source.name,
                version: null,
                license: source.license ?? "see source",
                purpose: source.purpose,
                url: source.url,
            };
        }
        const pkg = JSON.parse(
            readFileSync(join(packageDir(source.package), "package.json"), "utf8"),
        ) as {
            version: string;
            license: string;
        };
        return {
            name: source.name,
            version: pkg.version,
            license: pkg.license,
            purpose: source.purpose,
            url: source.url,
        };
    });
}

/** Full licence texts of everything in {@link collectThirdParty}. */
export function licenseTexts(): string {
    const sections = SOURCES.map((source) => {
        const text = source.package
            ? readFileSync(join(packageDir(source.package), "LICENSE"), "utf8")
            : (source.licenseText ?? "");
        return `${"=".repeat(72)}\n${source.name}\n${source.url}\n${"=".repeat(72)}\n\n${text.trim()}\n`;
    });
    return `Third-party licences for Retroizer\n\nRetroizer itself is licensed under GPL-3.0-only.\n\n${sections.join("\n")}`;
}

/** Emit third-party-licenses.txt into the build output. */
export function thirdPartyLicensesPlugin(): Plugin {
    return {
        name: "retroizer-third-party-licenses",
        apply: "build",
        generateBundle() {
            this.emitFile({
                type: "asset",
                fileName: "third-party-licenses.txt",
                source: licenseTexts(),
            });
        },
    };
}
