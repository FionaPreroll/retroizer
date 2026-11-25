/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

/*
 * Soak test: drives the built app in headless Chromium for many operations
 * in a row and fails if anything degrades over time.
 *
 *   pnpm soak                          # builds, then 300 operations on dist/
 *   pnpm soak --iterations 2000 --size 1920x1080
 *
 * Checks:
 *   - no page errors or console errors, status never ends in ERROR
 *   - rendering stays in the Web Worker
 *   - the JS heap (after forced GC) does not keep growing
 *   - late operations are not markedly slower than early ones
 */

import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { installSyntheticImage, launchBrowser } from "./browser.ts";
import { serveDirectory } from "./server.ts";

const { values: args } = parseArgs({
    options: {
        root: { type: "string", default: resolve(import.meta.dirname, "../dist") },
        iterations: { type: "string", default: "300" },
        size: { type: "string", default: "1280x720" },
        "max-heap-growth-mb": { type: "string", default: "25" },
        "max-slowdown": { type: "string", default: "2" },
    },
});

const iterations = Number(args.iterations);
const [width = 1280, height = 720] = args.size.split("x").map(Number);
const maxHeapGrowth = Number(args["max-heap-growth-mb"]) * 1024 * 1024;
const maxSlowdown = Number(args["max-slowdown"]);

type Step = "palettize" | "pixelize" | "retroize" | "undo" | "redo" | "reload";

/** Deterministic but varied sequence of user actions. */
function stepFor(i: number): { step: Step; colors: number; pixelSize: number } {
    const steps: Step[] = ["retroize", "palettize", "pixelize", "undo", "redo", "retroize"];
    const step: Step = i % 25 === 24 ? "reload" : (steps[i % steps.length] ?? "retroize");
    const colors = [2, 8, 16, 32, 64, 128, 256][i % 7] ?? 16;
    const pixelSize = [1, 2, 4, 7, 12, 20][i % 6] ?? 4;
    return { step, colors, pixelSize };
}

const server = await serveDirectory(args.root);
const browser = await launchBrowser();
const page = await browser.newPage();
const cdp = await page.context().newCDPSession(page);
const problems: string[] = [];

page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
page.on("console", (message) => {
    // Failed requests are reported with their URL below.
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource")) {
        problems.push(`console error: ${message.text()}`);
    }
});
page.on("response", (response) => {
    if (response.status() >= 400) problems.push(`HTTP ${response.status()}: ${response.url()}`);
});

async function heapAfterGc(): Promise<number> {
    await cdp.send("HeapProfiler.collectGarbage");
    const { usedSize } = await cdp.send("Runtime.getHeapUsage");
    return usedSize;
}

const durations: number[] = [];
const heap: number[] = [];

try {
    await page.goto(`${server.url}index.html`);
    await installSyntheticImage(page);
    await page.evaluate(([w, h]) => window.drawSyntheticImage?.(w, h), [width, height] as const);

    for (let i = 0; i < iterations; i++) {
        const { step, colors, pixelSize } = stepFor(i);
        const elapsed = await page.evaluate(
            async ({ step, colors, pixelSize, w, h }) => {
                const api = (
                    window as unknown as {
                        retroizer: {
                            render(op: string): Promise<void>;
                            undo(): void;
                            redo(): void;
                            setParam(name: string, value: number): void;
                        };
                    }
                ).retroizer;
                const started = performance.now();
                if (step === "undo") api.undo();
                else if (step === "redo") api.redo();
                else if (step === "reload") await window.drawSyntheticImage?.(w, h);
                else {
                    api.setParam("colors", colors);
                    api.setParam("pixelSize", pixelSize);
                    await api.render(step);
                }
                return performance.now() - started;
            },
            { step, colors, pixelSize, w: width, h: height },
        );
        if (step === "retroize") durations.push(elapsed);

        const statusText = (await page.textContent("#statusText")) ?? "";
        if (statusText.startsWith("ERROR")) problems.push(`#${i} ${step}: ${statusText.trim()}`);

        if (i % 25 === 0 || i === iterations - 1) {
            heap.push(await heapAfterGc());
            console.log(`${i + 1}/${iterations}: heap ${((heap.at(-1) ?? 0) / 1e6).toFixed(1)} MB`);
        }
    }

    const usesWorker = await page.evaluate(() =>
        (window as unknown as { retroizer: { usesWorker(): boolean } }).retroizer.usesWorker(),
    );
    if (!usesWorker) {
        problems.push("rendering fell back to the main thread");
    }
} finally {
    await browser.close();
    await server.close();
}

// Heap: compare the end with the state after warm-up (undo history full).
const warm = heap[Math.min(1, heap.length - 1)] ?? 0;
const growth = (heap.at(-1) ?? 0) - warm;
if (growth > maxHeapGrowth) {
    problems.push(`heap grew by ${(growth / 1e6).toFixed(1)} MB after warm-up`);
}

// Latency: median of the last fifth vs. the first fifth of retroize runs.
const fifth = Math.max(1, Math.floor(durations.length / 5));
const median = (values: number[]) =>
    [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
const early = median(durations.slice(0, fifth));
const late = median(durations.slice(-fifth));
if (late > early * maxSlowdown && late - early > 50) {
    problems.push(`retroize slowed down from ${early.toFixed(0)} ms to ${late.toFixed(0)} ms`);
}

console.log(
    JSON.stringify(
        {
            iterations,
            size: `${width}x${height}`,
            retroizeMedianEarlyMs: Math.round(early),
            retroizeMedianLateMs: Math.round(late),
            heapAfterWarmupMB: Number((warm / 1e6).toFixed(1)),
            heapGrowthMB: Number((growth / 1e6).toFixed(1)),
            problems: problems.length,
        },
        null,
        2,
    ),
);

if (problems.length > 0) {
    console.error(`Soak test failed:\n- ${problems.slice(0, 20).join("\n- ")}`);
    process.exit(1);
}
console.log("Soak test passed.");
