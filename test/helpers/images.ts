import type { Palette, RGB } from "../../src/core/types.ts";

/** RGBA data (alpha 255) from a list of colours. */
export function rgba(colors: readonly RGB[]): Uint8ClampedArray {
    const data = new Uint8ClampedArray(colors.length * 4);
    colors.forEach(([r, g, b], i) => {
        data.set([r, g, b, 255], i * 4);
    });
    return data;
}

/** Deterministic noise image. */
export function randomImage(pixels: number, seed = 7): Uint8ClampedArray {
    let s = seed;
    const random = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    const data = new Uint8ClampedArray(pixels * 4);
    for (let i = 0; i < data.length; i += 4) {
        data[i] = random() * 256;
        data[i + 1] = random() * 256;
        data[i + 2] = random() * 256;
        data[i + 3] = 255;
    }
    return data;
}

export function gradient(width: number, height: number): Uint8ClampedArray {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            data.set([(x * 255) / width, (y * 255) / height, 128, 255], (y * width + x) * 4);
        }
    }
    return data;
}

/** Reference implementation: plain nearest-colour search per pixel. */
export function bruteForceMap(data: Uint8ClampedArray, palette: Palette): Uint8ClampedArray {
    const out = new Uint8ClampedArray(data);
    for (let i = 0; i < out.length; i += 4) {
        let best = palette[0]!;
        let bestDistance = Infinity;
        for (const color of palette) {
            const d =
                (out[i]! - color[0]) ** 2 +
                (out[i + 1]! - color[1]) ** 2 +
                (out[i + 2]! - color[2]) ** 2;
            if (d < bestDistance) {
                bestDistance = d;
                best = color;
            }
        }
        out.set(best, i);
    }
    return out;
}

export function colorKeys(data: Uint8ClampedArray): Set<number> {
    const keys = new Set<number>();
    for (let i = 0; i < data.length; i += 4) {
        keys.add((data[i]! << 16) | (data[i + 1]! << 8) | data[i + 2]!);
    }
    return keys;
}

export const keyOf = ([r, g, b]: RGB): number => (r << 16) | (g << 8) | b;
