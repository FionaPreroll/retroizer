import { describe, expect, it } from "vitest";
import { runOperation } from "../src/core/pipeline.ts";
import type { Operation } from "../src/core/types.ts";
import { colorKeys, gradient } from "./helpers/images.ts";

describe("runOperation", () => {
    it("retroize limits colours and reports monotonic progress up to 100", () => {
        const data = gradient(64, 48);
        const progress: number[] = [];
        const { palette } = runOperation(
            "retroize",
            data,
            64,
            48,
            { colors: 8, pixelSize: 4 },
            (p) => progress.push(p.value),
        );
        expect(palette?.length).toBeLessThanOrEqual(8);
        expect(colorKeys(data).size).toBeLessThanOrEqual(8);
        expect(progress.at(-1)).toBe(100);
        expect(progress).toEqual([...progress].sort((a, b) => a - b));
    });

    it("pixelize does not compute a palette", () => {
        const data = gradient(16, 16);
        expect(
            runOperation("pixelize", data, 16, 16, { colors: 8, pixelSize: 4 }).palette,
        ).toBeNull();
    });

    it("rejects unknown operations", () => {
        expect(() =>
            runOperation("explode" as Operation, new Uint8ClampedArray(4), 1, 1, {
                colors: 2,
                pixelSize: 1,
            }),
        ).toThrow();
    });
});
