/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

/*
 * End-to-end benchmark in headless Chromium.
 *
 *   pnpm bench                                   # builds, then measures dist/
 *   pnpm bench --root ../old-checkout            # any other version, also the pre-2.0 one
 *   pnpm bench --sizes 640x427,1920x1080 --colors 16 --pixel-size 4 --runs 3 --json
 *   pnpm bench --markdown "$GITHUB_STEP_SUMMARY"
 *
 * For each size the same synthetic photo-like image is drawn and measured:
 *   retroizeMs     time from starting "Retroize" until the final image is on the canvas
 *   longestTaskMs  longest main-thread task meanwhile (how long the page froze)
 *   psnrDb         quality of the palettized image vs. the original (higher is better)
 */

import { appendFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { installSyntheticImage, launchBrowser } from "../e2e/browser.ts";
import { serveDirectory } from "../e2e/server.ts";

const { values: args } = parseArgs({
    options: {
        root: { type: "string", default: resolve(import.meta.dirname, "../dist") },
        sizes: { type: "string", default: "320x240,640x427,1280x720,1920x1080" },
        colors: { type: "string", default: "16" },
        "pixel-size": { type: "string", default: "4" },
        runs: { type: "string", default: "3" },
        json: { type: "boolean", default: false },
        /** Append a Markdown table to this file (e.g. $GITHUB_STEP_SUMMARY). */
        markdown: { type: "string" },
    },
});

const sizes = args.sizes.split(",").map((size) => {
    const [width = NaN, height = NaN] = size.split("x").map(Number);
    return { width, height };
});
const params = { colors: Number(args.colors), pixelSize: Number(args["pixel-size"]) };
const runs = Number(args.runs);

type Mode = "retroize" | "palettize";
interface Sample {
    elapsed: number;
    longestTask: number;
    psnr: number | null;
}

/* Runs inside the page. Works with the current version (window.retroizer)
 * and with the original single-script version (global functions). */
async function measure(input: {
    width: number;
    height: number;
    colors: number;
    pixelSize: number;
    mode: Mode;
}): Promise<Sample> {
    const { width, height, colors, pixelSize, mode } = input;
    const page = window as unknown as {
        retroizer?: { render(operation: Mode): Promise<void> };
        drawSyntheticImage(width: number, height: number): Promise<void>;
        palettizeImage?: () => Promise<void>;
        pixelizeImage?: () => Promise<void>;
    };
    const canvas = document.getElementById("canvas") as HTMLCanvasElement;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no 2D context");
    const progress = document.getElementById("renderProgress") as HTMLProgressElement;

    await page.drawSyntheticImage(width, height);
    const original = ctx.getImageData(0, 0, width, height).data;
    for (const [id, value] of [
        ["colors", colors],
        ["pixelSize", pixelSize],
    ] as const) {
        (document.getElementById(id) as HTMLInputElement).value = String(value);
        (document.getElementById(`${id}Input`) as HTMLInputElement).value = String(value);
    }

    const waitFor = (predicate: () => boolean) =>
        new Promise<void>((done) => {
            const check = () => {
                if (predicate()) done();
                else setTimeout(check, 2);
            };
            check();
        });

    const run = async () => {
        if (page.retroizer) {
            await page.retroizer.render(mode);
            return;
        }
        // Original version: Retroize did not wait for pixelize to finish.
        await page.palettizeImage?.();
        if (mode === "retroize") {
            progress.value = 0;
            await page.pixelizeImage?.();
            await waitFor(() => progress.value >= 100);
        }
    };

    let longestTask = 0;
    const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) longestTask = Math.max(longestTask, entry.duration);
    });
    observer.observe({ type: "longtask" });

    const started = performance.now();
    await run();
    const elapsed = performance.now() - started;
    await new Promise((done) => setTimeout(done, 50));
    observer.disconnect();

    let psnr: number | null = null;
    if (mode === "palettize") {
        const result = ctx.getImageData(0, 0, width, height).data;
        let squaredError = 0;
        for (let i = 0; i < result.length; i += 4) {
            for (let c = 0; c < 3; c++) {
                const d = (result[i + c] ?? 0) - (original[i + c] ?? 0);
                squaredError += d * d;
            }
        }
        const mse = squaredError / ((result.length / 4) * 3);
        psnr = 10 * Math.log10((255 * 255) / mse);
    }
    return { elapsed, longestTask, psnr };
}

const median = (values: number[]): number => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)] ?? NaN;
};

const server = await serveDirectory(args.root);
const browser = await launchBrowser();

const results = [];
try {
    for (const { width, height } of sizes) {
        const samples: Sample[] = [];
        let psnr: number | null = null;
        for (let run = 0; run < runs; run++) {
            const page = await browser.newPage();
            page.on("pageerror", (error) => {
                console.error("page error:", error.message);
            });
            const modes: Mode[] = run === 0 ? ["palettize", "retroize"] : ["retroize"];
            for (const mode of modes) {
                await page.goto(`${server.url}index.html`);
                await installSyntheticImage(page);
                const sample = await page.evaluate(measure, { width, height, ...params, mode });
                if (mode === "palettize") psnr = sample.psnr;
                else samples.push(sample);
            }
            await page.close();
        }
        const row = {
            size: `${width}x${height}`,
            retroizeMs: Math.round(median(samples.map((s) => s.elapsed))),
            longestTaskMs: Math.round(median(samples.map((s) => s.longestTask))),
            psnrDb: psnr === null ? null : Number(psnr.toFixed(2)),
        };
        results.push(row);
        if (!args.json) console.log(row);
    }
} finally {
    await browser.close();
    await server.close();
}

if (args.json) console.log(JSON.stringify({ params, runs, results }, null, 2));
else console.table(results);

if (args.markdown) {
    const lines = [
        `### Benchmark (${params.colors} colours, pixel size ${params.pixelSize}, median of ${runs})`,
        "",
        "| Size | Retroize (ms) | Longest main-thread task (ms) | PSNR (dB) |",
        "| --- | --- | --- | --- |",
        ...results.map(
            (r) => `| ${r.size} | ${r.retroizeMs} | ${r.longestTaskMs} | ${r.psnrDb ?? "–"} |`,
        ),
        "",
    ];
    await appendFile(args.markdown, lines.join("\n"));
}
