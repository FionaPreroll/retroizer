import fc from "fast-check";

/** Number of runs per property; CI's fuzz job raises it via FUZZ_RUNS. */
export const FUZZ_RUNS = Number(process.env["FUZZ_RUNS"] ?? 200);

/** Optional fixed seed to replay a failure: FUZZ_SEED=<seed from the report>. */
const seed = process.env["FUZZ_SEED"];
export const fuzzParams: fc.Parameters<unknown> = {
    numRuns: FUZZ_RUNS,
    ...(seed === undefined ? {} : { seed: Number(seed) }),
};

export interface FuzzImage {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8ClampedArray;
}

/**
 * Random RGBA images: tiny to medium sizes, drawn from a small or large
 * colour pool (to hit both "fewer colours than k" and "many colours"), with
 * optional transparent pixels.
 */
export const imageArbitrary: fc.Arbitrary<FuzzImage> = fc
    .record({
        width: fc.integer({ min: 1, max: 48 }),
        height: fc.integer({ min: 1, max: 48 }),
        poolSize: fc.integer({ min: 1, max: 300 }),
        transparentShare: fc.oneof(fc.constant(0), fc.double({ min: 0, max: 1, noNaN: true })),
        seed: fc.integer(),
    })
    .map(({ width, height, poolSize, transparentShare, seed }) => {
        let s = seed >>> 0;
        const random = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
        const pool = Array.from({ length: poolSize }, () => [
            Math.floor(random() * 256),
            Math.floor(random() * 256),
            Math.floor(random() * 256),
        ]);
        const data = new Uint8ClampedArray(width * height * 4);
        for (let i = 0; i < data.length; i += 4) {
            const color = pool[Math.floor(random() * poolSize)]!;
            data[i] = color[0]!;
            data[i + 1] = color[1]!;
            data[i + 2] = color[2]!;
            data[i + 3] = random() < transparentShare ? 0 : Math.floor(random() * 255) + 1;
        }
        return { width, height, data };
    });

export const colorsArbitrary = fc.integer({ min: 1, max: 256 });
export const pixelSizeArbitrary = fc.integer({ min: 1, max: 64 });
