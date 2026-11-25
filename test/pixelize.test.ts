import { describe, expect, it } from "vitest";
import { pixelize } from "../src/core/pixelize.ts";

function image(width: number, height: number): Uint8ClampedArray {
    const data = new Uint8ClampedArray(width * height * 4);
    for (let i = 0; i < width * height; i++) {
        data.set([i % 256, (i * 7) % 256, (i * 13) % 256, 255], i * 4);
    }
    return data;
}

const pixelAt = (data: Uint8ClampedArray, width: number, x: number, y: number) => [
    ...data.subarray((y * width + x) * 4, (y * width + x) * 4 + 4),
];

describe("pixelize", () => {
    it("fills each block with its top-left pixel", () => {
        const width = 7;
        const height = 5;
        const original = image(width, height);
        const data = new Uint8ClampedArray(original);
        pixelize(data, width, height, 3);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const sx = x - (x % 3);
                const sy = y - (y % 3);
                expect(pixelAt(data, width, x, y)).toEqual(pixelAt(original, width, sx, sy));
            }
        }
    });

    it("is a no-op for block size 1", () => {
        const data = image(4, 4);
        const copy = new Uint8ClampedArray(data);
        pixelize(data, 4, 4, 1);
        expect(data).toEqual(copy);
    });

    it("rejects data that does not match the dimensions", () => {
        expect(() => {
            pixelize(new Uint8ClampedArray(12), 2, 2, 2);
        }).toThrow(RangeError);
    });
});
