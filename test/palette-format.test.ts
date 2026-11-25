import { describe, expect, it } from "vitest";
import { toGimpPalette, toHexList } from "../src/core/palette-format.ts";

describe("palette formats", () => {
    const palette = [
        [255, 204, 0],
        [0, 0, 0],
    ] as const;

    it("lists hex values", () => {
        expect(toHexList(palette)).toBe("#FFCC00, #000000");
    });

    it("writes a GIMP palette", () => {
        expect(toGimpPalette(palette, "Test\nname")).toBe(
            "GIMP Palette\nName: Test name\nColumns: 8\n#\n255 204   0\t#FFCC00\n  0   0   0\t#000000\n",
        );
    });
});
