import { describe, expect, it } from "vitest";
import { applyPalette, buildHistogram, kMeans, nearestColorIndex } from "../src/core/quantize.ts";
import type { Palette } from "../src/core/types.ts";
import { bruteForceMap, randomImage, rgba } from "./helpers/images.ts";

describe("buildHistogram", () => {
    it("keeps exact mean colours and pixel counts per bin", () => {
        const data = rgba([
            [10, 20, 30],
            [12, 22, 30],
            [200, 100, 50],
        ]);
        const { points, weights, size } = buildHistogram(data);
        expect(size).toBe(2);
        expect([...weights].sort()).toEqual([1, 2]);
        const twoPixelBin = weights[0] === 2 ? 0 : 1;
        expect([...points.subarray(twoPixelBin * 3, twoPixelBin * 3 + 3)]).toEqual([11, 21, 30]);
    });

    it("ignores fully transparent pixels", () => {
        const data = new Uint8ClampedArray([255, 0, 0, 0, 0, 255, 0, 255]);
        const { points, size } = buildHistogram(data);
        expect(size).toBe(1);
        expect([...points]).toEqual([0, 255, 0]);
    });
});

describe("kMeans", () => {
    it("finds well separated clusters", () => {
        const colors: [number, number, number][] = [];
        for (let i = 0; i < 50; i++) colors.push([250 - (i % 3), 5, 5], [5, 5, 250 - (i % 3)]);
        const palette = [...kMeans(buildHistogram(rgba(colors)), 2)].sort((a, b) => a[0] - b[0]);
        expect(palette).toHaveLength(2);
        expect(palette[0]![2]).toBeGreaterThan(240);
        expect(palette[1]![0]).toBeGreaterThan(240);
    });

    it("returns every colour when there are fewer colours than k", () => {
        const palette = kMeans(
            buildHistogram(
                rgba([
                    [1, 2, 3],
                    [200, 200, 200],
                ]),
            ),
            16,
        );
        expect(palette).toHaveLength(2);
    });

    it("is deterministic", () => {
        const histogram = buildHistogram(randomImage(20000));
        expect(kMeans(histogram, 16)).toEqual(kMeans(histogram, 16));
    });

    it("returns k distinct colours for rich images", () => {
        const palette = kMeans(buildHistogram(randomImage(20000)), 32);
        expect(palette).toHaveLength(32);
        expect(new Set(palette.map(String)).size).toBe(32);
    });

    it("reports progress per iteration", () => {
        const seen: [number, number, number][] = [];
        kMeans(buildHistogram(randomImage(5000)), 8, {
            maxIterations: 5,
            onIteration: (iteration, max, preview) => seen.push([iteration, max, preview.length]),
        });
        expect(seen.length).toBeGreaterThan(0);
        expect(seen.at(-1)?.[1]).toBe(5);
        expect(seen.every(([, , n]) => n <= 8)).toBe(true);
    });

    it("handles an empty image", () => {
        expect(kMeans(buildHistogram(new Uint8ClampedArray(0)), 16)).toEqual([]);
    });
});

describe("applyPalette", () => {
    it("matches a brute-force nearest colour search exactly", () => {
        const data = randomImage(30000);
        const palette = kMeans(buildHistogram(data), 24);
        const expected = bruteForceMap(data, palette);
        applyPalette(data, palette);
        expect(data).toEqual(expected);
    });

    it("leaves alpha untouched", () => {
        const data = new Uint8ClampedArray([10, 10, 10, 77]);
        applyPalette(data, [[0, 0, 0]]);
        expect([...data]).toEqual([0, 0, 0, 77]);
    });

    it("does nothing for an empty palette", () => {
        const data = new Uint8ClampedArray([10, 20, 30, 255]);
        applyPalette(data, [] satisfies Palette);
        expect([...data]).toEqual([10, 20, 30, 255]);
    });

    it("prefers the earlier palette entry on ties", () => {
        expect(nearestColorIndex(5, 5, 5, [0, 0, 0, 10, 10, 10])).toBe(0);
    });
});
