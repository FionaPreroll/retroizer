/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

/*
 * Showcase screenshots of the built app, written to dist/showcase/ so they
 * are deployed with GitHub Pages (CI) instead of being committed.
 *
 *   pnpm showcase              # builds, then screenshots dist/
 *   pnpm showcase --out <dir>  # somewhere else
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { Browser, Page } from "playwright";
import { launchBrowser } from "./browser.ts";
import { drawDemoScene } from "./demo-scene.ts";
import { serveDirectory } from "./server.ts";

const { values: args } = parseArgs({
    options: {
        root: { type: "string", default: resolve(import.meta.dirname, "../dist") },
        out: { type: "string" },
    },
});
const out = args.out ?? join(args.root, "showcase");

type Theme = "phosphor" | "amber" | "cyan";

interface Shot {
    readonly file: string;
    readonly title: string;
    readonly theme: Theme;
    readonly viewport: { width: number; height: number };
    readonly mobile?: boolean;
    readonly colors: number;
    readonly pixelSize: number;
    readonly about?: boolean;
    /** Show the original instead of the retro result. */
    readonly original?: boolean;
}

const DESKTOP = { width: 1440, height: 1000 };
const PHONE = { width: 390, height: 844 };

const SHOTS: readonly Shot[] = [
    {
        file: "desktop-phosphor.png",
        title: "Desktop, Phosphor theme",
        theme: "phosphor",
        viewport: DESKTOP,
        colors: 16,
        pixelSize: 4,
    },
    {
        file: "desktop-original.png",
        title: "Desktop, original for comparison",
        theme: "phosphor",
        viewport: DESKTOP,
        colors: 16,
        pixelSize: 4,
        original: true,
    },
    {
        file: "desktop-amber.png",
        title: "Desktop, Amber theme",
        theme: "amber",
        viewport: DESKTOP,
        colors: 8,
        pixelSize: 6,
    },
    {
        file: "desktop-cyan.png",
        title: "Desktop, Cyan theme",
        theme: "cyan",
        viewport: DESKTOP,
        colors: 32,
        pixelSize: 3,
    },
    {
        file: "phone.png",
        title: "Phone",
        theme: "phosphor",
        viewport: PHONE,
        mobile: true,
        colors: 16,
        pixelSize: 5,
    },
    {
        file: "about.png",
        title: "About dialog",
        theme: "cyan",
        viewport: DESKTOP,
        colors: 16,
        pixelSize: 4,
        about: true,
    },
];

async function capture(browser: Browser, url: string, shot: Shot): Promise<void> {
    const context = await browser.newContext({
        viewport: shot.viewport,
        deviceScaleFactor: 2,
        ...(shot.mobile ? { isMobile: true, hasTouch: true } : {}),
    });
    await context.addInitScript((theme) => {
        localStorage.setItem("retroizer.theme", theme);
    }, shot.theme);
    const page: Page = await context.newPage();
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));

    await page.goto(url);
    await page.evaluate("document.fonts.ready");
    await page.evaluate(`
        (async () => {
            const canvas = document.getElementById("canvas");
            canvas.width = 960;
            canvas.height = 600;
            (${drawDemoScene.toString()})(canvas.getContext("2d"), 960, 600);
            await window.retroizer.adoptCanvas();
        })()
    `);
    await page.evaluate(
        async ({ colors, pixelSize }) => {
            const api = (
                window as unknown as {
                    retroizer: {
                        setParam(name: string, value: number): void;
                        render(operation: string): Promise<void>;
                    };
                }
            ).retroizer;
            api.setParam("colors", colors);
            api.setParam("pixelSize", pixelSize);
            await api.render("retroize");
        },
        { colors: shot.colors, pixelSize: shot.pixelSize },
    );
    if (shot.original) await page.click("#showOriginal");
    if (shot.about) await page.click("#aboutButton");
    await page.waitForTimeout(400); // let progress and palette transitions settle

    await page.screenshot({ path: join(out, shot.file) });
    await context.close();
    if (errors.length > 0) throw new Error(`${shot.file}: ${errors.join("; ")}`);
}

await mkdir(out, { recursive: true });
const server = await serveDirectory(args.root);
const browser = await launchBrowser();
try {
    for (const shot of SHOTS) {
        await capture(browser, `${server.url}index.html`, shot);
        console.log(`✓ ${shot.file}`);
    }
} finally {
    await browser.close();
    await server.close();
}

await writeFile(
    join(out, "index.json"),
    JSON.stringify(
        SHOTS.map(({ file, title }) => ({ file, title })),
        null,
        2,
    ),
);
console.log(`Showcase written to ${out}`);
