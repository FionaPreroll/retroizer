import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { runOperation } from "../../src/core/pipeline.ts";
import { pixelize } from "../../src/core/pixelize.ts";
import { applyPalette, buildHistogram, generatePalette, kMeans } from "../../src/core/quantize.ts";
import { bruteForceMap, colorKeys, keyOf } from "../helpers/images.ts";
import { colorsArbitrary, fuzzParams, imageArbitrary, pixelSizeArbitrary } from "./arbitraries.ts";

const opaqueKeys = (data: Uint8ClampedArray): Set<number> => {
    const keys = new Set<number>();
    for (let i = 0; i < data.length; i += 4) {
        if (data[i + 3] !== 0) keys.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
    }
    return keys;
};

describe("fuzz: quantisation", () => {
    it("generatePalette returns at most k distinct, valid colours", () => {
        fc.assert(
            fc.property(imageArbitrary, colorsArbitrary, ({ data }, k) => {
                const palette = generatePalette(data, k);
                expect(palette.length).toBeLessThanOrEqual(k);
                expect(new Set(palette.map(keyOf)).size).toBe(palette.length);
                for (const color of palette) {
                    for (const channel of color) {
                        expect(Number.isInteger(channel)).toBe(true);
                        expect(channel).toBeGreaterThanOrEqual(0);
                        expect(channel).toBeLessThanOrEqual(255);
                    }
                }
                // Every visible image yields a palette; with few colours it is exact.
                // (Regression: the histogram merged distinct colours of one bin.)
                const visible = opaqueKeys(data);
                if (visible.size > 0) expect(palette.length).toBeGreaterThan(0);
                if (visible.size <= k) {
                    expect(new Set(palette.map(keyOf))).toEqual(visible);
                }
            }),
            fuzzParams,
        );
    });

    it("histogram kMeans alone stays within k valid colours", () => {
        fc.assert(
            fc.property(imageArbitrary, colorsArbitrary, ({ data }, k) => {
                const palette = kMeans(buildHistogram(data), k);
                expect(palette.length).toBeLessThanOrEqual(k);
                expect(new Set(palette.map(keyOf)).size).toBe(palette.length);
            }),
            fuzzParams,
        );
    });

    it("applyPalette equals brute force and keeps alpha", () => {
        fc.assert(
            fc.property(imageArbitrary, colorsArbitrary, ({ data }, k) => {
                const palette = generatePalette(data, k);
                if (palette.length === 0) return;
                const expected = bruteForceMap(data, palette);
                const result = new Uint8ClampedArray(data);
                applyPalette(result, palette);
                expect(result).toEqual(expected);
                const alpha = (d: Uint8ClampedArray) => d.filter((_, i) => i % 4 === 3);
                expect(alpha(result)).toEqual(alpha(data));
            }),
            fuzzParams,
        );
    });
});

describe("fuzz: pixelize", () => {
    it("every pixel equals the top-left pixel of its block", () => {
        fc.assert(
            fc.property(imageArbitrary, pixelSizeArbitrary, ({ data, width, height }, size) => {
                const result = new Uint8ClampedArray(data);
                pixelize(result, width, height, size);
                const expected = new Uint8ClampedArray(data.length);
                for (let y = 0; y < height; y++) {
                    for (let x = 0; x < width; x++) {
                        const src = ((y - (y % size)) * width + (x - (x % size))) * 4;
                        expected.set(data.subarray(src, src + 4), (y * width + x) * 4);
                    }
                }
                expect(result).toEqual(expected);
            }),
            fuzzParams,
        );
    });
});

describe("fuzz: pipeline", () => {
    it("retroize output only uses palette colours, progress is sane", () => {
        fc.assert(
            fc.property(
                imageArbitrary,
                colorsArbitrary,
                pixelSizeArbitrary,
                ({ data, width, height }, colors, pixelSize) => {
                    const result = new Uint8ClampedArray(data);
                    const progress: number[] = [];
                    const { palette } = runOperation(
                        "retroize",
                        result,
                        width,
                        height,
                        { colors, pixelSize },
                        (p) => progress.push(p.value),
                    );
                    expect(palette).not.toBeNull();
                    if (palette && palette.length > 0) {
                        const allowed = new Set(palette.map(keyOf));
                        for (const key of colorKeys(result)) expect(allowed.has(key)).toBe(true);
                    }
                    expect(progress.every((v) => v >= 0 && v <= 100)).toBe(true);
                    expect(progress).toEqual([...progress].sort((a, b) => a - b));
                    expect(progress.at(-1)).toBe(100);
                },
            ),
            fuzzParams,
        );
    });
});
