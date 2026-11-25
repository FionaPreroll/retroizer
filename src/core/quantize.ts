/**
 * Copyright Fiona <fipreroll+app@gmail.com>
 * SPDX-License-Identifier: GPL-3.0-only
 */

/**
 * Colour quantisation: histogram + weighted k-means (k-means++ seeding) and
 * nearest-colour mapping. Everything here is DOM-free so it runs in a Web
 * Worker, on the main thread and in Node (tests) alike.
 *
 * Pixel data is the RGBA layout of `ImageData.data`.
 */

import type { Palette, RGB } from "./types.ts";

/** Bits per channel used for the colour histogram (5 → 32768 bins). */
export const HISTOGRAM_BITS = 5;
const SHIFT = 8 - HISTOGRAM_BITS;
const BIN_COUNT = 1 << (3 * HISTOGRAM_BITS);

/** Weighted colour samples: `points` holds `size` RGB triples, `weights` the pixel counts. */
export interface Histogram {
    readonly points: Float64Array;
    readonly weights: Float64Array;
    readonly size: number;
}

/**
 * Collapse the image into a weighted colour histogram.
 *
 * Every pixel falls into a 5-bit-per-channel bin; each non-empty bin is
 * represented by the exact mean colour of its pixels, weighted by how many
 * pixels it holds. k-means on these (at most 32768) weighted points gives
 * practically the same palette as k-means on every pixel, but its cost no
 * longer depends on the image size.
 *
 * Fully transparent pixels are ignored.
 */
export function buildHistogram(data: Uint8ClampedArray): Histogram {
    const count = new Float64Array(BIN_COUNT);
    const sumR = new Float64Array(BIN_COUNT);
    const sumG = new Float64Array(BIN_COUNT);
    const sumB = new Float64Array(BIN_COUNT);

    for (let i = 0; i + 3 < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        const bin =
            ((r >> SHIFT) << (2 * HISTOGRAM_BITS)) |
            ((g >> SHIFT) << HISTOGRAM_BITS) |
            (b >> SHIFT);
        count[bin]!++;
        sumR[bin]! += r;
        sumG[bin]! += g;
        sumB[bin]! += b;
    }

    let size = 0;
    for (let bin = 0; bin < BIN_COUNT; bin++) {
        if (count[bin]! > 0) size++;
    }

    const points = new Float64Array(size * 3);
    const weights = new Float64Array(size);
    let p = 0;
    for (let bin = 0; bin < BIN_COUNT; bin++) {
        const n = count[bin]!;
        if (n === 0) continue;
        points[p * 3] = sumR[bin]! / n;
        points[p * 3 + 1] = sumG[bin]! / n;
        points[p * 3 + 2] = sumB[bin]! / n;
        weights[p] = n;
        p++;
    }

    return { points, weights, size };
}

/** Small deterministic PRNG (mulberry32), so palettes are reproducible. */
function createRandom(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function squaredDistance(
    points: Float64Array,
    p: number,
    centroids: Float64Array,
    c: number,
): number {
    const dr = points[p * 3]! - centroids[c * 3]!;
    const dg = points[p * 3 + 1]! - centroids[c * 3 + 1]!;
    const db = points[p * 3 + 2]! - centroids[c * 3 + 2]!;
    return dr * dr + dg * dg + db * db;
}

/** Pick an index with probability proportional to `scores[i]`, or -1 if all are 0. */
function pickWeighted(scores: Float64Array, size: number, random: () => number): number {
    let total = 0;
    for (let i = 0; i < size; i++) total += scores[i]!;
    if (!(total > 0)) return -1;
    let target = random() * total;
    for (let i = 0; i < size; i++) {
        target -= scores[i]!;
        if (target < 0) return i;
    }
    for (let i = size - 1; i >= 0; i--) {
        if (scores[i]! > 0) return i;
    }
    return -1;
}

/** k-means++ seeding, weighted by pixel counts. */
function seedCentroids(
    { points, weights, size }: Histogram,
    k: number,
    random: () => number,
): Float64Array {
    const centroids = new Float64Array(k * 3);
    const nearest = new Float64Array(size).fill(Infinity);
    const scores = new Float64Array(size);

    let chosen = pickWeighted(weights, size, random);
    for (let c = 0; c < k; c++) {
        if (chosen < 0) chosen = c % size; // only identical points left
        centroids[c * 3] = points[chosen * 3]!;
        centroids[c * 3 + 1] = points[chosen * 3 + 1]!;
        centroids[c * 3 + 2] = points[chosen * 3 + 2]!;
        if (c === k - 1) break;

        for (let p = 0; p < size; p++) {
            const d = squaredDistance(points, p, centroids, c);
            if (d < nearest[p]!) nearest[p] = d;
            scores[p] = weights[p]! * nearest[p]!;
        }
        chosen = pickWeighted(scores, size, random);
    }
    return centroids;
}

export interface KMeansOptions {
    /** Upper bound for Lloyd iterations. Default 50. */
    readonly maxIterations?: number;
    /** Stop once no centroid moves further than this (RGB units). Default 0.5. */
    readonly tolerance?: number;
    /** Seed for the k-means++ initialisation. Default 1. */
    readonly seed?: number;
    /** Called after every iteration with the current (rounded) palette. */
    readonly onIteration?: (iteration: number, maxIterations: number, palette: Palette) => void;
}

/**
 * Weighted k-means over a histogram from {@link buildHistogram}.
 *
 * @returns at most `k` distinct colours
 */
export function kMeans(histogram: Histogram, k: number, options: KMeansOptions = {}): Palette {
    const { maxIterations = 50, tolerance = 0.5, seed = 1, onIteration } = options;
    const { points, weights, size } = histogram;
    const clusters = Math.floor(k);

    if (size === 0 || clusters < 1) return [];
    if (size <= clusters) return toPalette(points, size);

    const random = createRandom(seed);
    const centroids = seedCentroids(histogram, clusters, random);
    const sums = new Float64Array(clusters * 3);
    const totals = new Float64Array(clusters);
    const errors = new Float64Array(size);
    const toleranceSq = tolerance * tolerance;

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
        sums.fill(0);
        totals.fill(0);

        for (let p = 0; p < size; p++) {
            let best = 0;
            let bestDistance = Infinity;
            for (let c = 0; c < clusters; c++) {
                const d = squaredDistance(points, p, centroids, c);
                if (d < bestDistance) {
                    bestDistance = d;
                    best = c;
                }
            }
            const w = weights[p]!;
            sums[best * 3]! += points[p * 3]! * w;
            sums[best * 3 + 1]! += points[p * 3 + 1]! * w;
            sums[best * 3 + 2]! += points[p * 3 + 2]! * w;
            totals[best]! += w;
            errors[p] = bestDistance * w;
        }

        let maxShift = 0;
        for (let c = 0; c < clusters; c++) {
            let r: number;
            let g: number;
            let b: number;
            const total = totals[c]!;
            if (total > 0) {
                r = sums[c * 3]! / total;
                g = sums[c * 3 + 1]! / total;
                b = sums[c * 3 + 2]! / total;
            } else {
                // Empty cluster: move it to the worst-represented colour.
                let worst = 0;
                for (let p = 1; p < size; p++) {
                    if (errors[p]! > errors[worst]!) worst = p;
                }
                errors[worst] = 0;
                r = points[worst * 3]!;
                g = points[worst * 3 + 1]!;
                b = points[worst * 3 + 2]!;
                maxShift = Infinity;
            }
            const dr = r - centroids[c * 3]!;
            const dg = g - centroids[c * 3 + 1]!;
            const db = b - centroids[c * 3 + 2]!;
            maxShift = Math.max(maxShift, dr * dr + dg * dg + db * db);
            centroids[c * 3] = r;
            centroids[c * 3 + 1] = g;
            centroids[c * 3 + 2] = b;
        }

        onIteration?.(iteration, maxIterations, toPalette(centroids, clusters));
        if (maxShift <= toleranceSq) break;
    }

    return toPalette(centroids, clusters);
}

/** Round a flat centroid array to a palette of distinct integer colours. */
function toPalette(flat: Float64Array, count: number): Palette {
    const seen = new Set<number>();
    const palette: RGB[] = [];
    for (let i = 0; i < count; i++) {
        const r = Math.round(flat[i * 3]!);
        const g = Math.round(flat[i * 3 + 1]!);
        const b = Math.round(flat[i * 3 + 2]!);
        const key = (r << 16) | (g << 8) | b;
        if (seen.has(key)) continue;
        seen.add(key);
        palette.push([r, g, b]);
    }
    return palette;
}

/**
 * Index of the palette colour closest to (r, g, b) in RGB space.
 * Ties go to the earlier entry. `flatPalette` is `[r, g, b, r, g, b, ...]`.
 */
export function nearestColorIndex(
    r: number,
    g: number,
    b: number,
    flatPalette: ArrayLike<number>,
): number {
    let best = 0;
    let bestDistance = Infinity;
    for (let c = 0, n = flatPalette.length / 3; c < n; c++) {
        const dr = r - flatPalette[c * 3]!;
        const dg = g - flatPalette[c * 3 + 1]!;
        const db = b - flatPalette[c * 3 + 2]!;
        const d = dr * dr + dg * dg + db * db;
        if (d < bestDistance) {
            bestDistance = d;
            best = c;
        }
    }
    return best;
}

const CACHE_BITS = 16;
const CACHE_SIZE = 1 << CACHE_BITS;

/**
 * Replace every pixel's RGB with its nearest palette colour, in place.
 * Alpha is left untouched. Results are exact; a small direct-mapped cache
 * skips the palette search for colours seen recently.
 */
export function applyPalette(data: Uint8ClampedArray, palette: Palette): void {
    if (palette.length === 0) return;
    const flat = new Int32Array(palette.flat());

    const cacheKeys = new Int32Array(CACHE_SIZE).fill(-1);
    const cacheValues = new Uint16Array(CACHE_SIZE);

    for (let i = 0; i + 3 < data.length; i += 4) {
        const r = data[i]!;
        const g = data[i + 1]!;
        const b = data[i + 2]!;
        const key = (r << 16) | (g << 8) | b;
        const slot = Math.imul(key, 0x9e3779b1) >>> (32 - CACHE_BITS);

        let index: number;
        if (cacheKeys[slot] === key) {
            index = cacheValues[slot]!;
        } else {
            index = nearestColorIndex(r, g, b, flat);
            cacheKeys[slot] = key;
            cacheValues[slot] = index;
        }

        data[i] = flat[index * 3]!;
        data[i + 1] = flat[index * 3 + 1]!;
        data[i + 2] = flat[index * 3 + 2]!;
    }
}

/**
 * The distinct colours of all visible pixels, or null as soon as there are
 * more than `limit`. Bails out early on photos, so it is cheap.
 */
export function distinctColors(data: Uint8ClampedArray, limit: number): Palette | null {
    const seen = new Set<number>();
    const palette: RGB[] = [];
    for (let i = 0; i + 3 < data.length; i += 4) {
        if (data[i + 3] === 0) continue;
        const key = (data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!;
        if (seen.has(key)) continue;
        if (seen.size >= limit) return null;
        seen.add(key);
        palette.push([data[i]!, data[i + 1]!, data[i + 2]!]);
    }
    return palette;
}

/**
 * Palette of at most `colors` colours for an image. Images that already use
 * no more colours than that keep exactly their colours; everything else goes
 * through histogram k-means.
 */
export function generatePalette(
    data: Uint8ClampedArray,
    colors: number,
    options: KMeansOptions = {},
): Palette {
    const k = Math.floor(colors);
    if (k < 1) return [];
    return distinctColors(data, k) ?? kMeans(buildHistogram(data), k, options);
}
